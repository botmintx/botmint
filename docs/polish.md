# Polish

Polish rewrites allowlisted prose with the xAI API. The raw render stays the byte-for-byte source of truth. Polished text is a separate artifact because a model call cannot be replayed.

This repo does not call the API. Tests use a local mock. A real run needs all of the following, and CI never has them:

- `XAI_API_KEY` in the environment. The CLI reads `process.env` only. It does not load a dotenv file. `.env.example` is blank on purpose.
- `--i-understand-this-costs-money` for any run that is not `--dry-run`.
- `CI` unset. `polish` exits with `E_POLISH_CI` when `CI=true`, including dry runs.

```bash
botmint polish dev-sample --dry-run
botmint polish dev-sample --i-understand-this-costs-money --limit 1
botmint polish check dev-sample
```

The default model is `grok-4.20-0309-non-reasoning`. Model ids that end in `-latest`, or that have no 4-digit date, are refused unless `--allow-undated` is set. Point `XAI_BASE_URL` at a mock server. The default host is `https://api.x.ai/v1`, and this build never requests it.

Allowlisted fields are `description`, `job`, `skills[*].body`, `routines[*].prompt`, and the archetype memories. Name, traits, DNA, policy, and the locked X Money sentences stay put. Guardrails reject a new connector name, a new URL, an autonomy escalation, or a field whose length is outside 70–130% of the raw text.

Prices for `--dry-run` come from `polish/pricing.json`. The prompt is `polish/prompt.v1.md`.

A real run writes `collections/<name>/polished/<edition>.json`, updates `polishedHash` in `manifest.json`, and writes `polish-report.json`. The next run skips a token whose report entry is `passed`, whose cache key still matches, and whose file still hashes to that `polishedHash`. `--concurrency` defaults to 8. `--limit` counts tokens that still need work. `--only-failed` retries tokens the report already marks `failed`. Genesis polished output stays gitignored until the freeze runbook says to commit it.
