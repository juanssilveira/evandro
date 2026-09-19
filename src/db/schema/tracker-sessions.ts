import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  doublePrecision,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { accounts } from "./accounts";
import { videos } from "./videos";

export interface QualitySummary {
  version: 1;
  source: "hlsjs" | "native" | "direct";
  startup?: {
    height?: number | null;
    bitrate?: number | null;
  } | null;
  foreground?: {
    initialHeight?: number | null;
    currentHeight?: number | null;
    maxHeight?: number | null;
    switchCount?: number;
  } | null;
  bandwidthEstimateBps?: number | null;
}

export interface PerformanceSummary {
  version: 1;
  bootstrapDurationMs?: number | null;
  manifestDurationMs?: number | null;
  firstFragmentDurationMs?: number | null;
  mediaAttachToFirstFrameMs?: number | null;
  resumeReadyMs?: number | null;
  clickToFirstFrameMs?: number | null;
}

export const trackerSessions = pgTable(
  "tracker_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    sequence: integer("sequence").notNull().default(1),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),

    firstForegroundAt: timestamp("first_foreground_at"),
    endedAt: timestamp("ended_at"),

    startedInBackgroundAutoplay: boolean("started_in_background_autoplay")
      .notNull()
      .default(false),

    durationSeconds: doublePrecision("duration_seconds"),
    lastPositionSeconds: doublePrecision("last_position_seconds"),
    maxPositionSeconds: doublePrecision("max_position_seconds"),

    watchTimeMs: integer("watch_time_ms").notNull().default(0),
    uniqueWatchedSeconds: doublePrecision("unique_watched_seconds")
      .notNull()
      .default(0),
    completionPercent: doublePrecision("completion_percent")
      .notNull()
      .default(0),

    watchedRanges: jsonb("watched_ranges")
      .$type<[number, number][]>()
      .notNull()
      .default([]),

    pauseCount: integer("pause_count").notNull().default(0),
    seekCount: integer("seek_count").notNull().default(0),
    rateChangeCount: integer("rate_change_count").notNull().default(0),
    fullscreenCount: integer("fullscreen_count").notNull().default(0),

    bufferCount: integer("buffer_count").notNull().default(0),
    bufferTimeMs: integer("buffer_time_ms").notNull().default(0),

    startedFromResume: boolean("started_from_resume").notNull().default(false),
    resumeFromSeconds: doublePrecision("resume_from_seconds"),
    resumeDecision: text("resume_decision")
      .$type<"none" | "continue" | "restart">()
      .notNull()
      .default("none"),

    qualitySummary: jsonb("quality_summary").$type<QualitySummary | null>(),
    performanceSummary: jsonb("performance_summary").$type<PerformanceSummary | null>(),

    ended: boolean("ended").notNull().default(false),

    hasError: boolean("has_error").notNull().default(false),
    lastErrorType: text("last_error_type"),
  },
  (t) => [
    unique("tracker_sessions_video_id_session_id_unique").on(
      t.videoId,
      t.sessionId
    ),
    index("tracker_sessions_account_id_created_at_idx").on(
      t.accountId,
      t.createdAt
    ),
    index("tracker_sessions_video_id_created_at_idx").on(
      t.videoId,
      t.createdAt
    ),
    index("tracker_sessions_created_at_idx").on(t.createdAt),
  ]
);

export type TrackerSession = typeof trackerSessions.$inferSelect;
export type NewTrackerSession = typeof trackerSessions.$inferInsert;
