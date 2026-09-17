"use server";

import { requireActivePlan } from "@/lib/plans/access";
import {
  createFolder,
  updateFolder,
  deleteFolder,
  moveVideoToFolder,
  getFoldersForAccount,
} from "@/lib/folders";
import {
  createFolderSchema,
  updateFolderSchema,
  deleteFolderSchema,
  moveVideoToFolderSchema,
} from "@/lib/validations/folders";
import { revalidatePath } from "next/cache";

export async function createFolderAction(rawInput: unknown) {
  let planContext;
  try {
    planContext = await requireActivePlan();
  } catch (error) {
    if (error instanceof Error && error.message === "NO_ACTIVE_PLAN") {
      return { error: "Você não tem nenhum plano ativo." };
    }
    return { error: "Não autorizado." };
  }

  const { account } = planContext;

  const parsed = createFolderSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Dados inválidos." };
  }

  try {
    const folder = await createFolder(account.id, parsed.data);
    revalidatePath("/videos");
    return { success: true, folder };
  } catch (error) {
    console.error("Error creating folder:", error);
    return { error: "Erro interno ao criar a pasta." };
  }
}

export async function updateFolderAction(rawInput: unknown) {
  let planContext;
  try {
    planContext = await requireActivePlan();
  } catch (error) {
    if (error instanceof Error && error.message === "NO_ACTIVE_PLAN") {
      return { error: "Você não tem nenhum plano ativo." };
    }
    return { error: "Não autorizado." };
  }

  const { account } = planContext;

  const parsed = updateFolderSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Dados inválidos." };
  }

  try {
    const folder = await updateFolder(parsed.data.folderId, account.id, {
      name: parsed.data.name,
      color: parsed.data.color,
    });

    if (!folder) {
      return { error: "Pasta não encontrada ou não pertence a esta conta." };
    }

    revalidatePath("/videos");
    revalidatePath(`/videos/folders/${parsed.data.folderId}`);
    return { success: true, folder };
  } catch (error) {
    console.error("Error updating folder:", error);
    return { error: "Erro interno ao atualizar a pasta." };
  }
}

export async function deleteFolderAction(rawInput: unknown) {
  let planContext;
  try {
    planContext = await requireActivePlan();
  } catch (error) {
    if (error instanceof Error && error.message === "NO_ACTIVE_PLAN") {
      return { error: "Você não tem nenhum plano ativo." };
    }
    return { error: "Não autorizado." };
  }

  const { account } = planContext;

  const parsed = deleteFolderSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Dados inválidos." };
  }

  try {
    const result = await deleteFolder(parsed.data.folderId, account.id);
    if (!result.success) {
      return { error: result.error || "Falha ao excluir a pasta." };
    }

    revalidatePath("/videos");
    return { success: true };
  } catch (error) {
    console.error("Error deleting folder:", error);
    return { error: "Erro interno ao excluir a pasta." };
  }
}

export async function moveVideoToFolderAction(rawInput: unknown) {
  let planContext;
  try {
    planContext = await requireActivePlan();
  } catch (error) {
    if (error instanceof Error && error.message === "NO_ACTIVE_PLAN") {
      return { error: "Você não tem nenhum plano ativo." };
    }
    return { error: "Não autorizado." };
  }

  const { account } = planContext;

  const parsed = moveVideoToFolderSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Dados inválidos." };
  }

  try {
    const video = await moveVideoToFolder(
      parsed.data.videoId,
      account.id,
      parsed.data.folderId
    );

    if (!video) {
      return { error: "Vídeo ou pasta não encontrado." };
    }

    revalidatePath("/videos");
    revalidatePath(`/videos/${parsed.data.videoId}`);
    if (parsed.data.folderId) {
      revalidatePath(`/videos/folders/${parsed.data.folderId}`);
    }

    return { success: true, video };
  } catch (error) {
    console.error("Error moving video to folder:", error);
    return { error: "Erro interno ao mover o vídeo." };
  }
}

export async function getAccountFoldersAction() {
  let planContext;
  try {
    planContext = await requireActivePlan();
  } catch (error) {
    if (error instanceof Error && error.message === "NO_ACTIVE_PLAN") {
      return { error: "Você não tem nenhum plano ativo." };
    }
    return { error: "Não autorizado." };
  }

  const { account } = planContext;

  try {
    const folders = await getFoldersForAccount(account.id);
    return { success: true, folders };
  } catch (error) {
    console.error("Error getting folders:", error);
    return { error: "Erro ao buscar pastas." };
  }
}
