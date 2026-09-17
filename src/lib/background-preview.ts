import { putAssetObject, getAssetPublicUrl } from "./asset-storage/r2";
import { db } from "@/db";
import { videos } from "@/db/schema";
import { eq } from "drizzle-orm";

import {
  getMuxSignedThumbnailUrl,
  getMuxSignedAnimatedUrl,
} from "./mux";

export interface GenerateBackgroundPreviewParams {
  videoId: string;
  publicId: string;
  muxAssetId: string;
  muxPlaybackId: string;
  duration?: number | null;
}

export async function getMuxPosterUrl(playbackId: string): Promise<string> {
  return await getMuxSignedThumbnailUrl(playbackId, { width: 640 });
}

export async function getMuxFallbackAnimatedPreviewUrl(
  playbackId: string,
  duration?: number | null
): Promise<string> {
  const rawDuration =
    typeof duration === "number" && Number.isFinite(duration) && duration > 0
      ? duration
      : 10;
  const previewEnd = Math.max(1, Math.min(10, Math.floor(rawDuration)));
  return await getMuxSignedAnimatedUrl(playbackId, "webp", {
    start: 0,
    end: previewEnd,
    width: 640,
    fps: 12,
  });
}

/**
 * Generates and stores a lightweight animated background preview in R2.
 * Server-side generation using Mux Animated Image API with signed JWT.
 * Idempotent and fails gracefully without blocking video readiness.
 */
export async function generateAndStoreBackgroundPreview(
  params: GenerateBackgroundPreviewParams
): Promise<{ success: boolean; key?: string; url?: string; error?: string }> {
  const { videoId, publicId, muxAssetId, muxPlaybackId, duration } = params;

  if (!muxPlaybackId || !muxAssetId) {
    return {
      success: false,
      error: "Mux Playback ID or Asset ID missing.",
    };
  }

  // Calculate preview end time: Mux maximum duration is 10s, clamped to video duration
  const rawDuration = typeof duration === "number" && Number.isFinite(duration) && duration > 0 ? duration : 10;
  const previewEnd = Math.max(1, Math.min(10, Math.floor(rawDuration)));

  try {
    // 1. Try Animated WebP first (preferred for bandwidth & performance)
    let format = "webp";
    let contentType = "image/webp";
    let apiUrl = await getMuxSignedAnimatedUrl(muxPlaybackId, "webp", {
      start: 0,
      end: previewEnd,
      width: 640,
      fps: 12,
    });

    let response = await fetch(apiUrl, {
      headers: {
        Accept: "image/webp,image/*,*/*",
      },
    });

    // 2. Fallback to Animated GIF if WebP fails or is unavailable
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.warn(
        `[Background Preview] WebP endpoint returned ${response.status} (${errText}) for playbackId=${muxPlaybackId}. Trying GIF fallback...`
      );
      format = "gif";
      contentType = "image/gif";
      apiUrl = await getMuxSignedAnimatedUrl(muxPlaybackId, "gif", {
        start: 0,
        end: previewEnd,
        width: 640,
        fps: 12,
      });
      response = await fetch(apiUrl);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      const errorMsg = `Mux animated image API returned status ${response.status}: ${errText}`;
      console.error(`[Background Preview] Failed: ${errorMsg}`);

      await db
        .update(videos)
        .set({ backgroundPreviewStatus: "errored" })
        .where(eq(videos.id, videoId));

      return { success: false, error: errorMsg };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      throw new Error("Received empty buffer from Mux animated image API.");
    }

    // 3. Imutable versioned key tied to publicId and muxAssetId
    const key = `background-previews/${publicId}/${muxAssetId}.${format}`;

    // 4. Store in R2 with immutable caching
    const uploaded = await putAssetObject({
      key,
      body: buffer,
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    });

    if (!uploaded) {
      console.warn(
        `[Background Preview] R2 storage unavailable or upload failed for key=${key}. Marking status as errored for poster fallback.`
      );
      await db
        .update(videos)
        .set({
          backgroundPreviewStatus: "errored",
        })
        .where(eq(videos.id, videoId));

      return {
        success: false,
        error: "R2 storage unavailable.",
      };
    }

    // 5. Update database record with ready status and key
    await db
      .update(videos)
      .set({
        backgroundPreviewStatus: "ready",
        backgroundPreviewKey: key,
      })
      .where(eq(videos.id, videoId));

    const publicUrl = getAssetPublicUrl(key);
    console.log(
      `[Background Preview] Successfully generated and stored (${(buffer.length / 1024).toFixed(1)} KB): ${publicUrl}`
    );

    return {
      success: true,
      key,
      url: publicUrl,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Background Preview] Error generating preview for videoId=${videoId}:`, error);

    try {
      await db
        .update(videos)
        .set({ backgroundPreviewStatus: "errored" })
        .where(eq(videos.id, videoId));
    } catch {
      // Ignore DB write error during exception handler
    }

    return { success: false, error: errorMsg };
  }
}
