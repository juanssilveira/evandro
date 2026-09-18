import type { VideoProviderName } from "./types";

/**
 * Returns the default video provider for NEW uploads.
 * In this spec (040), the default continues to be "mux".
 * Future specs will allow configuring this through the admin /dev panel.
 */
export function getDefaultVideoProviderName(): VideoProviderName {
  return "mux";
}
