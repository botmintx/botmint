import { loadGallery } from "../../lib/load";

export default function MintPage() {
  const data = loadGallery();
  return (
    <div>
      <h1 className="text-4xl tracking-tight">Mint with X Money</h1>
      <p className="mt-3 max-w-2xl text-muted">
        A numbered claim is $10 for eligible customers in the United States. Installing a bot stays
        free. Nothing is minted on a chain. Claims are closed.
      </p>
      <p className="mt-6 text-sm text-muted">
        Claimed 0 · reserved 0 · available {data.count === 25 ? "10000" : data.count} · claimsRoot
        none
      </p>
      <button type="button" disabled className="mt-6 border border-line px-4 py-3 text-muted">
        Mint random · claims are closed
      </button>
      <section className="mt-8 max-w-xl border border-line p-4 text-sm text-muted">
        <p>$10 · Mint with X Money (eligible US accounts)</p>
        <p className="mt-3">
          Install the botmint-minter skill from
          https://github.com/botmintx/botmint/blob/main/integrations/x-money/minter/SKILL.md and
          claim random.
        </p>
        <p className="mt-3 font-mono text-xs text-fog">
          botmint genesis random &lt;nonce from your bot&gt; private
        </p>
        <p className="mt-3">
          <a href="https://github.com/botmintx/botmint/issues/new?template=genesis-waitlist.yml">
            Waitlist
          </a>{" "}
          if you cannot use X Money. Refunds are drafted in docs/refunds.md and are not in effect.
        </p>
      </section>
    </div>
  );
}
