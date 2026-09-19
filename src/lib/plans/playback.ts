import { db } from "@/db";
import { videos, accountMembers } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getCurrentPeriodKey } from "./access";

export interface RecordPlaybackInput {
  publicId: string;
  playSessionId: string;
  isEditorAdmin?: boolean;
  adminUserId?: string;
}

export interface RecordPlaybackResult {
  success: boolean;
  recorded?: boolean;
  error?: string;
}

/**
 * CANONICAL FIRST PLAY TRACKING AUTHORITY (Async, Non-blocking)
 *
 * Records a play session in background and increments monthly_usage.plays.
 *
 * Architectural principles:
 * 1. LOAD gate (access, quota, limits, media prep) is strictly handled by resolveEmbedBootstrap().
 * 2. PLAY tracking is asynchronous and NEVER blocks video.play() or HLS attachment.
 * 3. Tracking failure does not interrupt active playback.
 * 4. Idempotent per (videoId, playSessionId).
 * 5. Editor preview exemption: authenticated account members skip tracking / quota consumption.
 */
export async function recordPlaybackSession(
  input: RecordPlaybackInput
): Promise<RecordPlaybackResult> {
  const { publicId, playSessionId, isEditorAdmin, adminUserId } = input;

  if (!playSessionId || typeof playSessionId !== "string" || !playSessionId.trim()) {
    return {
      success: false,
      error: "Identificador de sessão de reprodução inválido.",
    };
  }

  // 1. Resolve video and accountId
  const [video] = await db
    .select({
      id: videos.id,
      accountId: videos.accountId,
    })
    .from(videos)
    .where(eq(videos.publicId, publicId.trim()))
    .limit(1);

  if (!video) {
    return {
      success: false,
      error: "Vídeo não encontrado.",
    };
  }

  // 2. Editor preview exemption: authenticated account member skips tracking / quota consumption
  if (isEditorAdmin && adminUserId) {
    const [membership] = await db
      .select({ id: accountMembers.id })
      .from(accountMembers)
      .where(
        and(
          eq(accountMembers.accountId, video.accountId),
          eq(accountMembers.userId, adminUserId)
        )
      )
      .limit(1);

    if (membership) {
      return {
        success: true,
        recorded: false,
      };
    }
  }

  // 3. Resolve owner userId
  const [ownerMember] = await db
    .select({ userId: accountMembers.userId })
    .from(accountMembers)
    .where(
      and(
        eq(accountMembers.accountId, video.accountId),
        eq(accountMembers.role, "owner")
      )
    )
    .limit(1);

  if (!ownerMember) {
    return {
      success: false,
      error: "Proprietário do vídeo não encontrado.",
    };
  }

  const ownerUserId = ownerMember.userId;
  const periodKey = getCurrentPeriodKey();

  let recorded = false;

  try {
    await db.transaction(async (tx) => {
      // Step A: Ensure monthly_usage row exists for (ownerUserId, periodKey)
      await tx.execute(sql`
        INSERT INTO monthly_usage (id, user_id, period_key, plays, created_at, updated_at)
        VALUES (gen_random_uuid(), ${ownerUserId}, ${periodKey}, 0, NOW(), NOW())
        ON CONFLICT (user_id, period_key) DO NOTHING
      `);

      // Step B: Attempt to register play_session (idempotent for same videoId + playSessionId)
      const sessionInsert = await tx.execute(sql`
        INSERT INTO play_sessions (id, video_id, owner_user_id, play_session_id, created_at)
        VALUES (gen_random_uuid(), ${video.id}, ${ownerUserId}, ${playSessionId.trim()}, NOW())
        ON CONFLICT (video_id, play_session_id) DO NOTHING
        RETURNING id
      `);

      const isNewSession = (sessionInsert.rows?.length ?? 0) > 0;
      recorded = isNewSession;

      // Step C: If new session, increment monthly_usage.plays without blocking or quota checks
      if (isNewSession) {
        await tx.execute(sql`
          UPDATE monthly_usage
          SET plays = plays + 1, updated_at = NOW()
          WHERE user_id = ${ownerUserId}
            AND period_key = ${periodKey}
        `);
      }
    });

    return {
      success: true,
      recorded,
    };
  } catch (error) {
    console.error("[Record Playback Error]", error);
    return {
      success: false,
      error: "Falha ao registrar sessão de reprodução.",
    };
  }
}
