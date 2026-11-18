import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { SPRING_PEAK } from "@/components/journey/motion-curve";
import { play, type Sfx } from "@/components/journey/sfx";
import { CREAM, HUE, Kit, SKIN, STATION_IDS, StationId, Spring, WHITE, createInk, group, part, popped, spring } from "./kit";
import { DOCK, Station, buildStations, type Prop } from "./stations";

/*
MOTION SCORE — the stack world (one canvas, its own clock; every value a spring on the shared curve)
Trigger: enters when the canvas is visible; then input (hover, click, drag) and the request's tour.

| Beat / trigger        | Element                      | Pattern | Goal                                         | Delay (s)              | Sound                 |
|-----------------------|------------------------------|---------|----------------------------------------------|------------------------|-----------------------|
| enter                 | camera                       | P12     | turns 34° into the iso view, zooms 0.72 → 1   | .22 (hero object lag)  | –                     |
| enter                 | every prop, tree, machine    | P3/P12  | pops up, a ripple outward from the hub       | .22 + .07 × radius     | –                     |
| enter                 | the figure                   | P3      | pops onto the walkway                        | 1.1                    | –                     |
| tour hop k → k+1      | request packet               | P12     | slides along the rail to the next dock       | every 2.6 s            | –                     |
| tour arrive k         | packet                       | P5b     | takes the station's colour, squash-caught    | 0                      | – (the station's own) |
| tour arrive k         | dock ping                    | P3      | ring pops out and back                       | 0                      | –                     |
| tour arrive k         | station k                    | P12     | does its job (stations.ts)                   | 0                      | one, at its catch     |
| tour arrive hub       | rocket + checks              | P12     | checks light .35 apart, squash, launch, land | 0 → 1.55 → 3.7         | ui_big_click @ launch |
| hover station         | other districts              | –       | fade toward the paper (dim .38)              | 0                      | –                     |
| hover station / prop  | label pill                   | P3      | pops at the station, follows it              | 0                      | –                     |
| hover prop            | the prop                     | P17     | lifts .08                                    | 0                      | –                     |
| select station        | camera                       | P12     | target to the station, zoom 1.9 (hub 1.7)    | 0                      | ui_pop @ PEAK         |
| select station        | other districts              | –       | dim .7                                       | 0                      | –                     |
| select station        | figure                       | P16     | walks there (2.7 u/s leader, spring follow)  | 0                      | –                     |
| drag                  | world yaw                    | 1:1     | follows the pointer; release projects        | –                      | ui_click_data @ catch |
|                       |                              |         | momentum, snaps to the nearest quarter turn  |                        |                       |
|                       |                              |         | (±90° at most; rubber-bands past it)         |                        |                       |
Loops (P16): electrons, gears, pipe beads, LEDs, table rows, plant, clouds, cursor. All stop under reduced motion.
Reduced motion: every spring snaps; the tour, the loops and the intro do not run; clicks still change state.
Phone: the camera fits the board to the width; drag is horizontal only (vertical scroll passes through).
*/

export type WorldEvents = {
  onHover: (info: { station: StationId | null; prop: string | null }) => void;
  onSelect: (id: StationId | null) => void;
  /** A clicked thing opened its note (content.ts NOTES), or the note closed. */
  onNote: (id: string | null) => void;
  onFail: () => void;
};
export type World = {
  select: (id: StationId | null) => void;
  /** Plays the thing with this note id and opens its note, as if it had been clicked. */
  show: (noteId: string) => void;
  closeNote: () => void;
  send: () => void;
  dispose: () => void;
};

const D = Math.PI / 180;
const ELEVATION = 31 * D;
const HOME_YAW = 45 * D;
const YAW_MIN = HOME_YAW - Math.PI / 2, YAW_MAX = HOME_YAW + Math.PI / 2;
const RAIL_R = 3.25, RAIL_Y = 0.42, WALK_R = 3.62;

export function createStackWorld(canvas: HTMLCanvasElement, pill: HTMLElement, noteEl: HTMLElement, events: WorldEvents, opts: { freeLeft: () => number }): World {
  const coarse = matchMedia("(pointer: coarse)").matches;
  let renderer: THREE.WebGLRenderer;
  try {
    // Phones share GPU memory with the page: ask for the default GPU, not the fast one.
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: coarse ? "default" : "high-performance" });
  } catch {
    events.onFail();
    return { select() {}, show() {}, closeNote() {}, send() {}, dispose() {} };
  }
  // Desktop renders at least 1.5× and lets the browser downsample: the ink lines stay smooth on 1× screens.
  const dpr = coarse ? Math.min(window.devicePixelRatio || 1, 1.5) : Math.min(2, Math.max(1.5, window.devicePixelRatio || 1));
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.02;

  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const still = () => reduce.matches;
  const sound = (name: Sfx, delay = 0) => { if (!still() && !document.hidden) play(name, delay); };

  const kit = new Kit();
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 18, 72);
  // The ink pass keeps a multisampled half-float copy of the frame; phones take two samples, not four.
  const ink = createInk(renderer, coarse ? 2 : 4);

  // Light: a warm key from the back left (tops lit, left faces mid, right faces in shade),
  // and a cool sky so shadows stay coloured rather than grey.
  // A soft room environment fills every face; the sun adds direction and the shadows.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTarget = pmrem.fromScene(room, 0.04);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.62;
  pmrem.dispose();
  (room as unknown as { dispose?: () => void }).dispose?.();
  scene.add(new THREE.HemisphereLight("#f2f5ff", "#dcd4ea", 0.85));
  const sun = new THREE.DirectionalLight("#fff4e6", 2.5);
  sun.position.set(-5.5, 15, 8.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.025;
  scene.add(sun);

  /* ---------- the board ---------- */
  const world = new THREE.Group();
  scene.add(world);
  part(world, kit.box(12.5, 0.34, 12.5, 0.17), kit.mat("#d9e0ec", "base"), 0, -0.98, 0, false);
  // A soft ground shadow under the floating board (no depth, so the ink ignores it).
  {
    // Built as data with a constant colour: a canvas gradient this faint unpremultiplies into speckle.
    const N = 128, data = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = Math.min(1, Math.hypot(x - N / 2 + 0.5, y - N / 2 + 0.5) / (N / 2));
      const i = (y * N + x) * 4;
      data[i] = 20; data[i + 1] = 28; data[i + 2] = 60;
      data[i + 3] = Math.round(255 * 0.2 * Math.pow(1 - d, 1.6));
    }
    const tex = kit.keep(new THREE.DataTexture(data, N, N));
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    const shadow = new THREE.Mesh(kit.keep(new THREE.PlaneGeometry(22, 22)), kit.keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.9;
    shadow.renderOrder = -1;
    world.add(shadow);
  }
  // The walkway that rings the hub, bridging the gaps between districts.
  {
    const s = new THREE.Shape();
    s.absarc(0, 0, 3.98, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, 3.0, 0, Math.PI * 2, true);
    s.holes.push(hole);
    const geo = kit.keep(new THREE.ExtrudeGeometry(s, { depth: 0.09, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 96 }));
    geo.rotateX(-Math.PI / 2);
    part(world, geo, kit.mat(CREAM, "base"), 0, -0.02, 0, false);
  }
  // The request's rail: a ring on pylons and a spur into the hub.
  const railMat = kit.mat("#8794b8", "base");
  const ring = part(world, kit.torus(RAIL_R, 0.055, Math.PI * 2, 160), railMat, 0, RAIL_Y, 0);
  ring.rotation.x = Math.PI / 2;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 11.25 * D;
    part(world, kit.cyl(0.045, 0.06, RAIL_Y, 10), railMat, Math.cos(a) * RAIL_R, RAIL_Y / 2, Math.sin(a) * RAIL_R);
  }
  {
    const spur = group(world, 0, RAIL_Y, 0, -DOCK.data);
    const len = RAIL_R - 0.85;
    part(spur, kit.cyl(0.055, 0.055, len, 12), railMat, 0.85 + len / 2, 0, 0).rotation.z = Math.PI / 2;
  }

  const ctx = { kit, sound, still };
  const { list: stations, delivery } = buildStations(ctx);
  const byId = Object.fromEntries(stations.map(s => [s.id, s])) as Record<StationId, Station>;
  stations.forEach(s => { s.root.userData.station = s.id; world.add(s.root); });

  // Clouds drift behind the board; their group turns with the camera so they stay behind it.
  const sky = group(world);
  const clouds = [[-2.6, 4.6, -8.6, 1], [-8.9, 3.4, -2.4, 0.8], [3.8, 5.2, -8.2, 0.9]].map(([x, y, z, s]) => {
    const g = group(sky, x, y, z);
    g.scale.setScalar(s);
    [[0, 0, 0, 0.55], [0.55, -0.1, 0.1, 0.42], [-0.55, -0.12, 0, 0.4], [0.2, 0.25, -0.1, 0.4]].forEach(([cx, cy, cz, r]) => part(g, kit.sphere(r, 20), kit.mat(WHITE, "base"), cx, cy, cz));
    return { g, x };
  });

  /* ---------- the request: a packet that rides the rail through every layer ---------- */
  const packetMat = kit.own(HUE.design.accent, "base");
  const packet = group(world);
  const packetBody = part(packet, kit.box(0.42, 0.42, 0.42, 0.1), packetMat, 0, 0, 0);
  part(packet, kit.box(0.44, 0.08, 0.44, 0.03), kit.mat(WHITE, "base"), 0, 0.05, 0, false);
  const packetS = spring(0), packetScale = spring(0), packetSquash = spring(0), packetHue = spring(1);
  const fromColor = new THREE.Color(HUE.design.accent), toColor = new THREE.Color(HUE.design.accent);
  const ping = part(world, kit.torus(0.5, 0.05, Math.PI * 2, 48), kit.mat(WHITE, "base"), 0, 0.06, 0, false);
  ping.rotation.x = Math.PI / 2;
  const pingS = spring(0);
  let pingAt = -9;

  const packetPos = (s: number, out: THREE.Vector3) => {
    if (s <= 3) {
      const a = DOCK.design + s * (Math.PI / 2);
      return out.set(Math.cos(a) * RAIL_R, RAIL_Y + 0.27, Math.sin(a) * RAIL_R);
    }
    const r = RAIL_R - (s - 3) * (RAIL_R - 0.95);
    return out.set(Math.cos(DOCK.data) * r, RAIL_Y + 0.27, Math.sin(DOCK.data) * r);
  };

  /* ---------- the figure: one person, walking to every layer ---------- */
  const figure = group(world, 0, 0, 0);
  const fig = group(figure);
  fig.scale.setScalar(1.5);
  const pants = kit.mat("#26304f", "base"), hoodie = kit.mat("#2433e6", "base");
  const legs = [-1, 1].map(s => {
    const hip = group(fig, s * 0.07, 0.27, 0);
    part(hip, kit.capsule(0.055, 0.15), pants, 0, -0.13, 0);
    return hip;
  });
  const torso = group(fig, 0, 0, 0);
  part(torso, kit.capsule(0.14, 0.18), hoodie, 0, 0.45, 0);
  const arms = [-1, 1].map(s => {
    const sh = group(torso, s * 0.19, 0.56, 0);
    part(sh, kit.capsule(0.042, 0.16), hoodie, 0, -0.12, 0);
    part(sh, kit.sphere(0.045, 12), kit.mat(SKIN, "base"), 0, -0.25, 0, false);
    return sh;
  });
  part(torso, kit.sphere(0.13, 22), kit.mat(SKIN, "base"), 0, 0.76, 0);
  const hair = part(torso, kit.sphere(0.137, 22), kit.mat("#1c2033", "base"), 0, 0.8, -0.025);
  hair.scale.set(1, 0.72, 1);
  let waveAt = -9;
  const hop = spring(0);
  const you: Prop = { id: "you", object: figure, hover: spring(0), act: () => { waveAt = clock; hop.kick(3.2); sound("ui_pop", SPRING_PEAK); } };
  figure.userData.prop = you;

  const drone = group(world, 0, 1.6, 0);
  const droneBody = group(drone);
  {
    const shell = part(droneBody, kit.sphere(0.17, 24), kit.mat(WHITE, "base"), 0, 0, 0);
    shell.scale.set(1, 0.66, 1);
    const band = part(droneBody, kit.torus(0.165, 0.025, Math.PI * 2, 40), kit.mat("#2433e6", "base"), 0, 0, 0, false);
    band.rotation.x = Math.PI / 2;
    part(droneBody, kit.sphere(0.045, 14), kit.flat("#38e1ff", "base"), 0, 0.02, 0.155, false);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const armMesh = part(droneBody, kit.box(0.22, 0.03, 0.04, 0.012), kit.mat("#26304f", "base"), Math.cos(a) * 0.17, 0.04, Math.sin(a) * 0.17, false);
      armMesh.rotation.y = -a;
      const rotor = part(droneBody, kit.cyl(0.085, 0.085, 0.012, 20), kit.mat("#c9d2ea", "base"), Math.cos(a) * 0.27, 0.07, Math.sin(a) * 0.27, false);
      rotor.userData.rotor = true;
    }
  }
  const dSpin = spring(0), dx = spring(0), dy = spring(1.6), dz = spring(0);
  let dTurns = 0;
  const helper: Prop = { id: "drone", object: drone, hover: spring(0), act: () => { dTurns++; sound("ui_pop", SPRING_PEAK); } };
  drone.userData.prop = helper;

  const lead = { a: DOCK.design, r: WALK_R };
  const fa = spring(DOCK.design), fr = spring(WALK_R), face = spring(0), figPop = spring(0);
  let walkPhase = 0;

  /* ---------- intro: props pop up in a ripple from the hub ---------- */
  type Pop = { obj: THREE.Object3D; base: THREE.Vector3; delay: number; s: Spring };
  const pops: Pop[] = [];
  stations.forEach(s => s.root.children.forEach(c => {
    if (!(c instanceof THREE.Group)) return;
    const r = Math.hypot(c.position.x, c.position.z);
    pops.push({ obj: c, base: c.scale.clone(), delay: 0.22 + r * 0.07, s: spring(0) });
  }));
  const yaw = spring(HOME_YAW + 34 * D), zoom = spring(0.72);
  const tx = spring(0), ty = spring(0.55), tz = spring(0);
  const dims = Object.fromEntries([...STATION_IDS, "base"].map(z => [z, spring(0)])) as Record<StationId | "base", Spring>;
  const pillS = spring(0);

  /* ---------- state ---------- */
  let clock = 0, enteredAt = -1, last = 0, raf = 0, visible = false, disposed = false;
  let selected: StationId | null = null, hoverStation: StationId | null = null, hoverProp: Prop | null = null;
  let tourK = 0, tourAt = 0, arrived = -1, restartAt = -9, waitLaunch = false;
  let W = 1, H = 1, pillAt = "";

  const allProps: Prop[] = [...stations.flatMap(st => st.props), you, helper];
  const pickables = [...stations.flatMap(st => [...st.hits, ...st.props.map(p => p.object)]), figure, drone];
  const stationOf = (p: Prop) => (find(p.object, "station") as StationId | null);

  /* ---------- notes: a card anchored above the thing that was clicked ---------- */
  const noteS = spring(0), box = new THREE.Box3(), noteLocal = new THREE.Vector3();
  let noteProp: Prop | null = null, noteShown: Prop | null = null, noteAt = -9, noteXY = "";
  function openNote(p: Prop) {
    noteProp = noteShown = p;
    p.object.updateWorldMatrix(true, true);
    box.setFromObject(p.object);
    noteLocal.set((box.min.x + box.max.x) / 2, box.max.y + 0.15, (box.min.z + box.max.z) / 2);
    p.object.worldToLocal(noteLocal);
    noteS.snap(0);
    noteAt = clock;
    events.onNote(p.id);
  }
  function closeNote() {
    if (!noteProp) return;
    noteProp = null;
    events.onNote(null);
  }
  function playProp(p: Prop) {
    const st = stationOf(p);
    if (st && st !== selected) select(st, true);
    p.act();
    openNote(p);
  }
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let pointerDirty = false, pointerIn = false;

  /* ---------- tour ---------- */
  function arrive(k: number) {
    arrived = k;
    const st = k === 4 ? delivery : stations[k];
    fromColor.copy(packetMat.color); toColor.set(HUE[st.id].accent);
    packetHue.snap(0);
    packetSquash.snap(-0.35);
    if (k < 4) {
      pingAt = clock;
      pingS.snap(0);
      const p = packetPos(k, new THREE.Vector3());
      ping.position.set(p.x, 0.07, p.z);
    }
    st.arrive();
  }
  function stepTour() {
    if (still()) return;
    if (restartAt > 0) {
      if (clock - restartAt > 0.4) { restartAt = -9; tourK = 0; tourAt = clock; arrived = -1; waitLaunch = false; packetS.snap(0); }
      return;
    }
    if (waitLaunch && Math.abs(packetS.value - 4) < 0.03) { waitLaunch = false; arrive(4); }
    // The hub: the packet slides into the rocket, which launches; a new request appears at Design.
    if (tourK === 4) {
      if (arrived === 4 && !delivery.busy()) { tourK = 0; tourAt = clock; arrived = -1; waitLaunch = false; packetS.snap(0); packetScale.snap(0); }
      return;
    }
    if (arrived !== tourK && Math.abs(packetS.value - tourK) < 0.03 && packetScale.value > 0.5) arrive(tourK);
    if (arrived === tourK && clock - tourAt > 2.6) {
      tourK++; tourAt = clock;
      if (tourK === 4) waitLaunch = true;
    }
  }

  /* ---------- frame ---------- */
  const v3 = new THREE.Vector3();
  function frame(now: number) {
    raf = 0;
    if (disposed) return;
    const dt = last ? Math.min(0.25, (now - last) / 1000) : 0;
    last = now; clock += dt;
    const s = still();
    if (enteredAt < 0) enteredAt = clock;
    const since = clock - enteredAt;

    // Intro ripple.
    pops.forEach(p => {
      if (s) p.s.snap(1); else if (since >= p.delay) p.s.step(1, dt);
      const k = Math.max(0.0001, popped(p.s.value));
      p.obj.scale.set(p.base.x * k, p.base.y * k, p.base.z * k);
      p.obj.visible = p.s.value > 0.002;
    });

    // Camera: target, zoom and yaw are springs; the drag writes yaw directly.
    const focus = selected ? byId[selected].focus : null;
    const goals: [Spring, number][] = [[tx, focus ? focus.x : 0], [ty, focus ? focus.y : 0.55], [tz, focus ? focus.z : 0], [zoom, focus ? (selected === "delivery" ? 1.7 : 1.9) : 1]];
    goals.forEach(([sp, g]) => { if (s) sp.snap(g); else if (since >= 0.22) sp.step(g, dt); });
    if (!drag.active) { if (s) yaw.snap(yawGoal); else if (since >= 0.22) yaw.step(yawGoal, dt); }
    placeCamera();

    // Spotlight: districts out of focus fade toward the paper.
    STATION_IDS.forEach(id => {
      const goal = selected ? (id === selected ? 0 : 0.7) : hoverStation && hoverStation !== id ? 0.38 : 0;
      if (s) dims[id].snap(goal); else dims[id].step(goal, dt);
      kit.zones[id].value = Math.max(0, Math.min(1, dims[id].value));
    });
    dims.base.step(selected ? 0.25 : 0, dt);
    kit.zones.base.value = Math.max(0, dims.base.value);

    // Hover picking, at most once a frame.
    if (pointerDirty && !drag.active) { pointerDirty = false; pick(); }
    stations.forEach(st => st.props.forEach(p => {
      p.hover.step(p === hoverProp ? 1 : 0, dt);
      p.object.position.y = p.hover.value * 0.08;
    }));

    stations.forEach(st => st.update(dt, s ? 0 : clock));

    // Tour and packet.
    stepTour();
    const restarting = restartAt > 0;
    const scaleGoal = restarting || (tourK === 4 && arrived === 4) ? 0 : since > 1.0 ? 1 : 0;
    if (s) { packetScale.snap(1); packetS.snap(0); } else { packetScale.step(scaleGoal, dt); packetS.step(restarting ? packetS.value : tourK, dt); }
    packetSquash.step(0, dt);
    packetHue.step(1, dt);
    packetMat.color.copy(fromColor).lerp(toColor, Math.min(1, Math.max(0, packetHue.value)));
    packetPos(Math.max(0, packetS.value), packet.position);
    const ps = Math.max(0.0001, popped(packetScale.value));
    const sq = packetSquash.value;
    packet.scale.set(ps * (1 - sq * 0.5), ps * (1 + sq), ps * (1 - sq * 0.5));
    packet.rotation.y = -(DOCK.design + Math.min(3, packetS.value) * (Math.PI / 2));
    packet.visible = packetScale.value > 0.002;
    pingS.step(clock - pingAt < 0.7 ? 1 : 0, dt);
    ping.scale.setScalar(Math.max(0.0001, popped(pingS.value) * 1.1));
    ping.visible = pingS.value > 0.002;

    // Figure: a leader walks at a steady pace toward the goal; the figure springs after it.
    const target = selected ? byId[selected].spot : tourK === 4 ? delivery.spot : stations[tourK].spot;
    let da = target.a - lead.a;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    const dr = target.r - lead.r;
    const arc = da * Math.max(1.4, lead.r);
    const dist = Math.hypot(arc, dr);
    const stepLen = Math.min(dist, (s ? 99 : 2.7) * dt);
    if (dist > 1e-4) { lead.a += (da / dist) * stepLen; lead.r += (dr / dist) * stepLen; }
    // Unwrap so the spring never takes the long way round.
    const aGoal = fa.value + Math.atan2(Math.sin(lead.a - fa.value), Math.cos(lead.a - fa.value));
    if (s) { fa.snap(aGoal); fr.snap(lead.r); } else { fa.step(aGoal, dt); fr.step(lead.r, dt); }
    figPop.step(since > 1.1 || s ? 1 : 0, dt);
    const px = Math.cos(fa.value) * fr.value, pz = Math.sin(fa.value) * fr.value;
    const vx = -Math.sin(fa.value) * fa.velocity * fr.value + Math.cos(fa.value) * fr.velocity;
    const vz = Math.cos(fa.value) * fa.velocity * fr.value + Math.sin(fa.value) * fr.velocity;
    const speed = Math.hypot(vx, vz);
    const walking = Math.min(1, speed / 1.2);
    walkPhase += dt * (4 + speed * 4.5);
    // Facing: along the walk; at rest, toward the work (out to the props, or in to the rocket).
    const restFace = Math.PI / 2 - target.a + (target === delivery.spot ? Math.PI : 0);
    const faceGoal = speed > 0.25 ? Math.atan2(vx, vz) : restFace;
    const fGoal = face.value + Math.atan2(Math.sin(faceGoal - face.value), Math.cos(faceGoal - face.value));
    if (s) face.snap(fGoal); else face.step(fGoal, dt);
    const ground = fr.value < 1.95 ? 0.32 : fr.value < 3.0 || fr.value > 3.98 ? 0 : 0.1;
    figure.position.set(px, ground + Math.abs(Math.sin(walkPhase)) * 0.05 * walking, pz);
    figure.rotation.y = face.value;
    figure.scale.setScalar(Math.max(0.0001, popped(figPop.value)));
    figure.visible = figPop.value > 0.002;
    legs[0].rotation.x = Math.sin(walkPhase) * 0.7 * walking;
    legs[1].rotation.x = -Math.sin(walkPhase) * 0.7 * walking;
    arms[0].rotation.x = -Math.sin(walkPhase) * 0.6 * walking;
    arms[1].rotation.x = Math.sin(walkPhase) * 0.6 * walking + (walking < 0.2 && !s ? Math.max(0, Math.sin(clock * 3)) * -0.5 : 0);
    torso.rotation.x = walking * 0.08;
    // A click: a little hop and a wave.
    hop.step(0, dt);
    fig.position.y = Math.max(0, hop.value) * 0.12;
    const waving = clock - waveAt < 1.3 && !s;
    if (waving) { arms[0].rotation.z = -2.5 + Math.sin((clock - waveAt) * 14) * 0.35; arms[0].rotation.x = 0; } else arms[0].rotation.z = 0;

    // The helper drone keeps station beside the figure's shoulder and bobs; a click spins it round.
    const side = face.value + Math.PI / 2;
    const gx = px + Math.sin(side) * 0.6, gz = pz + Math.cos(side) * 0.6, gy = ground + 1.55 + (s ? 0 : Math.sin(clock * 2.1) * 0.08);
    if (s) { dx.snap(gx); dy.snap(gy); dz.snap(gz); dSpin.snap(dTurns * Math.PI * 2); } else { dx.step(gx, dt); dy.step(gy, dt); dz.step(gz, dt); dSpin.step(dTurns * Math.PI * 2, dt); }
    drone.position.set(dx.value, dy.value, dz.value);
    drone.scale.setScalar(Math.max(0.0001, popped(figPop.value)));
    drone.visible = figPop.value > 0.002;
    droneBody.rotation.y = HOME_YAW + dSpin.value;
    droneBody.rotation.z = -dx.velocity * 0.05;
    if (!s) droneBody.children.forEach(c => { if (c.userData.rotor) c.rotation.y += dt * 30; });

    sky.rotation.y = yaw.value - HOME_YAW;
    clouds.forEach((c, i) => { c.g.position.x = c.x + (s ? 0 : Math.sin(clock * 0.05 + i * 2) * 1.2); });

    // Label pill follows the hovered station on screen.
    const showPill = !!((hoverStation || hoverProp) && pointerIn && !drag.active);
    pillS.step(showPill ? 1 : 0, dt);
    if (hoverStation || hoverProp) {
      if (hoverStation) v3.copy(byId[hoverStation].anchor);
      else { hoverProp!.object.getWorldPosition(v3); v3.y += 1.45; }
      v3.project(camera);
      pillAt = `translate3d(${((v3.x + 1) / 2 * W).toFixed(1)}px, ${((1 - v3.y) / 2 * H).toFixed(1)}px, 0) translate(-50%, -100%)`;
    }
    pill.style.transform = `${pillAt} scale(${Math.max(0, popped(pillS.value, 2.5)).toFixed(3)})`;
    pill.style.visibility = pillS.value > 0.002 ? "visible" : "hidden";

    if (!s && clock - noteAt >= 0.2) noteS.step(noteProp ? 1 : 0, dt); else if (s) noteS.snap(noteProp ? 1 : 0);
    if (noteShown) {
      v3.copy(noteLocal);
      noteShown.object.localToWorld(v3);
      v3.project(camera);
      const cw = noteEl.offsetWidth, ch = noteEl.offsetHeight;
      const nx = Math.min(W - cw / 2 - 14, Math.max(freeLeft + cw / 2 + 14, ((v3.x + 1) / 2) * W));
      const ny = Math.min(H - 16, Math.max(ch + 84, ((1 - v3.y) / 2) * H - 10));
      noteXY = `translate3d(${nx.toFixed(1)}px, ${ny.toFixed(1)}px, 0) translate(-50%, -100%)`;
    }
    noteEl.style.transform = `${noteXY} scale(${Math.max(0, popped(noteS.value, 2.5)).toFixed(3)})`;
    noteEl.style.visibility = noteS.value > 0.002 ? "visible" : "hidden";
    if (!noteProp && noteS.value <= 0.002) noteShown = null;

    ink.render(renderer, scene, camera);
    if (visible && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function placeCamera() {
    const halfH = baseHalfH / Math.max(0.2, zoom.value);
    const halfW = halfH * (W / H);
    // Centre the board in the space the copy leaves free (left edge in CSS px).
    const off = (freeLeft / 2) * ((2 * halfH) / H);
    camera.left = -halfW - off; camera.right = halfW - off; camera.top = halfH; camera.bottom = -halfH;
    camera.updateProjectionMatrix();
    const cy = Math.cos(ELEVATION);
    camera.position.set(tx.value + Math.sin(yaw.value) * cy * 40, ty.value + Math.sin(ELEVATION) * 40, tz.value + Math.cos(yaw.value) * cy * 40);
    camera.lookAt(tx.value, ty.value, tz.value);
    // The ink threshold follows how much world one CSS pixel covers.
    ink.setStep(((2 * halfH) / H) / (camera.far - camera.near));
  }

  /* ---------- sizing ---------- */
  let baseHalfH = 7, freeLeft = 0;
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    ink.resize(W, H, dpr);
    freeLeft = opts.freeLeft();
    // Fit the board (about 8.8 × 5.8 half-units in this view) into the free area, with a margin.
    baseHalfH = Math.max(6.5, (8.9 * 1.1 * H) / Math.max(200, W - freeLeft));
    wakeUp();
  }

  /* ---------- picking ---------- */
  function find(o: THREE.Object3D | null, key: "prop" | "station") {
    for (let n = o; n; n = n.parent) if (n.userData[key]) return n.userData[key];
    return null;
  }
  function hitAt(): { station: StationId | null; prop: Prop | null } {
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, true).find(h => h.object.visible);
    if (!hit) return { station: null, prop: null };
    return { station: find(hit.object, "station") as StationId | null, prop: find(hit.object, "prop") as Prop | null };
  }
  function pick() {
    const { station, prop } = pointerIn ? hitAt() : { station: null, prop: null };
    if (station !== hoverStation || prop !== hoverProp) {
      hoverStation = station; hoverProp = prop;
      canvas.style.cursor = prop || station ? "pointer" : "grab";
      events.onHover({ station, prop: prop?.id ?? null });
    }
  }

  /* ---------- pointer: hover, click, drag to turn ---------- */
  let yawGoal = HOME_YAW;
  const drag = { active: false, down: false, x0: 0, y0: 0, yaw0: 0, id: -1, hist: [] as { x: number; t: number }[] };
  const setNdc = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    drag.down = true; drag.active = false; drag.x0 = e.clientX; drag.y0 = e.clientY; drag.yaw0 = yaw.value; drag.id = e.pointerId;
    drag.hist = [{ x: e.clientX, t: performance.now() }];
    setNdc(e);
  };
  const onMove = (e: PointerEvent) => {
    pointerIn = true;
    setNdc(e);
    pointerDirty = true;
    if (drag.down && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x0;
      if (!drag.active && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - drag.y0)) {
        drag.active = true;
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = "grabbing";
      }
      if (drag.active) {
        // Past a quarter turn either way the board resists, more the further it goes.
        const raw = drag.yaw0 - dx * 0.0068;
        const over = raw > YAW_MAX ? raw - YAW_MAX : raw < YAW_MIN ? raw - YAW_MIN : 0;
        yaw.snap(raw - over + (over * 1.2 * 0.55) / (1.2 + 0.55 * Math.abs(over)));
        drag.hist.push({ x: e.clientX, t: performance.now() });
        if (drag.hist.length > 6) drag.hist.shift();
      }
    }
    wakeUp();
  };
  const onUp = (e: PointerEvent) => {
    if (!drag.down || e.pointerId !== drag.id) return;
    drag.down = false;
    if (drag.active) {
      drag.active = false;
      const a = drag.hist[0], b = drag.hist[drag.hist.length - 1];
      const vel = b && a && b.t > a.t ? -((b.x - a.x) / (b.t - a.t)) * 1000 * 0.0068 : 0; // rad/s
      // Project the momentum (Apple's decay), then rest on the nearest quarter turn.
      const projected = yaw.value + (vel / 1000) * 0.998 / (1 - 0.998);
      yawGoal = Math.max(YAW_MIN, Math.min(YAW_MAX, HOME_YAW + Math.round((projected - HOME_YAW) / (Math.PI / 2)) * (Math.PI / 2)));
      yaw.kick(vel * 0.5);
      sound("ui_click_data", SPRING_PEAK);
      canvas.style.cursor = "grab";
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    } else {
      setNdc(e);
      const { station, prop } = hitAt();
      if (prop) playProp(prop);
      else if (station) { closeNote(); select(station, true); }
      else if (noteProp) closeNote();
      else if (selected) select(null, true);
    }
    wakeUp();
  };
  const onLeave = () => { pointerIn = false; pointerDirty = true; wakeUp(); };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.style.cursor = "grab";

  function select(id: StationId | null, fromScene = false) {
    if (id === selected) return;
    selected = id;
    if (noteProp && stationOf(noteProp) && stationOf(noteProp) !== id) closeNote();
    if (id) sound("ui_pop", SPRING_PEAK);
    if (fromScene) events.onSelect(id);
    wakeUp();
  }

  /* ---------- lifecycle ---------- */
  function wakeUp() { if (!raf && visible && !document.hidden && !disposed) { last = 0; raf = requestAnimationFrame(frame); } }
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; wakeUp(); }, { threshold: 0 });
  io.observe(canvas);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const onVis = () => wakeUp();
  document.addEventListener("visibilitychange", onVis);
  reduce.addEventListener("change", onVis);
  const onLost = (e: Event) => { e.preventDefault(); disposed = true; events.onFail(); };
  canvas.addEventListener("webglcontextlost", onLost);
  resize();
  // Development only: lets a test sample the live springs (overshoot, settle).
  if (process.env.NODE_ENV === "development") Object.assign(canvas, { __sw: { zoom, yaw, tx, packetS, packetScale, fr, fa, dims, rocketY: () => delivery.root.children.find(c => c.userData.prop)?.children[0]?.position.y } });

  return {
    select: id => select(id),
    show(noteId) { const p = allProps.find(q => q.id === noteId); if (p) playProp(p); wakeUp(); },
    closeNote() { closeNote(); wakeUp(); },
    send() { if (selected) select(null, true); restartAt = clock; tourK = 0; arrived = -1; wakeUp(); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      reduce.removeEventListener("change", onVis);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("webglcontextlost", onLost);
      stations.forEach(st => st.root.traverse(o => { if (o instanceof THREE.Mesh && o.geometry.type === "TubeGeometry") o.geometry.dispose(); }));
      kit.dispose();
      envTarget.dispose();
      ink.dispose();
      renderer.dispose();
      // Give back the drawing buffer now instead of whenever the canvas is collected.
      canvas.width = canvas.height = 1;
    },
  };
}
