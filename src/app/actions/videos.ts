"use server";

import { auth } from "@/lib/auth";
import { getCurrentAccount } from "@/lib/accounts";
import { createVideoUploadSession, finalizeVideoUpload } from "@/lib/videos";
import { createUploadSchema, finalizeUploadSchema } from "@/lib/validations/videos";
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
    return { error: "Falha ao gerar URL de upload." };
  }
}

export async function finalizeUploadAction(rawInput: unknown) {
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

  const parsed = finalizeUploadSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Dados inválidos." };
  }

  try {
    const result = await finalizeVideoUpload(account.id, parsed.data);
    if (!result.success) {
      return { error: result.error || "Falha ao finalizar o upload." };
    }

    revalidatePath("/videos");
    return { success: true, video: result.video };
  } catch (error) {
    console.error("Error finalizing upload:", error);
    return { error: "Erro interno ao processar o vídeo." };
  }
}
