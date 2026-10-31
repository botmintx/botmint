"use client";

import { useEffect, useState } from "react";

type DeploymentFile = {
  network: string;
  chainId: number;
  contract: string | null;
  rpcUrl: string;
  galleryBaseUrl: string | null;
};

type DomainFile = {
  name: string;
  version: string;
  primaryType: "Claim";
  types: { Claim: { name: string; type: string }[] };
};

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function ClaimSigner() {
  const [network, setNetwork] = useState("base-sepolia");
  const [deployment, setDeployment] = useState<DeploymentFile | null>(null);
  const [domain, setDomain] = useState<DomainFile | null>(null);
  const [tokenId, setTokenId] = useState("1");
  const [account, setAccount] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState(
    "Test claim signing is on. Nothing is sent until a contract address is set.",
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [deploymentResponse, domainResponse] = await Promise.all([
        fetch(`${base}/mint/${network}.json`),
        fetch(`${base}/mint/claim-domain.json`),
      ]);
      if (!deploymentResponse.ok || !domainResponse.ok) {
        if (!cancelled)
          setStatus("The deployment file or the claim domain is missing from this build.");
        return;
      }
      const nextDeployment = (await deploymentResponse.json()) as DeploymentFile;
      const nextDomain = (await domainResponse.json()) as DomainFile;
      if (cancelled) return;
      setDeployment(nextDeployment);
      setDomain(nextDomain);
      setCode("");
      if (!nextDeployment.contract) {
        setStatus(
          `The contract address is null in deployments/${nextDeployment.network}.json. Nothing to sign.`,
        );
      } else {
        setStatus(
          `Ready to sign on chain ${nextDeployment.chainId} for ${nextDeployment.contract}. No transaction is sent.`,
        );
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [network]);

  const contractReady = Boolean(deployment?.contract);

  async function connect() {
    const provider = ethereum();
    if (!provider) {
      setStatus("No injected wallet. This page signs only with window.ethereum.");
      return;
    }
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    const next = accounts[0] ?? "";
    setAccount(next);
    setStatus(next ? `Connected ${next}.` : "The wallet returned no account.");
  }

  async function sign() {
    if (!deployment?.contract || !domain) {
      setStatus(
        `The contract address is null in deployments/${deployment?.network ?? network}.json. Nothing to sign.`,
      );
      return;
    }
    const provider = ethereum();
    if (!provider || !account) {
      setStatus("Connect an injected wallet before signing.");
      return;
    }
    const id = Number(tokenId);
    if (!Number.isInteger(id) || id < 1 || id > 10000) {
      setStatus("Token id must be from 1 to 10000.");
      return;
    }
    const nonce = randomNonce();
    const expiry = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    const typed = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        Claim: domain.types.Claim,
      },
      primaryType: "Claim",
      domain: {
        name: domain.name,
        version: domain.version,
        chainId: deployment.chainId,
        verifyingContract: deployment.contract,
      },
      message: { tokenId: id, owner: account, nonce, expiry },
    };
    const signature = (await provider.request({
      method: "eth_signTypedData_v4",
      params: [account, JSON.stringify(typed)],
    })) as string;
    const claim = { tokenId: id, owner: account, nonce, expiry, signature };
    setCode(JSON.stringify(claim));
    setStatus("Signed. Copy the claim code. No transaction was sent.");
  }

  async function copy() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setStatus("Copied the claim code.");
  }

  return (
    <div>
      <h1 className="text-4xl tracking-tight">Claim code</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Test claim signing is on. The wallet signs EIP-712 typed data. This page does not send a
        transaction and does not call X Money.
      </p>
      <p className="mt-4 text-sm text-fog">{status}</p>
      <label className="mt-6 block text-sm text-muted">
        Network
        <select
          className="mt-2 block border border-line bg-void px-3 py-2 text-fog"
          value={network}
          onChange={(event) => setNetwork(event.target.value)}
        >
          <option value="base-sepolia">base-sepolia</option>
          <option value="base">base</option>
        </select>
      </label>
      <label className="mt-4 block text-sm text-muted">
        Token id
        <input
          className="mt-2 block border border-line bg-void px-3 py-2 text-fog"
          value={tokenId}
          onChange={(event) => setTokenId(event.target.value)}
        />
      </label>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          className="border border-line px-4 py-3"
          onClick={() => void connect()}
        >
          Connect wallet
        </button>
        <button
          type="button"
          className="border border-line px-4 py-3 disabled:text-muted"
          disabled={!contractReady || !account}
          onClick={() => void sign()}
        >
          Sign claim
        </button>
        <button
          type="button"
          className="border border-line px-4 py-3 disabled:text-muted"
          disabled={!code}
          onClick={() => void copy()}
        >
          Copy the claim code
        </button>
      </div>
      <textarea
        className="mt-6 h-40 w-full max-w-2xl border border-line bg-void p-3 font-mono text-xs text-fog"
        readOnly
        value={code}
        placeholder="The claim code JSON appears here."
      />
    </div>
  );
}

function ethereum(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  const value = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
  return value ?? null;
}

function randomNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
