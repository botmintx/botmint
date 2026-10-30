# Contributing

botmint is an unofficial community project. It is not affiliated with xAI or X Corp.

Trait packs arrive as pull requests. Each pack is one folder `packs/<name>/` with `pack.yaml`, its values, and at least one golden edition under `tests/golden/<name>/`. Rules are data (`requires`, `caps`, `allowedOn`, `needs`). Packs do not contain code, secrets, personal data, or copies of someone else's Grok Bot template.

`core`, `markets`, and `creator` are the starter set. After Genesis freezes they do not take new traits. Add a pack instead. `botmint pack new` refuses those three names.

```bash
pnpm install
pnpm typecheck
pnpm exec biome ci .
pnpm test
pnpm schema
pnpm exec botmint validate
pnpm exec botmint count --json
```

Node 24 is required (`>=24 <25`). The package manager is the pnpm version in `package.json`.

`CODEOWNERS` is `* @brandononchain`. A merged pack can add its author on a following line.
