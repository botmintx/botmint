import {
  type Abi,
  type Address,
  encodeDeployData,
  encodeFunctionData,
  getAddress,
  type Hash,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { assertPaid, type PaymentReceipt } from "./payment.ts";

type LocalWallet = WalletClient<any, any, any>;

export async function deployGenesis(input: {
  wallet: LocalWallet;
  publicClient: PublicClient;
  abi: Abi;
  bytecode: Hex;
  admin: Address;
}): Promise<Address> {
  const hash = await input.wallet.sendTransaction({
    account: input.admin,
    data: encodeDeployData({ abi: input.abi, bytecode: input.bytecode, args: [input.admin] }),
    chain: input.wallet.chain,
  });
  const receipt = await input.publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error("deploy did not return a contract address");
  return getAddress(receipt.contractAddress);
}

export async function mintAfterPayment(input: {
  receipt: PaymentReceipt;
  wallet: LocalWallet;
  publicClient: PublicClient;
  abi: Abi;
  contract: Address;
  minter: Address;
  to: Address;
}): Promise<Hash> {
  assertPaid(input.receipt);
  if (input.receipt.tokenId < 1) throw new Error("token");
  const hash = await input.wallet.sendTransaction({
    account: input.minter,
    to: input.contract,
    data: encodeFunctionData({
      abi: input.abi,
      functionName: "mint",
      args: [input.to, BigInt(input.receipt.tokenId)],
    }),
    chain: input.wallet.chain,
  });
  const receipt = await input.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("mint failed");
  return hash;
}

export async function transferToken(input: {
  wallet: LocalWallet;
  publicClient: PublicClient;
  abi: Abi;
  contract: Address;
  from: Address;
  to: Address;
  tokenId: number;
}): Promise<void> {
  const hash = await input.wallet.sendTransaction({
    account: input.from,
    to: input.contract,
    data: encodeFunctionData({
      abi: input.abi,
      functionName: "transferFrom",
      args: [input.from, input.to, BigInt(input.tokenId)],
    }),
    chain: input.wallet.chain,
  });
  const receipt = await input.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("transfer failed");
}
