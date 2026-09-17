/**
 * WatchMap Fake Progress Engine
 *
 * Isolated layer responsible for calculating the intelligent fake progress curve
 * strongly modulated by video duration.
 *
 * Mathematical and behavioral guarantees:
 * - Deterministic: same (currentTime, duration) yields identical progress.
 * - Monotonic: strictly increasing as currentTime advances (f(t2) > f(t1) for t2 > t1).
 * - Continuous & smooth: Monotone Cubic Hermite / PCHIP spline with zero abrupt jumps.
 * - Boundary strictness: f(0) = 0, f(duration) = 1, and 0 < f(t) < 1 for 0 < t < duration.
 * - Dynamic by duration: logarithmic continuous blending across duration profiles
 *   producing visually distinct curves (from moderate short clips to aggressively front-loaded VSLs).
 * - Non-premature saturation: fake progress never reaches 100% before the video genuinely ends.
 */

export interface CalculateFakeProgressOptions {
  currentTime: number;
  duration: number;
}

export interface FakeProgressCheckpoint {
  x: number; // Normalized real progress [0, 1]
  y: number; // Target fake progress [0, 1]
}

export interface DurationProfile {
  duration: number; // Reference duration in seconds
  y: readonly number[]; // Target fake progress values corresponding to CHECKPOINT_X
}

/**
 * Normalized X coordinates representing real playback progress checkpoints.
 */
export const CHECKPOINT_X: readonly number[] = [
  0.0,
  0.05,
  0.0625, // 1/16 (e.g. 01:00 in 16 min VSL)
  0.10,
  0.125,  // 2/16 (e.g. 02:00 in 16 min VSL)
  0.25,   // 4/16 (e.g. 04:00 in 16 min VSL)
  0.50,   // 8/16 (e.g. 08:00 in 16 min VSL)
  0.75,   // 12/16 (e.g. 12:00 in 16 min VSL)
  0.90,
  0.9375, // 15/16 (e.g. 15:00 in 16 min VSL)
  0.95,
  0.99,
  1.0,
] as const;

/**
 * Duration profiles defining the progression curve for distinct video lengths.
 * Interpolated continuously in logarithmic duration space to avoid discrete jumps.
 */
export const DURATION_PROFILES: readonly DurationProfile[] = [
  {
    duration: 30, // 30 seconds
    y: [0.0, 0.06, 0.075, 0.12, 0.15, 0.28, 0.54, 0.77, 0.91, 0.945, 0.955, 0.990, 1.0],
  },
  {
    duration: 60, // 1 minute (Short: moderate, close to real)
    y: [0.0, 0.08, 0.10, 0.15, 0.185, 0.32, 0.58, 0.80, 0.93, 0.955, 0.965, 0.992, 1.0],
  },
  {
    duration: 180, // 3 minutes (Short/Medium)
    y: [0.0, 0.12, 0.145, 0.21, 0.255, 0.42, 0.67, 0.85, 0.95, 0.968, 0.975, 0.994, 1.0],
  },
  {
    duration: 300, // 5 minutes (Medium: clear acceleration)
    y: [0.0, 0.16, 0.19, 0.27, 0.325, 0.50, 0.73, 0.88, 0.96, 0.975, 0.980, 0.995, 1.0],
  },
  {
    duration: 600, // 10 minutes (Long)
    y: [0.0, 0.23, 0.265, 0.37, 0.43, 0.62, 0.83, 0.94, 0.98, 0.987, 0.990, 0.997, 1.0],
  },
  {
    duration: 960, // 16 minutes (Long VSL Benchmark: aggressive front-load)
    y: [0.0, 0.25, 0.30, 0.41, 0.47, 0.70, 0.90, 0.965, 0.985, 0.990, 0.992, 0.998, 1.0],
  },
  {
    duration: 1800, // 30+ minutes (Very Long)
    y: [0.0, 0.32, 0.37, 0.50, 0.56, 0.74, 0.91, 0.97, 0.99, 0.993, 0.995, 0.9985, 1.0],
  },
] as const;

/**
 * Backward compatibility: default checkpoints (VSL 16-minute profile).
 */
export const FAKE_PROGRESS_CHECKPOINTS: readonly FakeProgressCheckpoint[] = CHECKPOINT_X.map(
  (x, idx) => ({
    x,
    y: DURATION_PROFILES[5].y[idx],
  })
);

/**
 * Interpolates target Y checkpoints continuously based on logarithmic duration.
 */
export function getInterpolatedCheckpoints(duration: number): number[] {
  if (!Number.isFinite(duration) || duration <= DURATION_PROFILES[0].duration) {
    return [...DURATION_PROFILES[0].y];
  }

  const lastProfile = DURATION_PROFILES[DURATION_PROFILES.length - 1];
  if (duration >= lastProfile.duration) {
    return [...lastProfile.y];
  }

  let i = 0;
  while (i < DURATION_PROFILES.length - 2 && duration > DURATION_PROFILES[i + 1].duration) {
    i++;
  }

  const p0 = DURATION_PROFILES[i];
  const p1 = DURATION_PROFILES[i + 1];

  const logD = Math.log(duration);
  const logD0 = Math.log(p0.duration);
  const logD1 = Math.log(p1.duration);
  const u = (logD - logD0) / (logD1 - logD0);

  return p0.y.map((y0, idx) => (1 - u) * y0 + u * p1.y[idx]);
}

/**
 * Evaluates Monotone Piecewise Cubic Hermite Interpolation (PCHIP / Fritsch-Carlson).
 * Guarantees C1 continuity, strict monotonicity, and zero overshoot.
 */
export function evaluatePchipSpline(
  xArr: readonly number[],
  yArr: readonly number[],
  x: number
): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const n = xArr.length;
  const h: number[] = new Array(n - 1);
  const delta: number[] = new Array(n - 1);

  for (let i = 0; i < n - 1; i++) {
    const dx = xArr[i + 1] - xArr[i];
    h[i] = dx;
    delta[i] = (yArr[i + 1] - yArr[i]) / dx;
  }

  const m: number[] = new Array(n);
  m[0] = delta[0];
  m[n - 1] = delta[n - 2];

  for (let i = 1; i < n - 1; i++) {
    if (delta[i - 1] * delta[i] <= 0) {
      m[i] = 0;
    } else {
      // Standard Fritsch-Carlson harmonic mean
      m[i] = (2 * delta[i - 1] * delta[i]) / (delta[i - 1] + delta[i]);
    }
  }

  // Locate the segment containing x
  let k = 0;
  while (k < n - 2 && x > xArr[k + 1]) {
    k++;
  }

  const segH = h[k];
  const t = (x - xArr[k]) / segH;
  const t2 = t * t;
  const t3 = t2 * t;

  // Cubic Hermite basis functions
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  const y = yArr[k] * h00 + segH * m[k] * h10 + yArr[k + 1] * h01 + segH * m[k + 1] * h11;
  return y;
}

/**
 * Backward-compatible helper for single-value curve evaluation.
 */
export function evaluatePchipCurve(r: number): number {
  return evaluatePchipSpline(CHECKPOINT_X, DURATION_PROFILES[5].y, r);
}

/**
 * Returns normalized duration scale weight [0, 1].
 */
export function getDurationWeight(duration: number): number {
  if (!Number.isFinite(duration) || duration <= DURATION_PROFILES[0].duration) {
    return 0;
  }
  const maxD = DURATION_PROFILES[DURATION_PROFILES.length - 1].duration;
  if (duration >= maxD) {
    return 1;
  }
  const minLog = Math.log(DURATION_PROFILES[0].duration);
  const maxLog = Math.log(maxD);
  return (Math.log(duration) - minLog) / (maxLog - minLog);
}

/**
 * Calculates the fake progress value [0, 1] for a given playback position and duration.
 *
 * Rules:
 * - currentTime <= 0 => 0
 * - currentTime >= duration => 1
 * - currentTime in (0, duration) => strictly in (0, 1) and monotonic.
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

  // Normalized real progress in (0, 1)
  const realProgress = Math.max(0, Math.min(1, currentTime / duration));

  // Dynamically obtain continuous checkpoints for this specific duration
  const yArr = getInterpolatedCheckpoints(duration);

  // Evaluate monotone PCHIP spline
  const rawFake = evaluatePchipSpline(CHECKPOINT_X, yArr, realProgress);

  // Strict boundary clamp: fakeProgress is strictly < 1 whenever realProgress < 1
  return Math.max(0, Math.min(0.999999, rawFake));
}
