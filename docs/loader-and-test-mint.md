# Loader and the test mint

botmint is an unofficial community project, not affiliated with xAI or X. Official Grok Bot template status is up to xAI.

Grok Bot cannot create a bot in another person's account through a public API, and share templates are published by the owner of a live bot. This repository ships one loader template, not 10,000 templates.

## Publish the loader

`deployments/base-sepolia.json` and `deployments/base.json` are the only place the chain id, contract address, public RPC, and gallery base URL live. The contract address is `null` until the Base Sepolia script in [base-sepolia-deploy.md](base-sepolia-deploy.md) writes one. The gallery URL is the GitHub Pages site. `botmint loader pack` reads that file and prints the recipe JSON: profile, the load skill, the getting-started skill, memory facts, and the ownership routine. Publish that text from your own bot. `--out <file>` also writes it. `--network` defaults to `base-sepolia`.

The pack refuses while the contract address or the gallery URL is null:

```text
botmint loader pack refused: contract address is null in deployments/base-sepolia.json. Fill it in after deploy, or pass --allow-unconfigured.
```

`--allow-unconfigured` still prints a recipe. The skill text says `null` for the missing field. There are no chain values hard-coded in the skill source. They are filled from the deployment file at pack time.

The load skill speaks to the new owner. It asks for a Genesis token ID and a claim code. A Grok Bot cannot check an EIP-712 signature on its own, so the skill tells it to run these commands, one line each:

```text
npx --yes botmint@0.1.0 verify-claim --network base-sepolia --code '<claim code json>'
npx --yes botmint@0.1.0 fetch-manifest <tokenId> --network base-sepolia
npx --yes botmint@0.1.0 check-owner <tokenId> <owner address> --network base-sepolia
```

The version and the network come from the pack. `--network` defaults to `base-sepolia`, so the short form without it hits the same file. `verify-claim` prints JSON with `ok`, `reason`, and `manifestUrl`. It checks expiry, the signature, and `ownerOf` on the public RPC. It does not send a transaction.

Used nonces are kept in a file the bot owns, `~/.botmint/nonces.json`, shaped `{ "nonces": [] }`. That list is local. A new machine does not know old nonces. After a transfer, `ownerOf` still rejects the previous owner. Pass `--nonce-file` to store the list somewhere else. The routine runs `check-owner` and tells the bot to go dormant if the token moved.

## What a buyer receives

The gallery export writes `bots/<stem>/loader.json` for each dev-sample bot. The stem is the edition padded to 4 digits. The file carries the committed instructions, traits, skills, memory, and the portrait path. Dev-sample instructions are raw, because polish has not been run. If a polished recipe exists at `collections/dev-sample/polished/<stem>.json`, the manifest uses it and sets `instructionsSource` to `polished`.

The loader fetches that file only after the claim code verifies.

## Test mint

The payment adapter is a mock. It confirms `$10.00` in process and does not call X Money. There is no other payment implementation in this repo.

`contracts/src/BotmintGenesis.sol` is a minimal ERC-721. Token ids are Genesis bot ids, 1 through 10000. Only a minter may mint. The admin is a minter. The contract does not take payment. The EAS provenance attestation is separate and is not changed here.

```text
forge test --root contracts
```

The ownership flow test starts a local anvil, deploys the contract, mints after the mock payment, signs a claim, loads the manifest, transfers the token, and checks that the old code fails, the new owner's code works, and expired or replayed codes fail. Anvil's default accounts are unlocked. The tests do not embed a private key.

`botmint holders --rpc <url> --contract <address>` reads `Transfer` logs and prints the current holder. It does not send a transaction. CI does not point it at a public network.

## Gallery flag

The mint page and the claim page stay closed unless you rebuild with:

```text
NEXT_PUBLIC_BOTMINT_TEST_MINT=1 pnpm --filter @botmint/gallery build
```

The flagged mint page talks to `http://127.0.0.1:8545` (change the field if anvil is on another port). Start anvil yourself. The page can deploy the artifact from the gallery export, mint, sign, load `bots/<id>/loader.json`, transfer to anvil's second account, and recheck. The flagged claim page asks an injected wallet (`window.ethereum`) to sign the EIP-712 claim and shows the JSON to copy. If the deployment file still has a null contract, it does not sign. Genesis claims stay closed.

`.github/workflows/gallery-pages.yml` deploys `apps/gallery` to GitHub Pages. It is `workflow_dispatch` only, so it does nothing until a person runs it. The claim signer stays off unless that dispatch sets the test input. `gallery-deploy.yml` is still forced off. This repository does not dispatch the workflow.

## Base Sepolia

`contracts/script/DeployBaseSepolia.s.sol` broadcasts only when `BOTMINT_DEPLOY_BASE_SEPOLIA=1` and `DEPLOYER_KEY` and `ADMIN` are set in the environment. It writes the address into `deployments/base-sepolia.json`. The shell script `contracts/script/deploy-base-sepolia.sh` does not update that file. Do not commit a key. CI does not run either script. This repository does not deploy, and it does not send transactions to Base.

Default RPC: `https://sepolia.base.org`. The steps are in [base-sepolia-deploy.md](base-sepolia-deploy.md).

## CLI package

`packages/cli` is named `botmint` and is set up to publish (`files`, `bin`, `publishConfig.access`, `publishConfig.provenance`). `prepublishOnly` exits unless `BOTMINT_PUBLISH=1`. This repository does not set that and does not publish. The published entry is a bundled `dist/cli.js` plus a copy of `deployments/`. In this checkout the `bin` runs `src/` so tests do not need a bundle. A published install has no `src/` and runs the bundle, which is what `npx botmint` uses.
