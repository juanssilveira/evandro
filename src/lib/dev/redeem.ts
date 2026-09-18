import { redeemCodes, user } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { createRedeemCode, type CreateRedeemCodeResult } from "@/lib/plans/redeem";
import { assertLocalDevPanelAccess } from "./guard";
import { logAdminAction } from "./audit";
import { getAdminDb } from "./db";
import type { AdminEnvironment } from "./env-config";

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

export async function getDevRedeemCodesList(
  env: AdminEnvironment
): Promise<DevRedeemCodeRow[]> {
  await assertLocalDevPanelAccess();

  const adminDb = getAdminDb(env);

  const rows = await adminDb
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

export async function generateDevRedeemCode(
  env: AdminEnvironment,
  input: {
    durationDays: number;
    planCode?: string;
  }
): Promise<CreateRedeemCodeResult> {
  await assertLocalDevPanelAccess();

  const adminDb = getAdminDb(env);
  const result = await createRedeemCode(input, adminDb);

  await logAdminAction(env, {
    action: "redeem_created",
    metadata: {
      durationDays: result.durationDays,
      planCode: result.planCode,
    },
  });

  return result;
}

export async function deleteDevRedeemCode(
  env: AdminEnvironment,
  codeId: string
): Promise<{
  success: boolean;
  wasUsed: boolean;
  usedByUserId: string | null;
}> {
  await assertLocalDevPanelAccess();

  const adminDb = getAdminDb(env);

  const [code] = await adminDb
    .select()
    .from(redeemCodes)
    .where(eq(redeemCodes.id, codeId))
    .limit(1);

  if (!code) {
    throw new Error("Código de resgate não encontrado.");
  }

  const wasUsed = Boolean(code.usedAt);
  const usedByUserId = code.usedByUserId;

  // Delete redeem code record (does NOT affect granted subscription if already used)
  await adminDb.delete(redeemCodes).where(eq(redeemCodes.id, codeId));

  await logAdminAction(env, {
    action: "redeem_deleted",
    targetUserId: usedByUserId,
    metadata: {
      codeId,
      wasUsed,
      planCode: code.planCode,
      durationDays: code.durationDays,
    },
  });

  return {
    success: true,
    wasUsed,
    usedByUserId,
  };
}
