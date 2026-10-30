import { z } from "zod";

const kebab = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

const requiresSchema = z
  .object({
    connectors: z.array(kebab).optional(),
    domain: z.array(kebab).optional(),
  })
  .strict();

const capsSchema = z
  .object({
    autonomy: kebab.optional(),
  })
  .strict();

export const archetypeSchema = z
  .object({
    id: kebab,
    layer: z.literal("archetype"),
    label: z.string().min(1),
    title: z.string().min(1),
    weight: z.number().int().positive(),
    description: z.string().min(1),
    requires: requiresSchema.optional(),
    caps: capsSchema.optional(),
    affinity: z
      .object({
        skills: z.record(kebab, z.union([z.literal(1.5), z.literal(2)])).optional(),
        domains: z.record(kebab, z.enum(["good", "poor"])).optional(),
        cadences: z.array(kebab).optional(),
      })
      .strict()
      .optional(),
    partials: z
      .object({
        description: z.string().min(1),
        job: z.string().min(1),
        routinePrompt: z.string().min(1),
        memories: z.array(z.string().min(1)).min(1).max(3),
      })
      .strict(),
  })
  .strict();

export const domainSchema = z
  .object({
    id: kebab,
    layer: z.literal("domain"),
    label: z.string().min(1),
    weight: z.number().int().positive(),
    description: z.string().min(1),
    caps: capsSchema.optional(),
    adjectives: z.tuple([
      z.string().min(1),
      z.string().min(1),
      z.string().min(1),
      z.string().min(1),
    ]),
    partials: z
      .object({
        context: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const personaSchema = z
  .object({
    id: kebab,
    layer: z.literal("persona"),
    label: z.string().min(1),
    weight: z.number().int().positive(),
    description: z.string().min(1),
    nouns: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1), z.string().min(1)]),
    voice: z.string().min(1),
    partials: z
      .object({
        style: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const skillSchema = z
  .object({
    id: kebab,
    layer: z.literal("skill"),
    label: z.string().min(1),
    weight: z.number().int().positive(),
    description: z.string().min(1),
    needs: z
      .object({
        connectors: z.array(kebab).max(1),
      })
      .strict()
      .optional(),
    skillDescription: z.string().min(1),
    partials: z
      .object({
        body: z.string().min(1),
      })
      .strict(),
  })
  .strict();

const cadenceObject = z
  .object({
    id: kebab,
    layer: z.literal("cadence"),
    label: z.string().min(1),
    weight: z.number().int().positive(),
    description: z.string().min(1),
    schedule: z.string().min(1).optional(),
    trigger: z.literal(true).optional(),
  })
  .strict();

export const cadenceSchema = cadenceObject.refine(
  (value) => (value.schedule !== undefined) !== (value.trigger === true),
  { message: "cadence needs schedule xor trigger" },
);

export const connectorSchema = z
  .object({
    id: kebab,
    layer: z.literal("connector"),
    label: z.string().min(1),
    weight: z.number().int().positive(),
    description: z.string().min(1),
    marketplaceId: z.union([z.string().min(1), z.null()]),
    allowedOn: z
      .object({
        archetype: z.array(kebab).optional(),
      })
      .strict()
      .optional(),
    caps: capsSchema.optional(),
    trigger: z
      .object({
        source: z.string().min(1),
        event: z.string().min(1),
      })
      .strict()
      .optional(),
    aliases: z.array(z.string().min(1)),
    payment: z.literal(true).optional(),
  })
  .strict();

export const autonomySchema = z
  .object({
    id: kebab,
    layer: z.literal("autonomy"),
    label: z.string().min(1),
    weight: z.number().int().positive(),
    description: z.string().min(1),
    rank: z.number().int().min(0).max(3),
    partials: z
      .object({
        policy: z.string().min(1),
      })
      .strict(),
    asksBefore: z.array(z.string()),
  })
  .strict();

export const outputSchema = z
  .object({
    id: kebab,
    layer: z.literal("output"),
    label: z.string().min(1),
    weight: z.number().int().positive(),
    description: z.string().min(1),
    deliveryLine: z.string().min(1),
    partials: z
      .object({
        format: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const avatarSchema = z
  .object({
    id: kebab,
    layer: z.literal("avatar"),
    label: z.string().min(1),
    weight: z.number().int().positive(),
    description: z.string().min(1),
    palette: z.array(hex).min(2).max(5),
    motif: z.string().min(1),
    promptStyle: z.string().min(1),
  })
  .strict();

export const traitValueSchema = z
  .discriminatedUnion("layer", [
    archetypeSchema,
    domainSchema,
    personaSchema,
    skillSchema,
    cadenceObject,
    connectorSchema,
    autonomySchema,
    outputSchema,
    avatarSchema,
  ])
  .superRefine((value, ctx) => {
    if (value.layer !== "cadence") return;
    const exclusive = (value.schedule !== undefined) !== (value.trigger === true);
    if (!exclusive) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "cadence needs schedule xor trigger" });
    }
  });

export const packManifestSchema = z
  .object({
    id: kebab,
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    title: z.string().min(1),
    license: z.literal("MIT"),
    layers: z.array(
      z.enum([
        "archetype",
        "domain",
        "persona",
        "skill",
        "cadence",
        "connector",
        "autonomy",
        "output",
        "avatar",
      ]),
    ),
    names: z.string().min(1).optional(),
  })
  .strict();

const skillEntrySchema = z
  .object({
    name: kebab,
    description: z.string().min(1),
    body: z.string().min(1),
  })
  .strict();

const routineSchema = z
  .object({
    name: z.string().min(1),
    schedule: z.string().nullable(),
    trigger: z
      .object({
        source: z.string(),
        event: z.string(),
      })
      .strict()
      .nullable(),
    prompt: z.string().min(1),
    deliveryLine: z.string().min(1),
  })
  .strict();

export const recipeSchema = z
  .object({
    schemaVersion: z.literal(1),
    collection: z.string().min(1),
    tokenId: z.string().regex(/^#\d{4,5}$/),
    edition: z.number().int().positive(),
    dna: z.string().regex(/^[0-9a-f]{16}$/),
    engineVersion: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    job: z.string().min(1),
    policy: z.string().min(1),
    traits: z
      .object({
        archetype: kebab,
        domain: kebab,
        persona: kebab,
        skills: z.array(kebab).length(3),
        cadence: kebab,
        connectors: z.array(kebab).length(2),
        autonomy: kebab,
        output: kebab,
        avatar: kebab,
      })
      .strict(),
    attributes: z.array(
      z
        .object({
          trait_type: z.string().min(1),
          value: z.string().min(1),
        })
        .strict(),
    ),
    skills: z.array(skillEntrySchema).min(4),
    routines: z.array(routineSchema).length(1),
    memories: z.array(z.string().min(1)).min(3).max(5),
    plugins: z.array(
      z
        .object({
          connector: kebab,
          label: z.string().min(1),
          marketplaceId: z.union([z.string().min(1), z.null()]),
        })
        .strict(),
    ),
    gettingStarted: z.literal("getting-started"),
    visibility: z.literal("public"),
  })
  .strict();

export const txExportSchema = z
  .object({
    exportedAt: z.string().min(1),
    source: z.literal("x-money get_transactions"),
    transactions: z.array(
      z
        .object({
          id: z.string().min(1),
          createdAt: z.string().min(1),
          status: z.string().min(1),
          direction: z.enum(["in", "out"]),
          amountUsd: z.string().regex(/^\d+\.\d{2}$/),
          note: z.string().nullable(),
          payer: z
            .object({
              handle: z.string().nullable(),
              userId: z.string().nullable(),
            })
            .strict(),
        })
        .strict(),
    ),
  })
  .strict();

export const repliesSchema = z.array(
  z
    .object({
      handle: z.string().min(1),
      text: z.string(),
      postedAt: z.string().min(1),
    })
    .strict(),
);

export const claimsStateSchema = z
  .object({
    collection: z.string(),
    open: z.boolean(),
    priceUsd: z.string(),
    payee: z.string(),
    perHandleCap: z.number().int().positive(),
    matchingMode: z.enum(["note", "reply"]),
    lastExportAt: z.string().nullable(),
    lastSeq: z.number().int().nonnegative(),
    claimsRoot: z.string().nullable(),
    counts: z
      .object({
        claimed: z.number().int().nonnegative(),
        reserved: z.number().int().nonnegative(),
        held: z.number().int().nonnegative(),
        available: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export const lockFileSchema = z
  .object({
    collection: z.string(),
    count: z.number().int().positive(),
    tokenIds: z.string(),
    seed: z.string(),
    engine: z
      .object({
        version: z.string(),
        commit: z.string(),
      })
      .strict(),
    packs: z.record(z.string()),
    polish: z
      .object({
        provider: z.string(),
        model: z.string(),
        temperature: z.literal(0),
        promptFile: z.string(),
        promptHash: z.string(),
        allowlistHash: z.string(),
        completedAt: z.string(),
      })
      .strict(),
    tokenHashAlgo: z.string(),
    perToken: z.string(),
    rawProvenance: z.string(),
    provenance: z.string(),
    frozenAt: z.string(),
  })
  .strict();

export type Archetype = z.infer<typeof archetypeSchema>;
export type Domain = z.infer<typeof domainSchema>;
export type Persona = z.infer<typeof personaSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type Cadence = z.infer<typeof cadenceSchema>;
export type Connector = z.infer<typeof connectorSchema>;
export type Autonomy = z.infer<typeof autonomySchema>;
export type OutputStyle = z.infer<typeof outputSchema>;
export type AvatarStyle = z.infer<typeof avatarSchema>;
export type TraitValue = z.infer<typeof traitValueSchema>;
export type PackManifest = z.infer<typeof packManifestSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type TxExport = z.infer<typeof txExportSchema>;
export type ClaimsState = z.infer<typeof claimsStateSchema>;
export type LockFile = z.infer<typeof lockFileSchema>;
