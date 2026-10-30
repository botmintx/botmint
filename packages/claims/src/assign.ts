import { randomBytes } from "node:crypto";
import { type ClaimsState, sha256, type TxExport, tokenIdOf } from "@botmint/core";
import {
  addHours,
  cents,
  formatUsd,
  nonceHash,
  normaliseHandle,
  type ParsedNote,
  parseNote,
  randomIndex,
} from "./note.ts";
import {
  type ClaimLine,
  claimsRoot,
  latestClaims,
  type PrivateRecord,
  type RefundLine,
  type RegistryLine,
  serialiseJsonl,
} from "./registry.ts";

export type MappedStatus = "settled" | "pending" | "failed";

export function mapStatus(status: string): MappedStatus | null {
  const value = status.toUpperCase();
  if (value === "SETTLED" || value === "COMPLETED") return "settled";
  if (value === "PENDING" || value === "IN_REVIEW" || value === "PROCESSING") return "pending";
  if (["FAILED", "EXPIRED", "CANCELLED", "REJECTED", "REVERSED"].includes(value)) return "failed";
  return null;
}

export type Reply = { handle: string; text: string; postedAt: string };

export type AssignResult = {
  lines: RegistryLine[];
  state: ClaimsState;
  privateRecords: PrivateRecord[];
  summary: { claims: number; refunds: number; holds: number };
};

function hashHandle(salt: Buffer, handle: string): string {
  return sha256(Buffer.concat([salt, Buffer.from(handle, "utf8")]));
}

function identityOf(record: PrivateRecord | undefined, claim?: ClaimLine): string | null {
  return record?.userId ?? record?.handle ?? claim?.xHandle ?? null;
}

function activeCount(
  latest: Map<string, ClaimLine>,
  records: PrivateRecord[],
  userId: string | null,
  handle: string | null,
): number {
  let count = 0;
  for (const [ref, claim] of latest) {
    if (claim.status !== "claimed" && claim.status !== "reserved") continue;
    const record = records.find((item) => item.paymentRef === ref);
    const id = identityOf(record, claim);
    if (userId && (record?.userId === userId || id === userId)) count += 1;
    else if (!userId && handle && (record?.handle === handle || claim.xHandle === handle))
      count += 1;
  }
  return count;
}

function taken(latest: Map<string, ClaimLine>): Set<number> {
  const ids = new Set<number>();
  for (const claim of latest.values()) {
    if ((claim.status === "claimed" || claim.status === "reserved") && claim.tokenId) {
      ids.add(Number(claim.tokenId.slice(1)));
    }
  }
  return ids;
}

function availableNumbers(latest: Map<string, ClaimLine>): number[] {
  const used = taken(latest);
  const numbers: number[] = [];
  for (let edition = 1; edition <= 10000; edition++) if (!used.has(edition)) numbers.push(edition);
  return numbers;
}

function chooseNumber(
  free: number[],
  parsed: ParsedNote,
): { edition: number; assignedBy: string } | null {
  if (parsed.choice !== "random") {
    for (let index = 0; index < parsed.choice.length; index++) {
      const edition = parsed.choice[index]!;
      if (free.includes(edition)) return { edition, assignedBy: `preference-${index + 1}` };
    }
  }
  if (free.length === 0) return null;
  return { edition: free[randomIndex(parsed.nonce, free.length)]!, assignedBy: "random" };
}

function matchReply(
  tx: TxExport["transactions"][number],
  replies: Reply[],
  used: Set<number>,
): ParsedNote | null {
  const handle = normaliseHandle(tx.payer.handle);
  if (!handle) return null;
  const paid = Date.parse(tx.createdAt);
  const candidates = replies
    .map((reply, index) => ({ reply, index }))
    .filter((item) => !used.has(item.index))
    .filter((item) => normaliseHandle(item.reply.handle) === handle)
    .filter((item) => Math.abs(Date.parse(item.reply.postedAt) - paid) <= 86_400_000)
    .sort((a, b) =>
      a.reply.postedAt < b.reply.postedAt ? -1 : a.reply.postedAt > b.reply.postedAt ? 1 : 0,
    );
  for (const candidate of candidates) {
    const parsed = parseNote(candidate.reply.text);
    if (!parsed) continue;
    used.add(candidate.index);
    return parsed;
  }
  return null;
}

function skip(previous: ClaimLine | undefined, mapped: MappedStatus, readable: boolean): boolean {
  if (!previous) return false;
  if (previous.status === "held" && readable) return false;
  if (previous.status === "rejected") return true;
  if (mapped === "pending" && (previous.status === "reserved" || previous.status === "held"))
    return true;
  if (mapped === "settled" && (previous.status === "claimed" || previous.status === "held"))
    return true;
  if (mapped === "failed" && previous.status === "released") return true;
  return false;
}

export function assignClaims(input: {
  state: ClaimsState;
  lines: RegistryLine[];
  exportFile: TxExport;
  replies?: Reply[];
  privateRecords?: PrivateRecord[];
  salt?: (size: number) => Buffer;
}): AssignResult {
  const lines = [...input.lines];
  const records = [...(input.privateRecords ?? [])];
  const now = input.exportFile.exportedAt;
  let seq = input.state.lastSeq;
  let newClaims = 0;
  let newRefunds = 0;
  let newHolds = 0;
  const usedReplies = new Set<number>();
  const incoming = input.exportFile.transactions
    .filter((tx) => tx.direction === "in")
    .slice()
    .sort((a, b) =>
      a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1,
    );

  const push = (line: RegistryLine) => {
    lines.push(line);
  };
  const nextSeq = () => {
    seq += 1;
    return seq;
  };
  const refund = (paymentRef: string, amountUsd: string, reason: string) => {
    const line: RefundLine = {
      kind: "refund",
      seq: nextSeq(),
      at: now,
      paymentRef,
      refundId: `refund-${paymentRef}`,
      amountUsd,
      reason,
      status: "queued",
    };
    push(line);
    newRefunds += 1;
  };

  for (const tx of incoming) {
    const mapped = mapStatus(tx.status);
    if (!mapped) continue;
    const paymentRef = sha256(tx.id);
    const latest = latestClaims(lines);
    const previous = latest.get(paymentRef);
    const parsed =
      input.state.matchingMode === "reply"
        ? matchReply(tx, input.replies ?? [], usedReplies)
        : parseNote(tx.note);
    if (skip(previous, mapped, parsed !== null)) continue;

    const handle = normaliseHandle(tx.payer.handle);
    let record = records.find((item) => item.paymentRef === paymentRef);
    if (!record) {
      const salt = (input.salt ?? randomBytes)(16);
      record = {
        paymentRef,
        txId: tx.id,
        handle,
        userId: tx.payer.userId,
        salt: salt.toString("hex"),
      };
      records.push(record);
    }
    const hashMaterial = (
      handle ?? (tx.payer.userId ? `id:${tx.payer.userId}` : "unknown")
    ).replace(/^@/, "");
    const hashed = hashHandle(Buffer.from(record.salt, "hex"), hashMaterial);

    const base = {
      kind: "claim" as const,
      seq: 0,
      at: now,
      paymentRef,
      amountUsd: tx.amountUsd,
      paidAt: tx.createdAt,
      nonceHash: parsed ? nonceHash(parsed.nonce) : null,
      requested:
        parsed && parsed.choice !== "random" ? parsed.choice.map((id) => tokenIdOf(id)) : [],
      visibility: parsed?.visibility ?? "private",
      xHandle: parsed?.visibility === "public" ? handle : null,
      handleHash: hashed,
    };

    const reject = (reason: ClaimLine["reason"], withRefund: boolean) => {
      push({
        ...base,
        seq: nextSeq(),
        status: "rejected",
        tokenId: null,
        assignedBy: null,
        expiresAt: null,
        reason,
      });
      if (withRefund) refund(paymentRef, tx.amountUsd, reason ?? "closed");
    };

    if (!input.state.open) {
      reject("closed", mapped !== "failed");
      continue;
    }
    if (!parsed) {
      push({
        ...base,
        seq: nextSeq(),
        status: "held",
        tokenId: null,
        assignedBy: null,
        expiresAt: addHours(tx.createdAt, 72),
        reason: "unreadable-note",
      });
      newHolds += 1;
      continue;
    }
    const nonceUsed = [...latestClaims(lines).values()].some(
      (claim) => claim.paymentRef !== paymentRef && claim.nonceHash === nonceHash(parsed.nonce),
    );
    if (nonceUsed) {
      reject("duplicate-nonce", mapped !== "failed");
      continue;
    }
    if (cents(tx.amountUsd) < 1000) {
      reject("underpaid", mapped !== "failed");
      continue;
    }
    const cap = activeCount(latestClaims(lines), records, tx.payer.userId, handle);
    if (cap >= input.state.perHandleCap) {
      reject("handle-cap", mapped !== "failed");
      continue;
    }

    let edition: number | null = null;
    let assignedBy: string | null = null;
    if (mapped === "settled" && previous?.status === "reserved" && previous.tokenId) {
      edition = Number(previous.tokenId.slice(1));
      assignedBy = previous.assignedBy;
    } else if (mapped !== "failed") {
      const free = availableNumbers(latestClaims(lines));
      const choice = chooseNumber(free, parsed);
      if (!choice) {
        reject("sold-out", true);
        continue;
      }
      edition = choice.edition;
      assignedBy = choice.assignedBy;
    }

    if (mapped === "failed") {
      push({
        ...base,
        seq: nextSeq(),
        status: "released",
        tokenId: null,
        assignedBy: null,
        expiresAt: null,
        reason: "payment-failed",
      });
      continue;
    }
    if (mapped === "pending") {
      push({
        ...base,
        seq: nextSeq(),
        status: "reserved",
        tokenId: tokenIdOf(edition!),
        assignedBy,
        expiresAt: addHours(tx.createdAt, 24),
        reason: null,
      });
      newClaims += 1;
      continue;
    }
    push({
      ...base,
      seq: nextSeq(),
      status: "claimed",
      tokenId: tokenIdOf(edition!),
      assignedBy,
      expiresAt: null,
      reason: null,
    });
    newClaims += 1;
    if (cents(tx.amountUsd) > 1000) {
      refund(paymentRef, formatUsd(cents(tx.amountUsd) - 1000), "overpaid-excess");
    }
  }

  const sweepLatest = latestClaims(lines);
  for (const claim of sweepLatest.values()) {
    if (claim.status === "reserved" && claim.expiresAt && claim.expiresAt < now) {
      push({
        ...claim,
        seq: nextSeq(),
        at: now,
        status: "released",
        reason: "reservation-expired",
        expiresAt: claim.expiresAt,
      });
    }
    if (claim.status === "held" && claim.expiresAt && claim.expiresAt < now) {
      push({
        ...claim,
        seq: nextSeq(),
        at: now,
        status: "rejected",
        reason: "hold-expired",
      });
      refund(claim.paymentRef, claim.amountUsd, "hold-expired");
    }
  }

  const finalClaims = latestClaims(lines);
  let claimed = 0;
  let reserved = 0;
  let held = 0;
  for (const claim of finalClaims.values()) {
    if (claim.status === "claimed") claimed += 1;
    else if (claim.status === "reserved") reserved += 1;
    else if (claim.status === "held") held += 1;
  }
  const jsonl = serialiseJsonl(lines);
  const state: ClaimsState = {
    ...input.state,
    lastExportAt: now,
    lastSeq: seq,
    claimsRoot: claimsRoot(jsonl),
    counts: { claimed, reserved, held, available: 10000 - claimed - reserved },
  };
  return {
    lines,
    state,
    privateRecords: records,
    summary: { claims: newClaims, refunds: newRefunds, holds: newHolds },
  };
}
