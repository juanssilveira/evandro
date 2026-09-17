import { db } from "@/db";
import {
  user,
  accounts,
  accountMembers,
  videos,
  subscriptions,
  redeemCodes,
  monthlyUsage,
  type Subscription,
  type VideoStatus,
} from "@/db/schema";
import { eq, and, sql, desc, or, isNull, gt, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getCurrentPeriodKey, SLOT_OCCUPYING_STATUSES } from "@/lib/plans/access";
import { createRedeemCode, type CreateRedeemCodeResult } from "@/lib/plans/redeem";
import { assertLocalDevPanelAccess } from "./guard";

export interface OverviewMetrics {
  totalUsers: number;
  totalAccounts: number;
  activePlanUsers: number;
  noPlanUsers: number;
  totalVideos: number;
  videoStatusCounts: Record<VideoStatus, number>;
  totalMonthlyPlays: number;
  totalMediaSizeBytes: number;
  totalDurationSeconds: number;
}

export interface AccountUsageRow {
  accountId: string;
  accountName: string;
  primaryEmail: string;
  primaryUserName: string;
  planCode: string;
  subscriptionStatus: "active" | "inactive" | "none";
  expiresAt: Date | null;
  videoCount: number;
  playsThisMonth: number;
  totalMediaSizeBytes: number;
  totalDurationSeconds: number;
}

export interface DevUserRow {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  accountId: string | null;
  accountName: string | null;
  planCode: string;
  subscriptionStatus: "active" | "inactive" | "none";
  expiresAt: Date | null;
  videoCount: number;
  playsThisMonth: number;
}

export interface DevRedeemCodeRow {
  id: string;
  planCode: string;
  durationDays: number;
  createdAt: Date;
  usedAt: Date | null;
  usedByUser: {
    id: string;
    name: string;
    email: string;
  } | null;
}

/**
 * Loads all high-level overview metrics for the dev panel.
 */
export async function getDevOverviewMetrics(): Promise<OverviewMetrics> {
  await assertLocalDevPanelAccess();

  const now = new Date();
  const periodKey = getCurrentPeriodKey();

  // 1. Total users
  const [usersCountRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(user);
  const totalUsers = usersCountRes?.count ?? 0;

  // 2. Total accounts
  const [accountsCountRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(accounts);
  const totalAccounts = accountsCountRes?.count ?? 0;

  // 3. Active plan users (distinct users with active, unexpired subscription)
  const [activePlanRes] = await db
    .select({ count: sql<number>`count(distinct ${subscriptions.userId})::int` })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "active"),
        or(
          isNull(subscriptions.expiresAt),
          gt(subscriptions.expiresAt, now)
        )
      )
    );
  const activePlanUsers = activePlanRes?.count ?? 0;
  const noPlanUsers = Math.max(0, totalUsers - activePlanUsers);

  // 4. Video metrics & status breakdown
  const videoRows = await db
    .select({
      status: videos.status,
      sizeBytes: videos.sizeBytes,
      duration: videos.duration,
    })
    .from(videos);

  const videoStatusCounts: Record<VideoStatus, number> = {
    waiting_upload: 0,
    uploading: 0,
    processing: 0,
    ready: 0,
    errored: 0,
  };

  let totalMediaSizeBytes = 0;
  let totalDurationSeconds = 0;

  for (const v of videoRows) {
    const status = v.status as VideoStatus;
    if (videoStatusCounts[status] !== undefined) {
      videoStatusCounts[status]++;
    }
    totalMediaSizeBytes += Number(v.sizeBytes || 0);
    totalDurationSeconds += Number(v.duration || 0);
  }

  const totalVideos = videoRows.length;

  // 5. Total Plays in current month across all accounts
  const [playsRes] = await db
    .select({ totalPlays: sql<number>`coalesce(sum(${monthlyUsage.plays}), 0)::int` })
    .from(monthlyUsage)
    .where(eq(monthlyUsage.periodKey, periodKey));
  const totalMonthlyPlays = playsRes?.totalPlays ?? 0;

  return {
    totalUsers,
    totalAccounts,
    activePlanUsers,
    noPlanUsers,
    totalVideos,
    videoStatusCounts,
    totalMonthlyPlays,
    totalMediaSizeBytes,
    totalDurationSeconds,
  };
}

/**
 * Loads the account usage breakdown table for the dev panel.
 */
export async function getDevAccountUsageList(): Promise<AccountUsageRow[]> {
  await assertLocalDevPanelAccess();

  const now = new Date();
  const periodKey = getCurrentPeriodKey();

  // Query accounts with their primary member/user
  const accountsData = await db
    .select({
      accountId: accounts.id,
      accountName: accounts.name,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      role: accountMembers.role,
    })
    .from(accounts)
    .leftJoin(accountMembers, eq(accounts.id, accountMembers.accountId))
    .leftJoin(user, eq(accountMembers.userId, user.id))
    .orderBy(desc(accounts.createdAt));

  // Consolidate per account (picking owner if multiple members)
  const accountMap = new Map<string, {
    accountId: string;
    accountName: string;
    userId: string;
    userName: string;
    userEmail: string;
  }>();

  for (const row of accountsData) {
    if (!accountMap.has(row.accountId) || row.role === "owner") {
      accountMap.set(row.accountId, {
        accountId: row.accountId,
        accountName: row.accountName,
        userId: row.userId || "",
        userName: row.userName || "—",
        userEmail: row.userEmail || "—",
      });
    }
  }

  const accountIds = Array.from(accountMap.keys());
  if (accountIds.length === 0) return [];

  // Query video stats per account
  const videoStats = await db
    .select({
      accountId: videos.accountId,
      count: sql<number>`count(*)::int`,
      totalSize: sql<number>`coalesce(sum(${videos.sizeBytes}), 0)::bigint`,
      totalDuration: sql<number>`coalesce(sum(${videos.duration}), 0)::real`,
    })
    .from(videos)
    .where(
      and(
        inArray(videos.accountId, accountIds),
        inArray(videos.status, [...SLOT_OCCUPYING_STATUSES])
      )
    )
    .groupBy(videos.accountId);

  const videoStatsMap = new Map<string, { count: number; totalSize: number; totalDuration: number }>();
  for (const vs of videoStats) {
    videoStatsMap.set(vs.accountId, {
      count: Number(vs.count || 0),
      totalSize: Number(vs.totalSize || 0),
      totalDuration: Number(vs.totalDuration || 0),
    });
  }

  // Query active subscriptions for all users involved
  const userIds = Array.from(accountMap.values()).map((a) => a.userId).filter(Boolean);
  const subscriptionsMap = new Map<string, Subscription>();
  if (userIds.length > 0) {
    const subs = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          inArray(subscriptions.userId, userIds),
          eq(subscriptions.status, "active"),
          or(
            isNull(subscriptions.expiresAt),
            gt(subscriptions.expiresAt, now)
          )
        )
      )
      .orderBy(desc(subscriptions.createdAt));

    for (const sub of subs) {
      if (!subscriptionsMap.has(sub.userId)) {
        subscriptionsMap.set(sub.userId, sub);
      }
    }
  }

  // Query monthly usage for all users
  const usageMap = new Map<string, number>();
  if (userIds.length > 0) {
    const usages = await db
      .select({
        userId: monthlyUsage.userId,
        plays: monthlyUsage.plays,
      })
      .from(monthlyUsage)
      .where(
        and(
          inArray(monthlyUsage.userId, userIds),
          eq(monthlyUsage.periodKey, periodKey)
        )
      );

    for (const u of usages) {
      usageMap.set(u.userId, Number(u.plays || 0));
    }
  }

  const rows: AccountUsageRow[] = [];
  for (const item of accountMap.values()) {
    const vStat = videoStatsMap.get(item.accountId) || { count: 0, totalSize: 0, totalDuration: 0 };
    const sub = item.userId ? subscriptionsMap.get(item.userId) : null;
    const plays = item.userId ? (usageMap.get(item.userId) || 0) : 0;

    rows.push({
      accountId: item.accountId,
      accountName: item.accountName,
      primaryEmail: item.userEmail,
      primaryUserName: item.userName,
      planCode: sub ? sub.planCode : "none",
      subscriptionStatus: sub ? "active" : "none",
      expiresAt: sub?.expiresAt || null,
      videoCount: vStat.count,
      playsThisMonth: plays,
      totalMediaSizeBytes: vStat.totalSize,
      totalDurationSeconds: vStat.totalDuration,
    });
  }

  return rows;
}

/**
 * Loads all users for the Dev Users tab.
 */
export async function getDevUsersList(): Promise<DevUserRow[]> {
  await assertLocalDevPanelAccess();

  const now = new Date();
  const periodKey = getCurrentPeriodKey();

  const usersData = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      accountId: accounts.id,
      accountName: accounts.name,
    })
    .from(user)
    .leftJoin(accountMembers, eq(user.id, accountMembers.userId))
    .leftJoin(accounts, eq(accountMembers.accountId, accounts.id))
    .orderBy(desc(user.createdAt));

  // Deduplicate users (in case of multiple account memberships)
  const userMap = new Map<string, typeof usersData[0]>();
  for (const u of usersData) {
    if (!userMap.has(u.id)) {
      userMap.set(u.id, u);
    }
  }

  const userIds = Array.from(userMap.keys());
  if (userIds.length === 0) return [];

  // Query subscriptions
  const subs = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        inArray(subscriptions.userId, userIds),
        eq(subscriptions.status, "active"),
        or(
          isNull(subscriptions.expiresAt),
          gt(subscriptions.expiresAt, now)
        )
      )
    )
    .orderBy(desc(subscriptions.createdAt));

  const subsMap = new Map<string, Subscription>();
  for (const s of subs) {
    if (!subsMap.has(s.userId)) {
      subsMap.set(s.userId, s);
    }
  }

  // Query account video counts
  const accountIds = Array.from(userMap.values())
    .map((u) => u.accountId)
    .filter(Boolean) as string[];

  const videoCountsMap = new Map<string, number>();
  if (accountIds.length > 0) {
    const vCounts = await db
      .select({
        accountId: videos.accountId,
        count: sql<number>`count(*)::int`,
      })
      .from(videos)
      .where(
        and(
          inArray(videos.accountId, accountIds),
          inArray(videos.status, [...SLOT_OCCUPYING_STATUSES])
        )
      )
      .groupBy(videos.accountId);

    for (const vc of vCounts) {
      videoCountsMap.set(vc.accountId, Number(vc.count || 0));
    }
  }

  // Query monthly plays
  const usageMap = new Map<string, number>();
  const usages = await db
    .select({
      userId: monthlyUsage.userId,
      plays: monthlyUsage.plays,
    })
    .from(monthlyUsage)
    .where(
      and(
        inArray(monthlyUsage.userId, userIds),
        eq(monthlyUsage.periodKey, periodKey)
      )
    );

  for (const u of usages) {
    usageMap.set(u.userId, Number(u.plays || 0));
  }

  const rows: DevUserRow[] = [];
  for (const u of userMap.values()) {
    const sub = subsMap.get(u.id);
    const videoCount = u.accountId ? (videoCountsMap.get(u.accountId) || 0) : 0;
    const playsThisMonth = usageMap.get(u.id) || 0;

    rows.push({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      accountId: u.accountId || null,
      accountName: u.accountName || null,
      planCode: sub ? sub.planCode : "none",
      subscriptionStatus: sub ? "active" : "none",
      expiresAt: sub?.expiresAt || null,
      videoCount,
      playsThisMonth,
    });
  }

  return rows;
}

/**
 * Creates a new user in development using Better Auth (which triggers account provisioning hooks).
 */
export async function createDevUser(data: {
  name: string;
  email: string;
  password: string;
}) {
  await assertLocalDevPanelAccess();

  const name = data.name.trim();
  const email = data.email.trim().toLowerCase();
  const password = data.password;

  if (!name || name.length < 2) {
    throw new Error("O nome deve ter pelo menos 2 caracteres.");
  }
  if (!email || !email.includes("@")) {
    throw new Error("Email inválido.");
  }
  if (!password || password.length < 6) {
    throw new Error("A senha deve ter no mínimo 6 caracteres.");
  }

  // Check if user already exists
  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (existingUser) {
    throw new Error("Já existe um usuário cadastrado com este e-mail.");
  }

  // Call Better Auth server-side API
  const result = await auth.api.signUpEmail({
    body: {
      name,
      email,
      password,
    },
  });

  return result;
}

export type SetPlanMode = "none" | "pro_permanent" | "pro_temporary";

export interface SetUserPlanInput {
  userId: string;
  mode: SetPlanMode;
  durationDays?: number;
  expirationDate?: string; // ISO string or YYYY-MM-DD
}

/**
 * Updates or removes a user's subscription in dev.
 */
export async function setDevUserPlan({
  userId,
  mode,
  durationDays,
  expirationDate,
}: SetUserPlanInput) {
  await assertLocalDevPanelAccess();

  const now = new Date();

  return await db.transaction(async (tx) => {
    // 1. Inactivate existing active subscriptions
    await tx
      .update(subscriptions)
      .set({
        status: "inactive",
        endedAt: now,
      })
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, "active")
        )
      );

    if (mode === "none") {
      return { success: true, planCode: "none", expiresAt: null };
    }

    if (mode === "pro_permanent") {
      const [inserted] = await tx
        .insert(subscriptions)
        .values({
          userId,
          planCode: "pro",
          status: "active",
          startedAt: now,
          expiresAt: null,
        })
        .returning();

      return {
        success: true,
        planCode: inserted.planCode,
        expiresAt: null,
      };
    }

    if (mode === "pro_temporary") {
      let expiresAt: Date;

      if (expirationDate) {
        expiresAt = new Date(expirationDate);
        if (isNaN(expiresAt.getTime()) || expiresAt <= now) {
          throw new Error("A data de expiração deve ser uma data válida futura.");
        }
      } else if (durationDays && durationDays > 0) {
        expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
      } else {
        throw new Error("Informe a quantidade de dias ou a data de expiração.");
      }

      const [inserted] = await tx
        .insert(subscriptions)
        .values({
          userId,
          planCode: "pro",
          status: "active",
          startedAt: now,
          expiresAt,
        })
        .returning();

      return {
        success: true,
        planCode: inserted.planCode,
        expiresAt: inserted.expiresAt,
      };
    }

    throw new Error("Modo de plano inválido.");
  });
}

/**
 * Generates a new redeem code in dev reusing the core logic from spec 028.
 */
export async function generateDevRedeemCode(input: {
  durationDays: number;
  planCode?: string;
}): Promise<CreateRedeemCodeResult> {
  await assertLocalDevPanelAccess();
  return await createRedeemCode(input);
}

/**
 * Lists all redeem codes with their redemption status.
 */
export async function getDevRedeemCodesList(): Promise<DevRedeemCodeRow[]> {
  await assertLocalDevPanelAccess();

  const rows = await db
    .select({
      id: redeemCodes.id,
      planCode: redeemCodes.planCode,
      durationDays: redeemCodes.durationDays,
      createdAt: redeemCodes.createdAt,
      usedAt: redeemCodes.usedAt,
      usedByUserId: redeemCodes.usedByUserId,
      usedByUserName: user.name,
      usedByUserEmail: user.email,
    })
    .from(redeemCodes)
    .leftJoin(user, eq(redeemCodes.usedByUserId, user.id))
    .orderBy(desc(redeemCodes.createdAt));

  return rows.map((r) => ({
    id: r.id,
    planCode: r.planCode,
    durationDays: r.durationDays,
    createdAt: r.createdAt,
    usedAt: r.usedAt,
    usedByUser: r.usedByUserId
      ? {
          id: r.usedByUserId,
          name: r.usedByUserName || "—",
          email: r.usedByUserEmail || "—",
        }
      : null,
  }));
}
