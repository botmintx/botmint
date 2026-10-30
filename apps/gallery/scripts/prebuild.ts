import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tokenStem } from "@botmint/core";
import {
  buildCollectionInMemory,
  bundleFiles,
  installMarkdown,
  zipBundle,
} from "@botmint/exporters";

const gallery = path.resolve(import.meta.dirname, "..");
const root = path.resolve(gallery, "../..");
const built = buildCollectionInMemory({
  root,
  collection: "dev-sample",
  seed: "botmint-dev-sample-001",
  count: 25,
  packs: ["core", "markets", "creator"],
});

const publicDir = path.join(gallery, "public");
const brandDir = path.join(publicDir, "brand");
const sampleDir = path.join(publicDir, "sample");
mkdirSync(brandDir, { recursive: true });
mkdirSync(sampleDir, { recursive: true });
cpSync(path.join(root, ".github", "assets"), brandDir, { recursive: true });

const tokens = built.tokens.map((token) => {
  const stem = tokenStem(token.recipe.edition);
  const files = bundleFiles(token.recipe, token.drawn, token.rarity, token.rawHash);
  const dir = path.join(sampleDir, stem);
  mkdirSync(dir, { recursive: true });
  for (const file of files) {
    const target = path.join(dir, file.path);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, file.contents);
  }
  writeFileSync(path.join(dir, "bundle.zip"), zipBundle(files));
  const install = installMarkdown(token.recipe, token.drawn, token.rawHash);
  return {
    stem,
    tokenId: token.recipe.tokenId,
    edition: token.recipe.edition,
    name: token.recipe.name,
    dna: token.recipe.dna,
    tier: token.rarity.tier,
    rank: token.rarity.rank,
    score: token.rarity.score,
    description: token.recipe.description,
    job: token.recipe.job,
    policy: token.recipe.policy,
    archetype: token.drawn.archetype.label,
    domain: token.drawn.domain.label,
    persona: token.drawn.persona.label,
    cadence: token.drawn.cadence.label,
    autonomy: token.drawn.autonomy.label,
    output: token.drawn.output.label,
    avatar: token.drawn.avatar.label,
    skills: token.recipe.skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      body: skill.body,
    })),
    connectors: token.recipe.plugins.map((plugin) => plugin.label),
    routine: {
      name: token.recipe.routines[0]!.name,
      when: token.drawn.schedule
        ? `cron "${token.drawn.schedule}"`
        : `when a new ${token.drawn.trigger?.event.replace(/^new_/, "").replaceAll("_", " ")} arrives in ${token.drawn.trigger?.source}`,
      prompt: token.recipe.routines[0]!.prompt,
      deliveryLine: token.recipe.routines[0]!.deliveryLine,
    },
    rawHash: token.rawHash,
    svg: files.find((file) => file.path === "avatar.svg")!.contents,
    install,
  };
});

const data = {
  banner: "Dev sample — not Genesis. 25 bots from seed botmint-dev-sample-001",
  footer: "botmint is an unofficial community project, not affiliated with xAI or X. MIT licensed.",
  seed: built.seed,
  count: built.count,
  provenance: `sha256:${built.rawProvenance}`,
  tiers: built.report.tiers,
  tokens,
};
mkdirSync(path.join(gallery, "data"), { recursive: true });
writeFileSync(path.join(gallery, "data", "collection.json"), JSON.stringify(data));
console.log(`gallery data ${tokens.length}`);
