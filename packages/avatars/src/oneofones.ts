import { box, type Geom, pathData, range, unaryUnion } from "./geo.ts";
import { Art, bases, circle, ell, leaf, line, rbox } from "./paint.ts";
import { cel, clPuffer, GOLD_SH, pfp } from "./traits.ts";

export function fullBloom(): Art {
  const parts = bases().sproutParts();
  const big = unaryUnion([
    unaryUnion([parts.stem, ...parts.leaves.map((part) => part.geom)]).scale(1.3, 1.3, [256, 142]),
    rbox(250, 24, 262, 110, 4),
  ]);
  const fx = 256;
  const fy = 20;
  const pet = unaryUnion(
    range(0, 360, 60).map((angle) => leaf(fx, fy, fx, fy - 34, 11, 11).rotate(angle, [fx, fy])),
  );
  const drift = unaryUnion(
    (
      [
        [70, 120, 10],
        [440, 170, -30],
        [420, 60, 40],
        [96, 300, -20],
      ] as const
    ).map(([x, y, rot]) => leaf(x, y, x + 18, y - 10, 5, 5).rotate(rot, [x, y])),
  );
  return pfp({
    Background: "Paper",
    Body: "Mint",
    Eyes: "Joy",
    Headwear: "None",
    Eyewear: "None",
    Clothing: "Blazer",
    Accessory: "Seed Pendant",
    _sprout: big,
    _head_extra: [
      { geom: pet, fill: "#FFE6A3", kw: {} },
      { geom: cel(pet, 7).intersection(pet), fill: "#F2C94C", kw: {} },
      { geom: circle(fx, fy, 10), fill: "#E9B949", kw: {} },
      { geom: cel(circle(fx, fy, 10), 4), fill: GOLD_SH, kw: {} },
    ],
    _bg_extra: [`<path fill="#F2C94C" d="${pathData(drift)}"/>`],
  });
}

export function spacewalk(): Art {
  const parts = bases().sproutParts();
  const sprout = unaryUnion([parts.stem, ...parts.leaves.map((part) => part.geom)]);
  let dome = unaryUnion([bases().HEAD, sprout.scale(1, 1, [256, 142])])
    .convexHull()
    .buffer(16, 32);
  dome = dome.buffer(-40).buffer(40);
  const shell = dome.buffer(14, 32);
  const rim = shell.difference(dome);
  const glare = leaf(150, 270, 168, 130, 7, 7);
  const sparkle = (x: number, y: number, r: number) =>
    unaryUnion(
      [0, 90].map((angle) => leaf(x, y - r, x, y + r, r * 0.18, r * 0.18).rotate(angle, [x, y])),
    );
  const stars = unaryUnion([
    sparkle(46, 66, 9),
    sparkle(462, 100, 7),
    circle(404, 40, 2.2),
    circle(72, 212, 2),
    circle(474, 256, 2.4),
    circle(122, 30, 2),
    circle(30, 330, 2),
  ]);
  const planet = circle(452, 400, 46);
  const ring = ell(452, 404, 82, 14, -16).difference(ell(452, 404, 66, 7, -16));
  const front = ring.difference(box(0, 0, 512, 404).intersection(planet.buffer(0)));
  const suit = (art: Art, skin: string) => {
    clPuffer(art, skin, "#EDEFF0");
    const collar = rbox(150, 366, 362, 420, 24);
    art.add(collar, "#A9B0B4");
    art.add(rbox(150, 366, 362, 384, 12), "#C9CFD2");
    art.add(rbox(300, 452, 348, 482, 6), "#14171A");
    art.add(rbox(306, 458, 330, 466, 3), "#3CF0A0");
    art.add(circle(338, 470, 4), "#FF7A1A");
    art.add(rbox(160, 452, 206, 466, 4), "#FF7A1A");
  };
  const y = dome.bounds[1];
  return pfp({
    Background: "Carbon",
    Body: "Mint",
    Eyes: "Wide",
    Headwear: "None",
    Eyewear: "None",
    Clothing: "Puffer",
    Accessory: "None",
    _cloth: suit,
    _bg_extra: [
      `<path fill="#E7E9EA" d="${pathData(stars)}"/>`,
      `<path fill="#5B7CFF" d="${pathData(planet)}"/>`,
      `<path fill="#3D57C8" d="${pathData(cel(planet, 16))}"/>`,
      `<path fill="#F2C94C" d="${pathData(front)}"/>`,
    ],
    _head_extra: [
      { geom: dome, fill: "#BFE0FF", kw: { fill_opacity: "0.14" } },
      { geom: glare, fill: "#FFFFFF", kw: { fill_opacity: "0.6" } },
      { geom: rim, fill: "#D9DDE0", kw: {} },
      { geom: cel(rim, 12).intersection(rim), fill: "#A9B0B4", kw: {} },
      { geom: rbox(240, y - 12, 272, y + 4, 6), fill: "#A9B0B4", kw: {} },
    ],
  });
}

export function blueprint(): Art {
  const blue = "#1E4FD8";
  const white = "#EAF1FF";
  const art = new Art();
  art.L.push(`<rect width="512" height="512" fill="${blue}"/>`);
  art.add(
    unaryUnion([
      ...range(0, 512, 32).map((x) => box(x, 0, x + 1, 512)),
      ...range(0, 512, 32).map((y) => box(0, y, 512, y + 1)),
    ]),
    "#FFFFFF",
    { fill_opacity: "0.10" },
  );
  const outline = (geom: Geom, w = 3.5) => geom.boundary().buffer(w / 2, 8);
  const model = bases();
  const body = model.TORSO.translate(0, -50).intersection(box(-10, -10, 522, 470));
  const fit = (geom: Geom) => geom.scale(0.84, 0.84, [256, 60]);
  const sprout = model.sproutParts();
  const head = fit(model.HEAD);
  const eyes = fit(unaryUnion(model.eyes.Idle!()));
  const plant = fit(unaryUnion([sprout.stem, ...sprout.leaves.map((part) => part.geom)]));
  art.add(
    outline(body)
      .difference(head)
      .difference(box(0, 466, 512, 512)),
    white,
  );
  art.add(outline(head), white);
  art.add(outline(eyes), white);
  art.add(outline(plant), white);
  art.add(unaryUnion(range(20, 460, 18).map((y) => box(255, y, 257, y + 10))), white, {
    fill_opacity: "0.5",
  });
  art.add(unaryUnion(range(110, 400, 18).map((x) => box(x, 219, x + 10, 221))), white, {
    fill_opacity: "0.3",
  });
  const [x0, y0, x1, y1] = head.bounds;
  const tick = (x: number, y: number, vertical = false) =>
    vertical ? box(x - 7, y - 1, x + 7, y + 1) : box(x - 1, y - 7, x + 1, y + 7);
  const eyeBounds = eyes.bounds;
  const eyeY = eyeBounds[3] + 14;
  art.add(
    unaryUnion([
      box(x0, 64, x1, 65.5),
      tick(x0, 64.7),
      tick(x1, 64.7),
      box(452, y0, 453.5, y1),
      tick(452.7, y0, true),
      tick(452.7, y1, true),
      box(eyeBounds[0], eyeY, eyeBounds[2], eyeY + 1.5),
      tick(eyeBounds[0], eyeY + 0.7),
      tick(eyeBounds[2], eyeY + 0.7),
    ]),
    white,
  );
  art.add(
    unaryUnion([
      line(
        [
          [300, 44],
          [360, 24],
        ],
        1.5,
      ),
      box(360, 23, 420, 24.5),
      circle(300, 44, 3),
    ]),
    white,
  );
  const label = rbox(326, 432, 492, 492, 2);
  art.add(label.boundary().buffer(0.9), white);
  art.add(box(326, 461, 492, 462), white, { fill_opacity: "0.6" });
  return art;
}
