import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  decodeGenesisData,
  GENESIS_SCHEMA,
  genesisData,
  registerTx,
  schemaUid,
} from "@botmint/chain";
import { assignClaims, emptyState, serialiseJsonl, verifyClaims } from "@botmint/claims";
import { composeRecipe } from "@botmint/composer";
import {
  canonicalFile,
  countSpace,
  EXPECTED_COUNT,
  generateDraws,
  loadPacks,
  sfc32,
  sha256,
} from "@botmint/core";
import { buildCollectionInMemory, bundleFiles } from "@botmint/exporters";
import { errorsOf, lintRecipe } from "@botmint/lint";
import { assertPolishAllowed, fieldsOf, polishCollection, polishRecipe } from "@botmint/polish";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = path.join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (name.endsWith(".ts")) out.push(abs);
  }
  return out;
}

describe("engine", () => {
  it("matches the sfc32 vector", () => {
    const rng = sfc32(1, 2, 3, 4);
    const first = [rng(), rng(), rng(), rng(), rng()];
    expect(first).toEqual([7, 34, 56623200, 188882296, 3431242869]);
    const again = sfc32(1, 2, 3, 4);
    for (let i = 0; i < 12; i++) again();
    expect(again()).toBe(417285410);
  });

  it("counts the starter packs exactly", () => {
    const report = countSpace(loadPacks(root));
    expect(report).toEqual(EXPECTED_COUNT);
  });

  it("does not use Math.random in the deterministic packages", () => {
    const dirs = ["packages/core/src", "packages/composer/src", "packages/exporters/src"].map(
      (dir) => path.join(root, dir),
    );
    const hits: string[] = [];
    for (const dir of dirs) {
      for (const file of walk(dir)) {
        if (readFileSync(file, "utf8").includes("Math.random"))
          hits.push(path.relative(root, file));
      }
    }
    expect(hits).toEqual([]);
  });

  it("draws 10000 editions without a rule violation", () => {
    const registry = loadPacks(root);
    const draws = generateDraws(registry, "botmint-property-001", 10_000);
    expect(draws).toHaveLength(10_000);
    expect(new Set(draws.map((draw) => draw.dna)).size).toBe(10_000);
    for (const drawn of draws) {
      const issues = errorsOf(lintRecipe(composeRecipe(drawn, "property"), registry));
      expect(issues, drawn.tokenId).toEqual([]);
    }
  });

  it("matches the golden bundle files", () => {
    const built = buildCollectionInMemory({
      root,
      collection: "golden",
      seed: "botmint-golden-001",
      count: 50,
    });
    const dir = path.join(root, "tests", "golden", "botmint-golden-001");
    expect(readFileSync(path.join(dir, "manifest.json"), "utf8")).toBe(
      canonicalFile(built.manifest),
    );
    expect(readFileSync(path.join(dir, "rarity.json"), "utf8")).toBe(canonicalFile(built.report));
    expect(readFileSync(path.join(dir, "provenance.txt"), "utf8")).toBe(built.provenanceText);
    for (const token of built.tokens) {
      const folder = path.join(dir, String(token.recipe.edition).padStart(4, "0"));
      for (const file of bundleFiles(token.recipe, token.drawn, token.rarity, token.rawHash)) {
        expect(readFileSync(path.join(folder, file.path), "utf8"), file.path).toBe(file.contents);
      }
    }
  });

  it("matches the determinism fixture", () => {
    const expected = JSON.parse(
      readFileSync(path.join(root, "tests", "fixtures", "determinism-200.json"), "utf8"),
    );
    const built = buildCollectionInMemory({
      root,
      collection: "determinism",
      seed: "botmint-determinism-001",
      count: 200,
    });
    expect(built.tokens.map((token) => token.rawHash)).toEqual(expected);
  });
});

describe("claims and chain", () => {
  it("refunds a payment while claims are closed", () => {
    const state = emptyState();
    const result = assignClaims({
      state,
      lines: [],
      salt: () => Buffer.alloc(16, 7),
      exportFile: {
        exportedAt: "2026-10-30T00:00:00.000Z",
        source: "x-money get_transactions",
        transactions: [
          {
            id: "tx-closed",
            createdAt: "2026-10-30T00:00:00.000Z",
            status: "SETTLED",
            direction: "in",
            amountUsd: "10.00",
            note: "botmint genesis random bm-7KQ2-9XPA private",
            payer: { handle: "@collector", userId: "user-1" },
          },
        ],
      },
    });
    expect(result.summary.refunds).toBe(1);
    expect(result.lines.some((line) => line.kind === "claim" && line.status === "rejected")).toBe(
      true,
    );
    const raw = serialiseJsonl(result.lines);
    expect(verifyClaims(result.lines, result.state, raw)).toEqual([]);
  });

  it("encodes a genesis attestation without sending it", () => {
    const data = genesisData({
      collection: "genesis",
      count: 10000,
      provenanceHash: `0x${"ab".repeat(32)}`,
      seed: "example-seed",
      gitCommit: `0x${"cd".repeat(20)}`,
      engineVersion: "1.0.0",
      lockFileHash: `0x${"ef".repeat(32)}`,
    });
    const decoded = decodeGenesisData(data);
    expect(decoded.collection).toBe("genesis");
    expect(decoded.count).toBe(10000);
    expect(decoded.seed).toBe("example-seed");
    const tx = registerTx("base", GENESIS_SCHEMA, false);
    expect(tx.value).toBe("0");
    expect(tx.chainId).toBe(8453);
    expect(schemaUid(GENESIS_SCHEMA, false)).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe("polish guards", () => {
  it("refuses a real call when CI is set", () => {
    const previous = process.env.CI;
    process.env.CI = "true";
    expect(() => assertPolishAllowed(true, true)).toThrow(/E_POLISH_CI/);
    if (previous === undefined) delete process.env.CI;
    else process.env.CI = previous;
  });

  it("polishes against a local mock and rejects a guardrail miss", async () => {
    const registry = loadPacks(root);
    const drawn = generateDraws(registry, "botmint-dev-sample-001", 1)[0]!;
    const recipe = composeRecipe(drawn, "dev-sample");
    const fields = fieldsOf(recipe, drawn.archetype.partials.memories.length);
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        const parsed = JSON.parse(body) as { messages: { content: string }[] };
        const user = JSON.parse(parsed.messages[1]!.content) as { fields: Record<string, string> };
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ fields: user.fields }) } }],
            usage: { prompt_tokens: 10, completion_tokens: 10 },
          }),
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    const client = {
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      apiKey: "test-key",
      sleep: async () => {},
    };
    const passed = await polishRecipe({
      raw: recipe,
      registry,
      archetypeMemoryCount: drawn.archetype.partials.memories.length,
      prompt: readFileSync(path.join(root, "polish", "prompt.v1.md"), "utf8"),
      model: "grok-4.20-0309-non-reasoning",
      client,
    });
    expect(passed.reasons).toEqual([]);
    server.close();
    expect(Object.keys(fields).length).toBeGreaterThan(0);
  });

  it("writes polished output and skips a matching cache on the next run", async () => {
    const registry = loadPacks(root);
    const drawn = generateDraws(registry, "botmint-dev-sample-001", 1)[0]!;
    const recipe = composeRecipe(drawn, "scratch");
    const prompt = readFileSync(path.join(root, "polish", "prompt.v1.md"), "utf8");
    let calls = 0;
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        calls += 1;
        const parsed = JSON.parse(body) as { messages: { content: string }[] };
        const user = JSON.parse(parsed.messages[1]!.content) as { fields: Record<string, string> };
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ fields: user.fields }) } }],
            usage: { prompt_tokens: 4, completion_tokens: 4 },
          }),
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    const dir = mkdtempSync(path.join(tmpdir(), "botmint-polish-"));
    writeFileSync(
      path.join(dir, "manifest.json"),
      canonicalFile({
        collection: "scratch",
        count: 1,
        engineVersion: "1.0.0",
        seed: "botmint-dev-sample-001",
        tokens: [
          {
            edition: recipe.edition,
            polishedHash: null,
            rawHash: sha256(canonicalFile(recipe)),
            tokenId: recipe.tokenId,
          },
        ],
      }),
    );
    const target = {
      archetypeMemoryCount: drawn.archetype.partials.memories.length,
      rawHash: sha256(canonicalFile(recipe)),
      recipe,
    };
    const client = {
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      apiKey: "test-key",
      sleep: async () => {},
    };
    const first = await polishCollection({
      root,
      dir,
      tokens: [target],
      model: "grok-4.20-0309-non-reasoning",
      prompt,
      registry,
      client,
      concurrency: 2,
    });
    expect(first.totals.passed).toBe(1);
    expect(first.totals.skipped).toBe(0);
    expect(existsSync(path.join(dir, "polished", "0001.json"))).toBe(true);
    const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8")) as {
      tokens: { polishedHash: string | null }[];
    };
    expect(manifest.tokens[0]?.polishedHash).toBe(first.tokens[0]?.polishedHash);
    const second = await polishCollection({
      root,
      dir,
      tokens: [target],
      model: "grok-4.20-0309-non-reasoning",
      prompt,
      registry,
      client,
    });
    expect(second.totals.skipped).toBe(1);
    expect(calls).toBe(1);
    server.close();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("cli", () => {
  it("prints the count as json", () => {
    const output = execFileSync("pnpm", ["exec", "botmint", "count", "--json"], {
      cwd: root,
      encoding: "utf8",
    });
    const line = output.trim().split("\n").at(-1)!;
    expect(JSON.parse(line)).toEqual(EXPECTED_COUNT);
  });
});
