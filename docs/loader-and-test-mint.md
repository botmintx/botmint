# Loader and the test mint

botmint is an unofficial community project, not affiliated with xAI or X. Official Grok Bot template status is up to xAI.

Grok Bot cannot create a bot in another person's account through a public API, and share templates are published by the owner of a live bot. This repository ships one loader template, not 10,000 templates.

## Publish the loader

`botmint loader pack` prints the recipe JSON: profile, the load skill, the getting-started skill, memory facts, and the ownership routine. Publish that text from your own bot. `--out <file>` also writes it.

The load skill speaks to the new owner. It asks for a Genesis token ID and a claim code. It refuses the load if verification fails. The routine tells the bot to read `ownerOf` again and go dormant if the token has moved.

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

The mint page stays closed unless you rebuild with:

```text
NEXT_PUBLIC_BOTMINT_TEST_MINT=1 pnpm --filter @botmint/gallery build
```

The flagged page talks to `http://127.0.0.1:8545` (change the field if anvil is on another port). Start anvil yourself. The page can deploy the artifact from the gallery export, mint, sign, load `bots/<id>/loader.json`, transfer to anvil's second account, and recheck. Genesis claims stay closed.

## Base Sepolia

`contracts/script/deploy-base-sepolia.sh` broadcasts only when `BOTMINT_DEPLOY_BASE_SEPOLIA=1` and `DEPLOYER_KEY` and `ADMIN` are set in the environment. Do not commit a key. CI does not run the script. This repository does not deploy, and it does not send transactions to Base.

Default RPC in the script: `https://sepolia.base.org`.
