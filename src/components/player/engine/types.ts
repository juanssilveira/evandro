/**
 * Evandro Player Headless Media Engine Types
 * Pure TypeScript definitions with zero React dependencies.
 */

import type { PlayerConfig } from "@/types/player-config";
import type Hls from "hls.js";

export type PlaybackExperience = "background_autoplay" | "foreground" | "idle";
export type PlaybackInitiator = "user" | "autoplay" | "system";
export type StartupVisualState = "available" | "loading" | "visible" | "pending_release" | "released";
export type StartupVisualType = "preview" | "thumbnail" | "none";

export interface EngineSourceOptions {
  videoId: string;
  playbackUrl: string;
  backgroundAutoplay: boolean;
  thumbnailEnabled?: boolean;
  posterUrl?: string | null;
  backgroundPreviewUrl?: string | null;
  config?: PlayerConfig;
  defaultVolume?: number;
  defaultPlaybackRate?: number;
  apiBase?: string;
}

export interface PlayerEngineState {
  videoId: string;
  playbackUrl: string | null;
  experience: PlaybackExperience;
  playbackInitiator: PlaybackInitiator;
  userForegroundRequested: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  playbackRate: number;
  hasFirstFrame: boolean;
  hasStartedForeground: boolean;
  isBuffering: boolean;
  isEnded: boolean;
  hasError: boolean;
  errorMessage: string | null;
  startupVisualState: StartupVisualState;
}

export interface PlayerEngineOptions {
  videoElement: HTMLVideoElement;
  stageElement?: HTMLElement | null;
  startupVisualElement?: HTMLElement | null;
  debug?: boolean;
}

export type EngineStateListener = (state: PlayerEngineState) => void;
export type EngineFirstFrameListener = (now: number) => void;

export interface IPlayerEngine {
  readonly video: HTMLVideoElement;
  readonly state: PlayerEngineState;
  readonly hls: Hls | null;
  loadSource(options: EngineSourceOptions): Promise<void>;
  startForeground(volume?: number): Promise<void>;
  play(initiator?: PlaybackInitiator): Promise<void>;
  pause(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: number): void;
  updateConfig(config: PlayerConfig): void;
  releaseStartupVisual(videoId?: string): void;
  setStartupVisualElement(element: HTMLElement | null): void;
  onFirstFrame(listener: EngineFirstFrameListener): () => void;
  subscribe(listener: EngineStateListener): () => void;
  destroy(): void;
}
