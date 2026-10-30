import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { type ClaimsState, canonicalCompact, canonicalFile, sha256 } from "@botmint/core";

export type ClaimStatus = "reserved" | "claimed" | "released" | "held" | "rejected";
export type RefundStatus =
  | "queued"
  | "approved-sent"
  | "completed"
  | "pending"
  | "refused"
  | "unconfirmed";

export type ClaimLine = {
  kind: "claim";
  seq: number;
  at: string;
  paymentRef: string;
  status: ClaimStatus;
  tokenId: string | null;
  assignedBy: string | null;
  nonceHash: string | null;
  requested: string[];
  amountUsd: string;
  paidAt: string;
  expiresAt: string | null;
  visibility: "public" | "private";
  xHandle: string | null;
  handleHash: string;
  reason: string | null;
};

export type RefundLine = {
  kind: "refund";
  seq: number;
  at: string;
  paymentRef: string;
  refundId: string;
  amountUsd: string;
  reason: string;
  status: RefundStatus;
};

export type EasLine = {
  kind: "eas";
  seq: number;
  at: string;
  paymentRef: string;
  tokenId: string;
  attestationUid: string;
  txHash: string;
  action: "attest" | "revoke";
};

export type RegistryLine = ClaimLine | RefundLine | EasLine;

export type PrivateRecord = {
  paymentRef: string;
  txId: string;
  handle: string | null;
  userId: string | null;
  salt: string;
};

export function assertOutsideWorktree(filePath: string): void {
  let dir = path.resolve(path.dirname(filePath));
  while (true) {
    if (existsSync(path.join(dir, ".git")) || existsSync(path.join(dir, ".git"))) {
      throw new Error(`E_PRIVATE_IN_WORKTREE ${filePath}`);
    }
    const parent = path.dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}

export function readJsonl(file: string): RegistryLine[] {
  if (!existsSync(file)) return [];
  const text = readFileSync(file, "utf8");
  if (!text.trim()) return [];
  return text
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as RegistryLine);
}

export function serialiseJsonl(lines: RegistryLine[]): string {
  return lines.map((line) => canonicalCompact(line)).join("\n") + (lines.length ? "\n" : "");
}

export function emptyState(collection = "genesis"): ClaimsState {
  return {
    claimsRoot: null,
    collection,
    counts: { available: 10000, claimed: 0, held: 0, reserved: 0 },
    lastExportAt: null,
    lastSeq: 0,
    matchingMode: "note",
    open: false,
    payee: "@brandononchain",
    perHandleCap: 5,
    priceUsd: "10.00",
  };
}

export function loadState(file: string): ClaimsState {
  if (!existsSync(file)) return emptyState();
  return JSON.parse(readFileSync(file, "utf8")) as ClaimsState;
}

export function stateFile(state: ClaimsState): string {
  return canonicalFile(state);
}

export function claimsRoot(jsonl: string): string | null {
  if (!jsonl) return null;
  return `sha256:${sha256(jsonl)}`;
}

export function latestClaims(lines: RegistryLine[]): Map<string, ClaimLine> {
  const map = new Map<string, ClaimLine>();
  for (const line of lines) if (line.kind === "claim") map.set(line.paymentRef, line);
  return map;
}

export function latestRefunds(lines: RegistryLine[]): Map<string, RefundLine> {
  const map = new Map<string, RefundLine>();
  for (const line of lines) if (line.kind === "refund") map.set(line.refundId, line);
  return map;
}

export function isGitPath(filePath: string): boolean {
  try {
    assertOutsideWorktree(filePath);
    return false;
  } catch {
    return true;
  }
}

export function fileExists(file: string): boolean {
  return statSync(file, { throwIfNoEntry: false })?.isFile() ?? false;
}
