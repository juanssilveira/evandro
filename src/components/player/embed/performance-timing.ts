/**
 * Evandro Player Performance Instrumentation
 * Standardized performance.mark / performance.measure hooks for loading lifecycle.
 */

export type PerformanceMarkName =
  | "ep:loader:start"
  | "ep:bootstrap:start"
  | "ep:bootstrap:end"
  | "ep:engine:start"
  | "ep:engine:ready"
  | "ep:core:start"
  | "ep:core:ready"
  | "ep:visual:preview:start"
  | "ep:visual:preview:ready"
  | "ep:visual:thumbnail:start"
  | "ep:visual:thumbnail:ready"
  | "ep:visual:custom-thumbnail:start"
  | "ep:visual:custom-thumbnail:ready"
  | "ep:visual:custom-thumbnail:failed"
  | "ep:visual:fallback-provider:applied"
  | "ep:visual:pause-thumbnail:ready"
  | "ep:visual:main-reveal"
  | "ep:hls-engine:start"
  | "ep:hls-engine:ready"
  | "ep:media:attach"
  | "ep:manifest:start"
  | "ep:manifest:parsed"
  | "ep:first-frag:start"
  | "ep:first-frag:loaded"
  | "ep:first-frag:buffered"
  | "ep:canplay"
  | "ep:first-frame"
  | "ep:main:first-frame"
  | "ep:startup-visual:release"
  | "ep:user-play"
  | "ep:user-play-first-frame";

export interface PerformanceTimingsSummary {
  videoId?: string;
  bootstrapDurationMs?: number;
  coreReadyDurationMs?: number;
  hlsEngineReadyDurationMs?: number;
  manifestDurationMs?: number;
  firstFragDurationMs?: number;
  canPlayDurationMs?: number;
  firstFrameDurationMs?: number;
  clickToFrameDurationMs?: number;
  startupLevel?: string | number;
  startupBitrate?: number | string;
  bandwidthEstimate?: number | string;
}

const recordedTimings = new Map<string, number>();
const singleFireMarks = new Set<string>();

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

/**
 * Fires a performance mark exactly once per videoId / lifecycle.
 */
export function markPerformanceOnce(name: PerformanceMarkName, videoId?: string): boolean {
  const tag = videoId ? `${name}:${videoId}` : name;
  if (singleFireMarks.has(tag)) return false;
  singleFireMarks.add(tag);
  markPerformance(name, videoId);
  return true;
}

export function resetPerformanceMarks(videoId?: string): void {
  if (videoId) {
    for (const key of singleFireMarks) {
      if (key.endsWith(`:${videoId}`)) {
        singleFireMarks.delete(key);
      }
    }
  } else {
    singleFireMarks.clear();
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

  const lines: string[] = [
    `%c[Evandro Player Performance] Video: ${videoId}`,
    "color: #7C3AED; font-weight: bold; font-size: 12px;",
    "\n",
  ];

  if (timings.bootstrapDurationMs != null) lines.push(`Bootstrap: ${timings.bootstrapDurationMs}ms\n`);
  if (timings.coreReadyDurationMs != null) lines.push(`Core Ready: ${timings.coreReadyDurationMs}ms\n`);
  if (timings.hlsEngineReadyDurationMs != null) lines.push(`HLS Engine Ready: ${timings.hlsEngineReadyDurationMs}ms\n`);
  if (timings.manifestDurationMs != null) lines.push(`Manifest: ${timings.manifestDurationMs}ms\n`);
  if (timings.firstFragDurationMs != null) lines.push(`First Fragment: ${timings.firstFragDurationMs}ms\n`);
  if (timings.canPlayDurationMs != null) lines.push(`CanPlay: ${timings.canPlayDurationMs}ms\n`);
  if (timings.firstFrameDurationMs != null) lines.push(`First Frame: ${timings.firstFrameDurationMs}ms\n`);
  if (timings.clickToFrameDurationMs != null) lines.push(`Click → Frame: ${timings.clickToFrameDurationMs}ms\n`);
  if (timings.startupLevel != null) lines.push(`Startup Level: ${timings.startupLevel}\n`);
  if (timings.startupBitrate != null) lines.push(`Startup Bitrate: ${timings.startupBitrate}\n`);
  if (timings.bandwidthEstimate != null) lines.push(`Bandwidth Estimate: ${timings.bandwidthEstimate}\n`);

  console.log(lines.join(""));

  // Dispatch custom performance event for telemetry / developer testing hooks
  try {
    window.dispatchEvent(
      new CustomEvent("evandro-player:performance", {
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
