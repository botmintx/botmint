import {
  decodeAbiParameters,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  type Hex,
  keccak256,
} from "viem";

export const EAS_ADDRESS = "0x4200000000000000000000000000000000000021" as const;
export const SCHEMA_REGISTRY = "0x4200000000000000000000000000000000000020" as const;
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
export const ZERO_BYTES32 = `0x${"0".repeat(64)}` as Hex;

export const GENESIS_SCHEMA =
  "string collection, uint32 count, bytes32 provenanceHash, string seed, bytes20 gitCommit, string engineVersion, bytes32 lockFileHash";

export const CLAIM_SCHEMA =
  "string collection, uint32 tokenId, string xHandle, bytes32 nonceHash, bytes32 paymentRef";

export const CHAINS = {
  base: { chainId: 8453, rpc: "https://mainnet.base.org" },
  "base-sepolia": { chainId: 84532, rpc: "https://sepolia.base.org" },
} as const;

export type ChainName = keyof typeof CHAINS;

export function schemaUid(schema: string, revocable: boolean): Hex {
  return keccak256(encodePacked(["string", "address", "bool"], [schema, ZERO_ADDRESS, revocable]));
}

const registerAbi = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "schema", type: "string" },
      { name: "resolver", type: "address" },
      { name: "revocable", type: "bool" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

const attestationData = [
  { name: "recipient", type: "address" },
  { name: "expirationTime", type: "uint64" },
  { name: "revocable", type: "bool" },
  { name: "refUID", type: "bytes32" },
  { name: "data", type: "bytes" },
  { name: "value", type: "uint256" },
] as const;

const attestAbi = [
  {
    type: "function",
    name: "attest",
    stateMutability: "payable",
    inputs: [
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "schema", type: "bytes32" },
          { name: "data", type: "tuple", components: attestationData },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

const multiAttestAbi = [
  {
    type: "function",
    name: "multiAttest",
    stateMutability: "payable",
    inputs: [
      {
        name: "multiRequests",
        type: "tuple[]",
        components: [
          { name: "schema", type: "bytes32" },
          { name: "data", type: "tuple[]", components: attestationData },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32[]" }],
  },
] as const;

const revokeAbi = [
  {
    type: "function",
    name: "revoke",
    stateMutability: "payable",
    inputs: [
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "schema", type: "bytes32" },
          {
            name: "data",
            type: "tuple",
            components: [
              { name: "uid", type: "bytes32" },
              { name: "value", type: "uint256" },
            ],
          },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

export const getAttestationAbi = [
  {
    type: "function",
    name: "getAttestation",
    stateMutability: "view",
    inputs: [{ name: "uid", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "uid", type: "bytes32" },
          { name: "schema", type: "bytes32" },
          { name: "time", type: "uint64" },
          { name: "expirationTime", type: "uint64" },
          { name: "revocationTime", type: "uint64" },
          { name: "refUID", type: "bytes32" },
          { name: "recipient", type: "address" },
          { name: "attester", type: "address" },
          { name: "revocable", type: "bool" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
  },
] as const;

export type UnsignedTx = { chainId: number; to: Hex; data: Hex; value: "0" };

function requestData(_schema: Hex, data: Hex, revocable: boolean) {
  return {
    recipient: ZERO_ADDRESS,
    expirationTime: 0n,
    revocable,
    refUID: ZERO_BYTES32,
    data,
    value: 0n,
  };
}

export function genesisData(input: {
  collection: string;
  count: number;
  provenanceHash: Hex;
  seed: string;
  gitCommit: Hex;
  engineVersion: string;
  lockFileHash: Hex;
}): Hex {
  return encodeAbiParameters(
    [
      { type: "string" },
      { type: "uint32" },
      { type: "bytes32" },
      { type: "string" },
      { type: "bytes20" },
      { type: "string" },
      { type: "bytes32" },
    ],
    [
      input.collection,
      input.count,
      input.provenanceHash,
      input.seed,
      input.gitCommit,
      input.engineVersion,
      input.lockFileHash,
    ],
  );
}

export function decodeGenesisData(data: Hex) {
  const [collection, count, provenanceHash, seed, gitCommit, engineVersion, lockFileHash] =
    decodeAbiParameters(
      [
        { type: "string" },
        { type: "uint32" },
        { type: "bytes32" },
        { type: "string" },
        { type: "bytes20" },
        { type: "string" },
        { type: "bytes32" },
      ],
      data,
    );
  return { collection, count, provenanceHash, seed, gitCommit, engineVersion, lockFileHash };
}

export function claimData(input: {
  collection: string;
  tokenId: number;
  xHandle: string;
  nonceHash: Hex;
  paymentRef: Hex;
}): Hex {
  return encodeAbiParameters(
    [
      { type: "string" },
      { type: "uint32" },
      { type: "string" },
      { type: "bytes32" },
      { type: "bytes32" },
    ],
    [input.collection, input.tokenId, input.xHandle, input.nonceHash, input.paymentRef],
  );
}

export function registerTx(chain: ChainName, schema: string, revocable: boolean): UnsignedTx {
  return {
    chainId: CHAINS[chain].chainId,
    to: SCHEMA_REGISTRY,
    data: encodeFunctionData({
      abi: registerAbi,
      functionName: "register",
      args: [schema, ZERO_ADDRESS, revocable],
    }),
    value: "0",
  };
}

export function attestTx(chain: ChainName, schema: Hex, data: Hex, revocable: boolean): UnsignedTx {
  return {
    chainId: CHAINS[chain].chainId,
    to: EAS_ADDRESS,
    data: encodeFunctionData({
      abi: attestAbi,
      functionName: "attest",
      args: [{ schema, data: requestData(schema, data, revocable) }],
    }),
    value: "0",
  };
}

export function multiAttestTx(
  chain: ChainName,
  schema: Hex,
  datas: Hex[],
  revocable: boolean,
): UnsignedTx {
  return {
    chainId: CHAINS[chain].chainId,
    to: EAS_ADDRESS,
    data: encodeFunctionData({
      abi: multiAttestAbi,
      functionName: "multiAttest",
      args: [
        [
          {
            schema,
            data: datas.map((data) => requestData(schema, data, revocable)),
          },
        ],
      ],
    }),
    value: "0",
  };
}

export function revokeTx(chain: ChainName, schema: Hex, uid: Hex): UnsignedTx {
  return {
    chainId: CHAINS[chain].chainId,
    to: EAS_ADDRESS,
    data: encodeFunctionData({
      abi: revokeAbi,
      functionName: "revoke",
      args: [{ schema, data: { uid, value: 0n } }],
    }),
    value: "0",
  };
}

export function castCommand(tx: UnsignedTx, chain: ChainName): string {
  return `cast send --interactive ${tx.to} ${tx.data} --rpc-url ${CHAINS[chain].rpc}`;
}

export function asBytes32(hex: string): Hex {
  const bare = hex.replace(/^sha256:/, "").replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{64}$/.test(bare)) throw new Error("E_BYTES32");
  return `0x${bare.toLowerCase()}`;
}

export function asBytes20(hex: string): Hex {
  const bare = hex.replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{40}$/.test(bare)) throw new Error("E_BYTES20");
  return `0x${bare.toLowerCase()}`;
}
