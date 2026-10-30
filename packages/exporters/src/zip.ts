import { strToU8, type Zippable, zipSync } from "fflate";

const FIXED_MTIME = new Date("1980-01-01T00:00:00Z");

export function zipBundle(files: { path: string; contents: string }[]): Uint8Array {
  const entries: Zippable = {};
  for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    entries[file.path] = [strToU8(file.contents), { mtime: FIXED_MTIME, os: 0, level: 6 }];
  }
  return zipSync(entries);
}
