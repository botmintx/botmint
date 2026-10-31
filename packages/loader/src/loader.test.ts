import { readFileSync } from "node:fs";
import path from "node:path";
import { MemoryNonceStore } from "@botmint/mint";
import { describe, expect, it } from "vitest";
import { loadClaimedBot } from "./load.ts";
import { loaderManifest } from "./manifest.ts";
import { loaderPack } from "./pack.ts";
import { LOADER_SKILL_BODY } from "./text.ts";

const root = path.resolve(import.meta.dirname, "../../..");

describe("loader template", () => {
  it("is one pack that refuses a bad claim and goes dormant if the token moves", () => {
    const pack = loaderPack();
    expect(pack.profile.name).toBe("Botmint");
    expect(pack.skills.map((skill) => skill.name)).toEqual(["Load your bot", "Getting started"]);
    expect(pack.routines).toHaveLength(1);
    expect(pack.routines[0]?.name).toBe("Recheck ownership");
    expect(LOADER_SKILL_BODY).toContain("ownerOf");
    expect(LOADER_SKILL_BODY.toLowerCase()).toContain("refuse");
    expect(pack.routines[0]?.prompt.toLowerCase()).toContain("dormant");
    expect(pack.memory.join(" ")).toContain("unofficial");
    const text = JSON.stringify(pack);
    expect(text).not.toContain("x.ai/bot");
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
