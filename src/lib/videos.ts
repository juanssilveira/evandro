import { db } from "@/db";
import { videos, type Video } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  generatePresignedUploadUrl,
  getVideoStorageKey,
  verifyObjectExists,
  deleteObjectFromR2,
} from "@/lib/r2";
import type { CreateUploadInput, FinalizeUploadInput } from "@/lib/validations/videos";

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
): Promise<{ videoId: string; uploadUrl: string }> {
  const videoId = crypto.randomUUID();

  const uploadUrl = await generatePresignedUploadUrl({
    accountId,
    videoId,
    mimeType: input.mimeType,
    expiresIn: 900,
  });

  return { videoId, uploadUrl };
}

export async function finalizeVideoUpload(
  accountId: string,
  input: FinalizeUploadInput
): Promise<{ success: boolean; video?: Video; error?: string }> {
  const storageKey = getVideoStorageKey(accountId, input.videoId);

  // Check if video already exists (retry safety)
  const [existingVideo] = await db
    .select()
    .from(videos)
    .where(eq(videos.id, input.videoId))
    .limit(1);

  if (existingVideo) {
    return { success: true, video: existingVideo };
  }

  // Verify object actually exists in R2
  const exists = await verifyObjectExists(storageKey);
  if (!exists) {
    return {
      success: false,
      error: "O arquivo do vídeo não foi encontrado no storage.",
    };
  }

  const [newVideo] = await db
    .insert(videos)
    .values({
      id: input.videoId,
      publicId: crypto.randomUUID(),
      accountId,
      title: input.title,
      storageKey,
      originalFilename: input.originalFilename,
      mimeType: "video/mp4",
      sizeBytes: input.sizeBytes,
    })
    .returning();

  return { success: true, video: newVideo };
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
  // 1. Verify existence and ownership, retrieving storageKey from DB
  const video = await getVideoForAccount(videoId, accountId);
  if (!video) {
    return {
      success: false,
      error: "Vídeo não encontrado ou não pertence a esta conta.",
    };
  }

  const storageKey = video.storageKey;

  // 2. Delete database record (cascades to videoPlayerSettings)
  await db
    .delete(videos)
    .where(and(eq(videos.id, videoId), eq(videos.accountId, accountId)));

  // 3. Delete object from Cloudflare R2
  try {
    await deleteObjectFromR2(storageKey);
  } catch (error) {
    console.error(`[R2 Cleanup] Failed to delete object ${storageKey}:`, error);
  }

  return { success: true };
}
