import { db } from "@/db";
import { videos, accountMembers, monthlyUsage } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getVideoPlaybackUrl } from "@/lib/video-providers";
import {
  getActivePlanForUser,
  getCurrentPeriodKey,
  type ActivePlanContext,
} from "./access";

export interface PlaybackEntitlementResult {
  authorized: boolean;
  videoId?: string;
  accountId?: string;
  ownerUserId?: string;
  activePlan?: ActivePlanContext;
  error?: string;
  statusCode?: number;
}

/**
 * Verifies current monthly usage against plan limits for read-only bootstrap checks.
 * Does NOT reserve quota, increment counters, create playSessions, or acquire locks.
 */
export async function canLoadPlayback(
  ownerUserId: string,
  activePlan: ActivePlanContext
): Promise<boolean> {
  const periodKey = getCurrentPeriodKey();
  const maxPlays = activePlan.plan.limits.maxPlaysPerMonth;

  const [usage] = await db
    .select({ plays: monthlyUsage.plays })
    .from(monthlyUsage)
    .where(
      and(
        eq(monthlyUsage.userId, ownerUserId),
        eq(monthlyUsage.periodKey, periodKey)
      )
    )
    .limit(1);

  const currentPlays = usage?.plays ?? 0;
  return currentPlays < maxPlays;
}

/**
 * BOOTSTRAP ENTITLEMENT
 * Resolves video identity, verifies active subscription, and verifies available monthly limits.
 * If authorized, enables public bootstrap endpoint to return playbackUrl and metadata.
 * Does NOT register plays or modify data.
 */
export async function resolvePlaybackEntitlement(
  publicId: string
): Promise<PlaybackEntitlementResult> {
  if (!publicId || typeof publicId !== "string" || !publicId.trim()) {
    return {
      authorized: false,
      error: "Identificador de vídeo inválido.",
      statusCode: 400,
    };
  }

  // 1. Minimum query by publicId ONLY (id and accountId)
  const [minVideo] = await db
    .select({
      id: videos.id,
      accountId: videos.accountId,
    })
    .from(videos)
    .where(eq(videos.publicId, publicId.trim()))
    .limit(1);

  if (!minVideo) {
    return {
      authorized: false,
      error: "Vídeo não encontrado.",
      statusCode: 404,
    };
  }

  // 2. Resolve account owner userId
  const [ownerMember] = await db
    .select({ userId: accountMembers.userId })
    .from(accountMembers)
    .where(
      and(
        eq(accountMembers.accountId, minVideo.accountId),
        eq(accountMembers.role, "owner")
      )
    )
    .limit(1);

  if (!ownerMember) {
    return {
      authorized: false,
      error: "Proprietário do vídeo não encontrado.",
      statusCode: 404,
    };
  }

  const ownerUserId = ownerMember.userId;

  // 3. Verify owner has active plan (status === 'active' and unexpired)
  const activePlan = await getActivePlanForUser(ownerUserId);
  if (!activePlan) {
    return {
      authorized: false,
      error: "Este vídeo está temporariamente indisponível.",
      statusCode: 403,
    };
  }

  // 4. Verify monthly play limits (read-only, no reservation or locks)
  const hasQuota = await canLoadPlayback(ownerUserId, activePlan);
  if (!hasQuota) {
    return {
      authorized: false,
      error: "Este vídeo está temporariamente indisponível.",
      statusCode: 403,
    };
  }

  return {
    authorized: true,
    videoId: minVideo.id,
    accountId: minVideo.accountId,
    ownerUserId,
    activePlan,
  };
}

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
 * Records a play session in background and increments monthly_usage.plays.
 * Does NOT verify active plan or quota, does NOT block playback, and does NOT return playbackUrl.
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

export interface ActivatePlaybackInput {
  publicId: string;
  playSessionId: string;
  isEditorAdmin?: boolean;
  adminUserId?: string;
}

export interface ActivatePlaybackResult {
  authorized: boolean;
  playbackUrl?: string;
  error?: string;
  statusCode?: number;
}

/**
 * Backward compatibility helper for legacy callers.
 * Records playback in background and returns playbackUrl if video exists.
 */
export async function validateAndActivatePlayback(
  input: ActivatePlaybackInput
): Promise<ActivatePlaybackResult> {
  const recordResult = await recordPlaybackSession(input);
  if (!recordResult.success) {
    return {
      authorized: false,
      error: recordResult.error || "Falha ao registrar reprodução.",
      statusCode: 500,
    };
  }

  const [video] = await db
    .select()
    .from(videos)
    .where(eq(videos.publicId, input.publicId.trim()))
    .limit(1);

  const playbackUrl = video ? getVideoPlaybackUrl(video) : null;

  if (!video || !playbackUrl) {
    return {
      authorized: false,
      error: "Vídeo não encontrado ou indisponível.",
      statusCode: 404,
    };
  }

  return {
    authorized: true,
    playbackUrl,
    statusCode: 200,
  };
}
