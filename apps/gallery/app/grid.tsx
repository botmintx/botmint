"use client";

import { useEffect, useMemo, useState } from "react";
import type { GalleryToken } from "../lib/load";

const LAYERS = ["archetype", "domain", "tier"] as const;

export function Grid({ tokens }: { tokens: GalleryToken[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("id");
  const [jump, setJump] = useState("");

  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(window.location.search);
      setQuery(window.location.search);
      setSort(params.get("sort") ?? "id");
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  const params = useMemo(() => new URLSearchParams(query), [query]);
  const visible = tokens
    .filter((token) => {
      for (const layer of LAYERS) {
        const selected = params.getAll(layer);
        if (selected.length === 0) continue;
        const value =
          layer === "tier" ? token.tier : layer === "domain" ? token.domain : token.archetype;
        if (!selected.includes(value)) return false;
      }
      return true;
    })
    .sort((a, b) => (sort === "rank" ? a.rank - b.rank : a.edition - b.edition));

  function toggle(layer: string, value: string) {
    const next = new URLSearchParams(window.location.search);
    const current = next.getAll(layer);
    next.delete(layer);
    const updated = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    for (const item of updated) next.append(layer, item);
    const search = next.toString();
    window.history.pushState(null, "", search ? `?${search}` : window.location.pathname);
    setQuery(window.location.search);
  }

  const options = {
    archetype: [...new Set(tokens.map((token) => token.archetype))].sort(),
    domain: [...new Set(tokens.map((token) => token.domain))].sort(),
    tier: [...new Set(tokens.map((token) => token.tier))].sort(),
  };

  return (
    <div>
      <form
        className="mb-8 flex flex-wrap gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const stem = jump.replace("#", "").padStart(4, "0");
          window.location.href = `/dev-sample/${stem}/`;
        }}
      >
        <label className="text-sm text-muted">
          Jump to
          <input
            className="ml-2 border border-line bg-carbon px-3 py-2 text-fog"
            value={jump}
            onChange={(event) => setJump(event.target.value)}
            placeholder="#0001"
            aria-label="Jump to an id"
          />
        </label>
        <button className="border border-line px-3 py-2 text-sm" type="submit">
          Open
        </button>
        <a
          className="border border-line px-3 py-2 text-sm"
          href={sort === "rank" ? "/" : "/?sort=rank"}
        >
          Sort by {sort === "rank" ? "id" : "rarity"}
        </a>
      </form>
      <div className="mb-8 grid gap-6 md:grid-cols-3">
        {LAYERS.map((layer) => (
          <fieldset key={layer} className="border border-line p-4">
            <legend className="px-2 text-sm text-muted">{layer}</legend>
            <div className="flex flex-col gap-2">
              {options[layer].map((value) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={params.getAll(layer).includes(value)}
                    onChange={() => toggle(layer, value)}
                  />
                  {value}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((token) => (
          <li key={token.tokenId} className="border border-line bg-carbon">
            <a href={`/dev-sample/${token.stem}/`} className="block p-4">
              <img
                alt=""
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(token.svg)}`}
                className="mb-4 aspect-square w-full bg-void"
              />
              <p className="text-xs text-mint">{token.tokenId}</p>
              <h2 className="mt-1 text-lg">{token.name}</h2>
              <p className="mt-2 text-sm text-muted">
                {token.archetype} · {token.tier} · rank {token.rank}
              </p>
              <p className="mt-2 font-mono text-xs text-muted">DNA {token.dna}</p>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
