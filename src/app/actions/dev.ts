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

/**
 * Server action to update the default video provider for new uploads in local dev.
 */
export async function updateDefaultVideoProviderAction(
  providerInput: string | FormData
): Promise<ActionResult<{ provider: "mux" | "bunny" }>> {
  // 1. Fail-closed security guard check
  await assertLocalDevPanelAccess();

  let provider: string;
  if (typeof providerInput === "string") {
    provider = providerInput.trim();
  } else {
    provider = String(providerInput.get("provider") || "").trim();
  }

  // 2. Validate provider value
  if (provider !== "mux" && provider !== "bunny") {
    return { success: false, error: "Provider de vídeo inválido. Escolha Mux ou Bunny." };
  }

  // 3. Confirm that provider is configured
  const { getVideoProviderConfigurationStatus } = await import("@/lib/video-providers");
  const { setDefaultVideoProviderSetting } = await import("@/lib/settings/app-settings");

  const status = getVideoProviderConfigurationStatus();
  if (!status[provider].configured) {
    const providerLabel = provider === "mux" ? "Mux" : "Bunny Stream";
    return {
      success: false,
      error: `O provider ${providerLabel} não possui configuração completa no ambiente local.`,
    };
  }

  // 4. Persist default_video_provider (NEVER updates videos rows)
  try {
    await setDefaultVideoProviderSetting(provider);
    // 5. Revalidate /dev
    revalidatePath("/dev");
    return {
      success: true,
      data: { provider },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar provider padrão.";
    return { success: false, error: message };
  }
}
