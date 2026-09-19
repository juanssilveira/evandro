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
import { parsePlayerConfig, DEFAULT_PLAYER_CONFIG, type PlayerConfig } from "@/types/player-config";
import {
  getVideoPlaybackUrl,
  getVideoPosterUrl,
  getVideoBackgroundPreviewUrl,
} from "@/lib/video-providers";
import { getAssetPublicUrl } from "@/lib/asset-storage/r2";

export interface EmbedBootstrapResolution {
  authorized: boolean;
  statusCode: number;
  error?: string;
  data?: {
    videoId: string;
    title: string;
    duration: number | null;
    playbackUrl: string;
    playback: {
      type: "hls";
      url: string;
    };
    posterUrl: string | null;
    backgroundPreviewUrl: string | null;
    config: PlayerConfig;
  };
  metrics: {
    dbDurationMs: number;
    totalDurationMs: number;
  };
}

/**
 * Resolves all data required for the public embed player in 1-2 consolidated DB round-trips.
 *
 * Rules:
 * 1. Video must exist by publicId.
 * 2. Account must exist and be active.
 * 3. Video owner user must exist.
 * 4. Owner must have an active, non-expired subscription.
 * 5. Monthly plays usage must be strictly less than the plan limit.
 * 6. Video must be in 'ready' status with a valid playback URL.
 * 7. NEVER call external provider APIs (Mux / Bunny) during public embed bootstrap.
 */
export async function resolveEmbedBootstrap(
  publicId: string
): Promise<EmbedBootstrapResolution> {
  const startTime = performance.now();

  if (!publicId || typeof publicId !== "string" || !publicId.trim()) {
    return {
      authorized: false,
      statusCode: 400,
      error: "Identificador de vídeo inválido.",
      metrics: {
        dbDurationMs: 0,
        totalDurationMs: Math.round(performance.now() - startTime),
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

  // 1. Check if video exists
  if (!row || !row.videoId) {
    return {
      authorized: false,
      statusCode: 404,
      error: "Vídeo não encontrado.",
      metrics: {
        dbDurationMs,
        totalDurationMs: Math.round(performance.now() - startTime),
      },
    };
  }

  // 2. Check if account is active
  if (!row.accountStatus || !isAccountActive({ status: row.accountStatus as Account["status"] })) {
    return {
      authorized: false,
      statusCode: 403,
      error: "Este vídeo está temporariamente indisponível.",
      metrics: {
        dbDurationMs,
        totalDurationMs: Math.round(performance.now() - startTime),
      },
    };
  }

  // 3. Check if owner user exists
  if (!row.ownerUserId) {
    return {
      authorized: false,
      statusCode: 404,
      error: "Proprietário do vídeo não encontrado.",
      metrics: {
        dbDurationMs,
        totalDurationMs: Math.round(performance.now() - startTime),
      },
    };
  }

  // 4. Check if owner has active and valid subscription
  if (!row.planCode || row.subscriptionStatus !== "active") {
    return {
      authorized: false,
      statusCode: 403,
      error: "Este vídeo está temporariamente indisponível.",
      metrics: {
        dbDurationMs,
        totalDurationMs: Math.round(performance.now() - startTime),
      },
    };
  }

  const activePlan: PlanDefinition = getPlanByCode(row.planCode) || PRO_PLAN;

  // 5. Check monthly plays quota
  const maxPlays = activePlan.limits.maxPlaysPerMonth;
  const currentPlays = Number(row.playsThisMonth ?? 0);
  if (currentPlays >= maxPlays) {
    return {
      authorized: false,
      statusCode: 403,
      error: "Este vídeo está temporariamente indisponível.",
      metrics: {
        dbDurationMs,
        totalDurationMs: Math.round(performance.now() - startTime),
      },
    };
  }

  // 6. Check video ready status (NO EXTERNAL PROVIDER CALLS)
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
    return {
      authorized: false,
      statusCode: 404,
      error: "Vídeo em processamento ou indisponível para reprodução.",
      metrics: {
        dbDurationMs,
        totalDurationMs: Math.round(performance.now() - startTime),
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
      totalDurationMs,
    },
  };
}
