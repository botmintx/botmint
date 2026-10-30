import { loadGallery } from "../../lib/load";

export default function StatsPage() {
  const data = loadGallery();
  const layers = ["archetype", "domain", "tier"] as const;
  return (
    <div>
      <h1 className="text-4xl tracking-tight">Stats</h1>
      <p className="mt-3 text-muted">Dev sample of {data.count}. Not Genesis.</p>
      <ul className="mt-6 flex gap-6 text-sm">
        {Object.entries(data.tiers).map(([tier, count]) => (
          <li key={tier}>
            {tier} <span className="text-mint">{count}</span>
          </li>
        ))}
      </ul>
      {layers.map((layer) => {
        const counts = new Map<string, number>();
        for (const token of data.tokens) {
          const value =
            layer === "tier" ? token.tier : layer === "domain" ? token.domain : token.archetype;
          counts.set(value, (counts.get(value) ?? 0) + 1);
        }
        const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        const max = Math.max(...rows.map((row) => row[1]));
        return (
          <section key={layer} className="mt-10">
            <h2 className="text-xl">{layer}</h2>
            <svg
              viewBox={`0 0 600 ${rows.length * 28}`}
              className="mt-3 w-full"
              role="img"
              aria-label={`${layer} counts`}
            >
              {rows.map(([label, count], index) => (
                <g key={label} transform={`translate(0 ${index * 28})`}>
                  <text x="0" y="16" fill="#a9b0b4" fontSize="12">
                    {label}
                  </text>
                  <rect x="180" y="4" width={(count / max) * 360} height="14" fill="#3CF0A0" />
                  <text x="550" y="16" fill="#e7e9ea" fontSize="12">
                    {count}
                  </text>
                </g>
              ))}
            </svg>
          </section>
        );
      })}
    </div>
  );
}
