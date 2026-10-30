import {
  box,
  type Geom,
  lineString,
  type Pt,
  pathData,
  point,
  polygon,
  unaryUnion,
} from "./geo.ts";

export const INK = "#0B0D0C";
export const WHITE = "#FAFAF7";

type Stop = [number, string, number?];
type Attr = [string, number];

function py(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(n);
}

export class Grad {
  kind: "lin" | "rad";
  stops: Stop[];
  at: Attr[];
  constructor(kind: "lin" | "rad", stops: Stop[], at: Attr[]) {
    this.kind = kind;
    this.stops = stops;
    this.at = at;
  }

  defs(id: string): string {
    const stops = this.stops
      .map(
        (stop) =>
          `<stop offset="${py(stop[0])}" stop-color="${stop[1]}" stop-opacity="${py(stop[2] ?? 1)}"/>`,
      )
      .join("");
    const attrs = this.at.map(([key, value]) => `${key}="${py(value)}"`).join(" ");
    const tag = this.kind === "lin" ? "linearGradient" : "radialGradient";
    return `<${tag} id="${id}" ${attrs}>${stops}</${tag}>`;
  }
}

export type Fill = string | Grad;
export type Kw = Record<string, string | number>;

export function lin(stops: Stop[], x1 = 0, y1 = 0, x2 = 1, y2 = 1): Grad {
  return new Grad("lin", stops, [
    ["x1", x1],
    ["y1", y1],
    ["x2", x2],
    ["y2", y2],
  ]);
}

export function rad(stops: Stop[], cx = 0.5, cy = 0.5, r = 0.5, fx?: number, fy?: number): Grad {
  return new Grad("rad", stops, [
    ["cx", cx],
    ["cy", cy],
    ["r", r],
    ["fx", fx ?? cx],
    ["fy", fy ?? cy],
  ]);
}

let gid = 0;
export function resetIds(): void {
  gid = 0;
}

export class Art {
  L: string[] = [];
  bg = "#FFFFFF";
  clip: Geom | null = null;

  add(geom: Geom | string | null, fill?: Fill, kw: Kw = {}): void {
    if (typeof geom === "string") {
      this.L.push(geom);
      return;
    }
    if (!geom || !fill || geom.empty) return;
    const poly = geom.polygonal();
    if (!poly) return;
    const d = pathData(poly);
    if (!d) return;
    let color: string;
    if (typeof fill === "string") color = fill;
    else {
      const id = `g${gid}`;
      gid += 1;
      this.L.push(`<defs>${fill.defs(id)}</defs>`);
      color = `url(#${id})`;
    }
    const extra = Object.entries(kw)
      .map(([key, value]) => ` ${key.replaceAll("_", "-")}="${value}"`)
      .join("");
    this.L.push(`<path fill="${color}" fill-rule="evenodd"${extra} d="${d}"/>`);
  }

  soft(geom: Geom | null, color: string, op: number, r = 8, n = 6, clip: Geom | null = null): void {
    if (!geom || geom.empty) return;
    const steps = Math.max(n, Math.min(18, Math.trunc(r * 1.6)));
    const alpha = 1 - (1 - op) ** (1 / steps);
    for (let i = 0; i < steps; i += 1) {
      const dist = -r + (2 * r * (i + 0.5)) / steps;
      let shape = geom.buffer(dist, 16);
      if (clip) shape = shape.intersection(clip);
      this.add(shape, color, { fill_opacity: alpha.toFixed(4) });
    }
  }

  svg(size = 512): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">${this.L.join("")}</svg>`;
  }
}

export const DOME = rad(
  [
    [0, "#FFFFFF", 0.3],
    [0.42, "#FFFFFF", 0],
    [0.8, "#000000", 0.1],
    [1, "#000000", 0.26],
  ],
  0.34,
  0.24,
  0.95,
);
export const DOME_SOFT = rad(
  [
    [0, "#FFFFFF", 0.2],
    [0.5, "#FFFFFF", 0],
    [0.85, "#000000", 0.08],
    [1, "#000000", 0.18],
  ],
  0.32,
  0.2,
  1,
);
export const CYL = lin(
  [
    [0, "#000000", 0.16],
    [0.22, "#FFFFFF", 0.2],
    [0.42, "#FFFFFF", 0],
    [0.78, "#000000", 0.14],
    [0.94, "#000000", 0.26],
    [1, "#000000", 0.16],
  ],
  0,
  0,
  1,
  0,
);
export const CYL_V = lin(
  [
    [0, "#FFFFFF", 0.22],
    [0.45, "#FFFFFF", 0],
    [0.85, "#000000", 0.16],
    [1, "#000000", 0.3],
  ],
  0,
  0,
  0,
  1,
);
export const PUFF = lin(
  [
    [0, "#FFFFFF", 0.28],
    [0.35, "#FFFFFF", 0.04],
    [0.75, "#000000", 0.1],
    [1, "#000000", 0.3],
  ],
  0,
  0,
  0,
  1,
);

/** Python `round`: half ties to even. `shade` depends on it. */
function pyRound(v: number): number {
  const sign = v < 0 ? -1 : 1;
  const a = Math.abs(v);
  const fl = Math.floor(a);
  const frac = a - fl;
  const r = Math.abs(frac - 0.5) < 1e-9 ? (fl % 2 === 0 ? fl : fl + 1) : Math.round(a);
  return sign * r;
}

export function shade(hex: string, f = 0.8): string {
  const body = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => Number.parseInt(body.slice(i, i + 2), 16));
  const mixed =
    f <= 1
      ? channels.map((value, i) => {
          const ink = [14, 17, 16][i] ?? 0;
          const k = (1 - f) * 1.6;
          return value * (1 - k) + ink * k;
        })
      : channels.map((value) => {
          const k = Math.min(1, f - 1);
          return value * (1 - k) + 255 * k;
        });
  return `#${mixed
    .map((value) =>
      Math.max(0, Math.min(255, pyRound(value)))
        .toString(16)
        .padStart(2, "0")
        .toUpperCase(),
    )
    .join("")}`;
}

export const BG: Record<string, string> = {
  "Mint Wash": "#CDF3E0",
  Carbon: "#111514",
  Paper: "#F2EEE6",
  Lilac: "#DDD5F7",
  Sky: "#C6E0F5",
  Butter: "#F6E6B4",
  Coral: "#F5C3B2",
  Sage: "#B3C9B9",
};
export const SKIN: Record<string, string> = {
  Mint: "#3CF0A0",
  Spearmint: "#A6FAD3",
  "Deep Mint": "#12B57A",
  Fog: "#E7E9EA",
  Graphite: "#4A5257",
  Lilac: "#B79CFF",
  Cobalt: "#5B7CFF",
  Sky: "#7CC4FF",
  Gold: "#E9B949",
  Obsidian: "#1A1D1F",
  Glitch: "#3CF0A0",
};
const SKIN_SH: Record<string, string> = { Gold: "#B9852A", Obsidian: "#0B0C0D" };

export function skinCols(skin: string): [string, string, string] {
  const base = SKIN[skin] ?? "#3CF0A0";
  const shadow = SKIN_SH[skin] ?? shade(base, 0.8);
  const sprout = skin === "Obsidian" ? "#3CF0A0" : base;
  return [base, shadow, sprout];
}

export function circle(cx: number, cy: number, r: number): Geom {
  return point(cx, cy).buffer(r, 64);
}

export function ell(cx: number, cy: number, rx: number, ry: number, rot = 0): Geom {
  const scaled = point(cx, cy).buffer(1, 96).scale(rx, ry, [cx, cy]);
  return rot ? scaled.rotate(rot, [cx, cy]) : scaled;
}

export function roundc(geom: Geom, r: number): Geom {
  return geom.buffer(-r, 32).buffer(r, 32);
}

export function rbox(x0: number, y0: number, x1: number, y1: number, r: number): Geom {
  return box(x0 + r, y0 + r, x1 - r, y1 - r).buffer(r, 24);
}

export function line(pts: Pt[], w: number): Geom {
  return lineString(pts).buffer(w / 2, 16);
}

export function capsule(cx: number, cy: number, w: number, h: number, rot = 0): Geom {
  const body = lineString([
    [cx, cy - h / 2 + w / 2],
    [cx, cy + h / 2 - w / 2],
  ]).buffer(w / 2, 32);
  return rot ? body.rotate(rot, [cx, cy]) : body;
}

export function bez(p0: Pt, c: Pt, p1: Pt, n = 40): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const u = 1 - t;
    pts.push([
      u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
      u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1],
    ]);
  }
  return pts;
}

export function taper(path: Pt[], r0: number, r1: number): Geom {
  const n = path.length - 1;
  const circles = path.map((p, i) => point(p[0], p[1]).buffer(r0 + ((r1 - r0) * i) / n, 24));
  const hulls: Geom[] = [];
  for (let i = 0; i < n; i += 1) hulls.push(circles[i]!.union(circles[i + 1]!).convexHull());
  return unaryUnion(hulls);
}

export function leaf(x1: number, y1: number, x2: number, y2: number, b1: number, b2: number): Geom {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const cx = x1 + dx * 0.42;
  const cy = y1 + dy * 0.42;
  const upper = bez([x1, y1], [cx + nx * b1 * 2, cy + ny * b1 * 2], [x2, y2], 40);
  const lower = bez([x2, y2], [cx - nx * b2 * 2, cy - ny * b2 * 2], [x1, y1], 40);
  return polygon([...upper, ...lower.slice(1)]).buffer(0);
}

export function se(cx: number, cy: number, a: number, b: number, n: number, samples = 280): Geom {
  const pts: Pt[] = [];
  for (let i = 0; i < samples; i += 1) {
    const t = (2 * Math.PI * i) / samples;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push([
      cx + a * Math.sign(c) * Math.abs(c) ** (2 / n),
      cy + b * Math.sign(s) * Math.abs(s) ** (2 / n),
    ]);
  }
  return polygon(pts);
}

export const EL = 217;
export const ER = 295;
export const EY = 250;
export const EW = 37.5;
export const EH = 96;

export function arc(cx: number, cy: number, w = 46, h = 26, t = 18): Geom {
  return taper(
    bez([cx - w / 2, cy + h / 2], [cx, cy - h * 1.15], [cx + w / 2, cy + h / 2]),
    t / 2,
    t / 2,
  );
}

export type SproutLeaf = { geom: Geom; tip: [number, number, number, number] };

export type Bases = {
  HEAD: Geom;
  CANVAS: Geom;
  TORSO: Geom;
  NECKSH: Geom;
  eyes: Record<string, () => Geom[]>;
  sproutParts: () => { stem: Geom; leaves: SproutLeaf[] };
};

let basesCache: Bases | null = null;

export function invalidateBases(): void {
  basesCache = null;
}

export function bases(): Bases {
  if (basesCache) return basesCache;
  const HEAD = se(256, 262, 150, 138, 4);
  const headInBody = HEAD.scale(0.84, 0.84, [256, 60]).translate(0, 50);
  const torso = unaryUnion([rbox(96, 392, 416, 700, 92), rbox(60, 480, 452, 760, 120)])
    .convexHull()
    .intersection(box(0, 0, 512, 600));
  basesCache = {
    HEAD,
    CANVAS: box(0, 0, 512, 512),
    TORSO: torso,
    NECKSH: headInBody.translate(8, 18),
    eyes: {
      Idle: () => [capsule(EL, EY, EW, EH), capsule(ER, EY, EW, EH)],
      Joy: () => [arc(EL, EY - 4), arc(ER, EY - 4)],
      Wink: () => [capsule(EL, EY, EW, EH), arc(ER, EY - 4)],
      Wide: () => [capsule(EL - 3, EY - 4, 43, 110), capsule(ER + 3, EY - 4, 43, 110)],
      Sleepy: () => [
        capsule(EL, EY, EW, EH).intersection(box(0, EY + 4, 512, 512)),
        capsule(ER, EY, EW, EH).intersection(box(0, EY + 4, 512, 512)),
      ],
      Glance: () => [capsule(EL + 20, EY - 6, EW, EH - 8), capsule(ER + 20, EY - 6, EW, EH - 8)],
      Focus: () => [capsule(EL, EY + 12, EW, 62), capsule(ER, EY + 12, EW, 62)],
    },
    sproutParts: () => {
      const stem = unaryUnion([box(248.5, 89, 263.5, 142), circle(256, 89, 8.7)]);
      return {
        stem,
        leaves: [
          { geom: leaf(262, 91, 196, 52, 13, 9.5), tip: [262, 91, 196, 52] },
          { geom: leaf(250, 91, 334, 37, 17, 13), tip: [250, 91, 334, 37] },
        ],
      };
    },
  };
  return basesCache;
}

export function surf(art: Art, geom: Geom, col: string, over: Fill = DOME, kw: Kw = {}): void {
  art.add(geom, col, kw);
  art.add(geom, over);
}

export function spec(
  art: Art,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rot = -22,
  op = 0.55,
  crisp = false,
): void {
  art.add(
    ell(cx, cy, rx, ry, rot),
    rad([
      [0, "#FFFFFF", op],
      [0.6, "#FFFFFF", op * 0.35],
      [1, "#FFFFFF", 0],
    ]),
  );
  if (crisp) {
    art.add(ell(cx - rx * 0.25, cy - ry * 0.1, rx * 0.32, ry * 0.32, rot), "#FFFFFF", {
      fill_opacity: ".85",
    });
  }
}
