import { cpSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const cliDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(cliDir, "../..");

await esbuild.build({
  absWorkingDir: repoRoot,
  entryPoints: [path.join(cliDir, "src/entry.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: path.join(cliDir, "dist/cli.js"),
  legalComments: "none",
  logLevel: "info",
  banner: {
    js: "import { createRequire as __botmintCreateRequire } from 'node:module'; const require = __botmintCreateRequire(import.meta.url);",
  },
});

const dest = path.join(cliDir, "deployments");
rmSync(dest, { recursive: true, force: true });
cpSync(path.join(repoRoot, "deployments"), dest, { recursive: true });
