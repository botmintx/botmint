import { readFileSync } from "node:fs";
import path from "node:path";
import {
  type Abi,
  type Address,
  encodeFunctionData,
  getAddress,
  type Hex,
  keccak256,
  toBytes,
} from "viem";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadClaimedBot, recheckOwnership } from "../../loader/src/load.ts";
import { loaderManifest } from "../../loader/src/manifest.ts";
import domainFile from "../claim-domain.json" with { type: "json" };
import { forgeBuild, localClients, startAnvil } from "./chain.ts";
import {
  CLAIM_DOMAIN_NAME,
  CLAIM_DOMAIN_VERSION,
  CLAIM_TYPES,
  claimDomain,
  claimMessage,
  MemoryNonceStore,
  verifyClaim,
} from "./claim.ts";
import { deployGenesis, mintAfterPayment, transferToken } from "./flow.ts";
import { claimStatus, indexTransfers } from "./indexer.ts";
import { MockXMoneyAdapter } from "./payment.ts";

const root = path.resolve(import.meta.dirname, "../../..");
const ALICE = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const BOB = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const manifest = loaderManifest({
  collection: "dev-sample",
  edition: 1,
  tokenId: "#0001",
  name: "Compass Mentor - Travel Content Producer",
  description: "I plan the trip and I show my work.",
  job: "Plan the trip.",
  policy: "I ask before I act.",
  traits: {
    archetype: { id: "content-creator", label: "Content Creator" },
    domain: { id: "travel", label: "Travel" },
    persona: { id: "friendly-teacher", label: "Friendly Teacher" },
    cadence: { id: "monday-review", label: "Monday review" },
    autonomy: { id: "draft-only", label: "Draft only" },
    output: { id: "memo", label: "Memo" },
    avatar: { id: "flat", label: "Flat" },
    connectors: [],
    skills: [{ id: "draft", label: "Draft" }],
  },
  skills: [
    { name: "Draft", description: "When a draft is needed.", body: "When you ask, I draft." },
  ],
  memory: ["The owner prefers short notes."],
  routine: { name: "Monday", when: "each Monday", prompt: "Review the week." },
  pfpPath: "/sample/0001/avatar.svg",
});

describe("mock checkout", () => {
  it("confirms $10 and does not call X Money", async () => {
    const source = readFileSync(path.join(root, "packages/mint/src/payment.ts"), "utf8");
    expect(source.toLowerCase()).not.toContain("api.x.com");
    expect(source.toLowerCase()).not.toContain("x.ai");
    const paid = await new MockXMoneyAdapter().checkout({ tokenId: 1, payer: ALICE });
    expect(paid).toMatchObject({ ok: true, amountUsd: "10.00", rail: "mock" });
    const rejected = await new MockXMoneyAdapter().checkout({ tokenId: 0, payer: ALICE });
    expect(rejected).toEqual({ ok: false, reason: "token" });
  });

  it("keeps the claim domain aligned with the gallery file", () => {
    expect(CLAIM_DOMAIN_NAME).toBe(domainFile.name);
    expect(CLAIM_DOMAIN_VERSION).toBe(domainFile.version);
    expect(CLAIM_TYPES.Claim.map((field) => ({ name: field.name, type: field.type }))).toEqual(
      domainFile.types.Claim,
    );
    const state = JSON.parse(
      readFileSync(path.join(root, "collections/genesis/claims/claims.state.json"), "utf8"),
    ) as { open: boolean };
    expect(state.open).toBe(false);
    const script = readFileSync(path.join(root, "contracts/script/deploy-base-sepolia.sh"), "utf8");
    expect(script).toContain("sepolia.base.org");
    expect(script).not.toMatch(/0x[0-9a-fA-F]{64}/);
  });
});

describe("anvil ownership", () => {
  let stop: (() => Promise<void>) | undefined;
  let url = "";

  beforeAll(async () => {
    forgeBuild(root);
    const anvil = await startAnvil();
    url = anvil.url;
    stop = anvil.stop;
  }, 180_000);

  afterAll(async () => {
    await stop?.();
  });

  it("mints, loads, rejects a moved token, and rejects expired or replayed codes", async () => {
    const artifact = JSON.parse(
      readFileSync(path.join(root, "contracts/out/BotmintGenesis.sol/BotmintGenesis.json"), "utf8"),
    ) as { abi: Abi; bytecode: { object: Hex } };
    const abi = artifact.abi;
    const names = abi.filter((item) => item.type === "function").map((item) => item.name);
    expect(names).toEqual(expect.arrayContaining(["mint", "ownerOf", "transferFrom"]));

    const alice = localClients(url, ALICE);
    const bob = localClients(url, BOB);
    const contract = await deployGenesis({
      wallet: alice.wallet,
      publicClient: alice.publicClient,
      abi,
      bytecode: artifact.bytecode.object,
      admin: ALICE,
    });
    const paid = await new MockXMoneyAdapter().checkout({ tokenId: 1, payer: ALICE });
    await mintAfterPayment({
      receipt: paid,
      wallet: alice.wallet,
      publicClient: alice.publicClient,
      abi,
      contract,
      minter: ALICE,
      to: ALICE,
    });

    const holdersAfterMint = await indexTransfers(alice.publicClient, contract);
    expect(holdersAfterMint).toEqual([{ tokenId: "1", holder: getAddress(ALICE) }]);
    expect(claimStatus(getAddress(ALICE), null)).toBe("awaiting-claim");

    const nonces = new MemoryNonceStore();
    const now = Math.floor(Date.now() / 1000);
    const first = await sign(alice, contract, ALICE, 1, now + 3600);
    const loaded = await loadClaimedBot({
      code: first,
      manifest,
      contract,
      client: alice.publicClient,
      abi,
      nonces,
      now,
    });
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.name).toBe(manifest.name);
      expect(loaded.avatar).toBe("/sample/0001/avatar.svg");
      expect(loaded.status).toBe("loaded");
    }
    expect(claimStatus(getAddress(ALICE), ALICE)).toBe("claimed");

    const unused = await sign(alice, contract, ALICE, 1, now + 3600);
    await transferToken({
      wallet: alice.wallet,
      publicClient: alice.publicClient,
      abi,
      contract,
      from: ALICE,
      to: BOB,
      tokenId: 1,
    });
    const stale = await loadClaimedBot({
      code: unused,
      manifest,
      contract,
      client: alice.publicClient,
      abi,
      nonces,
      now,
    });
    expect(stale).toMatchObject({ ok: false, reason: "owner" });
    const dormant = await recheckOwnership({
      client: alice.publicClient,
      abi,
      contract,
      tokenId: 1,
      loadedOwner: ALICE,
    });
    expect(dormant).toMatchObject({ active: false, status: "dormant" });
    expect(claimStatus(getAddress(BOB), ALICE)).toBe("dormant");

    const next = await sign(bob, contract, BOB, 1, now + 3600);
    const reloaded = await loadClaimedBot({
      code: next,
      manifest,
      contract,
      client: bob.publicClient,
      abi,
      nonces,
      now,
    });
    expect(reloaded.ok).toBe(true);
    const replay = await verifyClaim({
      code: next,
      contract,
      client: bob.publicClient,
      abi,
      nonces,
      now,
    });
    expect(replay).toEqual({ ok: false, reason: "replayed" });

    const expired = await sign(bob, contract, BOB, 1, now - 10);
    const expiredLoad = await loadClaimedBot({
      code: expired,
      manifest,
      contract,
      client: bob.publicClient,
      abi,
      nonces,
      now,
    });
    expect(expiredLoad).toMatchObject({ ok: false, reason: "expired" });

    const holders = await indexTransfers(bob.publicClient, contract);
    expect(holders).toEqual([{ tokenId: "1", holder: getAddress(BOB) }]);
    expect(encodeFunctionData({ abi, functionName: "ownerOf", args: [1n] })).toMatch(/^0x/);
  });
});

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
