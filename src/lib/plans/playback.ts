import { db } from "@/db";
import { videos, accountMembers } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getMuxSignedPlaybackUrl } from "@/lib/mux";
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
 * FASE 1 — ENTITLEMENT
 * Resolves only minimal video identity and validates that the account owner has an active plan.
 * NEVER resolves or returns media information (playbackUrl, playbackId, poster, HLS, etc.).
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

  return {
    authorized: true,
    videoId: minVideo.id,
    accountId: minVideo.accountId,
    ownerUserId,
    activePlan,
  };
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
 * Validates entitlement first (FASE 1), then checks media availability,
 * processes quota, and generates signed playback URL (FASE 2).
 */
export async function validateAndActivatePlayback(
  input: ActivatePlaybackInput
): Promise<ActivatePlaybackResult> {
  const { publicId, playSessionId, isEditorAdmin, adminUserId } = input;

  if (!playSessionId || typeof playSessionId !== "string" || !playSessionId.trim()) {
    return {
      authorized: false,
      error: "Identificador de sessão de reprodução inválido.",
      statusCode: 400,
    };
  }

  // -------------------------------------------------------------
  // FASE 1 — ENTITLEMENT (Obligatory first phase)
  // -------------------------------------------------------------
  const entitlement = await resolvePlaybackEntitlement(publicId);
  if (!entitlement.authorized) {
    return {
      authorized: false,
      error: entitlement.error || "Este vídeo está temporariamente indisponível.",
      statusCode: entitlement.statusCode || 403,
    };
  }

  const { videoId, accountId, ownerUserId, activePlan } = entitlement;

  // -------------------------------------------------------------
  // FASE 2 — PLAYBACK & MEDIA RELEASE
  // -------------------------------------------------------------

  // 1. Verify editor status server-side if requested
  let isVerifiedEditor = false;
  if (isEditorAdmin && adminUserId && accountId) {
    const [membership] = await db
      .select({ id: accountMembers.id })
      .from(accountMembers)
      .where(
        and(
          eq(accountMembers.accountId, accountId),
          eq(accountMembers.userId, adminUserId)
        )
      )
      .limit(1);

    if (membership) {
      isVerifiedEditor = true;
    }
  }

  // 2. Query full video record to inspect media readiness and playback ID
  const [video] = await db
    .select()
    .from(videos)
    .where(eq(videos.id, videoId!))
    .limit(1);

  if (!video || video.status !== "ready" || !video.muxPlaybackId) {
    return {
      authorized: false,
      error: "Vídeo em processamento ou indisponível.",
      statusCode: 404,
    };
  }

  // 3. Editor preview exemption: authenticated account member skips quota consumption
  if (isVerifiedEditor) {
    const playbackUrl = await getMuxSignedPlaybackUrl(video.muxPlaybackId);
    return {
      authorized: true,
      playbackUrl,
      statusCode: 200,
    };
  }

  // 4. Regular viewer: enforce monthly play quota atomically & register play_session
  const periodKey = getCurrentPeriodKey();
  const maxPlays = activePlan!.plan.limits.maxPlaysPerMonth;

  try {
    await db.transaction(async (tx) => {
      // Step A: Ensure monthly_usage row exists for (ownerUserId, periodKey)
      await tx.execute(sql`
        INSERT INTO monthly_usage (id, user_id, period_key, plays, created_at, updated_at)
        VALUES (gen_random_uuid(), ${ownerUserId!}, ${periodKey}, 0, NOW(), NOW())
        ON CONFLICT (user_id, period_key) DO NOTHING
      `);

      // Step B: Attempt to register play_session (idempotent for same videoId + playSessionId)
      const sessionInsert = await tx.execute(sql`
        INSERT INTO play_sessions (id, video_id, owner_user_id, play_session_id, created_at)
        VALUES (gen_random_uuid(), ${video.id}, ${ownerUserId!}, ${playSessionId.trim()}, NOW())
        ON CONFLICT (video_id, play_session_id) DO NOTHING
        RETURNING id
      `);

      const isNewSession = (sessionInsert.rows?.length ?? 0) > 0;

      // Step C: If new session, check limit and increment atomically
      if (isNewSession) {
        const updateRes = await tx.execute(sql`
          UPDATE monthly_usage
          SET plays = plays + 1, updated_at = NOW()
          WHERE user_id = ${ownerUserId!}
            AND period_key = ${periodKey}
            AND plays < ${maxPlays}
          RETURNING plays
        `);

        if (!updateRes.rows || updateRes.rows.length === 0) {
          // Quota exhausted!
          throw new Error("QUOTA_EXHAUSTED");
        }
      }
    });

    const playbackUrl = await getMuxSignedPlaybackUrl(video.muxPlaybackId);
    return {
      authorized: true,
      playbackUrl,
      statusCode: 200,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "QUOTA_EXHAUSTED") {
      return {
        authorized: false,
        error: "Este vídeo está temporariamente indisponível.",
        statusCode: 403,
      };
    }

    console.error("[Playback Activation Error]", error);
    return {
      authorized: false,
      error: "Este vídeo está temporariamente indisponível.",
      statusCode: 500,
    };
  }
}
