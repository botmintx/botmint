import { run } from "./main.ts";

const code = await run(process.argv);
process.exit(code);
