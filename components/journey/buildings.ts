import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Station } from "./data";
import { createSparkCube } from "./spark-cube";

export type CrateRef = { mesh: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; ph: number };
export type SpinRef = { obj: THREE.Object3D; speed: number };
export type FloatRef = { obj: THREE.Object3D; baseY: number; amp: number; rotSpeed?: number };
export type Extras = {
  sparkRig?: ReturnType<typeof createSparkCube>;
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

  const { scene, heading, lx, px, pz, accent, frameMat, winMat, stationData } = kit;
  const body = std(MIN.body);
  const body2 = std(MIN.body2);
  const body3 = std(MIN.body3);
  const structural = std(MIN.structural, { roughness: 0.7 });

  // -----------------------------------------------------------
  // 1. THE SPARK (Phase 01) — 100% REPLICA OF USER REFERENCE IMAGE
  // Grand, wide pedestal with reflective finish and central floating warm cube
  // -----------------------------------------------------------
  if (kind === "sparkAltar") {
    buildGrandAltarBase(kit, extras, 0);
    extras.cardGroup = null;
  }

  // -----------------------------------------------------------
  // 2. TAKING SHAPE (Phase 02) — UI/UX & PROTOTYPING STUDIO
  // Grand pedestal with 3 wide-orbiting floating UI cards (Bento, Specs, Analytics)
  // -----------------------------------------------------------
  else if (kind === "shapeStudio") {
    const base = buildGrandAltarBase(kit, extras, 0);
    const { altar, cubeCenterY, neonWarmGoldMat } = base;

    const orbitGroup = new THREE.Group();
    orbitGroup.position.set(0, cubeCenterY, 0);
    altar.add(orbitGroup);

    const cardBaseMat = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      roughness: 0.16,
      metalness: 0.02,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.96,
    });

    const cardBackMat = new THREE.MeshStandardMaterial({
      color: "#d8e2ee",
      roughness: 0.38,
      metalness: 0.02,
    });

    const cardElemMat = new THREE.MeshStandardMaterial({
      color: "#fff9f0",
      emissive: "#d97706",
      emissiveIntensity: 0.55,
      roughness: 0.25,
      metalness: 0.02,
    });

    // Orbit radius 5.2 gives generous clearance inside the horns (inner margin at 8.7)
    const R_orbit = 5.2;

    // CARD 1: 2x2 BENTO APP GRID CARD (Left)
    const card1 = new THREE.Group();
    const a1 = Math.PI * 0.85;
    card1.position.set(Math.cos(a1) * R_orbit, -0.05, Math.sin(a1) * R_orbit);
    card1.rotation.y = -a1 + Math.PI / 2 + 0.2;
    orbitGroup.add(card1);

    const card1Back = new THREE.Mesh(
      new RoundedBoxGeometry(2.88, 3.38, 0.02, 2, 0.12),
      cardBackMat
    );
    card1Back.position.z = -0.05;
    card1.add(card1Back);

    const card1Panel = new THREE.Mesh(
      new RoundedBoxGeometry(2.8, 3.3, 0.1, 3, 0.12),
      cardBaseMat
    );
    card1Panel.castShadow = true;
    card1Panel.receiveShadow = true;
    card1.add(card1Panel);

    // 4 Bento tiles in 2x2 grid with embossed warm gold micro-icons
    [
      [-0.66, 0.7],
      [0.66, 0.7],
      [-0.66, -0.7],
      [0.66, -0.7],
    ].forEach(([tx, ty], tIdx) => {
      const tile = new THREE.Mesh(
        new RoundedBoxGeometry(0.92, 0.92, 0.06, 2, 0.1),
        cardElemMat
      );
      tile.position.set(tx, ty, 0.06);
      card1.add(tile);

      if (tIdx === 0) {
        // 4 dots
        [-0.18, 0.18].forEach((dx) => {
          [-0.18, 0.18].forEach((dy) => {
            const dot = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.14, 0.03, 1, 0.02), neonWarmGoldMat);
            dot.position.set(tx + dx, ty + dy, 0.095);
            card1.add(dot);
          });
        });
      } else if (tIdx === 1) {
        // Horizontal toggle pill
        const pill = new THREE.Mesh(new RoundedBoxGeometry(0.48, 0.18, 0.03, 1, 0.04), neonWarmGoldMat);
        pill.position.set(tx, ty, 0.095);
        card1.add(pill);
      } else if (tIdx === 2) {
        // Circular progress ring
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 20), neonWarmGoldMat);
        ring.position.set(tx, ty, 0.095);
        card1.add(ring);
      } else {
        // Stack bars
        [-0.11, 0.11].forEach((sy) => {
          const bar = new THREE.Mesh(new RoundedBoxGeometry(0.48, 0.11, 0.03, 1, 0.02), neonWarmGoldMat);
          bar.position.set(tx, ty + sy, 0.095);
          card1.add(bar);
        });
      }
    });

    // CARD 2: DOCUMENT & SPEC CARD (Top / Rear)
    const card2 = new THREE.Group();
    const a2 = a1 + (2 * Math.PI) / 3;
    card2.position.set(Math.cos(a2) * R_orbit, 0.8, Math.sin(a2) * R_orbit);
    card2.rotation.y = -a2 + Math.PI / 2;
    orbitGroup.add(card2);

    const card2Back = new THREE.Mesh(
      new RoundedBoxGeometry(3.78, 2.88, 0.02, 2, 0.12),
      cardBackMat
    );
    card2Back.position.z = -0.05;
    card2.add(card2Back);

    const card2Panel = new THREE.Mesh(
      new RoundedBoxGeometry(3.7, 2.8, 0.1, 3, 0.12),
      cardBaseMat
    );
    card2Panel.castShadow = true;
    card2Panel.receiveShadow = true;
    card2.add(card2Panel);

    // Avatar disc in top-left
    const avatar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.05, 24),
      cardElemMat
    );
    avatar.rotation.x = Math.PI / 2;
    avatar.position.set(-1.15, 0.62, 0.065);
    card2.add(avatar);

    const avatarInner = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 12, 12),
      neonWarmGoldMat
    );
    avatarInner.position.set(-1.15, 0.62, 0.09);
    card2.add(avatarInner);

    // Upper skeleton lines
    const barTop1 = new THREE.Mesh(
      new RoundedBoxGeometry(1.5, 0.17, 0.04, 2, 0.04),
      cardElemMat
    );
    barTop1.position.set(0.45, 0.72, 0.065);
    card2.add(barTop1);

    const barTop2 = new THREE.Mesh(
      new RoundedBoxGeometry(1.1, 0.14, 0.04, 2, 0.04),
      cardElemMat
    );
    barTop2.position.set(0.25, 0.46, 0.065);
    card2.add(barTop2);

    // Lower content lines
    const barBody1 = new THREE.Mesh(
      new RoundedBoxGeometry(2.7, 0.17, 0.04, 2, 0.04),
      cardElemMat
    );
    barBody1.position.set(0, -0.1, 0.065);
    card2.add(barBody1);

    const barBody2 = new THREE.Mesh(
      new RoundedBoxGeometry(2.2, 0.17, 0.04, 2, 0.04),
      cardElemMat
    );
    barBody2.position.set(-0.25, -0.48, 0.065);
    card2.add(barBody2);

    const barBody3 = new THREE.Mesh(
      new RoundedBoxGeometry(1.4, 0.14, 0.04, 2, 0.04),
      cardElemMat
    );
    barBody3.position.set(-0.65, -0.84, 0.065);
    card2.add(barBody3);

    // CARD 3: METRICS / ANALYTICS CARD (Right - Trend Chart & Pill Button)
    const card3 = new THREE.Group();
    const a3 = a1 + (4 * Math.PI) / 3;
    card3.position.set(Math.cos(a3) * R_orbit, -0.2, Math.sin(a3) * R_orbit);
    card3.rotation.y = -a3 + Math.PI / 2 - 0.2;
    orbitGroup.add(card3);

    const card3Back = new THREE.Mesh(
      new RoundedBoxGeometry(2.88, 3.48, 0.02, 2, 0.12),
      cardBackMat
    );
    card3Back.position.z = -0.05;
    card3.add(card3Back);

    const card3Panel = new THREE.Mesh(
      new RoundedBoxGeometry(2.8, 3.4, 0.1, 3, 0.12),
      cardBaseMat
    );
    card3Panel.castShadow = true;
    card3Panel.receiveShadow = true;
    card3.add(card3Panel);

    // Trend chart line with glowing warm gold curve
    const chartCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.82, 0.06, 0.065),
      new THREE.Vector3(-0.12, 0.56, 0.065),
      new THREE.Vector3(0.82, 0.92, 0.065),
    ]);
    const chartTubeGeo = new THREE.TubeGeometry(chartCurve, 28, 0.052, 10, false);
    const chartLine = new THREE.Mesh(chartTubeGeo, neonWarmGoldMat);
    card3.add(chartLine);
    extras.pulseMeshes.push(chartLine);

    [
      [-0.82, 0.06],
      [-0.12, 0.56],
      [0.82, 0.92],
    ].forEach(([cx, cy]) => {
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 16, 16),
        neonWarmGoldMat
      );
      node.position.set(cx, cy, 0.065);
      card3.add(node);
      extras.pulseMeshes.push(node);
    });

    const pillBtnMat = new THREE.MeshStandardMaterial({
      color: "#ffd499",
      emissive: "#d97706",
      emissiveIntensity: 0.95,
      roughness: 0.25,
    });
    const pillBtn = new THREE.Mesh(
      new RoundedBoxGeometry(1.9, 0.5, 0.06, 2, 0.12),
      pillBtnMat
    );
    pillBtn.position.set(0, -0.78, 0.065);
    card3.add(pillBtn);
    extras.pulseMeshes.push(pillBtn);

    // Continuous dynamic 3D orbit around the central cube
    extras.floats.push({ obj: orbitGroup, baseY: cubeCenterY, amp: 0.05, rotSpeed: 0.28 });
    extras.floats.push({ obj: card1, baseY: -0.05, amp: 0.08 });
    extras.floats.push({ obj: card2, baseY: 0.8, amp: 0.06 });
    extras.floats.push({ obj: card3, baseY: -0.2, amp: 0.08 });

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
    const base = buildGrandAltarBase(kit, extras, -Math.PI * 0.4);
    const { altar, add, daisTopY, cubeCenterY, platformMat, platformStepMat, neonWarmGoldMat } = base;

    // -----------------------------------------------------------
    // CENTER 1: DATABASE SERVER DISK TOWER ON THE DAIS
    // Stack of 2 substantial database disk cylinders with glowing gold dividing rings
    // -----------------------------------------------------------
    const dbRadius = 2.4;
    const dbDiskHeight = 0.6;

    // Disk 1 (lower)
    const dbDisk1 = new THREE.Mesh(
      new THREE.CylinderGeometry(dbRadius, dbRadius, dbDiskHeight, 48),
      platformMat
    );
    dbDisk1.position.set(0, daisTopY + dbDiskHeight / 2, 0);
    add(dbDisk1);

    // Glowing warm gold ring 1
    const dbRing1 = new THREE.Mesh(
      new THREE.TorusGeometry(dbRadius + 0.03, 0.065, 16, 64),
      neonWarmGoldMat
    );
    dbRing1.rotation.x = Math.PI / 2;
    dbRing1.position.set(0, daisTopY + dbDiskHeight, 0);
    add(dbRing1);
    extras.pulseMeshes.push(dbRing1);

    // Disk 2 (upper)
    const dbDisk2 = new THREE.Mesh(
      new THREE.CylinderGeometry(dbRadius, dbRadius, dbDiskHeight, 48),
      platformStepMat
    );
    dbDisk2.position.set(0, daisTopY + dbDiskHeight * 1.5, 0);
    add(dbDisk2);

    // Glowing warm gold ring 2
    const dbRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(dbRadius + 0.03, 0.065, 16, 64),
      neonWarmGoldMat
    );
    dbRing2.rotation.x = Math.PI / 2;
    dbRing2.position.set(0, daisTopY + dbDiskHeight * 2, 0);
    add(dbRing2);
    extras.pulseMeshes.push(dbRing2);

    // Top cap disc of database
    const dbCap = new THREE.Mesh(
      new THREE.CylinderGeometry(dbRadius * 0.92, dbRadius * 0.92, 0.1, 48),
      platformMat
    );
    dbCap.position.set(0, daisTopY + dbDiskHeight * 2 + 0.05, 0);
    add(dbCap);

    const dbTopY = daisTopY + dbDiskHeight * 2 + 0.1; // ≈ 5.86

    // -----------------------------------------------------------
    // CONDUIT 1: VERTICAL BOTTOM CONDUIT (Database to Central Cube)
    // -----------------------------------------------------------
    const cubeBottomY = cubeCenterY - 1.3; // 7.5
    const botConduitLen = cubeBottomY - dbTopY; // 1.64
    const botConduit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, botConduitLen, 16),
      neonWarmGoldMat
    );
    botConduit.position.set(0, dbTopY + botConduitLen / 2, 0);
    add(botConduit);
    extras.pulseMeshes.push(botConduit);

    // Collars
    const botCollar1 = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 8, 20), neonWarmGoldMat);
    botCollar1.rotation.x = Math.PI / 2;
    botCollar1.position.set(0, dbTopY + 0.08, 0);
    add(botCollar1);

    const botCollar2 = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 8, 20), neonWarmGoldMat);
    botCollar2.rotation.x = Math.PI / 2;
    botCollar2.position.set(0, cubeBottomY - 0.04, 0);
    add(botCollar2);

    // -----------------------------------------------------------
    // SATELLITE NODE 1 (LEFT): SERVER RACK UNIT
    // Placed at x = -4.8, support disc radius 1.8 reaches to x = -6.6
    // Horn inner edge at y = 8.8 is at x = -8.7 -> Over 2.1 units clear margin! ZERO collision!
    // -----------------------------------------------------------
    const leftNodeG = new THREE.Group();
    const leftX = -4.8;
    leftNodeG.position.set(leftX, cubeCenterY, 0);
    altar.add(leftNodeG);

    // Horizontal glowing gold conduit from cube face to left node
    const leftConduitLen = Math.abs(leftX) - 1.3; // 3.5
    const leftConduit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, leftConduitLen, 16),
      neonWarmGoldMat
    );
    leftConduit.rotation.z = Math.PI / 2;
    leftConduit.position.set(leftX / 2 + 0.65, cubeCenterY, 0);
    altar.add(leftConduit);
    extras.pulseMeshes.push(leftConduit);

    // Left floating support disc
    const leftDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 1.8, 0.12, 36),
      platformStepMat
    );
    leftDisc.position.set(0, -0.9, 0);
    leftNodeG.add(leftDisc);

    // Server rack chassis
    const serverChassis = new THREE.Mesh(
      new RoundedBoxGeometry(1.8, 1.6, 1.4, 3, 0.14),
      platformMat
    );
    serverChassis.position.set(0, -0.05, 0);
    serverChassis.rotation.y = 0.28; // subtly angled towards camera
    leftNodeG.add(serverChassis);

    // 3 horizontal server bays on front of server rack
    [0.4, 0.0, -0.4].forEach((by) => {
      // Recessed slot
      const baySlot = new THREE.Mesh(
        new RoundedBoxGeometry(1.3, 0.19, 0.04, 1, 0.04),
        new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.35 })
      );
      baySlot.position.set(0, by, 0.71);
      serverChassis.add(baySlot);

      // Two glowing golden indicator LEDs
      [-0.44, -0.24].forEach((lx) => {
        const led = new THREE.Mesh(
          new THREE.SphereGeometry(0.055, 12, 12),
          neonWarmGoldMat
        );
        led.position.set(lx, by, 0.73);
        serverChassis.add(led);
        extras.pulseMeshes.push(led);
      });

      // Ventilation bar
      const vent = new THREE.Mesh(
        new RoundedBoxGeometry(0.5, 0.06, 0.02, 1, 0.02),
        new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.5 })
      );
      vent.position.set(0.24, by, 0.73);
      serverChassis.add(vent);
    });

    // -----------------------------------------------------------
    // SATELLITE NODE 2 (TOP / REAR): WEB APP / BROWSER WINDOW
    // Placed at y = 12.6, well below the horn tips (y = 13.8) with generous width clearance
    // -----------------------------------------------------------
    const topNodeG = new THREE.Group();
    const topY = cubeCenterY + 3.8; // 12.6
    topNodeG.position.set(0, topY, -0.3);
    altar.add(topNodeG);

    // Vertical conduit from top of cube to top node tray
    const cubeTopY = cubeCenterY + 1.3; // 10.1
    const topConduitLen = (topY - 0.9) - cubeTopY; // 1.6
    const topConduit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, topConduitLen, 16),
      neonWarmGoldMat
    );
    topConduit.position.set(0, cubeTopY + topConduitLen / 2, -0.15);
    altar.add(topConduit);
    extras.pulseMeshes.push(topConduit);

    // Top floating support tray
    const topTray = new THREE.Mesh(
      new RoundedBoxGeometry(3.4, 0.1, 1.7, 2, 0.08),
      platformStepMat
    );
    topTray.position.set(0, -0.9, 0);
    topNodeG.add(topTray);

    // Browser window frame
    const browserBack = new THREE.Mesh(
      new RoundedBoxGeometry(3.18, 1.98, 0.02, 2, 0.08),
      new THREE.MeshStandardMaterial({ color: "#d8e2ee", roughness: 0.38 })
    );
    browserBack.position.set(0, 0.12, -0.08);
    topNodeG.add(browserBack);

    const browserFrame = new THREE.Mesh(
      new RoundedBoxGeometry(3.1, 1.9, 0.14, 3, 0.08),
      new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        roughness: 0.16,
        metalness: 0.02,
        clearcoat: 0.9,
        clearcoatRoughness: 0.08,
        transparent: true,
        opacity: 0.96,
      })
    );
    browserFrame.position.set(0, 0.12, 0);
    topNodeG.add(browserFrame);

    // Browser header with 3 window control dots
    const browserHeader = new THREE.Mesh(
      new RoundedBoxGeometry(2.95, 0.35, 0.02, 1, 0.04),
      new THREE.MeshStandardMaterial({ color: "#edf2f7", roughness: 0.3 })
    );
    browserHeader.position.set(0, 0.65, 0.08);
    topNodeG.add(browserHeader);

    [-1.2, -0.98, -0.76].forEach((dx) => {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.052, 12, 12),
        neonWarmGoldMat
      );
      dot.position.set(dx, 0.65, 0.1);
      topNodeG.add(dot);
      extras.pulseMeshes.push(dot);
    });

    // Main window search pill bar in glowing warm gold
    const browserPill = new THREE.Mesh(
      new RoundedBoxGeometry(1.6, 0.2, 0.03, 2, 0.06),
      neonWarmGoldMat
    );
    browserPill.position.set(-0.35, 0.2, 0.09);
    topNodeG.add(browserPill);

    // Subtitle skeleton line in warm gold
    const browserLine1 = new THREE.Mesh(
      new RoundedBoxGeometry(1.1, 0.14, 0.03, 2, 0.04),
      neonWarmGoldMat
    );
    browserLine1.position.set(-0.6, -0.12, 0.09);
    topNodeG.add(browserLine1);

    // Lower content card
    const browserCard = new THREE.Mesh(
      new RoundedBoxGeometry(2.4, 0.46, 0.02, 2, 0.06),
      new THREE.MeshStandardMaterial({ color: "#f3f6fa", roughness: 0.3 })
    );
    browserCard.position.set(0, -0.52, 0.09);
    topNodeG.add(browserCard);

    // -----------------------------------------------------------
    // SATELLITE NODE 3 (RIGHT): 3D CLOUD INFRASTRUCTURE
    // Placed at x = +4.8, support disc radius 1.8 reaches to x = +6.6
    // Horn inner edge at y = 8.8 is at x = +8.7 -> Over 2.1 units clear margin! ZERO collision!
    // -----------------------------------------------------------
    const rightNodeG = new THREE.Group();
    const rightX = 4.8;
    rightNodeG.position.set(rightX, cubeCenterY, 0);
    altar.add(rightNodeG);

    // Horizontal glowing gold conduit from cube to right node
    const rightConduitLen = Math.abs(rightX) - 1.3; // 3.5
    const rightConduit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, rightConduitLen, 16),
      neonWarmGoldMat
    );
    rightConduit.rotation.z = Math.PI / 2;
    rightConduit.position.set(rightX / 2 - 0.65, cubeCenterY, 0);
    altar.add(rightConduit);
    extras.pulseMeshes.push(rightConduit);

    // Right floating support disc
    const rightDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 1.8, 0.12, 36),
      platformStepMat
    );
    rightDisc.position.set(0, -0.9, 0);
    rightNodeG.add(rightDisc);

    // Sculpted 3D Cloud Symbol
    const cloudG = new THREE.Group();
    cloudG.position.set(0, -0.22, 0);
    cloudG.rotation.y = -0.28; // subtly angled towards camera
    rightNodeG.add(cloudG);

    const cloudMat = new THREE.MeshPhysicalMaterial({
      color: "#f8fafc",
      roughness: 0.22,
      metalness: 0.02,
      clearcoat: 0.85,
      clearcoatRoughness: 0.1,
    });

    // Cloud base rounded capsule
    const cloudBase = new THREE.Mesh(
      new RoundedBoxGeometry(2.1, 0.72, 0.88, 3, 0.3),
      cloudMat
    );
    cloudBase.position.set(0, 0, 0);
    cloudG.add(cloudBase);

    // Cloud top center dome
    const cloudDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 24, 24),
      cloudMat
    );
    cloudDome.position.set(0, 0.32, 0);
    cloudG.add(cloudDome);

    // Cloud left lobe
    const cloudLobe1 = new THREE.Mesh(
      new THREE.SphereGeometry(0.54, 20, 20),
      cloudMat
    );
    cloudLobe1.position.set(-0.6, 0.16, 0);
    cloudG.add(cloudLobe1);

    // Cloud right lobe
    const cloudLobe2 = new THREE.Mesh(
      new THREE.SphereGeometry(0.58, 20, 20),
      cloudMat
    );
    cloudLobe2.position.set(0.6, 0.2, 0);
    cloudG.add(cloudLobe2);

    // Cloud front bubble
    const cloudFront = new THREE.Mesh(
      new THREE.SphereGeometry(0.44, 16, 16),
      cloudMat
    );
    cloudFront.position.set(0.16, 0.08, 0.24);
    cloudG.add(cloudFront);

    // Floating animations for satellite nodes
    extras.floats.push({ obj: leftNodeG, baseY: cubeCenterY, amp: 0.06 });
    extras.floats.push({ obj: topNodeG, baseY: topY, amp: 0.05 });
    extras.floats.push({ obj: rightNodeG, baseY: cubeCenterY, amp: 0.06 });

    extras.cardGroup = null;
  }
  // -----------------------------------------------------------
  // 4. COMING ALIVE (Phase 04) — PRODUCTION PLATFORM & ARCHITECTURE
  // 100% FAITHFUL REPLICA OF USER REFERENCE IMAGE:
  // Rounded squircle plinth with glowing perimeter neon + Central circular dais +
  // Upright standing UI browser card (hero mountain landscape, sun, controls, 3 feature columns) +
  // Left 3-tier server rack on stepped pedestal + Right sculpted 3D cloud on stepped pedestal +
  // Grand corner arches with inner glowing neon channels + Circuit floor conduits
  // -----------------------------------------------------------
  else if (kind === "engineRoom") {
    const stationG = new THREE.Group();
    stationG.position.set(px, 0, pz);
    // Align with camera view 3 (direct front-facing)
    stationG.rotation.y = 0;
    scene.add(stationG);

    const add = (m: THREE.Mesh) => {
      m.castShadow = true;
      m.receiveShadow = true;
      stationG.add(m);
      return m;
    };

    // Reflective & Texturized Materials
    const platformMat = new THREE.MeshPhysicalMaterial({
      color: "#f4f6fa",
      roughness: 0.18,
      metalness: 0.06,
      clearcoat: 0.85,
      clearcoatRoughness: 0.1,
      map: getPlatformTexture(),
      roughnessMap: getPlatformRoughnessMap(),
    });
    const platformStepMat = new THREE.MeshPhysicalMaterial({
      color: "#ebf0f7",
      roughness: 0.22,
      metalness: 0.05,
      clearcoat: 0.75,
      clearcoatRoughness: 0.12,
      map: getPlatformTexture(),
      roughnessMap: getPlatformRoughnessMap(),
    });
    const daisMirrorMat = new THREE.MeshPhysicalMaterial({
      color: "#f8fafc",
      roughness: 0.06,
      metalness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    });
    const archMat = new THREE.MeshPhysicalMaterial({
      color: "#f6f8fb",
      roughness: 0.22,
      metalness: 0.03,
      clearcoat: 0.7,
      clearcoatRoughness: 0.12,
      map: getHornTexture(),
    });
    const cloudMat = new THREE.MeshPhysicalMaterial({
      color: "#f8fafc",
      roughness: 0.22,
      metalness: 0.02,
      clearcoat: 0.85,
      clearcoatRoughness: 0.1,
    });
    const cardGlassMat = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      roughness: 0.14,
      metalness: 0.02,
      clearcoat: 0.95,
      clearcoatRoughness: 0.06,
      transparent: true,
      opacity: 0.97,
    });
    const cardBackMat = new THREE.MeshStandardMaterial({
      color: "#dbe4ef",
      roughness: 0.38,
      metalness: 0.02,
    });

    // Rich Warm Gold Materials (never lemon yellow)
    const neonWarmGoldMat = new THREE.MeshStandardMaterial({
      color: "#e28b24",
      emissive: "#d97706",
      emissiveIntensity: 1.45,
      roughness: 0.18,
    });
    const baseLedGrooveMat = new THREE.MeshStandardMaterial({
      color: "#d97706",
      emissive: "#b45309",
      emissiveIntensity: 1.35,
      roughness: 0.2,
    });
    const cardElemMat = new THREE.MeshStandardMaterial({
      color: "#fffbf5",
      emissive: "#d97706",
      emissiveIntensity: 0.5,
      roughness: 0.28,
    });

    // -----------------------------------------------------------
    // TIER 1: BASE SQUIRCLE PLINTH (Wide rounded square base)
    // -----------------------------------------------------------
    const baseWidth = 21.0;
    const baseDepth = 21.0;
    const baseHeight = 2.4;
    const cornerRadius = 4.0;
    const halfW = baseWidth / 2;

    const squircleShape = new THREE.Shape();
    squircleShape.moveTo(-halfW + cornerRadius, -halfW);
    squircleShape.lineTo(halfW - cornerRadius, -halfW);
    squircleShape.absarc(halfW - cornerRadius, -halfW + cornerRadius, cornerRadius, -Math.PI / 2, 0, false);
    squircleShape.lineTo(halfW, halfW - cornerRadius);
    squircleShape.absarc(halfW - cornerRadius, halfW - cornerRadius, cornerRadius, 0, Math.PI / 2, false);
    squircleShape.lineTo(-halfW + cornerRadius, halfW);
    squircleShape.absarc(-halfW + cornerRadius, halfW - cornerRadius, cornerRadius, Math.PI / 2, Math.PI, false);
    squircleShape.lineTo(-halfW, -halfW + cornerRadius);
    squircleShape.absarc(-halfW + cornerRadius, -halfW + cornerRadius, cornerRadius, Math.PI, (3 * Math.PI) / 2, false);
    squircleShape.closePath();

    const baseGeo = new THREE.ExtrudeGeometry(squircleShape, {
      depth: baseHeight,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.12,
      bevelThickness: 0.12,
      curveSegments: 24,
    });
    baseGeo.rotateX(Math.PI / 2);
    baseGeo.translate(0, baseHeight, 0);
    const baseMesh = new THREE.Mesh(baseGeo, platformMat);
    add(baseMesh);

    // Glowing warm gold perimeter neon groove running along base sides
    const groovePath = new THREE.CurvePath<THREE.Vector3>();
    const gy = 1.2;
    const p = halfW + 0.02;
    const c = cornerRadius;
    groovePath.add(new THREE.LineCurve3(new THREE.Vector3(-p + c, gy, -p), new THREE.Vector3(p - c, gy, -p)));
    groovePath.add(new THREE.CubicBezierCurve3(
      new THREE.Vector3(p - c, gy, -p),
      new THREE.Vector3(p - c + c * 0.552, gy, -p),
      new THREE.Vector3(p, gy, -p + c - c * 0.552),
      new THREE.Vector3(p, gy, -p + c)
    ));
    groovePath.add(new THREE.LineCurve3(new THREE.Vector3(p, gy, -p + c), new THREE.Vector3(p, gy, p - c)));
    groovePath.add(new THREE.CubicBezierCurve3(
      new THREE.Vector3(p, gy, p - c),
      new THREE.Vector3(p, gy, p - c + c * 0.552),
      new THREE.Vector3(p - c + c * 0.552, gy, p),
      new THREE.Vector3(p - c, gy, p)
    ));
    groovePath.add(new THREE.LineCurve3(new THREE.Vector3(p - c, gy, p), new THREE.Vector3(-p + c, gy, p)));
    groovePath.add(new THREE.CubicBezierCurve3(
      new THREE.Vector3(-p + c, gy, p),
      new THREE.Vector3(-p + c - c * 0.552, gy, p),
      new THREE.Vector3(-p, gy, p - c + c * 0.552),
      new THREE.Vector3(-p, gy, p - c)
    ));
    groovePath.add(new THREE.LineCurve3(new THREE.Vector3(-p, gy, p - c), new THREE.Vector3(-p, gy, -p + c)));
    groovePath.add(new THREE.CubicBezierCurve3(
      new THREE.Vector3(-p, gy, -p + c),
      new THREE.Vector3(-p, gy, -p + c - c * 0.552),
      new THREE.Vector3(-p + c - c * 0.552, gy, -p),
      new THREE.Vector3(-p + c, gy, -p)
    ));

    const baseNeonGeo = new THREE.TubeGeometry(groovePath, 128, 0.085, 12, true);
    const baseNeonMesh = new THREE.Mesh(baseNeonGeo, baseLedGrooveMat);
    add(baseNeonMesh);
    extras.pulseMeshes.push(baseNeonMesh);

    // -----------------------------------------------------------
    // TIER 2: CENTER CIRCULAR DAIS
    // -----------------------------------------------------------
    const daisRadius = 4.8;
    const daisHeight = 1.2;
    const daisMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(daisRadius, daisRadius, daisHeight, 64),
      platformStepMat
    );
    daisMesh.position.y = baseHeight + daisHeight / 2;
    add(daisMesh);

    // Concentric glowing gold neon ring embedded near dais top
    const daisNeon = new THREE.Mesh(
      new THREE.TorusGeometry(4.65, 0.08, 16, 80),
      neonWarmGoldMat
    );
    daisNeon.rotation.x = Math.PI / 2;
    daisNeon.position.y = baseHeight + daisHeight + 0.01;
    add(daisNeon);
    extras.pulseMeshes.push(daisNeon);

    // Inset reflective mirror disc on dais
    const daisMirror = new THREE.Mesh(
      new THREE.CylinderGeometry(4.45, 4.45, 0.015, 64),
      daisMirrorMat
    );
    daisMirror.position.y = baseHeight + daisHeight + 0.012;
    add(daisMirror);

    // Card mounting pedestal stem in center
    const stemMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.44, 0.85, 24),
      neonWarmGoldMat
    );
    stemMesh.position.y = baseHeight + daisHeight + 0.425;
    add(stemMesh);

    const stemCollar = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.06, 8, 24),
      neonWarmGoldMat
    );
    stemCollar.rotation.x = Math.PI / 2;
    stemCollar.position.y = baseHeight + daisHeight + 0.02;
    add(stemCollar);

    // -----------------------------------------------------------
    // CENTERPIECE: UPRIGHT STANDING UI / BROWSER DISPLAY CARD
    // -----------------------------------------------------------
    const cardG = new THREE.Group();
    const cardCenterY = baseHeight + daisHeight + 0.85 + 3.8; // ≈ 8.25
    cardG.position.set(0, cardCenterY, 0);
    // Subtle backwards lean of 3.5 degrees as in the reference image
    cardG.rotation.x = -0.06;
    stationG.add(cardG);

    // Back cover plate
    const cardBack = new THREE.Mesh(
      new RoundedBoxGeometry(5.48, 7.88, 0.04, 2, 0.45),
      cardBackMat
    );
    cardBack.position.z = -0.19;
    cardG.add(cardBack);

    // Main translucent glass card slab
    const cardBody = new THREE.Mesh(
      new RoundedBoxGeometry(5.4, 7.8, 0.36, 4, 0.45),
      cardGlassMat
    );
    cardBody.castShadow = true;
    cardBody.receiveShadow = true;
    cardG.add(cardBody);

    // Internal backlit golden glow sheet
    const cardBacklit = new THREE.Mesh(
      new RoundedBoxGeometry(5.0, 7.4, 0.02, 2, 0.35),
      new THREE.MeshStandardMaterial({
        color: "#ffd699",
        emissive: "#d97706",
        emissiveIntensity: 0.55,
        roughness: 0.3,
      })
    );
    cardBacklit.position.z = -0.05;
    cardG.add(cardBacklit);

    // Embossed Front 3D UI Elements (Facing camera at z = 0.2)
    // 1. Top left 3 window control dots
    [-2.0, -1.72, -1.44].forEach((dx) => {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 12, 12),
        neonWarmGoldMat
      );
      dot.position.set(dx, 3.25, 0.2);
      cardG.add(dot);
      extras.pulseMeshes.push(dot);
    });

    // 2. Hero Landscape Illustration Box (Upper half)
    const heroBox = new THREE.Mesh(
      new RoundedBoxGeometry(4.2, 2.9, 0.05, 2, 0.2),
      new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.3 })
    );
    heroBox.position.set(0, 1.55, 0.2);
    cardG.add(heroBox);

    // Mountain wedge 1 (Left main peak)
    const mtn1 = new THREE.Mesh(
      new THREE.ConeGeometry(1.6, 1.8, 4),
      new THREE.MeshStandardMaterial({ color: "#dbe4ef", roughness: 0.4 })
    );
    mtn1.rotation.y = Math.PI / 4;
    mtn1.scale.set(1.4, 1.0, 0.12);
    mtn1.position.set(-0.4, 1.05, 0.25);
    cardG.add(mtn1);

    // Mountain wedge 2 (Right secondary peak)
    const mtn2 = new THREE.Mesh(
      new THREE.ConeGeometry(1.2, 1.4, 4),
      new THREE.MeshStandardMaterial({ color: "#c8d6e5", roughness: 0.4 })
    );
    mtn2.rotation.y = Math.PI / 4;
    mtn2.scale.set(1.2, 1.0, 0.12);
    mtn2.position.set(0.8, 0.85, 0.24);
    cardG.add(mtn2);

    // Glowing warm gold sun disc in top-right of hero box
    const sunDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.03, 24),
      neonWarmGoldMat
    );
    sunDisc.rotation.x = Math.PI / 2;
    sunDisc.position.set(1.35, 2.3, 0.25);
    cardG.add(sunDisc);
    extras.pulseMeshes.push(sunDisc);

    // 3. Middle Content & Action Pill Button
    const barTitle = new THREE.Mesh(
      new RoundedBoxGeometry(2.4, 0.18, 0.03, 2, 0.04),
      cardElemMat
    );
    barTitle.position.set(-0.85, -0.22, 0.2);
    cardG.add(barTitle);

    const barSub1 = new THREE.Mesh(
      new RoundedBoxGeometry(3.2, 0.14, 0.03, 2, 0.04),
      cardElemMat
    );
    barSub1.position.set(-0.45, -0.52, 0.2);
    cardG.add(barSub1);

    const barSub2 = new THREE.Mesh(
      new RoundedBoxGeometry(2.1, 0.14, 0.03, 2, 0.04),
      cardElemMat
    );
    barSub2.position.set(-1.0, -0.78, 0.2);
    cardG.add(barSub2);

    // Glowing golden action button pill
    const actionBtn = new THREE.Mesh(
      new RoundedBoxGeometry(1.5, 0.38, 0.06, 2, 0.1),
      new THREE.MeshStandardMaterial({
        color: "#f59e0b",
        emissive: "#d97706",
        emissiveIntensity: 1.15,
        roughness: 0.2,
      })
    );
    actionBtn.position.set(-1.3, -1.22, 0.22);
    cardG.add(actionBtn);
    extras.pulseMeshes.push(actionBtn);

    // 4. Three bottom column feature cards
    [-1.4, 0.0, 1.4].forEach((cx) => {
      const colCard = new THREE.Mesh(
        new RoundedBoxGeometry(1.2, 1.45, 0.04, 2, 0.1),
        new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.25 })
      );
      colCard.position.set(cx, -2.4, 0.2);
      cardG.add(colCard);

      const iconRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.16, 0.035, 8, 20),
        neonWarmGoldMat
      );
      iconRing.position.set(cx, -2.1, 0.24);
      cardG.add(iconRing);
      extras.pulseMeshes.push(iconRing);

      const iconDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 12, 12),
        neonWarmGoldMat
      );
      iconDot.position.set(cx, -2.1, 0.24);
      cardG.add(iconDot);

      const line1 = new THREE.Mesh(
        new RoundedBoxGeometry(0.8, 0.09, 0.02, 1, 0.02),
        cardElemMat
      );
      line1.position.set(cx, -2.5, 0.24);
      cardG.add(line1);

      const line2 = new THREE.Mesh(
        new RoundedBoxGeometry(0.55, 0.07, 0.02, 1, 0.02),
        cardElemMat
      );
      line2.position.set(cx, -2.75, 0.24);
      cardG.add(line2);
    });

    // Rich warm golden point light behind the card to illuminate the rear arches
    const cardLight = new THREE.PointLight(0xe08518, 4.5, 24, 1.8);
    cardLight.position.set(0, cardCenterY, -0.6);
    stationG.add(cardLight);
    extras.beaconLight = cardLight;

    extras.floats.push({ obj: cardG, baseY: cardCenterY, amp: 0.06 });

    // -----------------------------------------------------------
    // LEFT FLANK: STEPPED PEDESTAL & 3-TIER SERVER RACK UNIT
    // -----------------------------------------------------------
    const leftPedX = -6.6;
    const leftPedZ = 0.8;

    const leftStep1 = new THREE.Mesh(
      new RoundedBoxGeometry(4.6, 0.7, 4.6, 3, 0.35),
      platformStepMat
    );
    leftStep1.position.set(leftPedX, baseHeight + 0.35, leftPedZ);
    add(leftStep1);

    const leftStep2 = new THREE.Mesh(
      new RoundedBoxGeometry(3.5, 0.7, 3.5, 3, 0.25),
      platformMat
    );
    leftStep2.position.set(leftPedX, baseHeight + 0.7 + 0.35, leftPedZ);
    add(leftStep2);

    const serverBaseY = baseHeight + 1.4; // 3.8

    // 3 Server Blades stacked
    const serverBladeMat = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      roughness: 0.22,
      metalness: 0.04,
    });

    [0, 1, 2].forEach((bIdx) => {
      const bladeY = serverBaseY + 0.36 + bIdx * 0.72;
      const blade = new THREE.Mesh(
        new RoundedBoxGeometry(2.7, 0.62, 2.5, 3, 0.12),
        serverBladeMat
      );
      blade.position.set(leftPedX, bladeY, leftPedZ);
      add(blade);

      // Recessed slot on front
      const slot = new THREE.Mesh(
        new RoundedBoxGeometry(2.2, 0.18, 0.02, 1, 0.04),
        new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.4 })
      );
      slot.position.set(leftPedX, bladeY, leftPedZ + 1.26);
      add(slot);

      // Two glowing golden indicator LEDs on left of front face
      [-0.72, -0.42].forEach((lx) => {
        const led = new THREE.Mesh(
          new THREE.SphereGeometry(0.065, 12, 12),
          neonWarmGoldMat
        );
        led.position.set(leftPedX + lx, bladeY, leftPedZ + 1.28);
        add(led);
        extras.pulseMeshes.push(led);
      });

      // Ventilation bar on right of front face
      const vent = new THREE.Mesh(
        new RoundedBoxGeometry(0.75, 0.06, 0.02, 1, 0.02),
        new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.5 })
      );
      vent.position.set(leftPedX + 0.45, bladeY, leftPedZ + 1.28);
      add(vent);
    });

    // -----------------------------------------------------------
    // RIGHT FLANK: STEPPED PEDESTAL & SCULPTED 3D CLOUD
    // -----------------------------------------------------------
    const rightPedX = 6.6;
    const rightPedZ = 0.8;

    const rightStep1 = new THREE.Mesh(
      new RoundedBoxGeometry(4.6, 0.7, 4.6, 3, 0.35),
      platformStepMat
    );
    rightStep1.position.set(rightPedX, baseHeight + 0.35, rightPedZ);
    add(rightStep1);

    const rightStep2 = new THREE.Mesh(
      new RoundedBoxGeometry(3.5, 0.7, 3.5, 3, 0.25),
      platformMat
    );
    rightStep2.position.set(rightPedX, baseHeight + 0.7 + 0.35, rightPedZ);
    add(rightStep2);

    // Sculpted Volumetric 3D Cloud
    const cloudG = new THREE.Group();
    const cloudBaseY = baseHeight + 1.4 + 0.45; // ≈ 4.25
    cloudG.position.set(rightPedX, cloudBaseY, rightPedZ);
    stationG.add(cloudG);

    const cloudBase = new THREE.Mesh(
      new RoundedBoxGeometry(2.5, 0.8, 1.0, 3, 0.32),
      cloudMat
    );
    cloudBase.position.set(0, 0, 0);
    cloudG.add(cloudBase);

    const cloudDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.82, 24, 24),
      cloudMat
    );
    cloudDome.position.set(0, 0.38, 0);
    cloudG.add(cloudDome);

    const cloudLobe1 = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 20, 20),
      cloudMat
    );
    cloudLobe1.position.set(-0.75, 0.2, 0);
    cloudG.add(cloudLobe1);

    const cloudLobe2 = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 20, 20),
      cloudMat
    );
    cloudLobe2.position.set(0.75, 0.24, 0);
    cloudG.add(cloudLobe2);

    const cloudFront = new THREE.Mesh(
      new THREE.SphereGeometry(0.52, 16, 16),
      cloudMat
    );
    cloudFront.position.set(0.2, 0.1, 0.32);
    cloudG.add(cloudFront);

    extras.floats.push({ obj: cloudG, baseY: cloudBaseY, amp: 0.04 });

    // -----------------------------------------------------------
    // REAR: TWO GRAND CORNER ARCHES WITH INNER GLOWING NEON STRIPS
    // -----------------------------------------------------------
    const archExtrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 1.8,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.1,
      bevelThickness: 0.1,
      curveSegments: 32,
    };

    // 1. Left Rear Arch
    const leftArchShape = new THREE.Shape();
    leftArchShape.moveTo(-8.6, 0);
    leftArchShape.bezierCurveTo(-8.6, 4.5, -7.5, 8.5, -4.8, 10.4);
    leftArchShape.bezierCurveTo(-3.8, 11.0, -2.6, 11.2, -1.8, 11.2);
    leftArchShape.lineTo(-1.8, 9.6);
    leftArchShape.bezierCurveTo(-2.4, 9.6, -3.4, 9.4, -4.2, 8.8);
    leftArchShape.bezierCurveTo(-6.4, 7.2, -7.0, 3.8, -7.0, 0);
    leftArchShape.closePath();

    const leftArchGeo = new THREE.ExtrudeGeometry(leftArchShape, archExtrudeSettings);
    leftArchGeo.translate(0, 0, -1.8 / 2);
    const leftArchMesh = new THREE.Mesh(leftArchGeo, archMat);
    leftArchMesh.position.set(0, baseHeight, -6.5);
    add(leftArchMesh);

    // Left Arch inner glowing neon channel
    const leftArchCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(-7.0, 0.1, 0),
      new THREE.Vector3(-7.0, 3.8, 0),
      new THREE.Vector3(-6.4, 7.2, 0),
      new THREE.Vector3(-4.2, 8.8, 0)
    );
    const leftArchCurve2 = new THREE.CubicBezierCurve3(
      new THREE.Vector3(-4.2, 8.8, 0),
      new THREE.Vector3(-3.4, 9.4, 0),
      new THREE.Vector3(-2.4, 9.6, 0),
      new THREE.Vector3(-1.8, 9.6, 0)
    );
    const leftArchPath = new THREE.CurvePath<THREE.Vector3>();
    leftArchPath.add(leftArchCurve);
    leftArchPath.add(leftArchCurve2);
    const leftArchNeonGeo = new THREE.TubeGeometry(leftArchPath, 48, 0.085, 12, false);
    const leftArchNeonMesh = new THREE.Mesh(leftArchNeonGeo, neonWarmGoldMat);
    leftArchNeonMesh.position.set(0, baseHeight, -6.5);
    add(leftArchNeonMesh);
    extras.pulseMeshes.push(leftArchNeonMesh);

    // 2. Right Rear Arch
    const rightArchShape = new THREE.Shape();
    rightArchShape.moveTo(8.6, 0);
    rightArchShape.lineTo(7.0, 0);
    rightArchShape.bezierCurveTo(7.0, 3.8, 6.4, 7.2, 4.2, 8.8);
    rightArchShape.bezierCurveTo(3.4, 9.4, 2.4, 9.6, 1.8, 9.6);
    rightArchShape.lineTo(1.8, 11.2);
    rightArchShape.bezierCurveTo(2.6, 11.2, 3.8, 11.0, 4.8, 10.4);
    rightArchShape.bezierCurveTo(7.5, 8.5, 8.6, 4.5, 8.6, 0);
    rightArchShape.closePath();

    const rightArchGeo = new THREE.ExtrudeGeometry(rightArchShape, archExtrudeSettings);
    rightArchGeo.translate(0, 0, -1.8 / 2);
    const rightArchMesh = new THREE.Mesh(rightArchGeo, archMat);
    rightArchMesh.position.set(0, baseHeight, -6.5);
    add(rightArchMesh);

    // Right Arch inner glowing neon channel
    const rightArchCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(7.0, 0.1, 0),
      new THREE.Vector3(7.0, 3.8, 0),
      new THREE.Vector3(6.4, 7.2, 0),
      new THREE.Vector3(4.2, 8.8, 0)
    );
    const rightArchCurve2 = new THREE.CubicBezierCurve3(
      new THREE.Vector3(4.2, 8.8, 0),
      new THREE.Vector3(3.4, 9.4, 0),
      new THREE.Vector3(2.4, 9.6, 0),
      new THREE.Vector3(1.8, 9.6, 0)
    );
    const rightArchPath = new THREE.CurvePath<THREE.Vector3>();
    rightArchPath.add(rightArchCurve);
    rightArchPath.add(rightArchCurve2);
    const rightArchNeonGeo = new THREE.TubeGeometry(rightArchPath, 48, 0.085, 12, false);
    const rightArchNeonMesh = new THREE.Mesh(rightArchNeonGeo, neonWarmGoldMat);
    rightArchNeonMesh.position.set(0, baseHeight, -6.5);
    add(rightArchNeonMesh);
    extras.pulseMeshes.push(rightArchNeonMesh);

    // -----------------------------------------------------------
    // CIRCUIT FLOOR CONDUITS (GLOWING GOLD RUNWAYS)
    // Connecting Server Pedestal, Central Dais, Cloud Pedestal, and Rear Arches
    // -----------------------------------------------------------
    const trackY = baseHeight + 0.05;

    // Track 1: Server to Center Dais
    const leftTrackPath = new THREE.CurvePath<THREE.Vector3>();
    leftTrackPath.add(new THREE.LineCurve3(
      new THREE.Vector3(-4.3, trackY, 0.8),
      new THREE.Vector3(-3.4, trackY, 0.8)
    ));
    leftTrackPath.add(new THREE.LineCurve3(
      new THREE.Vector3(-3.4, trackY, 0.8),
      new THREE.Vector3(-3.4, trackY, 0.0)
    ));
    leftTrackPath.add(new THREE.LineCurve3(
      new THREE.Vector3(-3.4, trackY, 0.0),
      new THREE.Vector3(-2.8, trackY, 0.0)
    ));
    const leftTrackMesh = new THREE.Mesh(
      new THREE.TubeGeometry(leftTrackPath, 24, 0.07, 10, false),
      neonWarmGoldMat
    );
    add(leftTrackMesh);
    extras.pulseMeshes.push(leftTrackMesh);

    // Track 2: Cloud to Center Dais
    const rightTrackPath = new THREE.CurvePath<THREE.Vector3>();
    rightTrackPath.add(new THREE.LineCurve3(
      new THREE.Vector3(4.3, trackY, 0.8),
      new THREE.Vector3(3.4, trackY, 0.8)
    ));
    rightTrackPath.add(new THREE.LineCurve3(
      new THREE.Vector3(3.4, trackY, 0.8),
      new THREE.Vector3(3.4, trackY, 0.0)
    ));
    rightTrackPath.add(new THREE.LineCurve3(
      new THREE.Vector3(3.4, trackY, 0.0),
      new THREE.Vector3(2.8, trackY, 0.0)
    ));
    const rightTrackMesh = new THREE.Mesh(
      new THREE.TubeGeometry(rightTrackPath, 24, 0.07, 10, false),
      neonWarmGoldMat
    );
    add(rightTrackMesh);
    extras.pulseMeshes.push(rightTrackMesh);

    // Track 3: Left Server to Left Arch
    const leftArchTrack = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 4.5, 12),
      neonWarmGoldMat
    );
    leftArchTrack.position.set(-6.6, trackY, -2.5);
    add(leftArchTrack);
    extras.pulseMeshes.push(leftArchTrack);

    // Track 4: Right Cloud to Right Arch
    const rightArchTrack = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 4.5, 12),
      neonWarmGoldMat
    );
    rightArchTrack.position.set(6.6, trackY, -2.5);
    add(rightArchTrack);
    extras.pulseMeshes.push(rightArchTrack);

    extras.cardGroup = null;
  }

  // -----------------------------------------------------------
  // 5. GROWING (Phase 05) — SCALED ECOSYSTEM CAMPUS
  // -----------------------------------------------------------
  else if (kind === "scaleCampus") {
    const { inDoor, outDoor } = makeDoorPortals(kit, 4.5, -11, 11, 7.8);
    extras.inDoorGlow = inDoor;
    extras.outDoorGlow = outDoor;

    const towerHeights = [
      { v: -7.5, u: -5, h: 10.5 },
      { v: -7.5, u: 5, h: 8.2 },
      { v: 7.5, u: -5, h: 8.8 },
      { v: 7.5, u: 5, h: 11.2 },
      { v: -12.5, u: 0, h: 6.8 },
      { v: 12.5, u: 0, h: 6.8 },
    ];

    towerHeights.forEach(({ v, u, h }) => {
      const tower = rbox(kit, 4.2, h, 4.2, 0.25, body);
      atLocal(kit, tower, v, u, h / 2);

      const crown = rbox(kit, 4.4, 0.45, 4.4, 0.1, frameMat);
      atLocal(kit, crown, v, u, h + 0.22);
    });

    [-5, 5].forEach((u) => {
      const bridge = rbox(kit, 15.0, 1.2, 2.2, 0.15, body2);
      atLocal(kit, bridge, 0, u, 7.2);
    });

    extras.cardGroup = null;
  }

  // -----------------------------------------------------------
  // 6. OUT IN THE WORLD (Phase 06) — LAUNCH & GLOBAL OBSERVATORY
  // -----------------------------------------------------------
  else if (kind === "launchObservatory") {
    const amphi = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 10.2, 0.85, 72), body);
    atLocal(kit, amphi, 0, 0, 0.425);
    amphi.receiveShadow = true;
    scene.add(amphi);

    const orbRing = new THREE.Mesh(
      new THREE.RingGeometry(8.2, 8.8, 64),
      new THREE.MeshStandardMaterial({
        color: stationData.color,
        emissive: stationData.color,
        emissiveIntensity: 2.2,
        roughness: 0.3,
      })
    );
    orbRing.rotation.x = -Math.PI / 2;
    atLocal(kit, orbRing, 0, 0, 0.88);
    scene.add(orbRing);
    extras.pulseMeshes.push(orbRing);

    const { inDoor, outDoor } = makeDoorPortals(kit, 4.2, -8.5, 8.5, 6.8);
    extras.inDoorGlow = inDoor;
    extras.outDoorGlow = outDoor;

    const spireG = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, 11, 16), structural);
    mast.position.y = 5.5;
    spireG.add(mast);

    const dishMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4, side: THREE.DoubleSide });
    const dish = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 12, 0, Math.PI * 2, 0, 0.9), dishMat);
    dish.position.set(0, 9.2, 0);
    dish.rotation.x = Math.PI * 0.72;
    spireG.add(dish);
    extras.spins.push({ obj: dish, speed: 0.65 });

    const beaconLight = new THREE.PointLight(stationData.colorInt, 45, 60, 1.8);
    beaconLight.position.set(0, 10.5, 0);
    spireG.add(beaconLight);
    extras.beaconLight = beaconLight;

    atLocal(kit, spireG, 0, 0, 0.85);
    scene.add(spireG);

    const deviceGroup = new THREE.Group();
    const [dx, dz] = lx(0, 0);
    deviceGroup.position.set(dx, 4.5, dz);
    deviceGroup.rotation.y = heading;
    scene.add(deviceGroup);

    const laptop = new THREE.Mesh(
      new RoundedBoxGeometry(3.6, 2.4, 0.12, 2, 0.06),
      new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: stationData.color, emissiveIntensity: 0.35 })
    );
    laptop.position.set(-4.8, 1.2, 0);
    laptop.rotation.y = 0.45;
    deviceGroup.add(laptop);

    const mobileScreen = new THREE.Mesh(
      new RoundedBoxGeometry(1.3, 2.5, 0.1, 2, 0.05),
      new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: stationData.color, emissiveIntensity: 0.4 })
    );
    mobileScreen.position.set(4.8, 0.8, -0.6);
    mobileScreen.rotation.y = -0.45;
    deviceGroup.add(mobileScreen);

    extras.floats.push({ obj: deviceGroup, baseY: 4.5, amp: 0.2, rotSpeed: 0.15 });
    extras.cardGroup = null;
  }

  return extras;
}
