import type { Video, VideoStatus, VideoProviderName } from "@/db/schema/videos";

export type { VideoProviderName };

export interface ProviderCreateUploadInput {
  videoId: string;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  corsOrigin?: string;
}

export type ProviderUploadSession =
  | {
      provider: "mux";
      transport: "put";
      uploadUrl: string;
      uploadId: string;
    }
  | {
      provider: "bunny";
      transport: "tus";
      endpoint: string;
      headers: {
        AuthorizationSignature: string;
        AuthorizationExpire: string;
        VideoId: string;
        LibraryId: string;
      };
      videoId: string;
    };

export interface ProviderVideoState {
  status: VideoStatus;
  duration?: number | null;
  providerVideoId?: string | null;
  providerPlaybackId?: string | null;
  providerThumbnailFileName?: string | null;
  errorMessage?: string | null;
}

export interface VideoProviderAdapter {
  readonly name: VideoProviderName;

  createUploadSession(
    input: ProviderCreateUploadInput
  ): Promise<ProviderUploadSession>;

  syncVideo(video: Video): Promise<ProviderVideoState>;

  getPlaybackUrl(video: Video): string | null;

  getPosterUrl(video: Video): string | null;

  getBackgroundPreviewUrl(video: Video): string | null;

  deleteVideo(video: Video): Promise<void>;
}
