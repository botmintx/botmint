import { randomBytes } from "node:crypto";
import { sha256 } from "@botmint/core";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export type ParsedNote = {
  choice: "random" | number[];
  nonce: string;
  visibility: "public" | "private";
};

export function normaliseNonce(nonce: string): string {
  return nonce.toUpperCase().replaceAll("I", "1").replaceAll("L", "1").replaceAll("O", "0");
}

export function nonceHash(nonce: string): string {
  return sha256(normaliseNonce(nonce));
}

export function parseNote(note: string | null): ParsedNote | null {
  if (!note) return null;
  const collapsed = note.trim().replace(/\s+/g, " ");
  const match =
    /^botmint genesis (random|#\d{4,5}(?:,#\d{4,5}){0,2}) (bm-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4})(?: (public|private))?$/i.exec(
      collapsed,
    );
  if (!match) return null;
  const nonce = normaliseNonce(match[2]!);
  if (!/^BM-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/.test(nonce)) return null;
  const visibility = (match[3]?.toLowerCase() as "public" | "private" | undefined) ?? "private";
  if (match[1]!.toLowerCase() === "random") return { choice: "random", nonce, visibility };
  const ids = match[1]!.split(",").map((part) => Number(part.slice(1)));
  if (ids.some((id) => !Number.isInteger(id) || id < 1 || id > 10000)) return null;
  return { choice: ids, nonce, visibility };
}

export function mintNonce(): string {
  let out = "";
  while (out.length < 8) {
    const byte = randomBytes(1)[0]!;
    if (byte >= 256 - (256 % 32)) continue;
    out += ALPHABET[byte % 32];
  }
  return `bm-${out.slice(0, 4)}-${out.slice(4)}`;
}

export function randomIndex(nonce: string, length: number): number {
  if (length <= 0) throw new Error("E_EMPTY_AVAILABLE");
  const hex = sha256(normaliseNonce(nonce));
  return Number(BigInt(`0x${hex}`) % BigInt(length));
}

export function cents(amount: string): number {
  const match = /^(\d+)\.(\d{2})$/.exec(amount);
  if (!match) throw new Error(`E_AMOUNT ${amount}`);
  return Number(match[1]) * 100 + Number(match[2]);
}

export function formatUsd(centsValue: number): string {
  const sign = centsValue < 0 ? "-" : "";
  const abs = Math.abs(centsValue);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 3_600_000).toISOString();
}

export function normaliseHandle(handle: string | null): string | null {
  if (!handle) return null;
  const bare = handle.trim().replace(/^@/, "").toLowerCase();
  if (!bare) return null;
  return `@${bare}`;
}
