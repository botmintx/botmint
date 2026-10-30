import { rngFromSeedMaterial } from "@botmint/core";

function unit(rng: () => number): number {
  return rng() / 2 ** 32;
}

/** Deterministic 512×512 mark. Colours come only from the avatar palette. */
export function avatarSvg(dna: string, palette: string[]): string {
  const rng = rngFromSeedMaterial(`avatar:${dna}`);
  const fill = (index: number) => palette[index % palette.length]!;
  const shapes: string[] = [`<rect width="512" height="512" fill="${fill(0)}"/>`];
  const cx = 156 + Math.floor(unit(rng) * 200);
  const cy = 150 + Math.floor(unit(rng) * 70);
  const radius = 78 + Math.floor(unit(rng) * 36);
  shapes.push(`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${fill(1)}"/>`);
  const eye = fill(2);
  const eyeW = 12 + (rng() % 10);
  const eyeH = 28 + (rng() % 18);
  shapes.push(
    `<rect x="${cx - 34}" y="${cy - 10}" width="${eyeW}" height="${eyeH}" fill="${eye}"/>`,
  );
  shapes.push(
    `<rect x="${cx + 16}" y="${cy - 10}" width="${eyeW}" height="${eyeH}" fill="${eye}"/>`,
  );
  const blocks = 3 + (rng() % 3);
  for (let i = 0; i < blocks; i++) {
    const x = Math.floor(unit(rng) * 360);
    const y = 320 + Math.floor(unit(rng) * 120);
    const w = 48 + Math.floor(unit(rng) * 100);
    const h = 24 + Math.floor(unit(rng) * 70);
    shapes.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill(1 + (i % palette.length))}"/>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${shapes.join("")}</svg>\n`;
}

export function avatarPrompt(input: {
  promptStyle: string;
  persona: string;
  title: string;
  motif: string;
  palette: string[];
}): string {
  return `${input.promptStyle} portrait of a ${input.persona} ${input.title} bot, motif: ${input.motif}, palette ${input.palette.join(" ")}, no text\n`;
}
