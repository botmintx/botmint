# botmint

Unofficial community project, not affiliated with xAI or X. Official Grok Bot template status is up to xAI.

These commands run on a stock machine with Node. They do not need a checkout of this repository. Nothing here is published to npm yet. `npm publish` refuses unless `BOTMINT_PUBLISH=1`, and this repository does not set that.

```text
npx --yes botmint@0.1.0 verify-claim --code '<claim code json>'
npx --yes botmint@0.1.0 fetch-manifest <tokenId>
npx --yes botmint@0.1.0 check-owner <tokenId> <address>
```

`--network` defaults to `base-sepolia`. Pass `--network base` for the mainnet file. `--rpc`, `--contract`, and `--gallery` override the deployment file. `verify-claim` and `check-owner` read a public RPC. They do not send a transaction.

`verify-claim` prints JSON: `ok`, `reason`, and `manifestUrl`. `reason` is `null` when `ok` is true. Otherwise it is `expired`, `replayed`, `signer`, `owner`, `malformed`, or `rpc`. The process exits 0 when `ok` is true and 1 when it is not.

## Nonce file

Replay protection is a local file the bot owns:

```text
~/.botmint/nonces.json
```

The shape is `{ "nonces": ["0x..."] }`. The directory is created `0700` and the file `0600` where the platform allows it. Pass `--nonce-file <path>` to keep the list somewhere else. The contract does not store nonces. A new machine does not know old nonces. After a transfer, `ownerOf` still rejects the previous owner even if this file is empty.

`botmint loader pack` bakes the contract, RPC, gallery URL, and these commands into the loader skill. It refuses while the contract address or gallery URL in `deployments/<network>.json` is null, unless `--allow-unconfigured` is passed.
