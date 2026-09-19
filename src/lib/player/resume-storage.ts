/**
 * Evandro Player — Persistent Resume Storage V1
 * Pure TypeScript, zero React dependencies, defensive fail-open.
 */

export interface SavedResumeRecord {
  version: 1;
  position: number;
  duration: number | null;
  updatedAt: number;
}

const STORAGE_PREFIX = "evandro:resume:v1:";

export function getResumeKey(videoId: string): string {
  return `${STORAGE_PREFIX}${videoId}`;
}

/**
 * Defensive reading of saved resume progress for a video.
 * Fails open: returns null on any parsing/storage exception or invalid record.
 */
export function getSavedResume(videoId: string): SavedResumeRecord | null {
  if (typeof window === "undefined" || !videoId || typeof videoId !== "string") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getResumeKey(videoId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.version === 1 &&
      typeof parsed.position === "number" &&
      Number.isFinite(parsed.position) &&
      parsed.position >= 1 &&
      (parsed.duration == null ||
        (typeof parsed.duration === "number" &&
          Number.isFinite(parsed.duration) &&
          parsed.position < parsed.duration - 2))
    ) {
      return {
        version: 1,
        position: parsed.position,
        duration:
          typeof parsed.duration === "number" && Number.isFinite(parsed.duration)
            ? parsed.duration
            : null,
        updatedAt:
          typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt)
            ? parsed.updatedAt
            : Date.now(),
      };
    }

    // If record is corrupt or completed (> duration - 2s), purge silently
    clearSavedResume(videoId);
    return null;
  } catch {
    return null;
  }
}

/**
 * Defensively saves current playback position for a video.
 * Throttled by callers; flushes on pause/hidden/unload.
 */
export function saveResume(
  videoId: string,
  position: number,
  duration: number | null
): boolean {
  if (typeof window === "undefined" || !videoId || typeof videoId !== "string") {
    return false;
  }

  try {
    if (!Number.isFinite(position) || position < 1) {
      return false;
    }

    // If near the end of video (last 2 seconds), clear history instead of storing 100%
    if (
      duration != null &&
      Number.isFinite(duration) &&
      duration > 0 &&
      position >= duration - 2
    ) {
      clearSavedResume(videoId);
      return false;
    }

    const record: SavedResumeRecord = {
      version: 1,
      position: Math.round(position * 100) / 100,
      duration:
        duration != null && Number.isFinite(duration)
          ? Math.round(duration * 100) / 100
          : null,
      updatedAt: Date.now(),
    };

    window.localStorage.setItem(getResumeKey(videoId), JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

/**
 * Purges saved resume progress for a video.
 */
export function clearSavedResume(videoId: string): void {
  if (typeof window === "undefined" || !videoId || typeof videoId !== "string") {
    return;
  }

  try {
    window.localStorage.removeItem(getResumeKey(videoId));
  } catch {
    // ignore
  }
}
