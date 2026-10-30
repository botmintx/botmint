import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { LAYERS, type LayerId } from "./constants.ts";
import { sha256 } from "./hash.ts";
import {
  type Archetype,
  type Autonomy,
  type AvatarStyle,
  type Cadence,
  type Connector,
  type Domain,
  type OutputStyle,
  type PackManifest,
  type Persona,
  packManifestSchema,
  type Skill,
  type TraitValue,
  traitValueSchema,
} from "./schema.ts";

export type Registry = {
  root: string;
  packs: PackManifest[];
  packDirs: Record<string, string>;
  archetypes: Archetype[];
  domains: Domain[];
  personas: Persona[];
  skills: Skill[];
  cadences: Cadence[];
  connectors: Connector[];
  autonomies: Autonomy[];
  outputs: OutputStyle[];
  avatars: AvatarStyle[];
  byLayer: Record<LayerId, TraitValue[]>;
  get: (layer: LayerId, id: string) => TraitValue;
};

function listYaml(dir: string): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function fail(message: string): never {
  throw new Error(message);
}

export function loadPacks(root: string, only?: string[]): Registry {
  const packsDir = path.join(root, "packs");
  const names = readdirSync(packsDir)
    .filter((name) => statSync(path.join(packsDir, name)).isDirectory())
    .filter((name) => !only || only.includes(name))
    .sort();
  if (only) {
    for (const name of only) {
      if (!names.includes(name)) fail(`E_UNKNOWN_PACK ${name}`);
    }
  }
  const values: TraitValue[] = [];
  const packs: PackManifest[] = [];
  const packDirs: Record<string, string> = {};
  const seen = new Map<string, string>();

  for (const name of names) {
    const dir = path.join(packsDir, name);
    packDirs[name] = dir;
    const manifestRaw = parse(readFileSync(path.join(dir, "pack.yaml"), "utf8"));
    const manifest = packManifestSchema.parse(manifestRaw);
    if (manifest.id !== name) fail(`E_PACK_ID ${name} != ${manifest.id}`);
    packs.push(manifest);
    if (manifest.names) {
      const namesPath = path.join(dir, manifest.names);
      if (!statSync(namesPath, { throwIfNoEntry: false })?.isFile()) {
        fail(`E_MISSING_NAMES ${manifest.names}`);
      }
    }
    for (const layer of manifest.layers) {
      const layerDir = path.join(dir, layer);
      for (const file of listYaml(layerDir)) {
        const raw = parse(readFileSync(path.join(layerDir, file), "utf8"));
        const trait = traitValueSchema.parse(raw);
        if (trait.layer !== layer) fail(`E_LAYER_MISMATCH ${file}`);
        const key = `${trait.layer}:${trait.id}`;
        if (seen.has(key)) fail(`E_DUPLICATE_TRAIT ${key}`);
        seen.set(key, file);
        if (trait.layer === "avatar") {
          const expected = `${trait.label.toLowerCase()} style`;
          if (trait.promptStyle !== expected) {
            fail(`E_PROMPT_STYLE ${trait.id} expected ${expected}`);
          }
        }
        if (trait.layer === "autonomy") {
          const expectedRank =
            trait.id === "read-only"
              ? 0
              : trait.id === "draft-only"
                ? 1
                : trait.id === "approve-to-act"
                  ? 2
                  : trait.id === "bounded-autonomous"
                    ? 3
                    : -1;
          if (trait.rank !== expectedRank) fail(`E_AUTONOMY_RANK ${trait.id}`);
        }
        values.push(trait);
      }
    }
  }

  const byLayer = Object.fromEntries(LAYERS.map((layer) => [layer, [] as TraitValue[]])) as Record<
    LayerId,
    TraitValue[]
  >;
  for (const trait of values) byLayer[trait.layer].push(trait);
  for (const layer of LAYERS) {
    byLayer[layer].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  const idExists = (layer: LayerId, id: string) => byLayer[layer].some((item) => item.id === id);
  for (const trait of values) {
    if (trait.layer === "archetype") {
      for (const id of trait.requires?.connectors ?? []) {
        if (!idExists("connector", id)) fail(`E_MISSING_REF connector ${id} from ${trait.id}`);
      }
      for (const id of trait.requires?.domain ?? []) {
        if (!idExists("domain", id)) fail(`E_MISSING_REF domain ${id} from ${trait.id}`);
      }
      if (trait.caps?.autonomy && !idExists("autonomy", trait.caps.autonomy)) {
        fail(`E_MISSING_REF autonomy ${trait.caps.autonomy}`);
      }
      for (const id of Object.keys(trait.affinity?.skills ?? {})) {
        if (!idExists("skill", id)) fail(`E_MISSING_REF skill ${id}`);
      }
      for (const id of Object.keys(trait.affinity?.domains ?? {})) {
        if (!idExists("domain", id)) fail(`E_MISSING_REF domain ${id}`);
      }
      for (const id of trait.affinity?.cadences ?? []) {
        if (!idExists("cadence", id)) fail(`E_MISSING_REF cadence ${id}`);
      }
    }
    if (
      trait.layer === "domain" &&
      trait.caps?.autonomy &&
      !idExists("autonomy", trait.caps.autonomy)
    ) {
      fail(`E_MISSING_REF autonomy ${trait.caps.autonomy}`);
    }
    if (trait.layer === "skill") {
      for (const id of trait.needs?.connectors ?? []) {
        if (!idExists("connector", id)) fail(`E_MISSING_REF connector ${id} from ${trait.id}`);
      }
    }
    if (trait.layer === "connector") {
      for (const id of trait.allowedOn?.archetype ?? []) {
        if (!idExists("archetype", id)) fail(`E_MISSING_REF archetype ${id}`);
      }
      if (trait.caps?.autonomy && !idExists("autonomy", trait.caps.autonomy)) {
        fail(`E_MISSING_REF autonomy ${trait.caps.autonomy}`);
      }
    }
  }

  const get = (layer: LayerId, id: string): TraitValue => {
    const found = byLayer[layer].find((item) => item.id === id);
    if (!found) fail(`E_UNKNOWN_TRAIT ${layer}:${id}`);
    return found;
  };

  return {
    root,
    packs,
    packDirs,
    archetypes: byLayer.archetype as Archetype[],
    domains: byLayer.domain as Domain[],
    personas: byLayer.persona as Persona[],
    skills: byLayer.skill as Skill[],
    cadences: byLayer.cadence as Cadence[],
    connectors: byLayer.connector as Connector[],
    autonomies: byLayer.autonomy as Autonomy[],
    outputs: byLayer.output as OutputStyle[],
    avatars: byLayer.avatar as AvatarStyle[],
    byLayer,
    get,
  };
}

export function walkFiles(dir: string): string[] {
  const out: string[] = [];
  const visit = (current: string, rel: string) => {
    for (const name of readdirSync(current).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
      const abs = path.join(current, name);
      const next = rel ? `${rel}/${name}` : name;
      if (statSync(abs).isDirectory()) visit(abs, next);
      else out.push(next);
    }
  };
  visit(dir, "");
  return out;
}

/** sha256 of `<path>\\0<sha256(bytes)>\\n` lines, paths sorted. */
export function packHash(dir: string): string {
  let text = "";
  for (const rel of walkFiles(dir)) {
    const bytes = readFileSync(path.join(dir, rel));
    text += `${rel}\0${sha256(bytes)}\n`;
  }
  return sha256(text);
}
