import { db } from "@/db";
import { videos, type Video } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  createMuxDirectUpload,
  getMuxDirectUpload,
  getMuxAsset,
  deleteMuxAsset,
} from "@/lib/mux";
import { generateAndStoreBackgroundPreview } from "@/lib/background-preview";
import { deleteAssetObject } from "@/lib/asset-storage/r2";
import type { CreateUploadInput } from "@/lib/validations/videos";

export async function getVideosForAccount(accountId: string): Promise<Video[]> {
  return await db
    .select()
    .from(videos)
    .where(eq(videos.accountId, accountId))
    .orderBy(desc(videos.createdAt));
}

export async function getVideoForAccount(
  videoId: string,
  accountId: string
): Promise<Video | null> {
  const [video] = await db
    .select()
    .from(videos)
    .where(and(eq(videos.id, videoId), eq(videos.accountId, accountId)))
    .limit(1);

  return video || null;
}

export async function getVideoByPublicId(
  publicId: string
): Promise<Video | null> {
  const [video] = await db
    .select()
    .from(videos)
    .where(eq(videos.publicId, publicId))
    .limit(1);

  return video || null;
}

export async function createVideoUploadSession(
  accountId: string,
  input: CreateUploadInput
): Promise<{ videoId: string; uploadUrl: string; muxUploadId: string }> {
  const videoId = crypto.randomUUID();

  // 1. Create Direct Upload session in Mux
  const { uploadId, uploadUrl } = await createMuxDirectUpload({
    videoId,
  });

  // 2. Persist initial video record in database
  await db.insert(videos).values({
    id: videoId,
    publicId: crypto.randomUUID(),
    accountId,
    title: input.title,
    muxUploadId: uploadId,
    status: "waiting_upload",
    originalFilename: input.filename,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });

  return { videoId, uploadUrl, muxUploadId: uploadId };
}

export async function syncVideoStatus(
  videoId: string,
  accountId?: string
): Promise<{ success: boolean; video?: Video; error?: string }> {
  const [video] = accountId
    ? await db
        .select()
        .from(videos)
        .where(and(eq(videos.id, videoId), eq(videos.accountId, accountId)))
        .limit(1)
    : await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);

  if (!video) {
    return {
      success: false,
      error: "Vídeo não encontrado ou não pertence a esta conta.",
    };
  }

  // If already ready, check if background preview needs generation
  if (video.status === "ready" && video.muxPlaybackId) {
    if (
      video.backgroundPreviewStatus !== "ready" &&
      video.muxAssetId &&
      video.backgroundPreviewStatus !== "errored"
    ) {
      await generateAndStoreBackgroundPreview({
        videoId: video.id,
        publicId: video.publicId,
        muxAssetId: video.muxAssetId,
        muxPlaybackId: video.muxPlaybackId,
        duration: video.duration,
      });

      const [refreshedVideo] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, videoId))
        .limit(1);

      return { success: true, video: refreshedVideo || video };
    }

    return { success: true, video };
  }

  let currentMuxAssetId = video.muxAssetId;

  // Step A: If assetId is not known yet, check Direct Upload status in Mux
  if (!currentMuxAssetId && video.muxUploadId) {
    try {
      const upload = await getMuxDirectUpload(video.muxUploadId);

      if (upload.status === "asset_created" && upload.asset_id) {
        currentMuxAssetId = upload.asset_id;
        await db
          .update(videos)
          .set({
            muxAssetId: upload.asset_id,
            status: "processing",
          })
          .where(eq(videos.id, videoId));
      } else if (upload.status === "errored") {
        const [erroredVideo] = await db
          .update(videos)
          .set({
            status: "errored",
            errorMessage: upload.error?.message || "Erro no upload do vídeo.",
          })
          .where(eq(videos.id, videoId))
          .returning();

        return { success: true, video: erroredVideo };
      }
    } catch (error) {
      console.error(`[Mux Sync] Failed to retrieve direct upload ${video.muxUploadId}:`, error);
    }
  }

  // Step B: If assetId is known, check Asset status in Mux
  if (currentMuxAssetId) {
    try {
      const asset = await getMuxAsset(currentMuxAssetId);

      if (asset.status === "ready") {
        const publicPlayback =
          asset.playback_ids?.find((p) => p.policy === "public") ||
          asset.playback_ids?.[0];
        const playbackId = publicPlayback?.id || null;
        const duration =
          typeof asset.duration === "number" && Number.isFinite(asset.duration)
            ? asset.duration
            : null;

        const [readyVideo] = await db
          .update(videos)
          .set({
            status: "ready",
            muxAssetId: currentMuxAssetId,
            muxPlaybackId: playbackId,
            duration,
            errorMessage: null,
          })
          .where(eq(videos.id, videoId))
          .returning();

        // Trigger background preview generation if playbackId exists
        if (playbackId) {
          await generateAndStoreBackgroundPreview({
            videoId: readyVideo.id,
            publicId: readyVideo.publicId,
            muxAssetId: currentMuxAssetId,
            muxPlaybackId: playbackId,
            duration,
          });

          const [refreshed] = await db
            .select()
            .from(videos)
            .where(eq(videos.id, videoId))
            .limit(1);

          return { success: true, video: refreshed || readyVideo };
        }

        return { success: true, video: readyVideo };
      }

      if (asset.status === "errored") {
        const errorMsg =
          asset.errors?.messages?.[0] || "Erro no processamento do vídeo no Mux.";

        const [erroredVideo] = await db
          .update(videos)
          .set({
            status: "errored",
            muxAssetId: currentMuxAssetId,
            errorMessage: errorMsg,
          })
          .where(eq(videos.id, videoId))
          .returning();

        return { success: true, video: erroredVideo };
      }

      if (asset.status === "preparing") {
        const [processingVideo] = await db
          .update(videos)
          .set({
            status: "processing",
            muxAssetId: currentMuxAssetId,
          })
          .where(eq(videos.id, videoId))
          .returning();

        return { success: true, video: processingVideo };
      }
    } catch (error) {
      console.error(`[Mux Sync] Failed to retrieve asset ${currentMuxAssetId}:`, error);
    }
  }

  // Return current state from DB
  const [updatedVideo] = await db
    .select()
    .from(videos)
    .where(eq(videos.id, videoId))
    .limit(1);

  return { success: true, video: updatedVideo || video };
}

export async function updateVideoTitle(
  videoId: string,
  accountId: string,
  title: string
): Promise<Video | null> {
  const [updated] = await db
    .update(videos)
    .set({ title })
    .where(and(eq(videos.id, videoId), eq(videos.accountId, accountId)))
    .returning();

  return updated || null;
}

export async function deleteVideo(
  videoId: string,
  accountId: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Verify existence and ownership
  const video = await getVideoForAccount(videoId, accountId);
  if (!video) {
    return {
      success: false,
      error: "Vídeo não encontrado ou não pertence a esta conta.",
    };
  }

  // 2. If Mux asset exists, delete from Mux (idempotent)
  if (video.muxAssetId) {
    try {
      await deleteMuxAsset(video.muxAssetId);
    } catch (error) {
      console.error(`[Mux Cleanup] Error deleting asset ${video.muxAssetId}:`, error);
    }
  }

  // 3. If derived background preview asset exists in R2, delete it (idempotent)
  if (video.backgroundPreviewKey) {
    try {
      await deleteAssetObject(video.backgroundPreviewKey);
    } catch (error) {
      console.error(
        `[R2 Asset Cleanup] Error deleting preview key ${video.backgroundPreviewKey}:`,
        error
      );
    }
  }

  // 4. Delete database record (cascades to videoPlayerSettings)
  await db
    .delete(videos)
    .where(and(eq(videos.id, videoId), eq(videos.accountId, accountId)));

  return { success: true };
}
