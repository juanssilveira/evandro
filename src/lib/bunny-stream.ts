import crypto from "crypto";

export interface BunnyConfig {
  libraryId: string;
  apiKey: string;
  cdnHostname: string;
  tusTtlSeconds: number;
}

export function getBunnyConfig(): BunnyConfig {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = process.env.BUNNY_STREAM_API_KEY;
  const cdnHostname = process.env.BUNNY_STREAM_CDN_HOSTNAME;
  const tusTtlSeconds = parseInt(
    process.env.BUNNY_STREAM_TUS_TTL_SECONDS || "21600",
    10
  );

  if (!libraryId || !apiKey) {
    throw new Error(
      "Bunny Stream credentials (BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_API_KEY) are not configured."
    );
  }

  return {
    libraryId: libraryId.trim(),
    apiKey: apiKey.trim(),
    cdnHostname: (cdnHostname || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, ""),
    tusTtlSeconds: Number.isFinite(tusTtlSeconds) && tusTtlSeconds > 0 ? tusTtlSeconds : 21600,
  };
}

export interface BunnyVideoResponse {
  videoLibraryId: number;
  guid: string;
  title: string;
  dateUploaded?: string;
  views?: number;
  isPublic?: boolean;
  length?: number; // duration in seconds
  status: number; // VideoModelStatus
  framerate?: number;
  width?: number;
  height?: number;
  availableResolutions?: string;
  thumbnailCount?: number;
  encodeProgress?: number;
  storageSize?: number;
  captions?: unknown[];
  hasSubtitles?: boolean;
  averageWatchTime?: number;
  totalWatchTime?: number;
  category?: string;
  chapters?: unknown[];
  moments?: unknown[];
  metaTags?: unknown[];
  transcodingMessages?: unknown[];
  thumbnailFileName?: string;
}

/**
 * Bunny Stream VideoModelStatus enum values:
 * 0: Created
 * 1: Uploaded
 * 2: Processing
 * 3: Transcoding
 * 4: Finished (Ready)
 * 5: Error
 * 6: UploadFailed
 */
export const BUNNY_VIDEO_STATUS = {
  CREATED: 0,
  UPLOADED: 1,
  PROCESSING: 2,
  TRANSCODING: 3,
  FINISHED: 4,
  ERROR: 5,
  UPLOAD_FAILED: 6,
} as const;

export async function createBunnyVideo(params: {
  title: string;
}): Promise<BunnyVideoResponse> {
  const { libraryId, apiKey } = getBunnyConfig();

  const response = await fetch(
    `https://video.bunnycdn.com/library/${libraryId}/videos`,
    {
      method: "POST",
      headers: {
        AccessKey: apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        title: params.title,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Bunny Stream API error (status ${response.status}): ${errorText || response.statusText}`
    );
  }

  const data = (await response.json()) as BunnyVideoResponse;
  if (!data.guid) {
    throw new Error("Bunny Stream did not return a valid video GUID.");
  }

  return data;
}

export async function getBunnyVideo(
  videoId: string
): Promise<BunnyVideoResponse | null> {
  const { libraryId, apiKey } = getBunnyConfig();

  const response = await fetch(
    `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
    {
      method: "GET",
      headers: {
        AccessKey: apiKey,
        Accept: "application/json",
      },
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Bunny Stream API error (status ${response.status}): ${errorText || response.statusText}`
    );
  }

  return (await response.json()) as BunnyVideoResponse;
}

export async function deleteBunnyVideo(videoId: string): Promise<boolean> {
  try {
    const { libraryId, apiKey } = getBunnyConfig();

    const response = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
      {
        method: "DELETE",
        headers: {
          AccessKey: apiKey,
          Accept: "application/json",
        },
      }
    );

    if (response.status === 404 || response.ok) {
      return true;
    }

    const errorText = await response.text().catch(() => "");
    console.error(
      `[Bunny Cleanup] Failed to delete video ${videoId} (status ${response.status}): ${errorText}`
    );
    return false;
  } catch (error) {
    console.error(`[Bunny Cleanup] Error deleting video ${videoId}:`, error);
    return false;
  }
}

export interface BunnyTusCredentials {
  endpoint: string;
  headers: {
    AuthorizationSignature: string;
    AuthorizationExpire: string;
    VideoId: string;
    LibraryId: string;
  };
  videoId: string;
}

export function createBunnyTusCredentials(videoId: string): BunnyTusCredentials {
  const { libraryId, apiKey, tusTtlSeconds } = getBunnyConfig();

  const expiration = Math.floor(Date.now() / 1000) + tusTtlSeconds;
  const toHash = `${libraryId}${apiKey}${expiration}${videoId}`;
  const signature = crypto.createHash("sha256").update(toHash).digest("hex");

  return {
    endpoint: "https://video.bunnycdn.com/tusupload",
    headers: {
      AuthorizationSignature: signature,
      AuthorizationExpire: expiration.toString(),
      VideoId: videoId,
      LibraryId: libraryId,
    },
    videoId,
  };
}

export function getBunnyCdnHostname(): string {
  const configured = process.env.BUNNY_STREAM_CDN_HOSTNAME;
  if (configured && configured.trim().length > 0) {
    return configured.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
  return "vz-video.b-cdn.net";
}

export function getBunnyHlsUrl(videoId: string, cdnHost?: string): string {
  const host = cdnHost || getBunnyCdnHostname();
  return `https://${host}/${videoId}/playlist.m3u8`;
}

export function getBunnyPosterUrl(
  videoId: string,
  thumbnailFileName?: string | null,
  cdnHost?: string
): string {
  const host = cdnHost || getBunnyCdnHostname();
  const file = thumbnailFileName || "thumbnail.jpg";
  return `https://${host}/${videoId}/${file}`;
}

export function getBunnyPreviewUrl(videoId: string, cdnHost?: string): string {
  const host = cdnHost || getBunnyCdnHostname();
  return `https://${host}/${videoId}/preview.webp`;
}
