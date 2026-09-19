/**
 * Evandro Player Headless Media Engine
 * Standalone, high-performance video engine with zero React dependencies.
 * Full ownership of playback, media element, HLS, first frame, and startup visual lifecycle.
 */

import type Hls from "hls.js";
import { shouldUseNativeHls, loadHlsEngine } from "../embed/hls-engine";
import {
  createStartupHlsConfig,
  saveBandwidthEstimate,
} from "../embed/startup-abr";
import {
  markPerformance,
  markPerformanceOnce,
  onFirstVideoFrame,
} from "../embed/performance-timing";
import type { PlayerConfig } from "@/types/player-config";
import {
  resolveStartupVisualFromConfig,
  applyStartupVisualSurface,
  releaseStartupVisualSurface,
} from "./startup-visual-resolver";
import { clearSavedResume } from "@/lib/player/resume-storage";
import type {
  EngineFirstFrameListener,
  EngineSourceOptions,
  EngineStateListener,
  EngineTelemetryListener,
  EngineTelemetrySignal,
  IPlayerEngine,
  PlaybackInitiator,
  PlayerEngineOptions,
  PlayerEngineState,
  StartupVisualState,
} from "./types";

export function findMaxLevelForHeight(
  levels: Array<{ height?: number }>,
  maxHeight: number = 480
): number {
  if (!levels || levels.length === 0) return -1;
  let bestIndex = -1;
  let bestHeight = 0;
  for (let i = 0; i < levels.length; i++) {
    const h = levels[i].height || 0;
    if (h > 0 && h <= maxHeight && h >= bestHeight) {
      bestHeight = h;
      bestIndex = i;
    }
  }
  if (bestIndex === -1) {
    let minHeight = Infinity;
    for (let i = 0; i < levels.length; i++) {
      const h = levels[i].height || 0;
      if (h > 0 && h < minHeight) {
        minHeight = h;
        bestIndex = i;
      }
    }
  }
  return bestIndex !== -1 ? bestIndex : 0;
}

export class PlayerEngine implements IPlayerEngine {
  private readonly _video: HTMLVideoElement;
  private readonly _stageElement: HTMLElement | null;
  private _startupVisualElement: HTMLElement | null;
  private readonly _debug: boolean;

  private _hls: Hls | null = null;
  private _generation = 0;
  private _isDestroyed = false;
  private _userForegroundRequested = false;
  private _hasRevealedVideo = false;
  private _startupVisualState: StartupVisualState = "available";
  private _sourceOptions: EngineSourceOptions | null = null;

  private _state: PlayerEngineState = {
    videoId: "",
    playbackUrl: null,
    experience: "idle",
    playbackInitiator: "user",
    userForegroundRequested: false,
    isPlaying: false,
    isMuted: false,
    volume: 1,
    currentTime: 0,
    duration: 0,
    bufferedEnd: 0,
    playbackRate: 1,
    hasFirstFrame: false,
    hasStartedForeground: false,
    isBuffering: false,
    isEnded: false,
    hasError: false,
    errorMessage: null,
    startupVisualState: "available",
    resumeState: "none",
    resumeDecision: "none",
    requestedResumeTime: null,
    resolvedResumeTime: null,
  };

  private _firstFrameListeners = new Set<EngineFirstFrameListener>();
  private _stateListeners = new Set<EngineStateListener>();
  private _telemetryListeners = new Set<EngineTelemetryListener>();
  private _cancelFirstFrameCallback: (() => void) | null = null;
  private _visualAbortController: AbortController | null = null;
  private _resumeCleanup: (() => void) | null = null;

  // Background window looping ceiling (~8 seconds)
  private readonly BACKGROUND_WINDOW_SECONDS = 8;

  constructor(options: PlayerEngineOptions) {
    this._video = options.videoElement;
    this._stageElement = options.stageElement || null;
    this._startupVisualElement = options.startupVisualElement || null;
    this._debug = Boolean(options.debug);

    this.bindVideoEvents();
    this.bindVisibilityEvents();

    markPerformance("ep:engine:start");
  }

  public get video(): HTMLVideoElement {
    return this._video;
  }

  public get state(): PlayerEngineState {
    return this._state;
  }

  public get hls(): Hls | null {
    return this._hls;
  }

  public setStartupVisualElement(element: HTMLElement | null): void {
    this._startupVisualElement = element;
    if (this._sourceOptions && !this._isDestroyed) {
      if (
        this._state.resumeState === "preparing" ||
        this._state.resumeState === "ready"
      ) {
        applyStartupVisualSurface(this._startupVisualElement, {
          type: "none",
          url: null,
          fallbackUrl: null,
        });
      } else if (
        this._startupVisualState === "visible" ||
        this._startupVisualState === "loading" ||
        this._startupVisualState === "pending_release"
      ) {
        this.setupStartupVisual(this._sourceOptions, this._generation);
      }
    }
  }

  private updateState(partial: Partial<PlayerEngineState>): void {
    this._state = { ...this._state, ...partial };
    this._stateListeners.forEach((listener) => {
      try {
        listener(this._state);
      } catch (err) {
        console.error("[PlayerEngine] Listener error:", err);
      }
    });
  }

  private emitTelemetry(signal: EngineTelemetrySignal): void {
    if (this._isDestroyed) return;
    this._telemetryListeners.forEach((listener) => {
      try {
        listener(signal);
      } catch (err) {
        console.error("[PlayerEngine] Telemetry listener error:", err);
      }
    });
  }

  public subscribe(listener: EngineStateListener): () => void {
    this._stateListeners.add(listener);
    listener(this._state);
    return () => {
      this._stateListeners.delete(listener);
    };
  }

  public subscribeTelemetry(listener: EngineTelemetryListener): () => void {
    this._telemetryListeners.add(listener);
    return () => {
      this._telemetryListeners.delete(listener);
    };
  }

  public onFirstFrame(listener: EngineFirstFrameListener): () => void {
    this._firstFrameListeners.add(listener);
    if (this._state.hasFirstFrame) {
      listener(performance.now());
    }
    return () => {
      this._firstFrameListeners.delete(listener);
    };
  }

  private bindVideoEvents(): void {
    const v = this._video;

    v.addEventListener("play", () => this.updateState({ isPlaying: true }));
    v.addEventListener("pause", () =>
      this.updateState({ isPlaying: false, isBuffering: false })
    );
    v.addEventListener("waiting", () => this.updateState({ isBuffering: true }));
    v.addEventListener("canplay", () => this.updateState({ isBuffering: false }));

    v.addEventListener("playing", () => {
      this.updateState({
        isPlaying: true,
        isBuffering: false,
        isEnded: false,
        hasStartedForeground: this._state.experience === "foreground",
      });

      // Playing safety guard: If foreground is active, no startup visual can remain
      if (
        this._state.experience === "foreground" &&
        this._userForegroundRequested
      ) {
        this.revealVideo();
        this.releaseStartupVisual(this._state.videoId);
      }
    });

    v.addEventListener("ended", () => {
      this.updateState({ isPlaying: false, isEnded: true, isBuffering: false });
      clearSavedResume(this._state.videoId);
    });

    v.addEventListener("volumechange", () => {
      this.updateState({
        volume: v.volume,
        isMuted: v.muted || v.volume === 0,
      });
    });

    v.addEventListener("ratechange", () => {
      this.updateState({ playbackRate: v.playbackRate });
    });

    v.addEventListener("durationchange", () => {
      if (Number.isFinite(v.duration)) {
        this.updateState({ duration: v.duration });
      }
    });

    v.addEventListener("timeupdate", () => {
      this.updateState({ currentTime: v.currentTime });
      if (v.buffered && v.buffered.length > 0) {
        try {
          const end = v.buffered.end(v.buffered.length - 1);
          this.updateState({ bufferedEnd: end });
        } catch {
          // ignore
        }
      }
      this.handleBackgroundAutoplayWindow();
    });

    const emitNativeQualityIfApplicable = () => {
      if (!this._hls && v.videoWidth > 0 && v.videoHeight > 0) {
        const isNativeHls = Boolean(
          this._sourceOptions?.playbackUrl &&
            (this._sourceOptions.playbackUrl.includes(".m3u8") ||
              this._sourceOptions.playbackUrl.includes("m3u8")) &&
            shouldUseNativeHls(v)
        );
        this.emitTelemetry({
          type: "QUALITY_SAMPLE",
          sample: {
            source: isNativeHls ? "native" : "direct",
            level: null,
            width: v.videoWidth,
            height: v.videoHeight,
            bitrate: null,
            bandwidthEstimateBps: null,
          },
        });
      }
    };

    v.addEventListener("loadedmetadata", emitNativeQualityIfApplicable);
    v.addEventListener("canplay", emitNativeQualityIfApplicable);
    v.addEventListener("resize", emitNativeQualityIfApplicable);

    v.addEventListener("error", () => {
      if (this._video.error) {
        this.updateState({
          hasError: true,
          errorMessage: this._video.error.message || "Erro na mídia do vídeo.",
        });
        this.emitTelemetry({
          type: "ERROR",
          errorType: "media",
          message: this._video.error.message || "Video media error",
        });
      }
    });
  }

  private _onVisibilityChange = (): void => {
    if (this._isDestroyed) return;

    if (document.hidden) {
      if (this._state.experience === "background_autoplay" && !this._video.paused) {
        this._video.pause();
      }
    } else {
      if (this._state.experience === "background_autoplay" && this._video.paused) {
        this._video.play().catch(() => {});
      }
    }
  };

  private bindVisibilityEvents(): void {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this._onVisibilityChange);
    }
  }

  /**
   * Loops back to 0s when reaching the 8s background window limit.
   */
  private handleBackgroundAutoplayWindow(): void {
    if (this._state.experience !== "background_autoplay") return;

    const v = this._video;
    const maxWindow =
      v.duration && v.duration < this.BACKGROUND_WINDOW_SECONDS
        ? v.duration - 0.2
        : this.BACKGROUND_WINDOW_SECONDS;

    if (v.currentTime >= maxWindow && !v.paused) {
      v.currentTime = 0;
    }
  }

  /**
   * Primary entry point to prepare and attach media source.
   */
  public async loadSource(options: EngineSourceOptions): Promise<void> {
    if (this._isDestroyed) return;

    const currentGen = ++this._generation;
    this._sourceOptions = options;
    this._userForegroundRequested = false;
    this._hasRevealedVideo = false;

    if (this._resumeCleanup) {
      this._resumeCleanup();
      this._resumeCleanup = null;
    }

    const videoId = options.videoId;
    const playbackUrl = options.playbackUrl;

    const persistentResumeEnabled =
      options.config?.playback?.persistentResume ?? true;
    const isResumeEligible = Boolean(
      persistentResumeEnabled &&
        options.resumePosition &&
        options.resumePosition >= 1
    );
    const resumePos = isResumeEligible ? options.resumePosition! : null;
    const isBg = isResumeEligible ? false : Boolean(options.backgroundAutoplay);

    this.updateState({
      videoId,
      playbackUrl,
      experience: isBg ? "background_autoplay" : "foreground",
      playbackInitiator: isBg ? "autoplay" : "system",
      userForegroundRequested: false,
      hasFirstFrame: false,
      hasStartedForeground: false,
      isBuffering: false,
      isEnded: false,
      hasError: false,
      errorMessage: null,
      startupVisualState: isResumeEligible ? "released" : "available",
      resumeState: isResumeEligible ? "preparing" : "none",
      resumeDecision: "none",
      requestedResumeTime: resumePos,
      resolvedResumeTime: null,
    });

    // 1. Setup Startup Visuals or Black Surface for Resume
    if (isResumeEligible) {
      this._startupVisualState = "released";
      if (this._startupVisualElement) {
        applyStartupVisualSurface(this._startupVisualElement, {
          type: "none",
          url: null,
          fallbackUrl: null,
        });
      }
      this.setupResumeDetection(videoId, currentGen, resumePos!);
    } else {
      this.setupStartupVisual(options, currentGen);
      this.setupFirstFrameDetection(videoId, currentGen);
    }

    // 2. Configure Video Element base attributes
    this._video.playsInline = true;
    this._video.preload = "auto";
    this._video.removeAttribute("poster");

    if (isResumeEligible) {
      const vol = options.defaultVolume ?? 1;
      this._video.volume = vol;
      this._video.muted = vol === 0;
      this._video.playbackRate = options.defaultPlaybackRate ?? 1;
      this._video.autoplay = false;
    } else if (isBg) {
      this._video.muted = true;
      this._video.autoplay = true;
    } else {
      const vol = options.defaultVolume ?? 1;
      this._video.volume = vol;
      this._video.muted = vol === 0;
      this._video.playbackRate = options.defaultPlaybackRate ?? 1;
    }

    // 3. Attach Media Source with early seek if resume
    await this.attachMedia(playbackUrl, isBg, currentGen, resumePos);
  }

  /**
   * Resume-specific frame and seek readiness detection.
   * Confirms frame is available at the restored position before marking ready.
   */
  private setupResumeDetection(
    videoId: string,
    gen: number,
    targetResumeTime: number
  ): void {
    if (this._cancelFirstFrameCallback) {
      this._cancelFirstFrameCallback();
      this._cancelFirstFrameCallback = null;
    }

    this._video.style.opacity = "0";

    const v = this._video;

    const onSeekedOrFrameReady = () => {
      if (gen !== this._generation || this._isDestroyed) return;
      if (this._state.resumeState !== "preparing") return;

      const curr = v.currentTime;
      if (curr >= 0.5 || Math.abs(curr - targetResumeTime) <= 2.5) {
        try {
          v.pause();
        } catch {
          // ignore
        }

        markPerformance("ep:first-frame", videoId);
        markPerformance("ep:resume:ready", videoId);

        this.updateState({
          resumeState: "ready",
          resolvedResumeTime: curr,
          hasFirstFrame: true,
        });

        this._firstFrameListeners.forEach((fn) => {
          try {
            fn(performance.now());
          } catch {
            // ignore
          }
        });

        this.revealVideo();
        cleanup();
      }
    };

    const cleanup = () => {
      v.removeEventListener("seeked", onSeekedOrFrameReady);
      v.removeEventListener("canplay", onSeekedOrFrameReady);
      v.removeEventListener("timeupdate", onSeekedOrFrameReady);
      this._resumeCleanup = null;
    };

    v.addEventListener("seeked", onSeekedOrFrameReady);
    v.addEventListener("canplay", onSeekedOrFrameReady);
    v.addEventListener("timeupdate", onSeekedOrFrameReady);

    this._resumeCleanup = cleanup;
  }

  /**
   * Authoritative startup visual setup and image presentation.
   */
  private setupStartupVisual(options: EngineSourceOptions, gen: number): void {
    this._visualAbortController?.abort();
    const ac = new AbortController();
    this._visualAbortController = ac;

    const visual = resolveStartupVisualFromConfig({
      config: options.config,
      backgroundAutoplay: options.backgroundAutoplay,
      thumbnailEnabled: options.thumbnailEnabled,
      posterUrl: options.posterUrl,
      backgroundPreviewUrl: options.backgroundPreviewUrl,
      apiBase: options.apiBase,
    });

    if (visual.type === "none" || !visual.url) {
      this._startupVisualState = "released";
      this.updateState({ startupVisualState: "released" });
      if (this._startupVisualElement) {
        applyStartupVisualSurface(this._startupVisualElement, visual);
      }
      return;
    }

    // Check if visual is already released or video is already revealed
    if (this._startupVisualState === "released" || this._hasRevealedVideo) {
      return;
    }

    // Performance start marks
    if (visual.type === "preview") {
      markPerformance("ep:visual:preview:start", options.videoId);
    } else if (visual.type === "custom") {
      markPerformance("ep:visual:custom-thumbnail:start", options.videoId);
    } else if (visual.type === "provider") {
      markPerformance("ep:visual:thumbnail:start", options.videoId);
    }

    if (this._startupVisualElement) {
      applyStartupVisualSurface(this._startupVisualElement, visual);
    }

    const nextVisualState = this._userForegroundRequested
      ? "pending_release"
      : "visible";
    this._startupVisualState = nextVisualState;
    this.updateState({ startupVisualState: nextVisualState });

    const img = new Image();
    img.alt = "";
    (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = "high";

    const onImageLoaded = () => {
      if (ac.signal.aborted || gen !== this._generation || this._isDestroyed) return;
      if (
        this._startupVisualState === "released" ||
        this._startupVisualState === "pending_release"
      ) {
        return;
      }
      if (options.backgroundAutoplay && this._state.hasFirstFrame) {
        return;
      }
      if (this._userForegroundRequested && this._state.hasFirstFrame) {
        return;
      }

      if (visual.type === "preview") {
        markPerformance("ep:visual:preview:ready", options.videoId);
      } else if (visual.type === "custom") {
        markPerformance("ep:visual:custom-thumbnail:ready", options.videoId);
      } else if (visual.type === "provider") {
        markPerformance("ep:visual:thumbnail:ready", options.videoId);
      }
    };

    img.onload = () => {
      onImageLoaded();
    };

    img.onerror = () => {
      if (ac.signal.aborted || gen !== this._generation || this._isDestroyed) return;
      if ((this._startupVisualState as string) === "released") return;

      if (visual.type === "custom") {
        markPerformance("ep:visual:custom-thumbnail:failed", options.videoId);
        if (visual.fallbackUrl) {
          markPerformance("ep:visual:fallback-provider:applied", options.videoId);
          if (
            this._startupVisualElement &&
            gen === this._generation &&
            (this._startupVisualState as string) !== "released"
          ) {
            applyStartupVisualSurface(this._startupVisualElement, {
              type: "provider",
              url: visual.fallbackUrl,
              fallbackUrl: null,
            });
          }
          img.src = visual.fallbackUrl;
          return;
        }
      }

      if (
        this._startupVisualElement &&
        gen === this._generation &&
        (this._startupVisualState as string) !== "released"
      ) {
        applyStartupVisualSurface(this._startupVisualElement, {
          type: "none",
          url: null,
          fallbackUrl: null,
        });
      }
    };

    img.src = visual.url;
  }

  private setupFirstFrameDetection(videoId: string, gen: number): void {
    if (this._cancelFirstFrameCallback) {
      this._cancelFirstFrameCallback();
      this._cancelFirstFrameCallback = null;
    }

    this._video.style.opacity = "0";

    this._cancelFirstFrameCallback = onFirstVideoFrame(this._video, (frameTime) => {
      if (gen !== this._generation || this._isDestroyed) return;

      markPerformance("ep:first-frame", videoId);
      markPerformance("ep:main:first-frame", videoId);
      markPerformance("ep:visual:main-reveal", videoId);

      this.updateState({ hasFirstFrame: true });

      this._firstFrameListeners.forEach((fn) => {
        try {
          fn(frameTime);
        } catch {
          // ignore
        }
      });

      this.revealVideo();

      const isBg = Boolean(this._sourceOptions?.backgroundAutoplay);
      const thumbConfig = this._sourceOptions?.config?.appearance?.thumbnail;
      const thumbEnabled =
        this._sourceOptions?.thumbnailEnabled ?? thumbConfig?.enabled ?? true;

      if (isBg || !thumbEnabled || this._userForegroundRequested) {
        this.releaseStartupVisual(videoId);
      }
    });
  }

  private revealVideo(): void {
    if (this._hasRevealedVideo) return;
    this._hasRevealedVideo = true;
    this._video.style.transition = "opacity 70ms ease-out";
    this._video.style.opacity = "1";
  }

  /**
   * Authoritative release of startup visual. Idempotent and terminal for current generation.
   */
  public releaseStartupVisual(videoId?: string): void {
    if (this._startupVisualState === "released") return;
    this._startupVisualState = "released";
    this.updateState({ startupVisualState: "released" });

    this._visualAbortController?.abort();

    markPerformanceOnce("ep:startup-visual:release", videoId || this._state.videoId);

    if (this._startupVisualElement) {
      releaseStartupVisualSurface(this._startupVisualElement);
    }
  }

  private async attachMedia(
    mediaSrc: string,
    isBg: boolean,
    gen: number,
    resumePos: number | null
  ): Promise<void> {
    if (this._hls) {
      this._hls.destroy();
      this._hls = null;
    }

    markPerformance("ep:media:attach", this._state.videoId);
    const isHls = mediaSrc.includes(".m3u8") || mediaSrc.includes("m3u8");

    // 1. Native HLS for Safari / iOS
    if (isHls && shouldUseNativeHls(this._video)) {
      markPerformance("ep:manifest:start", this._state.videoId);
      this._video.src = mediaSrc;

      if (resumePos) {
        const onLoadedMeta = () => {
          if (gen !== this._generation || this._isDestroyed) return;
          try {
            this._video.currentTime = resumePos;
          } catch {
            // ignore
          }
        };
        this._video.addEventListener("loadedmetadata", onLoadedMeta, {
          once: true,
        });
      } else if (isBg) {
        this._video.play().catch(() => {});
      }
      return;
    }

    // 2. Dynamic HLS for MSE browsers
    if (isHls) {
      try {
        const HlsClass = await loadHlsEngine();
        if (gen !== this._generation || this._isDestroyed) return;

        if (HlsClass && HlsClass.isSupported()) {
          markPerformance("ep:manifest:start", this._state.videoId);

          const hlsOptions = createStartupHlsConfig(mediaSrc);
          if (resumePos) {
            hlsOptions.startPosition = resumePos;
          }

          const hls = new HlsClass(hlsOptions);
          this._hls = hls as unknown as Hls;

          hls.loadSource(mediaSrc);
          hls.attachMedia(this._video);

          hls.on(HlsClass.Events.MANIFEST_PARSED, (_event, data) => {
            if (gen !== this._generation || this._isDestroyed) return;

            markPerformance("ep:manifest:parsed", this._state.videoId);

            // Dynamic Level Capping during background autoplay (<= 480p)
            if (this._state.experience === "background_autoplay") {
              const capIndex = findMaxLevelForHeight(data.levels, 480);
              if (capIndex !== -1) {
                hls.autoLevelCapping = capIndex;
              }
            }

            const initialLevel = hls.currentLevel >= 0 ? hls.currentLevel : 0;
            const lvl = data.levels?.[initialLevel];
            this.emitTelemetry({
              type: "QUALITY_SAMPLE",
              sample: {
                source: "hlsjs",
                level: initialLevel,
                width: lvl?.width ?? null,
                height: lvl?.height ?? null,
                bitrate: lvl?.bitrate ?? null,
                bandwidthEstimateBps:
                  hls.bandwidthEstimate && hls.bandwidthEstimate > 0
                    ? hls.bandwidthEstimate
                    : null,
              },
            });

            if (resumePos) {
              try {
                this._video.pause();
                if (Math.abs(this._video.currentTime - resumePos) > 1.5) {
                  this._video.currentTime = resumePos;
                }
              } catch {
                // ignore
              }
            } else if (isBg) {
              this._video.play().catch(() => {});
            }
          });

          hls.on(HlsClass.Events.LEVEL_SWITCHED, (_event, data) => {
            if (gen !== this._generation || this._isDestroyed) return;
            const levelIndex = data.level;
            const lvl = hls.levels?.[levelIndex];
            this.emitTelemetry({
              type: "QUALITY_SAMPLE",
              sample: {
                source: "hlsjs",
                level: levelIndex,
                width: lvl?.width ?? null,
                height: lvl?.height ?? null,
                bitrate: lvl?.bitrate ?? null,
                bandwidthEstimateBps:
                  hls.bandwidthEstimate && hls.bandwidthEstimate > 0
                    ? hls.bandwidthEstimate
                    : null,
              },
            });
          });

          hls.on(HlsClass.Events.FRAG_LOADING, () => {
            markPerformanceOnce("ep:first-frag:start", this._state.videoId);
          });

          hls.on(HlsClass.Events.FRAG_LOADED, () => {
            markPerformanceOnce("ep:first-frag:loaded", this._state.videoId);
            if (hls.bandwidthEstimate && hls.bandwidthEstimate > 0) {
              saveBandwidthEstimate(mediaSrc, hls.bandwidthEstimate);
              this.emitTelemetry({
                type: "BANDWIDTH_ESTIMATE",
                bandwidthEstimateBps: hls.bandwidthEstimate,
              });
            }
          });

          hls.on(HlsClass.Events.FRAG_BUFFERED, () => {
            markPerformanceOnce("ep:first-frag:buffered", this._state.videoId);
          });

          hls.on(
            HlsClass.Events.ERROR,
            (_event: unknown, errorData: { fatal?: boolean; type?: string }) => {
              if (gen !== this._generation || this._isDestroyed) return;

              const errType =
                errorData.type === HlsClass.ErrorTypes.NETWORK_ERROR
                  ? "hls_network"
                  : errorData.type === HlsClass.ErrorTypes.MEDIA_ERROR
                  ? "hls_media"
                  : "hls_other";

              this.emitTelemetry({
                type: "ERROR",
                errorType: errType,
                message: "HLS Error",
              });

              if (errorData.fatal) {
                console.error("[PlayerEngine HLS Fatal Error]", errorData);
                switch (errorData.type) {
                  case HlsClass.ErrorTypes.NETWORK_ERROR:
                    hls.startLoad();
                    break;
                  case HlsClass.ErrorTypes.MEDIA_ERROR:
                    hls.recoverMediaError();
                    break;
                  default:
                    hls.destroy();
                    this.updateState({
                      hasError: true,
                      errorMessage: "Erro na transmissão do vídeo.",
                    });
                    break;
                }
              }
            }
          );

          return;
        }
      } catch (err) {
        console.warn(
          "[PlayerEngine] Dynamic HLS load error, falling back to native:",
          err
        );
      }
    }

    // 3. Fallback direct src
    if (gen === this._generation) {
      markPerformance("ep:manifest:start", this._state.videoId);
      this._video.src = mediaSrc;
      if (resumePos) {
        const onLoadedMeta = () => {
          if (gen !== this._generation || this._isDestroyed) return;
          try {
            this._video.currentTime = resumePos;
          } catch {
            // ignore
          }
        };
        this._video.addEventListener("loadedmetadata", onLoadedMeta, {
          once: true,
        });
      } else if (isBg) {
        this._video.play().catch(() => {});
      }
    }
  }

  /**
   * USER PLAYBACK WINS: Transitions seamlessly from Background Autoplay or Standby
   * to Foreground Playback with audio from 0.
   */
  public async startForeground(targetVolume: number = 1): Promise<void> {
    if (this._isDestroyed) return;

    this._userForegroundRequested = true;
    this.updateState({
      experience: "foreground",
      playbackInitiator: "user",
      userForegroundRequested: true,
      resumeState: "resolved",
    });

    if (this._hls) {
      this._hls.autoLevelCapping = -1;
    }

    const v = this._video;
    v.volume = targetVolume;
    v.muted = targetVolume === 0;

    // Return to start
    if (v.currentTime !== 0) {
      try {
        v.currentTime = 0;
      } catch {
        // ignore
      }
    }

    if (this._state.hasFirstFrame) {
      this.revealVideo();
      this.releaseStartupVisual(this._state.videoId);
    } else {
      if (this._startupVisualState !== "released") {
        this._startupVisualState = "pending_release";
        this.updateState({ startupVisualState: "pending_release" });
      }
    }

    try {
      await v.play();
    } catch (err) {
      console.warn("[PlayerEngine] startForeground play() rejected:", err);
    }
  }

  /**
   * Persistent Resume Action: Continuar assistindo.
   * Retains the prepared currentTime, resolves the resume gate, and starts foreground playback.
   */
  public async continueResume(targetVolume?: number): Promise<void> {
    if (this._isDestroyed) return;

    this._userForegroundRequested = true;
    this.updateState({
      resumeState: "resolved",
      resumeDecision: "continue",
      experience: "foreground",
      playbackInitiator: "user",
      userForegroundRequested: true,
    });

    if (this._hls) {
      this._hls.autoLevelCapping = -1;
    }

    const v = this._video;
    const vol =
      targetVolume !== undefined
        ? targetVolume
        : (this._sourceOptions?.defaultVolume ?? 1);
    v.volume = vol;
    v.muted = vol === 0;

    this.revealVideo();
    this.releaseStartupVisual(this._state.videoId);

    try {
      await v.play();
    } catch (err) {
      console.warn("[PlayerEngine] continueResume play() rejected:", err);
    }
  }

  /**
   * Persistent Resume Action: Assistir do início.
   * Purges old resume storage, resets currentTime to 0, resolves gate, and starts foreground playback.
   */
  public async restartFromBeginning(targetVolume?: number): Promise<void> {
    if (this._isDestroyed) return;

    this._userForegroundRequested = true;
    this.updateState({
      resumeState: "resolved",
      resumeDecision: "restart",
      experience: "foreground",
      playbackInitiator: "user",
      userForegroundRequested: true,
    });

    if (this._hls) {
      this._hls.autoLevelCapping = -1;
    }

    clearSavedResume(this._state.videoId);

    const v = this._video;
    const vol =
      targetVolume !== undefined
        ? targetVolume
        : (this._sourceOptions?.defaultVolume ?? 1);
    v.volume = vol;
    v.muted = vol === 0;

    try {
      v.currentTime = 0;
    } catch {
      // ignore
    }

    this.revealVideo();
    this.releaseStartupVisual(this._state.videoId);

    try {
      await v.play();
    } catch (err) {
      console.warn("[PlayerEngine] restartFromBeginning play() rejected:", err);
    }
  }

  public async play(initiator: PlaybackInitiator = "user"): Promise<void> {
    if (this._isDestroyed) return;

    if (initiator === "user") {
      this._userForegroundRequested = true;
      this.updateState({
        experience: "foreground",
        playbackInitiator: "user",
        userForegroundRequested: true,
        resumeState: "resolved",
      });
    }

    if (this._state.hasFirstFrame) {
      this.revealVideo();
      if (
        this._userForegroundRequested ||
        this._state.experience === "background_autoplay"
      ) {
        this.releaseStartupVisual(this._state.videoId);
      }
    } else if (initiator === "user") {
      if (this._startupVisualState !== "released") {
        this._startupVisualState = "pending_release";
        this.updateState({ startupVisualState: "pending_release" });
      }
    }

    try {
      await this._video.play();
    } catch (err) {
      console.warn("[PlayerEngine] play() rejected:", err);
    }
  }

  public pause(): void {
    if (this._isDestroyed) return;
    this._video.pause();
  }

  public seek(time: number): void {
    if (this._isDestroyed) return;
    try {
      this._video.currentTime = Math.max(
        0,
        Math.min(this._video.duration || Infinity, time)
      );
    } catch {
      // ignore
    }
  }

  public setVolume(volume: number): void {
    if (this._isDestroyed) return;
    const clamped = Math.max(0, Math.min(1, volume));
    this._video.volume = clamped;
    this._video.muted = clamped === 0;
  }

  public setMuted(muted: boolean): void {
    if (this._isDestroyed) return;
    this._video.muted = muted;
  }

  public setPlaybackRate(rate: number): void {
    if (this._isDestroyed) return;
    this._video.playbackRate = rate;
  }

  public updateConfig(config: PlayerConfig): void {
    if (this._isDestroyed) return;
    const prevBg = Boolean(this._sourceOptions?.config?.playback?.backgroundAutoplay);
    const nextBg = Boolean(config.playback?.backgroundAutoplay);
    const prevResume =
      this._sourceOptions?.config?.playback?.persistentResume ?? true;
    const nextResume = config.playback?.persistentResume ?? true;

    if (this._sourceOptions) {
      this._sourceOptions = {
        ...this._sourceOptions,
        config,
        backgroundAutoplay: nextBg,
        thumbnailEnabled: config.appearance?.thumbnail?.enabled ?? true,
      };
    }

    if (
      prevResume &&
      !nextResume &&
      (this._state.resumeState === "preparing" ||
        this._state.resumeState === "ready")
    ) {
      this.updateState({ resumeState: "none" });
    }

    // Live background autoplay toggle in editor
    if (prevBg !== nextBg && !this._userForegroundRequested) {
      if (nextBg) {
        this.updateState({
          experience: "background_autoplay",
          playbackInitiator: "autoplay",
        });
        this._video.muted = true;
        if (this._hls && this._hls.levels) {
          const cap = findMaxLevelForHeight(this._hls.levels, 480);
          if (cap !== -1) {
            this._hls.autoLevelCapping = cap;
          }
        }
        this._video.play().catch(() => {});
      } else {
        this.updateState({
          experience: "foreground",
          playbackInitiator: "system",
        });
        this._video.pause();
        if (this._hls) {
          this._hls.autoLevelCapping = -1;
        }
      }
    }
  }

  public destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    this._generation++;

    this._visualAbortController?.abort();
    this._visualAbortController = null;

    if (this._resumeCleanup) {
      this._resumeCleanup();
      this._resumeCleanup = null;
    }

    if (this._cancelFirstFrameCallback) {
      this._cancelFirstFrameCallback();
      this._cancelFirstFrameCallback = null;
    }

    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this._onVisibilityChange);
    }

    if (this._hls) {
      this._hls.destroy();
      this._hls = null;
    }

    try {
      this._video.pause();
      this._video.removeAttribute("src");
      this._video.load();
    } catch {
      // ignore
    }

    if (this._startupVisualElement) {
      releaseStartupVisualSurface(this._startupVisualElement);
    }

    this._firstFrameListeners.clear();
    this._stateListeners.clear();
    this._telemetryListeners.clear();
  }
}
