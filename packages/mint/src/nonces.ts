import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { NonceStore } from "./claim.ts";

/** Local replay list. The bot owns this file. It is not stored on the contract. */
export function defaultNonceFile(): string {
  return path.join(homedir(), ".botmint", "nonces.json");
}

export class FileNonceStore implements NonceStore {
  private readonly file: string;
  constructor(file: string) {
    this.file = file;
  }

  has(nonce: string): boolean {
    return this.read().includes(nonce.toLowerCase());
  }

  add(nonce: string): void {
    const nonces = this.read();
    const value = nonce.toLowerCase();
    if (!nonces.includes(value)) nonces.push(value);
    nonces.sort();
    const dir = path.dirname(this.file);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const tmp = path.join(dir, `.nonces.${process.pid}.tmp`);
    writeFileSync(tmp, `${JSON.stringify({ nonces }, null, 2)}\n`, { mode: 0o600 });
    renameSync(tmp, this.file);
  }

  private read(): string[] {
    if (!existsSync(this.file)) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(this.file, "utf8"));
    } catch {
      throw new Error(`nonce file is not valid JSON: ${this.file}`);
    }
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as { nonces?: unknown }).nonces)
    ) {
      throw new Error(`nonce file must be {"nonces":[]} : ${this.file}`);
    }
    return (parsed as { nonces: unknown[] }).nonces.map((nonce) => {
      if (typeof nonce !== "string")
        throw new Error(`nonce file has a non-string entry: ${this.file}`);
      return nonce.toLowerCase();
    });
  }
}
