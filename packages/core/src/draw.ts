import { canonicalCompact } from "./canonical.ts";
import { coherenceParts, skillMultiplier } from "./coherence.ts";
import { tokenIdOf } from "./constants.ts";
import { sha256 } from "./hash.ts";
import { editionRng } from "./prng.ts";
import type { Registry } from "./registry.ts";
import { multiPick, scaledWeight, type Weighted, weightedPick } from "./sample.ts";
import type {
  Archetype,
  Autonomy,
  AvatarStyle,
  Cadence,
  Connector,
  Domain,
  OutputStyle,
  Persona,
  Skill,
} from "./schema.ts";

export type RoutineTrigger = { source: string; event: string };

export type Drawn = {
  edition: number;
  tokenId: string;
  attempt: number;
  dna: string;
  name: string;
  adjective: string;
  noun: string;
  archetype: Archetype;
  domain: Domain;
  persona: Persona;
  skills: Skill[];
  cadence: Cadence;
  connectors: Connector[];
  autonomy: Autonomy;
  output: OutputStyle;
  avatar: AvatarStyle;
  schedule: string | null;
  trigger: RoutineTrigger | null;
  coherence: number;
};

function byId<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function asWeighted<T extends { id: string; weight: number }>(
  items: T[],
  multiplierFor?: (item: T) => number,
): Array<T & Weighted> {
  return items.map((item) => ({
    ...item,
    multiplier: multiplierFor ? multiplierFor(item) : 1,
  }));
}

function autonomyRank(registry: Registry, id: string | undefined): number | undefined {
  if (!id) return undefined;
  return registry.autonomies.find((item) => item.id === id)?.rank;
}

export function dnaOf(input: {
  archetype: string;
  autonomy: string;
  cadence: string;
  connectors: string[];
  domain: string;
  persona: string;
  skills: string[];
}): string {
  return sha256(
    canonicalCompact({
      archetype: input.archetype,
      autonomy: input.autonomy,
      cadence: input.cadence,
      connectors: [...input.connectors].sort(),
      domain: input.domain,
      persona: input.persona,
      skills: [...input.skills].sort(),
    }),
  ).slice(0, 16);
}

export function checkRules(drawn: Drawn): void {
  const ids = new Set(drawn.connectors.map((item) => item.id));
  const rank = drawn.autonomy.rank;
  if (drawn.archetype.id === "trader") {
    if (!ids.has("market-data") || !drawn.archetype.requires?.domain?.includes(drawn.domain.id)) {
      throw new Error(`E_RULE R1 ${drawn.tokenId}`);
    }
    if (rank > 2) throw new Error(`E_RULE R2 ${drawn.tokenId}`);
  }
  if (ids.has("broker") && (drawn.archetype.id !== "trader" || rank > 2)) {
    throw new Error(`E_RULE R3 ${drawn.tokenId}`);
  }
  if (drawn.archetype.id === "dev-assistant" && !ids.has("github")) {
    throw new Error(`E_RULE R4 ${drawn.tokenId}`);
  }
  if (drawn.archetype.id === "inbox-manager" && !ids.has("gmail")) {
    throw new Error(`E_RULE R4 ${drawn.tokenId}`);
  }
  if ((drawn.domain.id === "healthcare" || drawn.domain.id === "legal") && rank > 1) {
    throw new Error(`E_RULE R5 ${drawn.tokenId}`);
  }
  if (drawn.archetype.id === "payments-assistant" && !ids.has("x-money")) {
    throw new Error(`E_RULE R6 ${drawn.tokenId}`);
  }
  if (ids.has("x-money") && drawn.archetype.id !== "payments-assistant") {
    throw new Error(`E_RULE R6 ${drawn.tokenId}`);
  }
  if ((ids.has("x-money") || drawn.archetype.id === "payments-assistant") && rank > 2) {
    throw new Error(`E_RULE R7 ${drawn.tokenId}`);
  }
  for (const skill of drawn.skills) {
    for (const need of skill.needs?.connectors ?? []) {
      if (!ids.has(need)) throw new Error(`E_RULE R8 ${drawn.tokenId} ${skill.id}`);
    }
  }
  for (const connector of drawn.connectors) {
    const covered = drawn.skills.some((skill) =>
      (skill.needs?.connectors ?? []).includes(connector.id),
    );
    if (!covered) throw new Error(`E_RULE R8 ${drawn.tokenId} ${connector.id}`);
  }
  if (drawn.cadence.id === "event-driven" && !drawn.connectors.some((item) => item.trigger)) {
    throw new Error(`E_RULE R9 ${drawn.tokenId}`);
  }
  if (drawn.skills.length !== 3 || drawn.connectors.length !== 2) {
    throw new Error(`E_RULE_SHAPE ${drawn.tokenId}`);
  }
}

function capRank(
  registry: Registry,
  archetype: Archetype,
  domain: Domain,
  connectors: Connector[],
): number {
  const ranks: number[] = [];
  const push = (id: string | undefined) => {
    const rank = autonomyRank(registry, id);
    if (rank !== undefined) ranks.push(rank);
  };
  push(archetype.caps?.autonomy);
  push(domain.caps?.autonomy);
  for (const connector of connectors) push(connector.caps?.autonomy);
  return ranks.length === 0 ? 3 : Math.min(...ranks);
}

function repairSkills(
  rng: () => number,
  chosen: Skill[],
  connectors: Connector[],
  candidates: Skill[],
  archetype: Archetype,
): Skill[] {
  let skills = [...chosen];
  const effect = (skill: Skill) => scaledWeight(skill.weight, skillMultiplier(archetype, skill.id));
  for (const connector of byId(connectors)) {
    if (skills.some((skill) => (skill.needs?.connectors ?? []).includes(connector.id))) continue;
    const replaceable = skills.filter((skill) => {
      const need = skill.needs?.connectors?.[0];
      if (!need) return true;
      return skills.some(
        (other) => other.id !== skill.id && (other.needs?.connectors ?? []).includes(need),
      );
    });
    if (replaceable.length === 0) throw new Error(`E_NO_REPLACEABLE ${connector.id}`);
    replaceable.sort((a, b) => {
      const delta = effect(a) - effect(b);
      if (delta !== 0) return delta;
      if (a.id < b.id) return 1;
      if (a.id > b.id) return -1;
      return 0;
    });
    const drop = replaceable[0]!;
    skills = skills.filter((skill) => skill.id !== drop.id);
    const pool = candidates.filter(
      (skill) =>
        !skills.some((kept) => kept.id === skill.id) &&
        (skill.needs?.connectors ?? []).includes(connector.id),
    );
    const added = weightedPick(
      rng,
      asWeighted(pool, (skill) => skillMultiplier(archetype, skill.id)),
    );
    const full = candidates.find((skill) => skill.id === added.id);
    if (!full) throw new Error(`E_SKILL_MISSING ${added.id}`);
    skills.push(full);
  }
  return byId(skills);
}

function drawAttempt(registry: Registry, rng: () => number, edition: number): Drawn {
  const archetype = weightedPick(rng, registry.archetypes);
  const domainPool = archetype.requires?.domain
    ? registry.domains.filter((domain) => archetype.requires?.domain?.includes(domain.id))
    : registry.domains;
  const domain = weightedPick(rng, domainPool);

  const forced = archetype.requires?.connectors ?? [];
  if (forced.length > 2) throw new Error(`E_TOO_MANY_FORCED ${archetype.id}`);
  const connectorPool = registry.connectors.filter((connector) => {
    if (forced.includes(connector.id)) return false;
    const allowed = connector.allowedOn?.archetype;
    return !allowed || allowed.includes(archetype.id);
  });
  const pickedConnectors = multiPick(rng, connectorPool, 2 - forced.length);
  const connectors = byId([
    ...forced.map((id) => registry.connectors.find((item) => item.id === id)!),
    ...pickedConnectors.map(
      (item) => registry.connectors.find((connector) => connector.id === item.id)!,
    ),
  ]);

  const cap = capRank(registry, archetype, domain, connectors);
  const autonomy = weightedPick(
    rng,
    registry.autonomies.filter((level) => level.rank <= cap),
  );
  const persona = weightedPick(rng, registry.personas);

  const connectorIds = new Set(connectors.map((item) => item.id));
  const skillCandidates = registry.skills.filter((skill) =>
    (skill.needs?.connectors ?? []).every((id) => connectorIds.has(id)),
  );
  const pickedSkills = multiPick(
    rng,
    asWeighted(skillCandidates, (skill) => skillMultiplier(archetype, skill.id)),
    3,
  ).map((item) => registry.skills.find((skill) => skill.id === item.id)!);
  const skills = repairSkills(rng, pickedSkills, connectors, skillCandidates, archetype);

  const hasTrigger = connectors.some((connector) => connector.trigger);
  const cadencePool = registry.cadences.filter(
    (cadence) => hasTrigger || cadence.id !== "event-driven",
  );
  const goodCadence = new Set(archetype.affinity?.cadences ?? []);
  const cadence = weightedPick(
    rng,
    asWeighted(cadencePool, (item) => (goodCadence.has(item.id) ? 1.5 : 1)),
  );

  const output = weightedPick(rng, registry.outputs);
  const avatar = weightedPick(rng, registry.avatars);
  const adjective = weightedPick(
    rng,
    domain.adjectives.map((word) => ({ id: word, weight: 1 })),
  );
  const noun = weightedPick(
    rng,
    persona.nouns.map((word) => ({ id: word, weight: 1 })),
  );

  let trigger: RoutineTrigger | null = null;
  if (cadence.trigger === true) {
    const sourceId = ["github", "slack", "gmail"].find((id) => connectorIds.has(id));
    const source = connectors.find((connector) => connector.id === sourceId);
    if (!source?.trigger) throw new Error(`E_NO_TRIGGER ${tokenIdOf(edition)}`);
    trigger = { source: source.trigger.source, event: source.trigger.event };
  }

  const tokenId = tokenIdOf(edition);
  const drawn: Drawn = {
    edition,
    tokenId,
    attempt: 0,
    dna: dnaOf({
      archetype: archetype.id,
      autonomy: autonomy.id,
      cadence: cadence.id,
      connectors: connectors.map((item) => item.id),
      domain: domain.id,
      persona: persona.id,
      skills: skills.map((item) => item.id),
    }),
    name: `${adjective.id} ${noun.id} - ${domain.label} ${archetype.title}`,
    adjective: adjective.id,
    noun: noun.id,
    archetype,
    domain,
    persona,
    skills,
    cadence,
    connectors,
    autonomy,
    output,
    avatar,
    schedule: cadence.schedule ?? null,
    trigger,
    coherence: 0,
  };
  drawn.coherence = coherenceParts({
    archetype,
    domainId: domain.id,
    skills,
    cadenceId: cadence.id,
  }).score;
  checkRules(drawn);
  return drawn;
}

export function drawEdition(
  registry: Registry,
  collectionSeed: string,
  edition: number,
  seen: Set<string>,
): Drawn {
  for (let attempt = 0; attempt <= 15; attempt++) {
    const rng = editionRng(collectionSeed, edition, attempt);
    const drawn = drawAttempt(registry, rng, edition);
    drawn.attempt = attempt;
    if (seen.has(drawn.dna)) continue;
    if (drawn.coherence < 700) continue;
    return drawn;
  }
  throw new Error(`E_EDITION_EXHAUSTED ${tokenIdOf(edition)}`);
}

export function generateDraws(registry: Registry, collectionSeed: string, count: number): Drawn[] {
  const seen = new Set<string>();
  const draws: Drawn[] = [];
  for (let edition = 1; edition <= count; edition++) {
    const drawn = drawEdition(registry, collectionSeed, edition, seen);
    seen.add(drawn.dna);
    draws.push(drawn);
  }
  return draws;
}
