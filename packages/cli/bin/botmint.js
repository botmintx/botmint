#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "../src/main.ts");
const dist = path.join(here, "../dist/cli.js");
const target = existsSync(src) ? src : dist;
if (!existsSync(target)) {
  console.error("botmint is missing its program. Expected src/main.ts or dist/cli.js.");
  process.exit(1);
}
const mod = await import(pathToFileURL(target).href);
const code = await mod.run(process.argv);
process.exit(code);
