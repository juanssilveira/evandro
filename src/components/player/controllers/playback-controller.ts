import type { PlayerConfig } from "@/types/player-config";
import type { PlayerRuntime, PlaybackMode, PlaybackInitiator } from "../runtime";

export interface PlaybackControllerOptions {
  video: HTMLVideoElement;
  runtime: PlayerRuntime;
  config: PlayerConfig;
  onModeChange?: (mode: PlaybackMode) => void;
  onInitiatorChange?: (initiator: PlaybackInitiator) => void;
}

export class PlaybackController {
  private video: HTMLVideoElement;
  private runtime: PlayerRuntime;
  private config: PlayerConfig;
  private onModeChange?: (mode: PlaybackMode) => void;
  private onInitiatorChange?: (initiator: PlaybackInitiator) => void;
  private isDisposed = false;

  constructor(options: PlaybackControllerOptions) {
    this.video = options.video;
    this.runtime = options.runtime;
    this.config = options.config;
    this.onModeChange = options.onModeChange;
    this.onInitiatorChange = options.onInitiatorChange;
  }

  public updateConfig(newConfig: PlayerConfig): void {
    this.config = newConfig;
  }

  public updateDependencies(video: HTMLVideoElement, runtime: PlayerRuntime): void {
    this.video = video;
    this.runtime = runtime;
  }

  public getPlaybackMode(): PlaybackMode {
    return this.runtime.getPlaybackMode();
  }

  public getPlaybackInitiator(): PlaybackInitiator {
    return this.runtime.getPlaybackInitiator();
  }

  public isBackgroundAutoplay(): boolean {
    return this.runtime.getPlaybackMode() === "background_autoplay";
  }

  /**
   * Resolves initial playback according to PlayerConfig priority:
   * 1. autoplay = true -> Attempt real unmuted foreground play
   * 2. If autoplay blocked & backgroundAutoplay = true -> Fallback to background autoplay (muted, loop)
   * 3. autoplay = false & backgroundAutoplay = true -> Start background autoplay (muted, loop)
   * 4. Both false -> Normal standby waiting for user
   */
  public async resolveInitialPlayback(): Promise<void> {
    if (this.isDisposed) return;
    if (this.runtime.getPlaybackMode() === "foreground" && this.runtime.getPlaybackInitiator() === "user") {
      return;
    }

    const { backgroundAutoplay } = this.config.playback;

    if (backgroundAutoplay) {
      await this.startBackgroundAutoplay();
      return;
    }

    this.video.loop = false;
    this.setContext("foreground", "user");
  }

  /**
   * Starts background autoplay: muted, loop, context=background_autoplay + autoplay
   */
  public async startBackgroundAutoplay(): Promise<void> {
    if (this.isDisposed) return;

    this.video.muted = true;
    this.video.loop = true;
    this.setContext("background_autoplay", "autoplay");

    try {
      await this.video.play();
    } catch {
      // If even muted autoplay fails (e.g. strict low power mode)
      if (this.config.development.debug) {
        console.log("[WatchMap Player] BACKGROUND_AUTOPLAY_BLOCKED");
      }
    }
  }

  /**
   * Transitions to Real Foreground Playback:
   * - desativar loop
   * - currentTime = 0
   * - muted = false (restaura áudio)
   * - playbackMode = foreground, playbackInitiator = user
   * - PLAYBACK_CONTEXT_CHANGE emitido pelo Runtime
   */
  public async startForegroundPlayback(preferredVolume?: number): Promise<void> {
    if (this.isDisposed) return;

    this.setContext("foreground", "user");
    this.video.loop = false;
    if (this.video.currentTime !== 0) {
      this.video.currentTime = 0;
    }

    const resolvedVolume =
      preferredVolume !== undefined
        ? preferredVolume
        : (this.config.playback.defaultVolume ?? 1);

    const resolvedRate = this.config.playback.defaultPlaybackRate ?? 1;

    this.video.volume = resolvedVolume;
    this.video.muted = resolvedVolume === 0;
    this.video.playbackRate = resolvedRate;

    try {
      await this.video.play();
    } catch (err) {
      if (this.config.development.debug) {
        console.warn("[WatchMap Player] Foreground play failed on user gesture:", err);
      }
    }
  }

  /**
   * Handles user Play/Pause toggle
   */
  public async handleUserPlayToggle(preferredVolume?: number): Promise<void> {
    if (this.isDisposed) return;

    const isBackground = this.runtime.getPlaybackMode() === "background_autoplay";

    if (isBackground) {
      await this.startForegroundPlayback(preferredVolume);
      return;
    }

    if (this.video.paused || this.video.ended) {
      this.setContext("foreground", "user");
      try {
        await this.video.play();
      } catch {
        // Ignore play interrupt
      }
    } else {
      this.video.pause();
    }
  }

  public dispose(): void {
    this.isDisposed = true;
  }

  private setContext(mode: PlaybackMode, initiator: PlaybackInitiator): void {
    this.runtime.setPlaybackContext(mode, initiator);
    this.onModeChange?.(mode);
    this.onInitiatorChange?.(initiator);
  }
}
