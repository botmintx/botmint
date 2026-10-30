import path from "node:path";
import { buildCollectionInMemory, writeCollection } from "@botmint/exporters";

const root = path.resolve(import.meta.dirname, "..");

const built = buildCollectionInMemory({
  root,
  collection: "dev-sample",
  seed: "botmint-dev-sample-001",
  count: 25,
  packs: ["core", "markets", "creator"],
});

writeCollection(root, built, { bundles: false });
console.log(`dev-sample ${built.count} raw provenance sha256:${built.rawProvenance}`);
