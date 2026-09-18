/**
 * Evandro Player Startup ABR Configuration Helper
 * Pure, isolated functions for HLS startup ABR optimization, initial bandwidth seeding,
 * and provider-origin session bandwidth memory.
 */

export const DEFAULT_INITIAL_BANDWIDTH_SEED = 500_000; // 500 kbps
export const MIN_BANDWIDTH_SEED = 500_000; // 500 kbps floor
export const MAX_BANDWIDTH_SEED = 5_000_000; // 5 Mbps seed ceiling
export const CONSERVATIVE_FACTOR = 0.7; // 70% of measured bandwidth for subsequent startup
export const BANDWIDTH_STORAGE_PREFIX = "evandro-player:hls-bandwidth:v1:";

/**
 * Extracts provider origin and builds a unique sessionStorage key.
 * Guarantees isolation between Mux, Bunny, and other CDN endpoints.
 */
export function getBandwidthStorageKey(mediaUrl: string): string {
  if (!mediaUrl) return `${BANDWIDTH_STORAGE_PREFIX}default`;
  try {
    const parsed = new URL(mediaUrl, "https://evandro-player.local");
    return `${BANDWIDTH_STORAGE_PREFIX}${parsed.origin}`;
  } catch {
    return `${BANDWIDTH_STORAGE_PREFIX}default`;
  }
}

/**
 * Calculates the initial bandwidth estimate (in bps) for HLS startup.
 * If previous session measurements exist for this provider origin, applies
 * a conservative scaling factor (70%) and clamps between 500 kbps and 5 Mbps.
 */
export function getInitialBandwidthEstimate(mediaUrl?: string): number {
  if (typeof window === "undefined" || !mediaUrl) {
    return DEFAULT_INITIAL_BANDWIDTH_SEED;
  }

  try {
    const key = getBandwidthStorageKey(mediaUrl);
    const stored = window.sessionStorage?.getItem(key);
    if (!stored) {
      return DEFAULT_INITIAL_BANDWIDTH_SEED;
    }

    const parsedValue = Number.parseFloat(stored);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return DEFAULT_INITIAL_BANDWIDTH_SEED;
    }

    // Apply conservative scaling factor
    const scaled = parsedValue * CONSERVATIVE_FACTOR;

    // Clamp between MIN (500 kbps) and MAX (5 Mbps)
    const clamped = Math.max(MIN_BANDWIDTH_SEED, Math.min(MAX_BANDWIDTH_SEED, scaled));
    return Math.round(clamped);
  } catch {
    return DEFAULT_INITIAL_BANDWIDTH_SEED;
  }
}

/**
 * Persists the measured bandwidth estimate to sessionStorage under the provider's origin.
 */
export function saveBandwidthEstimate(mediaUrl: string, estimateBps: number): void {
  if (typeof window === "undefined" || !mediaUrl || !Number.isFinite(estimateBps) || estimateBps <= 0) {
    return;
  }

  try {
    const key = getBandwidthStorageKey(mediaUrl);
    window.sessionStorage?.setItem(key, String(Math.round(estimateBps)));
  } catch {
    // Ignore storage quota or security restrictions
  }
}

/**
 * Generates the standardized HLS.js configuration object for fast startup.
 */
export function createStartupHlsConfig(mediaUrl: string): Record<string, unknown> {
  const initialEstimate = getInitialBandwidthEstimate(mediaUrl);

  return {
    startLevel: -1, // Automatic level selection on startup
    testBandwidth: false, // Bypass initial testing fragment download
    abrEwmaDefaultEstimate: initialEstimate,
    enableWorker: true,
    lowLatencyMode: false,
    progressive: false,
  };
}
