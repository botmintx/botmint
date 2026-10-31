import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type DeploymentFile, parseDeployment } from "@botmint/mint";
import { type Address, getAddress } from "viem";

export class DeploymentError extends Error {
  code: number;
  constructor(message: string, code = 2) {
    super(message);
    this.name = "DeploymentError";
    this.code = code;
  }
}

export function cliVersion(): string {
  const file = fileURLToPath(new URL("../package.json", import.meta.url));
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { version: string };
  return parsed.version;
}

export function findDeploymentsDir(start = process.cwd()): string {
  let dir = path.resolve(start);
  for (let i = 0; i < 8; i += 1) {
    const candidate = path.join(dir, "deployments");
    if (existsSync(path.join(candidate, "base-sepolia.json"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const relative of [
    "../deployments",
    "../../deployments",
    "../../../deployments",
    "../../../../deployments",
  ]) {
    const candidate = path.resolve(here, relative);
    if (existsSync(path.join(candidate, "base-sepolia.json"))) return candidate;
  }
  throw new DeploymentError(
    "could not find deployments/. The botmint package is missing its network files.",
    1,
  );
}

export function loadDeployment(network: string, start = process.cwd()): DeploymentFile {
  if (!/^[a-z0-9-]+$/.test(network)) throw new DeploymentError(`unknown network ${network}`);
  const file = path.join(findDeploymentsDir(start), `${network}.json`);
  if (!existsSync(file)) throw new DeploymentError(`unknown network ${network}`);
  try {
    return parseDeployment(JSON.parse(readFileSync(file, "utf8")), network);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DeploymentError(message, 1);
  }
}

export function resolveContract(
  value: string | undefined,
  fallback: Address | null,
): Address | null {
  if (value === undefined) return fallback;
  try {
    return getAddress(value);
  } catch {
    throw new DeploymentError(`contract is not an address: ${value}`);
  }
}

export function resolveGallery(value: string | undefined, fallback: string | null): string | null {
  if (value === undefined) return fallback;
  if (value === "null" || value.length === 0) return null;
  return value.replace(/\/+$/, "");
}
