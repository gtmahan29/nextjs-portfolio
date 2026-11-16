import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const HAIR_STYLES = ["Side-swept", "Soft curls", "Textured crop", "Wavy bob", "Loose ponytail"] as const;
export type HairStyle = typeof HAIR_STYLES[number];

/** Continuous silhouettes with broad sculpted texture instead of individual tubes. */
export function createCharacterHair(style: HairStyle, color = "#584337", detailed = true) {
  const bob = style === "Wavy bob", pony = style === "Loose ponytail";
  const curls = style === "Soft curls", crop = style === "Textured crop";
  const parts: THREE.BufferGeometry[] = [];
  const finish = (points: number[], indices: number[], flex: number[]) => {
    const source = new THREE.BufferGeometry();
    source.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    source.setAttribute("flex", new THREE.Float32BufferAttribute(flex, 1));
    source.setIndex(indices);
    const geometry = mergeVertices(source, .00001);
    geometry.computeVertexNormals();
    parts.push(geometry.toNonIndexed());
    source.dispose(); geometry.dispose();
  };
  const points: number[] = [], indices: number[] = [], flex: number[] = [];
  const columns = detailed ? 64 : 32, rows = detailed ? 28 : 14;
  for (let row = 0; row <= rows + 1; row++) {
    const t = Math.min(row, rows) / rows;
    for (let column = 0; column <= columns; column++) {
      const az = column / columns * Math.PI * 2;
      const front = (Math.sin(az) + 1) / 2;
      const face = front ** 5;
      let edge = 1.91 - face * .71;
      if (style === "Side-swept") edge += face * (.09 + Math.cos(az) * .20);
      if (crop) edge -= .07;
      if (curls) edge += .035 * Math.cos(az * 5);
      const lat = t * edge;
      const ux = Math.cos(az) * Math.sin(lat), uy = Math.cos(lat), uz = Math.sin(az) * Math.sin(lat);
      const ripple = curls
        ? .006 * Math.sin(ux * 7 + uz * 3) * Math.sin(uy * 8 - uz * 5)
        : (crop ? .0012 : .0022) * Math.sin(ux * 14 + uz * 7 + uy * 4);
      let x = ux * ((curls ? .233 : bob ? .228 : .215) + ripple);
      let y = .275 + uy * ((curls ? .251 : crop ? .230 : .241) + ripple);
      let z = -.015 + uz * ((curls ? .213 : .198) + ripple);
      if (style === "Side-swept") {
        y += .020 * Math.exp(-((ux + .35) ** 2 + (uz - .15) ** 2) * 3) * (1 - t * .45);
        x -= .009 * Math.sin(Math.PI * t);
      }
      const ends = THREE.MathUtils.smoothstep(t, .62, 1);
      if (bob) {
        // One curtain around the sides/back with a rounded, tucked-under edge.
        const curtain = 1 - front ** 12;
        y -= ends * curtain * .205;
        x *= 1 + curtain * Math.sin(ends * Math.PI) * .07;
        z -= ends * curtain * .014;
        x += curtain * ends * .003 * Math.sin(az * 4);
      }
      if (row === rows + 1) {
        x *= .94; z = -.015 + (z + .015) * .94; y += .006;
      }
      points.push(x, y, z);
      flex.push(THREE.MathUtils.smoothstep(t, .72, 1) * (bob ? .65 : .10));
      if (row <= rows && column < columns) {
        const a = row * (columns + 1) + column, b = a + columns + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  finish(points, indices, flex);
  if (pony) {
    // A single soft ponytail; no visible ropes, beads, or stacked strand tips.
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, .32, -.188), new THREE.Vector3(0, .30, -.27),
      new THREE.Vector3(.013, .17, -.32), new THREE.Vector3(.018, .035, -.30),
      new THREE.Vector3(.009, -.035, -.26),
    ]);
    const segments = detailed ? 28 : 14, sides = detailed ? 24 : 12, frames = curve.computeFrenetFrames(segments, false);
    const p: number[] = [], ids: number[] = [], weights: number[] = [];
    for (let row = 0; row <= segments; row++) {
      const t = row / segments, center = curve.getPointAt(t);
      const radius = .048 * (1 - t ** 2) ** .65 + .002;
      for (let j = 0; j <= sides; j++) {
        const angle = j / sides * Math.PI * 2;
        const r = radius + .001 * Math.cos(angle * 3 + t * 2) * Math.sin(Math.PI * t);
        const v = center.clone().addScaledVector(frames.normals[row], Math.cos(angle) * r * .85)
          .addScaledVector(frames.binormals[row], Math.sin(angle) * r);
        p.push(v.x, v.y, v.z); weights.push(t * t);
        if (row < segments && j < sides) {
          const a = row * (sides + 1) + j, b = a + sides + 1;
          ids.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }
    [0, segments].forEach(row => {
      const v = curve.getPointAt(row / segments), center = p.length / 3;
      p.push(v.x, v.y, v.z); weights.push(row === 0 ? 0 : 1);
      for (let j = 0; j < sides; j++) {
        const a = row * (sides + 1) + j;
        ids.push(center, row === 0 ? a : a + 1, row === 0 ? a + 1 : a);
      }
    });
    finish(p, ids, weights);
  }
  const geometry = mergeGeometries(parts)!; parts.forEach(part => part.dispose());
  const material = new THREE.MeshStandardMaterial({ color, roughness: .91, metalness: 0 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `hair-${style}`; mesh.castShadow = true; mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  const position = geometry.getAttribute("position"), flexibility = geometry.getAttribute("flex");
  const rest = Float32Array.from(position.array);
  let previousTime = 0, sway = 0;
  const update = (time: number, headTurn: number, moving: boolean, reduced: boolean) => {
    const dt = Math.max(0, Math.min(.05, time - previousTime)); previousTime = time;
    sway += ((reduced ? 0 : -headTurn * .025) - sway) * (1 - Math.exp(-dt * 8));
    for (let i = 0; i < position.count; i++) {
      const weight = flexibility.getX(i), x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
      const wave = reduced ? 0 : Math.sin(time * (moving ? 5.4 : 1.7) + y * 2) * (bob || pony ? .004 : .001);
      position.setXYZ(i, x + weight * (sway + wave), y, z + weight * wave * .35);
    }
    position.needsUpdate = true;
  };
  return { mesh, update, dispose: () => { geometry.dispose(); material.dispose(); } };
}
