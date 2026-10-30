import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from traits import *
from textpath import text

def full_bloom():
    # the sprout has flowered: logo leaves scaled up, a taller stem, a six-petal bloom; loose petals drift in the background
    stem, lv = sprout_parts()
    big = unary_union([affinity.scale(unary_union([stem] + [g for g, _ in lv]), 1.3, 1.3, origin=(256, 142)), rbox(250, 24, 262, 110, 4)])
    fx, fy = 256, 20
    pet = unary_union([affinity.rotate(leaf(fx, fy, fx, fy-34, 11, 11), a, origin=(fx, fy)) for a in range(0, 360, 60)])
    extra = [(pet, "#FFE6A3", {}), (cel(pet, 7).intersection(pet), "#F2C94C", {}), (circle(fx, fy, 10), "#E9B949", {}), (cel(circle(fx, fy, 10), 4), GOLD_SH, {})]
    drift = unary_union([affinity.rotate(leaf(x, y, x+18, y-10, 5, 5), r, origin=(x, y)) for x, y, r in ((70, 120, 10), (440, 170, -30), (420, 60, 40), (96, 300, -20))])
    t = dict(Background="Paper", Body="Mint", Eyes="Joy", Headwear="None", Eyewear="None", Clothing="Blazer", Accessory="Seed Pendant",
             _sprout=big, _head_extra=extra, _bg_extra=[f'<path fill="#F2C94C" d="{d_of(drift)}"/>'])
    return pfp(t)

def spacewalk():
    dome = unary_union([HEAD, affinity.scale(sprout(), 1, 1, origin=(256, 142))]).convex_hull.buffer(16, resolution=32)
    dome = dome.buffer(-40).buffer(40)
    shell_o = dome.buffer(14, resolution=32); rim = shell_o.difference(dome)
    glare = leaf(150, 270, 168, 130, 7, 7)
    sparkle = lambda x, y, r: unary_union([affinity.rotate(leaf(x, y-r, x, y+r, r*0.18, r*0.18), a, origin=(x, y)) for a in (0, 90)])
    stars = unary_union([sparkle(46, 66, 9), sparkle(462, 100, 7), circle(404, 40, 2.2), circle(72, 212, 2), circle(474, 256, 2.4), circle(122, 30, 2), circle(30, 330, 2)])
    planet = circle(452, 400, 46); ring = ell(452, 404, 82, 14, -16).difference(ell(452, 404, 66, 7, -16))
    pl_front = ring.difference(sbox(0, 0, 512, 404).intersection(planet.buffer(0)))
    bg = [f'<path fill="#E7E9EA" d="{d_of(stars)}"/>', f'<path fill="#5B7CFF" d="{d_of(planet)}"/>',
          f'<path fill="#3D57C8" d="{d_of(cel(planet, 16))}"/>', f'<path fill="#F2C94C" d="{d_of(pl_front)}"/>']
    def suit(a, skin):
        cl_puffer(a, skin, col="#EDEFF0")
        ring_ = rbox(150, 366, 362, 420, 24); a.add(ring_, "#A9B0B4"); a.add(rbox(150, 366, 362, 384, 12), "#C9CFD2")
        a.add(rbox(300, 452, 348, 482, 6), "#14171A"); a.add(rbox(306, 458, 330, 466, 3), "#3CF0A0"); a.add(circle(338, 470, 4), "#FF7A1A")
        a.add(rbox(160, 452, 206, 466, 4), "#FF7A1A")
    t = dict(Background="Carbon", Body="Mint", Eyes="Wide", Headwear="None", Eyewear="None", Clothing="Puffer", Accessory="None",
             _cloth=suit, _bg_extra=bg,
             _head_extra=[(dome, "#BFE0FF", dict(fill_opacity="0.14")), (glare, "#FFFFFF", dict(fill_opacity="0.6")),
                          (rim, "#D9DDE0", {}), (cel(rim, 12).intersection(rim), "#A9B0B4", {}),
                          (rbox(240, dome.bounds[1]-12, 272, dome.bounds[1]+4, 6), "#A9B0B4", {})])
    return pfp(t)

def blueprint():
    BL, W = "#1E4FD8", "#EAF1FF"
    a = Art(); a.L.append(f'<rect width="512" height="512" fill="{BL}"/>')
    grid = unary_union([sbox(x, 0, x+1, 512) for x in range(0, 512, 32)] + [sbox(0, y, 512, y+1) for y in range(0, 512, 32)])
    a.add(grid, "#FFFFFF", fill_opacity="0.10")
    def outl(g, w=3.5): return g.boundary.buffer(w/2, resolution=8)
    body = affinity.translate(TORSO, 0, -50).intersection(sbox(-10, -10, 522, 470))
    M = lambda g: affinity.scale(g, 0.84, 0.84, origin=(256, 60))
    head = M(HEAD); eyes = M(unary_union(EYES["Idle"]())); sp = M(sprout())
    a.add(outl(body).difference(head).difference(sbox(0, 466, 512, 512)), W); a.add(outl(head), W); a.add(outl(eyes), W); a.add(outl(sp), W)
    a.add(unary_union([sbox(255, y, 257, y+10) for y in range(20, 460, 18)]), W, fill_opacity="0.5")

    a.add(unary_union([sbox(x, 219, x+10, 221) for x in range(110, 400, 18)]), W, fill_opacity="0.3")
    x0, y0, x1, y1 = head.bounds
    tick = lambda x, y, vert=False: sbox(x-1, y-7, x+1, y+7) if not vert else sbox(x-7, y-1, x+7, y+1)
    dims = unary_union([sbox(x0, 64, x1, 65.5), tick(x0, 64.7), tick(x1, 64.7),
                        sbox(452, y0, 453.5, y1), tick(452.7, y0, True), tick(452.7, y1, True)])
    ex0, ex1 = eyes.bounds[0], eyes.bounds[2]; eyb = eyes.bounds[3] + 14
    dims = unary_union([dims, sbox(ex0, eyb, ex1, eyb+1.5), tick(ex0, eyb+0.7), tick(ex1, eyb+0.7)])
    a.add(dims, W)
    # callout to the sprout
    a.add(unary_union([line([(300, 44), (360, 24)], 1.5), sbox(360, 23, 420, 24.5), circle(300, 44, 3)]), W)
    tb = rbox(326, 432, 492, 492, 2); a.add(tb.boundary.buffer(0.9), W); a.add(sbox(326, 461, 492, 462), W, fill_opacity="0.6")
    labels = [("W 252", x0+8, 56, "start", 12), ("H 232", 444, (y0+y1)/2+4, "end", 12), ("SE n=4", 364, 18, "start", 11),
              ("EYES 104", (ex0+ex1)/2, eyb+18, "middle", 11), ("BOTMINTX GENESIS", 334, 452, "start", 11), ("1 OF 1 · SHEET 01", 334, 482, "start", 10)]
    for s, x, y_, anc, sz in labels:
        d, _ = text(s, "geistmono", 500, sz, x, y_, anchor=anc, track=0.06); a.L.append(f'<path d="{d}" fill="{W}"/>')
    return a
ONE_OF_ONES = {"Full Bloom": full_bloom, "Spacewalk": spacewalk, "Blueprint": blueprint}
