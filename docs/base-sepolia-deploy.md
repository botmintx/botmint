# Base Sepolia deploy

botmint is an unofficial community project, not affiliated with xAI or X. This runbook is not a launch. CI does not run it. Do not commit a key, and do not run it against Base mainnet.

`deployments/base-sepolia.json` holds the chain id, the contract address (`null` until this script writes one), the public RPC, and the gallery base URL. `deployments/base.json` is the same shape for mainnet and stays `null` here. `botmint loader pack` reads the file you name with `--network` and refuses while the contract address or the gallery URL is null.

## What the script does

`contracts/script/DeployBaseSepolia.s.sol` reads `DEPLOYER_KEY` and `ADMIN` from the environment. It deploys `BotmintGenesis` with that admin, then writes the new address back into `deployments/base-sepolia.json`. It keeps the network, chain id, RPC, and gallery URL already in that file. Set `BASE_SEPOLIA_RPC` only if you want a different RPC than the one in the file.

The script reverts before it broadcasts unless `BOTMINT_DEPLOY_BASE_SEPOLIA=1`. Foundry is allowed to read and write `../deployments` from the `contracts/` project. `forge test` calls the script only to prove that missing flag reverts. It does not broadcast and it does not write the file.

`contracts/script/deploy-base-sepolia.sh` is the older `forge create` path. It does not update the JSON file. Use the Solidity script.

## Command

Do not put the key in the repo, in a shell script, or in the Foundry CLI arguments. Export it for the session, then:

```text
export BOTMINT_DEPLOY_BASE_SEPOLIA=1
export DEPLOYER_KEY=...
export ADMIN=0x...
forge script script/DeployBaseSepolia.s.sol:DeployBaseSepolia \
  --root contracts \
  --rpc-url https://sepolia.base.org \
  --broadcast
```

Unset `DEPLOYER_KEY` when you are done. Check `git diff deployments/base-sepolia.json` and commit only the address if you intend to publish that deployment. Then run `botmint loader pack --network base-sepolia` and publish that recipe from your own Grok Bot.

Nothing in this change set runs the command above.
