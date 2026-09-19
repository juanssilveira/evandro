"use server";

import { requireActivePlan } from "@/lib/plans/access";
import {
  createVideoUploadSession,
  syncVideoStatus,
  updateVideoTitle,
  deleteVideo,
  getVideoForAccount,
} from "@/lib/videos";
import { updatePlayerConfig, getPlayerConfigByVideoId } from "@/lib/player-settings";
import {
  createUploadSchema,
  syncVideoStatusSchema,
  updatePlayerConfigActionSchema,
  updateVideoDebugSchema,
  updateVideoTitleSchema,
  deleteVideoSchema,
  uploadPlayerThumbnailSchema,
  removePlayerThumbnailSchema,
} from "@/lib/validations/videos";
import {
  putAssetObject,
  deleteAssetObject,
  getAssetPublicUrl,
} from "@/lib/asset-storage/r2";
import { revalidatePath } from "next/cache";

export async function createUploadUrlAction(rawInput: unknown) {
  let planContext;
  try {
    planContext = await requireActivePlan();
  } catch (error) {
    if (error instanceof Error && error.message === "NO_ACTIVE_PLAN") {
      return { error: "Você não tem nenhum plano ativo para criar vídeos." };
    }
    return { error: "Não autorizado." };
  }

  const { account, plan } = planContext;

  const parsed = createUploadSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Dados inválidos." };
  }

  try {
    const data = await createVideoUploadSession(
      account.id,
      parsed.data,
      plan.limits.maxVideos
    );
    return { data };
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "VIDEO_LIMIT_REACHED") {
      return {
        error: `Limite de ${plan.limits.maxVideos} vídeos atingido para o plano ${plan.name}.`,
      };
    }
    console.error("Error creating upload URL:", error);
    return { error: "Falha ao preparar o upload do vídeo." };
  }
}

export async function syncVideoStatusAction(rawInput: unknown) {
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

  const parsed = syncVideoStatusSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Dados inválidos." };
  }

  try {
    const result = await syncVideoStatus(parsed.data.videoId, account.id);
    if (!result.success) {
      return { error: result.error || "Falha ao sincronizar o estado do vídeo." };
    }

    if (result.video?.status === "ready" || result.video?.status === "errored") {
      revalidatePath("/videos");
      revalidatePath(`/videos/${parsed.data.videoId}`);
    }

    return { success: true, video: result.video };
  } catch (error) {
    console.error("Error syncing video status:", error);
    return { error: "Erro ao sincronizar status do vídeo." };
  }
}

export async function updatePlayerConfigAction(rawInput: unknown) {
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

    if (parsed.data.config.playback?.backgroundAutoplay) {
      syncVideoStatus(parsed.data.videoId, account.id).catch((err) => {
        console.warn("[PlayerConfig] Background preview generation triggered error:", err);
      });
    }

    revalidatePath(`/videos/${parsed.data.videoId}`);
    return { success: true, config: updated };
  } catch (error) {
    console.error("Error updating player config:", error);
    return { error: "Erro interno ao atualizar configurações do player." };
  }
}

export async function updateVideoDebugAction(rawInput: unknown) {
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

function isValidWebpBuffer(buffer: Buffer | Uint8Array): boolean {
  if (buffer.length < 12) return false;
  const isRiff =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46;
  const isWebp =
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;
  return isRiff && isWebp;
}

export async function uploadPlayerThumbnailAction(formData: FormData) {
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

  const rawVideoId = formData.get("videoId");
  const rawKind = formData.get("kind");
  const rawAspectRatio = formData.get("aspectRatio");
  const file = formData.get("file");

  const parsed = uploadPlayerThumbnailSchema.safeParse({
    videoId: rawVideoId,
    kind: rawKind,
    aspectRatio: rawAspectRatio,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Dados de thumbnail inválidos." };
  }

  const { videoId, kind, aspectRatio } = parsed.data;

  if (!file || !(file instanceof Blob)) {
    return { error: "Arquivo de imagem não fornecido." };
  }

  // Hard limit on processed WebP asset: 750 KB
  const MAX_PROCESSED_BYTES = 750 * 1024;
  if (file.size > MAX_PROCESSED_BYTES) {
    return {
      error: `O arquivo processado excede o limite máximo permitido (${Math.round(MAX_PROCESSED_BYTES / 1024)} KB).`,
    };
  }

  // Check video existence and ownership
  const video = await getVideoForAccount(videoId, account.id);
  if (!video) {
    return { error: "Vídeo não encontrado ou não pertence a esta conta." };
  }

  // Read binary and check magic bytes
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!isValidWebpBuffer(buffer)) {
    return { error: "Formato de arquivo inválido. O arquivo processado deve ser um WebP válido." };
  }

  // Generate unique versioned key (never overwrite existing objects)
  const uniqueId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
  const key = `player-thumbnails/${video.publicId}/${kind}/${uniqueId}.webp`;

  // 1. Upload new asset to R2
  const uploadOk = await putAssetObject({
    key,
    body: buffer,
    contentType: "image/webp",
    cacheControl: "public, max-age=31536000, immutable",
  });

  if (!uploadOk) {
    return { error: "Falha ao enviar imagem para o armazenamento." };
  }

  const newUrl = getAssetPublicUrl(key);

  // 2. Fetch current config to locate old asset key
  const currentConfig = await getPlayerConfigByVideoId(videoId);
  const oldKey =
    kind === "startup"
      ? currentConfig.appearance?.thumbnail?.customKey
      : currentConfig.appearance?.pauseThumbnail?.customKey;

  // 3. Persist new config
  let updatedConfig;
  try {
    if (kind === "startup") {
      updatedConfig = await updatePlayerConfig(videoId, account.id, {
        appearance: {
          thumbnail: {
            enabled: true,
            source: "custom",
            customUrl: newUrl,
            customKey: key,
            customAspectRatio: aspectRatio,
          },
        },
      });
    } else {
      updatedConfig = await updatePlayerConfig(videoId, account.id, {
        appearance: {
          pauseThumbnail: {
            enabled: true,
            customUrl: newUrl,
            customKey: key,
            customAspectRatio: aspectRatio,
          },
        },
      });
    }

    if (!updatedConfig) {
      throw new Error("Falha ao salvar configuração.");
    }
  } catch (err) {
    console.error("[Thumbnail Upload Action] Config update failed, cleaning up orphan key:", key, err);
    // Cleanup new orphan asset on config update failure
    await deleteAssetObject(key).catch(() => {});
    return { error: "Erro ao atualizar configuração do vídeo com a nova thumbnail." };
  }

  // 4. If config confirmed, safely delete old asset key (never delete before config confirmation)
  if (oldKey && oldKey !== key) {
    try {
      await deleteAssetObject(oldKey);
    } catch (cleanupErr) {
      console.warn("[Thumbnail Upload Action] Could not delete old key:", oldKey, cleanupErr);
    }
  }

  revalidatePath(`/videos/${videoId}`);
  return {
    success: true,
    config: updatedConfig,
    url: newUrl,
    key,
  };
}

export async function removePlayerThumbnailAction(rawInput: unknown) {
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

  const parsed = removePlayerThumbnailSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Dados inválidos." };
  }

  const { videoId, kind } = parsed.data;

  // Verify ownership
  const video = await getVideoForAccount(videoId, account.id);
  if (!video) {
    return { error: "Vídeo não encontrado ou não pertence a esta conta." };
  }

  const currentConfig = await getPlayerConfigByVideoId(videoId);
  const oldKey =
    kind === "startup"
      ? currentConfig.appearance?.thumbnail?.customKey
      : currentConfig.appearance?.pauseThumbnail?.customKey;

  let updatedConfig;
  try {
    if (kind === "startup") {
      updatedConfig = await updatePlayerConfig(videoId, account.id, {
        appearance: {
          thumbnail: {
            source: "provider",
            customUrl: null,
            customKey: null,
            customAspectRatio: null,
          },
        },
      });
    } else {
      updatedConfig = await updatePlayerConfig(videoId, account.id, {
        appearance: {
          pauseThumbnail: {
            enabled: false,
            customUrl: null,
            customKey: null,
            customAspectRatio: null,
          },
        },
      });
    }

    if (!updatedConfig) {
      return { error: "Falha ao remover thumbnail." };
    }
  } catch (err) {
    console.error("[Thumbnail Remove Action] Error updating config:", err);
    return { error: "Erro ao atualizar configuração do player." };
  }

  // Delete R2 asset after config updated
  if (oldKey) {
    try {
      await deleteAssetObject(oldKey);
    } catch (cleanupErr) {
      console.warn("[Thumbnail Remove Action] Failed deleting key:", oldKey, cleanupErr);
    }
  }

  revalidatePath(`/videos/${videoId}`);
  return {
    success: true,
    config: updatedConfig,
  };
}

