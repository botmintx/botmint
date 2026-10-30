function sortKeys(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function normalizeCanonical(value: unknown): unknown {
  if (typeof value === "string") return value.normalize("NFC");
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("E_NON_FINITE_NUMBER");
    return value;
  }
  if (value === null || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => normalizeCanonical(item));
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort(sortKeys)) {
      out[key] = normalizeCanonical(source[key]);
    }
    return out;
  }
  throw new Error(`E_CANONICAL_TYPE ${typeof value}`);
}

/** Pretty file bytes: 2-space indent, LF, one trailing newline. */
export function canonicalFile(value: unknown): string {
  return `${JSON.stringify(normalizeCanonical(value), null, 2)}\n`;
}

/** Compact bytes for DNA. No whitespace, no trailing newline. */
export function canonicalCompact(value: unknown): string {
  return JSON.stringify(normalizeCanonical(value));
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
