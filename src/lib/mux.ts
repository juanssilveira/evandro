import Mux from "@mux/mux-node";

function getMuxConfig() {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) {
    throw new Error(
      "Mux credentials (MUX_TOKEN_ID, MUX_TOKEN_SECRET) are not properly configured."
    );
  }

  return { tokenId, tokenSecret };
}

let muxClientInstance: Mux | null = null;

export function getMuxClient(): Mux {
  if (!muxClientInstance) {
    const { tokenId, tokenSecret } = getMuxConfig();
    muxClientInstance = new Mux({
      tokenId,
      tokenSecret,
    });
  }
  return muxClientInstance;
}

export function getCorsOrigin(): string {
  const baseUrl = process.env.BASE_URL;
  if (baseUrl && baseUrl.trim().length > 0) {
    return baseUrl.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

export async function createMuxDirectUpload(params: {
  videoId: string;
  corsOrigin?: string;
}): Promise<{ uploadId: string; uploadUrl: string }> {
  const mux = getMuxClient();
  const origin = params.corsOrigin || getCorsOrigin();

  const upload = await mux.video.uploads.create({
    cors_origin: origin,
    new_asset_settings: {
      playback_policy: ["public"],
      video_quality: "basic",
      passthrough: params.videoId,
    },
  });

  if (!upload.url) {
    throw new Error("Mux did not return a valid direct upload URL.");
  }

  return {
    uploadId: upload.id,
    uploadUrl: upload.url,
  };
}

export async function getMuxDirectUpload(uploadId: string) {
  const mux = getMuxClient();
  return await mux.video.uploads.retrieve(uploadId);
}

export async function getMuxAsset(assetId: string) {
  const mux = getMuxClient();
  return await mux.video.assets.retrieve(assetId);
}

export async function deleteMuxAsset(assetId: string): Promise<boolean> {
  const mux = getMuxClient();
  try {
    await mux.video.assets.delete(assetId);
    return true;
  } catch (error: unknown) {
    // If asset already not found / 404, treat as idempotent success
    const isNotFound =
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error as { status: number }).status === 404;

    if (isNotFound) {
      return true;
    }

    console.error(`[Mux Cleanup] Failed to delete asset ${assetId}:`, error);
    return false;
  }
}

export function getHlsPlaybackUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}
