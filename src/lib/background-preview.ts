import { putAssetObject, getAssetPublicUrl } from "./asset-storage/r2";
import { db } from "@/db";
import { videos, type Video } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getVideoBackgroundPreviewUrl } from "./video-providers";

export interface GenerateBackgroundPreviewParams {
  videoId: string;
  publicId?: string;
  muxAssetId?: string | null;
  muxPlaybackId?: string | null;
  duration?: number | null;
  video?: Video;
}

export function getMuxPosterUrl(playbackId: string): string {
  return `https://image.mux.com/${playbackId}/thumbnail.webp?width=640`;
}

export function getMuxFallbackAnimatedPreviewUrl(
  playbackId: string,
  duration?: number | null
): string {
  const rawDuration =
    typeof duration === "number" && Number.isFinite(duration) && duration > 0
      ? duration
      : 6;
  const previewEnd = Math.max(1, Math.min(6, Math.floor(rawDuration)));
  return `https://image.mux.com/${playbackId}/animated.webp?start=0&end=${previewEnd}&width=480&fps=8`;
}

/**
 * Generates and stores a lightweight animated background preview in R2.
 * Server-side generation using provider animated image / preview API.
 * Idempotent and fails gracefully without blocking video readiness.
 */
export async function generateAndStoreBackgroundPreview(
  params: GenerateBackgroundPreviewParams
): Promise<{ success: boolean; key?: string; url?: string; error?: string }> {
  const videoId = params.videoId;

  // Retrieve current video if not passed directly
  let targetVideo: Video | null = params.video || null;
  if (!targetVideo) {
    const [row] = await db
      .select()
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);
    targetVideo = row || null;
  }

  if (!targetVideo) {
    return {
      success: false,
      error: "Vídeo não encontrado.",
    };
  }

  const providerName = targetVideo.provider || "mux";
  const publicId = targetVideo.publicId;
  const providerVideoId =
    targetVideo.providerVideoId ||
    targetVideo.muxAssetId ||
    targetVideo.providerPlaybackId ||
    targetVideo.id;

  try {
    let previewSourceUrl = getVideoBackgroundPreviewUrl(targetVideo);

    if (!previewSourceUrl) {
      // Legacy fallback for Mux
      const playbackId = targetVideo.providerPlaybackId || targetVideo.muxPlaybackId;
      if (playbackId) {
        previewSourceUrl = getMuxFallbackAnimatedPreviewUrl(
          playbackId,
          targetVideo.duration
        );
      }
    }

    if (!previewSourceUrl) {
      return {
        success: false,
        error: "Fonte de background preview indisponível.",
      };
    }

    let format = "webp";
    let contentType = "image/webp";
    const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

    let response = await fetch(previewSourceUrl, {
      headers: {
        Accept: "image/webp,image/*,*/*",
        Referer: `${baseUrl}/`,
        Origin: baseUrl,
      },
    });

    // Fallback to GIF for Mux if WebP fails
    if (!response.ok && providerName === "mux") {
      const playbackId = targetVideo.providerPlaybackId || targetVideo.muxPlaybackId;
      if (playbackId) {
        const rawDuration =
          typeof targetVideo.duration === "number" &&
          Number.isFinite(targetVideo.duration) &&
          targetVideo.duration > 0
            ? targetVideo.duration
            : 6;
        const previewEnd = Math.max(1, Math.min(6, Math.floor(rawDuration)));
        const gifUrl = `https://image.mux.com/${playbackId}/animated.gif?start=0&end=${previewEnd}&width=480&fps=8`;
        response = await fetch(gifUrl, {
          headers: {
            Referer: `${baseUrl}/`,
            Origin: baseUrl,
          },
        });
        if (response.ok) {
          format = "gif";
          contentType = "image/gif";
        }
      }
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      const errorMsg = `Provider animated image API returned status ${response.status}: ${errText}`;
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
      throw new Error("Received empty buffer from provider preview API.");
    }

    // Provider-neutral versioned key in R2
    const key = `background-previews/${publicId}/${providerName}-${providerVideoId}.${format}`;

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
    console.error(
      `[Background Preview] Error generating preview for videoId=${videoId}:`,
      error
    );

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
