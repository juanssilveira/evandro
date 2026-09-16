import { db } from "@/db";
import { videoPlayerSettings } from "@/db/schema";
import { getVideoForAccount } from "@/lib/videos";
import {
  type PlayerConfig,
  type PlayerConfigPatch,
  DEFAULT_PLAYER_CONFIG,
  playerConfigSchema,
  parsePlayerConfig,
} from "@/types/player-config";
import { eq } from "drizzle-orm";

export async function getPlayerConfig(
  videoId: string,
  accountId: string
): Promise<PlayerConfig | null> {
  const video = await getVideoForAccount(videoId, accountId);
  if (!video) {
    return null;
  }

  return getPlayerConfigByVideoId(videoId);
}

export async function getPlayerConfigByVideoId(
  videoId: string
): Promise<PlayerConfig> {
  const [row] = await db
    .select()
    .from(videoPlayerSettings)
    .where(eq(videoPlayerSettings.videoId, videoId))
    .limit(1);

  if (!row) {
    return DEFAULT_PLAYER_CONFIG;
  }

  return parsePlayerConfig(row.config);
}

export async function updatePlayerConfig(
  videoId: string,
  accountId: string,
  patch: PlayerConfigPatch
): Promise<PlayerConfig | null> {
  const video = await getVideoForAccount(videoId, accountId);
  if (!video) {
    return null;
  }

  const current = (await getPlayerConfig(videoId, accountId)) ?? DEFAULT_PLAYER_CONFIG;

  const merged = {
    ...current,
    ...patch,
    appearance: {
      ...current.appearance,
      ...(patch.appearance || {}),
    },
    playback: {
      ...current.playback,
      ...(patch.playback || {}),
    },
    controls: {
      ...current.controls,
      ...(patch.controls || {}),
      fullscreen: {
        ...current.controls.fullscreen,
        ...(patch.controls?.fullscreen || {}),
      },
    },
    progress: {
      ...current.progress,
      ...(patch.progress || {}),
      fake: {
        ...current.progress.fake,
        ...(patch.progress?.fake || {}),
      },
    },
    development: {
      ...current.development,
      ...(patch.development || {}),
    },
  };

  const validatedConfig = playerConfigSchema.parse(merged);

  const [saved] = await db
    .insert(videoPlayerSettings)
    .values({
      videoId,
      config: validatedConfig,
    })
    .onConflictDoUpdate({
      target: videoPlayerSettings.videoId,
      set: {
        config: validatedConfig,
        updatedAt: new Date(),
      },
    })
    .returning();

  return parsePlayerConfig(saved.config);
}
