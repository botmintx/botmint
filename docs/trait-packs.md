# Trait packs

A pack is a folder `packs/<name>/` with `pack.yaml` and one YAML file per trait value. Packs hold data only. The engine owns the draw order, the pick counts, and `bypassDNA` for output and avatar.

```yaml
id: core
version: 1.0.0
title: botmint core pack
license: MIT
layers: [archetype, domain, persona, skill, cadence, connector, autonomy, output, avatar]
```

Unknown keys are an error. Every id referenced from `requires`, `affinity`, `allowedOn`, or `needs` must exist. Weights in each layer, across all loaded packs, sum to 100.

The starter set is `core`, `markets`, and `creator`. New traits go in a new pack. `botmint pack new <name>` scaffolds one and refuses those three names.

`marketplaceId` is `null` until a connector's Grok Bot marketplace id is confirmed. Do not invent one.

See `docs/rules.md` for how `requires`, `caps`, `allowedOn`, and `needs` become the constraint solver.
