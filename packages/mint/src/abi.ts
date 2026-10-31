import type { Abi } from "viem";
import abiJson from "../abi.json" with { type: "json" };

export const genesisAbi = abiJson as Abi;
export const genesisSupply = 10000;
