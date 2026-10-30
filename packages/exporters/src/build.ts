import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { composeRecipe } from "@botmint/composer";
import {
  canonicalFile,
  type Drawn,
  generateDraws,
  hashChain,
  loadPacks,
  type RarityReport,
  type Recipe,
  scoreCollection,
  sha256,
  tokenStem,
} from "@botmint/core";
import { bundleFiles } from "./files.ts";
import { slugify } from "./slug.ts";
import { zipBundle } from "./zip.ts";

export type BuiltToken = {
  drawn: Drawn;
  recipe: Recipe;
  rawHash: string;
  rarity: { score: number; rank: number; tier: string };
};

export type BuiltCollection = {
  collection: string;
  seed: string;
  count: number;
  tokens: BuiltToken[];
  report: RarityReport;
  rawProvenance: string;
  provenanceText: string;
  manifest: ReturnType<typeof manifestOf>;
};

function manifestOf(input: { collection: string; seed: string; tokens: BuiltToken[] }) {
  return {
    collection: input.collection,
    count: input.tokens.length,
    engineVersion: input.tokens[0]?.recipe.engineVersion ?? "1.0.0",
    seed: input.seed,
    tokens: input.tokens.map((token) => ({
      dna: token.recipe.dna,
      edition: token.recipe.edition,
      featuredUrl: null,
      name: token.recipe.name,
      polishedHash: null,
      rarity: {
        rank: token.rarity.rank,
        score: token.rarity.score,
        tier: token.rarity.tier,
      },
      rawHash: token.rawHash,
      slug: slugify(token.recipe.name),
      tokenId: token.recipe.tokenId,
      traits: token.recipe.traits,
    })),
  };
}

export function buildCollectionInMemory(input: {
  root: string;
  collection: string;
  seed: string;
  count: number;
  packs?: string[];
}): BuiltCollection {
  const registry = loadPacks(input.root, input.packs);
  const draws = generateDraws(registry, input.seed, input.count);
  const recipes = draws.map((drawn) => composeRecipe(drawn, input.collection));
  const scored = scoreCollection(registry, draws);
  const tokens: BuiltToken[] = recipes.map((recipe, index) => {
    const bytes = canonicalFile(recipe);
    return {
      drawn: draws[index]!,
      recipe,
      rawHash: sha256(bytes),
      rarity: {
        score: scored.tokens[index]!.score,
        rank: scored.tokens[index]!.rank,
        tier: scored.tokens[index]!.tier,
      },
    };
  });
  const rawProvenance = hashChain(tokens.map((token) => token.rawHash));
  const lines = [
    `provenance sha256:${rawProvenance}`,
    ...tokens.map((token) => `${token.recipe.tokenId} ${token.rawHash}`),
  ];
  return {
    collection: input.collection,
    seed: input.seed,
    count: input.count,
    tokens,
    report: scored.report,
    rawProvenance,
    provenanceText: `${lines.join("\n")}\n`,
    manifest: manifestOf({ collection: input.collection, seed: input.seed, tokens }),
  };
}

export function writeCollection(
  root: string,
  built: BuiltCollection,
  options?: { bundles?: boolean },
): void {
  const dir = path.join(root, "collections", built.collection);
  const rawDir = path.join(dir, "raw");
  mkdirSync(rawDir, { recursive: true });
  for (const token of built.tokens) {
    writeFileSync(
      path.join(rawDir, `${tokenStem(token.recipe.edition)}.json`),
      canonicalFile(token.recipe),
    );
  }
  writeFileSync(path.join(dir, "manifest.json"), canonicalFile(built.manifest));
  writeFileSync(path.join(dir, "rarity.json"), canonicalFile(built.report));
  writeFileSync(path.join(dir, "provenance.txt"), built.provenanceText);
  if (options?.bundles !== false) {
    for (const token of built.tokens) {
      const folder = path.join(
        root,
        "out",
        built.collection,
        `${tokenStem(token.recipe.edition)}-${slugify(token.recipe.name)}`,
      );
      mkdirSync(folder, { recursive: true });
      const files = bundleFiles(token.recipe, token.drawn, token.rarity, token.rawHash);
      for (const file of files) {
        const target = path.join(folder, file.path);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, file.contents);
      }
      writeFileSync(path.join(folder, "bundle.zip"), zipBundle(files));
    }
  }
}

export function writeCollectionFiles(
  root: string,
  input: {
    collection: string;
    seed: string;
    count: number;
    packs?: string[];
    bundles?: boolean;
  },
): BuiltCollection {
  const built = buildCollectionInMemory({ root, ...input });
  writeCollection(root, built, { bundles: input.bundles });
  return built;
}
