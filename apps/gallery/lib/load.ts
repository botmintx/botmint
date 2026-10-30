import { readFileSync } from "node:fs";
import path from "node:path";

export type GalleryToken = {
  stem: string;
  tokenId: string;
  edition: number;
  name: string;
  dna: string;
  tier: string;
  rank: number;
  score: number;
  description: string;
  job: string;
  policy: string;
  archetype: string;
  domain: string;
  persona: string;
  cadence: string;
  autonomy: string;
  output: string;
  avatar: string;
  skills: { name: string; description: string; body: string }[];
  connectors: string[];
  routine: { name: string; when: string; prompt: string; deliveryLine: string };
  rawHash: string;
  svg: string;
  install: string;
};

export type GalleryData = {
  banner: string;
  footer: string;
  seed: string;
  count: number;
  provenance: string;
  tiers: Record<string, number>;
  tokens: GalleryToken[];
};

export function loadGallery(): GalleryData {
  const file = path.join(process.cwd(), "data", "collection.json");
  return JSON.parse(readFileSync(file, "utf8")) as GalleryData;
}

export const BANNER = "Dev sample — not Genesis. 25 bots from seed botmint-dev-sample-001";
export const FOOTER =
  "botmint is an unofficial community project, not affiliated with xAI or X. MIT licensed.";
