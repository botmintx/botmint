import { type ExecFileSyncOptions, execFileSync } from "node:child_process";

/**
 * Spawn pnpm from a test. On Windows, Node's execFile does not apply PATHEXT,
 * so `pnpm` is ENOENT and `pnpm.cmd` has to run through a shell.
 */
export function execPnpm(args: string[], options: ExecFileSyncOptions = {}) {
  if (process.platform === "win32") {
    return execFileSync("pnpm.cmd", args, { windowsHide: true, ...options, shell: true });
  }
  return execFileSync("pnpm", args, options);
}
