import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tokenStem } from "@botmint/core";
import {
  buildCollectionInMemory,
  bundleFiles,
  installMarkdown,
  zipBundle,
} from "@botmint/exporters";
import { loaderManifest } from "@botmint/loader";

const gallery = path.resolve(import.meta.dirname, "..");
const root = path.resolve(gallery, "../..");
const forge = process.platform === "win32" ? "forge.exe" : "forge";
execFileSync(forge, ["build", "--root", path.join(root, "contracts")], {
  cwd: root,
  stdio: "inherit",
});
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
  const polishedFile = path.join(root, "collections/dev-sample/polished", `${stem}.json`);
  const polished = existsSync(polishedFile)
    ? (JSON.parse(readFileSync(polishedFile, "utf8")) as { name?: string; skills?: unknown })
    : undefined;
  const usePolished = Boolean(
    polished && typeof polished.name === "string" && Array.isArray(polished.skills),
  );
  const recipe = usePolished ? { ...token.recipe, ...polished } : token.recipe;
  const skillLabels = recipe.attributes
    .filter((attribute) => attribute.trait_type === "Skill")
    .map((attribute) => attribute.value);
  const connectorLabels = recipe.attributes
    .filter((attribute) => attribute.trait_type === "Connector")
    .map((attribute) => attribute.value);
  const manifest = loaderManifest({
    collection: "dev-sample",
    edition: token.recipe.edition,
    tokenId: token.recipe.tokenId,
    name: recipe.name,
    description: recipe.description,
    job: recipe.job,
    policy: recipe.policy,
    traits: {
      archetype: { id: recipe.traits.archetype, label: token.drawn.archetype.label },
      domain: { id: recipe.traits.domain, label: token.drawn.domain.label },
      persona: { id: recipe.traits.persona, label: token.drawn.persona.label },
      cadence: { id: recipe.traits.cadence, label: token.drawn.cadence.label },
      autonomy: { id: recipe.traits.autonomy, label: token.drawn.autonomy.label },
      output: { id: recipe.traits.output, label: token.drawn.output.label },
      avatar: { id: recipe.traits.avatar, label: token.drawn.avatar.label },
      connectors: recipe.traits.connectors.map((id, index) => ({
        id,
        label: connectorLabels[index] ?? token.recipe.plugins[index]?.label ?? id,
      })),
      skills: recipe.traits.skills.map((id, index) => ({ id, label: skillLabels[index] ?? id })),
    },
    skills: recipe.skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      body: skill.body,
    })),
    memory: recipe.memories,
    routine: {
      name: recipe.routines[0]!.name,
      when: token.drawn.schedule
        ? `cron "${token.drawn.schedule}"`
        : `when a new ${token.drawn.trigger?.event.replace(/^new_/, "").replaceAll("_", " ")} arrives in ${token.drawn.trigger?.source}`,
      prompt: recipe.routines[0]!.prompt,
    },
    pfpPath: `/sample/${stem}/avatar.svg`,
    instructionsSource: usePolished ? "polished" : "raw",
  });
  const botDir = path.join(publicDir, "bots", stem);
  mkdirSync(botDir, { recursive: true });
  writeFileSync(path.join(botDir, "loader.json"), `${JSON.stringify(manifest, null, 2)}\n`);
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
const mintDir = path.join(publicDir, "mint");
mkdirSync(mintDir, { recursive: true });
cpSync(path.join(root, "packages/mint/claim-domain.json"), path.join(mintDir, "claim-domain.json"));
cpSync(path.join(root, "packages/mint/abi.json"), path.join(mintDir, "abi.json"));
const compiled = JSON.parse(
  readFileSync(path.join(root, "contracts/out/BotmintGenesis.sol/BotmintGenesis.json"), "utf8"),
) as { abi: unknown; bytecode: { object: string } };
writeFileSync(
  path.join(mintDir, "BotmintGenesis.json"),
  JSON.stringify({ abi: compiled.abi, bytecode: compiled.bytecode.object }),
);
console.log(`gallery data ${tokens.length}`);
