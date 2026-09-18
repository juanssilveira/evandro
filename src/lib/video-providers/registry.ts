import type { VideoProviderAdapter, VideoProviderName } from "./types";
import { muxVideoProvider } from "./mux-provider";
import { bunnyVideoProvider } from "./bunny-provider";
import type { Video } from "@/db/schema/videos";

const providers: Record<VideoProviderName, VideoProviderAdapter> = {
  mux: muxVideoProvider,
  bunny: bunnyVideoProvider,
};

export function getVideoProvider(
  providerName: VideoProviderName | string
): VideoProviderAdapter {
  const provider = providers[providerName as VideoProviderName];
  if (!provider) {
    throw new Error(
      `Unsupported or unknown video provider: "${providerName}". Supported providers are: ${Object.keys(providers).join(", ")}.`
    );
  }
  return provider;
}

export function getVideoPlaybackUrl(video: Video): string | null {
  const provider = getVideoProvider(video.provider || "mux");
  return provider.getPlaybackUrl(video);
}

export function getVideoPosterUrl(video: Video): string | null {
  const provider = getVideoProvider(video.provider || "mux");
  return provider.getPosterUrl(video);
}

export function getVideoBackgroundPreviewUrl(video: Video): string | null {
  const provider = getVideoProvider(video.provider || "mux");
  return provider.getBackgroundPreviewUrl(video);
}
