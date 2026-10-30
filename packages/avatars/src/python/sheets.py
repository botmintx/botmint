"""v6.2 QA sheets: stress combos + headwear fit."""
import sys
import importlib.util as _u, os as _os
# load THIS folder's build.py explicitly (never ../_build/build.py, which regenerates the brand assets)
_sp = _u.spec_from_file_location("mv6build", _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "build.py"))
_m = _u.module_from_spec(_sp); _sp.loader.exec_module(_m)
globals().update({k: v for k, v in vars(_m).items() if not k.startswith("__")})
from traits import *
import os
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.dirname(os.path.dirname(HERE)); SV, PV = f"{OUT}/svg", f"{OUT}/previews"
def sheet(rows, cols, cells, title, sub, S=200, path=None, colhead=None, rowhead=None):
    G, M, HD, LW = 10, 40, 110, 150 if rowhead else 0
    W = M*2 + LW + cols*S + (cols-1)*G; H = HD + rows*(S+G) + 70 + (30 if colhead else 0)
    b = f'<rect width="{W}" height="{H}" fill="#0A0C0B"/>' + T(title, M, 62, 26, "#E7E9EA", "geist", 700, track=0) + T(sub, W-M, 62, 12, "#71767B", anchor="end", track=.06)
    b += f'<rect x="{M}" y="80" width="{W-2*M}" height="1" fill="#23282A"/>'
    y0 = HD + (30 if colhead else 0)
    if colhead:
        for j, c in enumerate(colhead): b += T(c.upper(), M+LW+j*(S+G), HD+12, 11, "#A9B0B4", track=.08)
    for i in range(rows):
        if rowhead: b += T(rowhead[i].upper(), M, y0+i*(S+G)+S/2+4, 11, "#A9B0B4", track=.08)
        for j in range(cols):
            t = cells[i][j]; x = M+LW+j*(S+G); y = y0+i*(S+G)
            if t is None: b += f'<rect x="{x}" y="{y}" width="{S}" height="{S}" rx="8" fill="#151918"/>' + T("INVALID", x+S/2, y+S/2+4, 10, "#4A5257", anchor="middle"); continue
            b += f'<g><clipPath id="q{i}_{j}"><rect x="{x}" y="{y}" width="{S}" height="{S}" rx="8"/></clipPath><g clip-path="url(#q{i}_{j})">{tile(pfp(t), x, y, S)}</g></g>'
    b += T(DISC + "  QA sheet; not a mint.", M, H-28, 11, "#71767B") + T("V6.2", W-M, H-28, 11, "#71767B", anchor="end", track=.08)
    s = svgdoc(W, H, b); name = path.split("/")[-1].replace(".png", ".svg")
    open(f"{SV}/{name}", "w").write(s); render(s, path, W, H)
BGS = list(BG); SKINS = ["Mint", "Cobalt", "Fog", "Graphite", "Gold", "Obsidian", "Lilac"]
def stress():
    hws = list(HEADWEAR); ews = list(EYEWEAR)
    cells = [[dict(Background=BGS[(i+j) % 8], Body=SKINS[i], Eyes="Idle", Headwear=h, Eyewear=e, Clothing="Hoodie", Accessory="None")
              for j, e in enumerate(ews)] for i, h in enumerate(hws)]
    sheet(7, 6, cells, "STRESS · HEADWEAR × EYEWEAR", "7 × 6 = 42 COMBOS", 190, f"{PV}/pfp-stress.png", ews, hws)
    cl = list(CLOTHING); ac = list(ACCESSORY)
    cells = [[(dict(Background=BGS[(i+j+3) % 8], Body=SKINS[(i+j) % 7], Eyes="Idle", Headwear="None", Eyewear="None", Clothing=c, Accessory=x)
               if valid(dict(Clothing=c, Accessory=x)) else None) for j, x in enumerate(ac)] for i, c in enumerate(cl)]
    sheet(7, 5, cells, "STRESS · CLOTHING × ACCESSORY", "7 × 5 = 35 (1 INVALID)", 190, f"{PV}/pfp-stress-body.png", ac, cl)
def fit():
    bodies = [("Mint", "Paper", "Bomber"), ("Cobalt", "Butter", "Tee"), ("Gold", "Carbon", "Blazer")]
    hws = list(HEADWEAR)
    cells = [[dict(Background=bg, Body=sk, Eyes="Idle", Headwear=h, Eyewear="None", Clothing=c, Accessory="None") for h in hws] for sk, bg, c in bodies]
    sheet(3, 7, cells, "HEADWEAR FIT", "EVERY HAT ON THREE BODIES", 260, f"{PV}/pfp-headwear-fit.png", hws, [b[0] for b in bodies])
if __name__ == "__main__":
    which = sys.argv[1:] or ["stress", "fit"]
    if "stress" in which: stress()
    if "fit" in which: fit()
