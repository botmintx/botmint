import { type Address, getAddress, type Hex, verifyTypedData } from "viem";
import domainFile from "../claim-domain.json" with { type: "json" };

export const CLAIM_DOMAIN_NAME = domainFile.name;
export const CLAIM_DOMAIN_VERSION = domainFile.version;

export type ClaimCode = {
  tokenId: number;
  owner: Address;
  nonce: Hex;
  expiry: number;
  signature: Hex;
};

export type ClaimFailure = "expired" | "replayed" | "signer" | "owner" | "malformed";

export type NonceStore = {
  has(nonce: string): boolean;
  add(nonce: string): void;
};

export class MemoryNonceStore implements NonceStore {
  private readonly seen = new Set<string>();
  has(nonce: string): boolean {
    return this.seen.has(nonce.toLowerCase());
  }
  add(nonce: string): void {
    this.seen.add(nonce.toLowerCase());
  }
}

export const CLAIM_TYPES = {
  Claim: [
    { name: "tokenId", type: "uint256" },
    { name: "owner", type: "address" },
    { name: "nonce", type: "bytes32" },
    { name: "expiry", type: "uint256" },
  ],
} as const;

export function claimTypes() {
  return CLAIM_TYPES;
}

export function claimDomain(chainId: number, verifyingContract: Address) {
  return {
    name: CLAIM_DOMAIN_NAME,
    version: CLAIM_DOMAIN_VERSION,
    chainId,
    verifyingContract,
  } as const;
}

export function claimMessage(code: Pick<ClaimCode, "tokenId" | "owner" | "nonce" | "expiry">) {
  return {
    tokenId: BigInt(code.tokenId),
    owner: getAddress(code.owner),
    nonce: code.nonce,
    expiry: BigInt(code.expiry),
  };
}

type Reader = {
  getChainId(): Promise<number>;
  readContract(args: any): Promise<unknown>;
};

export async function verifyClaim(input: {
  code: ClaimCode;
  contract: Address;
  client: Reader;
  abi: readonly unknown[];
  nonces: NonceStore;
  now?: number;
  commit?: boolean;
}): Promise<{ ok: true; owner: Address } | { ok: false; reason: ClaimFailure }> {
  const code = input.code;
  if (!Number.isInteger(code.tokenId) || code.tokenId < 1 || code.tokenId > 10000) {
    return { ok: false, reason: "malformed" };
  }
  if (!code.signature || !code.nonce || !code.owner) return { ok: false, reason: "malformed" };
  const now = input.now ?? Math.floor(Date.now() / 1000);
  if (now >= code.expiry) return { ok: false, reason: "expired" };
  let owner: Address;
  try {
    owner = getAddress(code.owner);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const chainId = await input.client.getChainId();
  const valid = await verifyTypedData({
    address: owner,
    domain: claimDomain(chainId, input.contract),
    types: claimTypes(),
    primaryType: "Claim",
    message: claimMessage({ ...code, owner }),
    signature: code.signature,
  });
  if (!valid) return { ok: false, reason: "signer" };
  const holder = (await input.client.readContract({
    address: input.contract,
    abi: input.abi,
    functionName: "ownerOf",
    args: [BigInt(code.tokenId)],
  })) as Address;
  if (getAddress(holder) !== owner) return { ok: false, reason: "owner" };
  if (input.nonces.has(code.nonce)) return { ok: false, reason: "replayed" };
  if (input.commit !== false) input.nonces.add(code.nonce);
  return { ok: true, owner };
}
