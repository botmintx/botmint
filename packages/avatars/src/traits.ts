import {
  box,
  emptyPolygon,
  type Geom,
  lineString,
  type Pt,
  pathData,
  point,
  polygon,
  range,
  unaryUnion,
} from "./geo.ts";
import {
  Art,
  BG,
  bases,
  bez,
  CYL,
  CYL_V,
  circle,
  DOME,
  DOME_SOFT,
  EY,
  ell,
  type Fill,
  INK,
  type Kw,
  leaf,
  lin,
  line,
  PUFF,
  rad,
  rbox,
  roundc,
  shade,
  skinCols,
  spec,
  surf,
  WHITE,
} from "./paint.ts";

const LIGHT: Pt = [-1, -0.82];
export const GOLD_SH = "#A87822";
const GOLD_HI = "#FFF0B8";

export function cel(geom: Geom, k: number): Geom {
  return geom.difference(geom.translate(LIGHT[0] * k, LIGHT[1] * k));
}

export function dashes(path: Pt[], w = 3.2, on = 7, off = 6): Geom {
  if (path.length < 2) return emptyPolygon();
  const ls = lineString(path);
  const out: Geom[] = [];
  const len = ls.length;
  let d = 0;
  while (d < len) {
    const a = ls.interpolate(d);
    const b = ls.interpolate(Math.min(len, d + on));
    out.push(
      Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9
        ? point(a[0], a[1]).buffer(w / 2, 8)
        : lineString([a, b]).buffer(w / 2, 8),
    );
    d += on + off;
  }
  return unaryUnion(out);
}

function goldM(): Fill {
  return lin(
    [
      [0, "#FFF3C4"],
      [0.16, "#F6D366"],
      [0.38, "#D19E35"],
      [0.52, "#8F641D"],
      [0.66, "#D7A43F"],
      [0.84, "#FBE6A0"],
      [1, "#B9852A"],
    ],
    0,
    0,
    0.9,
    1,
  );
}

const HEADW = 150;
function wc(y: number, sag: number, x: number): number {
  const u = Math.min(1, Math.abs(x - 256) / (HEADW + 10));
  return y + sag * (1 - u * u);
}

function above(y: number, sag: number): Geom {
  return polygon([
    [-20, -80],
    ...range(-20, 533, 4).map((x) => [x, wc(y, sag, x)] as Pt),
    [532, -80],
  ]);
}

function wband(y0: number, y1: number, sag = 10, grow = 6): Geom {
  const top = range(-20, 533, 4).map((x) => [x, wc(y0, sag, x)] as Pt);
  const bot = range(532, -21, -4).map((x) => [x, wc(y1, sag, x)] as Pt);
  return polygon([...top, ...bot]).intersection(bases().HEAD.buffer(grow, 48));
}

function folds(art: Art, body: Geom): void {
  art.soft(leaf(116, 540, 170, 446, 9, 6).intersection(body), INK, 0.09, 10, 6, body);
  art.soft(leaf(396, 540, 342, 446, 9, 6).intersection(body), INK, 0.13, 10, 6, body);
  art.soft(leaf(104, 476, 168, 410, 7, 6).intersection(body), "#FFFFFF", 0.12, 10, 6, body);
}

function cloth(art: Art, col: string, body?: Geom, over?: Fill): void {
  const torso = body ?? bases().TORSO;
  art.add(torso, col);
  art.add(
    torso,
    over ??
      rad(
        [
          [0, "#FFFFFF", 0.22],
          [0.45, "#FFFFFF", 0],
          [0.8, "#000000", 0.14],
          [1, "#000000", 0.3],
        ],
        0.28,
        0.08,
        1.05,
      ),
  );
  art.add(cel(torso, 12).intersection(box(256, 0, 512, 600)), "#FFFFFF", { fill_opacity: ".06" });
  folds(art, torso);
}

function clBare(art: Art, skin: string): void {
  const [base] = skinCols(skin);
  if (skin === "Gold") {
    art.add(bases().TORSO, goldM());
    art.add(bases().TORSO, DOME_SOFT);
  } else cloth(art, base);
  const seed = leaf(256, 494, 256, 440, 9, 9).rotate(24, [256, 467]);
  art.add(seed, art.bg);
  art.add(seed.difference(seed.translate(3, 4)), INK, { fill_opacity: ".35" });
}

function clTee(art: Art, _skin: string, col = "#F4F3EE"): void {
  const { TORSO } = bases();
  cloth(art, col);
  const inner = ell(256, 398, 80, 30);
  art.add(inner.intersection(TORSO), shade(col, 0.86));
  const rib = ell(256, 404, 96, 42).difference(inner).intersection(TORSO);
  art.add(rib, shade(col, 0.95));
  art.add(rib, CYL_V);
  art.add(
    dashes(bez([166, 420], [256, 468], [346, 420], 30), 2.4, 6, 6)
      .intersection(TORSO)
      .difference(ell(256, 400, 84, 36)),
    shade(col, 0.8),
  );
}

function clHoodie(art: Art, _skin: string, col = "#8E979C"): void {
  const { TORSO } = bases();
  const hood = rbox(116, 316, 396, 456, 66);
  surf(art, hood, shade(col, 0.95), DOME_SOFT);
  art.add(
    rbox(150, 336, 362, 456, 50),
    lin(
      [
        [0, shade(col, 0.42)],
        [1, shade(col, 0.62)],
      ],
      0,
      0,
      0,
      1,
    ),
  );
  cloth(art, col);
  art.add(
    lineString([
      [256, 424],
      [256, 600],
    ])
      .buffer(1.6)
      .intersection(TORSO),
    shade(col, 0.72),
  );
  for (const [x, dx] of [
    [230, -4],
    [282, 4],
  ] as const) {
    art.add(circle(x, 416, 6.5), shade(col, 0.55));
    art.add(circle(x, 416, 6.5).difference(circle(x + 1.5, 417.5, 6)), "#FFFFFF", {
      fill_opacity: ".25",
    });
    const s = line(
      [
        [x, 416],
        [x + dx, 482],
      ],
      7,
    );
    art.soft(s.translate(4, 6), INK, 0.25, 3, 3, TORSO);
    art.add(s, "#EDEFF0");
    art.add(s, CYL);
    const ag = rbox(x + dx - 6, 476, x + dx + 6, 502, 4);
    art.add(ag, "#3CF0A0");
    art.add(ag, CYL);
  }
  const pocket = rbox(150, 506, 362, 640, 26);
  art.soft(pocket.translate(0, -4).difference(pocket).intersection(TORSO), INK, 0.2, 3, 3);
  art.add(pocket, shade(col, 0.96));
  art.add(pocket, DOME_SOFT);
  art.add(
    dashes(
      [
        [162, 516],
        [350, 516],
      ],
      2.4,
      6,
      6,
    ),
    shade(col, 0.7),
  );
  art.clip = unaryUnion([TORSO, hood]);
}

function clBomber(art: Art, _skin: string, col = "#3F4A35"): void {
  const { TORSO } = bases();
  cloth(art, col);
  const rib = TORSO.difference(TORSO.translate(0, 30));
  art.add(rib, "#1E211C");
  art.add(rib, CYL);
  art.add(
    unaryUnion(range(64, 452, 8).map((x) => box(x, 360, x + 2.2, 470))).intersection(rib),
    "#2E332B",
  );
  for (const k of [10, 19]) {
    art.add(
      TORSO.difference(TORSO.translate(0, k)).difference(
        TORSO.difference(TORSO.translate(0, k - 3.5)),
      ),
      "#FF7A1A",
    );
  }
  art.soft(rib.translate(0, 6).difference(rib).intersection(TORSO), INK, 0.28, 4, 4);
  art.add(box(249, 412, 263, 600), "#262C22");
  art.add(
    unaryUnion(
      range(414, 600, 6).map((y) =>
        box(Math.floor(y / 6) % 2 ? 250 : 256, y, Math.floor(y / 6) % 2 ? 256 : 262, y + 3),
      ),
    ),
    "#C9CFC4",
  );
  const tab = rbox(248, 426, 264, 458, 5);
  art.soft(tab.translate(3, 5), INK, 0.3, 3, 3);
  art.add(
    tab,
    lin(
      [
        [0, "#F4F6F2"],
        [0.5, "#C9CFC4"],
        [1, "#8C948A"],
      ],
      0,
      0,
      1,
      1,
    ),
  );
  art.add(rbox(253, 446, 259, 452, 2), "#3F4A35");
}

function clTurtle(art: Art, _skin: string, col = "#E6DFCF"): void {
  const { TORSO } = bases();
  const tube = rbox(194, 356, 318, 458, 26);
  cloth(art, col);
  art.soft(tube.translate(6, 10).difference(tube).intersection(TORSO), INK, 0.22, 6, 4);
  art.add(tube, col);
  art.add(tube, CYL);
  art.add(
    unaryUnion(range(206, 312, 12).map((x) => rbox(x, 396, x + 5, 454, 2.5))).intersection(tube),
    INK,
    { fill_opacity: ".08" },
  );
  for (const y of [420, 440]) art.soft(ell(256, y, 64, 3).intersection(tube), INK, 0.16, 3, 3);
}

export function clPuffer(art: Art, _skin: string, col = "#F25C3C"): void {
  const torso = bases().TORSO;
  const [minX, , maxX] = torso.bounds;
  let body = torso;
  for (const y of [446, 494]) {
    body = body.difference(circle(minX - 2, y, 14)).difference(circle(maxX + 2, y, 14));
  }
  art.add(body, col);
  for (const [y0, y1] of [
    [380, 446],
    [446, 494],
    [494, 560],
    [560, 620],
  ] as const) {
    art.add(body.intersection(box(0, y0, 512, y1)), PUFF);
  }
  art.add(body, CYL);
  for (const y of [446, 494])
    art.add(box(0, y - 1.5, 512, y + 1.5).intersection(body), shade(col, 0.55));
  const collar = rbox(172, 382, 340, 442, 28);
  art.soft(collar.translate(4, 8), INK, 0.25, 5, 4, body);
  art.add(collar, shade(col, 1.06));
  art.add(collar, PUFF);
  art.add(collar, CYL);
  art.add(box(253, 442, 259, 600).intersection(body), shade(col, 0.6));
  art.add(
    rbox(249, 448, 263, 472, 4),
    lin(
      [
        [0, "#FFFFFF"],
        [1, "#B7BEC2"],
      ],
      0,
      0,
      1,
      1,
    ),
  );
}

function clBlazer(art: Art, _skin: string, col = "#1F2A44"): void {
  const { TORSO } = bases();
  cloth(art, col);
  const v = polygon([
    [204, 398],
    [308, 398],
    [256, 520],
  ]);
  art.add(v, WHITE);
  art.add(
    v,
    lin(
      [
        [0, "#000000", 0],
        [1, "#000000", 0.14],
      ],
      0,
      0,
      1,
      1,
    ),
  );
  for (const cp of [
    polygon([
      [214, 398],
      [252, 398],
      [236, 430],
    ]),
    polygon([
      [260, 398],
      [298, 398],
      [276, 430],
    ]),
  ]) {
    art.soft(cp.translate(2, 4), INK, 0.2, 2, 3);
    art.add(cp, "#FFFFFF");
  }
  const knot = rbox(245, 418, 267, 438, 5);
  const tie = polygon([
    [247, 436],
    [265, 436],
    [262, 520],
    [250, 520],
  ]);
  art.add(tie, "#3CF0A0");
  art.add(tie, CYL);
  art.add(knot, "#2FD68D");
  art.add(knot, DOME);
  const lapL = roundc(
    polygon([
      [190, 400],
      [230, 400],
      [256, 520],
      [228, 520],
      [176, 452],
      [194, 438],
      [178, 430],
    ]),
    2,
  );
  const lapR = lapL.scale(-1, 1, [256, 0]);
  for (const lp of [lapL, lapR]) {
    art.soft(lp.translate(4, 6).difference(lp).intersection(TORSO), INK, 0.3, 3, 3);
    art.add(lp, shade(col, 1.12));
    art.add(
      lp,
      lin(
        [
          [0, "#FFFFFF", 0.16],
          [1, "#000000", 0.18],
        ],
        0,
        0,
        1,
        1,
      ),
    );
  }
  for (const y of [528, 560]) {
    art.add(circle(236, y, 5.5), "#11182B");
    art.add(circle(236, y, 5.5), DOME);
  }
  art.add(rbox(132, 464, 172, 474, 3), shade(col, 0.6));
  const sq = polygon([
    [136, 466],
    [146, 448],
    [154, 460],
    [162, 450],
    [168, 466],
  ]).buffer(1.5);
  art.add(sq, WHITE);
  art.add(
    sq,
    lin(
      [
        [0, "#000000", 0],
        [1, "#000000", 0.15],
      ],
      0,
      0,
      1,
      1,
    ),
  );
}

const CLOTHING: Record<string, (art: Art, skin: string) => void> = {
  Bare: clBare,
  Tee: clTee,
  Hoodie: clHoodie,
  Bomber: clBomber,
  Turtleneck: clTurtle,
  Puffer: clPuffer,
  Blazer: clBlazer,
};

const NECK_CURVE = bez([176, 420], [256, 520], [336, 420], 34);

function drop(art: Art, geom: Geom, op = 0.32, r = 3, dx = 3, dy = 6): void {
  art.soft(geom.translate(dx, dy), INK, op, r, 3, bases().TORSO);
}

function acNone(_art: Art): void {}

function acChain(art: Art): void {
  const rings: Geom[] = [];
  const bars: Geom[] = [];
  const glints: Geom[] = [];
  for (let i = 2; i < NECK_CURVE.length - 2; i += 1) {
    const [x0, y0] = NECK_CURVE[i - 1]!;
    const [x1, y1] = NECK_CURVE[i + 1]!;
    const [x, y] = NECK_CURVE[i]!;
    const ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
    if (i % 2) {
      rings.push(ell(x, y, 8.5, 5.8, ang).difference(ell(x, y, 4.4, 2, ang)));
      glints.push(ell(x - 3, y - 2.5, 2.2, 1.2, ang));
    } else bars.push(ell(x, y, 6, 2.6, ang));
  }
  const R = unaryUnion(rings);
  const B = unaryUnion(bars);
  drop(art, unaryUnion([R, B]));
  art.add(
    B,
    lin(
      [
        [0, "#C9952F"],
        [1, "#7A5418"],
      ],
      0,
      0,
      0,
      1,
    ),
  );
  art.add(R, goldM());
  art.add(cel(R, 2.2).intersection(R), GOLD_SH, { fill_opacity: ".7" });
  art.add(unaryUnion(glints), "#FFFFFF", { fill_opacity: ".85" });
}

function acPendant(art: Art): void {
  const cord = lineString(NECK_CURVE).buffer(2.2);
  drop(art, cord, 0.25, 2);
  art.add(cord, "#1A1D1F");
  const p = leaf(256, 504, 256, 456, 8, 8).rotate(24, [256, 480]);
  const bail = rbox(250, 448, 262, 460, 4);
  drop(art, unaryUnion([p, bail]), 0.35, 4, 4, 8);
  art.add(bail, goldM());
  art.add(p, goldM());
  art.add(cel(p, 4).intersection(p), GOLD_SH, { fill_opacity: ".6" });
  art.add(box(255, 462, 257.2, 498).rotate(24, [256, 480]).intersection(p.buffer(-3)), GOLD_SH);
  art.add(ell(250, 470, 2.4, 7).rotate(24, [256, 480]), "#FFFFFF", { fill_opacity: ".8" });
}

function acScarf(art: Art, col = "#E2483D"): void {
  const wrap = rbox(146, 378, 366, 446, 26);
  const tail = rbox(282, 410, 330, 534, 20).rotate(-10, [306, 420]);
  drop(art, tail, 0.3, 5, 5, 8);
  art.add(tail, col);
  art.add(tail, CYL);
  for (const y of [474, 490]) {
    art.add(
      rbox(282, y, 330, y + 5, 2.5)
        .rotate(-10, [306, 420])
        .intersection(tail),
      shade(col, 0.66),
    );
  }
  const fr = unaryUnion(
    [286, 296, 306, 316].map((x) => rbox(x, 526, x + 6, 548, 3).rotate(-10, [306, 420])),
  );
  art.add(fr, shade(col, 0.9));
  drop(art, wrap, 0.3, 6, 4, 10);
  art.add(wrap, col);
  art.add(wrap, CYL_V);
  art.add(wrap, CYL);
  for (const g of [
    leaf(176, 440, 236, 384, 5, 4),
    leaf(240, 446, 300, 386, 5, 4),
    leaf(304, 446, 350, 396, 4, 4),
  ]) {
    art.soft(g.intersection(wrap), INK, 0.22, 4, 4, wrap);
  }
}

function acLanyard(art: Art, col = "#3CF0A0"): void {
  const straps = unaryUnion([
    line(
      [
        [196, 400],
        [246, 470],
      ],
      9,
    ),
    line(
      [
        [316, 400],
        [266, 470],
      ],
      9,
    ),
  ]);
  drop(art, straps, 0.25, 3);
  art.add(straps, col);
  art.add(straps, CYL);
  const clip = rbox(250, 456, 262, 472, 3);
  const card = rbox(224, 466, 288, 516, 6);
  drop(art, card, 0.35, 4, 4, 8);
  art.add(
    clip,
    lin(
      [
        [0, "#E7E9EA"],
        [1, "#71767B"],
      ],
      0,
      0,
      1,
      1,
    ),
  );
  art.add(card, WHITE);
  art.add(card, DOME_SOFT);
  art.add(rbox(230, 472, 282, 483, 3), col);
  art.add(rbox(230, 489, 262, 494, 2), "#A9B0B4");
  art.add(rbox(230, 499, 252, 504, 2), "#C9CFD2");
  art.add(rbox(266, 488, 282, 504, 3), INK);
}

const ACCESSORY: Record<string, (art: Art) => void> = {
  None: acNone,
  Chain: acChain,
  "Seed Pendant": acPendant,
  Scarf: acScarf,
  Lanyard: acLanyard,
};

type PathItem = { kind: "path"; geom: Geom; fill: Fill; kw: Kw };
type SoftItem = { kind: "soft"; geom: Geom; op: number; r: number; col: string; core: boolean };
type SpecItem = {
  kind: "spec";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  op: number;
  crisp: boolean;
};
type Item = PathItem | SoftItem | SpecItem;

function I(geom: Geom, fill: Fill, kw: Kw = {}): PathItem {
  return { kind: "path", geom, fill, kw };
}
function SOFT(geom: Geom, op: number, r = 6, col = INK): SoftItem {
  return { kind: "soft", geom, op, r, col, core: false };
}

export type Wear = {
  back?: Item[];
  front?: Item[];
  top?: Item[];
  ao?: [Geom, number, number][];
  sprout?: "after" | "between";
  clip?: number;
  lift?: number;
};

function hwNone(): Wear {
  return {};
}

function hwCap(col = "#262B30"): Wear {
  const { HEAD } = bases();
  const base = (x: number) => {
    const u = Math.min(1.05, Math.abs(x - 256) / 156);
    return 144 - 6 * u * u + 32 * u ** 4;
  };
  const shell = unaryUnion([
    HEAD.buffer(8, 48).intersection(box(0, 0, 512, 200)),
    ell(256, 104, 124, 46),
  ]).convexHull();
  const crown = shell
    .intersection(polygon([[0, 0], [512, 0], ...range(512, -1, -4).map((x) => [x, base(x)] as Pt)]))
    .buffer(-11, 24)
    .buffer(11, 24);
  const bx0 = 126;
  const bx1 = 386;
  const xs = range(0, 91).map((i) => bx0 + ((bx1 - bx0) * i) / 90);
  const frontE = (x: number) => {
    const v = (x - 256) / ((bx1 - bx0) / 2);
    return base(x) + 2 + 44 * Math.max(0, 1 - v * v) ** 0.5;
  };
  const brim = polygon([
    ...xs.map((x) => [x, base(x) - 2] as Pt),
    ...xs.toReversed().map((x) => [x, frontE(x)] as Pt),
  ])
    .buffer(5, 24)
    .buffer(-5, 24);
  const lip = brim.difference(brim.translate(0, -5.5));
  const stitch = unaryUnion(
    [8, 15, 22].map((k) =>
      dashes(
        xs
          .slice(6, -6)
          .filter((x) => frontE(x) - k > base(x) + 3)
          .map((x) => [x, frontE(x) - k] as Pt),
        1.9,
        6,
        4.5,
      ),
    ),
  ).intersection(brim.buffer(-2.5));
  const BT: Pt = [256, 60];
  const seams = unaryUnion([
    ...[-112, 112].map((dx) =>
      line(bez(BT, [256 + dx * 0.72, 74], [256 + dx, base(256 + dx)], 30), 2.4),
    ),
    line([BT, [256, base(256)]], 2.4),
  ]).intersection(crown);
  const panelR = polygon([BT, [256, 300], [420, 300], [420, 0], [256, 0]]).intersection(crown);
  const sideR = polygon([
    BT,
    ...bez(BT, [256 + 112 * 0.72, 74], [368, base(368)], 30),
    [368, 300],
    [512, 300],
    [512, 0],
  ]).intersection(crown);
  const eyelets = unaryUnion([-1, 1].map((s) => ell(256 + s * 56, 90, 3.4, 2.4)));
  const button = ell(BT[0], BT[1], 12, 6);
  const front: Item[] = [
    I(crown, col),
    I(panelR, INK, { fill_opacity: ".10" }),
    I(sideR, INK, { fill_opacity: ".14" }),
    I(crown, DOME),
    I(seams, INK, { fill_opacity: ".42" }),
    I(seams.translate(-1.6, 0).difference(seams).intersection(crown), "#FFFFFF", {
      fill_opacity: ".10",
    }),
    I(eyelets, INK, { fill_opacity: ".55" }),
    SOFT(crown.translate(0, 6).intersection(brim), 0.4, 4, INK),
    I(brim, shade(col, 1.32)),
    I(
      brim,
      lin(
        [
          [0, "#000000", 0.26],
          [0.25, "#FFFFFF", 0.1],
          [0.45, "#FFFFFF", 0.22],
          [0.7, "#FFFFFF", 0],
          [1, "#000000", 0.3],
        ],
        0,
        0,
        1,
        0,
      ),
    ),
    I(
      brim,
      lin(
        [
          [0, "#000000", 0.1],
          [0.5, "#FFFFFF", 0.05],
          [1, "#FFFFFF", 0.14],
        ],
        0,
        0,
        0,
        1,
      ),
    ),
    I(stitch, "#FFFFFF", { fill_opacity: ".26" }),
    I(
      brim.intersection(ell(212, 168, 64, 14, -6)),
      rad([
        [0, "#FFFFFF", 0.22],
        [1, "#FFFFFF", 0],
      ]),
    ),
    I(lip, INK, { fill_opacity: ".55" }),
  ];
  return {
    front,
    top: [
      I(button.translate(1.5, 3), INK, { fill_opacity: ".35" }),
      I(button, shade(col, 1.25)),
      I(button, DOME),
    ],
    ao: [
      [brim.translate(3, 11).difference(brim), 0.5, 7],
      [crown.translate(0, 7).difference(crown).difference(brim), 0.32, 5],
    ],
    sprout: "after",
    clip: 61,
    lift: 44,
  };
}

function hwBeanie(col = "#E8D9C0"): Wear {
  const { HEAD } = bases();
  const dome = unaryUnion([HEAD.buffer(10, 48), ell(256, 124, 128, 30)])
    .buffer(8)
    .buffer(-8)
    .intersection(above(170, 10));
  const cuff = wband(144, 192, 10, 13);
  const knit = unaryUnion(
    range(-80, 81, 10).map((d) => {
      const t = (d * Math.PI) / 180;
      return line(
        bez(
          [256 + 40 * Math.sin(t), 98],
          [256 + 122 * Math.sin(t), 118],
          [256 + 168 * Math.sin(t), 168],
          20,
        ),
        3.4 * Math.cos(t) + 0.6,
      );
    }),
  ).intersection(dome.buffer(-4));
  const ribs = unaryUnion(
    range(-84, 85, 6).map((d) => {
      const t = (d * Math.PI) / 180;
      const x = 256 + 168 * Math.sin(t);
      const h = 3 * Math.cos(t);
      return box(x - h, 130, x + h, 230);
    }),
  ).intersection(cuff);
  const fold = cuff.translate(0, -9).difference(cuff).intersection(dome);
  return {
    front: [
      I(dome, col),
      I(knit, INK, { fill_opacity: ".10" }),
      I(dome, DOME),
      SOFT(fold, 0.3),
      I(cuff, shade(col, 0.97)),
      I(ribs, INK, { fill_opacity: ".12" }),
      I(cuff, CYL),
      I(cuff, CYL_V),
    ],
    top: [I(ell(256, 101, 11, 4.5), INK, { fill_opacity: ".35" })],
    ao: [[cuff.translate(3, 12).difference(cuff), 0.45, 8]],
    sprout: "after",
    clip: 101,
    lift: 14,
  };
}

function hwBucket(col = "#C9B48A"): Wear {
  const crown = roundc(
    polygon([
      [140, 86],
      [372, 86],
      [412, 186],
      [100, 186],
    ]),
    30,
  );
  const band = wband(146, 168, 8, 60).intersection(crown);
  const xs = range(62, 451, 4);
  const topE = (x: number) => wc(166, 8, x);
  const brim = polygon([
    ...xs.map((x) => [x, topE(x)] as Pt),
    ...xs.toReversed().map((x) => [x, topE(x) + 20 + 8 * (1 - ((x - 256) / 194) ** 2)] as Pt),
  ])
    .buffer(10)
    .buffer(-10);
  const edge = brim.difference(brim.translate(0, -6));
  const stitch = unaryUnion(
    [10, 20].map((k) =>
      dashes(
        range(80, 433, 4).map(
          (x) => [x, topE(x) + k + (k - 8) * 0.5 * (1 - ((x - 256) / 194) ** 2)] as Pt,
        ),
        2.2,
        6,
        5,
      ),
    ),
  ).intersection(brim.buffer(-3));
  const crownTop = ell(256, 90, 110, 9);
  return {
    front: [
      I(crown, col),
      I(crown, CYL),
      I(crown, CYL_V),
      I(crownTop, shade(col, 1.08)),
      I(crownTop, DOME_SOFT),
      I(band, shade(col, 0.66)),
      I(band, CYL),
      I(brim, col),
      I(
        brim,
        lin(
          [
            [0, "#FFFFFF", 0.22],
            [0.7, "#FFFFFF", 0],
            [1, "#000000", 0.12],
          ],
          0,
          0,
          0,
          1,
        ),
      ),
      I(brim, CYL),
      I(stitch, INK, { fill_opacity: ".22" }),
      I(edge, INK, { fill_opacity: ".35" }),
    ],
    top: [I(ell(256, 89, 9, 4), INK, { fill_opacity: ".45" })],
    ao: [[brim.translate(4, 16).difference(brim), 0.55, 12]],
    sprout: "after",
    clip: 89,
    lift: 20,
  };
}

function hwCrown(): Wear {
  const { HEAD } = bases();
  const sag = 12;
  const band = wband(146, 178, sag, 9);
  const back = polygon([
    ...range(96, 417, 4).map((x) => [x, wc(140, -4, x)] as Pt),
    ...range(416, 95, -4).map((x) => [x, wc(148, sag, x)] as Pt),
  ]).intersection(HEAD.buffer(9));
  const pts = [-56, -21, 21, 56].map((d) => {
    const t = (d * Math.PI) / 180;
    const xc = 256 + 158 * Math.sin(t);
    const w = 46 * Math.cos(t) + 8;
    const yb = wc(146, sag, xc) + 2;
    return {
      tri: roundc(
        polygon([
          [xc - w / 2, yb + 4],
          [xc + w / 2, yb + 4],
          [xc, yb - 50],
        ]),
        2,
      ),
      ball: circle(xc, yb - 52, 3 * Math.cos(t) + 5),
      xc,
    };
  });
  const P = unaryUnion(pts.map((p) => p.tri));
  const balls = unaryUnion(pts.map((p) => p.ball));
  const gemC = ell(256, wc(160, sag, 256) + 2, 11, 10);
  const gems = [-1, 1].map((s) => ell(256 + s * 84, wc(160, sag, 256 + s * 84), 6.5, 8));
  const front: Item[] = [
    I(P, goldM()),
    I(P, CYL),
    I(balls, goldM()),
    I(balls, DOME),
    I(band, goldM()),
    I(band, CYL),
    I(band.difference(band.translate(0, 3)), GOLD_HI, { fill_opacity: ".8" }),
    I(band.difference(band.translate(0, -3)), "#6B4A14", { fill_opacity: ".6" }),
    I(gemC, "#16C47F"),
    I(gemC, DOME),
    I(ell(252, wc(160, sag, 256) - 2, 3.2, 2.4), "#FFFFFF", { fill_opacity: ".9" }),
  ];
  for (const g of gems) front.push(I(g, "#D93A3A"), I(g, DOME));
  for (const p of pts) {
    front.push(
      I(circle(p.xc - 2.4, p.ball.centroid[1] - 2.4, 2), "#FFFFFF", { fill_opacity: ".85" }),
    );
  }
  return {
    back: [
      I(
        back,
        lin(
          [
            [0, "#5E3F10"],
            [1, "#9A6B1E"],
          ],
          0,
          0,
          0,
          1,
        ),
      ),
    ],
    front,
    ao: [[band.translate(3, 12).difference(band), 0.5, 8]],
    sprout: "between",
  };
}

function hwPhones(col = "#1A1D1F", acc = "#3CF0A0"): Wear {
  const { HEAD } = bases();
  const band = HEAD.buffer(17, 48)
    .difference(HEAD.buffer(3, 48))
    .intersection(box(0, 0, 512, 236));
  const pad = HEAD.buffer(4, 48)
    .difference(HEAD.buffer(-2, 48))
    .intersection(box(196, 0, 316, 200));
  const front: Item[] = [
    I(band, col),
    I(
      band,
      lin(
        [
          [0, "#FFFFFF", 0.22],
          [0.5, "#FFFFFF", 0],
          [1, "#000000", 0.2],
        ],
        0,
        0,
        1,
        1,
      ),
    ),
    I(pad, "#2C3236"),
  ];
  for (const s of [-1, 1]) {
    const cx = 256 + s * 156;
    const shell = rbox(cx - 28, 196, cx + 28, 334, 28);
    const cushion = rbox(cx - 24, 204, cx + 24, 326, 22).translate(-s * 14, 0);
    const plate = rbox(cx - 16, 222, cx + 16, 308, 14).translate(s * 3, 0);
    front.push(
      I(cushion, "#2C3236"),
      I(cushion, CYL),
      I(shell, col),
      I(shell, CYL),
      I(shell, CYL_V),
      I(plate, acc),
      I(plate, DOME),
      I(plate.difference(plate.translate(2, 3)), "#FFFFFF", { fill_opacity: ".35" }),
    );
  }
  return {
    front,
    ao: [
      [rbox(94, 204, 140, 330, 20), 0.4, 10],
      [rbox(372, 204, 418, 330, 20), 0.55, 10],
      [pad.buffer(4), 0.35, 5],
    ],
    sprout: "after",
  };
}

function hwHeadband(col = WHITE): Wear {
  const b = wband(148, 184, 10, 7);
  return {
    front: [
      I(b, col),
      I(wband(156, 161, 10, 8), "#E2483D"),
      I(wband(168, 173, 10, 8), "#3CF0A0"),
      I(b, CYL),
      I(b, CYL_V),
    ],
    ao: [[b.translate(2, 10).difference(b), 0.35, 6]],
    sprout: "after",
  };
}

const HEADWEAR: Record<string, () => Wear> = {
  None: hwNone,
  Cap: hwCap,
  Beanie: hwBeanie,
  "Bucket Hat": hwBucket,
  Crown: hwCrown,
  Headphones: hwPhones,
  Headband: hwHeadband,
};

function frame(cx: number, w = 74, h = 124, t = 8): [Geom, Geom] {
  const o = rbox(cx - w / 2, EY - h / 2, cx + w / 2, EY + h / 2, 24);
  return [o, o.difference(o.buffer(-t))];
}

function glint(region: Geom, x: number, w = 12): Geom {
  return box(x, 0, x + w, 512)
    .skewX(-28, [x, EY])
    .intersection(region);
}

type EyeWear = { hide?: boolean; shadow?: [Geom, number, number][]; items?: Item[] };

function ewNone(_eyes: Geom[]): EyeWear {
  return {};
}

function ewSpecs(eyes: Geom[], col = "#14171A"): EyeWear {
  const [ol, fl] = frame(217);
  const [orr, fr] = frame(295);
  const f = unaryUnion([
    fl,
    fr,
    rbox(250, 224, 262, 236, 4),
    line(
      [
        [180, 214],
        [112, 206],
      ],
      7,
    ),
    line(
      [
        [332, 214],
        [400, 206],
      ],
      7,
    ),
  ]);
  const lenses = unaryUnion([ol.buffer(-8), orr.buffer(-8)]);
  const holes = unaryUnion(eyes);
  return {
    shadow: [[f.translate(6, 12), 0.3, 4]],
    items: [
      I(lenses, "#BFE0FF", { fill_opacity: ".10" }),
      I(glint(lenses, 190).difference(holes), "#FFFFFF", { fill_opacity: ".35" }),
      I(f, col),
      I(
        f,
        lin(
          [
            [0, "#FFFFFF", 0.25],
            [0.5, "#FFFFFF", 0],
            [1, "#000000", 0.3],
          ],
          0,
          0,
          1,
          1,
        ),
      ),
    ],
  };
}

function ewShades(eyes: Geom[], col = "#0B0D0E"): EyeWear {
  const lens = unaryUnion([
    roundc(
      polygon([
        [164, 196],
        [254, 196],
        [248, 296],
        [176, 306],
      ]),
      20,
    ),
    roundc(
      polygon([
        [258, 196],
        [348, 196],
        [336, 306],
        [264, 296],
      ]),
      20,
    ),
  ]);
  const br = unaryUnion([
    rbox(246, 202, 266, 216, 4),
    line(
      [
        [170, 208],
        [108, 202],
      ],
      8,
    ),
    line(
      [
        [342, 208],
        [404, 202],
      ],
      8,
    ),
  ]);
  const holes = unaryUnion(eyes);
  return {
    hide: true,
    shadow: [[unaryUnion([lens, br]).translate(6, 14), 0.4, 8]],
    items: [
      I(br, col),
      I(
        lens,
        lin(
          [
            [0, "#20262A"],
            [0.55, "#0B0D0E"],
            [1, "#151A1D"],
          ],
          0,
          0,
          0,
          1,
        ),
      ),
      I(holes.intersection(lens.buffer(-8)), "#2A3136", { fill_opacity: ".8" }),
      I(unaryUnion([glint(lens.buffer(-6), 180, 18), glint(lens.buffer(-6), 274, 18)]), "#FFFFFF", {
        fill_opacity: ".16",
      }),
      I(lens.difference(lens.translate(0, 4)), "#FFFFFF", { fill_opacity: ".18" }),
    ],
  };
}

function ewVisor(eyes: Geom[], _col = "#0B0D0E", lit = "#3CF0A0"): EyeWear {
  const v = wband(198, 300, 8, 9);
  const litEyes = unaryUnion(eyes).intersection(v.buffer(-10));
  return {
    hide: true,
    shadow: [[v.translate(4, 14).difference(v), 0.45, 8]],
    items: [
      I(
        v,
        lin(
          [
            [0, "#262C30"],
            [0.5, "#0B0D0E"],
            [1, "#14181A"],
          ],
          0,
          0,
          0,
          1,
        ),
      ),
      I(v, CYL),
      I(litEyes, lit),
      I(litEyes, DOME_SOFT),
      I(wband(206, 216, 8, 4).intersection(v), "#FFFFFF", { fill_opacity: ".16" }),
      I(v.difference(v.translate(0, -4)), "#000000", { fill_opacity: ".5" }),
    ],
  };
}

function ewVr(_eyes: Geom[], col = "#EDEFF0"): EyeWear {
  const strap = wband(226, 262, 8, 6);
  const shell = rbox(132, 184, 380, 314, 44);
  const depth = shell.translate(7, 9);
  const panel = rbox(150, 202, 362, 296, 30);
  return {
    hide: true,
    shadow: [[shell.translate(10, 18), 0.4, 10]],
    items: [
      I(strap, "#1A1D1F"),
      I(strap, CYL),
      I(depth, shade(col, 0.62)),
      I(shell, col),
      I(shell, DOME),
      I(shell.difference(shell.translate(3, 3)), "#FFFFFF", { fill_opacity: ".6" }),
      I(
        panel,
        lin(
          [
            [0, "#2A3136"],
            [0.5, "#0E1113"],
            [1, "#181D20"],
          ],
          0,
          0,
          0,
          1,
        ),
      ),
      I(panel.difference(panel.translate(-3, -4)), "#FFFFFF", { fill_opacity: ".12" }),
      I(glint(panel.buffer(-4), 176, 24), "#FFFFFF", { fill_opacity: ".10" }),
      I(rbox(176, 272, 236, 280, 4), "#3CF0A0"),
      I(circle(338, 276, 5), "#3CF0A0"),
    ],
  };
}

function ewMonocle(eyes: Geom[]): EyeWear {
  const ring = circle(295, EY, 64).difference(circle(295, EY, 54));
  const chain = unaryUnion(
    bez([350, 290], [384, 340], [362, 420], 22).map((p) => circle(p[0], p[1], 2.6)),
  );
  const holes = unaryUnion(eyes);
  return {
    shadow: [[ring.translate(5, 9), 0.55, 4]],
    items: [
      I(chain, GOLD_SH),
      I(circle(295, EY, 54).difference(holes), "#FFF6D8", { fill_opacity: ".12" }),
      I(glint(circle(295, EY, 54), 262, 14).difference(holes), "#FFFFFF", { fill_opacity: ".35" }),
      I(ring, goldM()),
      I(ring.difference(ring.translate(2, 2)), GOLD_HI, { fill_opacity: ".8" }),
    ],
  };
}

const EYEWEAR: Record<string, (eyes: Geom[]) => EyeWear> = {
  None: ewNone,
  Specs: ewSpecs,
  Shades: ewShades,
  Visor: ewVisor,
  "VR Goggles": ewVr,
  Monocle: ewMonocle,
};

function headItems(skin: string, base: string, E: Geom, eyesHidden: boolean): Item[] {
  const { HEAD } = bases();
  const H = HEAD.difference(E);
  const core = cel(HEAD, 40);
  const out: Item[] = [];
  if (skin === "Gold") out.push(I(H, goldM()), I(H, DOME_SOFT));
  else if (skin === "Obsidian") {
    out.push(
      I(H, "#121517"),
      I(
        H,
        rad(
          [
            [0, "#5A646B", 0.55],
            [0.4, "#2A3034", 0.2],
            [1, "#000000", 0],
          ],
          0.3,
          0.22,
          0.8,
        ),
      ),
    );
  } else out.push(I(H, base), I(H, DOME));
  out.push({ kind: "soft", geom: core.difference(E), op: 0.16, r: 22, col: INK, core: true });
  const rim = HEAD.difference(HEAD.translate(-6, -7)).difference(E);
  const rc = skin === "Obsidian" ? "#3CF0A0" : "#FFFFFF";
  const ro = skin === "Obsidian" ? 0.75 : 0.3;
  out.push(
    I(
      rim,
      lin(
        [
          [0, rc, 0],
          [0.6, rc, 0],
          [0.85, rc, ro * 0.6],
          [1, rc, ro],
        ],
        0,
        0,
        1,
        1,
      ),
    ),
  );
  if (!eyesHidden) {
    out.push(
      I(E.difference(E.translate(4, 6)), INK, { fill_opacity: ".55" }),
      I(E.difference(E.translate(0, 9)), INK, { fill_opacity: ".22" }),
    );
  }
  if (skin === "Obsidian") {
    out.push(
      I(rbox(146, 152, 196, 176, 12).difference(E), "#FFFFFF", { fill_opacity: ".8" }),
      I(
        ell(196, 184, 70, 34, -20).difference(E),
        rad([
          [0, "#FFFFFF", 0.22],
          [1, "#FFFFFF", 0],
        ]),
      ),
    );
  } else if (skin === "Gold") {
    out.push({ kind: "spec", cx: 186, cy: 176, rx: 60, ry: 30, op: 0.7, crisp: true });
  } else out.push({ kind: "spec", cx: 186, cy: 176, rx: 62, ry: 30, op: 0.5, crisp: false });
  return out;
}

function glitchSplit(geom: Geom): Geom[] {
  return (
    [
      [0, 150, 0],
      [150, 182, 18],
      [182, 312, 0],
      [312, 338, -14],
      [338, 512, 0],
    ] as const
  ).map(([y0, y1, dx]) => geom.intersection(box(0, y0, 512, y1)).translate(dx, 0));
}

function drawItems(art: Art, items: Item[], split = false): void {
  const { HEAD } = bases();
  for (const it of items) {
    if (it.kind === "soft") {
      if (it.op > 0)
        art.soft(it.geom, it.col, it.op, it.r, it.core ? 10 : 5, it.core ? HEAD : null);
    } else if (it.kind === "spec") spec(art, it.cx, it.cy, it.rx, it.ry, -22, it.op, it.crisp);
    else if (split) for (const piece of glitchSplit(it.geom)) art.add(piece, it.fill, it.kw);
    else art.add(it.geom, it.fill, it.kw);
  }
}

function legendaryBg(skin: string): string[] {
  const { CANVAS } = bases();
  if (skin === "Gold") {
    const wedges = unaryUnion(
      range(0, 360, 22).map((a) =>
        polygon([
          [256, 250],
          [256 + 900 * Math.cos((a * Math.PI) / 180), 250 + 900 * Math.sin((a * Math.PI) / 180)],
          [
            256 + 900 * Math.cos(((a + 11.25) * Math.PI) / 180),
            250 + 900 * Math.sin(((a + 11.25) * Math.PI) / 180),
          ],
        ]),
      ),
    ).intersection(CANVAS);
    return [`<path fill="#E9B949" fill-opacity="0.055" d="${pathData(wedges)}"/>`];
  }
  if (skin === "Glitch") {
    const bars = unaryUnion(
      (
        [
          [70, 6],
          [118, 3],
          [380, 4],
          [430, 8],
          [470, 3],
        ] as const
      ).map(([y, h]) => box(0, y, 512, y + h)),
    );
    return [
      `<path fill="#FF3EA5" fill-opacity="0.22" d="${pathData(bars)}"/>`,
      `<path fill="#2EC8FF" fill-opacity="0.22" d="${pathData(bars.translate(26, 10).intersection(CANVAS))}"/>`,
    ];
  }
  return [];
}

export type Traits = {
  Background: string;
  Body: string;
  Eyes: string;
  Headwear: string;
  Eyewear: string;
  Clothing: string;
  Accessory: string;
  _cloth?: (art: Art, skin: string) => void;
  _sprout?: Geom | null;
  _head_extra?: { geom: Geom; fill: Fill; kw: Kw }[];
  _bg_extra?: string[];
};

export function pfp(t: Traits): Art {
  const bg = BG[t.Background] ?? "#F2EEE6";
  const art = new Art();
  art.bg = bg;
  const skin = t.Body;
  const [base, , sproutCol] = skinCols(skin);
  const eyes = bases().eyes[t.Eyes]?.() ?? bases().eyes.Idle!();
  const hw = HEADWEAR[t.Headwear]?.() ?? {};
  const ew = EYEWEAR[t.Eyewear]?.(eyes) ?? {};
  (t._cloth ?? CLOTHING[t.Clothing] ?? CLOTHING.Bare!)(art, skin);
  (ACCESSORY[t.Accessory] ?? acNone)(art);
  const bodyClip = art.clip ?? bases().TORSO;
  art.soft(bases().NECKSH.intersection(bodyClip.buffer(10)), INK, 0.3, 14, 8, bodyClip);
  art.soft(ell(256, 396, 110, 12), INK, 0.22, 8, 5, bodyClip);
  const head = new Art();
  head.bg = bg;
  const E = unaryUnion(eyes);
  const glitch = skin === "Glitch";
  const { HEAD } = bases();
  if (glitch) {
    for (const piece of glitchSplit(HEAD.difference(E))) {
      head.add(piece.translate(-9, 0), "#FF3EA5", { fill_opacity: ".85" });
      head.add(piece.translate(9, 0), "#2EC8FF", { fill_opacity: ".85" });
    }
  }
  const hidden = Boolean(ew.hide);
  const items = headItems(skin, base, hidden ? emptyPolygon() : E, hidden);
  if (glitch) {
    // SOFTC stays in the first pass (soft(), not sliced). SOFT and SPEC are painted after.
    const late = (it: Item) => it.kind === "spec" || (it.kind === "soft" && !it.core);
    drawItems(
      head,
      items.filter((it) => !late(it)),
      true,
    );
    drawItems(
      head,
      items.filter((it) => late(it)),
    );
    head.add(
      unaryUnion(range(130, 400, 7).map((y) => box(0, y, 512, y + 2))).intersection(HEAD),
      INK,
      { fill_opacity: ".10" },
    );
    for (const [x, y, s, c] of [
      [420, 210, 12, "#FF3EA5"],
      [432, 236, 8, "#3CF0A0"],
      [86, 330, 10, "#2EC8FF"],
      [404, 344, 7, "#3CF0A0"],
    ] as const) {
      head.add(box(x, y, x + s, y + s), c);
    }
  } else drawItems(head, items);
  drawItems(head, hw.back ?? []);
  for (const [g, op, r] of hw.ao ?? []) {
    head.soft(g.intersection(HEAD.buffer(r)), INK, op, r, 5, HEAD);
  }
  for (const [g, op, r] of ew.shadow ?? []) head.soft(g, INK, op, r, 4, HEAD);
  drawItems(head, ew.items ?? []);
  const drawSprout = () => {
    const clipY = hw.clip;
    if (t._sprout != null) {
      head.add(t._sprout, sproutCol);
      head.add(t._sprout, CYL);
      return;
    }
    let { stem, leaves } = bases().sproutParts();
    const lift = hw.lift ?? 0;
    if (lift) {
      stem = unaryUnion([stem.translate(0, -lift), stem]);
      leaves = leaves.map((leafPart) => {
        const [x1, y1, x2, y2] = leafPart.tip;
        return {
          geom: leafPart.geom.translate(0, -lift),
          tip: [x1, y1 - lift, x2, y2 - lift] as [number, number, number, number],
        };
      });
    }
    if (clipY) stem = stem.intersection(box(0, 0, 512, clipY));
    if (!clipY) head.soft(ell(256, 141, 15, 5), INK, 0.3, 4, 3, HEAD);
    const gold = skin === "Gold";
    head.add(stem, gold ? goldM() : sproutCol);
    head.add(stem, CYL);
    for (const part of leaves) {
      const [x1, y1, x2, y2] = part.tip;
      head.add(part.geom, gold ? goldM() : sproutCol);
      head.add(
        part.geom,
        lin(
          [
            [0, "#FFFFFF", 0.3],
            [0.5, "#FFFFFF", 0],
            [1, "#000000", 0.18],
          ],
          0,
          0,
          1,
          1,
        ),
      );
      const dx = x2 - x1;
      const dy = y2 - y1;
      const half = polygon([
        [x1 - dx, y1 - dy],
        [x2 + dx, y2 + dy],
        [x2 + dx, y2 + dy + 400],
        [x1 - dx, y1 - dy + 400],
      ]);
      head.add(part.geom.intersection(half), INK, { fill_opacity: ".16" });
      head.add(part.geom.difference(part.geom.translate(2.5, 3)).difference(half), "#FFFFFF", {
        fill_opacity: ".35",
      });
    }
  };
  if ((hw.sprout ?? "after") === "between") drawSprout();
  drawItems(head, hw.front ?? []);
  if ((hw.sprout ?? "after") === "after") drawSprout();
  drawItems(head, hw.top ?? []);
  for (const extra of t._head_extra ?? []) head.add(extra.geom, extra.fill, extra.kw);
  const out = new Art();
  out.L = [
    `<rect width="512" height="512" fill="${bg}"/>`,
    ...legendaryBg(skin),
    ...(t._bg_extra ?? []),
    `<g transform="translate(0 -50)">`,
    ...art.L,
    "</g>",
    `<g transform="translate(256 60) scale(0.84) translate(-256 -60)">`,
    ...head.L,
    "</g>",
  ];
  return out;
}
