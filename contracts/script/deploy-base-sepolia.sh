#!/bin/sh
# Deploy BotmintGenesis to Base Sepolia.
# Prefer contracts/script/DeployBaseSepolia.s.sol. That Foundry script writes
# the address back into deployments/base-sepolia.json. This shell script does not.
# CI must not run either one. Both need a key in the environment. Never commit
# a key, and do not point them at mainnet.
set -eu
if [ "${BOTMINT_DEPLOY_BASE_SEPOLIA:-}" != "1" ]; then
  echo "Refusing to deploy. Read docs/loader-and-test-mint.md. This script is not run by CI."
  exit 2
fi
if [ -z "${DEPLOYER_KEY:-}" ] || [ -z "${ADMIN:-}" ]; then
  echo "Set DEPLOYER_KEY and ADMIN in the environment. Do not write them into the repo."
  exit 2
fi
cd "$(dirname "$0")/../.."
forge create \
  --rpc-url "${BASE_SEPOLIA_RPC:-https://sepolia.base.org}" \
  --private-key "$DEPLOYER_KEY" \
  --broadcast \
  contracts/src/BotmintGenesis.sol:BotmintGenesis \
  --constructor-args "$ADMIN"
