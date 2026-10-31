import { type ClaimCode, type ClaimFailure, type NonceStore, verifyClaim } from "@botmint/mint";
import type { LoaderManifest } from "./manifest.ts";

type Address = `0x${string}`;

type Reader = {
  getChainId(): Promise<number>;
  readContract(args: any): Promise<unknown>;
};

export type LoadedBot = {
  ok: true;
  status: "loaded";
  tokenId: number;
  owner: Address;
  name: string;
  description: string;
  avatar: string;
  skills: LoaderManifest["skills"];
  memory: string[];
  instructions: string;
};

export type LoadRefusal = {
  ok: false;
  status: "refused";
  reason: ClaimFailure | "manifest";
};

export async function loadClaimedBot(input: {
  code: ClaimCode;
  manifest: LoaderManifest;
  contract: Address;
  client: Reader;
  abi: readonly unknown[];
  nonces: NonceStore;
  now?: number;
}): Promise<LoadedBot | LoadRefusal> {
  if (input.manifest.edition !== input.code.tokenId) {
    return { ok: false, status: "refused", reason: "manifest" };
  }
  const verified = await verifyClaim({
    code: input.code,
    contract: input.contract,
    client: input.client,
    abi: input.abi,
    nonces: input.nonces,
    now: input.now,
  });
  if (!verified.ok) return { ok: false, status: "refused", reason: verified.reason };
  return {
    ok: true,
    status: "loaded",
    tokenId: input.code.tokenId,
    owner: verified.owner,
    name: input.manifest.name,
    description: input.manifest.description,
    avatar: input.manifest.pfp.path,
    skills: input.manifest.skills,
    memory: input.manifest.memory,
    instructions: input.manifest.instructions,
  };
}

export async function recheckOwnership(input: {
  client: Reader;
  abi: readonly unknown[];
  contract: Address;
  tokenId: number;
  loadedOwner: Address;
}): Promise<
  | { active: true; status: "claimed"; holder: Address }
  | { active: false; status: "dormant"; holder: Address }
> {
  const holder = (await input.client.readContract({
    address: input.contract,
    abi: input.abi,
    functionName: "ownerOf",
    args: [BigInt(input.tokenId)],
  })) as Address;
  if (holder.toLowerCase() !== input.loadedOwner.toLowerCase()) {
    return { active: false, status: "dormant", holder };
  }
  return { active: true, status: "claimed", holder };
}
