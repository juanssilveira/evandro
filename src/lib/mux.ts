import Mux from "@mux/mux-node";

function getMuxConfig() {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  const signingKeyId =
    process.env.MUX_SIGNING_KEY_ID || process.env.MUX_SIGNING_KEY;
  const signingPrivateKey =
    process.env.MUX_SIGNING_PRIVATE_KEY || process.env.MUX_PRIVATE_KEY;
  const ttlSeconds = parseInt(
    process.env.MUX_PLAYBACK_TOKEN_TTL_SECONDS || "3600",
    10
  );

  if (!tokenId || !tokenSecret) {
    throw new Error(
      "Mux credentials (MUX_TOKEN_ID, MUX_TOKEN_SECRET) are not properly configured."
    );
  }

  return {
    tokenId,
    tokenSecret,
    signingKeyId,
    signingPrivateKey,
    ttlSeconds: isNaN(ttlSeconds) || ttlSeconds <= 0 ? 3600 : ttlSeconds,
  };
}

let muxClientInstance: Mux | null = null;

export function getMuxClient(): Mux {
  if (!muxClientInstance) {
    const { tokenId, tokenSecret, signingKeyId, signingPrivateKey } =
      getMuxConfig();
    muxClientInstance = new Mux({
      tokenId,
      tokenSecret,
      jwtSigningKey: signingKeyId,
      jwtPrivateKey: signingPrivateKey,
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
      playback_policy: ["signed"],
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

/**
 * Generates a signed Mux playback URL with JWT token.
 */
export async function getMuxSignedPlaybackUrl(
  playbackId: string,
  customTtlSeconds?: number
): Promise<string> {
  const mux = getMuxClient();
  const { ttlSeconds } = getMuxConfig();
  const ttl = customTtlSeconds || ttlSeconds;

  const token = await mux.jwt.signPlaybackId(playbackId, {
    type: "video",
    expiration: `${ttl}s`,
  });

  return `https://stream.mux.com/${playbackId}.m3u8?token=${token}`;
}

export interface MuxThumbnailOptions {
  width?: number;
  height?: number;
  time?: number;
  fit_mode?: string;
  ttlSeconds?: number;
}

/**
 * Generates a signed Mux thumbnail URL with JWT token.
 */
export async function getMuxSignedThumbnailUrl(
  playbackId: string,
  options?: MuxThumbnailOptions
): Promise<string> {
  const mux = getMuxClient();
  const { ttlSeconds } = getMuxConfig();
  const ttl = options?.ttlSeconds || ttlSeconds;

  const params: Record<string, string> = {};
  if (options?.width) params.width = String(options.width);
  if (options?.height) params.height = String(options.height);
  if (options?.time !== undefined) params.time = String(options.time);
  if (options?.fit_mode) params.fit_mode = options.fit_mode;

  const token = await mux.jwt.signPlaybackId(playbackId, {
    type: "thumbnail",
    expiration: `${ttl}s`,
    params: Object.keys(params).length > 0 ? params : undefined,
  });

  const queryParams = new URLSearchParams({ token, ...params });
  return `https://image.mux.com/${playbackId}/thumbnail.webp?${queryParams.toString()}`;
}

export interface MuxAnimatedOptions {
  width?: number;
  fps?: number;
  start?: number;
  end?: number;
  ttlSeconds?: number;
}

/**
 * Generates a signed Mux animated image URL (webp or gif) with JWT token.
 */
export async function getMuxSignedAnimatedUrl(
  playbackId: string,
  format: "webp" | "gif" = "webp",
  options?: MuxAnimatedOptions
): Promise<string> {
  const mux = getMuxClient();
  const { ttlSeconds } = getMuxConfig();
  const ttl = options?.ttlSeconds || ttlSeconds;

  const params: Record<string, string> = {};
  if (options?.width) params.width = String(options.width);
  if (options?.fps) params.fps = String(options.fps);
  if (options?.start !== undefined) params.start = String(options.start);
  if (options?.end !== undefined) params.end = String(options.end);

  const token = await mux.jwt.signPlaybackId(playbackId, {
    type: "thumbnail",
    expiration: `${ttl}s`,
    params: Object.keys(params).length > 0 ? params : undefined,
  });

  const queryParams = new URLSearchParams({ token, ...params });
  return `https://image.mux.com/${playbackId}/animated.${format}?${queryParams.toString()}`;
}
