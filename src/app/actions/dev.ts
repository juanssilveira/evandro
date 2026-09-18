"use server";

import { revalidatePath } from "next/cache";
import { assertLocalDevPanelAccess } from "@/lib/dev/guard";
import {
  createDevUser,
  setDevUserPlan,
  banDevUser,
  unbanDevUser,
  revokeDevUserSessions,
  requestDevPasswordReset,
  type SetPlanMode,
} from "@/lib/dev/users";
import {
  disableDevAccount,
  enableDevAccount,
  deleteDevAccount,
  type DeleteAccountResult,
} from "@/lib/dev/accounts";
import {
  generateDevRedeemCode,
  deleteDevRedeemCode,
} from "@/lib/dev/redeem";
import { invalidateVideoInfraCache } from "@/lib/dev/video-infra";

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Server action to create a user in local dev.
 */
export async function createDevUserAction(formData: FormData): Promise<ActionResult<{ id: string; email: string }>> {
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
    revalidatePath(`/dev/users/${userId}`);
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
 * Server action to disable an account.
 */
export async function disableAccountAction(formData: FormData): Promise<ActionResult<{ accountId: string }>> {
  await assertLocalDevPanelAccess();

  const accountId = String(formData.get("accountId") || "").trim();
  const reason = String(formData.get("reason") || "").trim();

  if (!accountId) {
    return { success: false, error: "Conta não informada." };
  }

  try {
    await disableDevAccount(accountId, reason);
    revalidatePath("/dev");
    return { success: true, data: { accountId } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao desativar conta.";
    return { success: false, error: message };
  }
}

/**
 * Server action to re-enable a disabled account.
 */
export async function enableAccountAction(formData: FormData): Promise<ActionResult<{ accountId: string }>> {
  await assertLocalDevPanelAccess();

  const accountId = String(formData.get("accountId") || "").trim();

  if (!accountId) {
    return { success: false, error: "Conta não informada." };
  }

  try {
    await enableDevAccount(accountId);
    revalidatePath("/dev");
    return { success: true, data: { accountId } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao reativar conta.";
    return { success: false, error: message };
  }
}

/**
 * Server action to ban a user.
 */
export async function banUserAction(formData: FormData): Promise<ActionResult<{ userId: string }>> {
  await assertLocalDevPanelAccess();

  const userId = String(formData.get("userId") || "").trim();
  const banReason = String(formData.get("banReason") || "").trim();
  const durationOption = (String(formData.get("durationOption") || "permanent")) as
    | "permanent"
    | "1d"
    | "7d"
    | "30d"
    | "custom";
  const customDaysRaw = formData.get("customDays");
  const customExpiresAt = String(formData.get("customExpiresAt") || "");

  if (!userId) {
    return { success: false, error: "Usuário não informado." };
  }

  const customDays = customDaysRaw ? parseInt(String(customDaysRaw), 10) : undefined;

  try {
    await banDevUser({
      userId,
      banReason,
      durationOption,
      customDays,
      customExpiresAt: customExpiresAt || undefined,
    });
    revalidatePath("/dev");
    revalidatePath(`/dev/users/${userId}`);
    return { success: true, data: { userId } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao banir usuário.";
    return { success: false, error: message };
  }
}

/**
 * Server action to unban a user.
 */
export async function unbanUserAction(formData: FormData): Promise<ActionResult<{ userId: string }>> {
  await assertLocalDevPanelAccess();

  const userId = String(formData.get("userId") || "").trim();

  if (!userId) {
    return { success: false, error: "Usuário não informado." };
  }

  try {
    await unbanDevUser(userId);
    revalidatePath("/dev");
    revalidatePath(`/dev/users/${userId}`);
    return { success: true, data: { userId } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao remover banimento.";
    return { success: false, error: message };
  }
}

/**
 * Server action to revoke all active sessions for a user.
 */
export async function revokeUserSessionsAction(formData: FormData): Promise<ActionResult<{ userId: string }>> {
  await assertLocalDevPanelAccess();

  const userId = String(formData.get("userId") || "").trim();

  if (!userId) {
    return { success: false, error: "Usuário não informado." };
  }

  try {
    await revokeDevUserSessions(userId);
    revalidatePath("/dev");
    revalidatePath(`/dev/users/${userId}`);
    return { success: true, data: { userId } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao revogar sessões.";
    return { success: false, error: message };
  }
}

/**
 * Server action to send a password reset email to a user.
 */
export async function sendPasswordResetAction(formData: FormData): Promise<ActionResult<{ userId: string }>> {
  await assertLocalDevPanelAccess();

  const userId = String(formData.get("userId") || "").trim();

  if (!userId) {
    return { success: false, error: "Usuário não informado." };
  }

  try {
    await requestDevPasswordReset(userId);
    return { success: true, data: { userId } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao solicitar redefinição de senha.";
    return { success: false, error: message };
  }
}

/**
 * Server action to delete an account (cleans Mux/Bunny assets and R2 previews before DB).
 */
export async function deleteAccountAction(formData: FormData): Promise<ActionResult<DeleteAccountResult>> {
  await assertLocalDevPanelAccess();

  const accountId = String(formData.get("accountId") || "").trim();
  const confirmationName = String(formData.get("confirmationName") || "").trim();

  if (!accountId) {
    return { success: false, error: "Conta não informada." };
  }

  try {
    const result = await deleteDevAccount(accountId, confirmationName);
    if (!result.success) {
      return { success: false, error: result.error || "Falha ao excluir conta." };
    }
    revalidatePath("/dev");
    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao excluir conta.";
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
 * Server action to delete a redeem code.
 */
export async function deleteRedeemCodeAction(formData: FormData): Promise<ActionResult<{ codeId: string; wasUsed: boolean }>> {
  await assertLocalDevPanelAccess();

  const codeId = String(formData.get("codeId") || "").trim();
  if (!codeId) {
    return { success: false, error: "Código não informado." };
  }

  try {
    const result = await deleteDevRedeemCode(codeId);
    revalidatePath("/dev");
    return {
      success: true,
      data: {
        codeId,
        wasUsed: result.wasUsed,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao excluir código de resgate.";
    return { success: false, error: message };
  }
}

/**
 * Server action to update the default video provider for new uploads in local dev.
 */
export async function updateDefaultVideoProviderAction(
  providerInput: string | FormData
): Promise<ActionResult<{ provider: "mux" | "bunny" }>> {
  await assertLocalDevPanelAccess();

  let provider: string;
  if (typeof providerInput === "string") {
    provider = providerInput.trim();
  } else {
    provider = String(providerInput.get("provider") || "").trim();
  }

  if (provider !== "mux" && provider !== "bunny") {
    return { success: false, error: "Provider de vídeo inválido. Escolha Mux ou Bunny." };
  }

  const { getVideoProviderConfigurationStatus } = await import("@/lib/video-providers");
  const { setDefaultVideoProviderSetting } = await import("@/lib/settings/app-settings");
  const { logAdminAction } = await import("@/lib/dev/audit");

  const status = getVideoProviderConfigurationStatus();
  if (!status[provider].configured) {
    const providerLabel = provider === "mux" ? "Mux" : "Bunny Stream";
    return {
      success: false,
      error: `O provider ${providerLabel} não possui configuração completa no ambiente local.`,
    };
  }

  try {
    await setDefaultVideoProviderSetting(provider);
    await logAdminAction({
      action: "default_provider_changed",
      metadata: { newProvider: provider },
    });
    invalidateVideoInfraCache();
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

/**
 * Server action to invalidate and refresh provider observability stats.
 */
export async function refreshProviderStatsAction(): Promise<ActionResult<{ refreshedAt: Date }>> {
  await assertLocalDevPanelAccess();

  invalidateVideoInfraCache();
  revalidatePath("/dev");
  return {
    success: true,
    data: { refreshedAt: new Date() },
  };
}
