import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createSpring } from "./motion-curve";
import { sceneDecoder } from "./scene-decoder";

/** Shared plumbing for the station studios modelled in Blender (design/journey/*.blend). */

export type Staged = { spring: ReturnType<typeof createSpring>; delay: number; goal: number; want: number; at: number };
export const popped = (v: number, k: number) => (v > 1 ? 1 + (v - 1) * k : Math.max(0, v));

/**
 * Rings of light that spread from a point and fade: the feedback for a hit, a click, a seat.
 * One shared geometry; each ring owns its material so it can fade on its own.
 */
export function createRipples(parent: THREE.Object3D, color: THREE.ColorRepresentation, count = 6) {
  const geometry = new THREE.RingGeometry(.84, 1, 56);
  const Z = new THREE.Vector3(0, 0, 1), UP = new THREE.Vector3(0, 1, 0);
  const rings = Array.from({ length: count }, () => {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false; mesh.renderOrder = 5; mesh.frustumCulled = false;
    parent.add(mesh);
    return { mesh, material, age: 1, life: 1, size: 1, rise: 0, strength: 1, steady: false };
  });
  let next = 0;
  return {
    /**
     * normal: the ring's facing (default up, lying on a surface). rise: units/s it drifts along +Y.
     * steady: holds its size and fades in and out (a band of light travelling), instead of spreading.
     */
    emit(at: THREE.Vector3, size: number, o: { normal?: THREE.Vector3; life?: number; rise?: number; strength?: number; steady?: boolean } = {}) {
      const r = rings[next]; next = (next + 1) % count;
      r.mesh.position.copy(at);
      r.mesh.quaternion.setFromUnitVectors(Z, o.normal ?? UP);
      Object.assign(r, { age: 0, life: o.life ?? .9, size, rise: o.rise ?? 0, strength: o.strength ?? 1, steady: o.steady ?? false });
      r.mesh.visible = true;
    },
    /** Returns true while any ring is still spreading. */
    step(dt: number) {
      let alive = false;
      for (const r of rings) {
        if (!r.mesh.visible) continue;
        r.age += dt;
        const u = Math.min(1, r.age / r.life);
        // Fast out, slow fade: the ring leaves the point with the hit's energy, then lingers.
        r.mesh.scale.setScalar(r.steady ? r.size : r.size * (.2 + .8 * (1 - (1 - u) ** 3)));
        r.material.opacity = (r.steady ? Math.sin(Math.PI * u) : (1 - u) ** 1.7) * .9 * r.strength;
        r.mesh.position.y += r.rise * dt;
        if (u >= 1) r.mesh.visible = false; else alive = true;
      }
      return alive;
    },
    dispose() { geometry.dispose(); rings.forEach(r => { r.mesh.removeFromParent(); r.material.dispose(); }); },
  };
}

/** A set of springs that each wait their own delay after the goal changes, on one clock. */
export function createStage() {
  const all: Staged[] = [];
  let clock = 0, wantAll = -1;
  return {
    all,
    add(delay: number, initial = 0): Staged {
      const s = { spring: createSpring(initial), delay, goal: initial, want: initial, at: 0 };
      all.push(s); return s;
    },
    get clock() { return clock; },
    /** Sets every spring's goal; going back plays in reverse order, a little quicker. */
    set(goal: number) {
      if (goal === wantAll) return false;
      wantAll = goal;
      const last = Math.max(0, ...all.map(s => s.delay));
      for (const s of all) { s.want = goal; s.at = clock + (goal ? s.delay : (last - s.delay) * .4); }
      return true;
    },
    /** Advances every spring by real time. Returns true while anything still moves or waits. */
    step(dt: number, reduced: boolean) {
      clock += dt;
      let moving = false;
      for (const s of all) {
        // Reduced motion draws only on scroll, so nothing may wait on a delay: go straight to the end.
        if (reduced || clock >= s.at) s.goal = s.want; else moving = true;
        if (reduced) s.spring.snap(s.goal);
        else moving = s.spring.step(s.goal, dt) || moving;
      }
      return moving;
    },
  };
}

/**
 * Loads a studio, adds it to `holder`, and merges every mesh that never moves into one
 * mesh per material (a handful of draw calls for a whole table). Meshes under a node whose
 * name matches `animated` are left alone for the runtime to move.
 */
export async function loadStudio(holder: THREE.Group, url: string, animated: RegExp, signal?: AbortSignal) {
  const loader = new GLTFLoader();
  let gltf;
  if (signal) {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Studio model HTTP ${response.status}`);
    const data = await response.arrayBuffer();
    signal.throwIfAborted();
    gltf = await loader.setMeshoptDecoder(sceneDecoder()).parseAsync(data, "");
  } else {
    gltf = await loader.loadAsync(url);
  }
  const scene = gltf.scene;
  holder.add(scene);
  // Parents first: the station group's own world position must be in every matrix below.
  holder.updateWorldMatrix(true, true);
  const disposables: { dispose(): void }[] = [];
  const toHolder = new THREE.Matrix4().copy(holder.matrixWorld).invert();
  const isAnimated = (obj: THREE.Object3D) => { for (let o: THREE.Object3D | null = obj; o; o = o.parent) if (animated.test(o.name)) return true; return false; };

  scene.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = o.material as THREE.MeshStandardMaterial;
    m.envMapIntensity = .7;
    if (m.name === "Brushed steel") { m.metalness = .8; m.roughness = .32; }
  });

  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const statics: THREE.Mesh[] = [];
  scene.traverse(o => { if (o instanceof THREE.Mesh && !isAnimated(o)) statics.push(o); });
  for (const mesh of statics) {
    const g = mesh.geometry.clone();
    for (const key of Object.keys(g.attributes)) if (key !== "position" && key !== "normal") g.deleteAttribute(key);
    if (!g.index) g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toHolder, mesh.matrixWorld));
    const list = byMaterial.get(mesh.material as THREE.Material) ?? [];
    list.push(g); byMaterial.set(mesh.material as THREE.Material, list);
  }
  for (const mesh of statics) { mesh.removeFromParent(); mesh.geometry.dispose(); }
  byMaterial.forEach((geometries, material) => {
    const merged = mergeGeometries(geometries, false);
    geometries.forEach(g => g.dispose());
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    holder.add(mesh); disposables.push(merged, material);
  });
  scene.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; disposables.push(o.geometry, o.material as THREE.Material); } });

  return {
    scene, disposables,
    find: (name: string) => scene.getObjectByName(name),
    /** Position and rotation of `obj` in the holder's space. */
    local(obj: THREE.Object3D) {
      obj.updateWorldMatrix(true, false);
      const m = new THREE.Matrix4().multiplyMatrices(toHolder, obj.matrixWorld);
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      m.decompose(p, q, s); return { p, q, s };
    },
  };
}
