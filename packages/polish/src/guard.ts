import { canonicalCompact, type Recipe, type Registry, recipeSchema } from "@botmint/core";
import { errorsOf, lintRecipe } from "@botmint/lint";
import { z } from "zod";

export const responseSchema = z
  .object({
    fields: z.record(z.string(), z.string()),
  })
  .strict();

const ESCALATION = [
  "without asking",
  "automatically send",
  "automatically post",
  "i will send",
  "auto-pay",
  "on your behalf without",
];

export type PolishFieldSet = Record<string, string>;

export function fieldsOf(recipe: Recipe, archetypeMemoryCount: number): PolishFieldSet {
  const fields: PolishFieldSet = {
    description: recipe.description,
    job: recipe.job,
  };
  for (const skill of recipe.skills) fields[`skills.${skill.name}.body`] = skill.body;
  fields["routines.0.prompt"] = recipe.routines[0]!.prompt;
  for (let index = 0; index < archetypeMemoryCount; index++) {
    fields[`memories.${index}`] = recipe.memories[index]!;
  }
  return fields;
}

export function applyFields(recipe: Recipe, fields: PolishFieldSet): Recipe {
  const next = structuredClone(recipe);
  if (fields.description !== undefined) next.description = fields.description;
  if (fields.job !== undefined) next.job = fields.job;
  for (const skill of next.skills) {
    const key = `skills.${skill.name}.body`;
    if (fields[key] !== undefined) skill.body = fields[key]!;
  }
  if (fields["routines.0.prompt"] !== undefined)
    next.routines[0]!.prompt = fields["routines.0.prompt"]!;
  for (const [key, value] of Object.entries(fields)) {
    const match = /^memories\.(\d+)$/.exec(key);
    if (match) next.memories[Number(match[1])] = value;
  }
  return next;
}

function blanked(recipe: Recipe, keys: string[]): string {
  const copy = structuredClone(recipe);
  for (const key of keys) {
    if (key === "description") copy.description = "";
    else if (key === "job") copy.job = "";
    else if (key === "routines.0.prompt") copy.routines[0]!.prompt = "";
    else if (key.startsWith("skills.")) {
      const name = key.slice("skills.".length, -".body".length);
      const skill = copy.skills.find((item) => item.name === name);
      if (skill) skill.body = "";
    } else if (key.startsWith("memories.")) {
      copy.memories[Number(key.slice("memories.".length))] = "";
    }
  }
  return canonicalCompact(copy);
}

function extras(text: string): {
  urls: string[];
  emails: string[];
  handles: string[];
  money: string[];
  percents: string[];
} {
  return {
    urls: text.match(/https?:\/\/[^\s)]+/gi) ?? [],
    emails: text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [],
    handles: text.match(/@[A-Za-z0-9_]+/g) ?? [],
    money: text.match(/\$\d+(?:\.\d+)?/g) ?? [],
    percents: text.match(/\d+(?:\.\d+)?%/g) ?? [],
  };
}

function added(before: string[], after: string[]): string[] {
  const counts = new Map<string, number>();
  for (const item of before) counts.set(item, (counts.get(item) ?? 0) + 1);
  const novel: string[] = [];
  for (const item of after) {
    const left = counts.get(item) ?? 0;
    if (left > 0) counts.set(item, left - 1);
    else novel.push(item);
  }
  return novel;
}

export function guardrailReasons(input: {
  raw: Recipe;
  polished: Recipe;
  fields: PolishFieldSet;
  responseKeys: string[];
  registry: Registry;
  archetypeMemoryCount: number;
}): string[] {
  const reasons: string[] = [];
  const expected = Object.keys(input.fields).sort();
  const actual = [...input.responseKeys].sort();
  if (expected.join("\0") !== actual.join("\0")) reasons.push("response keys differ");
  if (blanked(input.raw, expected) !== blanked(input.polished, expected)) {
    reasons.push("structural diff outside the allowlist");
  }
  const parsed = recipeSchema.safeParse(input.polished);
  if (!parsed.success) reasons.push("recipe schema failed");
  if (parsed.success) {
    const issues = errorsOf(lintRecipe(input.polished, input.registry));
    for (const issue of issues) reasons.push(`${issue.rule}: ${issue.message}`);
  }
  for (const key of expected) {
    const before = input.fields[key] ?? "";
    const after =
      key === "description"
        ? input.polished.description
        : key === "job"
          ? input.polished.job
          : key === "routines.0.prompt"
            ? input.polished.routines[0]!.prompt
            : key.startsWith("memories.")
              ? input.polished.memories[Number(key.slice("memories.".length))]!
              : (input.polished.skills.find((skill) => key === `skills.${skill.name}.body`)?.body ??
                "");
    const ratio = before.length === 0 ? 1 : after.length / before.length;
    if (ratio < 0.7 || ratio > 1.3) reasons.push(`${key} length ratio ${ratio.toFixed(2)}`);
    const rawBits = extras(before);
    const newBits = extras(after);
    if (added(rawBits.urls, newBits.urls).length) reasons.push(`${key} added a url`);
    if (added(rawBits.emails, newBits.emails).length) reasons.push(`${key} added an email`);
    if (added(rawBits.handles, newBits.handles).length) reasons.push(`${key} added a handle`);
    if (added(rawBits.money, newBits.money).length) reasons.push(`${key} added a price`);
    if (added(rawBits.percents, newBits.percents).length) reasons.push(`${key} added a percentage`);
    const lower = after.toLowerCase();
    for (const phrase of ESCALATION) {
      if (lower.includes(phrase)) reasons.push(`${key} escalates autonomy`);
    }
  }
  const owned = new Set(input.raw.traits.connectors);
  let text = Object.values(fieldsOf(input.polished, input.archetypeMemoryCount)).join("\n");
  const ownedNames = input.registry.connectors
    .filter((connector) => owned.has(connector.id))
    .flatMap((connector) => [connector.label, ...connector.aliases])
    .sort((a, b) => b.length - a.length);
  for (const name of ownedNames) {
    text = text.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  }
  for (const connector of input.registry.connectors) {
    if (owned.has(connector.id)) continue;
    const names = [connector.label, ...connector.aliases];
    for (const name of names) {
      const pattern = new RegExp(
        `(?<![A-Za-z0-9])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9])`,
        "i",
      );
      if (pattern.test(text)) reasons.push(`mentions connector ${name}`);
    }
  }
  if (input.raw.traits.connectors.includes("x-money")) {
    if (
      !input.polished.policy.includes("For X Money, you ask for approval of every single payment")
    ) {
      reasons.push("lost the X Money policy sentence");
    }
    if (
      !input.polished.routines[0]!.prompt.includes(
        "Only read balances and activity in this routine",
      )
    ) {
      reasons.push("lost the X Money routine sentence");
    }
  }
  return reasons;
}
