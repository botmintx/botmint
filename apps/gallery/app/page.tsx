import { loadGallery } from "../lib/load";
import { Grid } from "./grid";

export default function HomePage() {
  const data = loadGallery();
  return (
    <div>
      <img
        src="/brand/banner-dark.svg"
        alt="Botmintx — Mint 10,000 one-of-one Grok Bots"
        className="mb-8 w-full border border-line"
      />
      <h1 className="text-4xl tracking-tight">Dev sample</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Twenty-five bots from seed {data.seed}. The portraits on the cards are the DNA marks from
        each recipe. The Genesis PFP grid below is the approved art system, not a roll of these
        bots.
      </p>
      <img
        src="/brand/pfp-grid.png"
        alt="Genesis PFP preview grid"
        className="my-8 w-full max-w-3xl border border-line"
      />
      <Grid tokens={data.tokens} />
    </div>
  );
}
