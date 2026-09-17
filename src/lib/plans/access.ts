import { db } from "@/db";
import {
  subscriptions,
  monthlyUsage,
  playSessions,
  videos,
  type Subscription,
} from "@/db/schema";
import { eq, and, desc, sql, inArray, or, isNull, gt } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getCurrentAccount } from "@/lib/accounts";
import { getPlanByCode, PRO_PLAN, type PlanDefinition } from "./catalog";

export interface ActivePlanContext {
  subscription: Subscription;
  plan: PlanDefinition;
}

export interface PlanUsageStats {
  plan: PlanDefinition | null;
  subscription: Subscription | null;
  videoCount: number;
  maxVideos: number;
  playsThisMonth: number;
  maxPlays: number;
  periodKey: string;
}

export const SLOT_OCCUPYING_STATUSES = [
  "waiting_upload",
  "uploading",
  "processing",
  "ready",
] as const;

export function getCurrentPeriodKey(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}`;
}

export async function getActiveSubscription(
  userId: string
): Promise<Subscription | null> {
  const now = new Date();
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active"),
        or(
          isNull(subscriptions.expiresAt),
          gt(subscriptions.expiresAt, now)
        )
      )
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  return sub || null;
}

export async function getActivePlanForUser(
  userId: string
): Promise<ActivePlanContext | null> {
  const subscription = await getActiveSubscription(userId);
  if (!subscription) {
    return null;
  }

  const plan = getPlanByCode(subscription.planCode) || PRO_PLAN;
  return {
    subscription,
    plan,
  };
}

export async function requireActivePlanForUser(
  userId: string
): Promise<ActivePlanContext> {
  const activePlan = await getActivePlanForUser(userId);
  if (!activePlan) {
    throw new Error("NO_ACTIVE_PLAN");
  }
  return activePlan;
}

export async function requireActivePlan(customHeaders?: Headers) {
  const { headers: nextHeaders } = await import("next/headers");
  const resolvedHeaders = customHeaders || (await nextHeaders());

  const session = await auth.api.getSession({
    headers: resolvedHeaders,
  });

  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }

  const account = await getCurrentAccount(session.user.id);
  if (!account) {
    throw new Error("ACCOUNT_NOT_FOUND");
  }

  const activePlan = await getActivePlanForUser(session.user.id);
  if (!activePlan) {
    throw new Error("NO_ACTIVE_PLAN");
  }

  return {
    session,
    account,
    subscription: activePlan.subscription,
    plan: activePlan.plan,
  };
}

export async function getPlanUsage(
  userId: string,
  accountId: string
): Promise<PlanUsageStats> {
  const activePlan = await getActivePlanForUser(userId);
  const periodKey = getCurrentPeriodKey();

  // Count slot-occupying videos for account
  const [videoCountRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videos)
    .where(
      and(
        eq(videos.accountId, accountId),
        inArray(videos.status, [...SLOT_OCCUPYING_STATUSES])
      )
    );

  const videoCount = videoCountRes?.count ?? 0;

  // Query plays this month
  const [usageRes] = await db
    .select({ plays: monthlyUsage.plays })
    .from(monthlyUsage)
    .where(
      and(
        eq(monthlyUsage.userId, userId),
        eq(monthlyUsage.periodKey, periodKey)
      )
    )
    .limit(1);

  const playsThisMonth = usageRes?.plays ?? 0;

  return {
    plan: activePlan?.plan ?? null,
    subscription: activePlan?.subscription ?? null,
    videoCount,
    maxVideos: activePlan?.plan?.limits.maxVideos ?? PRO_PLAN.limits.maxVideos,
    playsThisMonth,
    maxPlays: activePlan?.plan?.limits.maxPlaysPerMonth ?? PRO_PLAN.limits.maxPlaysPerMonth,
    periodKey,
  };
}

export async function getVideoPlaysMapThisMonth(
  videoIds: string[],
  periodKey = getCurrentPeriodKey()
): Promise<Record<string, number>> {
  if (videoIds.length === 0) return {};

  const [year, month] = periodKey.split("-").map(Number);
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const startOfNextMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  const results = await db
    .select({
      videoId: playSessions.videoId,
      count: sql<number>`count(*)::int`,
    })
    .from(playSessions)
    .where(
      and(
        inArray(playSessions.videoId, videoIds),
        sql`${playSessions.createdAt} >= ${startOfMonth}`,
        sql`${playSessions.createdAt} < ${startOfNextMonth}`
      )
    )
    .groupBy(playSessions.videoId);

  const map: Record<string, number> = {};
  for (const row of results) {
    map[row.videoId] = Number(row.count ?? 0);
  }
  return map;
}
