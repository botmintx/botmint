import {
  canonicalFile,
  coherenceParts,
  loadPacks,
  POLICIES,
  REPO_URL,
  type Recipe,
  type Registry,
  recipeSchema,
  X_MONEY_ELIGIBILITY,
  X_MONEY_POLICY,
  X_MONEY_ROUTINE,
} from "@botmint/core";
import { isWeekdaySet, minimumGapMinutes, parseCron, withinWindow } from "./cron.ts";

export type LintIssue = {
  rule: string;
  severity: "error" | "warning";
  message: string;
};

const TOOL_DENY = [
  "send_money",
  "get_transactions",
  "request_money",
  "move_money",
  "get_card_details",
  "mcp",
  "tool",
  "api",
  "function call",
];

const AUTONOMY_DENY = [
  "without asking",
  "automatically send",
  "automatically post",
  "i will send",
  "auto-pay",
  "on your behalf without",
];

const FIRST_NAMES = [
  "james",
  "john",
  "robert",
  "michael",
  "william",
  "david",
  "richard",
  "joseph",
  "thomas",
  "charles",
  "mary",
  "patricia",
  "jennifer",
  "linda",
  "elizabeth",
];
const SURNAMES = [
  "smith",
  "johnson",
  "williams",
  "brown",
  "jones",
  "garcia",
  "miller",
  "davis",
  "rodriguez",
  "martinez",
];

function sentenceCount(text: string): number {
  return text
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function wholeWord(phrase: string): RegExp {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "i");
}

export function scanSecrets(text: string, profile: "recipe" | "integration"): LintIssue[] {
  const issues: LintIssue[] = [];
  const stripped = text
    .replace(/sha256:[0-9a-f]{64}/gi, "")
    .replace(/\bDNA [0-9a-f]{16}\b/g, "")
    .replace(new RegExp(REPO_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "")
    .replace(/https:\/\/raw\.githubusercontent\.com\/botmintx\/botmint\/[^\s)]+/g, "")
    .replaceAll("0123456789ABCDEFGHJKMNPQRSTVWXYZ", "");
  if (
    /xai-[A-Za-z0-9]|sk-[A-Za-z0-9]|ghp_[A-Za-z0-9]|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]+PRIVATE KEY-----/.test(
      stripped,
    )
  ) {
    issues.push({ rule: "no-secrets", severity: "error", message: "secret-like token" });
  }
  const base64ish = stripped.match(/\b[A-Za-z0-9+/]{32,}={0,2}\b/g) ?? [];
  // A repository path such as collections/genesis/claims/claims.jsonl is 32+
  // characters only because "/" is in the base64 alphabet. Real tokens have a
  // digit, an uppercase letter, "+" or "=". Hex runs are checked on their own.
  const tokenLike = base64ish.some((token) => /[A-Z0-9+=]/.test(token));
  if (tokenLike || /\b[0-9a-fA-F]{32,}\b/.test(stripped)) {
    issues.push({
      rule: "no-secrets",
      severity: "error",
      message: "long token or hash outside a hash field",
    });
  }
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(stripped)) {
    issues.push({ rule: "no-secrets", severity: "error", message: "email address" });
  }
  if (/https?:\/\/[^\s)]+/i.test(stripped)) {
    issues.push({
      rule: "no-secrets",
      severity: "error",
      message: "url outside the botmint repository",
    });
  }
  const handles = stripped.match(/@[A-Za-z0-9_]+/g) ?? [];
  for (const handle of handles) {
    if (
      profile === "integration" &&
      (handle.toLowerCase() === "@brandononchain" || handle.toLowerCase() === "@name")
    ) {
      continue;
    }
    issues.push({ rule: "no-secrets", severity: "error", message: `handle ${handle}` });
  }
  const namePattern = new RegExp(
    `\\b(${FIRST_NAMES.join("|")})\\s+(${SURNAMES.join("|")})\\b`,
    "i",
  );
  if (namePattern.test(stripped)) {
    issues.push({ rule: "no-secrets", severity: "warning", message: "possible person's name" });
  }
  return issues;
}

export function lintRecipe(
  recipe: Recipe,
  registry: Registry,
  extras?: { install?: string; card?: string },
): LintIssue[] {
  const issues: LintIssue[] = [];
  const parsed = recipeSchema.safeParse(recipe);
  if (!parsed.success) {
    issues.push({ rule: "schema", severity: "error", message: parsed.error.message });
    return issues;
  }

  const archetype = registry.archetypes.find((item) => item.id === recipe.traits.archetype);
  const domain = registry.domains.find((item) => item.id === recipe.traits.domain);
  const skills = recipe.traits.skills.map((id) => registry.skills.find((item) => item.id === id));
  const cadence = registry.cadences.find((item) => item.id === recipe.traits.cadence);
  const connectors = recipe.traits.connectors.map((id) =>
    registry.connectors.find((item) => item.id === id),
  );
  const autonomy = registry.autonomies.find((item) => item.id === recipe.traits.autonomy);
  if (
    !archetype ||
    !domain ||
    !cadence ||
    !autonomy ||
    skills.some((item) => !item) ||
    connectors.some((item) => !item)
  ) {
    issues.push({ rule: "schema", severity: "error", message: "trait id missing from packs" });
    return issues;
  }

  const hasMoney = recipe.traits.connectors.includes("x-money");
  const expectedPolicy = hasMoney
    ? `${autonomy.partials.policy} ${X_MONEY_POLICY}`
    : autonomy.partials.policy;
  if (recipe.policy !== expectedPolicy) {
    issues.push({
      rule: "autonomy-safety",
      severity: "error",
      message: "policy is not the locked text",
    });
  }
  if (Object.values(POLICIES).every((text) => text !== autonomy.partials.policy)) {
    issues.push({
      rule: "autonomy-safety",
      severity: "error",
      message: "pack policy drifted from the spec",
    });
  }
  if (autonomy.rank > 0) {
    const job = recipe.job.toLowerCase();
    for (const phrase of AUTONOMY_DENY) {
      if (job.includes(phrase)) {
        issues.push({
          rule: "autonomy-safety",
          severity: "error",
          message: `job contains "${phrase}"`,
        });
      }
    }
  }

  const count = sentenceCount(recipe.description);
  if (count < 2 || count > 4 || recipe.description.length > 600) {
    issues.push({
      rule: "description-size",
      severity: "error",
      message: `${count} sentences, ${recipe.description.length} chars`,
    });
  }

  const recipeBytes = Buffer.byteLength(canonicalFile(recipe));
  if (recipeBytes > 64 * 1024) {
    issues.push({ rule: "bundle-size", severity: "error", message: "recipe.json over 64KB" });
  }
  if (extras?.install && Buffer.byteLength(extras.install) > 48 * 1024) {
    issues.push({ rule: "bundle-size", severity: "error", message: "INSTALL.md over 48KB" });
  }

  const routine = recipe.routines[0]!;
  if (routine.schedule) {
    try {
      const cron = parseCron(routine.schedule);
      if (minimumGapMinutes(cron) < 5) {
        issues.push({
          rule: "routine-cron",
          severity: "error",
          message: "runs more often than every 5 minutes",
        });
      }
      const exempt = cadence.id === "monday-review" || cadence.id === "friday-wrap";
      if (!exempt && !isWeekdaySet(cron)) {
        issues.push({
          rule: "routine-cron",
          severity: "error",
          message: "cadence is not a weekday schedule",
        });
      }
      if (!withinWindow(cron)) {
        issues.push({ rule: "routine-cron", severity: "error", message: "outside 07:00-20:00" });
      }
    } catch (error) {
      issues.push({
        rule: "routine-cron",
        severity: "error",
        message: error instanceof Error ? error.message : "invalid cron",
      });
    }
  } else if (!routine.trigger) {
    issues.push({
      rule: "routine-cron",
      severity: "error",
      message: "routine has neither schedule nor trigger",
    });
  }
  if (!routine.deliveryLine.startsWith("Send me")) {
    issues.push({
      rule: "routine-prompt",
      severity: "error",
      message: "delivery line must start with Send me",
    });
  }
  if (routine.prompt.includes(routine.deliveryLine)) {
    issues.push({
      rule: "routine-prompt",
      severity: "error",
      message: "prompt contains the delivery line",
    });
  }
  const prompt = routine.prompt.toLowerCase();
  for (const phrase of TOOL_DENY) {
    if (wholeWord(phrase).test(prompt)) {
      issues.push({ rule: "routine-prompt", severity: "error", message: `prompt names ${phrase}` });
    }
  }
  for (const connector of registry.connectors) {
    for (const alias of connector.aliases) {
      if (
        wholeWord(alias).test(routine.prompt) &&
        !recipe.traits.connectors.includes(connector.id)
      ) {
        issues.push({
          rule: "routine-prompt",
          severity: "error",
          message: `prompt names ${alias}`,
        });
      }
    }
  }

  for (const skill of recipe.skills) {
    if (!/^[a-z0-9-]+$/.test(skill.name)) {
      issues.push({
        rule: "skill-frontmatter",
        severity: "error",
        message: `bad skill name ${skill.name}`,
      });
    }
    if (!skill.description.startsWith("When")) {
      issues.push({
        rule: "skill-frontmatter",
        severity: "error",
        message: `${skill.name} description must start with When`,
      });
    }
  }
  if (!recipe.skills.some((skill) => skill.name === recipe.gettingStarted)) {
    issues.push({
      rule: "skill-frontmatter",
      severity: "error",
      message: "gettingStarted skill is missing",
    });
  }

  if (hasMoney) {
    if (!recipe.policy.includes(X_MONEY_POLICY)) {
      issues.push({
        rule: "x-money-safety",
        severity: "error",
        message: "missing X Money policy sentence",
      });
    }
    if (!routine.prompt.includes(X_MONEY_ROUTINE)) {
      issues.push({
        rule: "x-money-safety",
        severity: "error",
        message: "missing read-only routine sentence",
      });
    }
    if (!recipe.description.includes(X_MONEY_ELIGIBILITY)) {
      issues.push({
        rule: "x-money-safety",
        severity: "error",
        message: "missing US eligibility sentence",
      });
    }
    if (autonomy.rank > 2) {
      issues.push({
        rule: "x-money-safety",
        severity: "error",
        message: "autonomy above approve-to-act",
      });
    }
  }

  const pluginIds = recipe.plugins.map((plugin) => plugin.connector);
  if (pluginIds.join(",") !== recipe.traits.connectors.join(",")) {
    issues.push({
      rule: "plugins-match",
      severity: "error",
      message: "plugins do not match connectors",
    });
  }

  const covered = new Set(skills.flatMap((skill) => skill?.needs?.connectors ?? []));
  for (const id of recipe.traits.connectors) {
    if (!covered.has(id))
      issues.push({
        rule: "coherence",
        severity: "error",
        message: `${id} is not covered by a skill`,
      });
  }
  const score = coherenceParts({
    archetype,
    domainId: domain.id,
    skills: skills.filter((skill): skill is NonNullable<typeof skill> => Boolean(skill)),
    cadenceId: cadence.id,
  }).score;
  if (score < 700) issues.push({ rule: "coherence", severity: "error", message: `score ${score}` });

  const blob = [
    recipe.description,
    recipe.job,
    recipe.policy,
    ...recipe.skills.flatMap((skill) => [skill.description, skill.body]),
    routine.prompt,
    routine.deliveryLine,
    ...recipe.memories,
    extras?.install ?? "",
    extras?.card ?? "",
  ].join("\n");
  issues.push(...scanSecrets(blob, "recipe"));
  return issues;
}

export function lintIntegrationText(filename: string, text: string): LintIssue[] {
  const issues = scanSecrets(text, "integration");
  const cron = /\*\/10 \* \* \* \*/.test(text) ? "*/10 * * * *" : null;
  if (filename.endsWith("routine.md")) {
    if (cron) {
      const parsed = parseCron(cron);
      if (minimumGapMinutes(parsed) < 5) {
        issues.push({
          rule: "routine-cron",
          severity: "error",
          message: "integration cron is too frequent",
        });
      }
    }
    for (const phrase of ["send_money", "request_money", "move_money", "get_card_details"]) {
      if (wholeWord(phrase).test(text)) {
        issues.push({
          rule: "routine-prompt",
          severity: "error",
          message: `integration routine names ${phrase}`,
        });
      }
    }
  }
  return issues;
}

export function lintPackRoot(root: string): LintIssue[] {
  const registry = loadPacks(root);
  const issues: LintIssue[] = [];
  for (const [layer, traits] of Object.entries(registry.byLayer)) {
    const weight = traits.reduce((sum, trait) => sum + trait.weight, 0);
    if (weight !== 100) {
      issues.push({
        rule: "schema",
        severity: "error",
        message: `${layer} weights sum to ${weight}`,
      });
    }
  }
  return issues;
}

export function errorsOf(issues: LintIssue[]): LintIssue[] {
  return issues.filter((issue) => issue.severity === "error");
}
