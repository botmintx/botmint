import { type Address, getAddress, type PublicClient, parseAbiItem } from "viem";

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
);

export type HolderRow = {
  tokenId: string;
  holder: Address;
  status: "awaiting-claim" | "claimed" | "dormant";
};

export async function indexTransfers(
  client: Pick<PublicClient, "getLogs">,
  contract: Address,
  fromBlock = 0n,
): Promise<{ tokenId: string; holder: Address }[]> {
  const logs = await client.getLogs({
    address: contract,
    event: transferEvent,
    fromBlock,
    toBlock: "latest",
  });
  const holders = new Map<string, Address>();
  for (const log of logs) {
    const tokenId = (log.args as { tokenId?: bigint }).tokenId;
    const to = (log.args as { to?: Address }).to;
    if (tokenId === undefined || !to || to === "0x0000000000000000000000000000000000000000")
      continue;
    holders.set(tokenId.toString(), getAddress(to));
  }
  return [...holders.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([tokenId, holder]) => ({ tokenId, holder }));
}

export function claimStatus(
  holder: Address | null,
  claimedBy: Address | null,
): HolderRow["status"] | "unminted" {
  if (!holder) return "unminted";
  if (!claimedBy) return "awaiting-claim";
  if (getAddress(claimedBy) === getAddress(holder)) return "claimed";
  return "dormant";
}
