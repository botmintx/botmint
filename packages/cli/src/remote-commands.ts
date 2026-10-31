import {
  checkOwner,
  defaultNonceFile,
  fetchManifest,
  manifestUrl,
  parseClaimCode,
  type VerifyResult,
  verifyClaimRemote,
} from "@botmint/mint";
import { type Address, getAddress } from "viem";
import { DeploymentError, loadDeployment, resolveContract, resolveGallery } from "./network.ts";

export type Printed = { exitCode: number; body: unknown };

export async function runVerifyClaim(opts: {
  code?: string;
  network?: string;
  rpc?: string;
  contract?: string;
  gallery?: string;
  nonceFile?: string;
  now?: string;
  cwd?: string;
}): Promise<Printed> {
  if (!opts.code) throw new DeploymentError("pass --code '<json>'");
  const deployment = loadDeployment(opts.network ?? "base-sepolia", opts.cwd);
  const gallery = resolveGallery(opts.gallery, deployment.galleryBaseUrl);
  const code = parseClaimCode(opts.code);
  if (!code) {
    return {
      exitCode: 1,
      body: { ok: false, reason: "malformed", manifestUrl: null } satisfies VerifyResult,
    };
  }
  const contract = resolveContract(opts.contract, deployment.contract);
  if (!contract) {
    return {
      exitCode: 1,
      body: {
        ok: false,
        reason: "malformed",
        manifestUrl: gallery ? manifestUrl(gallery, code.tokenId) : null,
        error: `contract address is null in deployments/${deployment.network}.json`,
      },
    };
  }
  const now = opts.now === undefined ? undefined : Number(opts.now);
  if (now !== undefined && !Number.isInteger(now))
    throw new DeploymentError("--now must be a unix second");
  const body = await verifyClaimRemote({
    code,
    contract,
    rpcUrl: opts.rpc ?? deployment.rpcUrl,
    galleryBaseUrl: gallery,
    nonceFile: opts.nonceFile ?? defaultNonceFile(),
    now,
  });
  return { exitCode: body.ok ? 0 : 1, body };
}

export async function runFetchManifest(opts: {
  tokenId: string;
  network?: string;
  gallery?: string;
  cwd?: string;
}): Promise<Printed> {
  const deployment = loadDeployment(opts.network ?? "base-sepolia", opts.cwd);
  const gallery = resolveGallery(opts.gallery, deployment.galleryBaseUrl);
  const tokenId = Number(opts.tokenId.replace("#", ""));
  if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > 10000) {
    throw new DeploymentError(`bad token id ${opts.tokenId}`);
  }
  if (!gallery) {
    return {
      exitCode: 1,
      body: {
        ok: false,
        reason: "manifest",
        manifestUrl: null,
        error: `gallery URL is null in deployments/${deployment.network}.json`,
      },
    };
  }
  try {
    return { exitCode: 0, body: await fetchManifest(gallery, tokenId) };
  } catch (error) {
    return {
      exitCode: 1,
      body: {
        ok: false,
        reason: "manifest",
        manifestUrl: manifestUrl(gallery, tokenId),
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function runCheckOwner(opts: {
  tokenId: string;
  address: string;
  network?: string;
  rpc?: string;
  contract?: string;
  cwd?: string;
}): Promise<Printed> {
  const deployment = loadDeployment(opts.network ?? "base-sepolia", opts.cwd);
  const tokenId = Number(opts.tokenId.replace("#", ""));
  if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > 10000) {
    throw new DeploymentError(`bad token id ${opts.tokenId}`);
  }
  let address: Address;
  try {
    address = getAddress(opts.address);
  } catch {
    throw new DeploymentError(`address is not an address: ${opts.address}`);
  }
  const contract = resolveContract(opts.contract, deployment.contract);
  if (!contract) {
    return {
      exitCode: 1,
      body: {
        ok: false,
        tokenId,
        address,
        holder: null,
        error: `contract address is null in deployments/${deployment.network}.json`,
      },
    };
  }
  const body = await checkOwner({
    rpcUrl: opts.rpc ?? deployment.rpcUrl,
    contract,
    tokenId,
    address,
  });
  return { exitCode: body.ok ? 0 : 1, body };
}
