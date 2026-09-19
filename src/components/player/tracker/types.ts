import type { IPlayerEngine } from "../engine/types";
import type { PlayerRuntime } from "../runtime";
import type { QualitySummary, PerformanceSummary } from "@/db/schema/tracker-sessions";

export type { QualitySummary, PerformanceSummary };

export interface TrackerOptions {
  videoId: string;
  sessionId: string;
  apiBase?: string;
  debug?: boolean;
  isEditor?: boolean;
  runtime: PlayerRuntime;
  engine: IPlayerEngine;
}

export interface TrackerSessionPayload {
  sessionId: string;
  sequence: number;

  durationSeconds?: number | null;
  lastPositionSeconds?: number | null;
  maxPositionSeconds?: number | null;

  watchTimeMs: number;
  watchedRanges: [number, number][];

  uniqueWatchedSeconds: number;
  completionPercent: number;

  pauseCount: number;
  seekCount: number;
  rateChangeCount: number;
  fullscreenCount: number;

  bufferCount: number;
  bufferTimeMs: number;

  startedInBackgroundAutoplay: boolean;
  startedFromResume: boolean;
  resumeFromSeconds?: number | null;
  resumeDecision: "none" | "continue" | "restart";

  qualitySummary?: QualitySummary | null;
  performanceSummary?: PerformanceSummary | null;

  ended: boolean;
  hasError: boolean;
  lastErrorType?: string | null;
}
