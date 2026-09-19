import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as esbuild from "esbuild";
import * as dotenv from "dotenv";

const rootDir = process.cwd();
dotenv.config({ path: path.join(rootDir, ".env.local") });
dotenv.config({ path: path.join(rootDir, ".env") });

let apiBaseUrl = process.env.BASE_URL;

// In Vercel or CI remote build, fail explicitly if BASE_URL is missing
if (!apiBaseUrl) {
  if (process.env.VERCEL) {
    throw new Error(
      "[Build Embed] BASE_URL environment variable is required during remote production build."
    );
  }
  // Local development fallback
  apiBaseUrl = "http://localhost:3000";
}

apiBaseUrl = apiBaseUrl.replace(/\/$/, "");

const publicEmbedDir = path.join(rootDir, "public", "embed", "v1");
const publicAssetsDir = path.join(publicEmbedDir, "assets");

const generatedCssPath = path.join(
  rootDir,
  "src",
  "components",
  "player",
  "embed",
  "embed-styles.generated.css"
);
const inputCssPath = path.join(
  rootDir,
  "src",
  "components",
  "player",
  "embed",
  "embed.css"
);

console.log("[Build Embed] 1/4 Compiling Tailwind CSS for Embed Shadow DOM...");
fs.mkdirSync(publicEmbedDir, { recursive: true });

// Clean previous assets directory and legacy watchmap-player.js if present
if (fs.existsSync(publicAssetsDir)) {
  fs.rmSync(publicAssetsDir, { recursive: true, force: true });
}
fs.mkdirSync(publicAssetsDir, { recursive: true });

const legacyLoaderPath = path.join(publicEmbedDir, "watchmap-player.js");
if (fs.existsSync(legacyLoaderPath)) {
  fs.rmSync(legacyLoaderPath, { force: true });
}

// Compile Tailwind CSS to standalone CSS file
execSync(`npx @tailwindcss/cli -i "${inputCssPath}" -o "${generatedCssPath}" --minify`, {
  stdio: "inherit",
  cwd: rootDir,
});

// Plugin to resolve '@/...' path aliases to 'src/...'
const pathAliasPlugin = {
  name: "path-alias",
  setup(build) {
    build.onResolve({ filter: /^@\// }, (args) => {
      const subpath = args.path.replace(/^@\//, "");
      const resolved = path.join(rootDir, "src", subpath);

      // Try file extensions if direct path doesn't exist
      const candidates = [
        resolved,
        `${resolved}.ts`,
        `${resolved}.tsx`,
        `${resolved}.js`,
        `${resolved}.jsx`,
        path.join(resolved, "index.ts"),
        path.join(resolved, "index.tsx"),
        path.join(resolved, "index.js"),
      ];

      for (const candidate of candidates) {
        if (fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory()) {
          return { path: candidate };
        }
      }

      return { path: resolved };
    });
  },
};

console.log(`[Build Embed] 2/4 Building Headless Player Engine, Player Core & Dynamic HLS Chunks (ESM)...`);

const engineEntryFile = path.join(
  rootDir,
  "src",
  "components",
  "player",
  "engine",
  "player-engine-entry.ts"
);

const coreEntryFile = path.join(
  rootDir,
  "src",
  "components",
  "player",
  "embed",
  "player-core-entry.tsx"
);

const splitBuildResult = await esbuild.build({
  entryPoints: {
    "player-engine": engineEntryFile,
    "player-core": coreEntryFile,
  },
  bundle: true,
  splitting: true,
  outdir: publicAssetsDir,
  entryNames: "[name]-[hash]",
  chunkNames: "chunk-[name]-[hash]",
  format: "esm",
  platform: "browser",
  target: ["es2020"],
  minify: true,
  metafile: true,
  legalComments: "none",
  loader: {
    ".css": "text",
    ".ts": "ts",
    ".tsx": "tsx",
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    "__EVANDRO_PLAYER_API_BASE__": JSON.stringify(apiBaseUrl),
  },
  plugins: [pathAliasPlugin],
});

// Find the engine, core, and HLS chunks
let engineOutputRelativePath = "";
let coreOutputRelativePath = "";
let hlsOutputRelativePath = "";

for (const [outPath, meta] of Object.entries(splitBuildResult.metafile.outputs)) {
  const base = path.basename(outPath);
  if (base.startsWith("player-engine-") && base.endsWith(".js")) {
    engineOutputRelativePath = `assets/${base}`;
  } else if (base.startsWith("player-core-") && base.endsWith(".js")) {
    coreOutputRelativePath = `assets/${base}`;
  } else if (base.endsWith(".js")) {
    // Check if this chunk contains HLS.js source library
    const isHls = Object.keys(meta.inputs || {}).some(
      (inputPath) => inputPath.includes("node_modules/hls.js") || inputPath.includes("node_modules\\hls.js")
    );
    if (isHls) {
      hlsOutputRelativePath = `assets/${base}`;
    }
  }
}

if (!engineOutputRelativePath) {
  throw new Error("[Build Embed] Could not find player-engine output file in build metafile.");
}

if (!coreOutputRelativePath) {
  throw new Error("[Build Embed] Could not find player-core output file in build metafile.");
}

if (!hlsOutputRelativePath) {
  throw new Error("[Build Embed] Could not find HLS chunk in build metafile.");
}

console.log(`[Build Embed] Player Engine: ENABLED (${engineOutputRelativePath})`);
console.log(`[Build Embed] Player Core: ENABLED (${coreOutputRelativePath})`);
console.log(`[Build Embed] HLS Early Warm: ENABLED (${hlsOutputRelativePath})`);

console.log(`[Build Embed] 3/4 Bundling Standalone Tiny Loader (API Base: ${apiBaseUrl}, Engine: ${engineOutputRelativePath}, Core: ${coreOutputRelativePath}, HLS: ${hlsOutputRelativePath})...`);

const loaderEntryFile = path.join(
  rootDir,
  "src",
  "components",
  "player",
  "embed",
  "loader-entry.ts"
);
const loaderOutputFile = path.join(publicEmbedDir, "evandro-player.js");

await esbuild.build({
  entryPoints: [loaderEntryFile],
  bundle: true,
  outfile: loaderOutputFile,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  minify: true,
  metafile: true,
  legalComments: "none",
  loader: {
    ".ts": "ts",
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    "__EVANDRO_PLAYER_API_BASE__": JSON.stringify(apiBaseUrl),
    "__EVANDRO_PLAYER_ENGINE_FILENAME__": JSON.stringify(engineOutputRelativePath),
    "__EVANDRO_PLAYER_CORE_FILENAME__": JSON.stringify(coreOutputRelativePath),
    "__EVANDRO_PLAYER_HLS_FILENAME__": JSON.stringify(hlsOutputRelativePath),
  },
  plugins: [pathAliasPlugin],
});

console.log(`[Build Embed] 4/4 Analyzing Bundle Sizes & Budgets...`);

// Output stats
const loaderStats = fs.statSync(loaderOutputFile);
const loaderSizeKb = (loaderStats.size / 1024).toFixed(2);
const loaderBudgetKb = 25.0;

const oldMonolithSize = 1410269; // ~1.41 MB

console.log("\n========================================================");
console.log("            EVANDRO PLAYER EMBED BUILD REPORT           ");
console.log("========================================================");
console.log(`- Tiny Loader: ${loaderOutputFile}`);
console.log(`  Size: ${loaderStats.size.toLocaleString()} bytes (${loaderSizeKb} KB) / Budget: <= ${loaderBudgetKb} KB [${loaderStats.size <= loaderBudgetKb * 1024 ? "PASS" : "FAIL"}]`);
console.log(`  Player Engine: ${engineOutputRelativePath}`);
console.log(`  Player Core: ${coreOutputRelativePath}`);
console.log(`  HLS Early Warm: ENABLED -> ${hlsOutputRelativePath}`);

let totalAssetsSize = loaderStats.size;

console.log("\n- Split Core Assets:");
for (const [outPath, meta] of Object.entries(splitBuildResult.metafile.outputs)) {
  if (outPath.endsWith(".js")) {
    const assetSize = meta.bytes;
    totalAssetsSize += assetSize;
    const assetSizeKb = (assetSize / 1024).toFixed(2);
    const label = outPath.includes("player-engine")
      ? " [Player Engine]"
      : outPath.includes("player-core")
      ? " [Player Core]"
      : Object.keys(meta.inputs || {}).some((i) => i.includes("node_modules/hls.js") || i.includes("node_modules\\hls.js"))
      ? " [HLS Light]"
      : " [Shared]";
    console.log(`  * ${path.basename(outPath)}${label}: ${assetSize.toLocaleString()} bytes (${assetSizeKb} KB)`);
  }
}

const totalSizeKb = (totalAssetsSize / 1024).toFixed(2);
const oldMonolithKb = (oldMonolithSize / 1024).toFixed(2);
const savedKb = ((oldMonolithSize - totalAssetsSize) / 1024).toFixed(2);
const initialTransferReduction = (((oldMonolithSize - loaderStats.size) / oldMonolithSize) * 100).toFixed(1);

console.log("\n--------------------------------------------------------");
console.log(`Legacy Monolith Baseline : ${oldMonolithSize.toLocaleString()} bytes (${oldMonolithKb} KB)`);
console.log(`Initial Loader Critical  : ${loaderStats.size.toLocaleString()} bytes (${loaderSizeKb} KB)`);
console.log(`Initial Reduction        : -${initialTransferReduction}% initial payload reduction!`);
console.log(`Total Split Payload      : ${totalAssetsSize.toLocaleString()} bytes (${totalSizeKb} KB) [Saved ${savedKb} KB]`);
console.log("========================================================\n");

if (loaderStats.size > loaderBudgetKb * 1024) {
  throw new Error(`[Build Embed] Loader size (${loaderSizeKb} KB) exceeded the ${loaderBudgetKb} KB budget!`);
}
