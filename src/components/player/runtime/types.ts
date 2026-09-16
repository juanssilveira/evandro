export const PlayerEventType = {
  PLAYER_READY: "PLAYER_READY",
  PLAY: "PLAY",
  PLAYING: "PLAYING",
  PAUSE: "PAUSE",
  TIME_UPDATE: "TIME_UPDATE",
  SEEK_START: "SEEK_START",
  SEEK_END: "SEEK_END",
  RATE_CHANGE: "RATE_CHANGE",
  VOLUME_CHANGE: "VOLUME_CHANGE",
  BUFFER_START: "BUFFER_START",
  BUFFER_END: "BUFFER_END",
  ENDED: "ENDED",
  ERROR: "ERROR",
} as const;

export type PlayerEventType =
  (typeof PlayerEventType)[keyof typeof PlayerEventType];

export interface PlayerSnapshot {
  videoId: string;
  currentTime: number;
  duration: number;
  playbackRate: number;
  paused: boolean;
  muted: boolean;
  volume: number;
  ended: boolean;
  timestamp: number;
}

export interface BasePlayerEvent {
  eventId: string;
  type: PlayerEventType;
  videoId: string;
  timestamp: number;
  snapshot: PlayerSnapshot;
}

export interface PlayerReadyEvent extends BasePlayerEvent {
  type: typeof PlayerEventType.PLAYER_READY;
}

export interface PlayEvent extends BasePlayerEvent {
  type: typeof PlayerEventType.PLAY;
}

export interface PlayingEvent extends BasePlayerEvent {
  type: typeof PlayerEventType.PLAYING;
}

export interface PauseEvent extends BasePlayerEvent {
  type: typeof PlayerEventType.PAUSE;
}

export interface TimeUpdateEvent extends BasePlayerEvent {
  type: typeof PlayerEventType.TIME_UPDATE;
}

export interface SeekStartEvent extends BasePlayerEvent {
  type: typeof PlayerEventType.SEEK_START;
  from: number;
}

export interface SeekEndEvent extends BasePlayerEvent {
  type: typeof PlayerEventType.SEEK_END;
  from: number;
  to: number;
}

export interface RateChangeEvent extends BasePlayerEvent {
  type: typeof PlayerEventType.RATE_CHANGE;
  previousRate: number;
  newRate: number;
}

export interface VolumeChangeEvent extends BasePlayerEvent {
  type: typeof PlayerEventType.VOLUME_CHANGE;
  previousVolume: number;
  volume: number;
  previousMuted: boolean;
  muted: boolean;
  previousEffectiveVolume: number;
  effectiveVolume: number;
}

export interface BufferStartEvent extends BasePlayerEvent {
  type: typeof PlayerEventType.BUFFER_START;
}

export interface BufferEndEvent extends BasePlayerEvent {
  type: typeof PlayerEventType.BUFFER_END;
}

export interface EndedEvent extends BasePlayerEvent {
  type: typeof PlayerEventType.ENDED;
}

export interface ErrorEvent extends BasePlayerEvent {
  type: typeof PlayerEventType.ERROR;
  message: string;
  code?: number;
}

export type PlayerRuntimeEvent =
  | PlayerReadyEvent
  | PlayEvent
  | PlayingEvent
  | PauseEvent
  | TimeUpdateEvent
  | SeekStartEvent
  | SeekEndEvent
  | RateChangeEvent
  | VolumeChangeEvent
  | BufferStartEvent
  | BufferEndEvent
  | EndedEvent
  | ErrorEvent;

export type PlayerEventListener = (event: PlayerRuntimeEvent) => void;

export type Unsubscribe = () => void;

export interface PlayerRuntimeOptions {
  videoId: string;
  debug?: boolean;
}
