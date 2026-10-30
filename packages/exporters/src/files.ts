import { renderTemplate, routineWhen } from "@botmint/composer";
import { canonicalFile, type Drawn, REPO_URL, type Recipe } from "@botmint/core";
import { avatarPrompt, avatarSvg } from "./avatar.ts";

const INSTALL = `# Install {{name}} ({{collection}} {{tokenId}})

Paste everything below into a brand-new Grok Bot chat. The bot will set itself up and ask you before connecting anything.

---

You are being set up from a botmint recipe (botmint is an unofficial community project, not made by xAI or X). Do the steps below in order. Ask me before connecting any plugin or creating any routine. Don't skip the policy.

1. Your name is "{{name}}". Your description is: {{description}}
2. Your job: {{job}}
3. Your policy (follow it exactly): {{policy}}
4. Create these skills exactly as written, one per skill:
{{#each skills}}
   ### Skill: {{name}}
   \`\`\`markdown
   ---
   name: {{name}}
   description: {{description}}
   ---
   {{body}}
   \`\`\`
{{/each}}
5. Save these memories: {{#each memories}}
   - {{this}}{{/each}}
6. Ask me to connect these plugins one at a time: {{#each plugins}}{{label}}{{#unless @last}}, {{/unless}}{{/each}}.
7. Create this routine after I confirm my timezone:
   - Name: {{routines.0.name}}
   - When: {{routines.0.when}}            (cron in my timezone, or the trigger described in words)
   - Prompt: {{routines.0.prompt}}
     {{routines.0.deliveryLine}}
8. If you can set a picture, ask me to upload the avatar from this bundle (avatar.svg); otherwise skip this step.
9. Run the "{{gettingStarted}}" skill now to finish setup with me.

Recipe: {{tokenId}} · DNA {{dna}} · token hash {{tokenHash}} · ${REPO_URL}
`;

export function skillMarkdown(skill: { name: string; description: string; body: string }): string {
  return `---\nname: ${skill.name}\ndescription: ${JSON.stringify(skill.description)}\n---\n\n${skill.body.trim()}\n`;
}

export function installMarkdown(recipe: Recipe, drawn: Drawn, tokenHash: string): string {
  const text = renderTemplate(INSTALL, {
    ...recipe,
    routines: [{ ...recipe.routines[0], when: routineWhen(drawn) }],
    tokenHash: `sha256:${tokenHash}`,
  });
  return text.endsWith("\n") ? text : `${text}\n`;
}

export function cardMarkdown(
  recipe: Recipe,
  rarity: { score: number; rank: number; tier: string },
  tokenHash: string,
): string {
  const rows = recipe.attributes
    .map((attribute) => `| ${attribute.trait_type} | ${attribute.value} |`)
    .join("\n");
  return `# ${recipe.name}

${recipe.collection} ${recipe.tokenId} · ${rarity.tier} · rank ${rarity.rank} · score ${rarity.score}

${recipe.description}

| Trait | Value |
| --- | --- |
${rows}

DNA \`${recipe.dna}\`

Token hash \`sha256:${tokenHash}\`

Unofficial community project, not affiliated with xAI or X. MIT licensed.
`;
}

export function memoriesMarkdown(memories: string[]): string {
  return `${memories.map((item) => `- ${item}`).join("\n")}\n`;
}

export type BundleFile = { path: string; contents: string };

export function bundleFiles(
  recipe: Recipe,
  drawn: Drawn,
  rarity: { score: number; rank: number; tier: string },
  tokenHash: string,
): BundleFile[] {
  const files: BundleFile[] = [
    { path: "recipe.json", contents: canonicalFile(recipe) },
    { path: "routines.json", contents: canonicalFile(recipe.routines) },
    { path: "memories.md", contents: memoriesMarkdown(recipe.memories) },
    { path: "INSTALL.md", contents: installMarkdown(recipe, drawn, tokenHash) },
    { path: "README.md", contents: cardMarkdown(recipe, rarity, tokenHash) },
    { path: "avatar.svg", contents: avatarSvg(recipe.dna, drawn.avatar.palette) },
    {
      path: "avatar.prompt.txt",
      contents: avatarPrompt({
        promptStyle: drawn.avatar.promptStyle,
        persona: drawn.persona.label,
        title: drawn.archetype.title,
        motif: drawn.avatar.motif,
        palette: drawn.avatar.palette,
      }),
    },
  ];
  for (const skill of recipe.skills) {
    files.push({ path: `skills/${skill.name}/SKILL.md`, contents: skillMarkdown(skill) });
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return files;
}
