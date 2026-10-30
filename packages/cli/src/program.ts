import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  asBytes20,
  asBytes32,
  attestTx,
  CHAINS,
  type ChainName,
  castCommand,
  decodeGenesisData,
  EAS_ADDRESS,
  GENESIS_SCHEMA,
  genesisData,
  getAttestationAbi,
  registerTx,
  schemaUid,
} from "@botmint/chain";
import {
  assertOutsideWorktree,
  assignClaims,
  attestationBatch,
  latestRefunds,
  loadState,
  mintNonce,
  type PrivateRecord,
  parseNote,
  type RefundLine,
  type Reply,
  readJsonl,
  revokeClaim,
  serialiseJsonl,
  stateFile,
  verifyClaims,
} from "@botmint/claims";
import {
  canonicalCompact,
  canonicalFile,
  countSpace,
  ENGINE_VERSION,
  hashChain,
  loadPacks,
  packHash,
  recipeSchema,
  repliesSchema,
  sha256,
  tokenIdOf,
  tokenStem,
} from "@botmint/core";
import {
  buildCollectionInMemory,
  bundleFiles,
  writeCollection,
  zipBundle,
} from "@botmint/exporters";
import {
  errorsOf,
  type LintIssue,
  lintIntegrationText,
  lintPackRoot,
  lintRecipe,
} from "@botmint/lint";
import {
  assertPolishAllowed,
  DEFAULT_MODEL,
  fieldsOf,
  guardrailReasons,
  modelAllowed,
  polishCollection,
  priceDryRun,
  readApiKey,
} from "@botmint/polish";
import { Command } from "commander";
import { createPublicClient, type Hex, http } from "viem";

export class BotmintError extends Error {
  code: number;
  constructor(message: string, code = 1) {
    super(message);
    this.code = code;
  }
}

type Flags = { cwd?: string; json?: boolean; quiet?: boolean };

function flags(command: Command): Flags {
  return command.optsWithGlobals() as Flags;
}

export function findRoot(start: string): string {
  let dir = path.resolve(start);
  while (true) {
    if (
      existsSync(path.join(dir, "pnpm-workspace.yaml")) ||
      existsSync(path.join(dir, "botmint.config.json"))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new BotmintError("could not find the botmint repo", 2);
    dir = parent;
  }
}

function rootOf(command: Command): string {
  return findRoot(flags(command).cwd ?? process.cwd());
}

function say(command: Command, data: unknown, text: string): void {
  const opts = flags(command);
  if (opts.json) console.log(JSON.stringify(data));
  else if (!opts.quiet) console.log(text);
}

function editionOf(input: string): number {
  const edition = Number(input.replace("#", ""));
  if (!Number.isInteger(edition) || edition < 1) throw new BotmintError(`bad token id ${input}`, 2);
  return edition;
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function configOf(root: string): {
  payee: string;
  attester: string | null;
  galleryUrl: string | null;
  repo: string;
} {
  return readJson(path.join(root, "botmint.config.json"));
}

function collectionDir(root: string, name: string): string {
  return path.join(root, "collections", name);
}

function underGenesis(root: string, target: string): boolean {
  const genesis = path.resolve(root, "collections", "genesis");
  const resolved = path.resolve(target);
  return resolved === genesis || resolved.startsWith(`${genesis}${path.sep}`);
}

export function createProgram(): Command {
  const program = new Command();
  program
    .name("botmint")
    .description(
      "Generative Grok Bot templates. Unofficial community project, not affiliated with xAI or X.",
    )
    .option("--cwd <dir>", "repo root")
    .option("--json", "machine-readable output")
    .option("--quiet", "suppress human output")
    .exitOverride();

  program
    .command("generate")
    .requiredOption("--count <n>", "how many editions", (value) => Number(value))
    .requiredOption("--seed <seed>", "collection seed")
    .option("--packs <list>", "comma-separated packs", "core,markets,creator")
    .option("--out <dir>", "scratch directory")
    .action((opts, command: Command) => {
      const root = rootOf(command);
      const out = path.resolve(root, opts.out ?? path.join("out", "scratch"));
      if (underGenesis(root, out))
        throw new BotmintError("refusing to write under collections/genesis", 3);
      const built = buildCollectionInMemory({
        root,
        collection: "scratch",
        seed: opts.seed,
        count: opts.count,
        packs: String(opts.packs).split(","),
      });
      mkdirSync(out, { recursive: true });
      for (const token of built.tokens) {
        writeFileSync(
          path.join(out, `${tokenStem(token.recipe.edition)}.json`),
          canonicalFile(token.recipe),
        );
      }
      writeFileSync(path.join(out, "manifest.json"), canonicalFile(built.manifest));
      say(command, { count: built.count, out }, `wrote ${built.count} recipes to ${out}`);
    });

  const drop = program.command("drop").description("collection build, stats, freeze and verify");
  drop
    .command("build")
    .argument("<collection>")
    .requiredOption("--seed <seed>")
    .requiredOption("--count <n>", "", (value) => Number(value))
    .option("--packs <list>", "", "core,markets,creator")
    .action((collection: string, opts, command: Command) => {
      if (collection === "genesis" && opts.count !== 10000) {
        throw new BotmintError("genesis requires --count 10000", 2);
      }
      const root = rootOf(command);
      const built = buildCollectionInMemory({
        root,
        collection,
        seed: opts.seed,
        count: opts.count,
        packs: String(opts.packs).split(","),
      });
      writeCollection(root, built, { bundles: true });
      say(
        command,
        { collection, count: built.count, rawProvenance: built.rawProvenance },
        `built ${collection} ${built.count}\nraw provenance sha256:${built.rawProvenance}`,
      );
    });

  drop
    .command("stats")
    .argument("<collection>")
    .action((collection: string, _opts, command: Command) => {
      const file = path.join(collectionDir(rootOf(command), collection), "rarity.json");
      if (!existsSync(file)) throw new BotmintError(`missing ${file}`, 1);
      const report = readJson<Record<string, unknown>>(file);
      say(command, report, JSON.stringify(report.tiers ?? report, null, 2));
    });

  drop
    .command("freeze")
    .argument("<collection>")
    .action((collection: string, _opts, command: Command) => {
      const root = rootOf(command);
      const dir = collectionDir(root, collection);
      const manifest = readJson<{
        tokens: {
          polishedHash: string | null;
          rawHash: string;
          tokenId: string;
          edition: number;
        }[];
        seed: string;
        count: number;
      }>(path.join(dir, "manifest.json"));
      if (manifest.tokens.some((token) => !token.polishedHash)) {
        throw new BotmintError("freeze requires every polishedHash", 1);
      }
      const reportPath = path.join(dir, "polish-report.json");
      if (!existsSync(reportPath)) throw new BotmintError("missing polish-report.json", 1);
      const report = readJson<{
        totals: { passed: number; failed: number };
        model?: string;
        finishedAt?: string;
      }>(reportPath);
      if (report.totals.failed !== 0 || report.totals.passed !== manifest.count) {
        throw new BotmintError("polish report is not all passed", 1);
      }
      const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
      if (dirty.trim()) throw new BotmintError("working tree is dirty", 1);
      const commit = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim();
      const promptFile = "polish/prompt.v1.md";
      const allowlistFile = "polish/allowlist.json";
      const tokens = [...manifest.tokens].sort((a, b) => a.edition - b.edition);
      const packNames = readdirSync(path.join(root, "packs")).filter((name) =>
        existsSync(path.join(root, "packs", name, "pack.yaml")),
      );
      const lock = {
        collection,
        count: manifest.count,
        engine: { commit, version: ENGINE_VERSION },
        frozenAt: new Date().toISOString(),
        packs: Object.fromEntries(
          packNames
            .sort()
            .map((name) => [name, `sha256:${packHash(path.join(root, "packs", name))}`]),
        ),
        perToken: `manifest.json lists rawHash + polishedHash for ${tokenIdOf(1)}-${tokenIdOf(manifest.count)}`,
        polish: {
          allowlistHash: `sha256:${sha256(readFileSync(path.join(root, allowlistFile)))}`,
          completedAt: report.finishedAt ?? new Date().toISOString(),
          model: report.model ?? "grok-4.20-0309-non-reasoning",
          promptFile,
          promptHash: `sha256:${sha256(readFileSync(path.join(root, promptFile)))}`,
          provider: "xAI API",
          temperature: 0 as const,
        },
        provenance: `sha256:${hashChain(tokens.map((token) => token.polishedHash!))}`,
        rawProvenance: `sha256:${hashChain(tokens.map((token) => token.rawHash))}`,
        seed: manifest.seed,
        tokenHashAlgo: "sha256(canonical polished recipe.json bytes)",
        tokenIds: `${tokenIdOf(1)}-${tokenIdOf(manifest.count)}`,
      };
      writeFileSync(path.join(dir, `${collection}.lock.json`), canonicalFile(lock));
      say(command, lock, `wrote ${collection}.lock.json`);
    });

  drop
    .command("verify")
    .argument("<collection>")
    .action((collection: string, _opts, command: Command) => {
      const result = verifyOffline(rootOf(command), collection);
      if (!result.ok) {
        console.error(result.mismatches.slice(0, 20).join("\n"));
        throw new BotmintError(`${result.mismatches.length} mismatches`, 1);
      }
      say(command, result, `${collection} verified (${result.checked} tokens)`);
    });

  program
    .command("render")
    .argument("<collection>")
    .argument("<id>")
    .option("--out <dir>")
    .action((collection: string, id: string, opts, command: Command) => {
      const root = rootOf(command);
      const manifest = readJson<{ seed: string }>(
        path.join(collectionDir(root, collection), "manifest.json"),
      );
      const edition = editionOf(id);
      const built = buildCollectionInMemory({
        root,
        collection,
        seed: manifest.seed,
        count: edition,
      });
      const token = built.tokens[edition - 1]!;
      if (opts.out) {
        const dir = path.resolve(opts.out);
        mkdirSync(dir, { recursive: true });
        for (const file of bundleFiles(token.recipe, token.drawn, token.rarity, token.rawHash)) {
          const target = path.join(dir, file.path);
          mkdirSync(path.dirname(target), { recursive: true });
          writeFileSync(target, file.contents);
        }
      }
      say(command, token.recipe, canonicalFile(token.recipe).trimEnd());
    });

  program
    .command("export")
    .argument("<collection>")
    .argument("<id>")
    .requiredOption("--format <kind>", "recipe|install|card|attributes|zip")
    .option("--out <file>")
    .action((collection: string, id: string, opts, command: Command) => {
      const root = rootOf(command);
      const edition = editionOf(id);
      const stem = tokenStem(edition);
      const rawPath = path.join(collectionDir(root, collection), "raw", `${stem}.json`);
      const polishedPath = path.join(collectionDir(root, collection), "polished", `${stem}.json`);
      const recipe = recipeSchema.parse(
        readJson(existsSync(polishedPath) ? polishedPath : rawPath),
      );
      const manifest = readJson<{
        seed: string;
        tokens: {
          edition: number;
          rawHash: string;
          rarity: { score: number; rank: number; tier: string };
        }[];
      }>(path.join(collectionDir(root, collection), "manifest.json"));
      const meta = manifest.tokens.find((token) => token.edition === edition);
      if (!meta) throw new BotmintError("token missing from manifest", 1);
      const built = buildCollectionInMemory({
        root,
        collection,
        seed: manifest.seed,
        count: edition,
      });
      const drawn = built.tokens[edition - 1]!.drawn;
      const hash = meta.rawHash;
      const files = bundleFiles(recipe, drawn, meta.rarity, hash);
      const pick =
        opts.format === "recipe"
          ? canonicalFile(recipe)
          : opts.format === "install"
            ? files.find((file) => file.path === "INSTALL.md")!.contents
            : opts.format === "card"
              ? files.find((file) => file.path === "README.md")!.contents
              : opts.format === "attributes"
                ? canonicalFile(recipe.attributes)
                : opts.format === "zip"
                  ? ""
                  : null;
      if (pick === null) throw new BotmintError("unknown format", 2);
      if (opts.format === "zip") {
        const bytes = zipBundle(files);
        const target = opts.out ?? `${stem}.zip`;
        writeFileSync(target, bytes);
        say(command, { file: target, bytes: bytes.length }, `wrote ${target}`);
        return;
      }
      if (opts.out) writeFileSync(opts.out, pick);
      else process.stdout.write(pick);
    });

  program
    .command("provenance")
    .argument("<collection>")
    .action((collection: string, _opts, command: Command) => {
      const text = readFileSync(
        path.join(collectionDir(rootOf(command), collection), "provenance.txt"),
        "utf8",
      );
      say(command, { provenance: text.split("\n")[0] }, text.trimEnd());
    });

  program
    .command("validate")
    .argument("[target]")
    .option("--profile <name>", "integration")
    .action((target: string | undefined, opts, command: Command) => {
      const root = rootOf(command);
      const issues =
        opts.profile === "integration"
          ? lintIntegrations(root)
          : target
            ? lintTarget(root, path.resolve(root, target))
            : [...lintPackRoot(root), ...lintCollection(root, "dev-sample")];
      const errors = errorsOf(issues);
      say(
        command,
        { errors: errors.length, issues },
        errors.length ? errors.map((issue) => `${issue.rule}: ${issue.message}`).join("\n") : "ok",
      );
      if (errors.length) throw new BotmintError(`${errors.length} lint errors`, 1);
    });

  program
    .command("count")
    .option("--packs <list>", "", "core,markets,creator")
    .action((opts, command: Command) => {
      const report = countSpace(loadPacks(rootOf(command), String(opts.packs).split(",")));
      say(
        command,
        report,
        `rawCore ${report.rawCore}\nvalidCore ${report.validCore}\nindependent ${report.independent}\nraw ${report.raw}\nvalid ${report.valid}\ndnaSpace ${report.dnaSpace}`,
      );
    });

  program
    .command("pack")
    .command("new")
    .argument("<name>")
    .action((name: string, _opts, command: Command) => {
      if (["core", "markets", "creator"].includes(name))
        throw new BotmintError(`refusing to scaffold ${name}`, 2);
      const dir = path.join(rootOf(command), "packs", name);
      if (existsSync(dir)) throw new BotmintError(`${name} already exists`, 1);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        path.join(dir, "pack.yaml"),
        `id: ${name}\nversion: 0.1.0\ntitle: ${name}\nlicense: MIT\nlayers: []\n`,
      );
      const golden = path.join(rootOf(command), "tests", "golden", name);
      mkdirSync(golden, { recursive: true });
      writeFileSync(
        path.join(golden, "README.md"),
        `# Golden stub for ${name}\n\nAdd at least one edition before merging this pack.\n`,
      );
      say(command, { pack: name }, `scaffolded packs/${name}`);
    });

  const polish = program
    .command("polish")
    .description("polish a collection, or check committed polish");
  polish
    .command("check")
    .argument("<collection>")
    .action((collection: string, _opts, command: Command) => {
      const messages = polishCheck(rootOf(command), collection);
      if (messages.length) throw new BotmintError(messages.slice(0, 20).join("\n"), 1);
      say(command, { ok: true }, `${collection} polish check ok`);
    });
  polish
    .argument("<collection>")
    .option("--model <id>", "", DEFAULT_MODEL)
    .option("--concurrency <n>", "", (value) => Number(value), 8)
    .option("--limit <n>", "", (value) => Number(value))
    .option("--only-failed")
    .option("--dry-run")
    .option("--allow-undated")
    .option("--i-understand-this-costs-money")
    .action(async (collection: string, opts, command: Command) => {
      assertPolishAllowed(Boolean(opts.dryRun), Boolean(opts.iUnderstandThisCostsMoney));
      if (!modelAllowed(opts.model, Boolean(opts.allowUndated))) {
        throw new BotmintError(`refusing undated model ${opts.model}`, 3);
      }
      const root = rootOf(command);
      const prompt = readFileSync(path.join(root, "polish", "prompt.v1.md"), "utf8");
      const built = rebuild(root, collection);
      const sample = built.tokens[0];
      if (!sample) throw new BotmintError("empty collection", 1);
      const user = JSON.stringify(
        fieldsOf(sample.recipe, sample.drawn.archetype.partials.memories.length),
      );
      if (opts.dryRun) {
        const estimate = priceDryRun({
          root,
          model: opts.model,
          prompt,
          userJson: user,
          outputText: user,
        });
        const total = {
          ...estimate,
          bots: opts.limit ?? built.count,
          usd: estimate.usd * (opts.limit ?? built.count),
        };
        say(
          command,
          total,
          `dry run ${total.bots} bots ≈ $${total.usd.toFixed(2)} on ${opts.model}`,
        );
        return;
      }
      const apiKey = readApiKey();
      const baseUrl = process.env.XAI_BASE_URL ?? "https://api.x.ai/v1";
      const report = await polishCollection({
        root,
        dir: collectionDir(root, collection),
        tokens: built.tokens.map((token) => ({
          archetypeMemoryCount: token.drawn.archetype.partials.memories.length,
          rawHash: token.rawHash,
          recipe: token.recipe,
        })),
        model: opts.model,
        prompt,
        registry: loadPacks(root),
        client: { baseUrl, apiKey },
        concurrency: opts.concurrency,
        limit: opts.limit,
        onlyFailed: Boolean(opts.onlyFailed),
      });
      say(
        command,
        report.totals,
        `polished ${report.totals.passed} passed, ${report.totals.failed} failed, ${report.totals.skipped} skipped`,
      );
      if (report.totals.failed) {
        throw new BotmintError(`${report.totals.failed} tokens failed guardrails`, 1);
      }
    });

  program
    .command("anchor")
    .argument("<collection>")
    .option("--chain <name>", "base or base-sepolia", "base")
    .option("--register-schema")
    .option("--record")
    .option("--tx <hash>")
    .option("--uid <uid>")
    .option("--attester <addr>")
    .action((collection: string, opts, command: Command) => {
      const chain = opts.chain as ChainName;
      if (!(chain in CHAINS)) throw new BotmintError("chain must be base or base-sepolia", 2);
      const root = rootOf(command);
      if (opts.record) {
        if (!opts.tx || !opts.uid || !opts.attester)
          throw new BotmintError("--record needs --tx, --uid and --attester", 2);
        const anchor = {
          attestationUid: opts.uid,
          attester: opts.attester,
          chain,
          chainId: CHAINS[chain].chainId,
          eas: EAS_ADDRESS,
          schemaUid: schemaUid(GENESIS_SCHEMA, false),
          txHash: opts.tx,
        };
        writeFileSync(
          path.join(collectionDir(root, collection), `${collection}.anchor.json`),
          canonicalFile(anchor),
        );
        say(command, anchor, `recorded ${collection}.anchor.json`);
        return;
      }
      const uid = schemaUid(GENESIS_SCHEMA, false);
      if (opts.registerSchema) {
        const tx = registerTx(chain, GENESIS_SCHEMA, false);
        say(
          command,
          { schemaUid: uid, tx, cast: castCommand(tx, chain) },
          `${JSON.stringify(tx, null, 2)}\n${castCommand(tx, chain)}\nschema ${uid}`,
        );
        return;
      }
      const lockPath = path.join(collectionDir(root, collection), `${collection}.lock.json`);
      if (!existsSync(lockPath)) throw new BotmintError("no lock file; genesis is not frozen", 1);
      const lock = readJson<{
        collection: string;
        count: number;
        seed: string;
        provenance: string;
        engine: { version: string; commit: string };
      }>(lockPath);
      const tx = attestTx(
        chain,
        uid,
        genesisData({
          collection: lock.collection,
          count: lock.count,
          provenanceHash: asBytes32(lock.provenance),
          seed: lock.seed,
          gitCommit: asBytes20(lock.engine.commit),
          engineVersion: lock.engine.version,
          lockFileHash: asBytes32(sha256(readFileSync(lockPath))),
        }),
        false,
      );
      say(
        command,
        { schemaUid: uid, tx, cast: castCommand(tx, chain) },
        `${JSON.stringify(tx, null, 2)}\n${castCommand(tx, chain)}`,
      );
    });

  program
    .command("verify")
    .option("--collection <name>", "", "genesis")
    .option("--onchain")
    .option("--rpc <url>")
    .action(async (opts, command: Command) => {
      const root = rootOf(command);
      const collection = opts.collection as string;
      if (existsSync(path.join(collectionDir(root, collection), "manifest.json"))) {
        const result = verifyOffline(root, collection);
        if (!result.ok) throw new BotmintError(result.mismatches.slice(0, 20).join("\n"), 1);
      } else if (collection === "genesis") {
        say(
          command,
          { frozen: false },
          "Genesis is not frozen yet. Offline verify will run after genesis.lock.json exists.",
        );
      } else throw new BotmintError(`missing collection ${collection}`, 1);
      if (opts.onchain) {
        const anchorPath = path.join(collectionDir(root, collection), `${collection}.anchor.json`);
        if (!existsSync(anchorPath)) throw new BotmintError("not anchored yet", 1);
        const anchor = readJson<{ attestationUid: Hex; chain: ChainName; attester: Hex }>(
          anchorPath,
        );
        const rpc = opts.rpc ?? CHAINS[anchor.chain].rpc;
        const client = createPublicClient({ transport: http(rpc) });
        await readAttestation(root, collection, client, anchor.attestationUid, anchor.attester);
      }
      say(command, { ok: true, collection }, `${collection} verify ok`);
    });

  program
    .command("mint")
    .command("nonce")
    .argument("<collection>")
    .argument("[choice]", "random")
    .option("--visibility <mode>", "public or private", "private")
    .action((collection: string, choice: string | undefined, opts, command: Command) => {
      const root = rootOf(command);
      const config = configOf(root);
      const state = loadState(
        path.join(collectionDir(root, collection), "claims", "claims.state.json"),
      );
      const parsed = parseNote(
        `botmint genesis ${choice ?? "random"} bm-7KQ2-9XPA ${opts.visibility}`,
      );
      if (!parsed) throw new BotmintError("choice must be random or up to three #ids", 2);
      const nonce = mintNonce();
      const note = `botmint genesis ${choice ?? "random"} ${nonce} ${opts.visibility}`;
      const payload = { amount: state.priceUsd, payee: config.payee, note, open: state.open };
      say(command, payload, `$${state.priceUsd}\npayee ${config.payee}\nnote ${note}`);
    });

  const claims = program.command("claims");
  claims
    .command("assign")
    .argument("<collection>")
    .requiredOption("--tx <file>")
    .option("--replies <file>")
    .option("--private <path>")
    .action((collection: string, opts, command: Command) => {
      const root = rootOf(command);
      const dir = path.join(collectionDir(root, collection), "claims");
      const state = loadState(path.join(dir, "claims.state.json"));
      const jsonlPath = path.join(dir, "claims.jsonl");
      const lines = existsSync(jsonlPath) ? readJsonl(jsonlPath) : [];
      const exportFile = readJson<Parameters<typeof assignClaims>[0]["exportFile"]>(
        path.resolve(opts.tx),
      );
      const replies = opts.replies
        ? (repliesSchema.parse(readJson(path.resolve(opts.replies))) as Reply[])
        : undefined;
      let privateRecords: PrivateRecord[] = [];
      if (opts.private) {
        assertOutsideWorktree(path.resolve(opts.private));
        if (existsSync(opts.private)) {
          privateRecords = readFileSync(opts.private, "utf8")
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line) as PrivateRecord);
        }
      }
      const result = assignClaims({ state, lines, exportFile, replies, privateRecords });
      mkdirSync(dir, { recursive: true });
      writeFileSync(jsonlPath, serialiseJsonl(result.lines));
      writeFileSync(path.join(dir, "claims.state.json"), stateFile(result.state));
      if (opts.private) {
        mkdirSync(path.dirname(path.resolve(opts.private)), { recursive: true });
        writeFileSync(
          opts.private,
          `${result.privateRecords.map((record) => canonicalCompact(record)).join("\n")}\n`,
        );
      }
      say(
        command,
        result.summary,
        `claims ${result.summary.claims}, refunds ${result.summary.refunds}, holds ${result.summary.holds}`,
      );
    });

  claims
    .command("verify")
    .argument("<collection>")
    .action((collection: string, _opts, command: Command) => {
      const dir = path.join(collectionDir(rootOf(command), collection), "claims");
      const state = loadState(path.join(dir, "claims.state.json"));
      const jsonlPath = path.join(dir, "claims.jsonl");
      if (!existsSync(jsonlPath)) {
        say(command, { ok: true, lines: 0 }, "no claims.jsonl");
        return;
      }
      const raw = readFileSync(jsonlPath, "utf8");
      const errors = verifyClaims(readJsonl(jsonlPath), state, raw);
      if (errors.length) throw new BotmintError(errors.join("\n"), 1);
      say(command, { ok: true }, "claims ok");
    });

  claims
    .command("refunds")
    .argument("<collection>")
    .option("--record <refundId>")
    .option("--outcome <status>")
    .action((collection: string, opts, command: Command) => {
      const dir = path.join(collectionDir(rootOf(command), collection), "claims");
      const jsonlPath = path.join(dir, "claims.jsonl");
      const lines = existsSync(jsonlPath) ? readJsonl(jsonlPath) : [];
      if (opts.record) {
        const allowed = ["completed", "pending", "refused", "unconfirmed"];
        if (!allowed.includes(opts.outcome)) throw new BotmintError("bad outcome", 2);
        const current = latestRefunds(lines).get(opts.record);
        if (!current) throw new BotmintError("unknown refund", 1);
        const state = loadState(path.join(dir, "claims.state.json"));
        const next: RefundLine = {
          ...current,
          seq: state.lastSeq + 1,
          status: opts.outcome,
          at: state.lastExportAt ?? new Date(0).toISOString(),
        };
        lines.push(next);
        state.lastSeq += 1;
        writeFileSync(jsonlPath, serialiseJsonl(lines));
        writeFileSync(
          path.join(dir, "claims.state.json"),
          stateFile({ ...state, claimsRoot: `sha256:${sha256(serialiseJsonl(lines))}` }),
        );
        say(command, next, `recorded ${opts.record} ${opts.outcome}`);
        return;
      }
      const queued = [...latestRefunds(lines).values()].filter(
        (refund) => refund.status === "queued",
      );
      const text = queued
        .map(
          (refund) =>
            `${refund.refundId} $${refund.amountUsd} ${refund.reason}\nApprove: send ${refund.amountUsd} with note "botmint refund ${refund.reason} ${refund.refundId}" and idempotency key ${refund.refundId}`,
        )
        .join("\n");
      say(command, queued, text || "no queued refunds");
    });

  claims
    .command("attest")
    .argument("<collection>")
    .option("--batch")
    .option("--revoke <paymentRef>")
    .option("--record")
    .option("--tx <hash>")
    .option("--uids <file>")
    .option("--chain <name>", "", "base")
    .action((collection: string, opts, command: Command) => {
      const root = rootOf(command);
      const chain = opts.chain as ChainName;
      const dir = path.join(collectionDir(root, collection), "claims");
      const lines = existsSync(path.join(dir, "claims.jsonl"))
        ? readJsonl(path.join(dir, "claims.jsonl"))
        : [];
      if (opts.revoke) {
        const tx = revokeClaim(lines, chain, opts.revoke);
        say(
          command,
          { tx, cast: castCommand(tx, chain) },
          `${JSON.stringify(tx, null, 2)}\n${castCommand(tx, chain)}`,
        );
        return;
      }
      if (opts.batch) {
        const tx = attestationBatch(lines, chain, collection);
        say(
          command,
          { tx, cast: castCommand(tx, chain) },
          `${JSON.stringify(tx, null, 2)}\n${castCommand(tx, chain)}`,
        );
        return;
      }
      if (opts.record) {
        if (!opts.tx || !opts.uids) throw new BotmintError("--record needs --tx and --uids", 2);
        const uids = readJson<{ paymentRef: string; tokenId: string; uid: string }[]>(
          path.resolve(opts.uids),
        );
        const state = loadState(path.join(dir, "claims.state.json"));
        for (const item of uids) {
          state.lastSeq += 1;
          lines.push({
            kind: "eas",
            seq: state.lastSeq,
            at: state.lastExportAt ?? new Date(0).toISOString(),
            paymentRef: item.paymentRef,
            tokenId: item.tokenId,
            attestationUid: item.uid,
            txHash: opts.tx,
            action: "attest",
          });
        }
        writeFileSync(path.join(dir, "claims.jsonl"), serialiseJsonl(lines));
        writeFileSync(
          path.join(dir, "claims.state.json"),
          stateFile({ ...state, claimsRoot: `sha256:${sha256(serialiseJsonl(lines))}` }),
        );
        say(command, { recorded: uids.length }, `recorded ${uids.length} attestations`);
        return;
      }
      throw new BotmintError("pass --batch, --revoke or --record", 2);
    });

  for (const mode of ["open", "close"] as const) {
    claims
      .command(mode)
      .argument("<collection>")
      .action((collection: string, _opts, command: Command) => {
        const file = path.join(
          collectionDir(rootOf(command), collection),
          "claims",
          "claims.state.json",
        );
        const state = loadState(file);
        state.open = mode === "open";
        writeFileSync(file, stateFile(state));
        const reminder =
          mode === "open"
            ? "Claims are open. Start the Mint Desk routine."
            : "Claims are closed. Pause the Mint Desk routine.";
        say(command, state, reminder);
      });
  }

  return program;
}

function rebuild(root: string, collection: string) {
  const manifest = readJson<{ seed: string; count: number }>(
    path.join(collectionDir(root, collection), "manifest.json"),
  );
  return buildCollectionInMemory({ root, collection, seed: manifest.seed, count: manifest.count });
}

export function verifyOffline(
  root: string,
  collection: string,
): { ok: boolean; checked: number; mismatches: string[] } {
  const dir = collectionDir(root, collection);
  const manifestPath = path.join(dir, "manifest.json");
  if (!existsSync(manifestPath)) return { ok: false, checked: 0, mismatches: ["missing manifest"] };
  const manifest = readJson<{
    seed: string;
    count: number;
    tokens: { edition: number; rawHash: string; polishedHash: string | null }[];
  }>(manifestPath);
  const built = buildCollectionInMemory({
    root,
    collection,
    seed: manifest.seed,
    count: manifest.count,
  });
  const mismatches: string[] = [];
  if (canonicalFile(built.manifest) !== readFileSync(manifestPath, "utf8"))
    mismatches.push("manifest.json");
  if (readFileSync(path.join(dir, "rarity.json"), "utf8") !== canonicalFile(built.report))
    mismatches.push("rarity.json");
  if (readFileSync(path.join(dir, "provenance.txt"), "utf8") !== built.provenanceText)
    mismatches.push("provenance.txt");
  for (const token of built.tokens) {
    const file = path.join(dir, "raw", `${tokenStem(token.recipe.edition)}.json`);
    if (!existsSync(file) || readFileSync(file, "utf8") !== canonicalFile(token.recipe)) {
      mismatches.push(`raw ${token.recipe.tokenId}`);
    }
    const recorded = manifest.tokens.find((item) => item.edition === token.recipe.edition);
    if (recorded?.rawHash !== token.rawHash) mismatches.push(`rawHash ${token.recipe.tokenId}`);
  }
  const lockPath = path.join(dir, `${collection}.lock.json`);
  if (existsSync(lockPath)) {
    const lock = readJson<{
      packs: Record<string, string>;
      rawProvenance: string;
      provenance: string;
    }>(lockPath);
    for (const [name, hash] of Object.entries(lock.packs)) {
      const actual = `sha256:${packHash(path.join(root, "packs", name))}`;
      if (actual !== hash) mismatches.push(`pack ${name}`);
    }
    if (`sha256:${built.rawProvenance}` !== lock.rawProvenance) mismatches.push("rawProvenance");
    mismatches.push(...polishCheck(root, collection));
  }
  return { ok: mismatches.length === 0, checked: built.count, mismatches };
}

function polishCheck(root: string, collection: string): string[] {
  const polishedDir = path.join(collectionDir(root, collection), "polished");
  if (!existsSync(polishedDir)) return [];
  const registry = loadPacks(root);
  const built = rebuild(root, collection);
  const messages: string[] = [];
  for (const token of built.tokens) {
    const file = path.join(polishedDir, `${tokenStem(token.recipe.edition)}.json`);
    if (!existsSync(file)) continue;
    const polished = recipeSchema.parse(readJson(file));
    const reasons = guardrailReasons({
      raw: token.recipe,
      polished,
      fields: fieldsOf(token.recipe, token.drawn.archetype.partials.memories.length),
      responseKeys: Object.keys(fieldsOf(polished, token.drawn.archetype.partials.memories.length)),
      registry,
      archetypeMemoryCount: token.drawn.archetype.partials.memories.length,
    });
    if (reasons.length) messages.push(`${token.recipe.tokenId}: ${reasons.join("; ")}`);
  }
  return messages;
}

function lintCollection(root: string, collection: string) {
  const dir = path.join(collectionDir(root, collection), "raw");
  if (!existsSync(dir)) return [];
  const registry = loadPacks(root);
  const issues: LintIssue[] = [];
  for (const file of readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()) {
    const recipe = recipeSchema.parse(readJson(path.join(dir, file)));
    issues.push(...lintRecipe(recipe, registry));
  }
  return issues;
}

function lintTarget(root: string, target: string) {
  if (statSync(target).isDirectory() && existsSync(path.join(target, "pack.yaml"))) {
    const name = path.basename(target);
    void name;
    return lintPackRoot(root);
  }
  if (statSync(target).isDirectory() && existsSync(path.join(target, "manifest.json"))) {
    return lintCollection(root, path.basename(target));
  }
  if (target.endsWith(".json")) {
    const recipe = recipeSchema.parse(readJson(target));
    return lintRecipe(recipe, loadPacks(root));
  }
  throw new BotmintError(`cannot validate ${target}`, 2);
}

function lintIntegrations(root: string) {
  const dir = path.join(root, "integrations");
  const issues: LintIssue[] = [];
  const walk = (current: string) => {
    for (const name of readdirSync(current)) {
      const abs = path.join(current, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else if (name.endsWith(".md"))
        issues.push(...lintIntegrationText(name, readFileSync(abs, "utf8")));
    }
  };
  if (existsSync(dir)) walk(dir);
  return issues;
}

export async function readAttestation(
  root: string,
  collection: string,
  client: { readContract: (args: any) => Promise<any> },
  uid: Hex,
  attester: Hex,
): Promise<void> {
  const config = configOf(root);
  const result = (await client.readContract({
    address: EAS_ADDRESS,
    abi: getAttestationAbi,
    functionName: "getAttestation",
    args: [uid],
  })) as { schema: Hex; attester: Hex; revocable: boolean; data: Hex };
  const lock = readJson<{
    collection: string;
    count: number;
    seed: string;
    provenance: string;
    engine: { version: string; commit: string };
  }>(path.join(collectionDir(root, collection), `${collection}.lock.json`));
  const decoded = decodeGenesisData(result.data);
  if (result.schema !== schemaUid(GENESIS_SCHEMA, false))
    throw new BotmintError("schema uid mismatch", 1);
  if (result.revocable) throw new BotmintError("attestation is revocable", 1);
  if (config.attester && result.attester.toLowerCase() !== config.attester.toLowerCase()) {
    throw new BotmintError("attester mismatch", 1);
  }
  if (attester && result.attester.toLowerCase() !== attester.toLowerCase())
    throw new BotmintError("attester mismatch", 1);
  if (decoded.collection !== lock.collection || decoded.seed !== lock.seed)
    throw new BotmintError("decoded lock mismatch", 1);
  if (asBytes32(lock.provenance) !== decoded.provenanceHash)
    throw new BotmintError("provenance mismatch", 1);
}
