# Anchoring

Genesis provenance is one EAS attestation on Base. The CLI prints an unsigned transaction. It does not hold a key and it does not send anything.

- Schema registry: `0x4200000000000000000000000000000000000020`
- EAS: `0x4200000000000000000000000000000000000021`
- Genesis schema (not revocable): `string collection, uint32 count, bytes32 provenanceHash, string seed, bytes20 gitCommit, string engineVersion, bytes32 lockFileHash`
- Claim schema (revocable): `string collection, uint32 tokenId, string xHandle, bytes32 nonceHash, bytes32 paymentRef`
- Base chain id 8453, RPC `https://mainnet.base.org` (read-only, and only when you pass `--onchain`)
- Base Sepolia chain id 84532, RPC `https://sepolia.base.org`

```bash
botmint anchor genesis --chain base-sepolia --register-schema
botmint anchor genesis --chain base
botmint verify --collection genesis --onchain
```

`--onchain` reads `getAttestation`. Tests pass a mock client. There is no funded account in this repo.

`botmint.config.json` has `attester: null` until a public attester address is chosen. The payee is `@brandononchain`. The repo URL is `https://github.com/botmintx/botmint`.
