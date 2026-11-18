import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Station } from "./data";
import { createSparkCube } from "./spark-cube";
import { createSparkStudio, SPARK_IDEA_Y } from "./spark-studio";
import { createShapeStudio } from "./shape-studio";
import { createSystemFoundry } from "./system-foundry";
import { createProvingGround } from "./proving-ground";
import { createCapacityField } from "./capacity-field";
import { createLaunchWorld } from "./launch-world";

export type CrateRef = { mesh: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; ph: number };
export type SpinRef = { obj: THREE.Object3D; speed: number };
export type FloatRef = { obj: THREE.Object3D; baseY: number; amp: number; rotSpeed?: number };
export type Extras = {
  sparkRig?: ReturnType<typeof createSparkCube>;
  /** Station 01: the studio table where a vague idea becomes a brief, a scope and a plan. */
  sparkStudio?: ReturnType<typeof createSparkStudio>;
  /** Station 02: the idea cube unfolds into the screens of a clickable prototype. */
  shapeStudio?: ReturnType<typeof createShapeStudio>;
  /** Station 03: a production cell that engineers the idea into a layered system. */
  systemFoundry?: ReturnType<typeof createSystemFoundry>;
  /** Station 04: the assembled system is powered up and proven in a test arena. */
  provingGround?: ReturnType<typeof createProvingGround>;
  /** Station 05: traffic, a load balancer, servers that scale out and update in turn. */
  capacityField?: ReturnType<typeof createCapacityField>;
  /** Station 06: the product goes live around the world, is monitored, and is handed over. */
  launchWorld?: ReturnType<typeof createLaunchWorld>;
  cardGroup: THREE.Group | null;
  cardBaseY: number;
  beaconLight: THREE.PointLight | null;
  crates: CrateRef[];
  spins: SpinRef[];
  sway: THREE.Object3D | null;
  floats: FloatRef[];
  inDoorGlow: THREE.Mesh | null;
  outDoorGlow: THREE.Mesh | null;
  pulseMeshes: THREE.Mesh[];
};

export type BuildKit = {
  B: (x: number, y: number, z: number, w: number, h: number, d: number, col?: string, ry?: number) => void;
  scene: THREE.Scene;
  heading: number;
  lx: (v: number, u: number) => [number, number];
  px: number;
  pz: number;
  accent: THREE.Color;
  accentHex: string;
  frameMat: THREE.MeshStandardMaterial;
  winMat: THREE.MeshStandardMaterial;
  stationData: Station;
};

const MIN = {
  body: "#e5e0d8",
  body2: "#d0cbc3",
  body3: "#bbb7b0",
  structural: "#969c9e",
  dark: "#1e263d",
};

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0.02, ...extra });

let _platformTex: THREE.CanvasTexture | null = null;
function getPlatformTexture(): THREE.CanvasTexture | undefined {
  if (typeof document === "undefined") return undefined;
  if (_platformTex) return _platformTex;
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1024;
  const ctx = c.getContext("2d");
  if (!ctx) return undefined;

  const baseGrad = ctx.createRadialGradient(512, 512, 60, 512, 512, 512);
  baseGrad.addColorStop(0, "#fbfcfe");
  baseGrad.addColorStop(0.6, "#f3f6fb");
  baseGrad.addColorStop(1, "#e6edf5");
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.lineWidth = 1.4;
  for (let r = 30; r < 510; r += 5) {
    const alpha = (0.02 + 0.025 * Math.sin(r * 0.45)).toFixed(3);
    ctx.strokeStyle = `rgba(155, 172, 195, ${alpha})`;
    ctx.beginPath();
    ctx.arc(512, 512, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  [120, 220, 320, 420, 480].forEach((r) => {
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "rgba(165, 182, 205, 0.12)";
    ctx.beginPath();
    ctx.arc(512, 512, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  _platformTex = new THREE.CanvasTexture(c);
  _platformTex.colorSpace = THREE.SRGBColorSpace;
  return _platformTex;
}

let _platformRoughness: THREE.CanvasTexture | null = null;
function getPlatformRoughnessMap(): THREE.CanvasTexture | undefined {
  if (typeof document === "undefined") return undefined;
  if (_platformRoughness) return _platformRoughness;
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1024;
  const ctx = c.getContext("2d");
  if (!ctx) return undefined;

  ctx.fillStyle = "#2c2c2c";
  ctx.fillRect(0, 0, 1024, 1024);

  for (let r = 15; r < 510; r += 8) {
    const v = Math.floor(34 + 18 * Math.sin(r * 0.35));
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = `rgb(${v},${v},${v})`;
    ctx.beginPath();
    ctx.arc(512, 512, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const mirrorGrad = ctx.createRadialGradient(512, 512, 0, 512, 512, 210);
  mirrorGrad.addColorStop(0, "#0c0c0c");
  mirrorGrad.addColorStop(0.85, "#141414");
  mirrorGrad.addColorStop(1, "#282828");
  ctx.fillStyle = mirrorGrad;
  ctx.beginPath();
  ctx.arc(512, 512, 210, 0, Math.PI * 2);
  ctx.fill();

  _platformRoughness = new THREE.CanvasTexture(c);
  return _platformRoughness;
}

let _hornTex: THREE.CanvasTexture | null = null;
function getHornTexture(): THREE.CanvasTexture | undefined {
  if (typeof document === "undefined") return undefined;
  if (_hornTex) return _hornTex;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 1024;
  const ctx = c.getContext("2d");
  if (!ctx) return undefined;

  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, "#fafbfd");
  grad.addColorStop(0.45, "#eef2f8");
  grad.addColorStop(1, "#f4f7fb");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 1024);

  ctx.lineWidth = 1;
  for (let x = 0; x < 512; x += 4) {
    const a = (0.015 + 0.02 * Math.sin(x * 0.75)).toFixed(3);
    ctx.strokeStyle = `rgba(160, 178, 200, ${a})`;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1024);
    ctx.stroke();
  }

  _hornTex = new THREE.CanvasTexture(c);
  _hornTex.colorSpace = THREE.SRGBColorSpace;
  return _hornTex;
}

function rbox(kit: BuildKit, w: number, h: number, d: number, r: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, Math.min(w, Math.min(h, d)) / 2.2)), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  kit.scene.add(m);
  return m;
}

function atLocal(kit: BuildKit, m: THREE.Object3D, v: number, u: number, y: number) {
  const [x, z] = kit.lx(v, u);
  m.position.set(x, y, z);
  m.rotation.y = kit.heading;
}

// -------------------------------------------------------------
// DOOR HELPERS (Two Doors for Stations 2 to 6: IN and OUT)
// -------------------------------------------------------------
function makeDoorPortals(kit: BuildKit, spanV: number, inU: number, outU: number, height: number) {
  const { frameMat, winMat } = kit;
  const body = std(MIN.body);
  const body2 = std(MIN.body2);

  const createArch = (u: number, isEntrance: boolean) => {
    // Left & right portal jambs
    [-spanV, spanV].forEach((s) => {
      const jamb = rbox(kit, 0.85, height, 1.2, 0.15, body);
      atLocal(kit, jamb, s, u, height / 2);
      const accentTrim = rbox(kit, 0.9, 0.25, 1.25, 0.06, frameMat);
      atLocal(kit, accentTrim, s, u, 0.5);
    });

    // Lintel spanning across
    const lintel = rbox(kit, spanV * 2 + 0.85, 0.85, 1.3, 0.16, body2);
    atLocal(kit, lintel, 0, u, height + 0.4);

    // Glowing neon threshold arch strip
    const glowArch = rbox(kit, spanV * 2, 0.18, 0.18, 0.05, winMat);
    atLocal(kit, glowArch, 0, u, height - 0.1);

    // Ground threshold plate where route enters/leaves
    const thresholdPlate = rbox(kit, spanV * 1.8, 0.05, 1.8, 0.08, frameMat);
    atLocal(kit, thresholdPlate, 0, u, 0.025);

    return glowArch;
  };

  const inDoor = createArch(inU, true);
  const outDoor = createArch(outU, false);
  return { inDoor, outDoor };
}

// -------------------------------------------------------------
// GRAND ARCHITECTURAL PEDESTAL & FLANKING CRESCENT HORNS
// Shared by Stations 1, 2, and 3: The Spark, Taking Shape, Building the System
// Substantially wider and taller so all components are distinctly separated without collision
// -------------------------------------------------------------
function buildGrandAltarBase(kit: BuildKit, extras: Extras, customRotY?: number) {
  const { scene, px, pz } = kit;

  const altar = new THREE.Group();
  altar.position.set(px, 0, pz);
  // Symmetrical relative to camera view angle
  altar.rotation.y = customRotY !== undefined ? customRotY : -Math.PI / 6;
  scene.add(altar);

  const add = (m: THREE.Mesh) => {
    m.castShadow = true;
    m.receiveShadow = true;
    altar.add(m);
    return m;
  };

  // Reflective & Texturized Materials
  const platformMat = new THREE.MeshPhysicalMaterial({
    color: "#ded8ce",
    roughness: 0.18,
    metalness: 0.06,
    clearcoat: 0.85,
    clearcoatRoughness: 0.1,
    map: getPlatformTexture(),
    roughnessMap: getPlatformRoughnessMap(),
  });
  const platformStepMat = new THREE.MeshPhysicalMaterial({
    color: "#c9c3ba",
    roughness: 0.22,
    metalness: 0.05,
    clearcoat: 0.75,
    clearcoatRoughness: 0.12,
    map: getPlatformTexture(),
    roughnessMap: getPlatformRoughnessMap(),
  });
  const daisMirrorMat = new THREE.MeshPhysicalMaterial({
    color: "#eee8de",
    roughness: 0.06,
    metalness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  });
  const hornMat = new THREE.MeshPhysicalMaterial({
    color: "#e3ddd2",
    roughness: 0.22,
    metalness: 0.03,
    clearcoat: 0.7,
    clearcoatRoughness: 0.12,
    map: getHornTexture(),
  });

  // Rich Warm Gold Materials (never lemon yellow)
  const neonWarmGoldMat = new THREE.MeshStandardMaterial({
    color: "#e28b24",
    emissive: "#d97706",
    emissiveIntensity: 1.35,
    roughness: 0.18,
  });
  const baseLedGrooveMat = new THREE.MeshStandardMaterial({
    color: "#d97706",
    emissive: "#b45309",
    emissiveIntensity: 1.25,
    roughness: 0.2,
  });

  // TIER 1 BASE CYLINDER (Substantially wider and grand circular plinth)
  const baseRadius = 14.0;
  const baseHeight = 2.2;
  const baseMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(baseRadius, baseRadius, baseHeight, 64),
    platformMat
  );
  baseMesh.position.y = baseHeight / 2;
  add(baseMesh);

  // Horizontal glowing LED groove running along base perimeter near bottom
  const baseGrooveNeon = new THREE.Mesh(
    new THREE.TorusGeometry(baseRadius + 0.03, 0.09, 16, 120),
    baseLedGrooveMat
  );
  baseGrooveNeon.rotation.x = Math.PI / 2;
  baseGrooveNeon.position.y = 0.45;
  add(baseGrooveNeon);
  extras.pulseMeshes.push(baseGrooveNeon);

  // TIER 2 MIDDLE CONCENTRIC CYLINDER (Elevated podium plinth)
  const midRadius = 7.0;
  const midHeight = 2.2;
  const midMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(midRadius, midRadius, midHeight, 64),
    platformStepMat
  );
  midMesh.position.y = baseHeight + midHeight / 2;
  add(midMesh);

  // TIER 3 INNER ALABASTER DAIS
  const daisRadius = 5.2;
  const daisHeight = 0.16;
  const daisMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(daisRadius, daisRadius, daisHeight, 48),
    platformMat
  );
  daisMesh.position.y = baseHeight + midHeight + daisHeight / 2;
  add(daisMesh);

  // Concentric glowing circular warm gold neon light ring embedded in the dais
  const daisNeon = new THREE.Mesh(
    new THREE.TorusGeometry(4.9, 0.08, 16, 80),
    neonWarmGoldMat
  );
  daisNeon.rotation.x = Math.PI / 2;
  daisNeon.position.y = baseHeight + midHeight + daisHeight + 0.01;
  add(daisNeon);
  extras.pulseMeshes.push(daisNeon);

  // Highly reflective dais mirror disc directly capturing the floating cube's golden reflection
  const mirrorDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(4.7, 4.7, 0.015, 64),
    daisMirrorMat
  );
  mirrorDisc.position.y = baseHeight + midHeight + daisHeight + 0.012;
  add(mirrorDisc);

  // THE TWO GRAND FLANKING CRESCENT HORNS (Pushed wide: base at x = ±9.6 to ±12.0)
  // Provides over 2.1 units of clear breathing margin inside so side elements never collide
  const wingExtrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: 2.2,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.12,
    bevelThickness: 0.12,
    curveSegments: 36,
  };

  // 1. RIGHT CRESCENT HORN
  const rightShape = new THREE.Shape();
  rightShape.moveTo(9.6, 0);
  rightShape.lineTo(12.0, 0);
  rightShape.bezierCurveTo(12.2, 4.0, 11.4, 8.5, 9.4, 11.8);
  rightShape.bezierCurveTo(8.4, 13.2, 7.0, 13.75, 5.8, 13.8);
  rightShape.lineTo(4.4, 13.8);
  rightShape.bezierCurveTo(5.6, 13.6, 6.8, 13.0, 7.8, 11.6);
  rightShape.bezierCurveTo(9.2, 8.5, 9.7, 4.0, 9.6, 0);
  rightShape.closePath();

  const rightGeo = new THREE.ExtrudeGeometry(rightShape, wingExtrudeSettings);
  rightGeo.translate(0, 0, -2.2 / 2);
  const rightWing = new THREE.Mesh(rightGeo, hornMat);
  rightWing.position.set(0, baseHeight, 0);
  add(rightWing);

  // Right inner glowing warm gold neon channel
  const rightCurve1 = new THREE.CubicBezierCurve3(
    new THREE.Vector3(9.6, 0.2, 0),
    new THREE.Vector3(9.7, 4.0, 0),
    new THREE.Vector3(9.2, 8.5, 0),
    new THREE.Vector3(7.8, 11.6, 0)
  );
  const rightCurve2 = new THREE.CubicBezierCurve3(
    new THREE.Vector3(7.8, 11.6, 0),
    new THREE.Vector3(6.8, 13.0, 0),
    new THREE.Vector3(5.6, 13.6, 0),
    new THREE.Vector3(4.5, 13.75, 0)
  );
  const rightCurvePath = new THREE.CurvePath<THREE.Vector3>();
  rightCurvePath.add(rightCurve1);
  rightCurvePath.add(rightCurve2);
  const rightNeonGeo = new THREE.TubeGeometry(rightCurvePath, 64, 0.08, 12, false);
  const rightNeonMesh = new THREE.Mesh(rightNeonGeo, neonWarmGoldMat);
  rightNeonMesh.position.set(0, baseHeight, 0);
  add(rightNeonMesh);
  extras.pulseMeshes.push(rightNeonMesh);

  // 2. LEFT CRESCENT HORN (Counter-clockwise shape for correct outward vertex normals)
  const leftShape = new THREE.Shape();
  leftShape.moveTo(-9.6, 0);
  leftShape.bezierCurveTo(-9.7, 4.0, -9.2, 8.5, -7.8, 11.6);
  leftShape.bezierCurveTo(-6.8, 13.0, -5.6, 13.6, -4.4, 13.8);
  leftShape.lineTo(-5.8, 13.8);
  leftShape.bezierCurveTo(-7.0, 13.75, -8.4, 13.2, -9.4, 11.8);
  leftShape.bezierCurveTo(-11.4, 8.5, -12.2, 4.0, -12.0, 0);
  leftShape.closePath();

  const leftGeo = new THREE.ExtrudeGeometry(leftShape, wingExtrudeSettings);
  leftGeo.translate(0, 0, -2.2 / 2);
  const leftWing = new THREE.Mesh(leftGeo, hornMat);
  leftWing.position.set(0, baseHeight, 0);
  add(leftWing);

  // Left inner glowing warm gold neon channel
  const leftCurve1 = new THREE.CubicBezierCurve3(
    new THREE.Vector3(-9.6, 0.2, 0),
    new THREE.Vector3(-9.7, 4.0, 0),
    new THREE.Vector3(-9.2, 8.5, 0),
    new THREE.Vector3(-7.8, 11.6, 0)
  );
  const leftCurve2 = new THREE.CubicBezierCurve3(
    new THREE.Vector3(-7.8, 11.6, 0),
    new THREE.Vector3(-6.8, 13.0, 0),
    new THREE.Vector3(-5.6, 13.6, 0),
    new THREE.Vector3(-4.5, 13.75, 0)
  );
  const leftCurvePath = new THREE.CurvePath<THREE.Vector3>();
  leftCurvePath.add(leftCurve1);
  leftCurvePath.add(leftCurve2);
  const leftNeonGeo = new THREE.TubeGeometry(leftCurvePath, 64, 0.08, 12, false);
  const leftNeonMesh = new THREE.Mesh(leftNeonGeo, neonWarmGoldMat);
  leftNeonMesh.position.set(0, baseHeight, 0);
  add(leftNeonMesh);
  extras.pulseMeshes.push(leftNeonMesh);

  // THE CENTRAL FLOATING SPARK CUBE
  const daisTopY = baseHeight + midHeight + daisHeight; // 4.56
  const cubeCenterY = 8.8;
  const sparkRig = createSparkCube();
  const cubeG = sparkRig.root;
  cubeG.position.set(0, cubeCenterY, 0);
  cubeG.rotation.set(0, Math.PI / 4, 0);
  altar.add(cubeG);

  extras.sparkRig = sparkRig;

  const sparkLight = new THREE.PointLight(0xe08518, 4.2, 28, 1.8);
  sparkLight.position.set(0, cubeCenterY, 0);
  altar.add(sparkLight);
  extras.beaconLight = sparkLight;

  extras.floats.push({ obj: cubeG, baseY: cubeCenterY, amp: 0.08 });

  return {
    altar,
    add,
    baseHeight,
    midHeight,
    daisHeight,
    daisTopY,
    cubeG,
    cubeCenterY,
    platformMat,
    platformStepMat,
    daisMirrorMat,
    hornMat,
    neonWarmGoldMat,
    baseLedGrooveMat,
  };
}

// =============================================================
// STATION 01: THE SPARK STUDIO
// The idea (the glass cube the intro flies into) floats over a studio table modelled in
// Blender, where it is turned into a brief, a scope, a plan and a measure of success.
// =============================================================
function buildSparkStudio(kit: BuildKit, extras: Extras) {
  const root = new THREE.Group();
  root.name = "Spark station";
  root.position.set(kit.px, 0, kit.pz);
  kit.scene.add(root);
  // The cube keeps the exact world pose the intro was choreographed around.
  const cubeHolder = new THREE.Group();
  cubeHolder.rotation.y = -Math.PI / 6;
  root.add(cubeHolder);
  const cubeCenterY = SPARK_IDEA_Y;
  const sparkRig = createSparkCube();
  const cubeG = sparkRig.root;
  cubeG.position.set(0, cubeCenterY, 0);
  cubeG.rotation.set(0, Math.PI / 4, 0);
  cubeHolder.add(cubeG);
  extras.sparkRig = sparkRig;
  const sparkLight = new THREE.PointLight(0xe08518, 4.2, 28, 1.8);
  sparkLight.position.set(0, cubeCenterY, 0);
  root.add(sparkLight);
  extras.beaconLight = sparkLight;
  extras.floats.push({ obj: cubeG, baseY: cubeCenterY, amp: 0.08 });
  extras.sparkStudio = createSparkStudio(root);
}

// =============================================================
// STATION 02: THE SHAPE STUDIO
// The same idea arrives as a cube of six panels and unfolds into the six screens of a
// clickable prototype, wired together, beside the design system they are made from.
// =============================================================
function buildShapeStudio(kit: BuildKit, extras: Extras) {
  const root = new THREE.Group();
  root.name = "Shape station";
  root.position.set(kit.px, 0, kit.pz);
  kit.scene.add(root);
  extras.shapeStudio = createShapeStudio(root);
}

// =============================================================
// STATION 03: THE SYSTEM FOUNDRY
// A production cell with a front-facing platform:
// intake and laser cutter, a mover line through a QA tunnel, a cobot and the fixture where
// the system's layers are stacked and its features slot in.
// =============================================================
function buildSystemFoundry(kit: BuildKit, extras: Extras) {
  const root = new THREE.Group();
  root.name = "System station";
  root.position.set(kit.px, 0, kit.pz);
  kit.scene.add(root);
  extras.systemFoundry = createSystemFoundry(root);
}

// =============================================================
// MAIN DISPATCHER: BUILD STATION
// =============================================================
export function buildStation(kind: string, kit: BuildKit): Extras {
  const extras: Extras = {
    cardGroup: null,
    cardBaseY: 0,
    beaconLight: null,
    crates: [],
    spins: [],
    sway: null,
    floats: [],
    inDoorGlow: null,
    outDoorGlow: null,
    pulseMeshes: [],
  };

  const { scene, px, pz } = kit;

  // -----------------------------------------------------------
  // 1. THE SPARK (Phase 01) — 100% REPLICA OF USER REFERENCE IMAGE
  // Grand, wide pedestal with reflective finish and central floating warm cube
  // -----------------------------------------------------------
  if (kind === "sparkAltar") {
    buildSparkStudio(kit, extras);
    extras.cardGroup = null;
  }

  // -----------------------------------------------------------
  // 2. TAKING SHAPE (Phase 02) — UI/UX & PROTOTYPING STUDIO
  // Grand pedestal with 3 wide-orbiting floating UI cards (Bento, Specs, Analytics)
  // -----------------------------------------------------------
  else if (kind === "shapeStudio") {
    buildShapeStudio(kit, extras);
    extras.cardGroup = null;
  }

  // -----------------------------------------------------------
  // 3. BUILDING THE SYSTEM (Phase 03) — FULLSTACK ARCHITECTURE FOUNDRY
  // 100% REPLICA OF USER REFERENCE IMAGE:
  // Grand, wide pedestal with huge clearance + Database disk stack + Floating cube +
  // 3 connected satellite nodes (Left Server Rack, Top Web Browser, Right 3D Cloud)
  // Absolutely ZERO collisions: side nodes sit with over 2.1 units margin from crescent horns
  // -----------------------------------------------------------
  else if (kind === "systemFoundry") {
    buildSystemFoundry(kit, extras);
    extras.cardGroup = null;
  }

  // Station 04: the system from station 03 is powered up and proven in a test arena.
  else if (kind === "runtimeTestCell") {
    const root = new THREE.Group();
    root.name = "Proving ground";
    root.position.set(px, 0, pz);
    scene.add(root);
    extras.provingGround = createProvingGround(root);
  }
  // Station 05: live requests keep moving as reserve capacity comes online.
  else if (kind === "capacityBay") {
    const root = new THREE.Group();
    root.name = "Capacity field";
    root.position.set(px, 0, pz);
    scene.add(root);
    extras.capacityField = createCapacityField(root);
  }

  // Station 06: the deployed product, release checks, and the ownership folio.
  else if (kind === "releaseDesk") {
    const root = new THREE.Group();
    root.name = "Launch world";
    root.position.set(px, 0, pz);
    scene.add(root);
    extras.launchWorld = createLaunchWorld(root);
  }
  return extras;
}
