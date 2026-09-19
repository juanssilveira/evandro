import { PlayerEventType, type PlayerRuntimeEvent } from "../runtime/types";
import { TrackerAccumulator } from "./tracker-accumulator";
import { TrackerTransport } from "./tracker-transport";
import type { TrackerOptions } from "./types";

export class EvandroTracker {
  public readonly videoId: string;
  public readonly sessionId: string;
  private readonly debug: boolean;
  private readonly isEditor: boolean;

  private accumulator: TrackerAccumulator | null = null;
  private transport: TrackerTransport | null = null;

  private unsubRuntime: (() => void) | null = null;
  private unsubEngineState: (() => void) | null = null;
  private unsubEngineTelemetry: (() => void) | null = null;
  private unsubEngineFirstFrame: (() => void) | null = null;

  private isDestroyed: boolean = false;
  private hasLoggedForegroundStart: boolean = false;

  constructor(options: TrackerOptions) {
    this.videoId = options.videoId;
    this.sessionId = options.sessionId;
    this.debug = Boolean(options.debug);
    this.isEditor = Boolean(options.isEditor);

    if (this.isEditor) {
      if (this.debug) {
        console.log("[Evandro Tracker] Editor preview active — tracking skipped.");
      }
      return;
    }

    if (this.debug) {
      console.log(
        `[Evandro Tracker] INIT videoId=${this.videoId} sessionId=${this.sessionId}`
      );
    }

    const accumulator = new TrackerAccumulator(this.videoId, this.sessionId);
    this.accumulator = accumulator;

    // Provide initial engine context
    const engineState = options.engine.state;
    accumulator.setInitialEngineContext({
      experience: engineState.experience,
      resumeState: engineState.resumeState,
      resumePosition: engineState.requestedResumeTime,
      resumeDecision: engineState.resumeDecision,
    });

    const transport = new TrackerTransport({
      videoId: this.videoId,
      apiBase: options.apiBase,
      debug: this.debug,
    });
    this.transport = transport;

    transport.startTimers(accumulator);

    this.bindRuntimeEvents(options.runtime);
    this.bindEngineObservability(options.engine);
    this.bindBrowserEvents();
  }

  private bindRuntimeEvents(runtime: import("../runtime").PlayerRuntime): void {
    this.unsubRuntime = runtime.subscribe((event: PlayerRuntimeEvent) => {
      if (this.isDestroyed || !this.accumulator || !this.transport) return;

      const acc = this.accumulator;
      const tr = this.transport;

      switch (event.type) {
        case PlayerEventType.TIME_UPDATE:
          acc.onTimeUpdate(
            event.snapshot.currentTime,
            event.snapshot.duration,
            event.snapshot.playbackRate
          );
          break;

        case PlayerEventType.PLAY:
          acc.onPlay();
          break;

        case PlayerEventType.PLAYING: {
          if (
            event.snapshot.playbackMode === "foreground" &&
            (event.snapshot.playbackInitiator === "user" ||
              event.snapshot.playbackInitiator === "system")
          ) {
            acc.onForegroundUserIntent();
            if (!this.hasLoggedForegroundStart) {
              this.hasLoggedForegroundStart = true;
              if (this.debug) {
                console.log("[Evandro Tracker] FOREGROUND_START");
              }
            }
          }
          acc.onPlaying();
          break;
        }

        case PlayerEventType.PAUSE:
          acc.onPause();
          tr.flush(acc);
          break;

        case PlayerEventType.SEEK_START:
          acc.onSeekStart();
          break;

        case PlayerEventType.SEEK_END:
          acc.onSeekEnd(event.to);
          break;

        case PlayerEventType.RATE_CHANGE:
          acc.onRateChange(event.newRate);
          break;

        case PlayerEventType.FULLSCREEN_ENTER:
          acc.onFullscreenEnter();
          break;

        case PlayerEventType.BUFFER_START:
          acc.onBufferStart();
          break;

        case PlayerEventType.BUFFER_END:
          acc.onBufferEnd();
          break;

        case PlayerEventType.ENDED:
          acc.onEnded();
          if (this.debug) {
            console.log("[Evandro Tracker] END");
          }
          tr.flush(acc);
          break;

        case PlayerEventType.ERROR:
          acc.onError(event.message);
          tr.flush(acc);
          break;

        case PlayerEventType.PLAYBACK_CONTEXT_CHANGE: {
          if (
            event.mode === "foreground" &&
            (event.initiator === "user" || event.initiator === "system")
          ) {
            acc.onForegroundUserIntent();
            if (!this.hasLoggedForegroundStart) {
              this.hasLoggedForegroundStart = true;
              if (this.debug) {
                console.log("[Evandro Tracker] FOREGROUND_START");
              }
            }
          }
          break;
        }
      }
    });
  }

  private bindEngineObservability(engine: import("../engine/types").IPlayerEngine): void {
    this.unsubEngineState = engine.subscribe((state) => {
      if (this.isDestroyed || !this.accumulator) return;

      if (state.userForegroundRequested || state.hasStartedForeground) {
        this.accumulator.onForegroundUserIntent();
        if (!this.hasLoggedForegroundStart) {
          this.hasLoggedForegroundStart = true;
          if (this.debug) {
            console.log("[Evandro Tracker] FOREGROUND_START");
          }
        }
      }

      if (state.resumeDecision && state.resumeDecision !== "none") {
        this.accumulator.onResumeDecision(state.resumeDecision);
        if (this.debug) {
          console.log(`[Evandro Tracker] RESUME ${state.resumeDecision}`);
        }
      }
    });

    this.unsubEngineFirstFrame = engine.onFirstFrame(() => {
      if (this.isDestroyed || !this.accumulator) return;
      this.accumulator.onFirstFrameRendered();
    });

    this.unsubEngineTelemetry = engine.subscribeTelemetry((signal) => {
      if (this.isDestroyed || !this.accumulator || !this.transport) return;

      if (signal.type === "QUALITY_SAMPLE") {
        this.accumulator.onQualitySample(signal.sample);
      } else if (signal.type === "BANDWIDTH_ESTIMATE") {
        this.accumulator.onBandwidthEstimate(signal.bandwidthEstimateBps);
      } else if (signal.type === "ERROR") {
        this.accumulator.onError(signal.message, signal.errorType);
        this.transport.flush(this.accumulator);
      }
    });
  }

  private _onVisibilityChange = (): void => {
    if (this.isDestroyed || !this.accumulator || !this.transport) return;
    const hidden = document.hidden;
    this.accumulator.onVisibilityChange(hidden);
    if (hidden) {
      this.transport.flush(this.accumulator, true);
    }
  };

  private _onPageHide = (): void => {
    if (this.isDestroyed || !this.accumulator || !this.transport) return;
    this.transport.flush(this.accumulator, true);
  };

  private bindBrowserEvents(): void {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    document.addEventListener("visibilitychange", this._onVisibilityChange);
    window.addEventListener("pagehide", this._onPageHide);
    window.addEventListener("beforeunload", this._onPageHide);
  }

  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (typeof window !== "undefined" && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this._onVisibilityChange);
      window.removeEventListener("pagehide", this._onPageHide);
      window.removeEventListener("beforeunload", this._onPageHide);
    }

    this.unsubRuntime?.();
    this.unsubEngineState?.();
    this.unsubEngineTelemetry?.();
    this.unsubEngineFirstFrame?.();

    if (this.transport && this.accumulator) {
      this.transport.destroy(this.accumulator);
    }

    this.accumulator = null;
    this.transport = null;
  }
}
