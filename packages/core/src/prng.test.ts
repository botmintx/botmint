import { describe, expect, it } from "vitest";
import { editionRng, sfc32 } from "./prng.ts";
import { multiPick, weightedPick } from "./sample.ts";

describe("sfc32", () => {
  it("matches the PractRand vector for state 1,2,3,4", () => {
    const next = sfc32(1, 2, 3, 4);
    const outputs = Array.from({ length: 15 }, () => next());
    expect(outputs.slice(0, 5)).toEqual([7, 34, 56623200, 188882296, 3431242869]);
    expect(outputs[12]).toBe(417285410);
  });

  it("discards 12 outputs and is stable for a collection seed", () => {
    const a = editionRng("botmint-golden-001", 1, 0);
    const b = editionRng("botmint-golden-001", 1, 0);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    const retry = editionRng("botmint-golden-001", 1, 1);
    expect(retry()).not.toBe(editionRng("botmint-golden-001", 1, 0)());
  });
});

describe("weightedPick", () => {
  it("uses integer weights and id order", () => {
    const sequence = [0, 2, 3, 1];
    let i = 0;
    const rng = () => sequence[i++]!;
    const candidates = [
      { id: "b", weight: 1 },
      { id: "a", weight: 1 },
    ];
    // W2 = 4. r=0 and r=2 fall in a (cum 2), r=3 falls in b, r=1 falls in a.
    expect(weightedPick(rng, candidates).id).toBe("a");
    expect(weightedPick(rng, candidates).id).toBe("b");
    expect(weightedPick(rng, candidates).id).toBe("b");
    expect(weightedPick(rng, candidates).id).toBe("a");
  });

  it("honours a 1.5 multiplier", () => {
    const rng = () => 4;
    // a w2=2, b w2=3 (weight 1 × 1.5). total 5. r=4 lands on b.
    const picked = weightedPick(rng, [
      { id: "a", weight: 1, multiplier: 1 },
      { id: "b", weight: 1, multiplier: 1.5 },
    ]);
    expect(picked.id).toBe("b");
  });

  it("removes winners during multi-pick", () => {
    let n = 0;
    const rng = () => {
      n += 1;
      return 0;
    };
    const picked = multiPick(
      rng,
      [
        { id: "a", weight: 1 },
        { id: "b", weight: 1 },
        { id: "c", weight: 1 },
      ],
      2,
    );
    expect(picked.map((item) => item.id)).toEqual(["a", "b"]);
    expect(n).toBe(2);
  });

  it("throws on an empty pool", () => {
    expect(() => weightedPick(() => 0, [])).toThrow(/E_EMPTY_CANDIDATES/);
  });
});
