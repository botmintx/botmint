import { notFound } from "next/navigation";
import { type GalleryToken, loadGallery } from "../../../lib/load";

export function generateStaticParams() {
  return loadGallery().tokens.map((token) => ({ id: token.stem }));
}

export default async function TokenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = loadGallery().tokens.find((item) => item.stem === id);
  if (!token) notFound();
  return <TokenView token={token} />;
}

function TokenView({ token }: { token: GalleryToken }) {
  return (
    <article>
      <p className="text-sm text-mint">{token.tokenId}</p>
      <h1 className="mt-2 text-4xl tracking-tight">{token.name}</h1>
      <p className="mt-3 text-muted">
        {token.tier} · rank {token.rank} · score {token.score} · DNA {token.dna}
      </p>
      <img
        alt=""
        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(token.svg)}`}
        className="mt-6 max-w-sm border border-line"
      />
      <p className="mt-6 max-w-2xl">{token.description}</p>
      <h2 className="mt-8 text-xl">Job</h2>
      <p className="mt-2 max-w-2xl whitespace-pre-wrap text-muted">{token.job}</p>
      <h2 className="mt-8 text-xl">Policy</h2>
      <p className="mt-2 max-w-2xl">{token.policy}</p>
      <h2 className="mt-8 text-xl">Skills</h2>
      <div className="mt-3 space-y-3">
        {token.skills.map((skill) => (
          <details key={skill.name} className="border border-line p-4">
            <summary>
              {skill.name}
              <span className="mt-1 block text-sm text-muted">{skill.description}</span>
            </summary>
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{skill.body}</p>
          </details>
        ))}
      </div>
      <h2 className="mt-8 text-xl">Routine</h2>
      <p className="mt-2 text-sm text-muted">
        {token.routine.name} · {token.routine.when}
      </p>
      <p className="mt-2 max-w-2xl whitespace-pre-wrap">{token.routine.prompt}</p>
      <p className="mt-2 text-sm text-muted">{token.routine.deliveryLine}</p>
      <h2 className="mt-8 text-xl">Connectors</h2>
      <p className="mt-2">{token.connectors.join(", ")}</p>
      <p className="mt-2 text-sm text-muted">
        Autonomy {token.autonomy}. Output {token.output}. Avatar style {token.avatar}.
      </p>
      <p className="mt-4 font-mono text-xs text-muted">sha256:{token.rawHash}</p>
      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <a
          className="border border-mint px-3 py-2 text-mint"
          href={`/sample/${token.stem}/INSTALL.md`}
        >
          Copy install prompt
        </a>
        <a className="border border-line px-3 py-2" href={`/sample/${token.stem}/bundle.zip`}>
          Download bundle (.zip)
        </a>
        <a className="border border-line px-3 py-2" href={`/sample/${token.stem}/recipe.json`}>
          View recipe JSON
        </a>
      </div>
      <section className="mt-8 max-w-xl border border-line p-4">
        <h2 className="text-lg">Mint</h2>
        <p className="mt-2 text-sm text-muted">$10 · Mint with X Money (eligible US accounts)</p>
        <button
          type="button"
          disabled
          className="mt-4 border border-line px-3 py-2 text-sm text-muted"
        >
          Claims are closed
        </button>
        <p className="mt-3 text-sm text-muted">
          Install the botmint-minter skill from
          https://github.com/botmintx/botmint/blob/main/integrations/x-money/minter/SKILL.md and
          claim {token.tokenId}
        </p>
        <p className="mt-2 font-mono text-xs">
          botmint genesis {token.tokenId} &lt;nonce from your bot&gt; private
        </p>
        <p className="mt-3 text-sm">
          <a href="https://github.com/botmintx/botmint/issues/new?template=genesis-waitlist.yml">
            Waitlist
          </a>{" "}
          for collectors without X Money.
        </p>
      </section>
    </article>
  );
}
