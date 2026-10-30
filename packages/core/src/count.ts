import type { Registry } from "./registry.ts";

export type CountReport = {
  rawCore: number;
  validCore: number;
  independent: number;
  raw: number;
  valid: number;
  dnaSpace: number;
};

function combinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = [];
  const walk = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      acc.push(items[i]!);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return out;
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i;
  return result;
}

/**
 * Enumerate archetype × domain × connector pair × autonomy and keep combinations
 * that satisfy R1–R7. R8 and R9 are draw-time rules and are not part of the count.
 */
export function countSpace(registry: Registry): CountReport {
  const pairs = combinations(registry.connectors, 2);
  let validCore = 0;
  for (const archetype of registry.archetypes) {
    for (const domain of registry.domains) {
      if (archetype.requires?.domain && !archetype.requires.domain.includes(domain.id)) continue;
      for (const pair of pairs) {
        const ids = new Set(pair.map((item) => item.id));
        const forced = archetype.requires?.connectors ?? [];
        if (!forced.every((id) => ids.has(id))) continue;
        if (
          pair.some(
            (connector) =>
              connector.allowedOn?.archetype &&
              !connector.allowedOn.archetype.includes(archetype.id),
          )
        ) {
          continue;
        }
        const ranks: number[] = [];
        const push = (id: string | undefined) => {
          if (!id) return;
          const level = registry.autonomies.find((item) => item.id === id);
          if (level) ranks.push(level.rank);
        };
        push(archetype.caps?.autonomy);
        push(domain.caps?.autonomy);
        for (const connector of pair) push(connector.caps?.autonomy);
        const cap = ranks.length === 0 ? 3 : Math.min(...ranks);
        for (const autonomy of registry.autonomies) {
          if (autonomy.rank <= cap) validCore += 1;
        }
      }
    }
  }

  const rawCore =
    registry.archetypes.length *
    registry.domains.length *
    choose(registry.connectors.length, 2) *
    registry.autonomies.length;
  const independent =
    registry.personas.length *
    choose(registry.skills.length, 3) *
    registry.cadences.length *
    registry.outputs.length *
    registry.avatars.length;
  const dnaSpace =
    validCore *
    registry.personas.length *
    choose(registry.skills.length, 3) *
    registry.cadences.length;

  return {
    rawCore,
    validCore,
    independent,
    raw: rawCore * independent,
    valid: validCore * independent,
    dnaSpace,
  };
}

export const EXPECTED_COUNT: CountReport = {
  rawCore: 42900,
  validCore: 19535,
  independent: 8870400,
  raw: 380540160000,
  valid: 173283264000,
  dnaSpace: 2406712000,
};
