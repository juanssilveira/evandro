"use server";

import { revalidatePath } from "next/cache";
import { assertLocalDevPanelAccess } from "@/lib/dev/guard";
import {
  createDevUser,
  setDevUserPlan,
  generateDevRedeemCode,
  type SetPlanMode,
} from "@/lib/dev/service";

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Server action to create a user in local dev.
 */
export async function createDevUserAction(formData: FormData): Promise<ActionResult<{ id: string; email: string }>> {
  // Fail-closed security guard check
  await assertLocalDevPanelAccess();

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  try {
    const result = await createDevUser({ name, email, password });
    revalidatePath("/dev");
    return {
      success: true,
      data: {
        id: result?.user?.id || "",
        email: result?.user?.email || email,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao criar usuário.";
    return { success: false, error: message };
  }
}

/**
 * Server action to set or remove a user's plan in local dev.
 */
export async function updateDevUserPlanAction(formData: FormData): Promise<ActionResult<{ planCode: string; expiresAt: Date | null }>> {
  // Fail-closed security guard check
  await assertLocalDevPanelAccess();

  const userId = String(formData.get("userId") || "").trim();
  const mode = String(formData.get("mode") || "") as SetPlanMode;
  const durationDaysRaw = formData.get("durationDays");
  const expirationDateRaw = formData.get("expirationDate");

  if (!userId) {
    return { success: false, error: "Usuário não informado." };
  }

  const durationDays = durationDaysRaw ? parseInt(String(durationDaysRaw), 10) : undefined;
  const expirationDate = expirationDateRaw ? String(expirationDateRaw) : undefined;

  try {
    const result = await setDevUserPlan({
      userId,
      mode,
      durationDays,
      expirationDate,
    });
    revalidatePath("/dev");
    return {
      success: true,
      data: {
        planCode: result.planCode,
        expiresAt: result.expiresAt,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao alterar plano do usuário.";
    return { success: false, error: message };
  }
}

/**
 * Server action to generate a redeem code in local dev.
 */
export async function createDevRedeemCodeAction(formData: FormData): Promise<ActionResult<{
  code: string;
  durationDays: number;
  planCode: string;
}>> {
  // Fail-closed security guard check
  await assertLocalDevPanelAccess();

  const durationDaysRaw = formData.get("durationDays");
  const planCode = String(formData.get("planCode") || "pro");

  const durationDays = parseInt(String(durationDaysRaw || "7"), 10);
  if (isNaN(durationDays) || durationDays <= 0) {
    return { success: false, error: "A duração em dias deve ser um número positivo." };
  }

  try {
    const result = await generateDevRedeemCode({
      durationDays,
      planCode,
    });
    revalidatePath("/dev");
    return {
      success: true,
      data: {
        code: result.code,
        durationDays: result.durationDays,
        planCode: result.planCode,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao gerar código de resgate.";
    return { success: false, error: message };
  }
}
