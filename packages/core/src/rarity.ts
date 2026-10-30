import { round4 } from "./canonical.ts";
import { type LayerId, SINGLE_PICK_LAYERS } from "./constants.ts";
import type { Drawn } from "./draw.ts";
import type { Registry } from "./registry.ts";

export type TierName = "legendary" | "epic" | "rare" | "uncommon" | "common";

export function tierForRank(rank: number, count: number): TierName {
  const legendary = Math.floor(count * 0.01);
  const epic = Math.floor(count * 0.05);
  const rare = Math.floor(count * 0.15);
  const uncommon = Math.floor(count * 0.4);
  if (rank <= legendary) return "legendary";
  if (rank <= epic) return "epic";
  if (rank <= rare) return "rare";
  if (rank <= uncommon) return "uncommon";
  return "common";
}

export type TokenRarity = { score: number; rank: number; tier: TierName; rawScore: number };

type ShareMap = Record<string, Record<string, number>>;

export type RarityReport = {
  counts: ShareMap;
  expectedShare: ShareMap;
  realisedShare: ShareMap;
  driftPct: ShareMap;
  scorePercentiles: Record<string, number>;
  tiers: Record<TierName, number>;
};

function traitIds(drawn: Drawn, layer: LayerId): string[] {
  switch (layer) {
    case "archetype":
      return [drawn.archetype.id];
    case "domain":
      return [drawn.domain.id];
    case "persona":
      return [drawn.persona.id];
    case "skill":
      return drawn.skills.map((item) => item.id);
    case "cadence":
      return [drawn.cadence.id];
    case "connector":
      return drawn.connectors.map((item) => item.id);
    case "autonomy":
      return [drawn.autonomy.id];
    case "output":
      return [drawn.output.id];
    case "avatar":
      return [drawn.avatar.id];
  }
}

function percentile(sortedAsc: number[], p: number): number {
  const index = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
  );
  return sortedAsc[index]!;
}

export function scoreCollection(
  registry: Registry,
  draws: Drawn[],
): { tokens: TokenRarity[]; report: RarityReport } {
  const count = draws.length;
  const layers = Object.keys(registry.byLayer) as LayerId[];
  const counts: ShareMap = {};
  for (const layer of layers) {
    counts[layer] = {};
    for (const trait of registry.byLayer[layer]) counts[layer]![trait.id] = 0;
  }
  for (const drawn of draws) {
    for (const layer of layers) {
      for (const id of traitIds(drawn, layer)) counts[layer]![id] = (counts[layer]![id] ?? 0) + 1;
    }
  }

  const rawScores = draws.map((drawn) => {
    let score = 0;
    for (const layer of layers) {
      for (const id of traitIds(drawn, layer)) {
        const share = (counts[layer]![id] ?? 0) / count;
        score += -Math.log2(share);
      }
    }
    return score;
  });

  const order = draws
    .map((drawn, index) => ({ index, score: rawScores[index]!, edition: drawn.edition }))
    .sort((a, b) => b.score - a.score || a.edition - b.edition);
  const tokens: TokenRarity[] = new Array(count);
  const tiers: Record<TierName, number> = {
    legendary: 0,
    epic: 0,
    rare: 0,
    uncommon: 0,
    common: 0,
  };
  order.forEach((entry, rankIndex) => {
    const rank = rankIndex + 1;
    const tier = tierForRank(rank, count);
    tiers[tier] += 1;
    tokens[entry.index] = {
      score: round4(entry.score),
      rank,
      tier,
      rawScore: entry.score,
    };
  });

  const expectedShare: ShareMap = {};
  const realisedShare: ShareMap = {};
  const driftPct: ShareMap = {};
  for (const layer of layers) {
    const values = registry.byLayer[layer];
    const weightSum = values.reduce((sum, trait) => sum + trait.weight, 0);
    expectedShare[layer] = {};
    realisedShare[layer] = {};
    if (SINGLE_PICK_LAYERS.includes(layer)) driftPct[layer] = {};
    for (const trait of values) {
      const realised = (counts[layer]![trait.id] ?? 0) / count;
      realisedShare[layer]![trait.id] = round4(realised);
      if (SINGLE_PICK_LAYERS.includes(layer)) {
        const expected = trait.weight / weightSum;
        expectedShare[layer]![trait.id] = round4(expected);
        driftPct[layer]![trait.id] = round4((realised - expected) * 100);
      } else {
        expectedShare[layer]![trait.id] = round4(realised);
      }
    }
  }

  const sorted = [...rawScores].sort((a, b) => a - b);
  const points = [1, 5, 10, 25, 50, 75, 90, 99];
  const scorePercentiles: Record<string, number> = {};
  for (const point of points) scorePercentiles[`p${point}`] = round4(percentile(sorted, point));

  return {
    tokens,
    report: { counts, expectedShare, realisedShare, driftPct, scorePercentiles, tiers },
  };
}
