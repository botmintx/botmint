import initGeosJs from "geos-wasm";
import { geojsonToGeosGeom, geosGeomToGeojson } from "geos-wasm/helpers";

export type Pt = [number, number];

type Geo =
  | { type: "Point"; coordinates: number[] }
  | { type: "LineString"; coordinates: number[][] }
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] }
  | { type: "MultiLineString"; coordinates: number[][][] }
  | { type: "GeometryCollection"; geometries: Geo[] };

type GeosModule = {
  Module: {
    _malloc(size: number): number;
    _free(ptr: number): void;
    getValue(ptr: number, type: string): number;
    HEAPU32: Uint32Array;
  };
  GEOSisEmpty(g: number): number;
  GEOSBuffer(g: number, width: number, quadsegs: number): number;
  GEOSDifference(a: number, b: number): number;
  GEOSIntersection(a: number, b: number): number;
  GEOSUnion(a: number, b: number): number;
  GEOSUnaryUnion(g: number): number;
  GEOSConvexHull(g: number): number;
  GEOSBoundary(g: number): number;
  GEOSGeom_destroy(g: number): void;
  GEOSGeom_clone(g: number): number;
  GEOSGeom_createEmptyPolygon(): number;
  GEOSGeomTypeId(g: number): number;
  GEOSGetNumGeometries(g: number): number;
  GEOSGetGeometryN(g: number, n: number): number;
  GEOSGeomGetLength(g: number, out: number): number;
  GEOSInterpolate(line: number, distance: number): number;
  GEOSGetCentroid(g: number): number;
  GEOSGeom_createCollection(type: number, geoms: number, n: number): number;
};

const POLYGON = 3;
const MULTIPOLYGON = 6;
const COLLECTION = 7;

let geos: GeosModule | null = null;
const live = new Set<number>();

export async function initGeo(): Promise<void> {
  if (geos) return;
  geos = (await initGeosJs()) as GeosModule;
}

function g(): GeosModule {
  if (!geos) throw new Error("initGeo() has not been called");
  return geos;
}

function track(ptr: number): number {
  if (!ptr) throw new Error("GEOS returned a null geometry");
  live.add(ptr);
  return ptr;
}

export function releaseAll(): void {
  const api = g();
  for (const ptr of live) api.GEOSGeom_destroy(ptr);
  live.clear();
}

export class Geom {
  ptr: number;
  constructor(ptr: number) {
    this.ptr = track(ptr);
  }

  get empty(): boolean {
    return g().GEOSisEmpty(this.ptr) !== 0;
  }

  get geomType(): string {
    switch (g().GEOSGeomTypeId(this.ptr)) {
      case 0:
        return "Point";
      case 1:
        return "LineString";
      case 3:
        return "Polygon";
      case 5:
        return "MultiLineString";
      case 6:
        return "MultiPolygon";
      case 7:
        return "GeometryCollection";
      default:
        return "Other";
    }
  }

  get bounds(): [number, number, number, number] {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    const visit = (x: number, y: number) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    };
    eachCoord(this.toGeo(), visit);
    if (!Number.isFinite(minX)) return [0, 0, 0, 0];
    return [minX, minY, maxX, maxY];
  }

  get centroid(): Pt {
    const point = new Geom(g().GEOSGetCentroid(this.ptr));
    const geo = point.toGeo();
    if (geo.type !== "Point") return [0, 0];
    return [geo.coordinates[0] ?? 0, geo.coordinates[1] ?? 0];
  }

  get length(): number {
    const api = g();
    const out = api.Module._malloc(8);
    api.GEOSGeomGetLength(this.ptr, out);
    const value = api.Module.getValue(out, "double");
    api.Module._free(out);
    return value;
  }

  toGeo(): Geo {
    if (this.empty) return { type: "Polygon", coordinates: [] };
    return geosGeomToGeojson(this.ptr, g()) as Geo;
  }

  buffer(width: number, resolution = 16): Geom {
    const ptr = g().GEOSBuffer(this.ptr, width, resolution);
    if (!ptr) return emptyPolygon();
    return new Geom(ptr);
  }

  difference(other: Geom): Geom {
    const ptr = g().GEOSDifference(this.ptr, other.ptr);
    if (!ptr) return emptyPolygon();
    return new Geom(ptr);
  }

  intersection(other: Geom): Geom {
    const ptr = g().GEOSIntersection(this.ptr, other.ptr);
    if (!ptr) return emptyPolygon();
    return new Geom(ptr);
  }

  union(other: Geom): Geom {
    const ptr = g().GEOSUnion(this.ptr, other.ptr);
    if (!ptr) return emptyPolygon();
    return new Geom(ptr);
  }

  convexHull(): Geom {
    return new Geom(g().GEOSConvexHull(this.ptr));
  }

  boundary(): Geom {
    return new Geom(g().GEOSBoundary(this.ptr));
  }

  translate(dx: number, dy: number): Geom {
    if (dx === 0 && dy === 0) return this;
    return mapCoords(this, (x, y) => [x + dx, y + dy]);
  }

  scale(xFact: number, yFact: number, origin: Pt): Geom {
    const [ox, oy] = origin;
    return mapCoords(this, (x, y) => [ox + (x - ox) * xFact, oy + (y - oy) * yFact]);
  }

  rotate(angleDeg: number, origin: Pt): Geom {
    if (!angleDeg) return this;
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const [ox, oy] = origin;
    return mapCoords(this, (x, y) => {
      const dx = x - ox;
      const dy = y - oy;
      return [ox + dx * cos - dy * sin, oy + dx * sin + dy * cos];
    });
  }

  skewX(angleDeg: number, origin: Pt): Geom {
    const tan = Math.tan((angleDeg * Math.PI) / 180);
    const oy = origin[1];
    return mapCoords(this, (x, y) => [x + (y - oy) * tan, y]);
  }

  interpolate(distance: number): Pt {
    const geo = this.toGeo();
    const coords = lineCoords(geo);
    if (coords.length === 0) return [0, 0];
    const len = this.length;
    if (distance <= 0) return pair(coords[0]!);
    if (distance >= len) return pair(coords[coords.length - 1]!);
    const ptr = g().GEOSInterpolate(this.ptr, distance);
    if (!ptr) return pair(coords[coords.length - 1]!);
    const point = new Geom(ptr).toGeo();
    if (point.type !== "Point") return pair(coords[coords.length - 1]!);
    return [point.coordinates[0] ?? 0, point.coordinates[1] ?? 0];
  }

  polygonal(): Geom | null {
    if (this.empty) return null;
    const type = this.geomType;
    if (type === "Polygon" || type === "MultiPolygon") return this;
    const api = g();
    const count = api.GEOSGetNumGeometries(this.ptr);
    const polys: Geom[] = [];
    for (let i = 0; i < count; i += 1) {
      const child = api.GEOSGetGeometryN(this.ptr, i);
      const id = api.GEOSGeomTypeId(child);
      if (id === POLYGON || id === MULTIPOLYGON) polys.push(new Geom(api.GEOSGeom_clone(child)));
    }
    if (polys.length === 0) return null;
    return unaryUnion(polys);
  }
}

function pair(c: number[]): Pt {
  return [c[0] ?? 0, c[1] ?? 0];
}

function lineCoords(geo: Geo): number[][] {
  if (geo.type === "LineString") return geo.coordinates;
  if (geo.type === "MultiLineString") return geo.coordinates.flat();
  return [];
}

function eachCoord(geo: Geo, visit: (x: number, y: number) => void): void {
  if (geo.type === "Point") {
    visit(geo.coordinates[0] ?? 0, geo.coordinates[1] ?? 0);
    return;
  }
  if (geo.type === "LineString") {
    for (const c of geo.coordinates) visit(c[0] ?? 0, c[1] ?? 0);
    return;
  }
  if (geo.type === "Polygon") {
    for (const ring of geo.coordinates) for (const c of ring) visit(c[0] ?? 0, c[1] ?? 0);
    return;
  }
  if (geo.type === "MultiPolygon") {
    for (const poly of geo.coordinates)
      for (const ring of poly) for (const c of ring) visit(c[0] ?? 0, c[1] ?? 0);
    return;
  }
  if (geo.type === "MultiLineString") {
    for (const line of geo.coordinates) for (const c of line) visit(c[0] ?? 0, c[1] ?? 0);
    return;
  }
  if (geo.type === "GeometryCollection") {
    for (const child of geo.geometries) eachCoord(child, visit);
  }
}

function mapGeo(geo: Geo, fn: (x: number, y: number) => Pt): Geo {
  const ring = (coords: number[][]) => coords.map((c) => fn(c[0] ?? 0, c[1] ?? 0));
  if (geo.type === "Point") {
    const [x, y] = fn(geo.coordinates[0] ?? 0, geo.coordinates[1] ?? 0);
    return { type: "Point", coordinates: [x, y] };
  }
  if (geo.type === "LineString") return { type: "LineString", coordinates: ring(geo.coordinates) };
  if (geo.type === "Polygon")
    return { type: "Polygon", coordinates: geo.coordinates.map((r) => ring(r)) };
  if (geo.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: geo.coordinates.map((poly) => poly.map((r) => ring(r))),
    };
  }
  if (geo.type === "MultiLineString") {
    return { type: "MultiLineString", coordinates: geo.coordinates.map((line) => ring(line)) };
  }
  return {
    type: "GeometryCollection",
    geometries: geo.geometries.map((child) => mapGeo(child, fn)),
  };
}

function mapCoords(geom: Geom, fn: (x: number, y: number) => Pt): Geom {
  if (geom.empty) return emptyPolygon();
  return fromGeo(mapGeo(geom.toGeo(), fn));
}

export function fromGeo(geo: Geo): Geom {
  return new Geom(geojsonToGeosGeom(geo as never, g()));
}

export function emptyPolygon(): Geom {
  return new Geom(g().GEOSGeom_createEmptyPolygon());
}

export function unaryUnion(geoms: Geom[]): Geom {
  const items = geoms.filter((geom) => geom && !geom.empty);
  if (items.length === 0) return emptyPolygon();
  if (items.length === 1) return items[0]!;
  const api = g();
  const clones = items.map((geom) => api.GEOSGeom_clone(geom.ptr));
  const buf = api.Module._malloc(clones.length * 4);
  api.Module.HEAPU32.set(new Uint32Array(clones), buf / 4);
  const coll = api.GEOSGeom_createCollection(COLLECTION, buf, clones.length);
  api.Module._free(buf);
  if (!coll) return emptyPolygon();
  const united = api.GEOSUnaryUnion(coll);
  api.GEOSGeom_destroy(coll);
  if (!united) return emptyPolygon();
  return new Geom(united);
}

export function point(x: number, y: number): Geom {
  return fromGeo({ type: "Point", coordinates: [x, y] });
}

export function polygon(pts: Pt[]): Geom {
  if (pts.length < 3) return emptyPolygon();
  const ring = pts.map((p) => [p[0], p[1]]);
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0]!, first[1]!]);
  return fromGeo({ type: "Polygon", coordinates: [ring] });
}

export function lineString(pts: Pt[]): Geom {
  return fromGeo({ type: "LineString", coordinates: pts.map((p) => [p[0], p[1]]) });
}

export function box(x0: number, y0: number, x1: number, y1: number): Geom {
  return polygon([
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]);
}

export function fmt(v: number): string {
  return v
    .toFixed(2)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
}

export function pathData(geom: Geom): string {
  const poly = geom.polygonal();
  if (!poly) return "";
  const geo = poly.toGeo();
  const polys: number[][][][] = [];
  if (geo.type === "Polygon") polys.push(geo.coordinates);
  else if (geo.type === "MultiPolygon") polys.push(...geo.coordinates);
  else if (geo.type === "GeometryCollection") {
    for (const child of geo.geometries) {
      if (child.type === "Polygon") polys.push(child.coordinates);
      else if (child.type === "MultiPolygon") polys.push(...child.coordinates);
    }
  }
  let d = "";
  for (const rings of polys) {
    for (const ring of rings) {
      if (ring.length < 2) continue;
      const first = ring[0]!;
      const last = ring[ring.length - 1]!;
      const open = first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring.slice();
      d += `M${open.map((c) => `${fmt(c[0] ?? 0)} ${fmt(c[1] ?? 0)}`).join(" L")}Z`;
    }
  }
  return d;
}

export function range(start: number, stop: number, step = 1): number[] {
  const out: number[] = [];
  if (step > 0) for (let i = start; i < stop; i += step) out.push(i);
  else if (step < 0) for (let i = start; i > stop; i += step) out.push(i);
  return out;
}
