import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { createSpring } from "@/components/journey/motion-curve";

/*
  The building kit for the stack world: one palette, clay materials that can be dimmed per
  district (the spotlight), cached geometry, and the ink pass that draws every outline from
  the depth buffer. Everything here is shared; stations only assemble it.
*/

export type StationId = "design" | "frontend" | "backend" | "data" | "delivery";
export const STATION_IDS: StationId[] = ["design", "frontend", "backend", "data", "delivery"];

/** Each layer of the stack gets one hue family: a pale top, a mid side, a saturated accent, a deep shade. */
export const HUE: Record<StationId, { top: string; side: string; accent: string; deep: string }> = {
  design: { top: "#ffd9cc", side: "#f29a82", accent: "#ff6a4d", deep: "#c4432c" },
  frontend: { top: "#d5dcff", side: "#8e9cf2", accent: "#3552ff", deep: "#1f2db3" },
  backend: { top: "#e4dcff", side: "#a796ef", accent: "#7a5cff", deep: "#4a32c4" },
  data: { top: "#cdf1e8", side: "#73cfbd", accent: "#12b39a", deep: "#0b7a69" },
  delivery: { top: "#ffe9ae", side: "#f2b94c", accent: "#ffb21e", deep: "#c47800" },
};
export const INK = "#121a33";
/** The outline colour: the ink, a little lifted so lines read as drawing, not as cut-outs. */
const LINE = "#1d2546";
export const CREAM = "#fff8ee";
export const WHITE = "#fbfcff";
export const STEEL = "#c3cbdc";
export const LEAF = "#3fb37f";
export const LEAF_DEEP = "#22875a";
export const SKIN = "#e9b896";

/* ---------- springs, in 3D ---------- */
export type Spring = ReturnType<typeof createSpring>;
export const spring = createSpring;
/** Deepens the part of a value past its goal, so the catch reads (k = 3 for 3D, per the motion rules). */
export const popped = (v: number, k = 3) => (v > 1 ? 1 + (v - 1) * k : Math.max(0, v));
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/* ---------- zone uniforms: the spotlight dims every district but the one in focus ---------- */
export type Zone = StationId | "base";
export const zoneUniforms = () =>
  Object.fromEntries([...STATION_IDS, "base"].map(z => [z, { value: 0 }])) as Record<Zone, { value: number }>;


// Dimmed districts fade toward the paper, like a pencil study, instead of darkening.
const DIM_CHUNK = /* glsl */ `
  float swLum = dot(gl_FragColor.rgb, vec3(.299, .587, .114));
  vec3 swPale = mix(vec3(.73, .77, .85), vec3(.94, .955, .98), smoothstep(.15, .9, swLum));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, swPale, uDim * .84);
`;

function withDim<M extends THREE.Material>(material: M, dim: { value: number }) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uDim = dim;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uDim;")
      .replace("#include <dithering_fragment>", `${DIM_CHUNK}\n#include <dithering_fragment>`);
  };
  material.customProgramCacheKey = () => "sw-dim";
  return material;
}

export class Kit {
  readonly zones = zoneUniforms();
  private mats = new Map<string, THREE.Material>();
  private geos = new Map<string, THREE.BufferGeometry>();
  private owned: { dispose(): void }[] = [];

  /**
   * A soft clay surface in a district's dimming group: matte, lit by the sun and the room's
   * environment light, so curved parts shade smoothly instead of in hard bands.
   */
  mat(color: string, zone: Zone, opts: { emissive?: string; glow?: number; rough?: number } = {}) {
    const key = `m|${color}|${zone}|${opts.emissive ?? ""}|${opts.glow ?? 0}|${opts.rough ?? 0}`;
    let m = this.mats.get(key) as THREE.MeshStandardMaterial | undefined;
    if (!m) {
      m = withDim(new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.62, metalness: 0 }), this.zones[zone]);
      if (opts.emissive) { m.emissive.set(opts.emissive); m.emissiveIntensity = opts.glow ?? 0.6; }
      this.mats.set(key, m);
    }
    return m;
  }
  /** An unlit material (LEDs, glows) that still dims with its district. */
  flat(color: string, zone: Zone) {
    const key = `f|${color}|${zone}`;
    let m = this.mats.get(key) as THREE.MeshBasicMaterial | undefined;
    if (!m) { m = withDim(new THREE.MeshBasicMaterial({ color }), this.zones[zone]); this.mats.set(key, m); }
    return m;
  }
  /** A material that one object owns and recolours (an LED, a lamp, the travelling packet). */
  own(color: string, zone: Zone, basic = false) {
    const m = basic
      ? withDim(new THREE.MeshBasicMaterial({ color }), this.zones[zone])
      : withDim(new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0 }), this.zones[zone]);
    this.owned.push(m);
    return m;
  }
  /** Keeps a one-off geometry or texture alive until dispose. */
  keep<T extends { dispose(): void }>(thing: T) { this.owned.push(thing); return thing; }

  private geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
    let g = this.geos.get(key) as T | undefined;
    if (!g) { g = make(); this.geos.set(key, g); }
    return g;
  }
  box(w: number, h: number, d: number, r = Math.min(w, h, d) * 0.18) {
    return this.geo(`b|${w}|${h}|${d}|${r}`, () => new RoundedBoxGeometry(w, h, d, 3, r));
  }
  /** A 1×1×1 rounded box meant to be scaled (layout blocks, bars). */
  unit(r = 0.12) { return this.geo(`u|${r}`, () => new RoundedBoxGeometry(1, 1, 1, 3, r)); }
  cyl(rt: number, rb: number, h: number, seg = 32) {
    return this.geo(`c|${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
  }
  sphere(r: number, seg = 28) { return this.geo(`s|${r}|${seg}`, () => new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7))); }
  torus(r: number, t: number, arc = Math.PI * 2, seg = 64) {
    return this.geo(`o|${r}|${t}|${arc}|${seg}`, () => new THREE.TorusGeometry(r, t, 14, seg, arc));
  }
  capsule(r: number, len: number) { return this.geo(`p|${r}|${len}`, () => new THREE.CapsuleGeometry(r, len, 6, 18)); }
  cone(r: number, h: number, seg = 28) { return this.geo(`k|${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg)); }
  custom<T extends THREE.BufferGeometry>(key: string, make: () => T) { return this.geo(`x|${key}`, make); }

  dispose() {
    this.mats.forEach(m => m.dispose());
    this.geos.forEach(g => g.dispose());
    this.owned.forEach(o => o.dispose());
    this.mats.clear(); this.geos.clear(); this.owned = [];
  }
}

/** Adds a mesh that casts and receives shadows. */
export function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function group(parent: THREE.Object3D, x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  parent.add(g);
  return g;
}

/** A canvas texture with a short label (route names, a status), drawn once. */
export function label(kit: Kit, text: string, { bg = WHITE, fg = INK, w = 256, h = 128, size = 64, weight = 700 } = {}) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.beginPath(); g.roundRect(0, 0, w, h, h * 0.28); g.fill();
  g.fillStyle = fg;
  g.font = `${weight} ${size}px ui-rounded, "Outfit", system-ui, sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, w / 2, h / 2 + size * 0.04);
  const t = kit.keep(new THREE.CanvasTexture(c));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ---------- the ink pass ----------
   The scene renders into a target with a depth texture; one full-screen pass then finds where the
   depth's second derivative breaks (silhouettes and creases: an orthographic camera keeps planes
   exactly linear in depth) and lays ink there. One extra draw instead of a hull per mesh. */
export function createInk(renderer: THREE.WebGLRenderer, samples = 4) {
  const depth = new THREE.DepthTexture(2, 2);
  depth.type = THREE.UnsignedIntType;
  const target = new THREE.WebGLRenderTarget(2, 2, { samples, depthTexture: depth, type: THREE.HalfFloatType });
  target.texture.colorSpace = THREE.LinearSRGBColorSpace;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: target.texture },
      tDepth: { value: depth },
      uTexel: { value: new THREE.Vector2(1, 1) },
      uStep: { value: 0.001 },
      uInk: { value: new THREE.Color(LINE) },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tColor; uniform sampler2D tDepth;
      uniform vec2 uTexel; uniform float uStep; uniform vec3 uInk;
      varying vec2 vUv;
      float d(vec2 o) { return texture2D(tDepth, vUv + o * uTexel).x; }
      void main() {
        vec4 c = texture2D(tColor, vUv);
        float c0 = d(vec2(0.0));
        float l = d(vec2(-1.0, 0.0)), r = d(vec2(1.0, 0.0)), t = d(vec2(0.0, 1.0)), b = d(vec2(0.0, -1.0));
        float lap = abs(l + r - 2.0 * c0) + abs(t + b - 2.0 * c0);
        float e = smoothstep(uStep * 0.55, uStep * 1.6, lap);
        // The board's own outline against the paper is a touch heavier.
        float bg = step(0.99999, max(max(l, r), max(t, b))) * step(c0, 0.99999);
        e = max(e, bg);
        // Premultiplied "ink over scene", so the paper behind the canvas shows through.
        float k = e * 0.78;
        gl_FragColor = vec4(c.rgb * (1.0 - k) + uInk * k, c.a * (1.0 - k) + k);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    depthTest: false,
    depthWrite: false,
    toneMapped: true,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    target,
    resize(w: number, h: number, dpr: number) {
      target.setSize(Math.round(w * dpr), Math.round(h * dpr));
      // Sample one CSS pixel away, so the line keeps its weight on any screen.
      material.uniforms.uTexel.value.set(dpr / (w * dpr), dpr / (h * dpr));
    },
    /** depth units per sample step: crease threshold scales with how much world a pixel covers. */
    setStep(v: number) { material.uniforms.uStep.value = v; },
    render(r: THREE.WebGLRenderer, sceneToDraw: THREE.Scene, camera: THREE.Camera) {
      r.setRenderTarget(target);
      r.render(sceneToDraw, camera);
      r.setRenderTarget(null);
      r.render(scene, cam);
    },
    dispose() { target.dispose(); depth.dispose(); material.dispose(); quad.geometry.dispose(); },
  };
}
