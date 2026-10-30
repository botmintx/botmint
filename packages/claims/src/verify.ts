import type { ClaimsState } from "@botmint/core";
import { canonicalCompact } from "@botmint/core";
import { cents } from "./note.ts";
import {
  type ClaimStatus,
  claimsRoot,
  latestClaims,
  type RegistryLine,
  serialiseJsonl,
} from "./registry.ts";

const NEXT: Record<ClaimStatus, ClaimStatus[]> = {
  reserved: ["claimed", "released"],
  held: ["claimed", "rejected"],
  claimed: [],
  released: [],
  rejected: [],
};

export function verifyClaims(lines: RegistryLine[], state: ClaimsState, raw?: string): string[] {
  const errors: string[] = [];
  const text = serialiseJsonl(lines);
  if (raw !== undefined && raw !== text) errors.push("jsonl is not canonical");
  lines.forEach((line, index) => {
    if (line.seq !== index + 1) errors.push(`seq ${line.seq} is not ${index + 1}`);
    const raw = canonicalCompact(line);
    if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(raw))
      errors.push(`line ${line.seq} contains an email`);
  });
  if ((state.claimsRoot ?? null) !== claimsRoot(text)) errors.push("claimsRoot mismatch");

  const groups = new Map<string, Extract<RegistryLine, { kind: "claim" }>[]>();
  for (const line of lines) {
    if (line.kind !== "claim") continue;
    const list = groups.get(line.paymentRef) ?? [];
    list.push(line);
    groups.set(line.paymentRef, list);
    if (line.visibility === "private" && line.xHandle !== null) {
      errors.push(`${line.paymentRef} private claim exposes a handle`);
    }
    if (line.status === "claimed" && cents(line.amountUsd) < 1000) {
      errors.push(`${line.paymentRef} claimed below 10.00`);
    }
  }
  for (const [ref, list] of groups) {
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]!.status;
      const next = list[i]!.status;
      if (!NEXT[prev].includes(next)) errors.push(`${ref} illegal ${prev} -> ${next}`);
    }
  }
  const active = new Map<string, string>();
  for (const claim of latestClaims(lines).values()) {
    if ((claim.status === "claimed" || claim.status === "reserved") && claim.tokenId) {
      if (active.has(claim.tokenId)) errors.push(`${claim.tokenId} has two active claims`);
      active.set(claim.tokenId, claim.paymentRef);
    }
  }
  const claimRefs = new Set(
    lines.filter((line) => line.kind === "claim").map((line) => line.paymentRef),
  );
  for (const line of lines) {
    if (line.kind === "refund" && !claimRefs.has(line.paymentRef)) {
      errors.push(`refund ${line.refundId} has no claim`);
    }
  }
  return errors;
}
