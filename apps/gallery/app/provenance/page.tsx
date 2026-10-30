import { loadGallery } from "../../lib/load";

export default function ProvenancePage() {
  const data = loadGallery();
  return (
    <div>
      <h1 className="text-4xl tracking-tight">Provenance</h1>
      <dl className="mt-6 space-y-3 text-sm">
        <div>
          <dt className="text-muted">Seed</dt>
          <dd>{data.seed}</dd>
        </div>
        <div>
          <dt className="text-muted">Engine commit</dt>
          <dd>Not frozen. Genesis has no lock file yet.</dd>
        </div>
        <div>
          <dt className="text-muted">Raw provenance</dt>
          <dd className="font-mono text-xs">{data.provenance}</dd>
        </div>
      </dl>
      <p className="mt-6">
        <a className="text-mint" href="/sample/../">
          provenance.txt
        </a>{" "}
        is committed at collections/dev-sample/provenance.txt in the repo. This dev sample is not
        the Genesis hash.
      </p>
      <p className="mt-6 text-lg">Not anchored yet</p>
      <pre className="mt-4 overflow-auto border border-line bg-carbon p-4 text-sm">{`npx botmint drop verify genesis
npx botmint verify --onchain`}</pre>
    </div>
  );
}
