import { z } from "zod";
import { db } from "@/db";
import { videos } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const qualitySummarySchema = z.object({
  version: z.literal(1),
  source: z.enum(["hlsjs", "native", "direct"]),
  startup: z
    .object({
      height: z.number().nullable().optional(),
      bitrate: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
  foreground: z
    .object({
      initialHeight: z.number().nullable().optional(),
      currentHeight: z.number().nullable().optional(),
      maxHeight: z.number().nullable().optional(),
      switchCount: z.number().int().nonnegative().optional(),
    })
    .nullable()
    .optional(),
  bandwidthEstimateBps: z.number().nullable().optional(),
});

export const performanceSummarySchema = z.object({
  version: z.literal(1),
  bootstrapDurationMs: z.number().nullable().optional(),
  manifestDurationMs: z.number().nullable().optional(),
  firstFragmentDurationMs: z.number().nullable().optional(),
  mediaAttachToFirstFrameMs: z.number().nullable().optional(),
  resumeReadyMs: z.number().nullable().optional(),
  clickToFirstFrameMs: z.number().nullable().optional(),
});

export const telemetryPayloadSchema = z.object({
  sessionId: z.string().trim().min(1).max(128),
  sequence: z.number().int().positive(),

  durationSeconds: z.number().nonnegative().nullable().optional(),
  lastPositionSeconds: z.number().nonnegative().nullable().optional(),
  maxPositionSeconds: z.number().nonnegative().nullable().optional(),

  watchTimeMs: z.number().int().nonnegative().default(0),
  watchedRanges: z
    .array(z.tuple([z.number(), z.number()]))
    .max(256)
    .default([]),

  pauseCount: z.number().int().nonnegative().default(0),
  seekCount: z.number().int().nonnegative().default(0),
  rateChangeCount: z.number().int().nonnegative().default(0),
  fullscreenCount: z.number().int().nonnegative().default(0),

  bufferCount: z.number().int().nonnegative().default(0),
  bufferTimeMs: z.number().int().nonnegative().default(0),

  startedInBackgroundAutoplay: z.boolean().default(false),
  startedFromResume: z.boolean().default(false),
  resumeFromSeconds: z.number().nullable().optional(),
  resumeDecision: z.enum(["none", "continue", "restart"]).default("none"),

  qualitySummary: qualitySummarySchema.nullable().optional(),
  performanceSummary: performanceSummarySchema.nullable().optional(),

  ended: z.boolean().default(false),
  hasError: z.boolean().default(false),
  lastErrorType: z.string().max(64).nullable().optional(),
});

export type TelemetryPayloadInput = z.infer<typeof telemetryPayloadSchema>;

export function mergeServerWatchedRanges(
  ranges: [number, number][],
  durationSeconds?: number | null,
  tolerance: number = 0.75,
  maxRanges: number = 256
): {
  mergedRanges: [number, number][];
  uniqueWatchedSeconds: number;
  completionPercent: number;
} {
  if (!ranges || ranges.length === 0) {
    return { mergedRanges: [], uniqueWatchedSeconds: 0, completionPercent: 0 };
  }

  const maxDuration = durationSeconds && durationSeconds > 0 ? durationSeconds : Infinity;

  // Filter and sanitize bounds
  const valid = ranges
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .map(([start, end]): [number, number] => [
      Math.max(0, Math.min(start, maxDuration)),
      Math.max(0, Math.min(end, maxDuration)),
    ])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);

  if (valid.length === 0) {
    return { mergedRanges: [], uniqueWatchedSeconds: 0, completionPercent: 0 };
  }

  const merged: [number, number][] = [];
  let current = valid[0];

  for (let i = 1; i < valid.length; i++) {
    const next = valid[i];
    if (next[0] <= current[1] + tolerance) {
      current = [current[0], Math.max(current[1], next[1])];
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  const finalRanges = merged.length > maxRanges ? merged.slice(0, maxRanges) : merged;

  const uniqueWatchedSeconds = finalRanges.reduce(
    (sum, [start, end]) => sum + Math.max(0, end - start),
    0
  );

  const completionPercent =
    durationSeconds && durationSeconds > 0
      ? Math.min(100, Math.max(0, (uniqueWatchedSeconds / durationSeconds) * 100))
      : 0;

  return {
    mergedRanges: finalRanges,
    uniqueWatchedSeconds: parseFloat(uniqueWatchedSeconds.toFixed(3)),
    completionPercent: parseFloat(completionPercent.toFixed(2)),
  };
}

export interface RecordTelemetryResult {
  success: boolean;
  error?: string;
}

export async function recordTelemetrySession(
  publicId: string,
  payload: TelemetryPayloadInput
): Promise<RecordTelemetryResult> {
  if (!publicId || typeof publicId !== "string" || !publicId.trim()) {
    return { success: false, error: "Identificador de vídeo inválido." };
  }

  // 1. Resolve video and accountId
  const [video] = await db
    .select({
      id: videos.id,
      accountId: videos.accountId,
      duration: videos.duration,
    })
    .from(videos)
    .where(eq(videos.publicId, publicId.trim()))
    .limit(1);

  if (!video) {
    return { success: false, error: "Vídeo não encontrado." };
  }

  const effectiveDuration = payload.durationSeconds || video.duration || null;
  const { mergedRanges, uniqueWatchedSeconds, completionPercent } =
    mergeServerWatchedRanges(payload.watchedRanges, effectiveDuration);

  const isForegroundActive =
    payload.watchTimeMs > 0 ||
    mergedRanges.length > 0 ||
    payload.pauseCount > 0 ||
    payload.seekCount > 0 ||
    payload.resumeDecision !== "none";

  try {
    await db.execute(sql`
      INSERT INTO tracker_sessions (
        id,
        account_id,
        video_id,
        session_id,
        sequence,
        created_at,
        updated_at,
        last_seen_at,
        first_foreground_at,
        ended_at,
        started_in_background_autoplay,
        duration_seconds,
        last_position_seconds,
        max_position_seconds,
        watch_time_ms,
        unique_watched_seconds,
        completion_percent,
        watched_ranges,
        pause_count,
        seek_count,
        rate_change_count,
        fullscreen_count,
        buffer_count,
        buffer_time_ms,
        started_from_resume,
        resume_from_seconds,
        resume_decision,
        quality_summary,
        performance_summary,
        ended,
        has_error,
        last_error_type
      )
      VALUES (
        gen_random_uuid(),
        ${video.accountId},
        ${video.id},
        ${payload.sessionId},
        ${payload.sequence},
        NOW(),
        NOW(),
        NOW(),
        ${isForegroundActive ? sql`NOW()` : null},
        ${payload.ended ? sql`NOW()` : null},
        ${payload.startedInBackgroundAutoplay},
        ${effectiveDuration},
        ${payload.lastPositionSeconds ?? null},
        ${payload.maxPositionSeconds ?? null},
        ${payload.watchTimeMs},
        ${uniqueWatchedSeconds},
        ${completionPercent},
        ${JSON.stringify(mergedRanges)}::jsonb,
        ${payload.pauseCount},
        ${payload.seekCount},
        ${payload.rateChangeCount},
        ${payload.fullscreenCount},
        ${payload.bufferCount},
        ${payload.bufferTimeMs},
        ${payload.startedFromResume},
        ${payload.resumeFromSeconds ?? null},
        ${payload.resumeDecision},
        ${payload.qualitySummary ? JSON.stringify(payload.qualitySummary) : null}::jsonb,
        ${payload.performanceSummary ? JSON.stringify(payload.performanceSummary) : null}::jsonb,
        ${payload.ended},
        ${payload.hasError},
        ${payload.lastErrorType ?? null}
      )
      ON CONFLICT (video_id, session_id) DO UPDATE SET
        sequence = GREATEST(tracker_sessions.sequence, EXCLUDED.sequence),
        updated_at = NOW(),
        last_seen_at = NOW(),
        first_foreground_at = COALESCE(tracker_sessions.first_foreground_at, EXCLUDED.first_foreground_at),
        ended_at = COALESCE(tracker_sessions.ended_at, EXCLUDED.ended_at),
        duration_seconds = COALESCE(EXCLUDED.duration_seconds, tracker_sessions.duration_seconds),
        last_position_seconds = CASE
          WHEN EXCLUDED.sequence >= tracker_sessions.sequence THEN EXCLUDED.last_position_seconds
          ELSE tracker_sessions.last_position_seconds
        END,
        max_position_seconds = GREATEST(COALESCE(tracker_sessions.max_position_seconds, 0), COALESCE(EXCLUDED.max_position_seconds, 0)),
        watch_time_ms = GREATEST(tracker_sessions.watch_time_ms, EXCLUDED.watch_time_ms),
        unique_watched_seconds = GREATEST(tracker_sessions.unique_watched_seconds, EXCLUDED.unique_watched_seconds),
        completion_percent = GREATEST(tracker_sessions.completion_percent, EXCLUDED.completion_percent),
        watched_ranges = CASE
          WHEN EXCLUDED.sequence >= tracker_sessions.sequence THEN EXCLUDED.watched_ranges
          ELSE tracker_sessions.watched_ranges
        END,
        pause_count = GREATEST(tracker_sessions.pause_count, EXCLUDED.pause_count),
        seek_count = GREATEST(tracker_sessions.seek_count, EXCLUDED.seek_count),
        rate_change_count = GREATEST(tracker_sessions.rate_change_count, EXCLUDED.rate_change_count),
        fullscreen_count = GREATEST(tracker_sessions.fullscreen_count, EXCLUDED.fullscreen_count),
        buffer_count = GREATEST(tracker_sessions.buffer_count, EXCLUDED.buffer_count),
        buffer_time_ms = GREATEST(tracker_sessions.buffer_time_ms, EXCLUDED.buffer_time_ms),
        resume_decision = CASE
          WHEN tracker_sessions.resume_decision = 'none' AND EXCLUDED.resume_decision != 'none' THEN EXCLUDED.resume_decision
          ELSE tracker_sessions.resume_decision
        END,
        quality_summary = CASE
          WHEN EXCLUDED.sequence >= tracker_sessions.sequence THEN EXCLUDED.quality_summary
          ELSE tracker_sessions.quality_summary
        END,
        performance_summary = COALESCE(EXCLUDED.performance_summary, tracker_sessions.performance_summary),
        ended = tracker_sessions.ended OR EXCLUDED.ended,
        has_error = tracker_sessions.has_error OR EXCLUDED.has_error,
        last_error_type = COALESCE(EXCLUDED.last_error_type, tracker_sessions.last_error_type)
    `);

    return { success: true };
  } catch (err) {
    console.error("[Record Telemetry Error]", err);
    return { success: false, error: "Falha ao persistir telemetria." };
  }
}
