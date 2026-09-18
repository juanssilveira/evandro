/**
 * Dynamic HLS Engine Loader
 * Loads hls.js/light on-demand for MSE browsers.
 * Native HLS devices (Safari / iOS) bypass HLS.js download entirely.
 */

import type HlsType from "hls.js";

export type HlsConstructor = typeof HlsType;

let hlsPromise: Promise<HlsConstructor | null> | null = null;

/**
 * Determines whether native HLS should be preferred over downloading HLS.js.
 * Safari on macOS / iOS provides native hardware-accelerated HLS support.
 */
export function shouldUseNativeHls(video?: HTMLVideoElement | null): boolean {
  if (typeof window === "undefined") return false;
  const v = video || document.createElement("video");
  const canPlay = Boolean(
    v.canPlayType("application/vnd.apple.mpegurl") ||
    v.canPlayType("application/x-mpegURL")
  );

  if (!canPlay) return false;

  // On Apple platforms / WebKit (Safari desktop, iOS Safari, WebViews):
  // Native HLS avoids loading ~70KB+ JS engine and improves battery/battery/decode latency.
  const isSafariOrApple =
    "ManagedMediaSource" in window ||
    (typeof navigator !== "undefined" && /Apple Computer/.test(navigator.vendor || ""));

  return isSafariOrApple;
}

/**
 * Dynamically loads HLS Light engine chunk.
 * Deduplicates in-flight loading promises.
 */
export async function loadHlsEngine(): Promise<HlsConstructor | null> {
  if (typeof window === "undefined") return null;

  if (hlsPromise) {
    return hlsPromise;
  }

  hlsPromise = (async () => {
    try {
      // Dynamic import of full hls.js build (supports Mux audio tracks and demuxing)
      const hlsModule = await import("hls.js");
      const HlsClass = (hlsModule.default || hlsModule) as unknown as HlsConstructor;
      return HlsClass;
    } catch (err) {
      console.error("[WatchMap HLS Engine] Failed to load HLS light engine:", err);
      hlsPromise = null;
      return null;
    }
  })();

  return hlsPromise;
}
