/**
 * Evandro Player Headless Media Engine Types
 * Pure TypeScript definitions with zero React dependencies.
 */

import type { PlayerConfig } from "@/types/player-config";
import type Hls from "hls.js";

export type PlaybackExperience = "background_autoplay" | "foreground" | "idle";

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
}

export interface PlayerEngineState {
  videoId: string;
  playbackUrl: string | null;
  experience: PlaybackExperience;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  playbackRate: number;
  hasFirstFrame: boolean;
  hasError: boolean;
  errorMessage: string | null;
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
  play(): Promise<void>;
  pause(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: number): void;
  onFirstFrame(listener: EngineFirstFrameListener): () => void;
  subscribe(listener: EngineStateListener): () => void;
  destroy(): void;
}
