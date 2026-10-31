export type LoaderManifest = {
  collection: string;
  tokenId: string;
  edition: number;
  stem: string;
  manifestPath: string;
  name: string;
  description: string;
  job: string;
  policy: string;
  traits: {
    archetype: { id: string; label: string };
    domain: { id: string; label: string };
    persona: { id: string; label: string };
    cadence: { id: string; label: string };
    autonomy: { id: string; label: string };
    output: { id: string; label: string };
    avatar: { id: string; label: string };
    connectors: { id: string; label: string }[];
    skills: { id: string; label: string }[];
  };
  instructions: string;
  instructionsSource: "raw" | "polished";
  skills: { name: string; description: string; body: string }[];
  memory: string[];
  pfp: { path: string; mediaType: "image/svg+xml" };
  routine: { name: string; when: string; prompt: string };
};

export type ManifestInput = {
  collection: string;
  edition: number;
  tokenId: string;
  name: string;
  description: string;
  job: string;
  policy: string;
  traits: LoaderManifest["traits"];
  skills: LoaderManifest["skills"];
  memory: string[];
  routine: LoaderManifest["routine"];
  pfpPath: string;
  instructionsSource?: "raw" | "polished";
};

function stemOf(edition: number): string {
  return String(edition).padStart(4, "0");
}

export function loaderManifest(input: ManifestInput): LoaderManifest {
  const stem = stemOf(input.edition);
  const source = input.instructionsSource ?? "raw";
  const skillText = input.skills.map((skill) => `${skill.name}\n${skill.body}`).join("\n\n");
  const memoryText = input.memory.map((fact) => `- ${fact}`).join("\n");
  const instructions = [
    input.description,
    input.job,
    input.policy,
    skillText,
    memoryText,
    input.routine.prompt,
  ].join("\n\n");
  return {
    collection: input.collection,
    tokenId: input.tokenId,
    edition: input.edition,
    stem,
    manifestPath: `bots/${stem}/loader.json`,
    name: input.name,
    description: input.description,
    job: input.job,
    policy: input.policy,
    traits: input.traits,
    instructions,
    instructionsSource: source,
    skills: input.skills,
    memory: input.memory,
    pfp: { path: input.pfpPath, mediaType: "image/svg+xml" },
    routine: input.routine,
  };
}
