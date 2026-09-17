import { calculateFakeProgress } from "../src/lib/player/fake-progress-engine.ts";

console.log("=== WatchMap Fake Progress Engine Comprehensive Validation Suite ===\n");

// 1. Monotonicity and boundary checks across wide range of durations
const durationsToTest = [15, 30, 60, 180, 300, 600, 960, 1800, 3600];
const targetRatios = [0.0, 0.05, 0.10, 0.25, 0.50, 0.75, 0.90, 0.95, 0.99, 1.0];

let totalSteps = 0;
let passedSteps = 0;
let failureDetails = [];

for (const duration of durationsToTest) {
  let prevVal = -1;
  const STEPS = 10000;

  for (let i = 0; i <= STEPS; i++) {
    const currentTime = (i / STEPS) * duration;
    const progress = calculateFakeProgress({ currentTime, duration });
    totalSteps++;

    let stepOk = true;

    // Strict Monotonicity
    if (progress < prevVal) {
      stepOk = false;
      failureDetails.push(`Monotonicity regression at d=${duration}s t=${currentTime}s (prev=${prevVal}, cur=${progress})`);
    }

    // Strict boundaries
    if (i === 0 && progress !== 0) {
      stepOk = false;
      failureDetails.push(`t=0 did not yield 0 (got ${progress}) at d=${duration}s`);
    }
    if (i === STEPS && progress !== 1) {
      stepOk = false;
      failureDetails.push(`t=duration did not yield 1 (got ${progress}) at d=${duration}s`);
    }
    if (i > 0 && i < STEPS && (progress <= 0 || progress >= 1)) {
      stepOk = false;
      failureDetails.push(`Internal progress outside (0, 1) (got ${progress}) at d=${duration}s`);
    }

    if (stepOk) passedSteps++;
    prevVal = progress;
  }
}

console.log(`[MONOTONICITY & BOUNDARY CHECKS] ${passedSteps} / ${totalSteps} passed.`);
if (failureDetails.length > 0) {
  console.error("Failures detected:", failureDetails.slice(0, 10));
} else {
  console.log("All boundary and monotonicity invariants satisfied.\n");
}

// 2. Numerical results table for required durations: 30s, 1m, 3m, 5m, 10m, 16m, 30m, 60m
const reportDurations = [
  { name: "30 segundos", duration: 30 },
  { name: "1 minuto", duration: 60 },
  { name: "3 minutos", duration: 180 },
  { name: "5 minutos", duration: 300 },
  { name: "10 minutos", duration: 600 },
  { name: "16 minutos (VSL Benchmark)", duration: 960 },
  { name: "30 minutos", duration: 1800 },
  { name: "60 minutos", duration: 3600 },
];

console.log("=========================================================================================");
console.log("NUMERICAL RESULTS PER DURATION PROFILE");
console.log("=========================================================================================");

for (const item of reportDurations) {
  console.log(`\n>>> ${item.name} (${item.duration}s) <<<`);
  console.log("Real % | Real Time  | Fake %  | Delta (Fake - Real)");
  console.log("---------------------------------------------------");
  for (const r of targetRatios) {
    const cur = r * item.duration;
    const fake = calculateFakeProgress({ currentTime: cur, duration: item.duration });
    const realPct = ((r * 100).toFixed(0) + "%").padStart(6);
    const timeStr = (cur >= 60 ? (cur / 60).toFixed(2) + "m" : cur.toFixed(0) + "s").padStart(10);
    const fakePct = ((fake * 100).toFixed(1) + "%").padStart(7);
    const delta = ("+" + ((fake - r) * 100).toFixed(1) + "%").padStart(19);
    console.log(`${realPct} | ${timeStr} | ${fakePct} | ${delta}`);
  }
}

// 3. Specific 16-Minute VSL Key Timeline Check
console.log("\n=========================================================================================");
console.log("16-MINUTE VSL TIMELINE ACCURACY CHECK");
console.log("=========================================================================================");
const vslChecks = [
  { min: 1, target: "~30%" },
  { min: 2, target: "~47%" },
  { min: 4, target: "~70%" },
  { min: 8, target: "~90%" },
  { min: 12, target: "~96–97%" },
  { min: 15, target: "~99%" },
  { min: 16, target: "100%" },
];

const vslDuration = 16 * 60;
for (const check of vslChecks) {
  const cur = check.min * 60;
  const realRatio = cur / vslDuration;
  const fake = calculateFakeProgress({ currentTime: cur, duration: vslDuration });
  console.log(
    `${check.min.toString().padStart(2)}:00 / 16:00 | Real: ${(realRatio * 100).toFixed(2).padStart(6)}% -> Fake: ${(fake * 100).toFixed(1).padStart(5)}% | Target: ${check.target}`
  );
}
