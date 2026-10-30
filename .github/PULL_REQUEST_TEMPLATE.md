## What

## Packs

- What job does the pack serve?
- Which connectors does it need?
- Rules are data only (`requires`, `caps`, `allowedOn`, `needs`). No pack code.

## Checklist

- [ ] No secrets, no personal data, and no copied third-party Grok Bot templates.
- [ ] `pnpm typecheck`, `pnpm exec biome ci .`, and `pnpm test` pass.
- [ ] `pnpm exec botmint count --json` still matches the published integers, or this PR explains the new count.
