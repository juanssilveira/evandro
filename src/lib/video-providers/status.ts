import { db } from "@/db";
import { videos } from "@/db/schema";
import { sql } from "drizzle-orm";

export interface VideoProviderConfigStatus {
  configured: boolean;
}

export interface VideoProvidersConfigurationStatus {
  mux: VideoProviderConfigStatus;
  bunny: VideoProviderConfigStatus;
}

export interface VideoCountsByProvider {
  mux: number;
  bunny: number;
  total: number;
}

/**
 * Validates server-side whether each video provider has its required
 * environment credentials present.
 * NEVER returns credential values to the client, only boolean status.
 */
export function getVideoProviderConfigurationStatus(): VideoProvidersConfigurationStatus {
  const muxTokenId = process.env.MUX_TOKEN_ID;
  const muxTokenSecret = process.env.MUX_TOKEN_SECRET;

  const isMuxConfigured = Boolean(
    muxTokenId &&
    muxTokenId.trim().length > 0 &&
    muxTokenSecret &&
    muxTokenSecret.trim().length > 0
  );

  const bunnyLibraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const bunnyApiKey = process.env.BUNNY_STREAM_API_KEY;
  const bunnyCdnHostname = process.env.BUNNY_STREAM_CDN_HOSTNAME;

  const isBunnyConfigured = Boolean(
    bunnyLibraryId &&
    bunnyLibraryId.trim().length > 0 &&
    bunnyApiKey &&
    bunnyApiKey.trim().length > 0 &&
    bunnyCdnHostname &&
    bunnyCdnHostname.trim().length > 0
  );

  return {
    mux: {
      configured: isMuxConfigured,
    },
    bunny: {
      configured: isBunnyConfigured,
    },
  };
}

/**
 * Queries the total videos per provider directly from the database (videos.provider).
 * Does not call external APIs.
 */
export async function getVideoCountsByProvider(): Promise<VideoCountsByProvider> {
  const counts = await db
    .select({
      provider: videos.provider,
      count: sql<number>`count(*)::int`,
    })
    .from(videos)
    .groupBy(videos.provider);

  let muxCount = 0;
  let bunnyCount = 0;

  for (const row of counts) {
    if (row.provider === "mux") {
      muxCount += row.count;
    } else if (row.provider === "bunny") {
      bunnyCount += row.count;
    }
  }

  return {
    mux: muxCount,
    bunny: bunnyCount,
    total: muxCount + bunnyCount,
  };
}
