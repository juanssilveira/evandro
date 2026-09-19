import { db } from "@/db";
import { videos, folders, videoPlayerSettings, type Video, type Folder } from "@/db/schema";
import { eq, desc, and, sql, isNull } from "drizzle-orm";
import { generateAndStoreBackgroundPreview } from "@/lib/background-preview";
import { deleteAssetObject } from "@/lib/asset-storage/r2";
import type { CreateUploadInput } from "@/lib/validations/videos";
import { PRO_PLAN } from "@/lib/plans/catalog";
import { parsePlayerConfig } from "@/types/player-config";
import {
  getDefaultVideoProviderName,
  getVideoProvider,
  type ProviderUploadSession,
} from "@/lib/video-providers";

export async function getVideosForAccount(
  accountId: string,
  folderId?: string | null
): Promise<Video[]> {
  const conditions = [eq(videos.accountId, accountId)];

  if (folderId === null) {
    conditions.push(isNull(videos.folderId));
  } else if (typeof folderId === "string") {
    conditions.push(eq(videos.folderId, folderId));
  }

  return await db
    .select()
    .from(videos)
    .where(and(...conditions))
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

export async function getVideoWithFolderForAccount(
  videoId: string,
  accountId: string
): Promise<{ video: Video; folder: Folder | null } | null> {
  const [row] = await db
    .select({
      video: videos,
      folder: folders,
    })
    .from(videos)
    .leftJoin(folders, eq(videos.folderId, folders.id))
    .where(and(eq(videos.id, videoId), eq(videos.accountId, accountId)))
    .limit(1);

  if (!row) return null;
  return { video: row.video, folder: row.folder };
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
  input: CreateUploadInput,
  maxAllowedVideos: number = PRO_PLAN.limits.maxVideos
): Promise<{
  videoId: string;
  uploadSession: ProviderUploadSession;
  uploadUrl: string;
  muxUploadId: string;
}> {
  const videoId = crypto.randomUUID();
  const publicId = crypto.randomUUID();
  const providerName = await getDefaultVideoProviderName();

  // 1. Concurrency-safe atomic slot reservation inside PostgreSQL transaction
  await db.transaction(async (tx) => {
    // Acquire row-level lock on the account to serialize concurrent video creation requests
    await tx.execute(sql`
      SELECT id FROM accounts WHERE id = ${accountId} FOR UPDATE
    `);

    // Count currently occupied video slots
    const [countRes] = (await tx.execute(sql`
      SELECT count(*)::int AS count
      FROM videos
      WHERE account_id = ${accountId}
        AND status IN ('waiting_upload', 'uploading', 'processing', 'ready')
    `)).rows as Array<{ count: number }>;

    const currentCount = Number(countRes?.count ?? 0);

    if (currentCount >= maxAllowedVideos) {
      throw new Error("VIDEO_LIMIT_REACHED");
    }

    // Insert reserved video record with chosen provider permanently attached
    await tx.insert(videos).values({
      id: videoId,
      publicId,
      accountId,
      folderId: input.folderId || null,
      title: input.title,
      provider: providerName,
      providerUploadId: null,
      providerVideoId: null,
      providerPlaybackId: null,
      providerThumbnailFileName: null,
      muxUploadId: null,
      muxAssetId: null,
      muxPlaybackId: null,
      status: "waiting_upload",
      originalFilename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    });
  });

  // 2. AFTER transaction commits, create upload session with the provider adapter
  try {
    const provider = getVideoProvider(providerName);
    const uploadSession = await provider.createUploadSession({
      videoId,
      title: input.title,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    });

    if (uploadSession.provider === "mux") {
      await db
        .update(videos)
        .set({
          providerUploadId: uploadSession.uploadId,
          muxUploadId: uploadSession.uploadId,
        })
        .where(eq(videos.id, videoId));

      return {
        videoId,
        uploadSession,
        uploadUrl: uploadSession.uploadUrl,
        muxUploadId: uploadSession.uploadId,
      };
    } else {
      await db
        .update(videos)
        .set({
          providerVideoId: uploadSession.videoId,
          providerPlaybackId: uploadSession.videoId,
        })
        .where(eq(videos.id, videoId));

      return {
        videoId,
        uploadSession,
        uploadUrl: "",
        muxUploadId: "",
      };
    }
  } catch (error) {
    // If provider creation fails, clean up reserved slot
    console.error(`[Upload Creation Error] Cleaning up reserved slot ${videoId}:`, error);
    try {
      await db.delete(videos).where(eq(videos.id, videoId));
    } catch (cleanupErr) {
      console.error("[Slot Cleanup Error]", cleanupErr);
    }
    throw error;
  }
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
  if (video.status === "ready") {
    if (
      video.backgroundPreviewStatus !== "ready" &&
      video.backgroundPreviewStatus !== "errored"
    ) {
      await generateAndStoreBackgroundPreview({
        videoId: video.id,
        publicId: video.publicId,
        muxAssetId: video.providerVideoId || video.muxAssetId,
        muxPlaybackId: video.providerPlaybackId || video.muxPlaybackId,
        duration: video.duration,
        video,
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

  // Sync through provider adapter
  const provider = getVideoProvider(video.provider || "mux");
  const state = await provider.syncVideo(video);

  const updatePayload: Partial<typeof videos.$inferInsert> = {
    status: state.status,
  };

  if (state.duration !== undefined) {
    updatePayload.duration = state.duration;
  }
  if (state.providerVideoId !== undefined) {
    updatePayload.providerVideoId = state.providerVideoId;
  }
  if (state.providerPlaybackId !== undefined) {
    updatePayload.providerPlaybackId = state.providerPlaybackId;
  }
  if (state.providerThumbnailFileName !== undefined) {
    updatePayload.providerThumbnailFileName = state.providerThumbnailFileName;
  }
  if (state.errorMessage !== undefined) {
    updatePayload.errorMessage = state.errorMessage;
  }

  // Maintain legacy Mux fields in sync for Mux provider
  if (video.provider === "mux") {
    if (state.providerVideoId !== undefined) {
      updatePayload.muxAssetId = state.providerVideoId;
    }
    if (state.providerPlaybackId !== undefined) {
      updatePayload.muxPlaybackId = state.providerPlaybackId;
    }
  }

  const [updatedVideo] = await db
    .update(videos)
    .set(updatePayload)
    .where(eq(videos.id, videoId))
    .returning();

  // If video transitioned to ready, trigger background preview generation
  if (updatedVideo?.status === "ready") {
    await generateAndStoreBackgroundPreview({
      videoId: updatedVideo.id,
      publicId: updatedVideo.publicId,
      muxAssetId: updatedVideo.providerVideoId || updatedVideo.muxAssetId,
      muxPlaybackId: updatedVideo.providerPlaybackId || updatedVideo.muxPlaybackId,
      duration: updatedVideo.duration,
      video: updatedVideo,
    });

    const [refreshed] = await db
      .select()
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);

    return { success: true, video: refreshed || updatedVideo };
  }

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

  // 2. Extract player config before deletion for R2 asset cleanup
  try {
    const [settingsRow] = await db
      .select({ config: videoPlayerSettings.config })
      .from(videoPlayerSettings)
      .where(eq(videoPlayerSettings.videoId, videoId))
      .limit(1);

    if (settingsRow?.config) {
      const config = parsePlayerConfig(settingsRow.config);
      const startupKey = config.appearance?.thumbnail?.customKey;
      const pauseKey = config.appearance?.pauseThumbnail?.customKey;

      if (startupKey) {
        await deleteAssetObject(startupKey).catch((err) =>
          console.error(`[R2 Asset Cleanup] Error deleting startup thumb key ${startupKey}:`, err)
        );
      }
      if (pauseKey) {
        await deleteAssetObject(pauseKey).catch((err) =>
          console.error(`[R2 Asset Cleanup] Error deleting pause thumb key ${pauseKey}:`, err)
        );
      }
    }
  } catch (error) {
    console.error(`[Player Config Cleanup] Error fetching settings for ${video.id}:`, error);
  }

  // 3. Delegate provider asset cleanup to provider adapter (idempotent)
  try {
    const provider = getVideoProvider(video.provider || "mux");
    await provider.deleteVideo(video);
  } catch (error) {
    console.error(`[Video Provider Cleanup] Error deleting provider asset for ${video.id}:`, error);
  }

  // 4. If derived background preview asset exists in R2, delete it (idempotent)
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

  // 5. Delete database record (cascades to videoPlayerSettings and playSessions)
  await db
    .delete(videos)
    .where(and(eq(videos.id, videoId), eq(videos.accountId, accountId)));

  return { success: true };
}
