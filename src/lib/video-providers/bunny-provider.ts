import type {
  VideoProviderAdapter,
  ProviderCreateUploadInput,
  ProviderUploadSession,
  ProviderVideoState,
} from "./types";
import type { Video } from "@/db/schema/videos";
import {
  createBunnyVideo,
  getBunnyVideo,
  deleteBunnyVideo,
  createBunnyTusCredentials,
  getBunnyHlsUrl,
  getBunnyPosterUrl,
  getBunnyPreviewUrl,
  BUNNY_VIDEO_STATUS,
} from "@/lib/bunny-stream";
import { PRO_PLAN } from "@/lib/plans/catalog";

export class BunnyVideoProvider implements VideoProviderAdapter {
  readonly name = "bunny" as const;

  async createUploadSession(
    input: ProviderCreateUploadInput
  ): Promise<ProviderUploadSession> {
    const bunnyVideo = await createBunnyVideo({
      title: input.title,
    });

    const credentials = createBunnyTusCredentials(bunnyVideo.guid);

    return {
      provider: "bunny",
      transport: "tus",
      endpoint: credentials.endpoint,
      headers: credentials.headers,
      videoId: bunnyVideo.guid,
    };
  }

  async syncVideo(video: Video): Promise<ProviderVideoState> {
    const bunnyVideoId = video.providerVideoId;
    if (!bunnyVideoId) {
      return {
        status: (video.status as ProviderVideoState["status"]) || "waiting_upload",
        duration: video.duration,
      };
    }

    try {
      const bunnyVideo = await getBunnyVideo(bunnyVideoId);

      if (!bunnyVideo) {
        return {
          status: "errored",
          providerVideoId: bunnyVideoId,
          errorMessage: "Vídeo não encontrado no Bunny Stream.",
        };
      }

      const duration =
        typeof bunnyVideo.length === "number" && Number.isFinite(bunnyVideo.length)
          ? bunnyVideo.length
          : video.duration;

      // Duration limit check (20 minutes for Pro plan)
      if (
        duration !== null &&
        duration !== undefined &&
        duration > PRO_PLAN.limits.maxVideoDurationSeconds
      ) {
        try {
          await deleteBunnyVideo(bunnyVideoId);
        } catch (cleanupErr) {
          console.error(
            `[Bunny Cleanup] Error deleting oversized video ${bunnyVideoId}:`,
            cleanupErr
          );
        }

        return {
          status: "errored",
          duration,
          providerVideoId: null,
          providerPlaybackId: null,
          errorMessage:
            "Este vídeo ultrapassa o limite de 20 minutos do seu plano.",
        };
      }

      // Map Bunny VideoModelStatus
      switch (bunnyVideo.status) {
        case BUNNY_VIDEO_STATUS.FINISHED:
          return {
            status: "ready",
            providerVideoId: bunnyVideo.guid,
            providerPlaybackId: bunnyVideo.guid,
            providerThumbnailFileName:
              bunnyVideo.thumbnailFileName || "thumbnail.jpg",
            duration,
            errorMessage: null,
          };

        case BUNNY_VIDEO_STATUS.ERROR:
        case BUNNY_VIDEO_STATUS.UPLOAD_FAILED:
          return {
            status: "errored",
            providerVideoId: bunnyVideo.guid,
            duration,
            errorMessage: "Erro no processamento do vídeo.",
          };

        case BUNNY_VIDEO_STATUS.UPLOADED:
        case BUNNY_VIDEO_STATUS.PROCESSING:
        case BUNNY_VIDEO_STATUS.TRANSCODING:
          return {
            status: "processing",
            providerVideoId: bunnyVideo.guid,
            providerPlaybackId: bunnyVideo.guid,
            providerThumbnailFileName: bunnyVideo.thumbnailFileName,
            duration,
          };

        case BUNNY_VIDEO_STATUS.CREATED:
        default:
          return {
            status:
              video.status === "uploading"
                ? "uploading"
                : "waiting_upload",
            providerVideoId: bunnyVideo.guid,
            providerPlaybackId: bunnyVideo.guid,
            duration,
          };
      }
    } catch (error) {
      console.error(`[Bunny Sync] Failed to retrieve video ${bunnyVideoId}:`, error);
      return {
        status: (video.status as ProviderVideoState["status"]) || "waiting_upload",
        duration: video.duration,
        providerVideoId: bunnyVideoId,
        providerPlaybackId: video.providerPlaybackId,
      };
    }
  }

  getPlaybackUrl(video: Video): string | null {
    const videoId = video.providerVideoId || video.providerPlaybackId;
    if (!videoId) return null;
    return getBunnyHlsUrl(videoId);
  }

  getPosterUrl(video: Video): string | null {
    const videoId = video.providerVideoId || video.providerPlaybackId;
    if (!videoId) return null;
    return getBunnyPosterUrl(videoId, video.providerThumbnailFileName);
  }

  getBackgroundPreviewUrl(video: Video): string | null {
    const videoId = video.providerVideoId || video.providerPlaybackId;
    if (!videoId) return null;
    return getBunnyPreviewUrl(videoId);
  }

  async deleteVideo(video: Video): Promise<void> {
    const videoId = video.providerVideoId;
    if (videoId) {
      await deleteBunnyVideo(videoId);
    }
  }
}

export const bunnyVideoProvider = new BunnyVideoProvider();
