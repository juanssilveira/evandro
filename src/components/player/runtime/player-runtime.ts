import {
  PlayerEventType,
  type PlayerRuntimeEvent,
  type PlayerEventListener,
  type PlayerSnapshot,
  type Unsubscribe,
  type PlayerRuntimeOptions,
  type SeekStartEvent,
  type SeekEndEvent,
  type RateChangeEvent,
  type VolumeChangeEvent,
  type FullscreenEnterEvent,
  type FullscreenExitEvent,
  type FullscreenInitiator,
  type ErrorEvent,
  type PlaybackMode,
  type PlaybackInitiator,
  type PlaybackContextChangeEvent,
} from "./types";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;
type EmitPayload = DistributiveOmit<
  PlayerRuntimeEvent,
  "eventId" | "videoId" | "timestamp" | "snapshot"
> & {
  snapshot?: PlayerSnapshot;
};

export class PlayerRuntime {
  public readonly videoId: string;
  private readonly video: HTMLVideoElement;
  private readonly containerElement: HTMLElement | null = null;
  private readonly debug: boolean;

  private playbackMode: PlaybackMode = "foreground";
  private playbackInitiator: PlaybackInitiator = "user";
  private isReady = false;
  private isBuffering = false;
  private isSeeking = false;
  private isFullscreen = false;
  private pendingFullscreenInitiator: FullscreenInitiator | null = null;
  private seekStartTime = 0;
  private previousTime = 0;
  private previousRate = 1;
  private previousVolume = 1;
  private previousMuted = false;
  private isDestroyed = false;

  private listeners: Set<PlayerEventListener> = new Set();
  private abortController: AbortController = new AbortController();

  constructor(video: HTMLVideoElement, options: PlayerRuntimeOptions) {
    this.video = video;
    this.videoId = options.videoId;
    this.containerElement = options.containerElement ?? null;
    this.debug = Boolean(options.debug);
    this.playbackMode = options.initialPlaybackMode ?? "foreground";
    this.playbackInitiator = options.initialPlaybackInitiator ?? "user";

    this.previousTime = video.currentTime || 0;
    this.previousRate = video.playbackRate || 1;
    this.previousVolume = typeof video.volume === "number" ? video.volume : 1;
    this.previousMuted = Boolean(video.muted);

    if (this.debug) {
      console.log(`[Evandro Player Runtime] INITIALIZE videoId=${this.videoId}`);
    }

    this.attachEventListeners();

    // Check if video is already ready upon initialization
    if (video.readyState >= 1 && !isNaN(video.duration) && video.duration > 0) {
      this.checkAndEmitReady();
    }
  }

  public getPlaybackMode(): PlaybackMode {
    return this.playbackMode;
  }

  public getPlaybackInitiator(): PlaybackInitiator {
    return this.playbackInitiator;
  }

  public setPlaybackContext(mode: PlaybackMode, initiator: PlaybackInitiator): void {
    if (this.playbackMode === mode && this.playbackInitiator === initiator) {
      return;
    }

    const previousMode = this.playbackMode;
    const previousInitiator = this.playbackInitiator;
    this.playbackMode = mode;
    this.playbackInitiator = initiator;

    this.emit({
      type: PlayerEventType.PLAYBACK_CONTEXT_CHANGE,
      previousMode,
      mode,
      previousInitiator,
      initiator,
    });
  }

  public getSnapshot(): PlayerSnapshot {
    return {
      videoId: this.videoId,
      currentTime: this.video.currentTime || 0,
      duration: isNaN(this.video.duration) ? 0 : this.video.duration,
      playbackRate: this.video.playbackRate || 1,
      paused: Boolean(this.video.paused),
      muted: Boolean(this.video.muted),
      volume: typeof this.video.volume === "number" ? this.video.volume : 1,
      ended: Boolean(this.video.ended),
      timestamp: Date.now(),
      playbackMode: this.playbackMode,
      playbackInitiator: this.playbackInitiator,
    };
  }

  public setPendingFullscreenInitiator(initiator: FullscreenInitiator): void {
    this.pendingFullscreenInitiator = initiator;
  }

  public clearPendingFullscreenInitiator(): void {
    this.pendingFullscreenInitiator = null;
  }

  public subscribe(listener: PlayerEventListener): Unsubscribe {
    if (this.isDestroyed) {
      return () => {};
    }

    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  public destroy(): void {
    if (this.isDestroyed) return;

    if (this.debug) {
      console.log(`[Evandro Player Runtime] DESTROY videoId=${this.videoId}`);
    }

    this.isDestroyed = true;
    this.abortController.abort();
    this.listeners.clear();
  }

  private emit(eventData: EmitPayload): void {
    if (this.isDestroyed) return;

    const timestamp = Date.now();
    const snapshot = eventData.snapshot || this.getSnapshot();

    const event: PlayerRuntimeEvent = {
      eventId: crypto.randomUUID(),
      videoId: this.videoId,
      timestamp,
      snapshot,
      ...eventData,
    } as PlayerRuntimeEvent;

    if (this.debug) {
      this.logDebug(event);
    }

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[Evandro Player Runtime] Error in listener:", err);
      }
    }
  }

  private checkAndEmitReady(): void {
    if (!this.isReady) {
      this.isReady = true;
      this.emit({ type: PlayerEventType.PLAYER_READY });
    }
  }

  private attachEventListeners(): void {
    const { signal } = this.abortController;

    const add = (
      name: string,
      handler: (event: Event) => void
    ) => {
      this.video.addEventListener(name, handler, { signal });
    };

    add("loadedmetadata", () => {
      this.checkAndEmitReady();
    });

    add("canplay", () => {
      if (this.isBuffering) {
        this.isBuffering = false;
        this.emit({ type: PlayerEventType.BUFFER_END });
      }
      this.checkAndEmitReady();
    });

    add("play", () => {
      this.emit({ type: PlayerEventType.PLAY });
    });

    add("playing", () => {
      if (this.isBuffering) {
        this.isBuffering = false;
        this.emit({ type: PlayerEventType.BUFFER_END });
      }
      this.emit({ type: PlayerEventType.PLAYING });
    });

    add("pause", () => {
      if (!this.video.ended && !this.isSeeking) {
        this.emit({ type: PlayerEventType.PAUSE });
      }
    });

    add("timeupdate", () => {
      if (!this.isSeeking) {
        this.previousTime = this.video.currentTime;
      }
      this.emit({ type: PlayerEventType.TIME_UPDATE });
    });

    add("seeking", () => {
      if (!this.isSeeking) {
        this.isSeeking = true;
        this.seekStartTime = this.previousTime;
        this.emit({
          type: PlayerEventType.SEEK_START,
          from: this.seekStartTime,
        });
      }
    });

    add("seeked", () => {
      if (this.isSeeking) {
        this.isSeeking = false;
        const to = this.video.currentTime;
        this.emit({
          type: PlayerEventType.SEEK_END,
          from: this.seekStartTime,
          to,
        });
        this.previousTime = to;
      }
    });

    add("ratechange", () => {
      const newRate = this.video.playbackRate;
      if (newRate !== this.previousRate) {
        const previousRate = this.previousRate;
        this.previousRate = newRate;
        this.emit({
          type: PlayerEventType.RATE_CHANGE,
          previousRate,
          newRate,
        });
      }
    });

    add("volumechange", () => {
      const currentVolume = this.video.volume;
      const currentMuted = this.video.muted;

      if (
        currentVolume === this.previousVolume &&
        currentMuted === this.previousMuted
      ) {
        return;
      }

      const previousVolume = this.previousVolume;
      const previousMuted = this.previousMuted;
      const previousEffectiveVolume = previousMuted ? 0 : previousVolume;
      const effectiveVolume = currentMuted ? 0 : currentVolume;

      this.previousVolume = currentVolume;
      this.previousMuted = currentMuted;

      this.emit({
        type: PlayerEventType.VOLUME_CHANGE,
        previousVolume,
        volume: currentVolume,
        previousMuted,
        muted: currentMuted,
        previousEffectiveVolume,
        effectiveVolume,
      });
    });

    add("waiting", () => {
      if (!this.isBuffering && !this.video.paused && !this.video.ended) {
        this.isBuffering = true;
        this.emit({ type: PlayerEventType.BUFFER_START });
      }
    });

    add("ended", () => {
      if (this.isBuffering) {
        this.isBuffering = false;
        this.emit({ type: PlayerEventType.BUFFER_END });
      }
      this.emit({ type: PlayerEventType.ENDED });
    });

    add("error", () => {
      const mediaError = this.video.error;
      const message = mediaError
        ? `Media error code ${mediaError.code}`
        : "Erro desconhecido na reprodução do vídeo";

      this.emit({
        type: PlayerEventType.ERROR,
        message,
        code: mediaError?.code,
      });
    });

    const checkFullscreenState = (): boolean => {
      if (typeof document === "undefined") return false;
      const fs = document.fullscreenElement;
      if (!fs) return false;
      if (this.containerElement) {
        return fs === this.containerElement || this.containerElement.contains(fs);
      }
      return fs === this.video || fs.contains(this.video);
    };

    this.isFullscreen = checkFullscreenState();

    const handleFullscreenChange = () => {
      const isNowFullscreen = checkFullscreenState();
      if (isNowFullscreen !== this.isFullscreen) {
        this.isFullscreen = isNowFullscreen;
        const initiator: FullscreenInitiator =
          this.pendingFullscreenInitiator ?? "system";
        this.pendingFullscreenInitiator = null;

        if (isNowFullscreen) {
          this.emit({
            type: PlayerEventType.FULLSCREEN_ENTER,
            fullscreenInitiator: initiator,
          });
        } else {
          this.emit({
            type: PlayerEventType.FULLSCREEN_EXIT,
            fullscreenInitiator: initiator,
          });
        }
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("fullscreenchange", handleFullscreenChange, { signal });
    }
  }

  private logDebug(event: PlayerRuntimeEvent): void {
    const prefix = "[Evandro Player Runtime]";
    switch (event.type) {
      case PlayerEventType.PLAYER_READY:
        console.log(`${prefix} PLAYER_READY`);
        break;
      case PlayerEventType.PLAY:
        console.log(
          `${prefix} PLAY mode=${event.snapshot.playbackMode} initiator=${event.snapshot.playbackInitiator}`
        );
        break;
      case PlayerEventType.PLAYING:
        console.log(
          `${prefix} PLAYING mode=${event.snapshot.playbackMode} initiator=${event.snapshot.playbackInitiator}`
        );
        break;
      case PlayerEventType.PAUSE:
        console.log(`${prefix} PAUSE ${event.snapshot.currentTime.toFixed(3)}`);
        break;
      case PlayerEventType.TIME_UPDATE:
        console.log(`${prefix} TIME_UPDATE ${event.snapshot.currentTime.toFixed(3)}`);
        break;
      case PlayerEventType.SEEK_START:
        console.log(
          `${prefix} SEEK_START ${(event as SeekStartEvent).from.toFixed(3)}`
        );
        break;
      case PlayerEventType.SEEK_END: {
        const seek = event as SeekEndEvent;
        console.log(
          `${prefix} SEEK_END ${seek.from.toFixed(3)} → ${seek.to.toFixed(3)}`
        );
        break;
      }
      case PlayerEventType.RATE_CHANGE: {
        const rate = event as RateChangeEvent;
        console.log(
          `${prefix} RATE_CHANGE ${rate.previousRate} → ${rate.newRate}`
        );
        break;
      }
      case PlayerEventType.VOLUME_CHANGE: {
        const vol = event as VolumeChangeEvent;
        let suffix = "";
        if (!vol.previousMuted && vol.muted) {
          suffix = " (muted)";
        } else if (vol.previousMuted && !vol.muted) {
          suffix = " (unmuted)";
        }
        const formatVol = (v: number) =>
          Number.isInteger(v)
            ? v.toString()
            : parseFloat(v.toFixed(2)).toString();

        const fromStr = formatVol(vol.previousEffectiveVolume);
        const toStr = formatVol(vol.effectiveVolume);

        console.log(`${prefix} VOLUME_CHANGE ${fromStr} → ${toStr}${suffix}`);
        break;
      }
      case PlayerEventType.FULLSCREEN_ENTER: {
        const fs = event as FullscreenEnterEvent;
        console.log(
          `${prefix} FULLSCREEN_ENTER initiator=${fs.fullscreenInitiator}`
        );
        break;
      }
      case PlayerEventType.FULLSCREEN_EXIT: {
        const fs = event as FullscreenExitEvent;
        console.log(
          `${prefix} FULLSCREEN_EXIT initiator=${fs.fullscreenInitiator}`
        );
        break;
      }
      case PlayerEventType.BUFFER_START:
        console.log(`${prefix} BUFFER_START`);
        break;
      case PlayerEventType.BUFFER_END:
        console.log(`${prefix} BUFFER_END`);
        break;
      case PlayerEventType.ENDED:
        console.log(`${prefix} ENDED`);
        break;
      case PlayerEventType.ERROR:
        console.log(`${prefix} ERROR ${(event as ErrorEvent).message}`);
        break;
      case PlayerEventType.PLAYBACK_CONTEXT_CHANGE: {
        const ctx = event as PlaybackContextChangeEvent;
        console.log(
          `${prefix} PLAYBACK_CONTEXT_CHANGE ${ctx.previousMode} → ${ctx.mode} (${ctx.previousInitiator} → ${ctx.initiator})`
        );
        break;
      }
    }
  }
}
