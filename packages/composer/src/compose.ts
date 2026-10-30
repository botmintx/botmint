import {
  type Drawn,
  ENGINE_VERSION,
  LAYER_LABEL,
  type Recipe,
  X_MONEY_ELIGIBILITY,
  X_MONEY_POLICY,
  X_MONEY_ROUTINE,
} from "@botmint/core";
import { humanList, renderTemplate } from "./render.ts";

export type ComposeContext = Record<string, unknown>;

export function composeContext(drawn: Drawn): ComposeContext {
  return {
    name: drawn.name,
    tokenId: drawn.tokenId,
    archetype: drawn.archetype,
    domain: drawn.domain,
    persona: drawn.persona,
    cadence: drawn.cadence,
    autonomy: drawn.autonomy,
    output: drawn.output,
    avatar: drawn.avatar,
    skills: drawn.skills,
    connectors: drawn.connectors,
    connectorLabels: humanList(drawn.connectors.map((item) => item.label)),
  };
}

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function routineWhen(drawn: Drawn): string {
  if (drawn.schedule) return `cron "${drawn.schedule}"`;
  const event = (drawn.trigger?.event ?? "").replace(/^new_/, "").replaceAll("_", " ");
  return `when a new ${event} arrives in ${drawn.trigger?.source}`;
}

function skillPointers(drawn: Drawn): string {
  return `Bring in ${humanList(drawn.skills.map((skill) => skill.label))} where they fit.`;
}

export function composeRecipe(drawn: Drawn, collection: string): Recipe {
  const context = composeContext(drawn);
  const hasMoney = drawn.connectors.some((item) => item.id === "x-money");
  let description = `${renderTemplate(drawn.archetype.partials.description, context)} ${renderTemplate(drawn.domain.partials.context, context)}`;
  if (hasMoney) description = `${description} ${X_MONEY_ELIGIBILITY}`;

  const job = [
    renderTemplate(drawn.archetype.partials.job, context),
    renderTemplate(drawn.domain.partials.context, context),
    renderTemplate(drawn.persona.partials.style, context),
    renderTemplate(drawn.output.partials.format, context),
  ].join("\n\n");

  const policy = hasMoney
    ? `${drawn.autonomy.partials.policy} ${X_MONEY_POLICY}`
    : drawn.autonomy.partials.policy;

  let prompt = `${renderTemplate(drawn.archetype.partials.routinePrompt, context)}\n\n${skillPointers(drawn)}`;
  if (hasMoney && !prompt.includes(X_MONEY_ROUTINE)) prompt = `${prompt} ${X_MONEY_ROUTINE}`;

  const archetypeMemories = drawn.archetype.partials.memories.map((line) =>
    renderTemplate(line, context),
  );
  const memories = [
    ...archetypeMemories,
    `The owner prefers results as: ${drawn.output.label}.`,
    `Autonomy level: ${drawn.autonomy.label}.`,
  ];

  const jobSentences = sentencesOf(job);
  const explain = jobSentences.slice(0, 2).join(" ");
  const gettingStarted = [
    `Hello. I am ${drawn.name}.`,
    explain,
    `Please connect ${humanList(drawn.connectors.map((item) => item.label))}, one plugin at a time. I will wait after each connection.`,
    "Please confirm your timezone so the routine uses your local time.",
    `The routine is named ${drawn.cadence.id}-${drawn.archetype.id}. It runs ${routineWhen(drawn)}. Please confirm that and I will create it.`,
    `This is the policy, and I will follow it exactly: ${policy}`,
    "I can run the routine once now if you want.",
  ].join("\n\n");

  const skills = [
    ...drawn.skills.map((skill) => ({
      name: skill.id,
      description: skill.skillDescription,
      body: renderTemplate(skill.partials.body, context),
    })),
    {
      name: "getting-started",
      description: "When the owner is setting this bot up for the first time or asks how to begin.",
      body: gettingStarted,
    },
  ];

  const attributes = [
    { trait_type: LAYER_LABEL.archetype, value: drawn.archetype.label },
    { trait_type: LAYER_LABEL.domain, value: drawn.domain.label },
    { trait_type: LAYER_LABEL.persona, value: drawn.persona.label },
    ...drawn.skills.map((skill) => ({ trait_type: LAYER_LABEL.skill, value: skill.label })),
    { trait_type: LAYER_LABEL.cadence, value: drawn.cadence.label },
    ...drawn.connectors.map((connector) => ({
      trait_type: LAYER_LABEL.connector,
      value: connector.label,
    })),
    { trait_type: LAYER_LABEL.autonomy, value: drawn.autonomy.label },
    { trait_type: LAYER_LABEL.output, value: drawn.output.label },
    { trait_type: LAYER_LABEL.avatar, value: drawn.avatar.label },
  ];

  return {
    schemaVersion: 1,
    collection,
    tokenId: drawn.tokenId,
    edition: drawn.edition,
    dna: drawn.dna,
    engineVersion: ENGINE_VERSION,
    name: drawn.name,
    description,
    job,
    policy,
    traits: {
      archetype: drawn.archetype.id,
      domain: drawn.domain.id,
      persona: drawn.persona.id,
      skills: drawn.skills.map((skill) => skill.id),
      cadence: drawn.cadence.id,
      connectors: drawn.connectors.map((connector) => connector.id),
      autonomy: drawn.autonomy.id,
      output: drawn.output.id,
      avatar: drawn.avatar.id,
    },
    attributes,
    skills,
    routines: [
      {
        name: `${drawn.cadence.id}-${drawn.archetype.id}`,
        schedule: drawn.schedule,
        trigger: drawn.trigger,
        prompt,
        deliveryLine: drawn.output.deliveryLine,
      },
    ],
    memories,
    plugins: drawn.connectors.map((connector) => ({
      connector: connector.id,
      label: connector.label,
      marketplaceId: connector.marketplaceId,
    })),
    gettingStarted: "getting-started",
    visibility: "public",
  };
}

export function archetypeMemoryCount(drawn: Drawn): number {
  return drawn.archetype.partials.memories.length;
}
