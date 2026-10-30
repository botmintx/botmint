"""Botmintx v6.2 traits - vector 3D (vinyl-toy look).
One key light from the top-left. Every surface: base colour + a volume overlay (dome or cylinder),
soft core shadow, faint bounce on the shadow side, soft contact/AO shadows where parts meet. No outlines."""
from pfp import *
INK = "#0B0D0C"; WHITE = "#FAFAF7"
GOLD, GOLD_SH, GOLD_HI = "#E9B949", "#A87822", "#FFF0B8"
LIGHT = (-1.0, -0.82)
def cel(g, k): return g.difference(affinity.translate(g, LIGHT[0]*k, LIGHT[1]*k))
def mix(a, b, t):
    a = [int(a[i:i+2], 16) for i in (1, 3, 5)]; b = [int(b[i:i+2], 16) for i in (1, 3, 5)]
    return '#%02X%02X%02X' % tuple(round(x*(1-t)+y*t) for x, y in zip(a, b))
def dashes(path, w=3.2, on=7, off=6):
    ls = LineString(path); out = []; d = 0
    while d < ls.length:
        seg = [ls.interpolate(d), ls.interpolate(min(ls.length, d+on))]
        out.append(LineString([(p.x, p.y) for p in seg]).buffer(w/2, resolution=8)); d += on+off
    return unary_union(out)

# ---------- materials (overlays work on any base colour) ----------
DOME = rad([(0, "#FFFFFF", .30), (.42, "#FFFFFF", 0), (.80, "#000000", .10), (1, "#000000", .26)], .34, .24, .95)
DOME_SOFT = rad([(0, "#FFFFFF", .20), (.5, "#FFFFFF", 0), (.85, "#000000", .08), (1, "#000000", .18)], .32, .2, 1.0)
CYL = lin([(0, "#000000", .16), (.22, "#FFFFFF", .20), (.42, "#FFFFFF", 0), (.78, "#000000", .14), (.94, "#000000", .26), (1, "#000000", .16)], 0, 0, 1, 0)
CYL_V = lin([(0, "#FFFFFF", .22), (.45, "#FFFFFF", 0), (.85, "#000000", .16), (1, "#000000", .30)], 0, 0, 0, 1)
PUFF = lin([(0, "#FFFFFF", .28), (.35, "#FFFFFF", .04), (.75, "#000000", .10), (1, "#000000", .30)], 0, 0, 0, 1)
def GOLD_M(): return lin([(0, "#FFF3C4"), (.16, "#F6D366"), (.38, "#D19E35"), (.52, "#8F641D"), (.66, "#D7A43F"), (.84, "#FBE6A0"), (1, "#B9852A")], 0, 0, .9, 1)
def surf(a, g, col, over=DOME, **kw):
    a.add(g, col, **kw); a.add(g, over)
def spec(a, cx, cy, rx, ry, rot=-22, op=.55, crisp=False):
    e = ell(cx, cy, rx, ry, rot)
    a.add(e, rad([(0, "#FFFFFF", op), (.6, "#FFFFFF", op*.35), (1, "#FFFFFF", 0)]))
    if crisp: a.add(ell(cx-rx*.25, cy-ry*.1, rx*.32, ry*.32, rot), "#FFFFFF", fill_opacity=".85")

# ---------- curved bands that wrap the head ----------
HEADW = 150
def wc(y, sag, x): u = min(1, abs(x-256)/(HEADW+10)); return y + sag*(1-u*u)
def above(y, sag): return Polygon([(-20, -80)] + [(x, wc(y, sag, x)) for x in range(-20, 533, 4)] + [(532, -80)])
def wband(y0, y1, sag=10, grow=6):
    top = [(x, wc(y0, sag, x)) for x in range(-20, 533, 4)]; bot = [(x, wc(y1, sag, x)) for x in range(532, -21, -4)]
    return Polygon(top+bot).intersection(HEAD.buffer(grow, resolution=48))

# ---------- head (body-layer coordinates) ----------
HEAD_IN_BODY = affinity.translate(affinity.scale(HEAD, 0.84, 0.84, origin=(256, 60)), 0, 50)
NECKSH = affinity.translate(HEAD_IN_BODY, 8, 18)
def folds(a, body):
    for g, op in ((leaf(116, 540, 170, 446, 9, 6), .09), (leaf(396, 540, 342, 446, 9, 6), .13)):
        a.soft(g.intersection(body), INK, op, r=10, n=6, clip=body)
    a.soft(leaf(104, 476, 168, 410, 7, 6).intersection(body), "#FFFFFF", .12, r=10, n=6, clip=body)
def cloth(a, col, body=None, over=None):
    body = body or TORSO
    a.add(body, col); a.add(body, over or rad([(0, "#FFFFFF", .22), (.45, "#FFFFFF", 0), (.8, "#000000", .14), (1, "#000000", .30)], .28, .08, 1.05))
    a.add(cel(body, 12).intersection(sbox(256, 0, 512, 600)), "#FFFFFF", fill_opacity=".06")   # faint bounce on the shadow edge
    folds(a, body)

# ---------------- clothing ----------------
def cl_bare(a, skin):
    base, sh, _ = skin_cols(skin)
    if skin == "Gold": a.add(TORSO, GOLD_M()); a.add(TORSO, DOME_SOFT)
    else: cloth(a, base)
    seed = affinity.rotate(leaf(256, 494, 256, 440, 9, 9), 24, origin=(256, 467))
    a.add(seed, a.bg); a.add(seed.difference(affinity.translate(seed, 3, 4)), INK, fill_opacity=".35")
def cl_tee(a, skin, col="#F4F3EE"):
    cloth(a, col)
    inner = ell(256, 398, 80, 30); a.add(inner.intersection(TORSO), shade(col, 0.86))
    rib = ell(256, 404, 96, 42).difference(inner).intersection(TORSO)
    a.add(rib, shade(col, 0.95)); a.add(rib, CYL_V)
    a.add(dashes(bez((166, 420), (256, 468), (346, 420), 30), 2.4, 6, 6).intersection(TORSO).difference(ell(256, 400, 84, 36)), shade(col, 0.80))
def cl_hoodie(a, skin, col="#8E979C"):
    hood = rbox(116, 316, 396, 456, 66)
    surf(a, hood, shade(col, 0.95), DOME_SOFT)
    a.add(rbox(150, 336, 362, 456, 50), lin([(0, shade(col, 0.42)), (1, shade(col, 0.62))], 0, 0, 0, 1))
    cloth(a, col)
    a.add(LineString([(256, 424), (256, 600)]).buffer(1.6).intersection(TORSO), shade(col, 0.72))
    for x, dx in ((230, -4), (282, 4)):
        a.add(circle(x, 416, 6.5), shade(col, 0.55)); a.add(circle(x, 416, 6.5).difference(circle(x+1.5, 417.5, 6)), "#FFFFFF", fill_opacity=".25")
        s = line([(x, 416), (x+dx, 482)], 7)
        a.soft(affinity.translate(s, 4, 6), INK, .25, r=3, n=3, clip=TORSO)
        a.add(s, "#EDEFF0"); a.add(s, CYL)
        ag = rbox(x+dx-6, 476, x+dx+6, 502, 4); a.add(ag, "#3CF0A0"); a.add(ag, CYL)
    pocket = rbox(150, 506, 362, 640, 26)
    a.soft(affinity.translate(pocket, 0, -4).difference(pocket).intersection(TORSO), INK, .2, r=3, n=3)
    a.add(pocket, shade(col, 0.96)); a.add(pocket, DOME_SOFT)
    a.add(dashes([(162, 516), (350, 516)], 2.4, 6, 6), shade(col, 0.70))
    a.clip = unary_union([TORSO, hood])
def cl_bomber(a, skin, col="#3F4A35"):
    cloth(a, col)
    rib = TORSO.difference(affinity.translate(TORSO, 0, 30))
    a.add(rib, "#1E211C"); a.add(rib, CYL)
    a.add(unary_union([sbox(x, 360, x+2.2, 470) for x in range(64, 452, 8)]).intersection(rib), "#2E332B")
    for k in (10, 19):
        a.add(TORSO.difference(affinity.translate(TORSO, 0, k)).difference(TORSO.difference(affinity.translate(TORSO, 0, k-3.5))), "#FF7A1A")
    a.soft(affinity.translate(rib, 0, 6).difference(rib).intersection(TORSO), INK, .28, r=4, n=4)
    a.add(sbox(249, 412, 263, 600), "#262C22")
    a.add(unary_union([sbox(250 if (y//6) % 2 else 256, y, 256 if (y//6) % 2 else 262, y+3) for y in range(414, 600, 6)]), "#C9CFC4")
    tab = rbox(248, 426, 264, 458, 5); a.soft(affinity.translate(tab, 3, 5), INK, .3, r=3, n=3)
    a.add(tab, lin([(0, "#F4F6F2"), (.5, "#C9CFC4"), (1, "#8C948A")], 0, 0, 1, 1)); a.add(rbox(253, 446, 259, 452, 2), "#3F4A35")
def cl_turtle(a, skin, col="#E6DFCF"):
    tube = rbox(194, 356, 318, 458, 26)
    cloth(a, col)
    a.soft(affinity.translate(tube, 6, 10).difference(tube).intersection(TORSO), INK, .22, r=6, n=4)
    a.add(tube, col); a.add(tube, CYL)
    a.add(unary_union([rbox(x, 396, x+5, 454, 2.5) for x in range(206, 312, 12)]).intersection(tube), INK, fill_opacity=".08")
    for y in (420, 440): a.soft(ell(256, y, 64, 3).intersection(tube), INK, .16, r=3, n=3)
def cl_puffer(a, skin, col="#F25C3C"):
    body = TORSO
    for y in (446, 494):
        body = body.difference(circle(TORSO.bounds[0]-2, y, 14)).difference(circle(TORSO.bounds[2]+2, y, 14))
    a.add(body, col)
    for y0, y1 in ((380, 446), (446, 494), (494, 560), (560, 620)):
        seg = body.intersection(sbox(0, y0, 512, y1)); a.add(seg, PUFF)
    a.add(body, CYL)
    for y in (446, 494): a.add(sbox(0, y-1.5, 512, y+1.5).intersection(body), shade(col, 0.55))
    collar = rbox(172, 382, 340, 442, 28)
    a.soft(affinity.translate(collar, 4, 8), INK, .25, r=5, n=4, clip=body)
    a.add(collar, shade(col, 1.06)); a.add(collar, PUFF); a.add(collar, CYL)
    a.add(sbox(253, 442, 259, 600).intersection(body), shade(col, 0.6))
    a.add(rbox(249, 448, 263, 472, 4), lin([(0, "#FFFFFF"), (1, "#B7BEC2")], 0, 0, 1, 1))
def cl_blazer(a, skin, col="#1F2A44"):
    cloth(a, col)
    v = Polygon([(204, 398), (308, 398), (256, 520)])
    a.add(v, WHITE); a.add(v, lin([(0, "#000000", .0), (1, "#000000", .14)], 0, 0, 1, 1))
    for cp in (Polygon([(214, 398), (252, 398), (236, 430)]), Polygon([(260, 398), (298, 398), (276, 430)])):
        a.soft(affinity.translate(cp, 2, 4), INK, .2, r=2, n=3); a.add(cp, "#FFFFFF")
    knot = rbox(245, 418, 267, 438, 5); tie = Polygon([(247, 436), (265, 436), (262, 520), (250, 520)])
    a.add(tie, "#3CF0A0"); a.add(tie, CYL); a.add(knot, "#2FD68D"); a.add(knot, DOME)
    lap_l = roundc(Polygon([(190, 400), (230, 400), (256, 520), (228, 520), (176, 452), (194, 438), (178, 430)]), 2)
    lap_r = affinity.scale(lap_l, -1, 1, origin=(256, 0))
    for lp in (lap_l, lap_r):
        a.soft(affinity.translate(lp, 4, 6).difference(lp).intersection(TORSO), INK, .3, r=3, n=3)
        a.add(lp, shade(col, 1.12)); a.add(lp, lin([(0, "#FFFFFF", .16), (1, "#000000", .18)], 0, 0, 1, 1))
    for y in (528, 560):
        a.add(circle(236, y, 5.5), "#11182B"); a.add(circle(236, y, 5.5), DOME)
    a.add(rbox(132, 464, 172, 474, 3), shade(col, 0.6))
    sq = Polygon([(136, 466), (146, 448), (154, 460), (162, 450), (168, 466)]).buffer(1.5)
    a.add(sq, WHITE); a.add(sq, lin([(0, "#000000", 0), (1, "#000000", .15)], 0, 0, 1, 1))
CLOTHING = {"Bare": cl_bare, "Tee": cl_tee, "Hoodie": cl_hoodie, "Bomber": cl_bomber,
            "Turtleneck": cl_turtle, "Puffer": cl_puffer, "Blazer": cl_blazer}

# ---------------- neck accessories (each casts a small soft shadow on the clothes) ----------------
NECK_CURVE = bez((176, 420), (256, 520), (336, 420), 34)
def drop(a, g, op=.32, r=3, dx=3, dy=6): a.soft(affinity.translate(g, dx, dy), INK, op, r=r, n=3, clip=TORSO)
def ac_none(a): pass
def ac_chain(a):
    pts = NECK_CURVE; rings, bars, glints = [], [], []
    for i in range(2, len(pts)-2):
        (x0, y0), (x1, y1) = pts[i-1], pts[i+1]; x, y = pts[i]
        ang = math.degrees(math.atan2(y1-y0, x1-x0))
        if i % 2:
            rings.append(ell(x, y, 8.5, 5.8, ang).difference(ell(x, y, 4.4, 2.0, ang)))
            glints.append(ell(x-3, y-2.5, 2.2, 1.2, ang))
        else: bars.append(ell(x, y, 6, 2.6, ang))
    R, B = unary_union(rings), unary_union(bars)
    drop(a, unary_union([R, B]))
    a.add(B, lin([(0, "#C9952F"), (1, "#7A5418")], 0, 0, 0, 1)); a.add(R, GOLD_M())
    a.add(cel(R, 2.2).intersection(R), GOLD_SH, fill_opacity=".7"); a.add(unary_union(glints), "#FFFFFF", fill_opacity=".85")
def ac_pendant(a):
    cord = LineString(NECK_CURVE).buffer(2.2); drop(a, cord, .25, 2); a.add(cord, "#1A1D1F")
    p = affinity.rotate(leaf(256, 504, 256, 456, 8, 8), 24, origin=(256, 480))
    bail = rbox(250, 448, 262, 460, 4)
    drop(a, unary_union([p, bail]), .35, 4, 4, 8)
    a.add(bail, GOLD_M()); a.add(p, GOLD_M()); a.add(cel(p, 4).intersection(p), GOLD_SH, fill_opacity=".6")
    a.add(affinity.rotate(sbox(255, 462, 257.2, 498), 24, origin=(256, 480)).intersection(p.buffer(-3)), GOLD_SH)
    a.add(affinity.rotate(ell(250, 470, 2.4, 7), 24, origin=(256, 480)), "#FFFFFF", fill_opacity=".8")
def ac_scarf(a, col="#E2483D"):
    wrap = rbox(146, 378, 366, 446, 26); tail = affinity.rotate(rbox(282, 410, 330, 534, 20), -10, origin=(306, 420))
    drop(a, tail, .3, 5, 5, 8)
    a.add(tail, col); a.add(tail, CYL)
    for y in (474, 490): a.add(affinity.rotate(rbox(282, y, 330, y+5, 2.5), -10, origin=(306, 420)).intersection(tail), shade(col, 0.66))
    fr = unary_union([affinity.rotate(rbox(x, 526, x+6, 548, 3), -10, origin=(306, 420)) for x in (286, 296, 306, 316)])
    a.add(fr, shade(col, 0.9))
    drop(a, wrap, .3, 6, 4, 10)
    a.add(wrap, col); a.add(wrap, CYL_V); a.add(wrap, CYL)
    for g in (leaf(176, 440, 236, 384, 5, 4), leaf(240, 446, 300, 386, 5, 4), leaf(304, 446, 350, 396, 4, 4)):
        a.soft(g.intersection(wrap), INK, .22, r=4, n=4, clip=wrap)
def ac_lanyard(a, col="#3CF0A0"):
    straps = unary_union([line([(196, 400), (246, 470)], 9), line([(316, 400), (266, 470)], 9)])
    drop(a, straps, .25, 3)
    a.add(straps, col); a.add(straps, CYL)
    clip_ = rbox(250, 456, 262, 472, 3); card = rbox(224, 466, 288, 516, 6)
    drop(a, card, .35, 4, 4, 8)
    a.add(clip_, lin([(0, "#E7E9EA"), (1, "#71767B")], 0, 0, 1, 1))
    a.add(card, WHITE); a.add(card, DOME_SOFT)
    a.add(rbox(230, 472, 282, 483, 3), col)
    a.add(rbox(230, 489, 262, 494, 2), "#A9B0B4"); a.add(rbox(230, 499, 252, 504, 2), "#C9CFD2")
    a.add(rbox(266, 488, 282, 504, 3), INK)
ACCESSORY = {"None": ac_none, "Chain": ac_chain, "Seed Pendant": ac_pendant, "Scarf": ac_scarf, "Lanyard": ac_lanyard}

# ---------------- headwear ----------------
# each returns dict: back / front / top (lists of (geom, fill, kw)), ao (list of (geom, op, r)),
#                    sprout: "after" | "between" ; clip: y where the stem enters the hat
def I(g, f, **kw): return (g, f, kw)
def hw_none(): return dict()
def hw_cap(col="#262B30"):
    """baseball cap, seen slightly from above: domed six-panel crown, long curved brim projecting forward."""
    base = lambda x: (lambda u: 144 - 6*u*u + 32*u**4)(min(1.05, abs(x-256)/156))            # crown's front edge (sags toward the viewer)
    shell = unary_union([HEAD.buffer(8, resolution=48).intersection(sbox(0, 0, 512, 200)), ell(256, 104, 124, 46)]).convex_hull
    crown = shell.intersection(Polygon([(0, 0), (512, 0)] + [(x, base(x)) for x in range(512, -1, -4)])).buffer(-11, resolution=24).buffer(11, resolution=24)
    # brim: attached along the crown edge, front edge sweeps forward/down, ends curl back up (curved bill)
    bx0, bx1 = 126, 386
    xs = [bx0 + (bx1-bx0)*i/90 for i in range(91)]
    def front_e(x): v = (x-256)/((bx1-bx0)/2); return base(x) + 2 + 44*max(0, 1-v*v)**0.5
    brim = Polygon([(x, base(x)-2) for x in xs] + [(x, front_e(x)) for x in reversed(xs)]).buffer(5, resolution=24).buffer(-5, resolution=24)
    lip = brim.difference(affinity.translate(brim, 0, -5.5))                   # visible thickness of the front edge
    stitch = unary_union([dashes([(x, front_e(x) - k) for x in xs[6:-6] if front_e(x) - k > base(x) + 3], 1.9, 6, 4.5) for k in (8, 15, 22)]).intersection(brim.buffer(-2.5))
    # six panels: from the front we see the centre seam and the two front-side seams, all meeting at the button
    BT = (256, 60)
    seams = unary_union([line(bez(BT, (256+dx*.72, 74), (256+dx, base(256+dx)), 30), 2.4) for dx in (-112, 112)] +
                        [line([BT, (256, base(256))], 2.4)]).intersection(crown)
    panel_r = Polygon([BT, (256, 300), (420, 300), (420, 0), (256, 0)]).intersection(crown)
    side_r = Polygon([BT] + [p for p in bez(BT, (256+112*.72, 74), (368, base(368)), 30)] + [(368, 300), (512, 300), (512, 0)]).intersection(crown)
    eyelets = unary_union([ell(256+s*56, 90, 3.4, 2.4) for s in (-1, 1)])
    button = ell(BT[0], BT[1], 12, 6)
    front = [I(crown, col), I(panel_r, INK, fill_opacity=".10"), I(side_r, INK, fill_opacity=".14"), I(crown, DOME),
             I(seams, INK, fill_opacity=".42"), I(affinity.translate(seams, -1.6, 0).difference(seams).intersection(crown), "#FFFFFF", fill_opacity=".10"),
             I(eyelets, INK, fill_opacity=".55"),
             ("SOFT", affinity.translate(crown, 0, 6).intersection(brim), .40, 4, INK),            # crown's contact shadow on the brim
             I(brim, shade(col, 1.32)),
             I(brim, lin([(0, "#000000", .26), (.25, "#FFFFFF", .10), (.45, "#FFFFFF", .22), (.7, "#FFFFFF", 0), (1, "#000000", .30)], 0, 0, 1, 0)),
             I(brim, lin([(0, "#000000", .10), (.5, "#FFFFFF", .05), (1, "#FFFFFF", .14)], 0, 0, 0, 1)),
             I(stitch, "#FFFFFF", fill_opacity=".26"),
             I(brim.intersection(ell(212, 168, 64, 14, -6)), rad([(0, "#FFFFFF", .22), (1, "#FFFFFF", 0)])),
             I(lip, INK, fill_opacity=".55")]
    top = [I(affinity.translate(button, 1.5, 3), INK, fill_opacity=".35"), I(button, shade(col, 1.25)), I(button, DOME)]
    ao = [(affinity.translate(brim, 3, 11).difference(brim), .50, 7),
          (affinity.translate(crown, 0, 7).difference(crown).difference(brim), .32, 5)]
    return dict(front=front, top=top, ao=ao, sprout="after", clip=61, lift=44)
def hw_beanie(col="#E8D9C0"):
    dome = unary_union([HEAD.buffer(10, resolution=48), ell(256, 124, 128, 30)]).buffer(8).buffer(-8).intersection(above(170, 10))
    cuff = wband(144, 192, 10, 13)
    knit = unary_union([line(bez((256+40*math.sin(t), 98), (256+122*math.sin(t), 118), (256+168*math.sin(t), 168), 20), 3.4*math.cos(t)+.6)
                        for t in [math.radians(d) for d in range(-80, 81, 10)]]).intersection(dome.buffer(-4))
    ribs = unary_union([sbox(256+168*math.sin(t)-3*math.cos(t), 130, 256+168*math.sin(t)+3*math.cos(t), 230)
                        for t in [math.radians(d) for d in range(-84, 85, 6)]]).intersection(cuff)
    front = [I(dome, col), I(knit, INK, fill_opacity=".10"), I(dome, DOME)]
    fold = affinity.translate(cuff, 0, -9).difference(cuff).intersection(dome)
    front2 = [I(cuff, shade(col, 0.97)), I(ribs, INK, fill_opacity=".12"), I(cuff, CYL), I(cuff, CYL_V)]
    top = [I(ell(256, 101, 11, 4.5), INK, fill_opacity=".35")]
    ao = [(affinity.translate(cuff, 3, 12).difference(cuff), .45, 8)]
    return dict(front=front + [("SOFT", fold, .30)] + front2, top=top, ao=ao, sprout="after", clip=101, lift=14)
def hw_bucket(col="#C9B48A"):
    crown = roundc(Polygon([(140, 86), (372, 86), (412, 186), (100, 186)]), 30)
    band = wband(146, 168, 8, 60).intersection(crown)
    xs = list(range(62, 451, 4))
    top_e = lambda x: wc(166, 8, x)
    brim = Polygon([(x, top_e(x)) for x in xs] + [(x, top_e(x) + 20 + 8*(1-((x-256)/194)**2)) for x in reversed(xs)]).buffer(10).buffer(-10)
    edge = brim.difference(affinity.translate(brim, 0, -6))
    stitch = unary_union([dashes([(x, top_e(x) + k + (k-8)*.5*(1-((x-256)/194)**2)) for x in range(80, 433, 4)], 2.2, 6, 5) for k in (10, 20)]).intersection(brim.buffer(-3))
    crown_top = ell(256, 90, 110, 9)
    front = [I(crown, col), I(crown, CYL), I(crown, CYL_V), I(crown_top, shade(col, 1.08)), I(crown_top, DOME_SOFT),
             I(band, shade(col, 0.66)), I(band, CYL),
             I(brim, col), I(brim, lin([(0, "#FFFFFF", .22), (.7, "#FFFFFF", 0), (1, "#000000", .12)], 0, 0, 0, 1)), I(brim, CYL),
             I(stitch, INK, fill_opacity=".22"), I(edge, INK, fill_opacity=".35")]
    a_crown = affinity.translate(brim, 0, -14).difference(brim).intersection(crown)
    top = [I(ell(256, 89, 9, 4), INK, fill_opacity=".45")]
    ao = [(affinity.translate(brim, 4, 16).difference(brim), .55, 12)]
    return dict(front=front, top=top, ao=ao, sprout="after", clip=89, lift=20)
def hw_crown():
    sag = 12
    band = wband(146, 178, sag, 9)
    back = Polygon([(x, wc(140, -4, x)) for x in range(96, 417, 4)] + [(x, wc(148, sag, x)) for x in range(416, 95, -4)]).intersection(HEAD.buffer(9))
    pts = []
    for d in (-56, -21, 21, 56):
        t = math.radians(d); xc = 256 + 158*math.sin(t); w = 46*math.cos(t) + 8; yb = wc(146, sag, xc) + 2
        tri = roundc(Polygon([(xc-w/2, yb+4), (xc+w/2, yb+4), (xc, yb-50)]), 2)
        pts.append((tri, circle(xc, yb-52, 3*math.cos(t) + 5), xc))
    P = unary_union([p for p, _, _ in pts]); balls = unary_union([b for _, b, _ in pts])
    gem_c = ell(256, wc(160, sag, 256) + 2, 11, 10); gems_s = [ell(256+s*84, wc(160, sag, 256+s*84), 6.5, 8) for s in (-1, 1)]
    back_items = [I(back, lin([(0, "#5E3F10"), (1, "#9A6B1E")], 0, 0, 0, 1))]
    front = [I(P, GOLD_M()), I(P, CYL), I(balls, GOLD_M()), I(balls, DOME),
             I(band, GOLD_M()), I(band, CYL), I(band.difference(affinity.translate(band, 0, 3)), GOLD_HI, fill_opacity=".8"),
             I(band.difference(affinity.translate(band, 0, -3)), "#6B4A14", fill_opacity=".6"),
             I(gem_c, "#16C47F"), I(gem_c, DOME), I(ell(252, wc(160, sag, 256) - 2, 3.2, 2.4), "#FFFFFF", fill_opacity=".9")]
    for g in gems_s: front += [I(g, "#D93A3A"), I(g, DOME)]
    for _, b, xc in pts: front.append(I(circle(xc-2.4, b.centroid.y-2.4, 2), "#FFFFFF", fill_opacity=".85"))
    ao = [(affinity.translate(band, 3, 12).difference(band), .50, 8)]
    return dict(back=back_items, front=front, ao=ao, sprout="between")
def hw_phones(col="#1A1D1F", acc="#3CF0A0"):
    band = HEAD.buffer(17, resolution=48).difference(HEAD.buffer(3, resolution=48)).intersection(sbox(0, 0, 512, 236))
    pad = HEAD.buffer(4, resolution=48).difference(HEAD.buffer(-2, resolution=48)).intersection(sbox(196, 0, 316, 200))
    front = [I(band, col), I(band, lin([(0, "#FFFFFF", .22), (.5, "#FFFFFF", 0), (1, "#000000", .2)], 0, 0, 1, 1)), I(pad, "#2C3236")]
    for s in (-1, 1):
        cx = 256 + s*156
        shell_ = rbox(cx-28, 196, cx+28, 334, 28)
        cushion = affinity.translate(rbox(cx-24, 204, cx+24, 326, 22), -s*14, 0)
        plate = affinity.translate(rbox(cx-16, 222, cx+16, 308, 14), s*3, 0)
        front += [I(cushion, "#2C3236"), I(cushion, CYL), I(shell_, col), I(shell_, CYL), I(shell_, CYL_V),
                  I(plate, acc), I(plate, DOME), I(plate.difference(affinity.translate(plate, 2, 3)), "#FFFFFF", fill_opacity=".35")]
    ao = [(rbox(94, 204, 140, 330, 20), .40, 10), (rbox(372, 204, 418, 330, 20), .55, 10),
          (pad.buffer(4), .35, 5)]
    return dict(front=front, ao=ao, sprout="after")
def hw_headband(col=WHITE):
    b = wband(148, 184, 10, 7)
    s1, s2 = wband(156, 161, 10, 8), wband(168, 173, 10, 8)
    front = [I(b, col), I(s1, "#E2483D"), I(s2, "#3CF0A0"), I(b, CYL), I(b, CYL_V)]
    ao = [(affinity.translate(b, 2, 10).difference(b), .35, 6)]
    return dict(front=front, ao=ao, sprout="after")
HEADWEAR = {"None": hw_none, "Cap": hw_cap, "Beanie": hw_beanie, "Bucket Hat": hw_bucket, "Crown": hw_crown,
            "Headphones": hw_phones, "Headband": hw_headband}

# ---------------- eyewear (sits on the face; casts a soft shadow onto it) ----------------
def frame(cx, w=74, h=124, t=8):
    o = rbox(cx-w/2, EY-h/2, cx+w/2, EY+h/2, 24); return o, o.difference(o.buffer(-t))
def glint(region, x, w=12):
    return affinity.skew(sbox(x, 0, x+w, 512), xs=-28, origin=(x, EY)).intersection(region)
def ew_none(eyes): return dict()
def ew_specs(eyes, col="#14171A"):
    (ol, fl), (orr, fr) = frame(EL), frame(ER)
    f = unary_union([fl, fr, rbox(250, 224, 262, 236, 4), line([(180, 214), (112, 206)], 7), line([(332, 214), (400, 206)], 7)])
    lenses = unary_union([ol.buffer(-8), orr.buffer(-8)])
    return dict(shadow=[(affinity.translate(f, 6, 12), .30, 4)],
                items=[I(lenses, "#BFE0FF", fill_opacity=".10"), I(glint(lenses, 190).difference(unary_union(eyes)), "#FFFFFF", fill_opacity=".35"),
                       I(f, col), I(f, lin([(0, "#FFFFFF", .25), (.5, "#FFFFFF", 0), (1, "#000000", .3)], 0, 0, 1, 1))])
def ew_shades(eyes, col="#0B0D0E"):
    lens = unary_union([roundc(Polygon([(164, 196), (254, 196), (248, 296), (176, 306)]), 20), roundc(Polygon([(258, 196), (348, 196), (336, 306), (264, 296)]), 20)])
    br = unary_union([rbox(246, 202, 266, 216, 4), line([(170, 208), (108, 202)], 8), line([(342, 208), (404, 202)], 8)])
    return dict(hide=True, shadow=[(affinity.translate(unary_union([lens, br]), 6, 14), .40, 8)],
                items=[I(br, col), I(lens, lin([(0, "#20262A"), (.55, "#0B0D0E"), (1, "#151A1D")], 0, 0, 0, 1)),
                       I(unary_union(eyes).intersection(lens.buffer(-8)), "#2A3136", fill_opacity=".8"),
                       I(unary_union([glint(lens.buffer(-6), 180, 18), glint(lens.buffer(-6), 274, 18)]), "#FFFFFF", fill_opacity=".16"),
                       I(lens.difference(affinity.translate(lens, 0, 4)), "#FFFFFF", fill_opacity=".18")])
def ew_visor(eyes, col="#0B0D0E", lit="#3CF0A0"):
    v = wband(198, 300, 8, 9)
    return dict(hide=True, shadow=[(affinity.translate(v, 4, 14).difference(v), .45, 8)],
                items=[I(v, lin([(0, "#262C30"), (.5, "#0B0D0E"), (1, "#14181A")], 0, 0, 0, 1)), I(v, CYL),
                       I(unary_union(eyes).intersection(v.buffer(-10)), lit), I(unary_union(eyes).intersection(v.buffer(-10)), DOME_SOFT),
                       I(wband(206, 216, 8, 4).intersection(v), "#FFFFFF", fill_opacity=".16"),
                       I(v.difference(affinity.translate(v, 0, -4)), "#000000", fill_opacity=".5")])
def ew_vr(eyes, col="#EDEFF0"):
    strap = wband(226, 262, 8, 6)
    box = rbox(132, 184, 380, 314, 44); depth = affinity.translate(box, 7, 9)
    panel = rbox(150, 202, 362, 296, 30)
    return dict(hide=True, eyes_irrelevant=True, shadow=[(affinity.translate(box, 10, 18), .40, 10)],
                items=[I(strap, "#1A1D1F"), I(strap, CYL), I(depth, shade(col, 0.62)), I(box, col), I(box, DOME),
                       I(box.difference(affinity.translate(box, 3, 3)), "#FFFFFF", fill_opacity=".6"),
                       I(panel, lin([(0, "#2A3136"), (.5, "#0E1113"), (1, "#181D20")], 0, 0, 0, 1)),
                       I(panel.difference(affinity.translate(panel, -3, -4)), "#FFFFFF", fill_opacity=".12"),
                       I(glint(panel.buffer(-4), 176, 24), "#FFFFFF", fill_opacity=".10"),
                       I(rbox(176, 272, 236, 280, 4), "#3CF0A0"), I(circle(338, 276, 5), "#3CF0A0")])
def ew_monocle(eyes):
    ring = circle(ER, EY, 64).difference(circle(ER, EY, 54))
    chain = unary_union([circle(*p, 2.6) for p in bez((350, 290), (384, 340), (362, 420), 22)])
    return dict(shadow=[(affinity.translate(ring, 5, 9), .55, 4)],
                items=[I(chain, GOLD_SH), I(circle(ER, EY, 54).difference(unary_union(eyes)), "#FFF6D8", fill_opacity=".12"),
                       I(glint(circle(ER, EY, 54), 262, 14).difference(unary_union(eyes)), "#FFFFFF", fill_opacity=".35"),
                       I(ring, GOLD_M()), I(ring.difference(affinity.translate(ring, 2, 2)), GOLD_HI, fill_opacity=".8")])
EYEWEAR = {"None": ew_none, "Specs": ew_specs, "Shades": ew_shades, "Visor": ew_visor, "VR Goggles": ew_vr, "Monocle": ew_monocle}

# ---------------- head ----------------
def head_items(skin, base, E, eyes_hidden):
    """the head as an ordered list of (geom, fill, kw); eyes are holes."""
    H = HEAD.difference(E)
    core = cel(HEAD, 40)
    wall = E.difference(affinity.translate(E, 4, 6))
    hole_ao = E.difference(affinity.translate(E, 0, 9))
    out = []
    if skin == "Gold":
        out += [I(H, GOLD_M()), I(H, DOME_SOFT)]
    elif skin == "Obsidian":
        out += [I(H, "#121517"), I(H, rad([(0, "#5A646B", .55), (.4, "#2A3034", .2), (1, "#000000", 0)], .3, .22, .8))]
    else:
        out += [I(H, base), I(H, DOME)]
    out += [("SOFTC", core.difference(E), .16, 22, INK)]
    rim = HEAD.difference(affinity.translate(HEAD, -6, -7)).difference(E)
    rc, ro = ("#3CF0A0", .75) if skin == "Obsidian" else ("#FFFFFF", .30)
    out += [I(rim, lin([(0, rc, 0), (.6, rc, 0), (.85, rc, ro*.6), (1, rc, ro)], 0, 0, 1, 1))]
    if not eyes_hidden:
        out += [I(wall, INK, fill_opacity=".55"), I(hole_ao, INK, fill_opacity=".22")]
    if skin == "Obsidian":
        out += [I(rbox(146, 152, 196, 176, 12).difference(E), "#FFFFFF", fill_opacity=".8"), I(ell(196, 184, 70, 34, -20).difference(E), rad([(0, "#FFFFFF", .22), (1, "#FFFFFF", 0)]))]
    elif skin == "Gold":
        out += [("SPEC", 186, 176, 60, 30, .7, True)]
    else:
        out += [("SPEC", 186, 176, 62, 30, .5, False)]
    return out

def glitch_split(g):
    bands = [(0, 150, 0), (150, 182, 18), (182, 312, 0), (312, 338, -14), (338, 512, 0)]
    return [(affinity.translate(g.intersection(sbox(0, y0, 512, y1)), dx, 0), dx) for y0, y1, dx in bands]
BODY_DY = -50
HEAD_T = "translate(256 60) scale(0.84) translate(-256 -60)"
def legendary_bg(skin, bg):
    if skin == "Gold":
        w = unary_union([Polygon([(256, 250), (256+900*math.cos(math.radians(a)), 250+900*math.sin(math.radians(a))),
                                  (256+900*math.cos(math.radians(a+11.25)), 250+900*math.sin(math.radians(a+11.25)))]) for a in range(0, 360, 22)])
        return [f'<path fill="#E9B949" fill-opacity="0.055" d="{d_of(w.intersection(CANVAS))}"/>']
    if skin == "Glitch":
        bars = unary_union([sbox(0, y, 512, y+h) for y, h in ((70, 6), (118, 3), (380, 4), (430, 8), (470, 3))])
        return [f'<path fill="#FF3EA5" fill-opacity="0.22" d="{d_of(bars)}"/>', f'<path fill="#2EC8FF" fill-opacity="0.22" d="{d_of(affinity.translate(bars, 26, 10).intersection(CANVAS))}"/>']
    return []

def draw_items(h, items, clip_head=None, split=False):
    for it in items:
        if it[0] == "SOFT":
            if len(it) == 3: _, g, op = it; r, col = 6, INK
            else: _, g, op, r, col = it
            if op > 0: h.soft(g, col, op, r=r, n=5, clip=clip_head)
        elif it[0] == "SOFTC":
            _, g, op, r, col = it; h.soft(g, col, op, r=r, n=10, clip=HEAD)
        elif it[0] == "SPEC":
            _, cx, cy, rx, ry, op, crisp = it; spec(h, cx, cy, rx, ry, op=op, crisp=crisp)
        else:
            g, f, kw = it
            if split:
                for piece, dx in glitch_split(g): h.add(piece, f, **kw)
            else: h.add(g, f, **kw)

def pfp(t):
    bg = BG[t["Background"]]
    a = Art(); a.bg = bg; a.clip = None
    skin = t["Body"]; base, sh, sp_col = skin_cols(skin)
    eyes = EYES[t["Eyes"]]()
    hw = HEADWEAR[t["Headwear"]](); ew = EYEWEAR[t["Eyewear"]](eyes)
    (t.get("_cloth") or CLOTHING[t["Clothing"]])(a, skin)
    ACCESSORY[t["Accessory"]](a)
    body_clip = a.clip or TORSO
    a.soft(NECKSH.intersection(body_clip.buffer(10)), INK, .30, r=14, n=8, clip=body_clip)            # head's soft cast shadow
    a.soft(ell(256, 396, 110, 12), INK, .22, r=8, n=5, clip=body_clip)                                 # contact AO at the neck join
    h = Art(); h.bg = bg
    E = unary_union(eyes)
    glitch = skin == "Glitch"
    if glitch:
        hd = HEAD.difference(E)
        for piece, dx in glitch_split(hd):
            h.add(affinity.translate(piece, -9, 0), "#FF3EA5", fill_opacity=".85"); h.add(affinity.translate(piece, 9, 0), "#2EC8FF", fill_opacity=".85")
    hitems = head_items(skin, base, Polygon() if ew.get("hide") else E, ew.get("hide"))
    if glitch:
        solid = [it for it in hitems if it[0] not in ("SOFT", "SPEC")]
        draw_items(h, solid, split=True)
        draw_items(h, [it for it in hitems if it[0] in ("SOFT", "SPEC")])
        lines = unary_union([sbox(0, y, 512, y+2) for y in range(130, 400, 7)]).intersection(HEAD)
        h.add(lines, INK, fill_opacity=".10")
        for x, y, s, c in ((420, 210, 12, "#FF3EA5"), (432, 236, 8, "#3CF0A0"), (86, 330, 10, "#2EC8FF"), (404, 344, 7, "#3CF0A0")):
            h.add(sbox(x, y, x+s, y+s), c)
    else:
        draw_items(h, hitems)
    draw_items(h, hw.get("back", []))
    for g, op, r in hw.get("ao", []): h.soft(g.intersection(HEAD.buffer(r)), INK, op, r=r, n=5, clip=HEAD)
    for g, op, r in ew.get("shadow", []): h.soft(g, INK, op, r=r, n=4, clip=HEAD)
    draw_items(h, ew.get("items", []))
    def draw_sprout():
        clipy = hw.get("clip")
        if t.get("_sprout") is not None:
            sp = t["_sprout"]; h.add(sp, sp_col); h.add(sp, CYL); return
        stem, leaves = sprout_parts()
        lift = hw.get("lift", 0)
        if lift:
            stem = unary_union([affinity.translate(stem, 0, -lift), stem])
            leaves = [(affinity.translate(g, 0, -lift), (x1, y1-lift, x2, y2-lift)) for g, (x1, y1, x2, y2) in leaves]
        if clipy: stem = stem.intersection(sbox(0, 0, 512, clipy))
        h.soft(ell(256, 141, 15, 5), INK, .30, r=4, n=3, clip=None if clipy else HEAD) if not clipy else None
        gold = skin == "Gold"
        h.add(stem, GOLD_M() if gold else sp_col); h.add(stem, CYL)
        for g, (x1, y1, x2, y2) in leaves:
            h.add(g, GOLD_M() if gold else sp_col)
            h.add(g, lin([(0, "#FFFFFF", .30), (.5, "#FFFFFF", 0), (1, "#000000", .18)], 0, 0, 1, 1))
            dx, dy = x2-x1, y2-y1; far = 400
            half = Polygon([(x1-dx, y1-dy), (x2+dx, y2+dy), (x2+dx, y2+dy+far), (x1-dx, y1-dy+far)])
            h.add(g.intersection(half), INK, fill_opacity=".16")
            h.add(g.difference(affinity.translate(g, 2.5, 3)).difference(half), "#FFFFFF", fill_opacity=".35")
    order = hw.get("sprout", "after")
    if order == "between": draw_sprout()
    draw_items(h, hw.get("front", []), clip_head=None)
    if order == "after": draw_sprout()
    draw_items(h, hw.get("top", []))
    for g, c, kw in t.get("_head_extra", []): h.add(g, c, **kw)
    out = Art(); out.L = [f'<rect width="512" height="512" fill="{bg}"/>', *legendary_bg(skin, bg), *t.get("_bg_extra", []),
                          f'<g transform="translate(0 {BODY_DY})">', *a.L, '</g>', f'<g transform="{HEAD_T}">', *h.L, '</g>']
    return out
