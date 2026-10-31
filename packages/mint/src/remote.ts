import { type Address, createPublicClient, getAddress, type Hex, http } from "viem";
import { genesisAbi } from "./abi.ts";
import { type ClaimCode, type ClaimFailure, verifyClaim } from "./claim.ts";
import { manifestUrl } from "./deployment.ts";
import { FileNonceStore } from "./nonces.ts";

export type VerifyResult = {
  ok: boolean;
  reason: ClaimFailure | "rpc" | null;
  manifestUrl: string | null;
  error?: string;
};

export async function verifyClaimRemote(input: {
  code: ClaimCode;
  contract: Address;
  rpcUrl: string;
  galleryBaseUrl: string | null;
  nonceFile: string;
  now?: number;
}): Promise<VerifyResult> {
  const url = input.galleryBaseUrl ? manifestUrl(input.galleryBaseUrl, input.code.tokenId) : null;
  const client = createPublicClient({ transport: http(input.rpcUrl) });
  try {
    const result = await verifyClaim({
      code: input.code,
      contract: input.contract,
      client,
      abi: genesisAbi,
      nonces: new FileNonceStore(input.nonceFile),
      now: input.now,
    });
    if (result.ok) return { ok: true, reason: null, manifestUrl: url };
    return { ok: false, reason: result.reason, manifestUrl: url };
  } catch (error) {
    return {
      ok: false,
      reason: "rpc",
      manifestUrl: url,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function fetchManifest(galleryBaseUrl: string, tokenId: number): Promise<unknown> {
  const url = manifestUrl(galleryBaseUrl, tokenId);
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`manifest ${response.status} for ${url}`);
  return response.json();
}

export type OwnerResult = {
  ok: boolean;
  tokenId: number;
  address: Address;
  holder: Address | null;
  error?: string;
};

export async function checkOwner(input: {
  rpcUrl: string;
  contract: Address;
  tokenId: number;
  address: Address;
}): Promise<OwnerResult> {
  const address = getAddress(input.address);
  const client = createPublicClient({ transport: http(input.rpcUrl) });
  try {
    const holder = getAddress(
      (await client.readContract({
        address: input.contract,
        abi: genesisAbi,
        functionName: "ownerOf",
        args: [BigInt(input.tokenId)],
      })) as Address,
    );
    return { ok: holder === address, tokenId: input.tokenId, address, holder };
  } catch (error) {
    return {
      ok: false,
      tokenId: input.tokenId,
      address,
      holder: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function parseClaimCode(raw: string): ClaimCode | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const code = value as Record<string, unknown>;
  const tokenId = typeof code.tokenId === "number" ? code.tokenId : Number(code.tokenId);
  if (!Number.isInteger(tokenId)) return null;
  if (
    typeof code.owner !== "string" ||
    typeof code.nonce !== "string" ||
    typeof code.signature !== "string"
  ) {
    return null;
  }
  const expiry = typeof code.expiry === "number" ? code.expiry : Number(code.expiry);
  if (!Number.isInteger(expiry)) return null;
  if (!isHex(code.nonce, 32) || !isHex(code.signature, 65)) return null;
  try {
    return {
      tokenId,
      owner: getAddress(code.owner),
      nonce: code.nonce as Hex,
      expiry,
      signature: code.signature as Hex,
    };
  } catch {
    return null;
  }
}

function isHex(value: string, bytes: number): boolean {
  return new RegExp(`^0x[0-9a-fA-F]{${bytes * 2}}$`).test(value);
}
