import { createHash } from "node:crypto";

/**
 * PractRand sfc32 (Chris Doty-Humphrey).
 * `a, b, c` mix with counter `d`. Rotate 21, shifts 9 and 3.
 * Returns a uint32.
 */
export function sfc32(a0: number, b0: number, c0: number, d0: number): () => number {
  let a = a0 >>> 0;
  let b = b0 >>> 0;
  let c = c0 >>> 0;
  let d = d0 >>> 0;
  return () => {
    const t = (a + b + d) >>> 0;
    d = (d + 1) >>> 0;
    a = (b ^ (b >>> 9)) >>> 0;
    b = (c + ((c << 3) >>> 0)) >>> 0;
    c = ((((c << 21) | (c >>> 11)) >>> 0) + t) >>> 0;
    return t;
  };
}

export function floatOf(next: () => number): number {
  return next() / 2 ** 32;
}

/** Edition stream. Attempt 0 omits the attempt suffix. The first 12 outputs are discarded. */
export function editionRng(collectionSeed: string, edition: number, attempt: number): () => number {
  const material =
    attempt === 0 ? `${collectionSeed}:${edition}` : `${collectionSeed}:${edition}:${attempt}`;
  const hash = createHash("sha256").update(material, "utf8").digest();
  const next = sfc32(
    hash.readUInt32BE(0),
    hash.readUInt32BE(4),
    hash.readUInt32BE(8),
    hash.readUInt32BE(12),
  );
  for (let i = 0; i < 12; i++) next();
  return next;
}

export function rngFromSeedMaterial(material: string): () => number {
  const hash = createHash("sha256").update(material, "utf8").digest();
  const next = sfc32(
    hash.readUInt32BE(0),
    hash.readUInt32BE(4),
    hash.readUInt32BE(8),
    hash.readUInt32BE(12),
  );
  for (let i = 0; i < 12; i++) next();
  return next;
}
