/**
 * WatchMap HLS Capability Detection
 * Ultra-lightweight, zero-dependency helper to detect whether the current environment
 * should prefer native HLS (Safari / iOS WebKit) over downloading HLS.js.
 *
 * This file MUST NOT import React, hls.js, or Player Core.
 */

export function shouldUseNativeHls(video?: HTMLVideoElement | null): boolean {
  if (typeof window === "undefined") return false;

  const v = video || (typeof document !== "undefined" ? document.createElement("video") : null);
  if (!v) return false;

  const canPlay = Boolean(
    v.canPlayType("application/vnd.apple.mpegurl") ||
    v.canPlayType("application/x-mpegURL")
  );

  if (!canPlay) return false;

  // On Apple platforms / WebKit (Safari desktop, iOS Safari, WebViews):
  // Native HLS avoids loading the JS engine and leverages hardware decode directly.
  const isSafariOrApple =
    "ManagedMediaSource" in window ||
    (typeof navigator !== "undefined" && /Apple Computer/.test(navigator.vendor || ""));

  return isSafariOrApple;
}
