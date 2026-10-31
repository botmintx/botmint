import { ClaimSigner } from "./claim-signer";

const testMint = process.env.NEXT_PUBLIC_BOTMINT_TEST_MINT === "1";

export default function ClaimPage() {
  if (testMint) return <ClaimSigner />;
  return (
    <div>
      <h1 className="text-4xl tracking-tight">Claim code</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Claim codes are off in this build. A claim code is an EIP-712 signature from the wallet that
        holds the Genesis token. Rebuild with NEXT_PUBLIC_BOTMINT_TEST_MINT=1 to sign one with an
        injected wallet. This build does not ask a wallet to sign and does not deploy.
      </p>
    </div>
  );
}
