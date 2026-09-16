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

    const { autoplay, backgroundAutoplay } = this.config.playback;
    const debug = this.config.development.debug;

    if (autoplay) {
      // 1. Attempt real Autoplay (foreground, unmuted)
      this.setContext("foreground", "autoplay");
      this.video.loop = false;

      try {
        await this.video.play();
        // Successfully started unmuted foreground autoplay
        return;
      } catch {
        // Autoplay blocked by browser policy
        if (debug) {
          console.log("[WatchMap Player] AUTOPLAY_BLOCKED");
        }

        if (this.isDisposed) return;

        // Fallback to Background Autoplay if configured
        if (backgroundAutoplay) {
          await this.startBackgroundAutoplay();
          return;
        }

        // Otherwise, stay waiting for user
        this.setContext("foreground", "user");
        return;
      }
    }

    if (backgroundAutoplay) {
      // 2. Autoplay false, Background Autoplay true
      await this.startBackgroundAutoplay();
      return;
    }

    // 3. Both false
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
   * Transitions from Background Autoplay to Real Foreground Playback:
   * - desativar loop
   * - currentTime = 0
   * - muted = false (restaura áudio)
   * - playbackMode = foreground, playbackInitiator = user
   * - PLAYBACK_CONTEXT_CHANGE emitido pelo Runtime
   */
  public async startForegroundPlayback(preferredVolume = 1): Promise<void> {
    if (this.isDisposed) return;

    const currentMode = this.runtime.getPlaybackMode();

    if (currentMode === "background_autoplay") {
      // 1. Emit typed PLAYBACK_CONTEXT_CHANGE in Runtime
      this.setContext("foreground", "user");

      // 2. Disable loop
      this.video.loop = false;

      // 3. Reset to beginning
      this.video.currentTime = 0;

      // 4. Restore audio
      this.video.muted = false;
      if (typeof this.video.volume === "number" && this.video.volume === 0) {
        this.video.volume = preferredVolume > 0 ? preferredVolume : 1;
      }

      // 5. Ensure playing
      try {
        await this.video.play();
      } catch {
        // User gesture should allow play
      }
      return;
    }

    // Normal foreground play
    this.setContext("foreground", "user");
    try {
      await this.video.play();
    } catch {
      // Play interrupted or blocked
    }
  }

  /**
   * Handles user Play/Pause toggle
   */
  public async handleUserPlayToggle(preferredVolume = 1): Promise<void> {
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
