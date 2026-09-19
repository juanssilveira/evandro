import type {
  VideoProviderAdapter,
  ProviderCreateUploadInput,
  ProviderUploadSession,
  ProviderVideoState,
} from "./types";
import type { Video } from "@/db/schema/videos";
import {
  createMuxDirectUpload,
  getMuxDirectUpload,
  getMuxAsset,
  deleteMuxAsset,
  getMuxClient,
} from "@/lib/mux";
import { PRO_PLAN } from "@/lib/plans/catalog";

export class MuxVideoProvider implements VideoProviderAdapter {
  readonly name = "mux" as const;

  async createUploadSession(
    input: ProviderCreateUploadInput
  ): Promise<ProviderUploadSession> {
    const { uploadId, uploadUrl } = await createMuxDirectUpload({
      videoId: input.videoId,
      corsOrigin: input.corsOrigin,
    });

    return {
      provider: "mux",
      transport: "put",
      uploadUrl,
      uploadId,
    };
  }

  async syncVideo(video: Video): Promise<ProviderVideoState> {
    let currentAssetId = video.providerVideoId || video.muxAssetId;
    const uploadId = video.providerUploadId || video.muxUploadId;

    // Step A: If assetId is not known yet, check Direct Upload status in Mux
    if (!currentAssetId && uploadId) {
      try {
        const upload = await getMuxDirectUpload(uploadId);

        if (upload.status === "asset_created" && upload.asset_id) {
          currentAssetId = upload.asset_id;
        } else if (upload.status === "errored") {
          return {
            status: "errored",
            errorMessage: upload.error?.message || "Erro no upload do vídeo.",
          };
        }
      } catch (error) {
        console.error(`[Mux Sync] Failed to retrieve direct upload ${uploadId}:`, error);
      }
    }

    // Step B: If assetId is known, check Asset status in Mux
    if (currentAssetId) {
      try {
        const asset = await getMuxAsset(currentAssetId);

        const duration =
          typeof asset.duration === "number" && Number.isFinite(asset.duration)
            ? asset.duration
            : null;

        // Duration limit check (20 minutes for Pro plan)
        if (
          duration !== null &&
          duration > PRO_PLAN.limits.maxVideoDurationSeconds
        ) {
          try {
            await deleteMuxAsset(currentAssetId);
          } catch (cleanupErr) {
            console.error(
              `[Mux Cleanup] Error deleting oversized asset ${currentAssetId}:`,
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

        if (asset.status === "ready") {
          const publicPlayback = asset.playback_ids?.find(
            (p) => p.policy === "public"
          );
          let playbackId = publicPlayback?.id || null;

          if (!playbackId && currentAssetId) {
            try {
              const mux = getMuxClient();
              const newPlayback = await mux.video.assets.createPlaybackId(
                currentAssetId,
                { policy: "public" }
              );
              playbackId = newPlayback.id;
            } catch (createErr) {
              console.error(
                `[Mux Sync] Failed to create public playback ID for asset ${currentAssetId}:`,
                createErr
              );
            }
          }

          return {
            status: "ready",
            providerVideoId: currentAssetId,
            providerPlaybackId: playbackId,
            duration,
            errorMessage: null,
          };
        }

        if (asset.status === "errored") {
          const errorMsg =
            asset.errors?.messages?.[0] || "Erro no processamento do vídeo.";

          return {
            status: "errored",
            providerVideoId: currentAssetId,
            errorMessage: errorMsg,
          };
        }

        if (asset.status === "preparing") {
          return {
            status: "processing",
            providerVideoId: currentAssetId,
            duration,
          };
        }
      } catch (error) {
        console.error(`[Mux Sync] Failed to retrieve asset ${currentAssetId}:`, error);
      }
    }

    return {
      status: (video.status as ProviderVideoState["status"]) || "waiting_upload",
      duration: video.duration,
      providerVideoId: currentAssetId,
      providerPlaybackId: video.providerPlaybackId || video.muxPlaybackId,
    };
  }

  getPlaybackUrl(video: Video): string | null {
    const playbackId = video.providerPlaybackId || video.muxPlaybackId;
    if (!playbackId) return null;
    return `https://stream.mux.com/${playbackId}.m3u8`;
  }

  getPosterUrl(video: Video): string | null {
    const playbackId = video.providerPlaybackId || video.muxPlaybackId;
    if (!playbackId) return null;
    return `https://image.mux.com/${playbackId}/thumbnail.webp?width=640`;
  }

  getBackgroundPreviewUrl(video: Video): string | null {
    const playbackId = video.providerPlaybackId || video.muxPlaybackId;
    if (!playbackId) return null;
    const rawDuration =
      typeof video.duration === "number" &&
      Number.isFinite(video.duration) &&
      video.duration > 0
        ? video.duration
        : 6;
    const previewEnd = Math.max(1, Math.min(6, Math.floor(rawDuration)));
    return `https://image.mux.com/${playbackId}/animated.webp?start=0&end=${previewEnd}&width=480&fps=8`;
  }

  async deleteVideo(video: Video): Promise<void> {
    const assetId = video.providerVideoId || video.muxAssetId;
    if (assetId) {
      await deleteMuxAsset(assetId);
    }
  }
}

export const muxVideoProvider = new MuxVideoProvider();
