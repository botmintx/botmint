/** Recipe engine version recorded on every token. Package versions can move; this does not, until a schema break. */
export const ENGINE_VERSION = "1.0.0";

export const REPO_URL = "https://github.com/botmintx/botmint";

export const LAYERS = [
  "archetype",
  "domain",
  "persona",
  "skill",
  "cadence",
  "connector",
  "autonomy",
  "output",
  "avatar",
] as const;

export type LayerId = (typeof LAYERS)[number];

export const SINGLE_PICK_LAYERS: LayerId[] = [
  "archetype",
  "domain",
  "persona",
  "cadence",
  "autonomy",
  "output",
  "avatar",
];

export const BYPASS_DNA = new Set<LayerId>(["output", "avatar"]);

export const POLICIES = {
  "read-only":
    "You only read and report. You never send, post, buy, pay, schedule, move or delete anything.",
  "draft-only":
    "You prepare drafts for your owner. You never send, post, buy, pay, schedule, move or delete anything yourself; your owner does that.",
  "approve-to-act":
    "Before any send, post, purchase, payment, schedule change, money movement or deletion, you show your owner exactly what you will do and wait for their explicit approval of that one action.",
  "bounded-autonomous":
    "You may act on routine, reversible tasks within the limits your owner set. You always ask first before anything that spends money, moves money, deletes data or messages someone new.",
} as const;

export const X_MONEY_POLICY =
  "For X Money, you ask for approval of every single payment, request or transfer, stating who, how much and what for; you never retry a refused payment, and routines only read balances and activity.";

export const X_MONEY_ROUTINE =
  "Only read balances and activity in this routine; never send, request or move money here.";

export const X_MONEY_ELIGIBILITY =
  "X Money is available to eligible customers in the United States.";

export const AUTONOMY_RANK: Record<string, number> = {
  "read-only": 0,
  "draft-only": 1,
  "approve-to-act": 2,
  "bounded-autonomous": 3,
};

export const LAYER_LABEL: Record<LayerId, string> = {
  archetype: "Archetype",
  domain: "Domain",
  persona: "Persona",
  skill: "Skill",
  cadence: "Cadence",
  connector: "Connector",
  autonomy: "Autonomy",
  output: "Output",
  avatar: "Avatar",
};

export function tokenStem(edition: number): string {
  return String(edition).padStart(4, "0");
}

export function tokenIdOf(edition: number): string {
  return `#${tokenStem(edition)}`;
}
