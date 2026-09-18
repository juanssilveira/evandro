import { videos, playSessions, type VideoStatus } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import Mux from "@mux/mux-node";
import type { VideoProvidersConfigurationStatus } from "@/lib/video-providers";
import { assertLocalDevPanelAccess } from "./guard";
import { getAdminDb } from "./db";
import { getAdminEnvironmentConfig, type AdminEnvironment, type AdminInfraConfig } from "./env-config";

export interface ProviderLocalStats {
  videoCount: number;
  readyCount: number;
  processingCount: number;
  erroredCount: number;
  totalSizeBytes: number;
  totalDurationSeconds: number;
  totalPlays: number;
}

export interface MuxExternalStats {
  available: boolean;
  error?: string;
  totalAssets?: number;
  totalStoredDurationSeconds?: number;
  deliveredMinutes?: number;
  deliveredSeconds?: number;
  resolutionTierBreakdown?: Record<string, { count: number; durationSeconds: number }>;
  lastCheckedAt?: Date;
}

export interface BunnyExternalStats {
  available: boolean;
  error?: string;
  videoCount?: number;
  trafficUsageBytes?: number;
  storageUsageBytes?: number;
  lastCheckedAt?: Date;
}

export interface VideoInfraFullReport {
  currentProvider: "mux" | "bunny";
  configStatus: VideoProvidersConfigurationStatus;
  localStats: {
    mux: ProviderLocalStats;
    bunny: ProviderLocalStats;
    total: ProviderLocalStats;
  };
  distribution: {
    muxPercent: number;
    bunnyPercent: number;
  };
  external: {
    mux: MuxExternalStats;
    bunny: BunnyExternalStats;
  };
  cachedAt: Date;
}

// In-memory short TTL cache (90 seconds) separated by environment
const cachedReports: Record<AdminEnvironment, { report: VideoInfraFullReport; timestamp: number } | null> = {
  development: null,
  production: null,
};
const CACHE_TTL_MS = 90 * 1000;

export function invalidateVideoInfraCache(env?: AdminEnvironment) {
  if (env) {
    cachedReports[env] = null;
  } else {
    cachedReports.development = null;
    cachedReports.production = null;
  }
}

export function getProviderConfigurationStatusForConfig(
  config: AdminInfraConfig
): VideoProvidersConfigurationStatus {
  const isMuxConfigured = Boolean(
    config.MUX_TOKEN_ID &&
    config.MUX_TOKEN_ID.trim().length > 0 &&
    config.MUX_TOKEN_SECRET &&
    config.MUX_TOKEN_SECRET.trim().length > 0
  );

  const isBunnyConfigured = Boolean(
    config.BUNNY_STREAM_LIBRARY_ID &&
    config.BUNNY_STREAM_LIBRARY_ID.trim().length > 0 &&
    config.BUNNY_STREAM_API_KEY &&
    config.BUNNY_STREAM_API_KEY.trim().length > 0 &&
    config.BUNNY_STREAM_CDN_HOSTNAME &&
    config.BUNNY_STREAM_CDN_HOSTNAME.trim().length > 0
  );

  return {
    mux: {
      configured: isMuxConfigured,
    },
    bunny: {
      configured: isBunnyConfigured,
    },
  };
}

export async function fetchMuxExternalStats(
  config: AdminInfraConfig
): Promise<MuxExternalStats> {
  const status = getProviderConfigurationStatusForConfig(config);
  if (!status.mux.configured || !config.MUX_TOKEN_ID || !config.MUX_TOKEN_SECRET) {
    return {
      available: false,
      error: "Credenciais do Mux incompletas no ambiente selecionado.",
    };
  }

  try {
    const mux = new Mux({
      tokenId: config.MUX_TOKEN_ID,
      tokenSecret: config.MUX_TOKEN_SECRET,
    });

    // 1. List assets (up to 100) to calculate assets count, duration & resolution tiers
    const assetsPage = await mux.video.assets.list({ limit: 100 });
    const assetsList = assetsPage.data || [];
    let totalStoredDurationSeconds = 0;
    const resolutionTierBreakdown: Record<string, { count: number; durationSeconds: number }> = {};

    for (const asset of assetsList) {
      const dur = typeof asset.duration === "number" ? asset.duration : 0;
      totalStoredDurationSeconds += dur;

      const tier = (asset.resolution_tier as string) || "standard";
      if (!resolutionTierBreakdown[tier]) {
        resolutionTierBreakdown[tier] = { count: 0, durationSeconds: 0 };
      }
      resolutionTierBreakdown[tier].count++;
      resolutionTierBreakdown[tier].durationSeconds += dur;
    }

    // 2. Query delivery usage (last 30 days)
    let deliveredSeconds = 0;
    try {
      const nowEpoch = Math.floor(Date.now() / 1000);
      const startEpoch = nowEpoch - 30 * 24 * 60 * 60;
      const deliveryPage = await mux.video.deliveryUsage.list({
        timeframe: [String(startEpoch), String(nowEpoch)],
        limit: 100,
      });
      const deliveryList = deliveryPage.data || [];

      for (const item of deliveryList) {
        deliveredSeconds += Number(item.delivered_seconds || 0);
      }
    } catch (delErr) {
      console.warn("[Mux Observability] Delivery Usage API warning:", delErr);
    }

    return {
      available: true,
      totalAssets: assetsList.length,
      totalStoredDurationSeconds,
      deliveredSeconds,
      deliveredMinutes: Math.round((deliveredSeconds / 60) * 10) / 10,
      resolutionTierBreakdown,
      lastCheckedAt: new Date(),
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Erro ao consultar API do Mux";
    console.error("[Mux Observability] External query error:", error);
    return {
      available: false,
      error: errorMsg,
      lastCheckedAt: new Date(),
    };
  }
}

export async function fetchBunnyExternalStats(
  config: AdminInfraConfig
): Promise<BunnyExternalStats> {
  const status = getProviderConfigurationStatusForConfig(config);
  if (!status.bunny.configured || !config.BUNNY_STREAM_LIBRARY_ID) {
    return {
      available: false,
      error: "Credenciais do Bunny Stream incompletas no ambiente selecionado.",
    };
  }

  const accountApiKey = config.BUNNY_ACCOUNT_API_KEY;
  if (!accountApiKey || accountApiKey.trim().length === 0) {
    return {
      available: false,
      error: "BUNNY_ACCOUNT_API_KEY não configurada. Métricas de conta Bunny indisponíveis.",
      lastCheckedAt: new Date(),
    };
  }

  try {
    const libraryId = config.BUNNY_STREAM_LIBRARY_ID;
    const response = await fetch(`https://api.bunny.net/videolibrary/${libraryId}`, {
      method: "GET",
      headers: {
        AccessKey: accountApiKey.trim(),
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return {
        available: false,
        error: `Bunny Account API status ${response.status}: ${errText || response.statusText}`,
        lastCheckedAt: new Date(),
      };
    }

    const data = (await response.json()) as {
      VideoCount?: number;
      TrafficUsage?: number;
      StorageUsage?: number;
    };

    return {
      available: true,
      videoCount: data.VideoCount ?? 0,
      trafficUsageBytes: data.TrafficUsage ?? 0,
      storageUsageBytes: data.StorageUsage ?? 0,
      lastCheckedAt: new Date(),
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Erro ao consultar API do Bunny";
    console.error("[Bunny Observability] External query error:", error);
    return {
      available: false,
      error: errorMsg,
      lastCheckedAt: new Date(),
    };
  }
}

export async function getVideoInfraFullReport(
  env: AdminEnvironment,
  forceRefresh = false
): Promise<VideoInfraFullReport> {
  await assertLocalDevPanelAccess();

  const now = Date.now();
  const cached = cachedReports[env];
  if (!forceRefresh && cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.report;
  }

  const adminDb = getAdminDb(env);
  const config = getAdminEnvironmentConfig(env);

  const { getDefaultVideoProviderSetting } = await import("@/lib/settings/app-settings");
  const currentProvider = await getDefaultVideoProviderSetting(adminDb);
  const configStatus = getProviderConfigurationStatusForConfig(config);

  // 1. Local WatchMap DB aggregation by provider for the selected environment
  const videoAggs = await adminDb
    .select({
      provider: videos.provider,
      status: videos.status,
      count: sql<number>`count(*)::int`,
      totalSize: sql<number>`coalesce(sum(${videos.sizeBytes}), 0)::bigint`,
      totalDuration: sql<number>`coalesce(sum(${videos.duration}), 0)::real`,
    })
    .from(videos)
    .groupBy(videos.provider, videos.status);

  const localStats: Record<"mux" | "bunny", ProviderLocalStats> = {
    mux: { videoCount: 0, readyCount: 0, processingCount: 0, erroredCount: 0, totalSizeBytes: 0, totalDurationSeconds: 0, totalPlays: 0 },
    bunny: { videoCount: 0, readyCount: 0, processingCount: 0, erroredCount: 0, totalSizeBytes: 0, totalDurationSeconds: 0, totalPlays: 0 },
  };

  for (const row of videoAggs) {
    const p = (row.provider === "bunny" ? "bunny" : "mux") as "mux" | "bunny";
    const st = row.status as VideoStatus;
    const cnt = Number(row.count || 0);
    const size = Number(row.totalSize || 0);
    const dur = Number(row.totalDuration || 0);

    localStats[p].videoCount += cnt;
    localStats[p].totalSizeBytes += size;
    localStats[p].totalDurationSeconds += dur;

    if (st === "ready") {
      localStats[p].readyCount += cnt;
    } else if (st === "errored") {
      localStats[p].erroredCount += cnt;
    } else {
      localStats[p].processingCount += cnt;
    }
  }

  // Plays per provider from play_sessions
  const playsByProv = await adminDb
    .select({
      provider: videos.provider,
      plays: sql<number>`count(*)::int`,
    })
    .from(playSessions)
    .innerJoin(videos, eq(playSessions.videoId, videos.id))
    .groupBy(videos.provider);

  for (const row of playsByProv) {
    const p = (row.provider === "bunny" ? "bunny" : "mux") as "mux" | "bunny";
    localStats[p].totalPlays = Number(row.plays || 0);
  }

  const totalLocal: ProviderLocalStats = {
    videoCount: localStats.mux.videoCount + localStats.bunny.videoCount,
    readyCount: localStats.mux.readyCount + localStats.bunny.readyCount,
    processingCount: localStats.mux.processingCount + localStats.bunny.processingCount,
    erroredCount: localStats.mux.erroredCount + localStats.bunny.erroredCount,
    totalSizeBytes: localStats.mux.totalSizeBytes + localStats.bunny.totalSizeBytes,
    totalDurationSeconds: localStats.mux.totalDurationSeconds + localStats.bunny.totalDurationSeconds,
    totalPlays: localStats.mux.totalPlays + localStats.bunny.totalPlays,
  };

  const totalVids = totalLocal.videoCount;
  const muxPercent = totalVids > 0 ? Math.round((localStats.mux.videoCount / totalVids) * 100) : 0;
  const bunnyPercent = totalVids > 0 ? 100 - muxPercent : 0;

  // 2. Fetch external stats concurrently
  const [muxExternal, bunnyExternal] = await Promise.all([
    fetchMuxExternalStats(config),
    fetchBunnyExternalStats(config),
  ]);

  const report: VideoInfraFullReport = {
    currentProvider,
    configStatus,
    localStats: {
      mux: localStats.mux,
      bunny: localStats.bunny,
      total: totalLocal,
    },
    distribution: {
      muxPercent,
      bunnyPercent,
    },
    external: {
      mux: muxExternal,
      bunny: bunnyExternal,
    },
    cachedAt: new Date(),
  };

  cachedReports[env] = { report, timestamp: now };

  return report;
}
