import { readFileSync } from "node:fs";
import path from "node:path";
import { MemoryNonceStore } from "@botmint/mint";
import { describe, expect, it } from "vitest";
import { loadClaimedBot } from "./load.ts";
import { loaderManifest } from "./manifest.ts";
import { loaderPack, UnconfiguredDeploymentError } from "./pack.ts";

const root = path.resolve(import.meta.dirname, "../../..");
const version = (
  JSON.parse(readFileSync(path.join(root, "packages/cli/package.json"), "utf8")) as {
    version: string;
  }
).version;

const configured = {
  network: "base-sepolia",
  chainId: 84532,
  contract: "0x1111111111111111111111111111111111111111",
  rpcUrl: "https://sepolia.base.org",
  galleryBaseUrl: "https://botmintx.github.io/botmint",
  packageVersion: version,
};

describe("loader template", () => {
  it("bakes the deployment into npx commands and refuses a null address or gallery", () => {
    const source = readFileSync(new URL("./text.ts", import.meta.url), "utf8");
    expect(source).not.toContain("https://");
    expect(source).not.toContain("npx");
    expect(source).not.toContain("0x");
    const pack = loaderPack(configured);
    expect(pack.profile.name).toBe("Botmint");
    expect(pack.skills.map((skill) => skill.name)).toEqual(["Load your bot", "Getting started"]);
    expect(pack.routines).toHaveLength(1);
    expect(pack.routines[0]?.name).toBe("Recheck ownership");
    const verify = `npx --yes botmint@${version} verify-claim --network base-sepolia --code '<claim code json>'`;
    const fetchLine = `npx --yes botmint@${version} fetch-manifest <tokenId> --network base-sepolia`;
    const recheck = `npx --yes botmint@${version} check-owner <tokenId> <owner address> --network base-sepolia`;
    expect(pack.skills[0]?.body).toContain(verify);
    expect(pack.skills[0]?.body).toContain(fetchLine);
    expect(pack.skills[0]?.body).toContain(recheck);
    expect(pack.skills[0]?.body).toContain(configured.contract);
    expect(pack.skills[0]?.body).toContain(configured.rpcUrl);
    expect(pack.skills[0]?.body).toContain(configured.galleryBaseUrl);
    expect(pack.skills[0]?.body).toContain("~/.botmint/nonces.json");
    expect(pack.skills[1]?.body).toContain(verify);
    expect(pack.routines[0]?.prompt).toContain(recheck);
    expect(pack.routines[0]?.prompt.toLowerCase()).toContain("dormant");
    expect(pack.memory.join(" ")).toContain("unofficial");
    const text = JSON.stringify(pack);
    expect(text).not.toContain("x.ai/bot");

    const file = JSON.parse(
      readFileSync(path.join(root, "deployments/base-sepolia.json"), "utf8"),
    ) as {
      network: string;
      contract: string | null;
      galleryBaseUrl: string;
      rpcUrl: string;
      chainId: number;
    };
    expect(file.contract).toBeNull();
    expect(() => loaderPack({ ...file, packageVersion: version })).toThrow(
      UnconfiguredDeploymentError,
    );
    expect(() => loaderPack({ ...file, packageVersion: version })).toThrow(
      /contract address is null/,
    );
    expect(() =>
      loaderPack({ ...configured, galleryBaseUrl: null }, { allowUnconfigured: false }),
    ).toThrow(/gallery URL is null/);
    const open = loaderPack({ ...file, packageVersion: version }, { allowUnconfigured: true });
    expect(open.skills[0]?.body).toContain("contract: null");
    expect(open.skills[0]?.body).toContain(file.galleryBaseUrl);
    expect(open.skills[0]?.body).toContain(file.rpcUrl);
  });

  it("writes a per-bot manifest path and refuses the wrong token", async () => {
    const manifest = loaderManifest({
      collection: "dev-sample",
      edition: 1,
      tokenId: "#0001",
      name: "Compass",
      description: "I plan the trip.",
      job: "Plan the trip.",
      policy: "I ask first.",
      traits: {
        archetype: { id: "content-creator", label: "Content Creator" },
        domain: { id: "travel", label: "Travel" },
        persona: { id: "friendly-teacher", label: "Friendly Teacher" },
        cadence: { id: "monday-review", label: "Monday review" },
        autonomy: { id: "draft-only", label: "Draft only" },
        output: { id: "memo", label: "Memo" },
        avatar: { id: "flat", label: "Flat" },
        connectors: [],
        skills: [],
      },
      skills: [{ name: "Draft", description: "When needed.", body: "When you ask, I draft." }],
      memory: ["Short notes."],
      routine: { name: "Monday", when: "each Monday", prompt: "Review." },
      pfpPath: "/sample/0001/avatar.svg",
    });
    expect(manifest.manifestPath).toBe("bots/0001/loader.json");
    expect(manifest.instructionsSource).toBe("raw");
    expect(manifest.pfp.path).toBe("/sample/0001/avatar.svg");
    const refused = await loadClaimedBot({
      code: {
        tokenId: 2,
        owner: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        nonce: `0x${"11".repeat(32)}`,
        expiry: 10,
        signature: `0x${"22".repeat(65)}`,
      },
      manifest,
      contract: "0x0000000000000000000000000000000000000001",
      client: {
        getChainId: async () => {
          throw new Error("chain");
        },
        readContract: async () => {
          throw new Error("chain");
        },
      },
      abi: [],
      nonces: new MemoryNonceStore(),
      now: 20,
    });
    expect(refused).toEqual({ ok: false, status: "refused", reason: "manifest" });
    const state = JSON.parse(
      readFileSync(path.join(root, "collections/genesis/claims/claims.state.json"), "utf8"),
    ) as { open: boolean };
    expect(state.open).toBe(false);
  });
});
