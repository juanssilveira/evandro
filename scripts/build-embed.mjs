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
      "[Build Embed] BASE_URL environment variable is required during remote build (Stage/Production)."
    );
  }
  // Local development fallback
  apiBaseUrl = "http://localhost:3000";
}

apiBaseUrl = apiBaseUrl.replace(/\/$/, "");

const publicEmbedDir = path.join(rootDir, "public", "embed", "v1");
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

console.log("[Build Embed] 1/3 Compiling Tailwind CSS for Embed Shadow DOM...");
fs.mkdirSync(publicEmbedDir, { recursive: true });

// Compile Tailwind CSS to standalone CSS file
execSync(`npx @tailwindcss/cli -i "${inputCssPath}" -o "${generatedCssPath}" --minify`, {
  stdio: "inherit",
  cwd: rootDir,
});

console.log(`[Build Embed] 2/3 Bundling Standalone Web Component with esbuild (API Base: ${apiBaseUrl})...`);

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

const entryFile = path.join(
  rootDir,
  "src",
  "components",
  "player",
  "embed",
  "watchmap-player-element.tsx"
);
const outputFile = path.join(publicEmbedDir, "watchmap-player.js");

await esbuild.build({
  entryPoints: [entryFile],
  bundle: true,
  outfile: outputFile,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  minify: true,
  legalComments: "none",
  loader: {
    ".css": "text",
    ".ts": "ts",
    ".tsx": "tsx",
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    "__WATCHMAP_API_BASE__": JSON.stringify(apiBaseUrl),
  },
  plugins: [pathAliasPlugin],
});

const stats = fs.statSync(outputFile);
const sizeKb = (stats.size / 1024).toFixed(2);

console.log(`[Build Embed] 3/3 Embed bundle generated successfully!`);
console.log(`[Build Embed] Output: ${outputFile} (${sizeKb} KB)`);
