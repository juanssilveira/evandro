/**
 * Dynamic HLS Engine Loader
 * Loads hls.js on-demand for MSE browsers.
 * Native HLS devices (Safari / iOS) bypass HLS.js download entirely.
 */

import type HlsType from "hls.js";
import { shouldUseNativeHls } from "./hls-capabilities";
import { markPerformance } from "./performance-timing";

export { shouldUseNativeHls };
export type HlsConstructor = typeof HlsType;

let hlsPromise: Promise<HlsConstructor | null> | null = null;

/**
 * Dynamically loads HLS engine chunk.
 * Deduplicates in-flight loading promises.
 */
export async function loadHlsEngine(): Promise<HlsConstructor | null> {
  if (typeof window === "undefined") return null;

  if (hlsPromise) {
    return hlsPromise;
  }

  markPerformance("wm:hls-engine:start");

  hlsPromise = (async () => {
    try {
      // Dynamic import of hls.js build
      const hlsModule = await import("hls.js");
      const HlsClass = (hlsModule.default || hlsModule) as unknown as HlsConstructor;
      markPerformance("wm:hls-engine:ready");
      return HlsClass;
    } catch (err) {
      console.error("[WatchMap HLS Engine] Failed to load HLS engine:", err);
      hlsPromise = null;
      return null;
    }
  })();

  return hlsPromise;
}
