import type { VideoProviderName } from "./types";
import { getDefaultVideoProviderSetting } from "@/lib/settings/app-settings";

/**
 * Returns the default video provider for NEW uploads from persistent configuration.
 * Safe fallback to "mux" if setting is absent or corrupted.
 */
export async function getDefaultVideoProviderName(): Promise<VideoProviderName> {
  return getDefaultVideoProviderSetting();
}
