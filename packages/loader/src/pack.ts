import {
  GETTING_STARTED_BODY,
  GETTING_STARTED_DESCRIPTION,
  GETTING_STARTED_NAME,
  LOADER_DESCRIPTION,
  LOADER_MEMORIES,
  LOADER_NAME,
  LOADER_ROUTINE_NAME,
  LOADER_ROUTINE_PROMPT,
  LOADER_ROUTINE_WHEN,
  LOADER_SKILL_BODY,
  LOADER_SKILL_DESCRIPTION,
  LOADER_SKILL_NAME,
} from "./text.ts";

export type LoaderPack = {
  profile: {
    name: string;
    description: string;
    avatar: string;
  };
  skills: { name: string; description: string; body: string }[];
  memory: string[];
  routines: { name: string; when: string; prompt: string }[];
};

/** One universal loader template. Not a per-bot Grok Bot template. */
export function loaderPack(): LoaderPack {
  return {
    profile: {
      name: LOADER_NAME,
      description: LOADER_DESCRIPTION,
      avatar:
        "Use the Botmint mark until a token loads. Then set the avatar from the manifest portrait.",
    },
    skills: [
      {
        name: LOADER_SKILL_NAME,
        description: LOADER_SKILL_DESCRIPTION,
        body: LOADER_SKILL_BODY,
      },
      {
        name: GETTING_STARTED_NAME,
        description: GETTING_STARTED_DESCRIPTION,
        body: GETTING_STARTED_BODY,
      },
    ],
    memory: [...LOADER_MEMORIES],
    routines: [
      {
        name: LOADER_ROUTINE_NAME,
        when: LOADER_ROUTINE_WHEN,
        prompt: LOADER_ROUTINE_PROMPT,
      },
    ],
  };
}
