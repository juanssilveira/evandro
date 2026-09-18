/**
 * WatchMap Player Performance Instrumentation
 * Standardized performance.mark / performance.measure hooks for loading lifecycle.
 */

export type PerformanceMarkName =
  | "wm:loader:start"
  | "wm:bootstrap:start"
  | "wm:bootstrap:end"
  | "wm:core:start"
  | "wm:core:ready"
  | "wm:media:attach"
  | "wm:manifest:start"
  | "wm:manifest:parsed"
  | "wm:canplay"
  | "wm:first-frame"
  | "wm:user-play"
  | "wm:user-play-first-frame";

export interface PerformanceTimingsSummary {
  videoId?: string;
  bootstrapDurationMs?: number;
  coreReadyDurationMs?: number;
  manifestDurationMs?: number;
  canPlayDurationMs?: number;
  firstFrameDurationMs?: number;
  clickToFrameDurationMs?: number;
}

const recordedTimings = new Map<string, number>();

export function markPerformance(name: PerformanceMarkName, videoId?: string): void {
  if (typeof performance === "undefined" || !performance.mark) return;
  const tag = videoId ? `${name}:${videoId}` : name;
  try {
    performance.mark(tag);
    recordedTimings.set(tag, performance.now());
  } catch {
    // Ignore any quota or unsupported mark errors
  }
}

export function measurePerformance(
  measureName: string,
  startMark: PerformanceMarkName,
  endMark: PerformanceMarkName,
  videoId?: string
): number | null {
  if (typeof performance === "undefined" || !performance.measure) return null;
  const startTag = videoId ? `${startMark}:${videoId}` : startMark;
  const endTag = videoId ? `${endMark}:${videoId}` : endMark;
  const tag = videoId ? `${measureName}:${videoId}` : measureName;

  try {
    performance.measure(tag, startTag, endTag);
    const entries = performance.getEntriesByName(tag, "measure");
    if (entries.length > 0) {
      return Math.round(entries[entries.length - 1].duration);
    }
  } catch {
    // Fallback using internal timing cache if marks weren't kept
    const start = recordedTimings.get(startTag);
    const end = recordedTimings.get(endTag);
    if (start != null && end != null) {
      return Math.round(end - start);
    }
  }
  return null;
}

interface VideoElementWithFrameCallback {
  requestVideoFrameCallback?: (callback: (now: number, metadata: unknown) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
}

/**
 * Uses HTMLVideoElement.requestVideoFrameCallback when available to precisely
 * detect when the first video frame is rendered to the screen.
 * Falls back to 'playing' / 'canplay' events when not supported.
 */
export function onFirstVideoFrame(
  video: HTMLVideoElement,
  callback: (now: number) => void
): () => void {
  let done = false;

  const trigger = (now: number) => {
    if (done) return;
    done = true;
    callback(now);
  };

  const v = video as unknown as VideoElementWithFrameCallback;

  // Modern browsers with requestVideoFrameCallback (Chrome, Edge, Safari 15.4+, Firefox 128+)
  if (typeof v.requestVideoFrameCallback === "function") {
    const handle = v.requestVideoFrameCallback((now: number) => {
      trigger(now);
    });

    return () => {
      if (typeof v.cancelVideoFrameCallback === "function") {
        v.cancelVideoFrameCallback(handle);
      }
    };
  }

  // Fallback
  const handlePlaying = () => trigger(performance.now());
  video.addEventListener("playing", handlePlaying, { once: true });

  return () => {
    video.removeEventListener("playing", handlePlaying);
  };
}

/**
 * Formats and prints performance timing report to console when debug is enabled.
 */
export function logPerformanceDebugReport(videoId: string, timings: PerformanceTimingsSummary): void {
  if (typeof window === "undefined") return;

  const report = [
    `%c[WatchMap Performance] Video: ${videoId}`,
    "color: #7C3AED; font-weight: bold; font-size: 12px;",
    "\n",
    timings.bootstrapDurationMs != null ? `Bootstrap: ${timings.bootstrapDurationMs}ms\n` : "",
    timings.coreReadyDurationMs != null ? `Core Ready: ${timings.coreReadyDurationMs}ms\n` : "",
    timings.manifestDurationMs != null ? `Manifest: ${timings.manifestDurationMs}ms\n` : "",
    timings.canPlayDurationMs != null ? `CanPlay: ${timings.canPlayDurationMs}ms\n` : "",
    timings.firstFrameDurationMs != null ? `First Frame: ${timings.firstFrameDurationMs}ms\n` : "",
    timings.clickToFrameDurationMs != null ? `Click → Frame: ${timings.clickToFrameDurationMs}ms` : "",
  ].join("");

  console.log(report);

  // Dispatch custom performance event for telemetry hooks
  try {
    window.dispatchEvent(
      new CustomEvent("watchmap:performance", {
        detail: {
          videoId,
          ...timings,
        },
      })
    );
  } catch {
    // Ignore
  }
}
