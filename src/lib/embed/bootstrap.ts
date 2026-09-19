import { db } from "@/db";
import {
  videos,
  accounts,
  accountMembers,
  subscriptions,
  monthlyUsage,
  videoPlayerSettings,
  type Video,
  type VideoStatus,
  type VideoProviderName,
  type Account,
} from "@/db/schema";
import { eq, and, or, isNull, gt, desc } from "drizzle-orm";
import { getCurrentPeriodKey } from "@/lib/plans/access";
import { getPlanByCode, PRO_PLAN, type PlanDefinition } from "@/lib/plans/catalog";
import { isAccountActive } from "@/lib/accounts/status";
import { parsePlayerConfig, DEFAULT_PLAYER_CONFIG } from "@/types/player-config";
import {
  getVideoPlaybackUrl,
  getVideoPosterUrl,
  getVideoBackgroundPreviewUrl,
} from "@/lib/video-providers";
import { getAssetPublicUrl } from "@/lib/asset-storage/r2";
import type { EmbedBootstrapResolution, EmbedBootstrapPayload } from "@/types/embed-bootstrap";

export type { EmbedBootstrapResolution, EmbedBootstrapPayload };

/**
 * CANONICAL EMBED ACCESS & BOOTSTRAP RESOLVER
 *
 * Single canonical authority for public embed playback authorization (LOAD gate).
 * Resolves all required data in 1 consolidated DB query without external provider calls.
 *
 * Rules:
 * 1. Video must exist by publicId.
 * 2. Account must exist and be active.
 * 3. Video owner user must exist.
 * 4. Owner must have an active, non-expired subscription.
 * 5. Monthly plays usage must be strictly less than the plan limit (read-only check).
 * 6. Video must be in 'ready' status with a valid playback URL derived locally.
 * 7. NEVER call external provider APIs (Mux / Bunny) during public embed bootstrap.
 */
export async function resolveEmbedBootstrap(
  publicId: string
): Promise<EmbedBootstrapResolution> {
  const startTime = performance.now();

  if (!publicId || typeof publicId !== "string" || !publicId.trim()) {
    const totalDurationMs = Math.round(performance.now() - startTime);
    return {
      authorized: false,
      statusCode: 400,
      error: "Identificador de vídeo inválido.",
      metrics: {
        dbDurationMs: 0,
        accessDurationMs: 0,
        payloadDurationMs: 0,
        totalDurationMs,
      },
    };
  }

  const sanitizedPublicId = publicId.trim();
  const periodKey = getCurrentPeriodKey();
  const now = new Date();

  const dbStartTime = performance.now();

  // 1 single consolidated SQL query resolving all dependencies
  const [row] = await db
    .select({
      // Video fields
      videoId: videos.id,
      publicId: videos.publicId,
      accountId: videos.accountId,
      title: videos.title,
      status: videos.status,
      duration: videos.duration,
      provider: videos.provider,
      providerVideoId: videos.providerVideoId,
      providerPlaybackId: videos.providerPlaybackId,
      providerThumbnailFileName: videos.providerThumbnailFileName,
      backgroundPreviewStatus: videos.backgroundPreviewStatus,
      backgroundPreviewKey: videos.backgroundPreviewKey,
      muxAssetId: videos.muxAssetId,
      muxPlaybackId: videos.muxPlaybackId,
      createdAt: videos.createdAt,

      // Account fields
      accountStatus: accounts.status,

      // Owner fields
      ownerUserId: accountMembers.userId,

      // Active subscription fields
      planCode: subscriptions.planCode,
      subscriptionStatus: subscriptions.status,
      subscriptionExpiresAt: subscriptions.expiresAt,

      // Monthly usage
      playsThisMonth: monthlyUsage.plays,

      // Player config
      rawPlayerConfig: videoPlayerSettings.config,
    })
    .from(videos)
    .leftJoin(accounts, eq(accounts.id, videos.accountId))
    .leftJoin(
      accountMembers,
      and(
        eq(accountMembers.accountId, videos.accountId),
        eq(accountMembers.role, "owner")
      )
    )
    .leftJoin(
      subscriptions,
      and(
        eq(subscriptions.userId, accountMembers.userId),
        eq(subscriptions.status, "active"),
        or(isNull(subscriptions.expiresAt), gt(subscriptions.expiresAt, now))
      )
    )
    .leftJoin(
      monthlyUsage,
      and(
        eq(monthlyUsage.userId, accountMembers.userId),
        eq(monthlyUsage.periodKey, periodKey)
      )
    )
    .leftJoin(videoPlayerSettings, eq(videoPlayerSettings.videoId, videos.id))
    .where(eq(videos.publicId, sanitizedPublicId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  const dbDurationMs = Math.round(performance.now() - dbStartTime);

  const accessStartTime = performance.now();

  // 1. Check if video exists
  if (!row || !row.videoId) {
    const accessDurationMs = Math.round(performance.now() - accessStartTime);
    const totalDurationMs = Math.round(performance.now() - startTime);
    return {
      authorized: false,
      statusCode: 404,
      error: "Vídeo não encontrado.",
      metrics: {
        dbDurationMs,
        accessDurationMs,
        payloadDurationMs: 0,
        totalDurationMs,
      },
    };
  }

  // 2. Check if account is active
  if (!row.accountStatus || !isAccountActive({ status: row.accountStatus as Account["status"] })) {
    const accessDurationMs = Math.round(performance.now() - accessStartTime);
    const totalDurationMs = Math.round(performance.now() - startTime);
    return {
      authorized: false,
      statusCode: 403,
      error: "Este vídeo está temporariamente indisponível.",
      metrics: {
        dbDurationMs,
        accessDurationMs,
        payloadDurationMs: 0,
        totalDurationMs,
      },
    };
  }

  // 3. Check if owner user exists
  if (!row.ownerUserId) {
    const accessDurationMs = Math.round(performance.now() - accessStartTime);
    const totalDurationMs = Math.round(performance.now() - startTime);
    return {
      authorized: false,
      statusCode: 404,
      error: "Proprietário do vídeo não encontrado.",
      metrics: {
        dbDurationMs,
        accessDurationMs,
        payloadDurationMs: 0,
        totalDurationMs,
      },
    };
  }

  // 4. Check if owner has active and valid subscription
  if (!row.planCode || row.subscriptionStatus !== "active") {
    const accessDurationMs = Math.round(performance.now() - accessStartTime);
    const totalDurationMs = Math.round(performance.now() - startTime);
    return {
      authorized: false,
      statusCode: 403,
      error: "Este vídeo está temporariamente indisponível.",
      metrics: {
        dbDurationMs,
        accessDurationMs,
        payloadDurationMs: 0,
        totalDurationMs,
      },
    };
  }

  const activePlan: PlanDefinition = getPlanByCode(row.planCode) || PRO_PLAN;

  // 5. Check monthly plays quota (read-only, no lock / reservation)
  const maxPlays = activePlan.limits.maxPlaysPerMonth;
  const currentPlays = Number(row.playsThisMonth ?? 0);
  if (currentPlays >= maxPlays) {
    const accessDurationMs = Math.round(performance.now() - accessStartTime);
    const totalDurationMs = Math.round(performance.now() - startTime);
    return {
      authorized: false,
      statusCode: 403,
      error: "Este vídeo está temporariamente indisponível.",
      metrics: {
        dbDurationMs,
        accessDurationMs,
        payloadDurationMs: 0,
        totalDurationMs,
      },
    };
  }

  const accessDurationMs = Math.round(performance.now() - accessStartTime);

  const payloadStartTime = performance.now();

  // 6. Check video ready status (NO EXTERNAL PROVIDER CALLS — local derivation only)
  const syntheticVideo: Video = {
    id: row.videoId,
    publicId: row.publicId,
    accountId: row.accountId,
    title: row.title,
    status: row.status as VideoStatus,
    duration: row.duration,
    provider: row.provider as VideoProviderName,
    providerVideoId: row.providerVideoId,
    providerPlaybackId: row.providerPlaybackId,
    providerThumbnailFileName: row.providerThumbnailFileName,
    backgroundPreviewStatus: row.backgroundPreviewStatus as "pending" | "processing" | "ready" | "failed",
    backgroundPreviewKey: row.backgroundPreviewKey,
    muxAssetId: row.muxAssetId,
    muxPlaybackId: row.muxPlaybackId,
    originalFilename: row.title || "video.mp4",
    mimeType: "video/mp4",
    sizeBytes: 0,
    errorMessage: null,
    createdAt: row.createdAt,
    folderId: null,
    providerUploadId: null,
    muxUploadId: null,
    updatedAt: row.createdAt,
  };

  const playbackUrl = getVideoPlaybackUrl(syntheticVideo);
  if (row.status !== "ready" || !playbackUrl) {
    const payloadDurationMs = Math.round(performance.now() - payloadStartTime);
    const totalDurationMs = Math.round(performance.now() - startTime);
    return {
      authorized: false,
      statusCode: 404,
      error: "Vídeo em processamento ou indisponível para reprodução.",
      metrics: {
        dbDurationMs,
        accessDurationMs,
        payloadDurationMs,
        totalDurationMs,
      },
    };
  }

  // Derive poster and background preview URLs
  const posterUrl = getVideoPosterUrl(syntheticVideo);
  let backgroundPreviewUrl =
    syntheticVideo.backgroundPreviewStatus === "ready" && syntheticVideo.backgroundPreviewKey
      ? getAssetPublicUrl(syntheticVideo.backgroundPreviewKey)
      : null;

  if (!backgroundPreviewUrl) {
    backgroundPreviewUrl = getVideoBackgroundPreviewUrl(syntheticVideo);
  }

  // Parse player configuration
  const config = row.rawPlayerConfig
    ? parsePlayerConfig(row.rawPlayerConfig)
    : DEFAULT_PLAYER_CONFIG;

  // Ensure custom thumbnail and pause thumbnail URLs are absolute
  if (config.appearance?.thumbnail?.source === "custom" && config.appearance.thumbnail.customKey) {
    if (!config.appearance.thumbnail.customUrl || config.appearance.thumbnail.customUrl.startsWith("/")) {
      config.appearance.thumbnail.customUrl = getAssetPublicUrl(config.appearance.thumbnail.customKey);
    }
  }
  if (config.appearance?.pauseThumbnail?.customKey) {
    if (!config.appearance.pauseThumbnail.customUrl || config.appearance.pauseThumbnail.customUrl.startsWith("/")) {
      config.appearance.pauseThumbnail.customUrl = getAssetPublicUrl(config.appearance.pauseThumbnail.customKey);
    }
  }

  const payloadDurationMs = Math.round(performance.now() - payloadStartTime);
  const totalDurationMs = Math.round(performance.now() - startTime);

  return {
    authorized: true,
    statusCode: 200,
    data: {
      videoId: row.publicId,
      title: row.title,
      duration: row.duration,
      playbackUrl,
      playback: {
        type: "hls",
        url: playbackUrl,
      },
      posterUrl,
      backgroundPreviewUrl,
      config,
    },
    metrics: {
      dbDurationMs,
      accessDurationMs,
      payloadDurationMs,
      totalDurationMs,
    },
  };
}
