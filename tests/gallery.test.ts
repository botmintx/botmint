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
  }, 180_000);
});
