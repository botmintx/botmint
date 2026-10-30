import type { Archetype, Skill } from "./schema.ts";

export function skillMultiplier(archetype: Archetype, skillId: string): number {
  return archetype.affinity?.skills?.[skillId] ?? 1;
}

export function coherenceParts(input: {
  archetype: Archetype;
  domainId: string;
  skills: Skill[];
  cadenceId: string;
}): { A: number; S: number; C: number; F: number; score: number } {
  const affinity = input.archetype.affinity?.domains?.[input.domainId];
  const A = affinity === "good" ? 1000 : affinity === "poor" ? 400 : 700;
  const terms = input.skills.map((skill) =>
    skillMultiplier(input.archetype, skill.id) >= 1.5 ? 1000 : 667,
  );
  const S = Math.floor(terms.reduce((sum, term) => sum + term, 0) / terms.length);
  const C = 1000;
  const F = (input.archetype.affinity?.cadences ?? []).includes(input.cadenceId) ? 1000 : 700;
  const score = Math.floor((400 * A + 300 * S + 200 * C + 100 * F) / 1000);
  return { A, S, C, F, score };
}
