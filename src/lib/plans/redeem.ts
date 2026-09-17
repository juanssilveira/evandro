import * as crypto from "node:crypto";
import { db } from "@/db";
import {
  redeemCodes,
  subscriptions,
} from "@/db/schema";
import { eq, and, or, isNull, gt } from "drizzle-orm";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRedeemCodeString(): string {
  const getRandomBlock = (length: number): string => {
    const bytes = crypto.randomBytes(length);
    let result = "";
    for (let i = 0; i < length; i++) {
      result += CODE_CHARS[bytes[i] % CODE_CHARS.length];
    }
    return result;
  };

  const p1 = getRandomBlock(4);
  const p2 = getRandomBlock(4);
  const p3 = getRandomBlock(4);
  return `EVN-${p1}-${p2}-${p3}`;
}

export function hashRedeemCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export interface CreateRedeemCodeInput {
  durationDays: number;
  planCode?: string;
}

export interface CreateRedeemCodeResult {
  code: string;
  codeHash: string;
  planCode: string;
  durationDays: number;
  id: string;
}

export async function createRedeemCode({
  durationDays,
  planCode = "pro",
}: CreateRedeemCodeInput): Promise<CreateRedeemCodeResult> {
  if (!Number.isInteger(durationDays) || durationDays <= 0) {
    throw new Error("A duração em dias deve ser um número inteiro positivo maior que 0.");
  }

  const normalizedPlanCode = planCode.trim().toLowerCase();
  if (normalizedPlanCode !== "pro") {
    throw new Error(`Plano inválido: "${planCode}". Atualmente apenas o plano "pro" é suportado.`);
  }

  const rawCode = generateRedeemCodeString();
  const codeHash = hashRedeemCode(rawCode);

  const [inserted] = await db
    .insert(redeemCodes)
    .values({
      codeHash,
      planCode: normalizedPlanCode,
      durationDays,
    })
    .returning();

  return {
    id: inserted.id,
    code: rawCode,
    codeHash,
    planCode: inserted.planCode,
    durationDays: inserted.durationDays,
  };
}

export type RedeemResult =
  | { success: true; planCode: string; expiresAt: Date }
  | { success: false; error: string };

export async function redeemCodeForUser(
  userId: string,
  rawCode: string
): Promise<RedeemResult> {
  if (!rawCode || typeof rawCode !== "string") {
    return { success: false, error: "Código inválido ou já utilizado." };
  }

  const trimmed = rawCode.trim().toUpperCase();
  if (trimmed.length < 5) {
    return { success: false, error: "Código inválido ou já utilizado." };
  }

  const codeHash = hashRedeemCode(trimmed);
  const now = new Date();

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Verify user does not already have an active non-expired plan
      const [activeSub] = await tx
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
        .limit(1);

      if (activeSub) {
        return {
          success: false as const,
          error: "Você já possui um plano ativo.",
        };
      }

      // 2. Query redeem code with FOR UPDATE lock
      const [codeRow] = await tx
        .select()
        .from(redeemCodes)
        .where(
          and(
            eq(redeemCodes.codeHash, codeHash),
            isNull(redeemCodes.usedAt)
          )
        )
        .for("update")
        .limit(1);

      if (!codeRow) {
        return {
          success: false as const,
          error: "Código inválido ou já utilizado.",
        };
      }

      const startedAt = new Date();
      const expiresAt = new Date(
        startedAt.getTime() + codeRow.durationDays * 24 * 60 * 60 * 1000
      );

      // 3. Inactivate any old subscriptions that might be marked active but expired
      await tx
        .update(subscriptions)
        .set({
          status: "inactive",
          endedAt: startedAt,
        })
        .where(
          and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.status, "active")
          )
        );

      // 4. Create new Pro subscription with expiresAt
      await tx.insert(subscriptions).values({
        userId,
        planCode: codeRow.planCode,
        status: "active",
        startedAt,
        expiresAt,
      });

      // 5. Mark redeem code as used
      const [updatedCode] = await tx
        .update(redeemCodes)
        .set({
          usedAt: startedAt,
          usedByUserId: userId,
        })
        .where(
          and(
            eq(redeemCodes.id, codeRow.id),
            isNull(redeemCodes.usedAt)
          )
        )
        .returning();

      if (!updatedCode) {
        throw new Error("REDEEM_CONCURRENCY_CONFLICT");
      }

      return {
        success: true as const,
        planCode: codeRow.planCode,
        expiresAt,
      };
    });

    return result;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message === "REDEEM_CONCURRENCY_CONFLICT"
    ) {
      return { success: false, error: "Código inválido ou já utilizado." };
    }
    console.error("Error during code redeem:", error);
    return { success: false, error: "Código inválido ou já utilizado." };
  }
}
