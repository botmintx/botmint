#!/usr/bin/env node
import { run } from "../src/main.ts";

const code = await run(process.argv);
process.exit(code);
