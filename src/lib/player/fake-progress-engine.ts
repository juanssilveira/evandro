/**
 * WatchMap Fake Progress Engine
 *
 * Isolated layer responsible for calculating the intelligent fake progress curve
 * adapted automatically to video duration.
 *
 * Mathematical and behavioral guarantees:
 * - Deterministic: same (currentTime, duration) yields identical progress.
 * - Monotonic: non-decreasing as currentTime advances.
 * - Continuous & smooth: C-infinity curve with no abrupt segment jumps.
 * - Bounds: strictly [0, 1], with f(0) = 0 and f(duration) = 1.
 * - Adaptive: curve curvature scales dynamically with duration.
 */

export interface CalculateFakeProgressOptions {
  currentTime: number;
  duration: number;
}

/**
 * Calculates the dynamic power exponent for the fake progress curve
 * based on the video's total duration in seconds.
 *
 * - Short videos (<= 15s): moderate acceleration (p ~ 1.35 - 1.55)
 * - Medium videos (60s - 300s): balanced acceleration (p ~ 1.85 - 2.30)
 * - Long videos (>= 600s): stronger initial acceleration (p ~ 2.50 - 2.80)
 */
export function getCurveExponentForDuration(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) {
    return 1.8;
  }

  const minDuration = 5; // 5 seconds floor for logarithmic mapping
  const maxDuration = 1800; // 30 minutes reference ceiling
  const minExponent = 1.35;
  const maxExponent = 2.80;

  const clampedDuration = Math.max(minDuration, Math.min(maxDuration, duration));
  const logMin = Math.log(minDuration);
  const logMax = Math.log(maxDuration);
  const normalizedScale = (Math.log(clampedDuration) - logMin) / (logMax - logMin);

  return minExponent + normalizedScale * (maxExponent - minExponent);
}

/**
 * Calculates the fake progress value (0 to 1) for a given playback position and duration.
 *
 * Formula: f(r) = 1 - (1 - r)^p
 * where r = currentTime / duration in [0, 1] and p = f(duration).
 */
export function calculateFakeProgress({
  currentTime,
  duration,
}: CalculateFakeProgressOptions): number {
  if (!Number.isFinite(duration) || duration <= 0) {
    return 0;
  }

  if (!Number.isFinite(currentTime) || currentTime <= 0) {
    return 0;
  }

  if (currentTime >= duration) {
    return 1;
  }

  // Real normalized progress in [0, 1]
  const realProgress = Math.max(0, Math.min(1, currentTime / duration));

  // Adaptive curve exponent
  const exponent = getCurveExponentForDuration(duration);

  // Power deceleration curve: advances rapidly at start, decelerates toward end
  const fakeProgress = 1 - Math.pow(1 - realProgress, exponent);

  return Math.max(0, Math.min(1, fakeProgress));
}
