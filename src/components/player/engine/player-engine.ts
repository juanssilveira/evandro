/**
 * Evandro Player Headless Early Media Engine
 * Standalone, high-performance video engine with zero React dependencies.
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
import type {
  EngineFirstFrameListener,
  EngineSourceOptions,
  EngineStateListener,
  IPlayerEngine,
  PlayerEngineOptions,
  PlayerEngineState,
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
  private readonly _startupVisualElement: HTMLElement | null;
  private readonly _debug: boolean;

  private _hls: Hls | null = null;
  private _generation = 0;
  private _isDestroyed = false;

  private _state: PlayerEngineState = {
    videoId: "",
    playbackUrl: null,
    experience: "idle",
    isPlaying: false,
    isMuted: false,
    volume: 1,
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    hasFirstFrame: false,
    hasError: false,
    errorMessage: null,
  };

  private _firstFrameListeners = new Set<EngineFirstFrameListener>();
  private _stateListeners = new Set<EngineStateListener>();
  private _cancelFirstFrameCallback: (() => void) | null = null;
  private _visualAbortController: AbortController | null = null;

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

  public subscribe(listener: EngineStateListener): () => void {
    this._stateListeners.add(listener);
    listener(this._state);
    return () => {
      this._stateListeners.delete(listener);
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
    v.addEventListener("pause", () => this.updateState({ isPlaying: false }));
    v.addEventListener("playing", () => this.updateState({ isPlaying: true }));
    v.addEventListener("ended", () => this.updateState({ isPlaying: false }));

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
      this.handleBackgroundAutoplayWindow();
    });

    v.addEventListener("error", () => {
      if (this._video.error) {
        this.updateState({
          hasError: true,
          errorMessage: this._video.error.message || "Erro na mídia do vídeo.",
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
    const maxWindow = v.duration && v.duration < this.BACKGROUND_WINDOW_SECONDS
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
    const videoId = options.videoId;
    const playbackUrl = options.playbackUrl;
    const isBg = Boolean(options.backgroundAutoplay);

    this.updateState({
      videoId,
      playbackUrl,
      experience: isBg ? "background_autoplay" : "foreground",
      hasFirstFrame: false,
      hasError: false,
      errorMessage: null,
    });

    // 1. Setup Startup Visual immediately
    this.setupStartupVisual(options, currentGen);

    // 2. Setup First Frame listener
    this.setupFirstFrameDetection(videoId, currentGen);

    // 3. Configure Video Element base attributes
    this._video.playsInline = true;
    this._video.preload = "auto";
    // Never use <video poster>
    this._video.removeAttribute("poster");

    if (isBg) {
      this._video.muted = true;
      this._video.autoplay = true;
    } else {
      const vol = options.defaultVolume ?? 1;
      this._video.volume = vol;
      this._video.muted = vol === 0;
      this._video.playbackRate = options.defaultPlaybackRate ?? 1;
    }

    // 4. Attach Media Source
    await this.attachMedia(playbackUrl, isBg, currentGen);
  }

  private setupStartupVisual(options: EngineSourceOptions, gen: number): void {
    if (!this._startupVisualElement) return;

    this._visualAbortController?.abort();
    const ac = new AbortController();
    this._visualAbortController = ac;

    const container = this._startupVisualElement;
    container.innerHTML = "";
    container.style.display = "flex";
    container.style.opacity = "1";

    const isBg = Boolean(options.backgroundAutoplay);
    const thumbEnabled = options.thumbnailEnabled ?? options.config?.appearance?.thumbnail?.enabled ?? true;

    let targetUrl: string | null = null;
    let visualType: "preview" | "thumbnail" | "none" = "none";

    if (isBg) {
      if (options.backgroundPreviewUrl) {
        targetUrl = options.backgroundPreviewUrl;
        visualType = "preview";
        markPerformance("ep:visual:preview:start", options.videoId);
      }
    } else if (thumbEnabled) {
      if (options.posterUrl) {
        targetUrl = options.posterUrl;
        visualType = "thumbnail";
        markPerformance("ep:visual:thumbnail:start", options.videoId);
      }
    }

    if (!targetUrl || visualType === "none") {
      return;
    }

    const img = document.createElement("img");
    img.alt = "";
    img.style.cssText = "width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none;";
    (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = "high";

    img.onload = () => {
      if (ac.signal.aborted || gen !== this._generation) return;
      // Arbitration: if main frame already won, NEVER show visual asset
      if (this._state.hasFirstFrame) return;

      if (visualType === "preview") {
        markPerformance("ep:visual:preview:ready", options.videoId);
      } else if (visualType === "thumbnail") {
        markPerformance("ep:visual:thumbnail:ready", options.videoId);
      }

      container.appendChild(img);
    };

    img.onerror = () => {
      if (ac.signal.aborted || gen !== this._generation) return;
      // Do not use forbidden fallbacks
      img.remove();
    };

    img.src = targetUrl;
  }

  private setupFirstFrameDetection(videoId: string, gen: number): void {
    if (this._cancelFirstFrameCallback) {
      this._cancelFirstFrameCallback();
      this._cancelFirstFrameCallback = null;
    }

    this._cancelFirstFrameCallback = onFirstVideoFrame(this._video, (frameTime) => {
      if (gen !== this._generation || this._isDestroyed) return;

      markPerformance("ep:first-frame", videoId);
      markPerformance("ep:main:first-frame", videoId);

      this.updateState({ hasFirstFrame: true });

      // Notify all first frame subscribers
      this._firstFrameListeners.forEach((fn) => {
        try {
          fn(frameTime);
        } catch {
          // ignore
        }
      });

      // Smooth takeover: crossfade and release startup visual
      this.releaseStartupVisual(videoId);
    });
  }

  private releaseStartupVisual(videoId: string): void {
    if (!this._startupVisualElement) return;

    markPerformanceOnce("ep:startup-visual:release", videoId);

    const el = this._startupVisualElement;
    el.style.transition = "opacity 150ms ease-out";
    el.style.opacity = "0";

    setTimeout(() => {
      if (this._state.hasFirstFrame && el) {
        el.innerHTML = "";
        el.style.display = "none";
      }
    }, 160);
  }

  private async attachMedia(mediaSrc: string, isBg: boolean, gen: number): Promise<void> {
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

      if (isBg) {
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

            if (isBg) {
              this._video.play().catch(() => {});
            }
          });

          hls.on(HlsClass.Events.FRAG_LOADING, () => {
            markPerformanceOnce("ep:first-frag:start", this._state.videoId);
          });

          hls.on(HlsClass.Events.FRAG_LOADED, () => {
            markPerformanceOnce("ep:first-frag:loaded", this._state.videoId);
            if (hls.bandwidthEstimate && hls.bandwidthEstimate > 0) {
              saveBandwidthEstimate(mediaSrc, hls.bandwidthEstimate);
            }
          });

          hls.on(HlsClass.Events.FRAG_BUFFERED, () => {
            markPerformanceOnce("ep:first-frag:buffered", this._state.videoId);
          });

          hls.on(HlsClass.Events.ERROR, (_event: unknown, errorData: { fatal?: boolean; type?: string }) => {
            if (gen !== this._generation || this._isDestroyed) return;

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
          });

          return;
        }
      } catch (err) {
        console.warn("[PlayerEngine] Dynamic HLS load error, falling back to native:", err);
      }
    }

    // 3. Fallback direct src
    if (gen === this._generation) {
      markPerformance("ep:manifest:start", this._state.videoId);
      this._video.src = mediaSrc;
      if (isBg) {
        this._video.play().catch(() => {});
      }
    }
  }

  /**
   * Transitions seamlessly from Background Autoplay to Foreground Playback with audio.
   */
  public async startForeground(targetVolume: number = 1): Promise<void> {
    if (this._isDestroyed) return;

    this.updateState({ experience: "foreground" });

    // Release quality cap on Hls.js
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

    try {
      await v.play();
    } catch {
      // ignore
    }
  }

  public async play(): Promise<void> {
    if (this._isDestroyed) return;
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
      this._video.currentTime = Math.max(0, Math.min(this._video.duration || Infinity, time));
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

  public destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    this._generation++;

    this._visualAbortController?.abort();
    this._visualAbortController = null;

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

    this._firstFrameListeners.clear();
    this._stateListeners.clear();
  }
}
