import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import pixelmatch from "pixelmatch";
import { describe, expect, it } from "vitest";
import { countLooks } from "./count.ts";
import { renderOneOfOne, renderPfp } from "./index.ts";

/**
 * Raster comparison at 256px. pixelmatch threshold 0.1 is its default OKLab
 * distance. A difference of 0 means the port matches the Python SVG.
 * Blueprint is skipped: its labels need Geist, which is not in the repo.
 */
const SIZE = 256;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

type GridEntry = {
  no: number;
  _1of1?: string;
  Background?: string;
  Body?: string;
  Eyes?: string;
  Headwear?: string;
  Eyewear?: string;
  Clothing?: string;
  Accessory?: string;
};

function raster(svg: string | Buffer): { data: Buffer; width: number; height: number } {
  const rendered = new Resvg(svg, {
    fitTo: { mode: "width", value: SIZE },
    font: { loadSystemFonts: false },
  }).render();
  return { data: rendered.pixels, width: rendered.width, height: rendered.height };
}

function mismatch(actual: string, file: string): number {
  const left = raster(actual);
  const right = raster(readFileSync(join(root, "svg", file)));
  expect(left.width).toBe(right.width);
  expect(left.height).toBe(right.height);
  return pixelmatch(left.data, right.data, null, left.width, left.height, { threshold: 0.1 });
}

function fileFor(entry: GridEntry): { svg: string; file: string } {
  if (entry._1of1 === "Full Bloom") {
    return { svg: renderOneOfOne("full-bloom"), file: "1of1-full-bloom.svg" };
  }
  if (entry._1of1 === "Spacewalk") {
    return { svg: renderOneOfOne("spacewalk"), file: "1of1-spacewalk.svg" };
  }
  const no = String(entry.no).padStart(4, "0");
  return {
    svg: renderPfp({
      background: entry.Background ?? "",
      body: entry.Body ?? "",
      eyes: entry.Eyes ?? "",
      headwear: entry.Headwear ?? "",
      eyewear: entry.Eyewear ?? "",
      clothing: entry.Clothing ?? "",
      accessory: entry.Accessory ?? "",
    }),
    file: `pfp-${no}.svg`,
  };
}

describe("genesis pfp", () => {
  it("counts 753,984 valid looks and the published tiers", () => {
    expect(countLooks()).toEqual({
      valid: 753984,
      legendary: 205632,
      rare: 182784,
      uncommon: 206080,
      common: 159488,
      oneOfOnes: 3,
    });
  });

  it("matches the preview grid except Blueprint", () => {
    const grid = JSON.parse(readFileSync(join(root, "traits.json"), "utf8")).grid as GridEntry[];
    const covered = grid.filter((entry) => entry._1of1 !== "Blueprint");
    expect(covered.length).toBeGreaterThanOrEqual(4);
    for (const entry of covered) {
      const { svg, file } = fileFor(entry);
      const diff = mismatch(svg, file);
      expect(diff, `${file} differed in ${diff} pixels`).toBe(0);
    }
  });
});
