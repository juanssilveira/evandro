import { calculateFakeProgress, getDurationWeight } from "../src/lib/player/fake-progress-engine.ts";

console.log("=== WatchMap Fake Progress Engine Test Suite ===\n");

// 1. Monotonicity and boundary checks
const durationsToTest = [15, 30, 60, 120, 300, 600, 960, 1800, 3600];
let totalTests = 0;
let passedTests = 0;

for (const duration of durationsToTest) {
  let prevVal = -1;
  let isMonotonic = true;
  let boundariesPass = true;

  for (let i = 0; i <= 10000; i++) {
    const currentTime = (i / 10000) * duration;
    const progress = calculateFakeProgress({ currentTime, duration });
    totalTests++;

    if (progress < prevVal) {
      isMonotonic = false;
      console.error(`[FAIL] Monotonicity at d=${duration} t=${currentTime}`);
      break;
    }

    if (i === 0 && progress !== 0) boundariesPass = false;
    if (i === 10000 && progress !== 1) boundariesPass = false;
    if (progress < 0 || progress > 1) boundariesPass = false;

    if (isMonotonic && boundariesPass) passedTests++;
    prevVal = progress;
  }
}

console.log(`[MONOTONICITY & BOUNDARIES] ${passedTests} / ${totalTests} evaluations passed across ${durationsToTest.length} durations.\n`);

// 2. Representative duration checkpoints
const representativeDurations = [
  { name: "30 seconds", duration: 30 },
  { name: "2 minutes", duration: 120 },
  { name: "5 minutes", duration: 300 },
  { name: "16 minutes (VSL benchmark)", duration: 960 },
  { name: "30 minutes", duration: 1800 },
];

const checkRatios = [0.05, 0.10, 0.25, 0.50, 0.75, 0.90, 1.00];

for (const rep of representativeDurations) {
  const w = getDurationWeight(rep.duration);
  console.log(`>>> Duration: ${rep.name} (intensity weight: ${(w * 100).toFixed(1)}%) <<<`);
  console.log("Real % | Real Time | Fake %   | Delta (Fake - Real)");
  console.log("------------------------------------------------");
  for (const r of checkRatios) {
    const cur = r * rep.duration;
    const fake = calculateFakeProgress({ currentTime: cur, duration: rep.duration });
    const realPct = ((r * 100).toFixed(0) + "%").padStart(6);
    const timeStr = (cur >= 60 ? (cur / 60).toFixed(1) + "m" : cur.toFixed(0) + "s").padStart(9);
    const fakePct = ((fake * 100).toFixed(2) + "%").padStart(8);
    const delta = ("+" + ((fake - r) * 100).toFixed(2) + "%").padStart(16);
    console.log(`${realPct} | ${timeStr} | ${fakePct} | ${delta}`);
  }
  console.log("");
}

// 3. Specific 16-minute VSL key timeline validation
console.log("======================================================");
console.log("16-Minute VSL Key Time Verification");
console.log("======================================================");
const vslMinutes = [1, 2, 4, 8, 12, 14, 15, 16];
const vslDuration = 16 * 60;
for (const m of vslMinutes) {
  const cur = m * 60;
  const real = cur / vslDuration;
  const fake = calculateFakeProgress({ currentTime: cur, duration: vslDuration });
  console.log(
    `${m.toString().padStart(2)} min / 16 min | Real: ${(real * 100).toFixed(2).padStart(6)}% -> Fake: ${(fake * 100).toFixed(2).padStart(6)}% (+${((fake - real) * 100).toFixed(2)}%)`
  );
}
