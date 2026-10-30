import {
  asBytes32,
  type ChainName,
  CLAIM_SCHEMA,
  claimData,
  multiAttestTx,
  revokeTx,
  schemaUid,
  type UnsignedTx,
} from "@botmint/chain";
import { type EasLine, latestClaims, type RegistryLine } from "./registry.ts";

export function claimSchemaUid(): `0x${string}` {
  return schemaUid(CLAIM_SCHEMA, true);
}

export function attestationBatch(
  lines: RegistryLine[],
  chain: ChainName,
  collection: string,
): UnsignedTx {
  const attested = new Set(
    lines
      .filter((line) => line.kind === "eas" && line.action === "attest")
      .map((line) => line.paymentRef),
  );
  const datas = [...latestClaims(lines).values()]
    .filter(
      (claim) =>
        claim.status === "claimed" &&
        claim.tokenId &&
        claim.nonceHash &&
        !attested.has(claim.paymentRef),
    )
    .map((claim) =>
      claimData({
        collection,
        tokenId: Number(claim.tokenId!.slice(1)),
        xHandle:
          claim.visibility === "public" ? (claim.xHandle ?? "") : `sha256:${claim.handleHash}`,
        nonceHash: asBytes32(claim.nonceHash!),
        paymentRef: asBytes32(claim.paymentRef),
      }),
    );
  return multiAttestTx(chain, claimSchemaUid(), datas, true);
}

export function revokeClaim(
  lines: RegistryLine[],
  chain: ChainName,
  paymentRef: string,
): UnsignedTx {
  const eas = [...lines]
    .reverse()
    .find(
      (line): line is EasLine =>
        line.kind === "eas" && line.paymentRef === paymentRef && line.action === "attest",
    );
  if (!eas) throw new Error("E_NO_ATTESTATION");
  return revokeTx(chain, claimSchemaUid(), asBytes32(eas.attestationUid));
}
