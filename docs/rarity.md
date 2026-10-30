# Rarity

After a collection is drawn, each token gets a score:

`rarityScore = Σ −log2(share)` over all nine layers. Skills contribute three terms and connectors two. Output and avatar are included even though they are not part of DNA.

The stored score is rounded to 4 decimal places. Rank uses the unrounded score, highest first, and breaks ties by token id ascending.

Tiers for a collection of size N use `floor(N × 0.01)`, `floor(N × 0.05)`, `floor(N × 0.15)`, and `floor(N × 0.40)`. The rest are Common. For the dev sample, N = 25, so Legendary is empty, Epic is rank 1, Rare is ranks 2–3, Uncommon is ranks 4–10, and Common is ranks 11–25.

`rarity.json` records counts, expected share, realised share, drift in percentage points for single-pick layers, score percentiles, and tier counts. Multi-pick layers store the realised share as their expected share, because the draw is not a single independent weight.

Percentiles use nearest-rank on scores sorted ascending: `min(N−1, max(0, ceil(p/100 × N) − 1))`.
