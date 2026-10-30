# @botmint/avatars: Genesis PFPs (v6.2, final art)

<p align="center"><img src="previews/pfp-grid.png" width="720" alt="25 Botmintx Genesis preview PFPs, v6.2"></p>

This is the Botmintx Genesis PFP trait system. A mint squircle head with cut-out capsule eyes and the two-leaf sprout, no outlines and no mouth, shaded in soft 3D, wearing stackable headwear, eyewear, clothing and accessories.

**Status.** The art is final (v6.2). The reference generator here is **Python** (`src/python`). The TypeScript port is in this package (`src/*.ts`) and renders the same trait selection through GEOS. Python remains the art reference. Blueprint sheet labels stay in Python: they need Geist, which is not in this repo. Mint weights are _planned_ and not set yet. The counts below come straight from the rules, with nothing estimated.

> Unofficial community project. Not affiliated with xAI or X Corp.

## The trait space

| Layer | Options |
|---|---|
| Background | Mint Wash, Carbon, Paper, Lilac, Sky, Butter, Coral, Sage |
| Body | Mint, Spearmint, Deep Mint, Fog, Graphite, Lilac, Cobalt, Sky, Gold, Obsidian, Glitch |
| Eyes | Idle, Joy, Wink, Wide, Sleepy, Glance, Focus |
| Headwear | None, Cap, Beanie, Bucket Hat, Crown, Headphones, Headband |
| Eyewear | None, Specs, Shades, Visor, VR Goggles, Monocle |
| Clothing | Bare, Tee, Hoodie, Bomber, Turtleneck, Puffer, Blazer |
| Accessory | None, Chain, Seed Pendant, Scarf, Lanyard |

**Rules** (machine-readable copy in [`rules.json`](rules.json)):

- **Invalid:** Turtleneck + Scarf.
- **Dedupe:** VR Goggles hide the eyes, so under VR Goggles the Eyes layer counts once.
- That leaves **753,984 distinct valid combinations**, plus **3 hand-made 1/1s**: Full Bloom, Spacewalk and Blueprint.

**Tiers.** The first match wins.

| Tier | Rule | Combinations |
|---|---|---|
| 1/1 | Hand-made, not rolled | 3 |
| Legendary | Body is Gold, Obsidian or Glitch | 205,632 |
| Rare | Has Crown, VR Goggles or Monocle | 182,784 |
| Uncommon | 2 or more of: Headphones, Bucket Hat, Visor, Shades, Bomber, Puffer, Blazer, Chain, Seed Pendant | 206,080 |
| Common | Everything else | 159,488 |

## Files

```text
packages/avatars/
├─ README.md            this file
├─ package.json
├─ tsconfig.json
├─ rules.json           layers, invalid pairs, dedupe, tiers, counts, draw order
├─ traits.json          options, counts by tier, 1/1s, and the 25-PFP preview grid (numbers + traits)
├─ src/
│  ├─ index.ts          renderPfp, renderOneOfOne
│  ├─ geo.ts            geos-wasm geometry: buffers, booleans, SVG paths
│  ├─ paint.ts          Art, gradients, soft shadows, head + eyes
│  ├─ traits.ts         every trait and pfp()
│  ├─ oneofones.ts      the three 1/1s (Blueprint labels need Geist, not in the repo)
│  ├─ count.ts          valid-look and tier counts from rules.json
│  ├─ golden.test.ts    raster comparison against svg/
│  └─ python/           reference generator (source of truth for the art)
│     ├─ geo.py         shapely helpers: superellipse, capsules, béziers, rounded boxes
│     ├─ pfp.py         Art (SVG writer), gradients, soft shadows (stacked buffered layers), head + eyes
│     ├─ traits.py      every trait: materials, clothing, accessories, headwear, eyewear, pfp(traits)
│     ├─ oneofones.py   the three 1/1s
│     ├─ build.py       count + tiers, preview grid, hero, trait sheet, samples, traits.json
│     ├─ sheets.py      QA: headwear × eyewear and clothing × accessory stress sheets, headwear fit
│     ├─ cap_preview.py Cap review sheet with 128px checks
│     └─ textpath.py    text → SVG paths (Geist / Geist Mono) for the sheet labels
├─ svg/                 golden reference renders, 512×512: 25 preview PFPs, the 3 1/1s and 3 samples
└─ previews/            PNG sheets: grid, hero, traits, stress, headwear fit, cap, samples
```

Regenerate everything from `src/python`. You need Python 3.10+, `shapely`, `cairosvg`, `Pillow`, and `uharfbuzz` plus `fonttools` for the labels.

```bash
cd packages/avatars/src/python
BOTMINT_FONTS=/path/to/google-fonts python3 build.py   # writes ../../svg, ../../previews, ../../traits.json, then runs sheets.py
python3 cap_preview.py
```

`BOTMINT_FONTS` is a folder that holds `Geist/Geist-VariableFont_wght.ttf` and `Geist Mono/GeistMono-VariableFont_wght.ttf`. Only the sheet labels need these fonts. The PFP art never uses them.

## Porting to TypeScript

The TypeScript port in `src/*.ts` uses geos-wasm so buffers match shapely (`buffer(resolution=N)` is GEOS `quadsegs=N`). Python in `src/python` remains the art reference. SVG output should match the Python reference for the same traits. `src/golden.test.ts` rasterizes the 25-PFP preview grid except Blueprint and compares it with the files in `svg/`. Blueprint labels are not ported.

1. **Geometry.** The art is built from boolean ops on polygons: union, difference, intersection, buffer and convex hull. `src/geo.ts` sends those calls through geos-wasm. `src/paint.ts` and `src/traits.ts` follow the Python draw order. Keep the curve sampling at shapely's `resolution` so the edges match.
2. **Coordinates.** The canvas is 512×512.
   - The body group is drawn at `translate(0 -50)`.
   - The head group is drawn at `translate(256 60) scale(0.84) translate(-256 -60)`.
   - Head: superellipse `n=4`, centre (256, 262), radii 150 × 138.
   - Eyes are capsule holes at x = 217 / 295, y = 250.
3. **Materials.** Gradients use `objectBoundingBox` units, and each fill gets its own `<linearGradient>`/`<radialGradient>` with a unique id.
   - Soft shadows don't use `feGaussianBlur`. They are `n` stacked `buffer(r·i/n)` copies, each with alpha `1-(1-op)^(1/n)`, optionally clipped to the head. Keep this, because it renders the same in every SVG engine.
4. **Headwear contract.** Each headwear returns `{back, front, top, ao, sprout: 'after'|'between', clip, lift}`.
   - `lift` raises the sprout so it comes up through the hat. On the Cap it rises through the button.
   - `clip` trims the stem.
   - Eyewear returns `{items, shadow, hide}`. When `hide` is set, the head is drawn without eye holes.
5. **Draw order.** Follow `rules.json → draw_order`.
6. **Determinism.** No randomness inside the art. The seed only chooses traits. Genesis selection, weights and DNA belong to the engine and are _planned_.

## Guardrails

- No outlines and no mouth. The head stays a mint squircle (`#3CF0A0` on the Mint body) with the two-leaf sprout.
- Original geometry only. Never trace or recolor official Grok Bot art, and never use xAI or X logos.
- Keep the disclaimer near the art: *Unofficial community project. Not affiliated with xAI or X Corp.*
