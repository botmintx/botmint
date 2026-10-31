import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { type Abi, type Address, type Hex, keccak256, toBytes } from "viem";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { forgeBuild, localClients, startAnvil } from "./chain.ts";
import { CLAIM_TYPES, claimDomain, claimMessage } from "./claim.ts";
import { deployGenesis, mintAfterPayment, transferToken } from "./flow.ts";
import { MockXMoneyAdapter } from "./payment.ts";

const root = path.resolve(import.meta.dirname, "../../..");
const dist = path.join(root, "packages/cli/dist/cli.js");
const ALICE = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const BOB = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

function run(args: string[], cwd: string) {
  try {
    const stdout = execFileSync(process.execPath, [dist, ...args], {
      cwd,
      encoding: "utf8",
      timeout: 30_000,
    });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    const failed = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: failed.status ?? 1,
      stdout: String(failed.stdout ?? ""),
      stderr: String(failed.stderr ?? ""),
    };
  }
}

describe("verify-claim on anvil", () => {
  let stop = async () => {};
  let stopServer = () => {};
  let rpc = "";
  let gallery = "";
  let contract: Address = ALICE;
  let work = "";
  const homeNonce = path.join(homedir(), ".botmint", "nonces.json");
  let homeBefore: number | null = null;

  beforeAll(async () => {
    homeBefore = existsSync(homeNonce) ? statSync(homeNonce).mtimeMs : null;
    execFileSync(process.execPath, [path.join(root, "packages/cli/scripts/bundle.mjs")], {
      cwd: root,
      stdio: "inherit",
    });
    forgeBuild(root);
    const anvil = await startAnvil();
    rpc = anvil.url;
    stop = anvil.stop;
    work = mkdtempSync(path.join(tmpdir(), "botmint-verify-"));
    const manifestServer = await startManifestServer({
      name: "Compass Mentor - Travel Content Producer",
      tokenId: "#0001",
    });
    gallery = manifestServer.url;
    stopServer = manifestServer.stop;

    const artifact = JSON.parse(
      readFileSync(path.join(root, "contracts/out/BotmintGenesis.sol/BotmintGenesis.json"), "utf8"),
    ) as { abi: Abi; bytecode: { object: Hex } };
    const alice = localClients(rpc, ALICE);
    contract = await deployGenesis({
      wallet: alice.wallet,
      publicClient: alice.publicClient,
      abi: artifact.abi,
      bytecode: artifact.bytecode.object,
      admin: ALICE,
    });
    const paid = await new MockXMoneyAdapter().checkout({ tokenId: 1, payer: ALICE });
    await mintAfterPayment({
      receipt: paid,
      wallet: alice.wallet,
      publicClient: alice.publicClient,
      abi: artifact.abi,
      contract,
      minter: ALICE,
      to: ALICE,
    });
  }, 180_000);

  afterAll(async () => {
    stopServer();
    await stop();
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it("accepts the owner, rejects the code after transfer, and does not touch the home nonce file", async () => {
    const outside = run(["loader", "pack"], work);
    expect(outside.status, outside.stderr).toBe(1);
    expect(outside.stderr).toContain("contract address is null");

    const artifact = JSON.parse(
      readFileSync(path.join(root, "contracts/out/BotmintGenesis.sol/BotmintGenesis.json"), "utf8"),
    ) as { abi: Abi };
    const alice = localClients(rpc, ALICE);
    const now = Math.floor(Date.now() / 1000);
    const code = await sign(alice, contract, ALICE, 1, now + 3600);
    const nonceFile = path.join(work, "nonces.json");
    const common = [
      "--rpc",
      rpc,
      "--contract",
      contract,
      "--gallery",
      gallery,
      "--nonce-file",
      nonceFile,
      "--network",
      "base-sepolia",
    ];
    const ok = run(["verify-claim", "--code", JSON.stringify(code), ...common], work);
    expect(ok.status, `${ok.stderr}\n${ok.stdout}`).toBe(0);
    expect(JSON.parse(ok.stdout)).toEqual({
      ok: true,
      reason: null,
      manifestUrl: `${gallery}/bots/0001/loader.json`,
    });
    const fetched = run(
      ["fetch-manifest", "1", "--gallery", gallery, "--network", "base-sepolia"],
      work,
    );
    expect(fetched.status, `${fetched.stderr}\n${fetched.stdout}`).toBe(0);
    expect(JSON.parse(fetched.stdout)).toMatchObject({
      name: "Compass Mentor - Travel Content Producer",
    });

    const replay = run(["verify-claim", "--code", JSON.stringify(code), ...common], work);
    expect(replay.status).toBe(1);
    expect(JSON.parse(replay.stdout)).toMatchObject({ ok: false, reason: "replayed" });

    const moved = await sign(alice, contract, ALICE, 1, now + 3600);
    await transferToken({
      wallet: alice.wallet,
      publicClient: alice.publicClient,
      abi: artifact.abi,
      contract,
      from: ALICE,
      to: BOB,
      tokenId: 1,
    });
    const rejected = run(["verify-claim", "--code", JSON.stringify(moved), ...common], work);
    expect(rejected.status, rejected.stdout).toBe(1);
    expect(JSON.parse(rejected.stdout)).toMatchObject({
      ok: false,
      reason: "owner",
      manifestUrl: `${gallery}/bots/0001/loader.json`,
    });
    const former = run(["check-owner", "1", ALICE, "--rpc", rpc, "--contract", contract], work);
    expect(former.status).toBe(1);
    expect(JSON.parse(former.stdout)).toMatchObject({ ok: false, holder: BOB });
    const current = run(["check-owner", "1", BOB, "--rpc", rpc, "--contract", contract], work);
    expect(current.status, current.stdout).toBe(0);
    expect(JSON.parse(current.stdout)).toMatchObject({ ok: true, holder: BOB });
    const homeAfter = existsSync(homeNonce) ? statSync(homeNonce).mtimeMs : null;
    expect(homeAfter).toBe(homeBefore);
  });
});

function startManifestServer(body: unknown): Promise<{ url: string; stop: () => void }> {
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
        import { createServer } from "node:http";
        const manifest = JSON.parse(process.env.BOTMINT_MANIFEST ?? "{}");
        const server = createServer((req, res) => {
          if (req.url === "/bots/0001/loader.json") {
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(manifest));
            return;
          }
          res.statusCode = 404;
          res.end("missing");
        });
        server.listen(0, "127.0.0.1", () => {
          const address = server.address();
          if (address && typeof address !== "string") console.log(String(address.port));
        });
      `,
    ],
    {
      env: { ...process.env, BOTMINT_MANIFEST: JSON.stringify(body) },
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  return new Promise((resolve, reject) => {
    let settled = false;
    let buf = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      buf += chunk.toString();
      const port = Number(buf.trim());
      if (!settled && Number.isInteger(port) && port > 0) {
        settled = true;
        resolve({
          url: `http://127.0.0.1:${port}`,
          stop: () => {
            child.kill();
          },
        });
      }
    });
    child.once("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    child.once("exit", (code) => {
      if (!settled) {
        settled = true;
        reject(new Error(`manifest server exited ${code ?? "signal"}`));
      }
    });
  });
}

async function sign(
  clients: ReturnType<typeof localClients>,
  contract: Address,
  owner: Address,
  tokenId: number,
  expiry: number,
) {
  const nonce = keccak256(toBytes(`${tokenId}:${owner}:${expiry}:${crypto.randomUUID()}`));
  const signature = await clients.wallet.signTypedData({
    account: owner,
    domain: claimDomain(await clients.publicClient.getChainId(), contract),
    types: CLAIM_TYPES,
    primaryType: "Claim",
    message: claimMessage({ tokenId, owner, nonce, expiry }),
  });
  return { tokenId, owner, nonce, expiry, signature };
}
