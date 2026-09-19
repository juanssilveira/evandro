import type { PlayerConfig } from "@/types/player-config";
import type { PlayerRuntime, PlaybackMode, PlaybackInitiator } from "../runtime";
import type { PlayerEngine } from "../engine/player-engine";

export interface PlaybackControllerOptions {
  engine: PlayerEngine;
  runtime: PlayerRuntime;
  config: PlayerConfig;
  onModeChange?: (mode: PlaybackMode) => void;
  onInitiatorChange?: (initiator: PlaybackInitiator) => void;
}

/**
 * PlaybackController (Deprecated Adapter)
 * Delegates all commands to PlayerEngine. Never mutates HTMLVideoElement directly.
 */
export class PlaybackController {
  private engine: PlayerEngine;
  private runtime: PlayerRuntime;
  private config: PlayerConfig;
  private onModeChange?: (mode: PlaybackMode) => void;
  private onInitiatorChange?: (initiator: PlaybackInitiator) => void;
  private isDisposed = false;

  constructor(options: PlaybackControllerOptions) {
    this.engine = options.engine;
    this.runtime = options.runtime;
    this.config = options.config;
    this.onModeChange = options.onModeChange;
    this.onInitiatorChange = options.onInitiatorChange;
  }

  public updateConfig(newConfig: PlayerConfig): void {
    this.config = newConfig;
    this.engine.updateConfig(newConfig);
  }

  public stopBackgroundAutoplay(): void {
    if (this.isDisposed) return;
    this.engine.pause();
    this.setContext("foreground", "user");
  }

  public updateDependencies(engine: PlayerEngine, runtime: PlayerRuntime): void {
    this.engine = engine;
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

    this.setContext("foreground", "user");
  }

  public async startBackgroundAutoplay(): Promise<void> {
    if (this.isDisposed) return;
    this.setContext("background_autoplay", "autoplay");
    try {
      await this.engine.play("autoplay");
    } catch {
      // ignore
    }
  }

  public async startForegroundPlayback(preferredVolume?: number): Promise<void> {
    if (this.isDisposed) return;
    this.setContext("foreground", "user");
    await this.engine.startForeground(preferredVolume);
  }

  public async handleUserPlayToggle(preferredVolume?: number): Promise<void> {
    if (this.isDisposed) return;
    const isBackground = this.runtime.getPlaybackMode() === "background_autoplay";

    if (isBackground) {
      await this.startForegroundPlayback(preferredVolume);
      return;
    }

    if (!this.engine.state.isPlaying) {
      this.setContext("foreground", "user");
      await this.engine.play("user");
    } else {
      this.engine.pause();
    }
  }

  public dispose(): void {
    this.isDisposed = true;
  }

  public setContext(mode: PlaybackMode, initiator: PlaybackInitiator): void {
    this.runtime.setPlaybackContext(mode, initiator);
    this.onModeChange?.(mode);
    this.onInitiatorChange?.(initiator);
  }
}
