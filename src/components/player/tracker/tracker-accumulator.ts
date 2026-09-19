import type {
  QualitySummary,
  PerformanceSummary,
  TrackerSessionPayload,
} from "./types";
import type { EngineQualitySample } from "../engine/types";
import { measurePerformance } from "../embed/performance-timing";

export function mergeRanges(
  ranges: [number, number][],
  tolerance: number = 0.75,
  maxRanges: number = 256
): [number, number][] {
  if (ranges.length === 0) return [];

  // Sort ranges by start time
  const sorted = [...ranges]
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .map(([start, end]): [number, number] => [Math.max(0, start), Math.max(0, end)])
    .sort((a, b) => a[0] - b[0]);

  if (sorted.length === 0) return [];

  const merged: [number, number][] = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    // If overlapping or within tolerance gap
    if (next[0] <= current[1] + tolerance) {
      current = [current[0], Math.max(current[1], next[1])];
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  if (merged.length > maxRanges) {
    // If over max ranges, merge the closest gaps to keep under maxRanges
    return merged.slice(0, maxRanges);
  }

  return merged;
}

export class TrackerAccumulator {
  private readonly videoId: string;
  private readonly sessionId: string;

  private durationSeconds: number | null = null;
  private lastPositionSeconds: number | null = null;
  private maxPositionSeconds: number | null = null;

  private watchTimeMs: number = 0;
  private watchedRanges: [number, number][] = [];

  private pauseCount: number = 0;
  private seekCount: number = 0;
  private rateChangeCount: number = 0;
  private fullscreenCount: number = 0;

  private bufferCount: number = 0;
  private bufferTimeMs: number = 0;
  private isBuffering: boolean = false;
  private bufferStartTime: number | null = null;

  private isSeeking: boolean = false;
  private isPlaying: boolean = false;
  private isDocumentHidden: boolean = false;

  private userForegroundStarted: boolean = false;
  private startedInBackgroundAutoplay: boolean = false;
  private startedFromResume: boolean = false;
  private resumeFromSeconds: number | null = null;
  private resumeDecision: "none" | "continue" | "restart" = "none";

  private lastProgressTime: number | null = null;
  private lastWallTime: number | null = null;
  private lastPlaybackRate: number = 1;

  private clickToPlayWallTime: number | null = null;
  private clickToFirstFrameMs: number | null = null;

  private ended: boolean = false;
  private hasError: boolean = false;
  private lastErrorType: string | null = null;

  // Quality Summary State
  private qualitySource: "hlsjs" | "native" | "direct" = "direct";
  private startupQuality: { height: number | null; bitrate: number | null } | null = null;
  private foregroundQuality: {
    initialHeight: number | null;
    currentHeight: number | null;
    maxHeight: number | null;
    switchCount: number;
  } | null = null;
  private bandwidthEstimateBps: number | null = null;

  private isDirty: boolean = false;

  constructor(videoId: string, sessionId: string) {
    this.videoId = videoId;
    this.sessionId = sessionId;
    if (typeof document !== "undefined") {
      this.isDocumentHidden = document.hidden;
    }
  }

  public markDirty(): void {
    this.isDirty = true;
  }

  public getIsDirty(): boolean {
    return this.isDirty;
  }

  public clearDirty(): void {
    this.isDirty = false;
  }

  public setInitialEngineContext(options: {
    experience: string;
    resumeState: string;
    resumePosition?: number | null;
    resumeDecision?: "none" | "continue" | "restart";
  }): void {
    if (options.experience === "background_autoplay") {
      this.startedInBackgroundAutoplay = true;
    }
    if (options.resumePosition && options.resumePosition >= 1) {
      this.startedFromResume = true;
      this.resumeFromSeconds = options.resumePosition;
    }
    if (options.resumeDecision) {
      this.resumeDecision = options.resumeDecision;
    }
    this.markDirty();
  }

  public onForegroundUserIntent(): void {
    if (!this.userForegroundStarted) {
      this.userForegroundStarted = true;
      this.clickToPlayWallTime = performance.now();
      this.lastProgressTime = null;
      this.lastWallTime = null;
      this.markDirty();
    }
  }

  public onFirstFrameRendered(): void {
    if (this.clickToPlayWallTime != null && this.clickToFirstFrameMs == null) {
      this.clickToFirstFrameMs = Math.round(performance.now() - this.clickToPlayWallTime);
      this.markDirty();
    }
  }

  public onResumeDecision(decision: "none" | "continue" | "restart"): void {
    if (this.resumeDecision !== decision) {
      this.resumeDecision = decision;
      this.markDirty();
    }
  }

  public onTimeUpdate(currentTime: number, duration?: number, playbackRate?: number): void {
    if (duration != null && Number.isFinite(duration) && duration > 0) {
      this.durationSeconds = duration;
    }
    if (playbackRate != null && playbackRate > 0) {
      this.lastPlaybackRate = playbackRate;
    }

    if (!Number.isFinite(currentTime) || currentTime < 0) return;

    this.lastPositionSeconds = currentTime;

    if (this.userForegroundStarted) {
      if (this.maxPositionSeconds == null || currentTime > this.maxPositionSeconds) {
        this.maxPositionSeconds = currentTime;
      }
    }

    // Accumulate watched range ONLY during active foreground playback
    if (
      this.userForegroundStarted &&
      this.isPlaying &&
      !this.isBuffering &&
      !this.isSeeking &&
      !this.isDocumentHidden
    ) {
      const wallNow = performance.now();

      if (this.lastProgressTime != null && this.lastWallTime != null) {
        const wallDeltaSeconds = Math.max(0, (wallNow - this.lastWallTime) / 1000);
        const mediaDeltaSeconds = currentTime - this.lastProgressTime;

        // Max plausible advance for this tick to prevent jumps/seeks from counting
        const maxExpectedAdvance = Math.max(1.5, wallDeltaSeconds * this.lastPlaybackRate + 0.75);

        if (mediaDeltaSeconds > 0 && mediaDeltaSeconds <= maxExpectedAdvance) {
          const sliceStart = this.lastProgressTime;
          const sliceEnd = currentTime;

          // Add range slice and merge
          this.watchedRanges = mergeRanges([...this.watchedRanges, [sliceStart, sliceEnd]]);

          // Add wall clock consumption
          this.watchTimeMs += Math.round(wallDeltaSeconds * 1000);
          this.markDirty();
        }
      }

      this.lastProgressTime = currentTime;
      this.lastWallTime = wallNow;
    } else {
      this.lastProgressTime = null;
      this.lastWallTime = null;
    }
  }

  public onPlay(): void {
    this.isPlaying = true;
    if (this.userForegroundStarted && !this.isDocumentHidden) {
      this.lastWallTime = performance.now();
    }
  }

  public onPlaying(): void {
    this.isPlaying = true;
    if (this.isBuffering) {
      this.onBufferEnd();
    }
    if (this.userForegroundStarted && !this.isDocumentHidden) {
      this.lastWallTime = performance.now();
    }
    this.markDirty();
  }

  public onPause(): void {
    this.isPlaying = false;
    this.lastProgressTime = null;
    this.lastWallTime = null;

    if (this.userForegroundStarted && !this.ended) {
      this.pauseCount++;
      this.markDirty();
    }
  }

  public onSeekStart(): void {
    this.isSeeking = true;
    this.lastProgressTime = null;
    this.lastWallTime = null;
  }

  public onSeekEnd(toTime: number): void {
    this.isSeeking = false;
    this.lastProgressTime = null;
    this.lastWallTime = null;

    if (this.userForegroundStarted) {
      // If restart resume decision was made at t=0, do not count as user seek
      if (this.resumeDecision === "restart" && toTime === 0 && this.seekCount === 0) {
        // Skip technical restart reset
      } else {
        this.seekCount++;
        this.markDirty();
      }
    }
  }

  public onRateChange(newRate: number): void {
    this.lastPlaybackRate = newRate;
    if (this.userForegroundStarted) {
      this.rateChangeCount++;
      this.markDirty();
    }
  }

  public onFullscreenEnter(): void {
    this.fullscreenCount++;
    this.markDirty();
  }

  public onBufferStart(): void {
    if (!this.isBuffering) {
      this.isBuffering = true;
      this.lastProgressTime = null;
      this.lastWallTime = null;

      if (this.userForegroundStarted) {
        this.bufferCount++;
        this.bufferStartTime = performance.now();
        this.markDirty();
      }
    }
  }

  public onBufferEnd(): void {
    if (this.isBuffering) {
      this.isBuffering = false;
      if (this.bufferStartTime != null) {
        const delta = Math.round(performance.now() - this.bufferStartTime);
        this.bufferTimeMs += Math.max(0, delta);
        this.bufferStartTime = null;
        this.markDirty();
      }
    }
  }

  public onVisibilityChange(hidden: boolean): void {
    this.isDocumentHidden = hidden;
    if (hidden) {
      // Close active tracking slice
      this.lastProgressTime = null;
      this.lastWallTime = null;
      this.markDirty();
    } else {
      if (this.isPlaying && this.userForegroundStarted) {
        this.lastWallTime = performance.now();
      }
    }
  }

  public onEnded(): void {
    this.isPlaying = false;
    this.ended = true;
    this.lastProgressTime = null;
    this.lastWallTime = null;
    this.markDirty();
  }

  public onError(message?: string, errorType?: string): void {
    this.hasError = true;
    this.lastErrorType = errorType || "media";
    this.markDirty();
  }

  public onQualitySample(sample: EngineQualitySample): void {
    this.qualitySource = sample.source;
    if (sample.bandwidthEstimateBps != null && sample.bandwidthEstimateBps > 0) {
      this.bandwidthEstimateBps = sample.bandwidthEstimateBps;
    }

    const height = sample.height ?? null;
    const bitrate = sample.bitrate ?? null;

    if (!this.userForegroundStarted) {
      // Background Autoplay / Initial startup quality
      if (!this.startupQuality) {
        this.startupQuality = { height, bitrate };
        this.markDirty();
      }
    } else {
      // Foreground Quality
      if (!this.foregroundQuality) {
        this.foregroundQuality = {
          initialHeight: height,
          currentHeight: height,
          maxHeight: height,
          switchCount: 0,
        };
        this.markDirty();
      } else {
        const prevHeight = this.foregroundQuality.currentHeight;
        if (height != null && height !== prevHeight) {
          const newMax = Math.max(this.foregroundQuality.maxHeight || 0, height);
          this.foregroundQuality.currentHeight = height;
          this.foregroundQuality.maxHeight = newMax;
          this.foregroundQuality.switchCount++;
          this.markDirty();
        }
      }
    }
  }

  public onBandwidthEstimate(estimateBps: number): void {
    if (estimateBps > 0) {
      this.bandwidthEstimateBps = estimateBps;
      this.markDirty();
    }
  }

  public getQualitySummary(): QualitySummary {
    return {
      version: 1,
      source: this.qualitySource,
      startup: this.startupQuality,
      foreground: this.foregroundQuality,
      bandwidthEstimateBps: this.bandwidthEstimateBps,
    };
  }

  public getPerformanceSummary(): PerformanceSummary {
    const bootstrapDurationMs = measurePerformance(
      "ep:measure:bootstrap",
      "ep:bootstrap:start",
      "ep:bootstrap:end",
      this.videoId
    );
    const manifestDurationMs = measurePerformance(
      "ep:measure:manifest",
      "ep:manifest:start",
      "ep:manifest:parsed",
      this.videoId
    );
    const firstFragmentDurationMs = measurePerformance(
      "ep:measure:first-frag",
      "ep:first-frag:start",
      "ep:first-frag:buffered",
      this.videoId
    );
    const mediaAttachToFirstFrameMs = measurePerformance(
      "ep:measure:attach-to-frame",
      "ep:media:attach",
      "ep:first-frame",
      this.videoId
    );
    const resumeReadyMs = measurePerformance(
      "ep:measure:resume-ready",
      "ep:engine:start",
      "ep:resume:ready",
      this.videoId
    );

    return {
      version: 1,
      bootstrapDurationMs: bootstrapDurationMs ?? null,
      manifestDurationMs: manifestDurationMs ?? null,
      firstFragmentDurationMs: firstFragmentDurationMs ?? null,
      mediaAttachToFirstFrameMs: mediaAttachToFirstFrameMs ?? null,
      resumeReadyMs: resumeReadyMs ?? null,
      clickToFirstFrameMs: this.clickToFirstFrameMs ?? null,
    };
  }

  public getSnapshot(sequence: number): TrackerSessionPayload {
    const merged = mergeRanges(this.watchedRanges);
    const uniqueWatchedSeconds = merged.reduce(
      (sum, [start, end]) => sum + Math.max(0, end - start),
      0
    );

    const duration = this.durationSeconds || 0;
    const completionPercent =
      duration > 0
        ? Math.min(100, Math.max(0, (uniqueWatchedSeconds / duration) * 100))
        : 0;

    return {
      sessionId: this.sessionId,
      sequence,
      durationSeconds: this.durationSeconds,
      lastPositionSeconds: this.lastPositionSeconds,
      maxPositionSeconds: this.maxPositionSeconds,
      watchTimeMs: this.watchTimeMs,
      watchedRanges: merged,
      uniqueWatchedSeconds: parseFloat(uniqueWatchedSeconds.toFixed(3)),
      completionPercent: parseFloat(completionPercent.toFixed(2)),
      pauseCount: this.pauseCount,
      seekCount: this.seekCount,
      rateChangeCount: this.rateChangeCount,
      fullscreenCount: this.fullscreenCount,
      bufferCount: this.bufferCount,
      bufferTimeMs: this.bufferTimeMs,
      startedInBackgroundAutoplay: this.startedInBackgroundAutoplay,
      startedFromResume: this.startedFromResume,
      resumeFromSeconds: this.resumeFromSeconds,
      resumeDecision: this.resumeDecision,
      qualitySummary: this.getQualitySummary(),
      performanceSummary: this.getPerformanceSummary(),
      ended: this.ended,
      hasError: this.hasError,
      lastErrorType: this.lastErrorType,
    };
  }
}
