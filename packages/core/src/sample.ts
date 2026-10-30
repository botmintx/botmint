export type Weighted = {
  id: string;
  weight: number;
  multiplier?: number;
};

function byId(a: { id: string }, b: { id: string }): number {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/** Integer weight ×2 × multiplier, so 1, 1.5 and 2 all stay integral. */
export function scaledWeight(weight: number, multiplier = 1): number {
  if (multiplier === 1) return weight * 2;
  if (multiplier === 1.5) return weight * 3;
  if (multiplier === 2) return weight * 4;
  throw new Error(`E_BAD_MULTIPLIER ${multiplier}`);
}

/**
 * Candidates are sorted by id. `r = next() mod W2`. The winner is the first
 * candidate whose cumulative scaled weight exceeds `r`.
 */
export function weightedPick<T extends Weighted>(rng: () => number, candidates: readonly T[]): T {
  if (candidates.length === 0) throw new Error("E_EMPTY_CANDIDATES");
  const sorted = [...candidates].sort(byId);
  const weights = sorted.map((c) => scaledWeight(c.weight, c.multiplier ?? 1));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) throw new Error("E_EMPTY_CANDIDATES");
  const r = rng() % total;
  let cumulative = 0;
  for (let i = 0; i < sorted.length; i++) {
    cumulative += weights[i]!;
    if (cumulative > r) return sorted[i]!;
  }
  throw new Error("E_PICK_FELL_THROUGH");
}

/** Multi-pick without replacement. Order is pick order, not id order. */
export function multiPick<T extends Weighted>(
  rng: () => number,
  candidates: readonly T[],
  k: number,
): T[] {
  const pool = [...candidates];
  const picked: T[] = [];
  for (let i = 0; i < k; i++) {
    const choice = weightedPick(rng, pool);
    picked.push(choice);
    const index = pool.findIndex((item) => item.id === choice.id);
    pool.splice(index, 1);
  }
  return picked;
}
