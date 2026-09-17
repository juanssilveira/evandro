import { db } from "@/db";
import { videos, accountMembers } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getHlsPlaybackUrl } from "@/lib/mux";
import { getActivePlanForUser, getCurrentPeriodKey } from "./access";

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

  // 1. Resolve video by publicId
  const [video] = await db
    .select()
    .from(videos)
    .where(eq(videos.publicId, publicId))
    .limit(1);

  if (!video) {
    return {
      authorized: false,
      error: "Vídeo não encontrado.",
      statusCode: 404,
    };
  }

  if (video.status !== "ready" || !video.muxPlaybackId) {
    return {
      authorized: false,
      error: "Vídeo em processamento ou indisponível.",
      statusCode: 404,
    };
  }

  // 2. Resolve account owner userId
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
      authorized: false,
      error: "Proprietário do vídeo não encontrado.",
      statusCode: 404,
    };
  }

  const ownerUserId = ownerMember.userId;

  // 3. Internal preview exemption: admin previewing own video does not consume quota
  if (isEditorAdmin && adminUserId === ownerUserId) {
    return {
      authorized: true,
      playbackUrl: getHlsPlaybackUrl(video.muxPlaybackId),
      statusCode: 200,
    };
  }

  // 4. Verify owner has active plan
  const activePlan = await getActivePlanForUser(ownerUserId);
  if (!activePlan) {
    return {
      authorized: false,
      error: "Este vídeo está temporariamente indisponível.",
      statusCode: 403,
    };
  }

  const periodKey = getCurrentPeriodKey();
  const maxPlays = activePlan.plan.limits.maxPlaysPerMonth;

  // 5. Atomic transaction: ensure monthly_usage, insert playSession, and atomic increment
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
        VALUES (gen_random_uuid(), ${video.id}, ${ownerUserId}, ${playSessionId}, NOW())
        ON CONFLICT (video_id, play_session_id) DO NOTHING
        RETURNING id
      `);

      const isNewSession = (sessionInsert.rows?.length ?? 0) > 0;

      // Step C: If new session, check limit and increment atomically
      if (isNewSession) {
        const updateRes = await tx.execute(sql`
          UPDATE monthly_usage
          SET plays = plays + 1, updated_at = NOW()
          WHERE user_id = ${ownerUserId}
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

    return {
      authorized: true,
      playbackUrl: getHlsPlaybackUrl(video.muxPlaybackId),
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
