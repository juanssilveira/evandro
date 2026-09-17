/**
 * WatchMap Fake Progress Engine
 *
 * Isolated layer responsible for calculating the intelligent fake progress curve
 * adapted automatically to video duration.
 *
 * Mathematical and behavioral guarantees:
 * - Deterministic: same (currentTime, duration) yields identical progress.
 * - Monotonic: strictly increasing as currentTime advances (f(t2) > f(t1) for t2 > t1).
 * - Continuous & smooth: C1 smooth curve with zero abrupt jumps or kinks.
 * - Boundary strictness: f(0) = 0, f(duration) = 1, and 0 < f(t) < 1 for 0 < t < duration.
 * - Adaptive by duration: scales front-loaded intensity smoothly from short clips to long VSLs.
 * - Non-premature saturation: ensures steady, noticeable progression in the final stretch.
 */

export interface CalculateFakeProgressOptions {
  currentTime: number;
  duration: number;
}

export interface FakeProgressCheckpoint {
  x: number; // Normalized real progress [0, 1]
  y: number; // Target fake progress [0, 1]
}

/**
 * Normalized reference checkpoints for the target front-loaded curve.
 * Calibrated specifically for high-converting VSLs and video retention.
 */
export const FAKE_PROGRESS_CHECKPOINTS: readonly FakeProgressCheckpoint[] = [
  { x: 0.00, y: 0.00 },
  { x: 0.05, y: 0.20 },
  { x: 0.10, y: 0.33 },
  { x: 0.20, y: 0.50 },
  { x: 0.35, y: 0.67 },
  { x: 0.50, y: 0.79 },
  { x: 0.70, y: 0.88 },
  { x: 0.85, y: 0.94 },
  { x: 1.00, y: 1.00 },
] as const;

/**
 * Precomputes Monotone Piecewise Cubic Hermite Interpolation (PCHIP) tangents
 * to ensure strict monotonicity, zero overshoot, and O(1) runtime evaluation.
 */
interface PchipSegment {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  h: number;
  m0: number;
  m1: number;
}

function initializePchipSegments(points: readonly FakeProgressCheckpoint[]): PchipSegment[] {
  const n = points.length;
  const h: number[] = [];
  const delta: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    h.push(dx);
    delta.push((points[i + 1].y - points[i].y) / dx);
  }

  const m: number[] = new Array(n);
  m[0] = delta[0];
  m[n - 1] = delta[n - 2];

  for (let i = 1; i < n - 1; i++) {
    if (delta[i - 1] * delta[i] <= 0) {
      m[i] = 0;
    } else {
      // Standard PCHIP harmonic mean for monotonicity preservation
      m[i] = (2 * delta[i - 1] * delta[i]) / (delta[i - 1] + delta[i]);
    }
  }

  const segments: PchipSegment[] = [];
  for (let i = 0; i < n - 1; i++) {
    segments.push({
      x0: points[i].x,
      x1: points[i + 1].x,
      y0: points[i].y,
      y1: points[i + 1].y,
      h: h[i],
      m0: m[i],
      m1: m[i + 1],
    });
  }

  return segments;
}

const PCHIP_SEGMENTS = initializePchipSegments(FAKE_PROGRESS_CHECKPOINTS);

/**
 * Evaluates the monotone PCHIP spline at a normalized point r in [0, 1].
 */
export function evaluatePchipCurve(r: number): number {
  if (r <= 0) return 0;
  if (r >= 1) return 1;

  // Find corresponding interval
  let k = 0;
  while (k < PCHIP_SEGMENTS.length - 1 && r > PCHIP_SEGMENTS[k].x1) {
    k++;
  }

  const seg = PCHIP_SEGMENTS[k];
  const t = (r - seg.x0) / seg.h;
  const t2 = t * t;
  const t3 = t2 * t;

  // Cubic Hermite basis functions
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  const y = seg.y0 * h00 + seg.h * seg.m0 * h10 + seg.y1 * h01 + seg.h * seg.m1 * h11;
  return Math.max(0, Math.min(1, y));
}

/**
 * Calculates dynamic curve intensity weight based on video duration in seconds.
 *
 * - Short videos (<= 15s): weight ~ 0.45 (moderate, natural boost)
 * - Medium videos (30s - 300s): weight ~ 0.54 - 0.85 (smooth transition)
 * - Long / VSL videos (>= 960s / 16min): weight 1.0 (full front-loaded curve)
 */
export function getDurationWeight(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) {
    return 0.75;
  }

  const minDuration = 15; // 15 seconds floor
  const maxDuration = 960; // 16 minutes VSL benchmark
  const minWeight = 0.45;
  const maxWeight = 1.00;

  if (duration <= minDuration) {
    return minWeight;
  }
  if (duration >= maxDuration) {
    return maxWeight;
  }

  const logMin = Math.log(minDuration);
  const logMax = Math.log(maxDuration);
  const scale = (Math.log(duration) - logMin) / (logMax - logMin);

  return minWeight + scale * (maxWeight - minWeight);
}

/**
 * Calculates the fake progress value (0 to 1) for a given playback position and duration.
 *
 * Features:
 * - Deterministic blend between linear real progress and PCHIP target curve.
 * - Adapts dynamically by duration without exposing configuration burden.
 * - Strictly monotonic and bounded in [0, 1].
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

  // Dynamic intensity weight for the video's duration
  const weight = getDurationWeight(duration);

  // Target front-loaded curve value
  const targetProgress = evaluatePchipCurve(realProgress);

  // Blended fake progress: monotonic linear combination
  const fakeProgress = (1 - weight) * realProgress + weight * targetProgress;

  return Math.max(0, Math.min(1, fakeProgress));
}

