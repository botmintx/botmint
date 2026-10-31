"use client";

import { useState } from "react";
import {
  type Address,
  createPublicClient,
  createWalletClient,
  encodeDeployData,
  encodeFunctionData,
  type Hex,
  http,
  parseAbiItem,
  verifyTypedData,
} from "viem";
import { foundry } from "viem/chains";

type ClaimCode = {
  tokenId: number;
  owner: Address;
  nonce: Hex;
  expiry: number;
  signature: Hex;
};

type DomainFile = {
  name: string;
  version: string;
  primaryType: "Claim";
  types: {
    Claim: { name: string; type: string }[];
  };
};

const seen = new Set<string>();

export function TestMint() {
  const [rpc, setRpc] = useState("http://127.0.0.1:8545");
  const [edition, setEdition] = useState(1);
  const [log, setLog] = useState(
    "Test mint is on. Mock X Money only. Local chain only. Genesis claims stay closed.",
  );
  const [accounts, setAccounts] = useState<Address[]>([]);
  const [contract, setContract] = useState<Address | "">("");
  const [paid, setPaid] = useState(false);
  const [lastCode, setLastCode] = useState<ClaimCode | null>(null);
  const [loadedOwner, setLoadedOwner] = useState<Address | "">("");

  async function clients() {
    const transport = http(rpc);
    return {
      publicClient: createPublicClient({ chain: foundry, transport }),
      wallet: createWalletClient({ chain: foundry, transport }),
    };
  }

  async function artifact() {
    const response = await fetch("/mint/BotmintGenesis.json");
    if (!response.ok)
      throw new Error("missing contract artifact. Run forge build, then rebuild the gallery.");
    return (await response.json()) as { abi: readonly unknown[]; bytecode: Hex };
  }

  async function domain(chainId: number, verifyingContract: Address) {
    const response = await fetch("/mint/claim-domain.json");
    if (!response.ok) throw new Error("missing claim domain");
    const file = (await response.json()) as DomainFile;
    return {
      file,
      domain: {
        name: file.name,
        version: file.version,
        chainId,
        verifyingContract,
      },
    };
  }

  async function connect() {
    try {
      const { wallet } = await clients();
      const found = await wallet.getAddresses();
      setAccounts(found);
      setLog(`Local accounts ${found.length}. No wallet extension. No payment was sent.`);
    } catch (error) {
      setLog(error instanceof Error ? error.message : "could not reach the local chain");
    }
  }

  function mockPay() {
    if (!Number.isInteger(edition) || edition < 1 || edition > 10000) {
      setPaid(false);
      setLog("Refused. Token id must be from 1 to 10000.");
      return;
    }
    setPaid(true);
    setLog("Mock checkout confirmed $10.00. No X Money call was made.");
  }

  async function deploy() {
    try {
      if (accounts[0] === undefined) throw new Error("connect the local chain first");
      const { publicClient, wallet } = await clients();
      const compiled = await artifact();
      const hash = await wallet.sendTransaction({
        account: accounts[0],
        data: encodeDeployData({
          abi: compiled.abi,
          bytecode: compiled.bytecode,
          args: [accounts[0]],
        }),
        chain: foundry,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (!receipt.contractAddress) throw new Error("deploy failed");
      setContract(receipt.contractAddress);
      setLog(`Deployed ${receipt.contractAddress} on the local chain. Nothing was sent to Base.`);
    } catch (error) {
      setLog(error instanceof Error ? error.message : "deploy failed");
    }
  }

  async function mint() {
    try {
      if (!paid) throw new Error("confirm the mock $10.00 checkout first");
      if (!contract || accounts[0] === undefined) throw new Error("deploy, then mint");
      const { publicClient, wallet } = await clients();
      const compiled = await artifact();
      const hash = await wallet.sendTransaction({
        account: accounts[0],
        to: contract,
        data: encodeFunctionData({
          abi: compiled.abi,
          functionName: "mint",
          args: [accounts[0], BigInt(edition)],
        }),
        chain: foundry,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("mint failed");
      setLog(`Minted token ${edition} to ${accounts[0]}.`);
    } catch (error) {
      setLog(error instanceof Error ? error.message : "mint failed");
    }
  }

  async function sign(owner: Address) {
    if (!contract) throw new Error("contract is not deployed");
    const { publicClient, wallet } = await clients();
    const chainId = await publicClient.getChainId();
    const typed = await domain(chainId, contract);
    const nonce =
      `0x${crypto.getRandomValues(new Uint8Array(32)).reduce((hex, byte) => hex + byte.toString(16).padStart(2, "0"), "")}` as Hex;
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const signature = await wallet.signTypedData({
      account: owner,
      domain: typed.domain,
      types: typed.file.types,
      primaryType: "Claim",
      message: { tokenId: BigInt(edition), owner, nonce, expiry: BigInt(expiry) },
    });
    const code: ClaimCode = { tokenId: edition, owner, nonce, expiry, signature };
    setLastCode(code);
    return { code, types: typed.file.types, chainId };
  }

  async function load(owner: Address) {
    try {
      if (!contract) throw new Error("contract is not deployed");
      const signed = await sign(owner);
      const { publicClient } = await clients();
      const compiled = await artifact();
      const now = Math.floor(Date.now() / 1000);
      if (now >= signed.code.expiry) {
        setLog("Refused. The claim code is expired.");
        return;
      }
      const typed = await domain(signed.chainId, contract);
      const valid = await verifyTypedData({
        address: owner,
        domain: typed.domain,
        types: signed.types,
        primaryType: "Claim",
        message: {
          tokenId: BigInt(signed.code.tokenId),
          owner,
          nonce: signed.code.nonce,
          expiry: BigInt(signed.code.expiry),
        },
        signature: signed.code.signature,
      });
      if (!valid) {
        setLog("Refused. The signature does not match the owner.");
        return;
      }
      const holder = (await publicClient.readContract({
        address: contract,
        abi: compiled.abi,
        functionName: "ownerOf",
        args: [BigInt(edition)],
      })) as Address;
      if (holder.toLowerCase() !== owner.toLowerCase()) {
        setLog("Refused. ownerOf does not match this claim. The token may have moved.");
        return;
      }
      if (seen.has(signed.code.nonce.toLowerCase())) {
        setLog("Refused. This claim code was already used.");
        return;
      }
      const stem = String(edition).padStart(4, "0");
      const response = await fetch(`/bots/${stem}/loader.json`);
      if (!response.ok) {
        setLog(`Refused. No manifest at bots/${stem}/loader.json.`);
        return;
      }
      const bot = (await response.json()) as {
        edition: number;
        name: string;
        pfp: { path: string };
      };
      if (bot.edition !== edition) {
        setLog("Refused. The manifest is for a different token.");
        return;
      }
      seen.add(signed.code.nonce.toLowerCase());
      setLoadedOwner(owner);
      setLog(`Loaded ${bot.name}. Avatar ${bot.pfp.path}. Token ${edition}.`);
    } catch (error) {
      setLog(error instanceof Error ? error.message : "load failed");
    }
  }

  async function transfer() {
    try {
      if (!contract || accounts[0] === undefined || accounts[1] === undefined) {
        throw new Error("need two local accounts and a deployed contract");
      }
      const { publicClient, wallet } = await clients();
      const compiled = await artifact();
      const hash = await wallet.sendTransaction({
        account: accounts[0],
        to: contract,
        data: encodeFunctionData({
          abi: compiled.abi,
          functionName: "transferFrom",
          args: [accounts[0], accounts[1], BigInt(edition)],
        }),
        chain: foundry,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("transfer failed");
      setLog(`Transferred token ${edition} to ${accounts[1]}. The previous claim code is dead.`);
    } catch (error) {
      setLog(error instanceof Error ? error.message : "transfer failed");
    }
  }

  async function recheck() {
    try {
      if (!contract || !loadedOwner) throw new Error("load a bot first");
      const { publicClient } = await clients();
      const compiled = await artifact();
      const holder = (await publicClient.readContract({
        address: contract,
        abi: compiled.abi,
        functionName: "ownerOf",
        args: [BigInt(edition)],
      })) as Address;
      if (holder.toLowerCase() !== loadedOwner.toLowerCase()) {
        setLoadedOwner("");
        setLog(`Dormant. ownerOf is ${holder}. The loaded bot has stopped.`);
        return;
      }
      setLog(`Still claimed by ${holder}.`);
    } catch (error) {
      setLog(error instanceof Error ? error.message : "recheck failed");
    }
  }

  async function replay() {
    if (!lastCode || !contract) {
      setLog("Refused. There is no claim code to replay.");
      return;
    }
    if (seen.has(lastCode.nonce.toLowerCase())) {
      setLog("Refused. This claim code was already used.");
      return;
    }
    setLog("That code has not been accepted yet.");
  }

  async function holder() {
    try {
      if (!contract) throw new Error("deploy first");
      const { publicClient } = await clients();
      const logs = await publicClient.getLogs({
        address: contract,
        event: parseAbiItem(
          "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
        ),
        fromBlock: 0n,
        toBlock: "latest",
      });
      const latest = logs.at(-1)?.args.to;
      setLog(latest ? `Current holder ${latest}.` : "No transfers yet.");
    } catch (error) {
      setLog(error instanceof Error ? error.message : "could not read logs");
    }
  }

  return (
    <div>
      <h1 className="text-4xl tracking-tight">Test mint</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Mock $10.00 checkout and a local chain only. This build does not call X Money, and it does
        not send a transaction anywhere but the RPC below. Genesis claims stay closed.
      </p>
      <label className="mt-6 block text-sm text-muted">
        Local RPC
        <input
          className="mt-2 block w-full max-w-xl border border-line bg-void px-3 py-2 text-fog"
          value={rpc}
          onChange={(event) => setRpc(event.target.value)}
        />
      </label>
      <label className="mt-4 block text-sm text-muted">
        Token id
        <input
          className="mt-2 block w-32 border border-line bg-void px-3 py-2 text-fog"
          type="number"
          min={1}
          max={10000}
          value={edition}
          onChange={(event) => setEdition(Number(event.target.value))}
        />
      </label>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          className="border border-line px-4 py-3"
          onClick={() => void connect()}
        >
          Connect local chain
        </button>
        <button type="button" className="border border-line px-4 py-3" onClick={mockPay}>
          Mock pay $10
        </button>
        <button
          type="button"
          className="border border-line px-4 py-3"
          onClick={() => void deploy()}
        >
          Deploy
        </button>
        <button type="button" className="border border-line px-4 py-3" onClick={() => void mint()}>
          Mint
        </button>
        <button
          type="button"
          className="border border-line px-4 py-3"
          onClick={() => void load(accounts[0] as Address)}
        >
          Sign and load
        </button>
        <button
          type="button"
          className="border border-line px-4 py-3"
          onClick={() => void transfer()}
        >
          Transfer to second account
        </button>
        <button
          type="button"
          className="border border-line px-4 py-3"
          onClick={() => void load(accounts[1] as Address)}
        >
          New owner loads
        </button>
        <button
          type="button"
          className="border border-line px-4 py-3"
          onClick={() => void recheck()}
        >
          Recheck ownership
        </button>
        <button
          type="button"
          className="border border-line px-4 py-3"
          onClick={() => void replay()}
        >
          Replay last code
        </button>
        <button
          type="button"
          className="border border-line px-4 py-3"
          onClick={() => void holder()}
        >
          Read holders
        </button>
      </div>
      <pre className="mt-6 max-w-3xl whitespace-pre-wrap border border-line p-4 text-sm text-fog">
        {log}
      </pre>
    </div>
  );
}
