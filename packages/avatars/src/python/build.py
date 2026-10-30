import sys, os, random, itertools, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cairosvg
from PIL import Image
from oneofones import *
from textpath import text
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.dirname(os.path.dirname(HERE)); SV, PV = f"{OUT}/svg", f"{OUT}/previews"
CATS = {"Background": BG, "Body": SKIN, "Eyes": EYES, "Headwear": HEADWEAR, "Eyewear": EYEWEAR, "Clothing": CLOTHING, "Accessory": ACCESSORY}
LEGEND = {"Gold", "Obsidian", "Glitch"}; RARE = {"Crown", "VR Goggles", "Monocle"}
UNC = {"Headphones", "Bucket Hat", "Visor", "Shades", "Bomber", "Puffer", "Blazer", "Chain", "Seed Pendant"}
def valid(t): return not (t["Clothing"] == "Turtleneck" and t["Accessory"] == "Scarf")
def tier(t):
    if "_1of1" in t: return "1/1"
    if t["Body"] in LEGEND: return "LEGENDARY"
    if set(t.values()) & RARE: return "RARE"
    if len(set(t.values()) & UNC) >= 2: return "UNCOMMON"
    return "COMMON"
def all_combos():
    """distinct visual outputs: VR Goggles hide the eyes, so eye choice collapses to one under VR"""
    keys = list(CATS)
    n = 0; tiers = {}
    for combo in itertools.product(*[list(CATS[k]) for k in keys]):
        t = dict(zip(keys, combo))
        if not valid(t): continue
        if t["Eyewear"] == "VR Goggles" and t["Eyes"] != "Idle": continue
        n += 1; tr = tier(t); tiers[tr] = tiers.get(tr, 0) + 1
    return n, tiers

def svgdoc(w, h, body): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{body}</svg>'
def tile(art, x, y, s): return f'<g transform="translate({x} {y}) scale({s/512})"><clipPath id="c{x}_{y}"><rect width="512" height="512"/></clipPath><g clip-path="url(#c{x}_{y})">{"".join(art.L)}</g></g>'
def T(s, x, y, size=14, fill="#E7E9EA", fam="geistmono", w=500, anchor="start", track=0.04):
    d, _ = text(s, fam, w, size, x, y, anchor=anchor, track=track); return f'<path d="{d}" fill="{fill}"/>'
def render(svg, path, w, h, scale=2):
    cairosvg.svg2png(bytestring=svg.encode(), write_to="/tmp/_r.png", output_width=w*scale, output_height=h*scale)
    Image.open("/tmp/_r.png").resize((w, h), Image.LANCZOS).save(path)
def art_of(t): return ONE_OF_ONES[t["_1of1"]]() if "_1of1" in t else pfp(t)
TCOL = {"COMMON": "#A9B0B4", "UNCOMMON": "#A6FAD3", "RARE": "#7CC4FF", "LEGENDARY": "#E9B949", "1/1": "#FF8AD0"}
DISC = "Unofficial community project. Not affiliated with xAI or X Corp."

# preview-only pick weights (illustrative; final mint weights are planned, not set)
PREVIEW_W = {"Crown": 0.12, "VR Goggles": 0.2, "Monocle": 0.2, "None": 1.6, "Lilac": 0.6, "Blazer": 0.35}
FLAGSHIP = dict(Background="Paper", Body="Mint", Eyes="Idle", Headwear="Cap", Eyewear="None", Clothing="Bomber", Accessory="Chain")
def genesis_preview(seed=10232):
    rng = random.Random(seed); keys = list(CATS); picks = [FLAGSHIP]
    forced = [dict(Body="Gold", Headwear="Crown"), dict(Body="Obsidian"), dict(Body="Glitch"), dict(Eyewear="VR Goggles"), dict(Eyewear="Monocle")]
    seen = {json.dumps(FLAGSHIP, sort_keys=True)}
    while len(picks) < 22:
        t = {}
        for k in keys:
            opts = [o for o in CATS[k] if not (k == "Body" and o in LEGEND)]
            w = [PREVIEW_W.get(o, 1.0) for o in opts]
            t[k] = rng.choices(opts, w)[0]
        if forced: t.update(forced.pop(0))
        if not valid(t) or json.dumps(t, sort_keys=True) in seen: continue
        seen.add(json.dumps(t, sort_keys=True)); picks.append(t)
    for i, name in zip((6, 13, 19), ONE_OF_ONES): picks.insert(i, {"_1of1": name})
    rng.shuffle(picks[1:]) if False else None
    order = [picks[0]] + random.Random(7).sample(picks[1:], len(picks)-1)
    return order

if __name__ == "__main__":
    n, tiers = all_combos(); print("combos", n, tiers)
    picks = genesis_preview()
    nums = [1] + sorted(random.Random(3).sample(range(2, 10001), 24))
    # per-PFP svgs
    for no, t in zip(nums, picks):
        open(f"{SV}/pfp-{no:04d}.svg", "w").write(svgdoc(512, 512, "".join(art_of(t).L)))
    for name, f in ONE_OF_ONES.items(): open(f"{SV}/1of1-{name.lower().replace(' ', '-')}.svg", "w").write(svgdoc(512, 512, "".join(f().L)))
    # grid
    S, G, LB, M, HD, FT = 300, 18, 34, 56, 116, 76
    W = M*2 + 5*S + 4*G; H = HD + 5*(S+LB) + 4*G + FT
    body = f'<rect width="{W}" height="{H}" fill="#0A0C0B"/>'
    body += T("BOTMINTX GENESIS", M, 70, 30, "#E7E9EA", "geist", 700, track=0.0) + T("25 OF 10,000  ·  PREVIEW RENDER  ·  SEED-GENERATED", W-M, 70, 13, "#71767B", anchor="end", track=0.06)
    body += f'<rect x="{M}" y="88" width="{W-2*M}" height="1" fill="#23282A"/>'
    for i, (no, t) in enumerate(zip(nums, picks)):
        x = M + (i % 5)*(S+G); y = HD + (i//5)*(S+LB+G)
        body += f'<g><clipPath id="r{i}"><rect x="{x}" y="{y}" width="{S}" height="{S}" rx="10"/></clipPath><g clip-path="url(#r{i})">{tile(art_of(t), x, y, S)}</g></g>'
        tr = tier(t); label = ("1/1 · " + t["_1of1"].upper()) if "_1of1" in t else tr
        by = y+S+22
        body += T(f"#{no:04d}", x, by, 13, "#E7E9EA", track=0.04)
        d, w_ = text(label, "geistmono", 500, 11, x+S, by, anchor="end", track=0.08)
        body += f'<path d="{d}" fill="{TCOL[tr]}"/>' + f'<circle cx="{x+S-w_-10}" cy="{by-4}" r="3.5" fill="{TCOL[tr]}"/>'
    body += f'<rect x="{M}" y="{H-62}" width="{W-2*M}" height="1" fill="#23282A"/>'
    body += T(DISC + "  Planned collection; nothing minted.", M, H-32, 12, "#71767B", track=0.04) + T("V6.2", W-M, H-32, 12, "#71767B", anchor="end", track=0.08)
    sg = svgdoc(W, H, body); open(f"{SV}/pfp-grid.svg", "w").write(sg); render(sg, f"{PV}/pfp-grid.png", W, H)
    # hero
    W2, H2, P, PM = 1800, 1100, 980, 60
    t = FLAGSHIP
    b = f'<rect width="{W2}" height="{H2}" fill="#0A0C0B"/>' + f'<g><clipPath id="hc"><rect x="{PM}" y="{PM}" width="{P}" height="{P}" rx="20"/></clipPath><g clip-path="url(#hc)">{tile(pfp(t), PM, PM, P)}</g></g>'
    X = PM + P + 80; XR = W2 - PM
    b += T("BOTMINTX GENESIS", X, PM+14, 13, "#71767B", track=0.08) + T("1 OF 10,000", XR, PM+14, 13, "#71767B", anchor="end", track=0.08)
    b += T("#0001", X-6, 230, 120, "#E7E9EA", "geist", 700, track=-0.02)
    tr = tier(t); d, w_ = text(tr, "geistmono", 500, 13, 0, 0, track=0.08)
    pw = w_ + 44
    b += f'<rect x="{X}" y="262" width="{pw}" height="34" rx="17" fill="none" stroke="{TCOL[tr]}" stroke-opacity="0.5" stroke-width="1.5"/>'
    b += f'<circle cx="{X+18}" cy="279" r="4" fill="{TCOL[tr]}"/>' + T(tr, X+30, 284, 13, TCOL[tr], track=0.08)
    yy = 380
    b += f'<rect x="{X}" y="{yy-38}" width="{XR-X}" height="1" fill="#23282A"/>'
    for k in CATS:
        b += T(k.upper(), X, yy, 12, "#71767B", track=0.08) + T(t[k], XR, yy, 20, "#E7E9EA", "geist", 500, anchor="end", track=0)
        b += f'<rect x="{X}" y="{yy+24}" width="{XR-X}" height="1" fill="#23282A"/>'; yy += 62
    b += T("Seed-generated · provenance via EAS on Base (planned)", X, yy+20, 12, "#71767B", track=0.04)
    b += T(DISC, X, PM+P-4, 12, "#71767B", track=0.04)
    sh = svgdoc(W2, H2, b); open(f"{SV}/pfp-hero.svg", "w").write(sh); render(sh, f"{PV}/pfp-hero.png", W2, H2)
    # traits sheet
    TS, TG, LC = 150, 14, 210
    rows = list(CATS) + ["1/1"]
    LEG = {"Gold", "Obsidian", "Glitch"}
    base = dict(Background="Paper", Body="Mint", Eyes="Idle", Headwear="None", Eyewear="None", Clothing="Tee", Accessory="None")
    W3 = M + LC + 11*(TS+TG) - TG + M; H3 = 130 + len(rows)*(TS+56) + 50
    b = f'<rect width="{W3}" height="{H3}" fill="#0A0C0B"/>' + T("BOTMINTX GENESIS · TRAIT SHEET", M, 70, 28, "#E7E9EA", "geist", 700, track=0) + f'<rect x="{M}" y="88" width="{W3-2*M}" height="1" fill="#23282A"/>'
    b += T(f"{n:,} DISTINCT VALID COMBINATIONS  +  3 ONE-OF-ONES", W3-M, 70, 13, "#71767B", anchor="end", track=0.06)
    for r, k in enumerate(rows):
        y = 116 + r*(TS+56)
        opts = list(ONE_OF_ONES) if k == "1/1" else list(CATS[k])
        b += T(k.upper(), M, y+TS/2-2, 15, "#E7E9EA", "geist", 600, track=0.04) + T(f"{len(opts)} OPTIONS", M, y+TS/2+20, 11, "#71767B", track=0.08)
        for j, o in enumerate(opts):
            x = M + LC + j*(TS+TG)
            if k == "1/1": art = ONE_OF_ONES[o]()
            else:
                tt = dict(base); tt[k] = o
                if k == "Eyes": tt["Background"] = "Mint Wash"
                art = pfp(tt)
            b += f'<g><clipPath id="t{r}_{j}"><rect x="{x}" y="{y}" width="{TS}" height="{TS}" rx="8"/></clipPath><g clip-path="url(#t{r}_{j})">{tile(art, x, y, TS)}</g></g>'
            if o in LEG or k == "1/1": b += f'<rect x="{x+TS/2-24}" y="{y+TS+30}" width="48" height="2" rx="1" fill="{TCOL["1/1" if k == "1/1" else "LEGENDARY"]}"/>'
            b += T(o.upper(), x+TS/2, y+TS+22, 10, "#A9B0B4", anchor="middle", track=0.08)
    b += T(DISC, M, H3-26, 12, "#71767B", track=0.04) + T("V6.2", W3-M, H3-26, 12, "#71767B", anchor="end", track=0.08)
    st = svgdoc(W3, H3, b); open(f"{SV}/pfp-traits.svg", "w").write(st); render(st, f"{PV}/pfp-traits.png", W3, H3)
    # 1024 samples
    S1 = [FLAGSHIP, dict(Background="Carbon", Body="Gold", Eyes="Idle", Headwear="Crown", Eyewear="None", Clothing="Blazer", Accessory="Seed Pendant"), {"_1of1": "Spacewalk"}]
    S1[2] = dict(Background="Lilac", Body="Fog", Eyes="Joy", Headwear="Headphones", Eyewear="None", Clothing="Hoodie", Accessory="Chain")
    for i, t in enumerate(S1, 1):
        d = svgdoc(512, 512, "".join(art_of(t).L)); open(f"{SV}/pfp-sample-{i}.svg", "w").write(d); render(d, f"{PV}/pfp-sample-{i}.png", 1024, 1024)
    json.dump({"combinations": n, "tiers": tiers, "options": {k: list(v) for k, v in CATS.items()}, "one_of_ones": list(ONE_OF_ONES),
               "grid": [{"no": no, "tier": tier(t), **t} for no, t in zip(nums, picks)]}, open(f"{OUT}/traits.json", "w"), indent=1)
    import subprocess; subprocess.run([sys.executable, f"{HERE}/sheets.py"], check=True)
