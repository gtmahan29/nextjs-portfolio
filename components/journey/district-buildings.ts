import * as THREE from "three";
import type { BuildKit } from "./buildings";

export type DistrictSite = { x: number; z: number; heading: number };
export type DistrictFootprint = DistrictSite & { width: number; depth: number };
export function insideDistrict(x: number, z: number, footprints: DistrictFootprint[], margin = 1.5) {
  return footprints.some(site => {
    const dx = x - site.x, dz = z - site.z, cs = Math.cos(site.heading), sn = Math.sin(site.heading);
    return Math.abs(dx * cs - dz * sn) < site.width / 2 + margin
      && Math.abs(dx * sn + dz * cs) < site.depth / 2 + margin;
  });
}

/** Low, quiet satellite buildings placed well beyond the main plinth and route. */
export function buildStationDistrict(kit: BuildKit, index: number) {
  const { B, lx, heading } = kit;
  const footprints: DistrictFootprint[] = [];
  const reserve = (v: number, u: number, width: number, depth: number) => {
    const [x, z] = lx(v, u); footprints.push({ x, z, heading, width, depth });
  };
  const block = (v: number, u: number, y: number, w: number, h: number, d: number, color = "#e5edf3") => {
    const [x, z] = lx(v, u);
    B(x, y, z, w, h, d, color, heading);
  };
  const office = (v: number, u: number, w: number, d: number, floors: number) => {
    reserve(v, u, w + .8, d + 2);
    const h = floors * 2.5;
    block(v, u, 0, w + .8, .30, d + .8, "#d3dfe9");
    block(v, u, .30, w, h, d);
    for (let level = 0; level < floors; level++) {
      const y = .95 + level * 2.5;
      for (let column = -1; column <= 1; column++) {
        block(v + column * w * .26, u + d / 2 + .025, y, w * .15, 1.2, .08, "#b5c9d9");
        block(v + w / 2 + .025, u + column * d * .25, y, .08, 1.2, d * .15, "#b5c9d9");
      }
      block(v, u, 2.53 + level * 2.5, w + .15, .16, d + .15, "#d6e2ec");
    }
    block(v, u, h + .30, w + .4, .28, d + .4);
    block(v - w * .20, u - d * .18, h + .58, w * .35, .60, d * .28, "#c3d2df");
    block(v, u + d / 2 + .065, .3, 1.45, 2, .10, "#96adbe");
    block(v, u + d / 2 + .65, 2.45, 3.1, .18, 1.4);
  };
  const workshop = (v: number, u: number) => {
    reserve(v, u, 11.5, 7);
    block(v, u, 0, 8.8, .26, 6.8, "#d3dfe9");
    block(v, u, .26, 8, 4.1, 6);
    block(v, u, 4.36, 8.6, .35, 6.6, "#d6e2ec");
    [-2.5, 0, 2.5].forEach(offset => {
      block(v + offset, u + 3.04, .65, 1.75, 2.7, .09, "#b8cbd9");
      for (let j = 0; j < 4; j++) block(v + offset, u + 3.1, 1 + j * .48, 1.72, .07, .06, "#d2dee7");
    });
    block(v - 2.8, u - 1.8, 4.71, 1.4, .5, 1.1, "#b6c8d5");
    block(v + 5.1, u, 0, 2, 2.2, 2.1, "#d5e0e9");
  };
  // Alternating footprints keep the campus readable without enclosing the route.
  if (index % 2 === 0) office(30, -17, 8, 7, index === 4 ? 3 : 2);
  else workshop(30, -17);
  if (index % 2 === 0) workshop(-28, 22);
  else office(-28, 22, 6, 5.5, 1);
  // Small utility cabinet, shaded canopy, and a few deliveries alongside the annex.
  block(-19, 23, 0, 2.3, 2.4, 1.5, "#cad9e4");
  block(-19, 23, 2.4, 2.6, .16, 1.8);
  block(22, -24, 3.3, 5.8, .18, 4.3);
  [-1, 1].forEach(side => block(22 + side * 2.5, -24, 0, .18, 3.3, .18, "#b5c7d5"));
  for (let i = 0; i < 3; i++) block(-23 + i * 1.5, 29, 0, 1.2, 1, 1.2, "#d0dce6");
  reserve(-19, 23, 2.6, 1.8); reserve(22, -24, 5.8, 4.3);
  return footprints;
}

/** One compact cluster per gap, offset from the actual sampled route. */
export function buildInterstationDistricts(B: BuildKit["B"], route: [number, number][], indices: number[]) {
  const footprints: DistrictFootprint[] = [];
  for (let i = 0; i < indices.length - 1; i++) {
    const segment = Math.floor((indices[i] + indices[i + 1]) / 2);
    const [x, z] = route[segment], next = route[segment + 1], prev = route[segment - 1];
    const heading = Math.atan2(next[0] - prev[0], next[1] - prev[1]);
    const cs = Math.cos(heading), sn = Math.sin(heading);
    const side = i % 2 ? -1 : 1;
    const lx = (v: number, u: number): [number, number] => [x + v * cs + u * sn, z - v * sn + u * cs];
    const block = (v: number, u: number, y: number, w: number, h: number, d: number, color = "#e2ebf2") => {
      const [px, pz] = lx(v, u); B(px, y, pz, w, h, d, color, heading);
    };
    block(side * 32, 0, 0, 9, .28, 8, "#cddbe6");
    block(side * 32, 0, .28, 8, 4.8, 7);
    block(side * 32, 0, 5.08, 8.4, .25, 7.4, "#d0dfe9");
    [-2.3, 0, 2.3].forEach(v => block(side * 32 + v, 3.54, 1.0, 1.4, 2.8, .08, "#b5cbdc"));
    block(side * 25, -2, 0, 2.2, 2.6, 2.0, "#c9d9e5");
    block(side * 25, -2, 2.6, 2.5, .16, 2.3);
    const [px, pz] = lx(side * 32, 0);
    footprints.push({ x: px, z: pz, heading, width: 9, depth: 8 });
    const [ux, uz] = lx(side * 25, -2);
    footprints.push({ x: ux, z: uz, heading, width: 2.5, depth: 2.3 });
  }
  return footprints;
}
