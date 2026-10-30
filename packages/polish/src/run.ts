import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  canonicalCompact,
  canonicalFile,
  type Recipe,
  type Registry,
  sha256,
  tokenStem,
} from "@botmint/core";
import { chatCompletion, estimateTokens, type PolishClientOptions } from "./client.ts";
import { applyFields, fieldsOf, guardrailReasons, responseSchema } from "./guard.ts";

export const DEFAULT_MODEL = "grok-4.20-0309-non-reasoning";

export function modelAllowed(model: string, allowUndated: boolean): boolean {
  if (model.endsWith("-latest")) return false;
  if (allowUndated) return true;
  return /\d{4}/.test(model);
}

export type DryRunEstimate = {
  tokens: number;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  usd: number;
  model: string;
};

export function priceDryRun(input: {
  root: string;
  model: string;
  prompt: string;
  userJson: string;
  outputText: string;
}): DryRunEstimate {
  const pricing = JSON.parse(
    readFileSync(path.join(input.root, "polish", "pricing.json"), "utf8"),
  ) as {
    models: Record<string, { input: number; cachedInput: number; output: number }>;
  };
  const rates = pricing.models[input.model];
  if (!rates) throw new Error(`E_UNKNOWN_MODEL ${input.model}`);
  const cachedTokens = estimateTokens(input.prompt);
  const inputTokens = estimateTokens(input.userJson);
  const outputTokens = estimateTokens(input.outputText);
  const usd =
    (inputTokens * rates.input + cachedTokens * rates.cachedInput + outputTokens * rates.output) /
    1_000_000;
  return {
    tokens: inputTokens + cachedTokens + outputTokens,
    inputTokens,
    cachedTokens,
    outputTokens,
    usd,
    model: input.model,
  };
}

export async function polishRecipe(input: {
  raw: Recipe;
  registry: Registry;
  archetypeMemoryCount: number;
  prompt: string;
  model: string;
  client: Omit<PolishClientOptions, "model" | "temperature">;
  retryNote?: string;
}): Promise<{
  recipe: Recipe;
  reasons: string[];
  usage: { inputTokens: number; cachedTokens: number; outputTokens: number };
  attempts: number;
}> {
  const fields = fieldsOf(input.raw, input.archetypeMemoryCount);
  const user = canonicalCompact({
    archetype: input.registry.archetypes.find((item) => item.id === input.raw.traits.archetype)
      ?.label,
    autonomy: input.registry.autonomies.find((item) => item.id === input.raw.traits.autonomy)
      ?.label,
    connectors: input.raw.traits.connectors.map(
      (id) => input.registry.connectors.find((item) => item.id === id)?.label,
    ),
    domain: input.registry.domains.find((item) => item.id === input.raw.traits.domain)?.label,
    fields,
    name: input.raw.name,
    persona: {
      label: input.registry.personas.find((item) => item.id === input.raw.traits.persona)?.label,
      voice: input.registry.personas.find((item) => item.id === input.raw.traits.persona)?.voice,
    },
    tokenId: input.raw.tokenId,
  });
  let system = input.prompt.trim();
  if (input.retryNote) system = `${system}\n\n${input.retryNote}`;
  let attempts = 0;
  let lastReasons: string[] = [];
  for (let pass = 0; pass < 2; pass++) {
    attempts += 1;
    const result = await chatCompletion(
      { ...input.client, model: input.model, temperature: 0 },
      system,
      user,
    );
    let parsed: { fields: Record<string, string> };
    try {
      parsed = responseSchema.parse(JSON.parse(result.content));
    } catch {
      lastReasons = ["response was not the expected JSON"];
      system = `${input.prompt.trim()}\n\nYour previous output failed these checks: ${lastReasons.join("; ")}. Keep every name, number and connector exactly; change wording only.`;
      continue;
    }
    const polished = applyFields(input.raw, parsed.fields);
    const reasons = guardrailReasons({
      raw: input.raw,
      polished,
      fields,
      responseKeys: Object.keys(parsed.fields),
      registry: input.registry,
      archetypeMemoryCount: input.archetypeMemoryCount,
    });
    if (reasons.length === 0) {
      return { recipe: polished, reasons: [], usage: result.usage, attempts };
    }
    lastReasons = reasons;
    system = `${input.prompt.trim()}\n\nYour previous output failed these checks: ${reasons.join("; ")}. Keep every name, number and connector exactly; change wording only.`;
  }
  return {
    recipe: input.raw,
    reasons: lastReasons,
    usage: { inputTokens: 0, cachedTokens: 0, outputTokens: 0 },
    attempts,
  };
}

export function cacheKey(rawHash: string, promptHash: string, model: string): string {
  return sha256(`${rawHash}:${promptHash}:${model}`);
}

export function promptHash(bytes: string): string {
  return sha256(bytes);
}

export function assertPolishAllowed(dryRun: boolean, acknowledged: boolean): void {
  if (process.env.CI === "true") throw new Error("E_POLISH_CI");
  if (!dryRun && !acknowledged) throw new Error("E_POLISH_ACK");
  if (!dryRun && !process.env.XAI_API_KEY) throw new Error("E_POLISH_KEY");
}

export function readApiKey(): string {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("E_POLISH_KEY");
  return key;
}

export type PolishUsage = {
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
};

export type PolishReportToken = {
  attempts: number;
  cacheKey: string;
  polishedHash: string | null;
  rawHash: string;
  reasons: string[];
  status: "passed" | "failed";
  tokenId: string;
  usage: PolishUsage;
};

export type PolishReport = {
  allowlistHash: string;
  finishedAt: string;
  model: string;
  promptHash: string;
  startedAt: string;
  tokens: PolishReportToken[];
  totals: {
    cachedTokens: number;
    failed: number;
    inputTokens: number;
    outputTokens: number;
    passed: number;
    skipped: number;
  };
};

export type PolishTarget = {
  archetypeMemoryCount: number;
  rawHash: string;
  recipe: Recipe;
};

function editionOf(tokenId: string): number {
  return Number(tokenId.replace("#", ""));
}

function readReport(file: string): PolishReport | null {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as PolishReport;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Math.max(1, Math.min(limit, items.length));
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]!, index);
    }
  }
  if (items.length > 0) await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

/**
 * Polish a built collection into `polished/` and `polish-report.json`.
 * Finished tokens are skipped when the report cache key and file hash still match.
 */
export async function polishCollection(input: {
  root: string;
  dir: string;
  tokens: PolishTarget[];
  model: string;
  prompt: string;
  registry: Registry;
  client: Omit<PolishClientOptions, "model" | "temperature">;
  concurrency?: number;
  limit?: number;
  onlyFailed?: boolean;
  now?: () => string;
}): Promise<PolishReport> {
  const now = input.now ?? (() => new Date().toISOString());
  const startedAt = now();
  const promptDigest = sha256(input.prompt);
  const allowlistHash = `sha256:${sha256(readFileSync(path.join(input.root, "polish", "allowlist.json")))}`;
  const reportPath = path.join(input.dir, "polish-report.json");
  const previous = readReport(reportPath);
  const byId = new Map((previous?.tokens ?? []).map((token) => [token.tokenId, token]));
  const polishedDir = path.join(input.dir, "polished");
  mkdirSync(polishedDir, { recursive: true });

  const pending: PolishTarget[] = [];
  let skipped = 0;
  for (const token of input.tokens) {
    const prior = byId.get(token.recipe.tokenId);
    const key = cacheKey(token.rawHash, promptDigest, input.model);
    const file = path.join(polishedDir, `${tokenStem(token.recipe.edition)}.json`);
    const fresh =
      prior?.status === "passed" &&
      prior.cacheKey === key &&
      prior.polishedHash !== null &&
      existsSync(file) &&
      sha256(readFileSync(file)) === prior.polishedHash;
    if (fresh) {
      skipped += 1;
      continue;
    }
    if (input.onlyFailed && prior?.status !== "failed") continue;
    pending.push(token);
  }
  const batch = pending.slice(0, input.limit ?? pending.length);
  const touched = new Map<number, string | null>();
  await mapPool(batch, input.concurrency ?? 8, async (token) => {
    const key = cacheKey(token.rawHash, promptDigest, input.model);
    const result = await polishRecipe({
      raw: token.recipe,
      registry: input.registry,
      archetypeMemoryCount: token.archetypeMemoryCount,
      prompt: input.prompt,
      model: input.model,
      client: input.client,
    });
    const stem = tokenStem(token.recipe.edition);
    const file = path.join(polishedDir, `${stem}.json`);
    if (result.reasons.length === 0) {
      const bytes = canonicalFile(result.recipe);
      writeFileSync(file, bytes);
      const polishedHash = sha256(bytes);
      touched.set(token.recipe.edition, polishedHash);
      byId.set(token.recipe.tokenId, {
        attempts: result.attempts,
        cacheKey: key,
        polishedHash,
        rawHash: token.rawHash,
        reasons: [],
        status: "passed",
        tokenId: token.recipe.tokenId,
        usage: result.usage,
      });
      return;
    }
    if (existsSync(file)) rmSync(file);
    touched.set(token.recipe.edition, null);
    byId.set(token.recipe.tokenId, {
      attempts: result.attempts,
      cacheKey: key,
      polishedHash: null,
      rawHash: token.rawHash,
      reasons: result.reasons,
      status: "failed",
      tokenId: token.recipe.tokenId,
      usage: result.usage,
    });
  });

  const manifestPath = path.join(input.dir, "manifest.json");
  if (touched.size > 0 && existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      tokens: { edition: number; polishedHash: string | null }[];
    };
    for (const token of manifest.tokens) {
      if (touched.has(token.edition)) token.polishedHash = touched.get(token.edition) ?? null;
    }
    writeFileSync(manifestPath, canonicalFile(manifest));
  }

  const tokens = [...byId.values()].sort((a, b) => editionOf(a.tokenId) - editionOf(b.tokenId));
  const totals = tokens.reduce(
    (sum, token) => {
      sum.cachedTokens += token.usage.cachedTokens;
      sum.inputTokens += token.usage.inputTokens;
      sum.outputTokens += token.usage.outputTokens;
      if (token.status === "passed") sum.passed += 1;
      else sum.failed += 1;
      return sum;
    },
    {
      cachedTokens: 0,
      failed: 0,
      inputTokens: 0,
      outputTokens: 0,
      passed: 0,
      skipped,
    },
  );
  const report: PolishReport = {
    allowlistHash,
    finishedAt: now(),
    model: input.model,
    promptHash: `sha256:${promptDigest}`,
    startedAt,
    tokens,
    totals,
  };
  writeFileSync(reportPath, canonicalFile(report));
  return report;
}

export { canonicalFile };
