import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import path from "node:path";
import {
  type Address,
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
} from "viem";
import { foundry } from "viem/chains";

export function forgeBin(): string {
  return process.platform === "win32" ? "forge.exe" : "forge";
}

export function anvilBin(): string {
  return process.platform === "win32" ? "anvil.exe" : "anvil";
}

export function forgeBuild(repoRoot: string): void {
  execFileSync(forgeBin(), ["build", "--root", path.join(repoRoot, "contracts")], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

export async function startAnvil(): Promise<{ url: string; stop: () => Promise<void> }> {
  const port = 20000 + (process.pid % 20000);
  const child: ChildProcess = spawn(anvilBin(), ["--host", "127.0.0.1", "--port", String(port)], {
    stdio: "ignore",
  });
  const url = `http://127.0.0.1:${port}`;
  let settled = false;
  const failed = new Promise<never>((_, reject) => {
    child.once("exit", (code) => {
      if (!settled) reject(new Error(`anvil exited before it was ready (${code ?? "signal"})`));
    });
    child.once("error", (error) => {
      if (!settled) reject(error);
    });
  });
  const ready = (async () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
        });
        if (response.ok) return;
      } catch {
        // anvil is still starting
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("anvil did not become ready. Install Foundry and put anvil on PATH.");
  })();
  try {
    await Promise.race([ready, failed]);
  } catch (error) {
    child.kill();
    throw error;
  }
  settled = true;
  return {
    url,
    stop: async () => {
      child.kill();
      await new Promise((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) resolve(undefined);
        else child.once("exit", () => resolve(undefined));
      });
    },
  };
}

export function localClients(url: string, account: Address) {
  const transport = http(url);
  const publicClient = createPublicClient({ chain: foundry, transport });
  const wallet = createWalletClient({ account, chain: foundry, transport });
  return { publicClient: publicClient as PublicClient, wallet };
}
