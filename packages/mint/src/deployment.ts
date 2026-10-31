import { type Address, getAddress } from "viem";

export type DeploymentFile = {
  network: string;
  chainId: number;
  contract: Address | null;
  rpcUrl: string;
  galleryBaseUrl: string | null;
};

export function parseDeployment(raw: unknown, expectedNetwork: string): DeploymentFile {
  if (!raw || typeof raw !== "object")
    throw new Error(`deployments/${expectedNetwork}.json is not an object`);
  const value = raw as Record<string, unknown>;
  if (value.network !== expectedNetwork) {
    throw new Error(`deployments/${expectedNetwork}.json has network ${String(value.network)}`);
  }
  if (typeof value.chainId !== "number" || !Number.isInteger(value.chainId)) {
    throw new Error(`deployments/${expectedNetwork}.json has no chainId`);
  }
  if (typeof value.rpcUrl !== "string" || value.rpcUrl.length === 0) {
    throw new Error(`deployments/${expectedNetwork}.json has no rpcUrl`);
  }
  return {
    network: expectedNetwork,
    chainId: value.chainId,
    contract: parseContract(value.contract, expectedNetwork),
    rpcUrl: value.rpcUrl,
    galleryBaseUrl: parseGallery(value.galleryBaseUrl, expectedNetwork),
  };
}

function parseContract(value: unknown, network: string): Address | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`deployments/${network}.json contract must be an address or null`);
  }
  try {
    return getAddress(value);
  } catch {
    throw new Error(`deployments/${network}.json contract is not an address`);
  }
}

function parseGallery(value: unknown, network: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`deployments/${network}.json galleryBaseUrl must be a URL or null`);
  }
  return value.replace(/\/+$/, "");
}

export function manifestUrl(galleryBaseUrl: string, tokenId: number): string {
  const stem = String(tokenId).padStart(4, "0");
  return `${galleryBaseUrl.replace(/\/+$/, "")}/bots/${stem}/loader.json`;
}

export function tokenIdArg(input: string): number | null {
  const edition = Number(input.replace("#", ""));
  if (!Number.isInteger(edition) || edition < 1 || edition > 10000) return null;
  return edition;
}
