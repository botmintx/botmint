import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { execPnpm } from "./pnpm.ts";

const root = path.resolve(import.meta.dirname, "..");
const banner = "Dev sample — not Genesis. 25 bots from seed botmint-dev-sample-001";
const footer =
  "botmint is an unofficial community project, not affiliated with xAI or X. MIT licensed.";

describe("gallery export", () => {
  it("builds every route with the banner and footer", () => {
    execPnpm(["--filter", "@botmint/gallery", "build"], {
      cwd: root,
      stdio: "inherit",
    });
    const out = path.join(root, "apps", "gallery", "out");
    const routes = [
      "index.html",
      "stats/index.html",
      "provenance/index.html",
      "mint/index.html",
      "claim/index.html",
      "dev-sample/0001/index.html",
      "dev-sample/0025/index.html",
    ];
    for (const route of routes) {
      const html = readFileSync(path.join(out, route), "utf8");
      expect(html, route).toContain(banner);
      expect(html, route).toContain(footer);
    }
    const home = readFileSync(path.join(out, "index.html"), "utf8");
    expect(home).toContain("DNA");
    expect(home).toContain("#0001");
    const mint = readFileSync(path.join(out, "mint/index.html"), "utf8");
    expect(mint).toContain("Mint random · claims are closed");
    expect(mint).not.toContain("Test mint is on");
    const claim = readFileSync(path.join(out, "claim/index.html"), "utf8");
    expect(claim).toContain("Claim codes are off");
    expect(claim).not.toContain("Copy the claim code");
    expect(claim).not.toContain("Test claim signing is on");
    const deployment = JSON.parse(
      readFileSync(path.join(out, "mint/base-sepolia.json"), "utf8"),
    ) as { contract: string | null; galleryBaseUrl: string; rpcUrl: string; chainId: number };
    expect(deployment.contract).toBeNull();
    expect(deployment.chainId).toBe(84532);
    expect(deployment.rpcUrl).toBe("https://sepolia.base.org");
    expect(deployment.galleryBaseUrl).toBe("https://botmintx.github.io/botmint");
    const manifest = JSON.parse(readFileSync(path.join(out, "bots/0001/loader.json"), "utf8")) as {
      tokenId: string;
      manifestPath: string;
      pfp: { path: string };
      instructionsSource: string;
    };
    expect(manifest.tokenId).toBe("#0001");
    expect(manifest.manifestPath).toBe("bots/0001/loader.json");
    expect(manifest.pfp.path).toBe("/sample/0001/avatar.svg");
    expect(manifest.instructionsSource).toBe("raw");
    const domain = readFileSync(path.join(out, "mint/claim-domain.json"), "utf8");
    expect(domain).toContain('"Botmint"');
    const artifact = JSON.parse(
      readFileSync(path.join(out, "mint/BotmintGenesis.json"), "utf8"),
    ) as {
      bytecode: string;
    };
    expect(artifact.bytecode.startsWith("0x")).toBe(true);
  }, 180_000);
});
