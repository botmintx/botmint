import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const bin = path.join(root, "packages/cli/bin/botmint.js");

function run(args: string[]) {
  try {
    const stdout = execFileSync(process.execPath, [bin, ...args], {
      cwd: root,
      encoding: "utf8",
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

describe("loader pack config", () => {
  it("refuses while the contract address is null", () => {
    const refused = run(["loader", "pack"]);
    expect(refused.status, refused.stderr).toBe(1);
    expect(refused.stderr).toContain("botmint loader pack refused");
    expect(refused.stderr).toContain("contract address is null");
    expect(refused.stderr).toContain("deployments/base-sepolia.json");
    const packed = run(["loader", "pack", "--allow-unconfigured"]);
    expect(packed.status, packed.stderr).toBe(0);
    expect(packed.stdout).toContain(
      "npx --yes botmint@0.1.0 verify-claim --network base-sepolia --code '<claim code json>'",
    );
    expect(packed.stdout).toContain(
      "npx --yes botmint@0.1.0 fetch-manifest <tokenId> --network base-sepolia",
    );
    expect(packed.stdout).toContain(
      "npx --yes botmint@0.1.0 check-owner <tokenId> <owner address> --network base-sepolia",
    );
    expect(packed.stdout).toContain("https://sepolia.base.org");
    expect(packed.stdout).toContain("https://botmintx.github.io/botmint");
    expect(packed.stdout).toContain("contract: null");
    expect(packed.stdout).toContain("~/.botmint/nonces.json");
  });

  it("prints malformed claim JSON without calling a public RPC", () => {
    const result = run(["verify-claim", "--code", "{}"]);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual({
      ok: false,
      reason: "malformed",
      manifestUrl: null,
    });
    const owner = run(["check-owner", "1", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"]);
    expect(owner.status).toBe(1);
    const body = JSON.parse(owner.stdout) as { ok: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain("contract address is null");
  });

  it("is publishable and the pages workflow stays manual", () => {
    const pkg = JSON.parse(readFileSync(path.join(root, "packages/cli/package.json"), "utf8")) as {
      private?: boolean;
      bin: { botmint: string };
      files: string[];
      publishConfig: { access: string; provenance: boolean };
    };
    expect(pkg.private).toBeUndefined();
    expect(pkg.bin.botmint).toBe("./bin/botmint.js");
    expect(pkg.files).toEqual(["bin", "dist", "deployments", "README.md"]);
    expect(pkg.publishConfig.access).toBe("public");
    expect(pkg.publishConfig.provenance).toBe(true);
    const pages = readFileSync(path.join(root, ".github/workflows/gallery-pages.yml"), "utf8");
    expect(pages).toContain("workflow_dispatch:");
    expect(pages).not.toContain("pull_request");
    expect(pages).not.toMatch(/^on:\n\s+push:/m);
    const script = path.join(root, "packages/cli/scripts/refuse-publish.mjs");
    let status = 0;
    let stderr = "";
    try {
      execFileSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
    } catch (error) {
      const failed = error as { status?: number; stderr?: string };
      status = failed.status ?? 1;
      stderr = String(failed.stderr ?? "");
    }
    expect(status).toBe(1);
    expect(stderr).toContain("Refusing to publish");
  });
});
