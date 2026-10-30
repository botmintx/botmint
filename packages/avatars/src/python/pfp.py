"""Botmintx v6 - premium PFP generator. 512 grid, flat fills + one flat shadow tone per material, no outlines."""
import sys, math, colorsys
import os as _os; sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from geo import *
from shapely.geometry import box as sbox, MultiPolygon
from shapely.ops import unary_union

def se(cx, cy, a, b, n, N=280):
    pts = []
    for i in range(N):
        t = 2*math.pi*i/N; c, s = math.cos(t), math.sin(t)
        pts.append((cx+a*math.copysign(abs(c)**(2/n), c), cy+b*math.copysign(abs(s)**(2/n), s)))
    return Polygon(pts)
def qlens(x1, y1, x2, y2, bulge):
    mx, my = (x1+x2)/2, (y1+y2)/2; dx, dy = x2-x1, y2-y1; L = math.hypot(dx, dy); nx, ny = -dy/L, dx/L
    a = bez((x1, y1), (mx+nx*bulge, my+ny*bulge), (x2, y2)); b = bez((x2, y2), (mx-nx*bulge, my-ny*bulge), (x1, y1))
    return Polygon(a+b[1:])
def rbox(x0, y0, x1, y1, r): return sbox(x0+r, y0+r, x1-r, y1-r).buffer(r, resolution=24)
def line(pts, w): return LineString(pts).buffer(w/2, resolution=16)
def shade(h, f=0.80, sat=1.0):
    """f<1: mix toward ink (multiply-like, keeps hue calm); f>1: mix toward white"""
    h = h.lstrip('#'); c = [int(h[i:i+2], 16) for i in (0, 2, 4)]
    if f <= 1:
        ink = (14, 17, 16); k = (1-f)*1.6
        c = [v*(1-k)+i*k for v, i in zip(c, ink)]
    else:
        k = min(1, (f-1)); c = [v*(1-k)+255*k for v in c]
    return '#%02X%02X%02X' % tuple(max(0, min(255, round(v))) for v in c)
CANVAS = sbox(0, 0, 512, 512)

# ---------------- the character (approved logo head x3) ----------------
HEAD = se(256, 262, 150, 138, 4.0)
EL, ER, EY, EW, EH = 217, 295, 250, 37.5, 96
def leaf(x1, y1, x2, y2, b1, b2):
    """asymmetric two-curve leaf: b1 = upper belly, b2 = lower belly (cubic-ish via two quads)"""
    mx, my = (x1+x2)/2, (y1+y2)/2; dx, dy = x2-x1, y2-y1; L = math.hypot(dx, dy); nx, ny = -dy/L, dx/L
    # control points pushed toward the tip a little so the belly sits near the base, tip stays sharp
    cx, cy = x1+dx*0.42, y1+dy*0.42
    a = bez((x1, y1), (cx+nx*b1*2, cy+ny*b1*2), (x2, y2), 40); bb = bez((x2, y2), (cx-nx*b2*2, cy-ny*b2*2), (x1, y1), 40)
    return Polygon(a+bb[1:]).buffer(0)
def sprout_parts():
    stem = unary_union([sbox(248.5, 89, 263.5, 142), circle(256, 89, 8.7)])
    L = leaf(262, 91, 196, 52, 13, 9.5); R = leaf(250, 91, 334, 37, 17, 13)
    return stem, [(L, (262, 91, 196, 52)), (R, (250, 91, 334, 37))]
def sprout():
    stem, lv = sprout_parts(); return unary_union([stem] + [g for g, _ in lv])
def arc(cx, cy, w=46, h=26, t=18):
    return taper(bez((cx-w/2, cy+h/2), (cx, cy-h*1.15), (cx+w/2, cy+h/2)), t/2, t/2)
EYES = {
 "Idle":   lambda: [capsule(EL, EY, EW, EH), capsule(ER, EY, EW, EH)],
 "Joy":    lambda: [arc(EL, EY-4), arc(ER, EY-4)],
 "Wink":   lambda: [capsule(EL, EY, EW, EH), arc(ER, EY-4)],
 "Wide":   lambda: [capsule(EL-3, EY-4, 43, 110), capsule(ER+3, EY-4, 43, 110)],
 "Sleepy": lambda: [capsule(EL, EY, EW, EH).intersection(sbox(0, EY+4, 512, 512)), capsule(ER, EY, EW, EH).intersection(sbox(0, EY+4, 512, 512))],
 "Glance": lambda: [capsule(EL+20, EY-6, EW, EH-8), capsule(ER+20, EY-6, EW, EH-8)],
 "Focus":  lambda: [capsule(EL, EY+12, EW, 62), capsule(ER, EY+12, EW, 62)],
}
TORSO = unary_union([rbox(96, 392, 416, 700, 92), rbox(60, 480, 452, 760, 120)]).convex_hull.intersection(sbox(0, 0, 512, 600))

import itertools
_gid = itertools.count()
class Grad:
    """linear or radial gradient in objectBoundingBox units. stops: (offset, colour[, opacity])"""
    def __init__(self, kind, stops, **at): self.kind, self.stops, self.at = kind, stops, at
    def defs(self, gid):
        st = "".join(f'<stop offset="{s[0]}" stop-color="{s[1]}" stop-opacity="{s[2] if len(s) > 2 else 1}"/>' for s in self.stops)
        at = " ".join(f'{k}="{v}"' for k, v in self.at.items())
        tag = "linearGradient" if self.kind == "lin" else "radialGradient"
        return f'<{tag} id="{gid}" {at}>{st}</{tag}>'
def lin(stops, x1=0, y1=0, x2=1, y2=1): return Grad("lin", stops, x1=x1, y1=y1, x2=x2, y2=y2)
def rad(stops, cx=.5, cy=.5, r=.5, fx=None, fy=None):
    return Grad("rad", stops, cx=cx, cy=cy, r=r, fx=cx if fx is None else fx, fy=cy if fy is None else fy)
class Art:
    def __init__(self): self.L = []
    def add(self, g, fill, **kw):
        if isinstance(g, str): self.L.append(g); return
        if g is None or g.is_empty: return
        if g.geom_type not in ("Polygon", "MultiPolygon"):          # drop stray lines/points from intersections
            polys = [x for x in getattr(g, "geoms", []) if x.geom_type in ("Polygon", "MultiPolygon")]
            if not polys: return
            g = unary_union(polys)
        if isinstance(fill, Grad):
            gid = f"g{next(_gid)}"; self.L.append(f'<defs>{fill.defs(gid)}</defs>'); fill = f"url(#{gid})"
        extra = "".join(f' {k.replace("_","-")}="{v}"' for k, v in kw.items())
        self.L.append(f'<path fill="{fill}" fill-rule="evenodd"{extra} d="{d_of(g)}"/>')
    def soft(self, g, color, op, r=8, n=6, clip=None):
        """soft-edged shadow/light: n stacked offsets of g, opacities chosen so the core reaches op"""
        if g is None or g.is_empty: return
        n = max(n, min(18, int(r*1.6)))
        a = 1-(1-op)**(1/n)
        for i in range(n):
            d = -r + 2*r*(i+0.5)/n
            s = g.buffer(d, resolution=16)
            if clip is not None: s = s.intersection(clip)
            self.add(s, color, fill_opacity=f"{a:.4f}")
    def svg(self, size=512):
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="{size}" height="{size}">'+"".join(self.L)+'</svg>'

# ---------------- palettes ----------------
BG = {"Mint Wash": "#CDF3E0", "Carbon": "#111514", "Paper": "#F2EEE6", "Lilac": "#DDD5F7",
      "Sky": "#C6E0F5", "Butter": "#F6E6B4", "Coral": "#F5C3B2", "Sage": "#B3C9B9"}
SKIN = {"Mint": "#3CF0A0", "Spearmint": "#A6FAD3", "Deep Mint": "#12B57A", "Fog": "#E7E9EA",
        "Graphite": "#4A5257", "Lilac": "#B79CFF", "Cobalt": "#5B7CFF", "Sky": "#7CC4FF",
        "Gold": "#E9B949", "Obsidian": "#1A1D1F", "Glitch": "#3CF0A0"}
SKIN_SH = {"Gold": "#B9852A", "Obsidian": "#0B0C0D"}
def skin_cols(s):
    base = SKIN[s]; sh = SKIN_SH.get(s, shade(base, 0.80, 1.0))
    sprout = "#3CF0A0" if s == "Obsidian" else base
    return base, sh, sprout
