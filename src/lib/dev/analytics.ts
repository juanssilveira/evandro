import { db } from "@/db";
import {
  user,
  accounts,
  videos,
  subscriptions,
  playSessions,
  monthlyUsage,
  type VideoStatus,
} from "@/db/schema";
import { eq, and, sql, or, isNull, gt, gte, lt } from "drizzle-orm";
import { assertLocalDevPanelAccess } from "./guard";
import { getCurrentPeriodKey } from "@/lib/plans/access";

export type AnalyticsRange = "7d" | "30d" | "90d";

export function parseAnalyticsRange(rangeStr?: string): AnalyticsRange {
  if (rangeStr === "7d" || rangeStr === "90d") {
    return rangeStr;
  }
  return "30d";
}

export function getRangeDays(range: AnalyticsRange): number {
  switch (range) {
    case "7d":
      return 7;
    case "90d":
      return 90;
    case "30d":
    default:
      return 30;
  }
}

export interface MetricWithDelta {
  current: number;
  previous: number;
  deltaPercent: number | null; // null if previous === 0 or insufficient data
}

export interface ProviderConsumptionMetrics {
  videoCount: number;
  totalSizeBytes: number;
  totalDurationSeconds: number;
  totalPlays: number;
}

export interface PlatformOverviewAnalytics {
  range: AnalyticsRange;
  rangeDays: number;
  kpis: {
    totalUsers: number;
    newUsers: MetricWithDelta;
    activePlanUsers: number;
    noPlanUsers: number;
    totalAccounts: number;
    totalVideos: number;
    uploadsInRange: MetricWithDelta;
    playsInRange: MetricWithDelta;
    playsToday: number;
    totalMediaSizeBytes: number;
    totalDurationSeconds: number;
  };
  consumption: {
    totalVideos: number;
    videoStatusCounts: Record<VideoStatus, number>;
    totalMediaSizeBytes: number;
    totalDurationSeconds: number;
    totalMonthlyPlays: number;
    providers: {
      mux: ProviderConsumptionMetrics;
      bunny: ProviderConsumptionMetrics;
    };
  };
  dailyPlays: Array<{
    date: string; // YYYY-MM-DD
    plays: number;
  }>;
  growthSeries: Array<{
    date: string; // YYYY-MM-DD
    newUsers: number;
    uploads: number;
  }>;
}

function calculateDelta(current: number, previous: number): number | null {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }
  const diff = current - previous;
  return Math.round((diff / previous) * 1000) / 10;
}

function generateDateKeys(startDate: Date, days: number): string[] {
  const keys: string[] = [];
  const current = new Date(startDate.getTime());
  for (let i = 0; i < days; i++) {
    keys.push(current.toISOString().split("T")[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return keys;
}

/**
 * Executes high-performance SQL aggregations to build the operational overview analytics.
 */
export async function getDevPlatformOverviewAnalytics(
  rangeInput?: string
): Promise<PlatformOverviewAnalytics> {
  await assertLocalDevPanelAccess();

  const range = parseAnalyticsRange(rangeInput);
  const days = getRangeDays(range);

  const now = new Date();
  const currentPeriodKey = getCurrentPeriodKey(now);

  // Time boundaries
  const currentPeriodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousPeriodStart = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000);

  // Start of today (UTC)
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

  // 1. Total users and accounts
  const [usersCountRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(user);
  const totalUsers = usersCountRes?.count ?? 0;

  const [accountsCountRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(accounts);
  const totalAccounts = accountsCountRes?.count ?? 0;

  // 2. Active plan users
  const [activePlanRes] = await db
    .select({ count: sql<number>`count(distinct ${subscriptions.userId})::int` })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "active"),
        or(isNull(subscriptions.expiresAt), gt(subscriptions.expiresAt, now))
      )
    );
  const activePlanUsers = activePlanRes?.count ?? 0;
  const noPlanUsers = Math.max(0, totalUsers - activePlanUsers);

  // 3. New users: current range vs previous range
  const [newUsersCurrentRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(user)
    .where(gte(user.createdAt, currentPeriodStart));
  const newUsersCurrent = newUsersCurrentRes?.count ?? 0;

  const [newUsersPreviousRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(user)
    .where(
      and(
        gte(user.createdAt, previousPeriodStart),
        lt(user.createdAt, currentPeriodStart)
      )
    );
  const newUsersPrevious = newUsersPreviousRes?.count ?? 0;

  // 4. Video uploads: current range vs previous range
  const [uploadsCurrentRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videos)
    .where(gte(videos.createdAt, currentPeriodStart));
  const uploadsCurrent = uploadsCurrentRes?.count ?? 0;

  const [uploadsPreviousRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videos)
    .where(
      and(
        gte(videos.createdAt, previousPeriodStart),
        lt(videos.createdAt, currentPeriodStart)
      )
    );
  const uploadsPrevious = uploadsPreviousRes?.count ?? 0;

  // 5. Plays in range & deltas from play_sessions
  const [playsCurrentRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(playSessions)
    .where(gte(playSessions.createdAt, currentPeriodStart));
  const playsCurrent = playsCurrentRes?.count ?? 0;

  const [playsPreviousRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(playSessions)
    .where(
      and(
        gte(playSessions.createdAt, previousPeriodStart),
        lt(playSessions.createdAt, currentPeriodStart)
      )
    );
  const playsPrevious = playsPreviousRes?.count ?? 0;

  // 6. Plays today
  const [playsTodayRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(playSessions)
    .where(gte(playSessions.createdAt, todayStart));
  const playsToday = playsTodayRes?.count ?? 0;

  // 7. Overall video stats & provider breakdown
  const videoAggs = await db
    .select({
      provider: videos.provider,
      status: videos.status,
      count: sql<number>`count(*)::int`,
      totalSize: sql<number>`coalesce(sum(${videos.sizeBytes}), 0)::bigint`,
      totalDuration: sql<number>`coalesce(sum(${videos.duration}), 0)::real`,
    })
    .from(videos)
    .groupBy(videos.provider, videos.status);

  let totalVideos = 0;
  let totalMediaSizeBytes = 0;
  let totalDurationSeconds = 0;
  const videoStatusCounts: Record<VideoStatus, number> = {
    waiting_upload: 0,
    uploading: 0,
    processing: 0,
    ready: 0,
    errored: 0,
  };

  const providerStats: Record<"mux" | "bunny", {
    videoCount: number;
    totalSizeBytes: number;
    totalDurationSeconds: number;
    totalPlays: number;
  }> = {
    mux: { videoCount: 0, totalSizeBytes: 0, totalDurationSeconds: 0, totalPlays: 0 },
    bunny: { videoCount: 0, totalSizeBytes: 0, totalDurationSeconds: 0, totalPlays: 0 },
  };

  for (const row of videoAggs) {
    const prov = (row.provider === "bunny" ? "bunny" : "mux") as "mux" | "bunny";
    const st = row.status as VideoStatus;
    const cnt = Number(row.count || 0);
    const size = Number(row.totalSize || 0);
    const dur = Number(row.totalDuration || 0);

    totalVideos += cnt;
    totalMediaSizeBytes += size;
    totalDurationSeconds += dur;

    if (videoStatusCounts[st] !== undefined) {
      videoStatusCounts[st] += cnt;
    }

    providerStats[prov].videoCount += cnt;
    providerStats[prov].totalSizeBytes += size;
    providerStats[prov].totalDurationSeconds += dur;
  }

  // 8. Plays per provider (all-time or monthly from play_sessions joined with videos)
  const playsByProviderRes = await db
    .select({
      provider: videos.provider,
      plays: sql<number>`count(*)::int`,
    })
    .from(playSessions)
    .innerJoin(videos, eq(playSessions.videoId, videos.id))
    .groupBy(videos.provider);

  for (const row of playsByProviderRes) {
    const prov = (row.provider === "bunny" ? "bunny" : "mux") as "mux" | "bunny";
    providerStats[prov].totalPlays = Number(row.plays || 0);
  }

  // Total monthly plays across accounts
  const [monthlyPlaysRes] = await db
    .select({ totalPlays: sql<number>`coalesce(sum(${monthlyUsage.plays}), 0)::int` })
    .from(monthlyUsage)
    .where(eq(monthlyUsage.periodKey, currentPeriodKey));
  const totalMonthlyPlays = monthlyPlaysRes?.totalPlays ?? 0;

  // 9. Daily Plays time series via PostgreSQL DATE_TRUNC
  const dailyPlaysRows = await db
    .select({
      dayStr: sql<string>`to_char(date_trunc('day', ${playSessions.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(playSessions)
    .where(gte(playSessions.createdAt, currentPeriodStart))
    .groupBy(sql`date_trunc('day', ${playSessions.createdAt})`)
    .orderBy(sql`date_trunc('day', ${playSessions.createdAt})`);

  const dailyPlaysMap = new Map<string, number>();
  for (const r of dailyPlaysRows) {
    dailyPlaysMap.set(r.dayStr, Number(r.count || 0));
  }

  // 10. Growth series (new users & uploads by day)
  const dailyUsersRows = await db
    .select({
      dayStr: sql<string>`to_char(date_trunc('day', ${user.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(user)
    .where(gte(user.createdAt, currentPeriodStart))
    .groupBy(sql`date_trunc('day', ${user.createdAt})`);

  const dailyUsersMap = new Map<string, number>();
  for (const r of dailyUsersRows) {
    dailyUsersMap.set(r.dayStr, Number(r.count || 0));
  }

  const dailyUploadsRows = await db
    .select({
      dayStr: sql<string>`to_char(date_trunc('day', ${videos.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(videos)
    .where(gte(videos.createdAt, currentPeriodStart))
    .groupBy(sql`date_trunc('day', ${videos.createdAt})`);

  const dailyUploadsMap = new Map<string, number>();
  for (const r of dailyUploadsRows) {
    dailyUploadsMap.set(r.dayStr, Number(r.count || 0));
  }

  // Build continuous zero-filled daily buckets
  const allDateKeys = generateDateKeys(currentPeriodStart, days);
  const dailyPlays = allDateKeys.map((date) => ({
    date,
    plays: dailyPlaysMap.get(date) || 0,
  }));

  const growthSeries = allDateKeys.map((date) => ({
    date,
    newUsers: dailyUsersMap.get(date) || 0,
    uploads: dailyUploadsMap.get(date) || 0,
  }));

  return {
    range,
    rangeDays: days,
    kpis: {
      totalUsers,
      newUsers: {
        current: newUsersCurrent,
        previous: newUsersPrevious,
        deltaPercent: calculateDelta(newUsersCurrent, newUsersPrevious),
      },
      activePlanUsers,
      noPlanUsers,
      totalAccounts,
      totalVideos,
      uploadsInRange: {
        current: uploadsCurrent,
        previous: uploadsPrevious,
        deltaPercent: calculateDelta(uploadsCurrent, uploadsPrevious),
      },
      playsInRange: {
        current: playsCurrent,
        previous: playsPrevious,
        deltaPercent: calculateDelta(playsCurrent, playsPrevious),
      },
      playsToday,
      totalMediaSizeBytes,
      totalDurationSeconds,
    },
    consumption: {
      totalVideos,
      videoStatusCounts,
      totalMediaSizeBytes,
      totalDurationSeconds,
      totalMonthlyPlays,
      providers: providerStats,
    },
    dailyPlays,
    growthSeries,
  };
}
