import { intro } from "@clack/prompts";
import { type Command, CommanderError } from "commander";
import { BotmintError, createProgram } from "./program.ts";

export async function run(argv: string[]): Promise<number> {
  const program = createProgram();
  try {
    await program.parseAsync(argv);
    return 0;
  } catch (error) {
    if (error instanceof BotmintError) {
      if (error.message) {
        if (!program.opts().json) console.error(error.message);
        else console.log(JSON.stringify({ error: error.message }));
      }
      return error.code;
    }
    if (error instanceof CommanderError) {
      return error.exitCode === 0 ? 0 : 2;
    }
    const message = error instanceof Error ? error.message : String(error);
    const json = argv.includes("--json");
    if (json) console.log(JSON.stringify({ error: message }));
    else console.error(message);
    if (message === "E_POLISH_CI" || message === "E_POLISH_ACK" || message.startsWith("E_PRIVATE"))
      return 3;
    return 1;
  }
}

export function maybeIntro(program: Command): void {
  const opts = program.optsWithGlobals?.() ?? program.opts();
  if (process.stdout.isTTY && !opts.json && !opts.quiet) intro("botmint");
}

export { BotmintError };
