import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  canonicalFile,
  claimsStateSchema,
  lockFileSchema,
  packManifestSchema,
  recipeSchema,
  traitValueSchema,
  txExportSchema,
} from "@botmint/core";

const require = createRequire(path.resolve(import.meta.dirname, "../packages/core/package.json"));
const { zodToJsonSchema } = require("zod-to-json-schema") as {
  zodToJsonSchema: (schema: unknown, options?: { $refStrategy?: string }) => unknown;
};

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "schema");
mkdirSync(dir, { recursive: true });

const files: Record<string, unknown> = {
  "recipe.schema.json": recipeSchema,
  "trait-value.schema.json": traitValueSchema,
  "pack.schema.json": packManifestSchema,
  "claims-state.schema.json": claimsStateSchema,
  "tx-export.schema.json": txExportSchema,
  "lock.schema.json": lockFileSchema,
};

for (const [name, schema] of Object.entries(files)) {
  const json = zodToJsonSchema(schema as never, { $refStrategy: "none" });
  writeFileSync(path.join(dir, name), canonicalFile(json));
}

console.log(`wrote ${Object.keys(files).length} schemas`);
