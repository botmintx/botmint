# Genesis freeze runbook

Genesis is 10,000 bots, `#0001`–`#10000`, from one published seed. This pass does not freeze it. `collections/genesis/` only has this status, via `README.md`, and a claims file with `"open": false`.

Do these steps in order, and only after the checklist in the spec (X Money read test, terms, install path, keys). None of the live steps are run by CI.

1. **Pin the packs.** After this, `core`, `markets`, and `creator` take no new traits. New traits go in a new pack.
2. **Dry runs.** Render a throwaway seed and polish a small sample with `botmint polish <collection> --dry-run`. Review drift, coherence, and a handful of tokens by hand.
3. **Render.** Commit the final seed. `botmint drop build genesis --seed <seed> --count 10000` writes `raw/`. Remove the `collections/genesis/raw/` line from `.gitignore` and commit the raw output. The comment in `.gitignore` says `# remove raw/polished lines at Genesis freeze (docs/genesis.md)`.
4. **Polish.** `botmint polish genesis --i-understand-this-costs-money` until every token passes. This calls the xAI API and spends money. It refuses when `CI=true`. Remove the polished ignore line and commit `polished/` plus `polish-report.json`.
5. **Freeze.** `botmint drop freeze genesis` writes `genesis.lock.json`. It refuses a dirty tree, a missing polish hash, or a report that is not all passed. Tag `genesis-v1` on the commit that contains the lock. The lock records the previous commit, because a file cannot contain its own hash.
6. **Verify.** CI runs `botmint drop verify genesis` on three operating systems once the lock exists.
7. **Anchor.** `botmint anchor genesis --chain base` prints an unsigned EAS transaction. It does not send it. See `docs/anchoring.md`.
8. **Launch.** Gallery, npm, and featured links are still disabled in this repo.

`botmint drop verify genesis` with no manifest prints that Genesis is not frozen yet and exits 0.
