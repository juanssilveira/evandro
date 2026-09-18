import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { VideoProviderName } from "@/lib/video-providers/types";

export const DEFAULT_VIDEO_PROVIDER_KEY = "default_video_provider";

/**
 * Retrieves a generic setting value from the app_settings table.
 */
export async function getAppSetting(key: string, targetDb = db): Promise<string | null> {
  try {
    const [row] = await targetDb
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);

    return row?.value ?? null;
  } catch (err) {
    console.error(`[App Settings] Error reading key "${key}":`, err);
    return null;
  }
}

/**
 * Upserts a generic setting value into the app_settings table.
 */
export async function setAppSetting(key: string, value: string, targetDb = db): Promise<void> {
  const now = new Date();
  await targetDb
    .insert(appSettings)
    .values({
      key,
      value,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value,
        updatedAt: now,
      },
    });
}

/**
 * Retrieves the currently configured default video provider for new uploads.
 * If not set or invalid, safely defaults to "mux" and warns if invalid.
 */
export async function getDefaultVideoProviderSetting(targetDb = db): Promise<VideoProviderName> {
  const rawValue = await getAppSetting(DEFAULT_VIDEO_PROVIDER_KEY, targetDb);

  if (!rawValue) {
    return "mux";
  }

  const trimmed = rawValue.trim().toLowerCase();
  if (trimmed === "mux" || trimmed === "bunny") {
    return trimmed;
  }

  console.warn(
    `[App Settings] Invalid default_video_provider "${rawValue}" found in database. Falling back to "mux".`
  );
  return "mux";
}

/**
 * Persists the default video provider setting.
 * Accepts only "mux" or "bunny".
 */
export async function setDefaultVideoProviderSetting(
  provider: VideoProviderName,
  targetDb = db
): Promise<void> {
  if (provider !== "mux" && provider !== "bunny") {
    throw new Error(`Invalid video provider: "${provider}". Expected "mux" or "bunny".`);
  }

  await setAppSetting(DEFAULT_VIDEO_PROVIDER_KEY, provider, targetDb);
}
