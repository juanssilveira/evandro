import { db } from "@/db";
import {
  user,
  accounts,
  accountMembers,
  videos,
  subscriptions,
  redeemCodes,
  monthlyUsage,
  playSessions,
  session,
  type Subscription,
  type Video,
} from "@/db/schema";
import { eq, and, sql, desc, or, isNull, gt, inArray, gte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getCurrentPeriodKey, SLOT_OCCUPYING_STATUSES } from "@/lib/plans/access";
import { PRO_PLAN, getPlanByCode } from "@/lib/plans/catalog";
import { assertLocalDevPanelAccess } from "./guard";
import { logAdminAction } from "./audit";
import { isEmailConfigured } from "@/lib/email";

export interface DevUserRow {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  accountId: string | null;
  accountName: string | null;
  accountStatus: "active" | "disabled";
  isBanned: boolean;
  banReason: string | null;
  banExpires: Date | null;
  planCode: string;
  subscriptionStatus: "active" | "inactive" | "none";
  expiresAt: Date | null;
  videoCount: number;
  playsThisMonth: number;
}

export interface UserSessionData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface UserVideoRow {
  id: string;
  publicId: string;
  title: string;
  provider: string;
  status: string;
  duration: number | null;
  sizeBytes: number;
  plays: number;
  createdAt: Date;
}

export interface UserRedeemHistory {
  id: string;
  planCode: string;
  durationDays: number;
  usedAt: Date;
}

export interface DevUserDetails {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    createdAt: Date;
    updatedAt: Date;
    role: string | null;
    banned: boolean;
    banReason: string | null;
    banExpires: Date | null;
  };
  account: {
    id: string;
    name: string;
    status: "active" | "disabled";
    disabledAt: Date | null;
    disabledReason: string | null;
    createdAt: Date;
  } | null;
  currentPlan: {
    planCode: string;
    name: string;
    status: "active" | "inactive" | "none";
    startedAt: Date | null;
    expiresAt: Date | null;
    maxVideos: number;
    maxPlays: number;
  };
  subscriptionHistory: Subscription[];
  usage: {
    videoCount: number;
    maxVideos: number;
    playsThisMonth: number;
    maxPlays: number;
    totalSizeBytes: number;
    totalDurationSeconds: number;
    activeSessionsCount: number;
  };
  providerSplit: {
    mux: { videoCount: number; totalSizeBytes: number; totalDurationSeconds: number; plays: number };
    bunny: { videoCount: number; totalSizeBytes: number; totalDurationSeconds: number; plays: number };
  };
  videos: UserVideoRow[];
  redeemsUsed: UserRedeemHistory[];
  sessions: UserSessionData[];
  dailyPlays: Array<{ date: string; plays: number }>;
  dailyUploads: Array<{ date: string; uploads: number }>;
  emailServiceAvailable: boolean;
}

export async function getDevUsersList(): Promise<DevUserRow[]> {
  await assertLocalDevPanelAccess();

  const now = new Date();
  const periodKey = getCurrentPeriodKey();

  const usersData = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
      createdAt: user.createdAt,
      accountId: accounts.id,
      accountName: accounts.name,
      accountStatus: accounts.status,
    })
    .from(user)
    .leftJoin(accountMembers, eq(user.id, accountMembers.userId))
    .leftJoin(accounts, eq(accountMembers.accountId, accounts.id))
    .orderBy(desc(user.createdAt));

  // Deduplicate in case of multiple memberships
  const userMap = new Map<string, typeof usersData[0]>();
  for (const u of usersData) {
    if (!userMap.has(u.id)) {
      userMap.set(u.id, u);
    }
  }

  const userIds = Array.from(userMap.keys());
  if (userIds.length === 0) return [];

  // Active subscriptions
  const subs = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        inArray(subscriptions.userId, userIds),
        eq(subscriptions.status, "active"),
        or(isNull(subscriptions.expiresAt), gt(subscriptions.expiresAt, now))
      )
    )
    .orderBy(desc(subscriptions.createdAt));

  const subsMap = new Map<string, Subscription>();
  for (const s of subs) {
    if (!subsMap.has(s.userId)) {
      subsMap.set(s.userId, s);
    }
  }

  // Video counts by account
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

  // Monthly usage
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
    const videoCount = u.accountId ? videoCountsMap.get(u.accountId) || 0 : 0;
    const playsThisMonth = usageMap.get(u.id) || 0;

    const isBanned = Boolean(
      u.banned && (!u.banExpires || new Date(u.banExpires) > now)
    );

    rows.push({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      accountId: u.accountId || null,
      accountName: u.accountName || null,
      accountStatus: (u.accountStatus as "active" | "disabled") || "active",
      isBanned,
      banReason: u.banReason || null,
      banExpires: u.banExpires || null,
      planCode: sub ? sub.planCode : "none",
      subscriptionStatus: sub ? "active" : "none",
      expiresAt: sub?.expiresAt || null,
      videoCount,
      playsThisMonth,
    });
  }

  return rows;
}

export async function getDevUserDetails(userId: string): Promise<DevUserDetails | null> {
  await assertLocalDevPanelAccess();

  const now = new Date();
  const periodKey = getCurrentPeriodKey();
  const days30Start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 1. Fetch user
  const [userData] = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!userData) return null;

  // 2. Fetch primary account
  const [memberRow] = await db
    .select({
      account: accounts,
      role: accountMembers.role,
    })
    .from(accountMembers)
    .innerJoin(accounts, eq(accountMembers.accountId, accounts.id))
    .where(eq(accountMembers.userId, userId))
    .orderBy(desc(accountMembers.createdAt))
    .limit(1);

  const account = memberRow?.account || null;

  // 3. Subscriptions (all history, newest first)
  const subscriptionHistory = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt));

  const activeSub = subscriptionHistory.find(
    (s) =>
      s.status === "active" && (!s.expiresAt || new Date(s.expiresAt) > now)
  );

  const planDef = activeSub ? getPlanByCode(activeSub.planCode) || PRO_PLAN : null;

  const currentPlan = {
    planCode: activeSub ? activeSub.planCode : "none",
    name: planDef ? planDef.name : "Sem plano",
    status: activeSub ? ("active" as const) : ("none" as const),
    startedAt: activeSub ? activeSub.startedAt : null,
    expiresAt: activeSub ? activeSub.expiresAt : null,
    maxVideos: planDef ? planDef.limits.maxVideos : 0,
    maxPlays: planDef ? planDef.limits.maxPlaysPerMonth : 0,
  };

  // 4. Monthly usage plays
  const [usageRow] = await db
    .select({ plays: monthlyUsage.plays })
    .from(monthlyUsage)
    .where(
      and(
        eq(monthlyUsage.userId, userId),
        eq(monthlyUsage.periodKey, periodKey)
      )
    )
    .limit(1);

  const playsThisMonth = usageRow?.plays ?? 0;

  // 5. Account videos & plays per video
  let userVideos: Video[] = [];
  if (account) {
    userVideos = await db
      .select()
      .from(videos)
      .where(eq(videos.accountId, account.id))
      .orderBy(desc(videos.createdAt));
  }

  // Count plays per video for user
  const videoIds = userVideos.map((v) => v.id);
  const videoPlaysMap = new Map<string, number>();
  if (videoIds.length > 0) {
    const playRows = await db
      .select({
        videoId: playSessions.videoId,
        count: sql<number>`count(*)::int`,
      })
      .from(playSessions)
      .where(inArray(playSessions.videoId, videoIds))
      .groupBy(playSessions.videoId);

    for (const pr of playRows) {
      videoPlaysMap.set(pr.videoId, Number(pr.count || 0));
    }
  }

  let totalSizeBytes = 0;
  let totalDurationSeconds = 0;
  let slotOccupyingCount = 0;

  const providerSplit = {
    mux: { videoCount: 0, totalSizeBytes: 0, totalDurationSeconds: 0, plays: 0 },
    bunny: { videoCount: 0, totalSizeBytes: 0, totalDurationSeconds: 0, plays: 0 },
  };

  const formattedVideos: UserVideoRow[] = [];

  for (const v of userVideos) {
    const p = (v.provider === "bunny" ? "bunny" : "mux") as "mux" | "bunny";
    const vPlays = videoPlaysMap.get(v.id) || 0;
    const vSize = Number(v.sizeBytes || 0);
    const vDur = Number(v.duration || 0);

    totalSizeBytes += vSize;
    totalDurationSeconds += vDur;

    if (SLOT_OCCUPYING_STATUSES.includes(v.status as typeof SLOT_OCCUPYING_STATUSES[number])) {
      slotOccupyingCount++;
    }

    providerSplit[p].videoCount++;
    providerSplit[p].totalSizeBytes += vSize;
    providerSplit[p].totalDurationSeconds += vDur;
    providerSplit[p].plays += vPlays;

    formattedVideos.push({
      id: v.id,
      publicId: v.publicId,
      title: v.title,
      provider: v.provider,
      status: v.status,
      duration: v.duration,
      sizeBytes: vSize,
      plays: vPlays,
      createdAt: v.createdAt,
    });
  }

  // 6. Redeem codes redeemed by this user
  const usedRedeems = await db
    .select({
      id: redeemCodes.id,
      planCode: redeemCodes.planCode,
      durationDays: redeemCodes.durationDays,
      usedAt: redeemCodes.usedAt,
    })
    .from(redeemCodes)
    .where(eq(redeemCodes.usedByUserId, userId))
    .orderBy(desc(redeemCodes.usedAt));

  const redeemsHistory: UserRedeemHistory[] = usedRedeems
    .filter((r) => r.usedAt !== null)
    .map((r) => ({
      id: r.id,
      planCode: r.planCode,
      durationDays: r.durationDays,
      usedAt: r.usedAt as Date,
    }));

  // 7. Active sessions in better-auth
  const activeSessions = await db
    .select()
    .from(session)
    .where(
      and(
        eq(session.userId, userId),
        gt(session.expiresAt, now)
      )
    )
    .orderBy(desc(session.createdAt));

  const sessionsData: UserSessionData[] = activeSessions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    expiresAt: s.expiresAt,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
  }));

  // 8. 30-day analytics for user
  const dailyPlaysRows = await db
    .select({
      dayStr: sql<string>`to_char(date_trunc('day', ${playSessions.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(playSessions)
    .where(
      and(
        eq(playSessions.ownerUserId, userId),
        gte(playSessions.createdAt, days30Start)
      )
    )
    .groupBy(sql`date_trunc('day', ${playSessions.createdAt})`);

  const dailyPlaysMap = new Map<string, number>();
  for (const r of dailyPlaysRows) {
    dailyPlaysMap.set(r.dayStr, Number(r.count || 0));
  }

  const dailyUploadsMap = new Map<string, number>();
  if (account) {
    const dailyUploadsRows = await db
      .select({
        dayStr: sql<string>`to_char(date_trunc('day', ${videos.createdAt}), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(videos)
      .where(
        and(
          eq(videos.accountId, account.id),
          gte(videos.createdAt, days30Start)
        )
      )
      .groupBy(sql`date_trunc('day', ${videos.createdAt})`);

    for (const r of dailyUploadsRows) {
      dailyUploadsMap.set(r.dayStr, Number(r.count || 0));
    }
  }

  const dateKeys: string[] = [];
  const cur = new Date(days30Start.getTime());
  for (let i = 0; i < 30; i++) {
    dateKeys.push(cur.toISOString().split("T")[0]);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const dailyPlays = dateKeys.map((date) => ({
    date,
    plays: dailyPlaysMap.get(date) || 0,
  }));

  const dailyUploads = dateKeys.map((date) => ({
    date,
    uploads: dailyUploadsMap.get(date) || 0,
  }));

  const isBanned = Boolean(
    userData.banned && (!userData.banExpires || new Date(userData.banExpires) > now)
  );

  return {
    user: {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      emailVerified: userData.emailVerified,
      image: userData.image,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
      role: userData.role,
      banned: isBanned,
      banReason: userData.banReason,
      banExpires: userData.banExpires,
    },
    account: account
      ? {
          id: account.id,
          name: account.name,
          status: (account.status as "active" | "disabled") || "active",
          disabledAt: account.disabledAt,
          disabledReason: account.disabledReason,
          createdAt: account.createdAt,
        }
      : null,
    currentPlan,
    subscriptionHistory,
    usage: {
      videoCount: slotOccupyingCount,
      maxVideos: currentPlan.maxVideos,
      playsThisMonth,
      maxPlays: currentPlan.maxPlays,
      totalSizeBytes,
      totalDurationSeconds,
      activeSessionsCount: sessionsData.length,
    },
    providerSplit,
    videos: formattedVideos,
    redeemsUsed: redeemsHistory,
    sessions: sessionsData,
    dailyPlays,
    dailyUploads,
    emailServiceAvailable: isEmailConfigured(),
  };
}

export type SetPlanMode = "none" | "pro_permanent" | "pro_temporary";

export interface SetUserPlanInput {
  userId: string;
  mode: SetPlanMode;
  durationDays?: number;
  expirationDate?: string;
}

export async function setDevUserPlan({
  userId,
  mode,
  durationDays,
  expirationDate,
}: SetUserPlanInput) {
  await assertLocalDevPanelAccess();

  const now = new Date();

  const result = await db.transaction(async (tx) => {
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

  await logAdminAction({
    action: "plan_changed",
    targetUserId: userId,
    metadata: {
      mode,
      planCode: result.planCode,
      expiresAt: result.expiresAt ? result.expiresAt.toISOString() : null,
    },
  });

  return result;
}

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

  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (existingUser) {
    throw new Error("Já existe um usuário cadastrado com este e-mail.");
  }

  const result = await auth.api.signUpEmail({
    body: {
      name,
      email,
      password,
    },
  });

  if (result?.user?.id) {
    await logAdminAction({
      action: "user_created",
      targetUserId: result.user.id,
      metadata: { name, email },
    });
  }

  return result;
}

export interface BanUserInput {
  userId: string;
  banReason?: string;
  durationOption: "permanent" | "1d" | "7d" | "30d" | "custom";
  customDays?: number;
  customExpiresAt?: string;
}

export async function banDevUser(input: BanUserInput) {
  await assertLocalDevPanelAccess();

  const now = new Date();
  let banExpires: Date | null = null;

  if (input.durationOption === "1d") {
    banExpires = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
  } else if (input.durationOption === "7d") {
    banExpires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  } else if (input.durationOption === "30d") {
    banExpires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  } else if (input.durationOption === "custom") {
    if (input.customExpiresAt) {
      banExpires = new Date(input.customExpiresAt);
      if (isNaN(banExpires.getTime()) || banExpires <= now) {
        throw new Error("Data de expiração do banimento inválida.");
      }
    } else if (input.customDays && input.customDays > 0) {
      banExpires = new Date(now.getTime() + input.customDays * 24 * 60 * 60 * 1000);
    }
  }

  const banReason = input.banReason?.trim() || "Violação dos termos de uso";

  // 1. Update user ban state in Better Auth schema
  await db
    .update(user)
    .set({
      banned: true,
      banReason,
      banExpires,
      updatedAt: now,
    })
    .where(eq(user.id, input.userId));

  // 2. Revoke all active sessions immediately
  await db.delete(session).where(eq(session.userId, input.userId));

  // 3. Log audit event
  await logAdminAction({
    action: "user_banned",
    targetUserId: input.userId,
    metadata: {
      banReason,
      banExpires: banExpires ? banExpires.toISOString() : "permanent",
    },
  });

  return { success: true };
}

export async function unbanDevUser(userId: string) {
  await assertLocalDevPanelAccess();

  await db
    .update(user)
    .set({
      banned: false,
      banReason: null,
      banExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));

  await logAdminAction({
    action: "user_unbanned",
    targetUserId: userId,
  });

  return { success: true };
}

export async function revokeDevUserSessions(userId: string) {
  await assertLocalDevPanelAccess();

  const [countRes] = await db
    .delete(session)
    .where(eq(session.userId, userId))
    .returning({ id: session.id });

  await logAdminAction({
    action: "sessions_revoked",
    targetUserId: userId,
    metadata: { revokedCount: countRes ? 1 : 0 },
  });

  return { success: true };
}

export async function requestDevPasswordReset(userId: string) {
  await assertLocalDevPanelAccess();

  const [userData] = await db
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!userData) {
    throw new Error("Usuário não encontrado.");
  }

  if (!isEmailConfigured()) {
    throw new Error("Serviço de email não configurado.");
  }

  // Call official Better Auth server endpoint for password reset
  const res = await auth.api.requestPasswordReset({
    body: {
      email: userData.email,
    },
  });

  await logAdminAction({
    action: "password_reset_requested",
    targetUserId: userId,
    metadata: { email: userData.email },
  });

  return res;
}
