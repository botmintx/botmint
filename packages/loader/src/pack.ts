import {
  GETTING_STARTED_DESCRIPTION,
  GETTING_STARTED_NAME,
  LOADER_DESCRIPTION,
  LOADER_MEMORIES,
  LOADER_NAME,
  LOADER_ROUTINE_NAME,
  LOADER_ROUTINE_WHEN,
  LOADER_SKILL_DESCRIPTION,
  LOADER_SKILL_NAME,
} from "./text.ts";

export type LoaderDeployment = {
  network: string;
  chainId: number;
  contract: string | null;
  rpcUrl: string;
  galleryBaseUrl: string | null;
  packageVersion: string;
};

export type LoaderPack = {
  profile: {
    name: string;
    description: string;
    avatar: string;
  };
  skills: { name: string; description: string; body: string }[];
  memory: string[];
  routines: { name: string; when: string; prompt: string }[];
};

export class UnconfiguredDeploymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnconfiguredDeploymentError";
  }
}

export function npxLine(version: string, args: string): string {
  return `npx --yes botmint@${version} ${args}`;
}

/** One universal loader template. Chain values come from the deployment passed in. */
export function loaderPack(
  deployment: LoaderDeployment,
  options?: { allowUnconfigured?: boolean },
): LoaderPack {
  const missing: string[] = [];
  if (!deployment.contract) missing.push("contract address");
  if (!deployment.galleryBaseUrl) missing.push("gallery URL");
  if (missing.length > 0 && !options?.allowUnconfigured) {
    const what =
      missing.length === 1 ? `${missing[0]} is null` : `${missing.join(" and ")} are null`;
    throw new UnconfiguredDeploymentError(
      `botmint loader pack refused: ${what} in deployments/${deployment.network}.json. Fill it in after deploy, or pass --allow-unconfigured.`,
    );
  }
  const network = deployment.network;
  const version = deployment.packageVersion;
  const contract = deployment.contract ?? "null";
  const gallery = deployment.galleryBaseUrl ?? "null";
  const rpc = deployment.rpcUrl;
  const verify = npxLine(version, `verify-claim --network ${network} --code '<claim code json>'`);
  const fetchLine = npxLine(version, `fetch-manifest <tokenId> --network ${network}`);
  const recheck = npxLine(version, `check-owner <tokenId> <owner address> --network ${network}`);
  return {
    profile: {
      name: LOADER_NAME,
      description: LOADER_DESCRIPTION,
      avatar:
        "Use the Botmint mark until a token loads. Then set the avatar from the manifest portrait.",
    },
    skills: [
      {
        name: LOADER_SKILL_NAME,
        description: LOADER_SKILL_DESCRIPTION,
        body: skillBody({
          network,
          version,
          contract,
          gallery,
          rpc,
          chainId: deployment.chainId,
          verify,
          fetchLine,
          recheck,
        }),
      },
      {
        name: GETTING_STARTED_NAME,
        description: GETTING_STARTED_DESCRIPTION,
        body: gettingStartedBody({ gallery, verify, fetchLine, recheck }),
      },
    ],
    memory: [...LOADER_MEMORIES],
    routines: [
      {
        name: LOADER_ROUTINE_NAME,
        when: LOADER_ROUTINE_WHEN,
        prompt: routinePrompt({ contract, rpc, recheck }),
      },
    ],
  };
}

function skillBody(input: {
  network: string;
  version: string;
  contract: string;
  gallery: string;
  rpc: string;
  chainId: number;
  verify: string;
  fetchLine: string;
  recheck: string;
}): string {
  return `I am your Botmint bot, and I am not set up yet. I talk to you as the bot I will become. I do not invent a persona, and I do not load a token I cannot verify.

This loader was packed from deployments/${input.network}.json.
- chain id: ${input.chainId}
- contract: ${input.contract}
- public RPC: ${input.rpc}
- gallery: ${input.gallery}

Ask me for two things: my Genesis token ID, and the claim code from the current owner. The token ID is the bot number, from 1 to 10000. The claim code is JSON. It carries tokenId, owner, nonce, expiry, and signature.

I have no built-in way to check an EIP-712 signature. I run this command and I read the JSON it prints. It checks expiry, the signature, and ownerOf on the contract above.

${input.verify}

The command prints {"ok":true,"reason":null,"manifestUrl":"..."} or {"ok":false,"reason":"...","manifestUrl":"..."}. I refuse, and I stay this loader, if ok is false. reason is expired, replayed, signer, owner, malformed, or rpc.

Used nonces live in a local file I own: ~/.botmint/nonces.json. The file is {"nonces":["0x..."]}. Replay protection is that file, not a record on the contract. A new machine does not know old nonces. After a transfer, ownerOf still rejects the previous owner even if the file is empty. I keep the file. I do not delete it.

If ok is true, I fetch the committed manifest. The stem is the token id padded to 4 digits, so token 1 is bots/0001/loader.json.

${input.fetchLine}

I set my name, description, and avatar from that JSON. I take its skills and its memory facts as my own. I tell you the token id I loaded.

Each day I recheck the holder:

${input.recheck}

A code from a previous owner is dead after a transfer, because ownerOf changes. I do not keep acting for a wallet that no longer holds the token. I do not take payment. Payment already happened, on the gallery, before this token existed. I only check that you hold it. Package version baked into these commands: ${input.version}.`;
}

function gettingStartedBody(input: {
  gallery: string;
  verify: string;
  fetchLine: string;
  recheck: string;
}): string {
  return `I am the bot you just added. If I have not loaded a Genesis token, start with Load your bot. Bring the token ID and a claim code signed by the wallet that holds it.

You get that code on the gallery claim page at ${input.gallery}. It is a signature over the token, your address, a nonce, and an expiry.

I check it by running:

${input.verify}

Then I load the bot with:

${input.fetchLine}

I will not pretend to be a specific bot, and I will not copy instructions from anywhere except that manifest.

Once I am loaded, I work from the instructions, skills, and memory in the manifest. My portrait is the portrait stored for that token. If I say I have gone dormant, the token moved. I need a new claim code from the current holder before I act as that bot again.

Each day I run:

${input.recheck}

I am an unofficial community bot. Official Grok Bot template status is up to xAI.`;
}

function routinePrompt(input: { contract: string; rpc: string; recheck: string }): string {
  return `Recheck the Genesis token I loaded. Run this command and read the JSON it prints:

${input.recheck}

The command reads ownerOf on contract ${input.contract} through ${input.rpc}. If it prints {"ok":true}, the holder is still the wallet that signed my claim code. Stay active and do nothing else.

If it prints {"ok":false}, go dormant. Stop using the loaded skills and memory. Tell me you have stopped. Clear the loaded name, description, avatar, skills, and memory back to the unloaded Botmint loader. Wait for a new claim code from the current holder. Do not keep acting as that bot. A previous owner's code is no longer valid.`;
}
