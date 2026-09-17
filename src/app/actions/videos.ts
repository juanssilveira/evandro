"use server";

import { auth } from "@/lib/auth";
import { getCurrentAccount } from "@/lib/accounts";
import {
  createVideoUploadSession,
  syncVideoStatus,
  updateVideoTitle,
  deleteVideo,
} from "@/lib/videos";
import { updatePlayerConfig } from "@/lib/player-settings";
import {
  createUploadSchema,
  syncVideoStatusSchema,
  updatePlayerConfigActionSchema,
  updateVideoDebugSchema,
  updateVideoTitleSchema,
  deleteVideoSchema,
} from "@/lib/validations/videos";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export async function createUploadUrlAction(rawInput: unknown) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { error: "Não autorizado." };
  }

  const account = await getCurrentAccount(session.user.id);
  if (!account) {
    return { error: "Conta não encontrada para o usuário." };
  }

  const parsed = createUploadSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Dados inválidos." };
  }

  try {
    const data = await createVideoUploadSession(account.id, parsed.data);
    return { data };
  } catch (error) {
    console.error("Error creating upload URL:", error);
    return { error: "Falha ao gerar URL de upload no Mux." };
  }
}

export async function syncVideoStatusAction(rawInput: unknown) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { error: "Não autorizado." };
  }

  const account = await getCurrentAccount(session.user.id);
  if (!account) {
    return { error: "Conta não encontrada para o usuário." };
  }

  const parsed = syncVideoStatusSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Dados inválidos." };
  }

  try {
    const result = await syncVideoStatus(parsed.data.videoId, account.id);
    if (!result.success) {
      return { error: result.error || "Falha ao sincronizar o estado do vídeo." };
    }

    if (result.video?.status === "ready") {
      revalidatePath("/videos");
      revalidatePath(`/videos/${parsed.data.videoId}`);
    }

    return { success: true, video: result.video };
  } catch (error) {
    console.error("Error syncing video status:", error);
    return { error: "Erro ao sincronizar status do vídeo com o Mux." };
  }
}

export async function updatePlayerConfigAction(rawInput: unknown) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { error: "Não autorizado." };
  }

  const account = await getCurrentAccount(session.user.id);
  if (!account) {
    return { error: "Conta não encontrada para o usuário." };
  }

  const parsed = updatePlayerConfigActionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Dados inválidos." };
  }

  try {
    const updated = await updatePlayerConfig(
      parsed.data.videoId,
      account.id,
      parsed.data.config
    );

    if (!updated) {
      return { error: "Vídeo não encontrado ou não pertence a esta conta." };
    }

    revalidatePath(`/videos/${parsed.data.videoId}`);
    return { success: true, config: updated };
  } catch (error) {
    console.error("Error updating player config:", error);
    return { error: "Erro interno ao atualizar configurações do player." };
  }
}

export async function updateVideoDebugAction(rawInput: unknown) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { error: "Não autorizado." };
  }

  const account = await getCurrentAccount(session.user.id);
  if (!account) {
    return { error: "Conta não encontrada para o usuário." };
  }

  const parsed = updateVideoDebugSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Dados inválidos." };
  }

  try {
    const updated = await updatePlayerConfig(
      parsed.data.videoId,
      account.id,
      {
        development: {
          debug: parsed.data.debugEnabled,
        },
      }
    );

    if (!updated) {
      return { error: "Vídeo não encontrado ou não pertence a esta conta." };
    }

    revalidatePath(`/videos/${parsed.data.videoId}`);
    return { success: true, config: updated };
  } catch (error) {
    console.error("Error updating video debug setting:", error);
    return { error: "Erro interno ao atualizar configurações do vídeo." };
  }
}

export async function updateVideoTitleAction(rawInput: unknown) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { error: "Não autorizado." };
  }

  const account = await getCurrentAccount(session.user.id);
  if (!account) {
    return { error: "Conta não encontrada para o usuário." };
  }

  const parsed = updateVideoTitleSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Dados inválidos." };
  }

  try {
    const updated = await updateVideoTitle(
      parsed.data.videoId,
      account.id,
      parsed.data.title
    );

    if (!updated) {
      return { error: "Vídeo não encontrado ou não pertence a esta conta." };
    }

    revalidatePath("/videos");
    revalidatePath(`/videos/${parsed.data.videoId}`);
    return { success: true, video: updated };
  } catch (error) {
    console.error("Error updating video title:", error);
    return { error: "Erro interno ao atualizar o título do vídeo." };
  }
}

export async function deleteVideoAction(rawInput: unknown) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { error: "Não autorizado." };
  }

  const account = await getCurrentAccount(session.user.id);
  if (!account) {
    return { error: "Conta não encontrada para o usuário." };
  }

  const parsed = deleteVideoSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Dados inválidos." };
  }

  try {
    const result = await deleteVideo(parsed.data.videoId, account.id);
    if (!result.success) {
      return { error: result.error || "Falha ao excluir o vídeo." };
    }

    revalidatePath("/videos");
    return { success: true };
  } catch (error) {
    console.error("Error deleting video:", error);
    return { error: "Erro interno ao excluir o vídeo." };
  }
}
