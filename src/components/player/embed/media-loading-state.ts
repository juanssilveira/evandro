/**
 * Evandro Player Media Startup State Machine & Loading UX
 * Decouples low-level media events (LOAD_START, CAN_PLAY, MANIFEST_PARSED) from UI spinner visibility.
 * Implements delayed spinner triggers so fast startups (<200ms) never flicker a loading spinner.
 */

export type MediaStartupState =
  | "warming"
  | "ready"
  | "play_requested"
  | "playing"
  | "rebuffering"
  | "ended"
  | "error";

export const PLAY_REQUESTED_SPINNER_DELAY_MS = 200; // 180–250ms threshold
export const REBUFFERING_SPINNER_DELAY_MS = 250; // 200–300ms threshold

export interface MediaLoadingStateSnapshot {
  state: MediaStartupState;
  showSpinner: boolean;
  hasRenderedFirstFrame: boolean;
  hasStartedPlayback: boolean;
}

export type StateChangeCallback = (snapshot: MediaLoadingStateSnapshot) => void;

export class MediaLoadingStateManager {
  private state: MediaStartupState = "warming";
  private showSpinner = false;
  private hasRenderedFirstFrame = false;
  private hasStartedPlayback = false;
  private spinnerTimer: ReturnType<typeof setTimeout> | null = null;
  private onStateChange?: StateChangeCallback;

  constructor(onStateChange?: StateChangeCallback) {
    this.onStateChange = onStateChange;
  }

  public getSnapshot(): MediaLoadingStateSnapshot {
    return {
      state: this.state,
      showSpinner: this.showSpinner,
      hasRenderedFirstFrame: this.hasRenderedFirstFrame,
      hasStartedPlayback: this.hasStartedPlayback,
    };
  }

  private clearTimer(): void {
    if (this.spinnerTimer !== null) {
      clearTimeout(this.spinnerTimer);
      this.spinnerTimer = null;
    }
  }

  private emit(): void {
    this.onStateChange?.(this.getSnapshot());
  }

  /**
   * Called when media attach / warming begins (manifest / initial playlist fetch).
   * Spinner must remain FALSE during warming.
   */
  public onMediaAttach(): void {
    this.clearTimer();
    this.state = "warming";
    this.showSpinner = false;
    this.emit();
  }

  /**
   * Called when manifest is parsed and player is ready for immediate playback.
   * Spinner remains FALSE.
   */
  public onManifestParsed(): void {
    if (this.state === "warming") {
      this.state = "ready";
      this.showSpinner = false;
      this.emit();
    }
  }

  /**
   * Called on canplay / loadedmetadata. Does not trigger or flash spinner.
   */
  public onCanPlay(): void {
    if (this.state === "warming") {
      this.state = "ready";
    }
    this.emit();
  }

  /**
   * Called when user or background autoplay requests playback.
   * video.play() is initiated immediately. Spinner remains FALSE initially,
   * appearing ONLY if a real frame hasn't rendered after the threshold (200ms).
   */
  public onPlayRequested(): void {
    this.clearTimer();
    this.state = "play_requested";
    this.showSpinner = false;
    this.emit();

    // Schedule delayed spinner
    this.spinnerTimer = setTimeout(() => {
      if (this.state === "play_requested" && !this.hasRenderedFirstFrame) {
        this.showSpinner = true;
        this.emit();
      }
    }, PLAY_REQUESTED_SPINNER_DELAY_MS);
  }

  /**
   * Called when the actual first video frame is presented to the screen
   * (via requestVideoFrameCallback or playing event).
   * Immediately clears any spinner and transitions to playing.
   */
  public onFirstFrame(): void {
    this.clearTimer();
    this.hasRenderedFirstFrame = true;
    this.hasStartedPlayback = true;
    this.state = "playing";
    this.showSpinner = false;
    this.emit();
  }

  /**
   * Called on media 'playing' event.
   */
  public onPlaying(): void {
    this.clearTimer();
    this.state = "playing";
    this.showSpinner = false;
    this.hasStartedPlayback = true;
    this.emit();
  }

  /**
   * Called on media 'waiting' event.
   * If first frame has already rendered, this represents rebuffering.
   * Delays the spinner so brief pauses (<250ms) do not flicker.
   */
  public onWaiting(): void {
    if (this.state === "playing" || this.hasRenderedFirstFrame) {
      this.clearTimer();
      this.state = "rebuffering";
      this.showSpinner = false;
      this.emit();

      this.spinnerTimer = setTimeout(() => {
        if (this.state === "rebuffering") {
          this.showSpinner = true;
          this.emit();
        }
      }, REBUFFERING_SPINNER_DELAY_MS);
    }
  }

  /**
   * Called on media 'pause'.
   */
  public onPause(): void {
    this.clearTimer();
    if (this.state !== "error" && this.state !== "ended") {
      this.showSpinner = false;
      this.emit();
    }
  }

  /**
   * Called on media 'ended'.
   */
  public onEnded(): void {
    this.clearTimer();
    this.state = "ended";
    this.showSpinner = false;
    this.emit();
  }

  /**
   * Called on fatal or media error.
   */
  public onError(): void {
    this.clearTimer();
    this.state = "error";
    this.showSpinner = false;
    this.emit();
  }

  public reset(): void {
    this.clearTimer();
    this.state = "warming";
    this.showSpinner = false;
    this.hasRenderedFirstFrame = false;
    this.hasStartedPlayback = false;
    this.emit();
  }

  public dispose(): void {
    this.clearTimer();
  }
}
