import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileNonceStore } from "./nonces.ts";

describe("nonce file", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
  });

  it("remembers a nonce in a local file and ignores case", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "botmint-nonces-"));
    dirs.push(dir);
    const file = path.join(dir, "nonces.json");
    const store = new FileNonceStore(file);
    const nonce = `0x${"ab".repeat(32)}`;
    expect(store.has(nonce)).toBe(false);
    store.add(nonce);
    expect(store.has(nonce.toUpperCase())).toBe(true);
    expect(new FileNonceStore(file).has(nonce)).toBe(true);
    const saved = JSON.parse(readFileSync(file, "utf8")) as { nonces: string[] };
    expect(saved.nonces).toEqual([nonce]);
  });
});
