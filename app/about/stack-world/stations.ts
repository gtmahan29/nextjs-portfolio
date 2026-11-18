import * as THREE from "three";
import { SPRING_PEAK } from "@/components/journey/motion-curve";
import type { Sfx } from "@/components/journey/sfx";
import { CREAM, HUE, INK, Kit, LEAF, LEAF_DEEP, STEEL, StationId, Spring, WHITE, clamp01, group, label, part, popped, spring } from "./kit";

/*
  The five stations of the stack world. Each is a small working place on its own district:
  props you can click, a loop that keeps it alive, and a job it does when the request arrives.

  Layout (world units): four districts 5.4 square around a round hub. The walkway rings the
  hub at r 3.0–3.95 and the request's rail runs on it at r 3.25. Props stand outside r 4.1 so
  the walking figure never passes through them. Angles: Design 225°, Frontend 315°, Backend 45°,
  Data 135° (the camera looks from 45°, so Backend is nearest). Delivery is the hub itself.
*/

export type Ctx = {
  kit: Kit;
  /** A sound at the catch: the delay is when the motion's goal changed plus SPRING_PEAK. */
  sound: (name: Sfx, delay?: number) => void;
  still: () => boolean;
};
/** Something you can click. `id` links it to its note in content.ts (NOTES). */
export type Prop = { id: string; object: THREE.Group; act: () => void; hover: Spring };
export type Station = {
  id: StationId;
  root: THREE.Group;
  /** Meshes that count as "this station" for hovering and clicking. */
  hits: THREE.Object3D[];
  props: Prop[];
  /** Camera target when focused, and where the hover label sits. */
  focus: THREE.Vector3;
  anchor: THREE.Vector3;
  /** Where the figure stands to work here (angle in radians, radius). */
  spot: { a: number; r: number };
  /** The request has arrived: do this station's job. */
  arrive: () => void;
  update: (dt: number, t: number) => void;
};

const D = Math.PI / 180;
const C = 2.95; // district centre offset
export const DOCK: Record<Exclude<StationId, "delivery">, number> = { design: 225 * D, frontend: 315 * D, backend: 45 * D, data: 135 * D };
const FACE = Math.PI / 4; // props face the default camera

/** A prop wrapper: a group that can be hovered (it lifts a little) and clicked. */
export function prop(parent: THREE.Object3D, x: number, z: number, ry: number, id: string, act: () => void): Prop {
  const object = group(parent, x, 0, z, ry);
  const p: Prop = { id, object, act, hover: spring(0) };
  object.userData.prop = p;
  return p;
}

function district(ctx: Ctx, root: THREE.Group, id: StationId, sx: number, sz: number) {
  const { kit } = ctx;
  const h = HUE[id];
  const side = part(root, kit.box(5.4, 0.62, 5.4, 0.16), kit.mat(h.side, id), sx * C, -0.4, sz * C, false);
  const top = part(root, kit.box(5.36, 0.14, 5.36, 0.06), kit.mat(h.top, id), sx * C, -0.07, sz * C, false);
  return [side, top];
}

/** A round tree: the board's quiet filler, so no district is only machines. */
function tree(ctx: Ctx, parent: THREE.Object3D, zone: StationId, x: number, z: number, s = 1) {
  const g = group(parent, x, 0, z);
  g.scale.setScalar(s);
  part(g, ctx.kit.cyl(0.06, 0.08, 0.36, 12), ctx.kit.mat("#9c6b4a", zone), 0, 0.18, 0);
  part(g, ctx.kit.sphere(0.3, 20), ctx.kit.mat(LEAF, zone), 0, 0.55, 0);
  part(g, ctx.kit.sphere(0.2, 18), ctx.kit.mat(LEAF_DEEP, zone), 0.14, 0.4, 0.1);
  return g;
}

/* =====================================================================================
   DESIGN — the drafting corner. A pen tool places anchor points one by one on an easel,
   a swatch fan holds the stack's five colours, a type scale stands in front, a plant breathes.
   ===================================================================================== */
const PATHS: [number, number][][] = [
  [[-0.88, -0.32], [-0.45, 0.38], [0, -0.12], [0.45, 0.42], [0.88, -0.28]],
  [[-0.86, 0.36], [-0.3, -0.42], [0.18, 0.4], [0.5, -0.1], [0.86, 0.34]],
  [[-0.86, -0.4], [-0.62, 0.34], [-0.05, 0.42], [0.32, -0.36], [0.86, -0.1]],
];

function buildDesign(ctx: Ctx): Station {
  const { kit } = ctx;
  const id = "design", h = HUE.design;
  const root = new THREE.Group();
  const hits = district(ctx, root, id, -1, -1);

  // Easel with an artboard, at the back corner.
  const easel = prop(root, -4.45, -4.45, FACE, "easel", () => draw());
  const wood = kit.mat("#c98b5e", id), woodDeep = kit.mat("#9b6440", id);
  for (const s of [-1, 1]) {
    const leg = part(easel.object, kit.cyl(0.05, 0.06, 2.5, 10), wood, s * 0.78, 1.18, 0.12);
    leg.rotation.z = s * -0.1; leg.rotation.x = 0.1;
  }
  const back = part(easel.object, kit.cyl(0.045, 0.05, 2.3, 10), woodDeep, 0, 1.05, -0.5);
  back.rotation.x = -0.32;
  part(easel.object, kit.box(2.3, 0.08, 0.22, 0.03), wood, 0, 0.66, 0.12);
  const board = group(easel.object, 0, 1.5, 0.08);
  board.rotation.x = -0.1;
  part(board, kit.box(2.24, 1.56, 0.08, 0.05), kit.mat(CREAM, id), 0, 0, 0);
  // Faint guides on the artboard: a layout grid, as a designer would set one.
  for (const gx of [-0.56, 0, 0.56]) part(board, kit.box(0.012, 1.3, 0.01, 0.004), kit.mat("#f3d9cb", id), gx, 0, 0.045, false);
  for (const gy of [-0.33, 0.33]) part(board, kit.box(1.9, 0.012, 0.01, 0.004), kit.mat("#f3d9cb", id), 0, gy, 0.045, false);

  // The stroke and its anchors. The pen moves anchor to anchor: each segment springs out and is caught.
  const strokeMat = kit.mat(h.accent, id);
  let stroke: THREE.Mesh | null = null;
  let curve: THREE.CatmullRomCurve3 | null = null;
  const anchors = Array.from({ length: 5 }, () => {
    const a = part(board, kit.box(0.1, 0.1, 0.05, 0.015), kit.mat(WHITE, id), 0, 0, 0.07, false);
    a.userData.s = spring(0);
    return a;
  });
  const pen = group(board, 0, 0, 0.1);
  {
    const body = group(pen);
    body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.38, 0.5, 0.78).normalize());
    part(body, kit.cone(0.075, 0.22, 20), kit.mat(h.deep, id), 0, 0.11, 0).rotation.x = Math.PI;
    part(body, kit.cyl(0.075, 0.075, 0.62, 20), kit.mat(INK, id), 0, 0.53, 0);
    part(body, kit.cyl(0.082, 0.082, 0.1, 20), kit.mat(h.accent, id), 0, 0.3, 0);
  }
  let pathIndex = -1, step = 0, stepAt = 0, clock = 0;
  const progress = spring(0);
  const SEG = 96, RAD = 8;
  function draw() {
    pathIndex = (pathIndex + 1) % PATHS.length;
    curve = new THREE.CatmullRomCurve3(PATHS[pathIndex].map(([x, y]) => new THREE.Vector3(x, y, 0.06)), false, "centripetal");
    if (stroke) { stroke.geometry.dispose(); board.remove(stroke); }
    stroke = part(board, new THREE.TubeGeometry(curve, SEG, 0.04, RAD, false), strokeMat, 0, 0, 0, false);
    progress.snap(0);
    step = 0; stepAt = clock;
    anchors.forEach(a => { (a.userData.s as Spring).snap(0); });
    ctx.sound("ui_pop", 0.3 * 4 + SPRING_PEAK);
  }

  // Swatch fan: the stack's five colours, pinned at the base, fanning open in a cascade.
  const fan = prop(root, -1.6, -5.0, FACE, "fan", () => { fanOpen = !fanOpen; fanAt = clock; ctx.sound("ui_click_data", SPRING_PEAK); });
  part(fan.object, kit.cyl(0.16, 0.2, 0.16, 20), kit.mat(INK, id), 0, 0.08, 0);
  const cards = (["design", "frontend", "backend", "data", "delivery"] as StationId[]).map((sid, i) => {
    const pivot = group(fan.object, 0, 0.2, 0.012 * i);
    const card = part(pivot, kit.unit(0.08), kit.mat(HUE[sid].accent, id), 0, 0.66, 0);
    card.scale.set(0.34, 1.3, 0.035);
    part(pivot, kit.box(0.26, 0.26, 0.04, 0.03), kit.mat(WHITE, id), 0, 1.12, 0.02, false);
    return { pivot, a: spring(0) };
  });
  part(fan.object, kit.cyl(0.05, 0.05, 0.12, 12), kit.mat(STEEL, id), 0, 0.2, 0.08).rotation.x = Math.PI / 2;
  let fanOpen = true, fanAt = -1;

  // A type scale: three cards, display to caption. "Set the type" rotates the sizes along the row.
  const type = prop(root, -3.45, -2.95, FACE, "type", () => { typeShift++; typeAt = clock; ctx.sound("ui_pop", 0.14 + SPRING_PEAK); });
  const TYPE = [1, 0.76, 0.58];
  const typeCards = TYPE.map((k0, i) => {
    const card = group(type.object, (i - 1) * 0.5, 0, -i * 0.08);
    part(card, kit.box(0.66, 0.69, 0.06, 0.04), kit.mat(WHITE, id), 0, 0.345, 0);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.53, 0.53), new THREE.MeshBasicMaterial({ map: label(kit, "Aa", { bg: WHITE, fg: INK, w: 128, h: 128, size: 96, weight: 800 }), transparent: true }));
    kit.keep(face.geometry); kit.keep(face.material as THREE.Material);
    face.position.set(0, 0.345, 0.032);
    card.add(face);
    return { card, k: spring(k0) };
  });
  let typeShift = 0, typeAt = -9;

  // A plant that breathes, and bounces when poked.
  const plant = prop(root, -5.0, -1.55, 0, "plant", () => { leafKick.kick(5); ctx.sound("ui_pop", SPRING_PEAK); });
  part(plant.object, kit.cyl(0.3, 0.23, 0.46, 24), kit.mat(h.deep, id), 0, 0.23, 0);
  part(plant.object, kit.cyl(0.27, 0.27, 0.04, 24), kit.mat("#6b4a37", id), 0, 0.45, 0);
  const leaves = group(plant.object, 0, 0.45, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leaf = part(leaves, kit.sphere(0.2, 16), kit.mat(i % 2 ? LEAF : LEAF_DEEP, id), Math.cos(a) * 0.13, 0.36, Math.sin(a) * 0.13);
    leaf.scale.set(0.55, 1.6, 0.32);
    leaf.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * -0.5);
  }
  const leafKick = spring(0);

  tree(ctx, root, id, -1.75, -1.8, 0.9);
  tree(ctx, root, id, -5.15, -4.9, 0.75);

  draw();
  return {
    id, root, hits, props: [easel, fan, type, plant],
    focus: new THREE.Vector3(-3.5, 0.8, -3.5), anchor: new THREE.Vector3(-3.4, 2.7, -3.4),
    spot: { a: DOCK.design, r: 3.62 },
    arrive: draw,
    update(dt, t) {
      clock += dt;
      const still = ctx.still();
      // Pen tool: one anchor every .3 s, the segment to it springs out.
      if (step < 4 && clock - stepAt > 0.3) { step++; stepAt = clock; }
      if (still) { step = 4; progress.snap(1); } else progress.step(step / 4, dt);
      if (stroke && curve) {
        const p = clamp01(progress.value);
        stroke.geometry.setDrawRange(0, Math.floor(p * SEG) * RAD * 6);
        const tip = curve.getPointAt(Math.min(1, Math.max(0, progress.value)));
        pen.position.set(tip.x, tip.y, 0.1 + (still ? 0 : Math.sin(t * 2.2) * 0.012));
        anchors.forEach((a, i) => {
          const s = a.userData.s as Spring;
          const on = i <= step ? 1 : 0;
          if (still) s.snap(on); else s.step(on, dt);
          const pt = curve!.getPointAt(i / 4);
          a.position.set(pt.x, pt.y, 0.07);
          a.scale.setScalar(Math.max(0.0001, popped(s.value)));
          a.rotation.z = Math.PI / 4;
        });
      }
      // Fan: each card a spring; opening cascades from the front card.
      cards.forEach((c, i) => {
        const goal = fanOpen ? (i - 2) * 26 * D : (i - 2) * 1.5 * D;
        const order = fanOpen ? i : 4 - i;
        if (still) c.a.snap(goal); else if (clock - fanAt >= order * 0.07) c.a.step(goal, dt);
        c.pivot.rotation.z = -c.a.value;
      });
      typeCards.forEach((c, i) => {
        const goal = TYPE[(i + typeShift) % 3];
        if (still) c.k.snap(goal); else if (clock - typeAt >= i * 0.07) c.k.step(goal, dt);
        c.card.scale.setScalar(Math.max(0.01, c.k.value));
      });
      leafKick.step(0, dt);
      leaves.rotation.z = (still ? 0 : Math.sin(t * 1.2) * 0.05) + leafKick.value * 0.06;
      leaves.scale.y = 1 + leafKick.value * 0.03;
    },
  };
}

/* =====================================================================================
   FRONTEND — a browser that is really responsive: click it and the window narrows to a
   phone while every block springs into its mobile place. A cursor keeps clicking the call
   to action, an atom orbits on a plinth, component bricks rebuild themselves.
   ===================================================================================== */
type Box = [x: number, y: number, w: number, h: number];
function buildFrontend(ctx: Ctx): Station {
  const { kit } = ctx;
  const id = "frontend", h = HUE.frontend;
  const root = new THREE.Group();
  const hits = district(ctx, root, id, 1, -1);

  const browser = prop(root, 1.75, -4.55, FACE, "browser", () => toggleLayout());
  const win = group(browser.object, 0, 0.25, 0);
  const frameMat = kit.mat(WHITE, id), barMat = kit.mat("#e8ecfb", id);
  // Window parts, so the width can change without stretching the rounded corners.
  const back = part(win, kit.unit(0.04), kit.mat("#f4f6ff", id), 0, 1, -0.04);
  const bar = part(win, kit.unit(0.04), barMat, 0, 1.86, 0);
  const edges = [part(win, kit.unit(0.04), frameMat, 0, 0, 0), part(win, kit.unit(0.04), frameMat, 0, 0, 0)];
  const dots = ["#ff6a4d", "#ffb21e", "#12b39a"].map(c => part(win, kit.sphere(0.045, 12), kit.mat(c, id), 0, 1.86, 0.05, false));
  // Stand.
  part(browser.object, kit.box(0.5, 0.06, 0.4, 0.03), kit.mat(INK, id), 0, 0.03, 0);
  part(browser.object, kit.box(0.1, 0.24, 0.08, 0.03), kit.mat(INK, id), 0, 0.16, -0.02);

  const BLOCKS: { color: string; d: Box; m: Box }[] = [
    { color: "#c9d1f6", d: [0, 1.62, 2.3, 0.14], m: [0, 1.62, 0.92, 0.14] },          // nav
    { color: h.accent, d: [-0.6, 1.08, 1.06, 0.72], m: [0, 1.22, 0.92, 0.5] },         // hero image
    { color: INK, d: [0.55, 1.32, 0.96, 0.12], m: [0, 0.86, 0.86, 0.1] },             // headline
    { color: "#9aa6cf", d: [0.45, 1.13, 0.76, 0.08], m: [0, 0.71, 0.66, 0.07] },      // copy line
    { color: "#ff6a4d", d: [0.33, 0.86, 0.5, 0.15], m: [0, 0.5, 0.6, 0.14] },          // the button
    { color: "#ffffff", d: [-0.76, 0.4, 0.7, 0.42], m: [0, 0.22, 0.86, 0.22] },        // cards
    { color: "#ffffff", d: [0, 0.4, 0.7, 0.42], m: [0, -0.06, 0.86, 0.22] },
    { color: "#ffffff", d: [0.76, 0.4, 0.7, 0.42], m: [0, -0.34, 0.86, 0.22] },
  ];
  const blocks = BLOCKS.map(b => {
    const mesh = part(win, kit.unit(0.06), kit.mat(b.color, id), b.d[0], b.d[1], 0.04, false);
    return { mesh, b, x: spring(b.d[0]), y: spring(b.d[1]), w: spring(b.d[2]), h: spring(b.d[3]) };
  });
  const button = blocks[4].mesh;
  let mobile = false, layoutAt = -1, clock = 0;
  const width = spring(2.6), height = spring(2.0);
  function toggleLayout() { mobile = !mobile; layoutAt = clock; ctx.sound("ui_pop", 0.25 + SPRING_PEAK); }

  // A cursor that keeps finding the call to action and pressing it.
  const cursorShape = new THREE.Shape();
  [[0, 0], [0, -0.42], [0.1, -0.32], [0.17, -0.47], [0.24, -0.44], [0.17, -0.29], [0.3, -0.29]].forEach(([x, y], i) => (i ? cursorShape.lineTo(x, y) : cursorShape.moveTo(x, y)));
  cursorShape.closePath();
  const cursorGeo = kit.custom("cursor", () => new THREE.ExtrudeGeometry(cursorShape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 }));
  const cursor = group(browser.object, 0, 0, 0.42);
  part(cursor, cursorGeo, kit.mat(INK, id), 0, 0, 0);
  const cx = spring(0.8), cy = spring(0.3), press = spring(0), pressed = spring(0);
  let cursorStep = 0, cursorAt = 0;

  // An atom on a plinth: the component model, always orbiting.
  const atom = prop(root, 4.55, -4.45, FACE, "atom", () => { spin.kick(14); ctx.sound("ui_pop", SPRING_PEAK); });
  part(atom.object, kit.cyl(0.42, 0.5, 0.5, 28), kit.mat(INK, id), 0, 0.25, 0);
  part(atom.object, kit.cyl(0.45, 0.45, 0.06, 28), kit.mat(h.accent, id), 0, 0.53, 0);
  const core = group(atom.object, 0, 1.45, 0);
  part(core, kit.sphere(0.17, 22), kit.mat("#ff6a4d", id), 0, 0, 0);
  const orbits = [0, 60, 120].map(deg => {
    const o = group(core);
    o.rotation.set(Math.PI / 2 + 0.25, deg * D, 0);
    const ringGroup = group(o);
    ringGroup.scale.set(1, 0.42, 1);
    part(ringGroup, kit.torus(0.62, 0.022, Math.PI * 2, 72), kit.mat(h.accent, id), 0, 0, 0, false);
    const e = part(o, kit.sphere(0.065, 14), kit.mat(WHITE, id), 0.62, 0, 0, false);
    return { o, e, phase: deg * D * 2 };
  });
  const spin = spring(0);

  // Component bricks: three studded blocks that tumble and rebuild in a new order.
  const bricks = prop(root, 4.95, -1.65, FACE, "bricks", () => rebuild());
  const BRICK = [h.accent, "#ff6a4d", "#ffb21e"];
  const brickParts = BRICK.map(color => {
    const b = group(bricks.object);
    part(b, kit.box(0.7, 0.26, 0.42, 0.05), kit.mat(color, id), 0, 0.13, 0);
    for (const sx of [-0.18, 0.18]) for (const sz of [-0.09, 0.09]) part(b, kit.cyl(0.07, 0.07, 0.07, 14), kit.mat(color, id), sx, 0.29, sz);
    return { b, y: spring(0), r: spring(0) };
  });
  let order = [0, 1, 2], rebuildAt = -1;
  function rebuild() { order = [order[2], order[0], order[1]]; rebuildAt = clock; ctx.sound("ui_click_data", 0.14 + SPRING_PEAK); }

  tree(ctx, root, id, 1.8, -1.75, 0.85);
  tree(ctx, root, id, 2.7, -5.2, 0.7);

  return {
    id, root, hits, props: [browser, atom, bricks],
    focus: new THREE.Vector3(3.4, 0.8, -3.3), anchor: new THREE.Vector3(3.3, 2.9, -3.4),
    spot: { a: DOCK.frontend, r: 3.62 },
    arrive: toggleLayout,
    update(dt, t) {
      clock += dt;
      const still = ctx.still();
      const W = mobile ? 1.16 : 2.6, H = mobile ? 2.1 : 2.0;
      const go = (s: Spring, goal: number, delay = 0) => { if (still) s.snap(goal); else if (clock - layoutAt >= delay) s.step(goal, dt); };
      go(width, W); go(height, H);
      const w = width.value, hh = height.value;
      back.scale.set(w, hh, 0.06); back.position.y = hh / 2;
      bar.scale.set(w, 0.2, 0.08); bar.position.y = hh - 0.1;
      edges[0].scale.set(0.06, hh, 0.1); edges[0].position.set(-w / 2, hh / 2, 0);
      edges[1].scale.set(0.06, hh, 0.1); edges[1].position.set(w / 2, hh / 2, 0);
      dots.forEach((d, i) => d.position.set(-w / 2 + 0.14 + i * 0.12, hh - 0.1, 0.05));
      blocks.forEach((bl, i) => {
        const g = mobile ? bl.b.m : bl.b.d;
        const delay = (mobile ? i : BLOCKS.length - 1 - i) * 0.05;
        go(bl.x, g[0], delay); go(bl.y, g[1] + (hh - 2) * 0.5, delay); go(bl.w, g[2], delay); go(bl.h, g[3], delay);
        bl.mesh.scale.set(Math.max(0.01, bl.w.value), Math.max(0.01, bl.h.value), 0.05);
        bl.mesh.position.set(bl.x.value, bl.y.value, 0.04);
      });
      // Cursor: rests, travels to the button, presses, travels away.
      const target = blocks[4];
      if (!still && clock - cursorAt > 1.5) { cursorStep = (cursorStep + 1) % 2; cursorAt = clock; }
      const tx = cursorStep === 1 ? target.x.value + 0.05 : 0.8, ty = cursorStep === 1 ? target.y.value + 0.02 : 0.3;
      if (still) { cx.snap(tx); cy.snap(ty); } else { cx.step(tx, dt); cy.step(ty, dt); }
      const down = !still && cursorStep === 1 && clock - cursorAt > 0.7 && clock - cursorAt < 0.95 ? 1 : 0;
      press.step(down, dt); pressed.step(down, dt);
      cursor.position.set(cx.value, cy.value, 0.42 - press.value * 0.22);
      button.scale.z = Math.max(0.01, 0.05 * (1 - pressed.value * 0.7));
      button.position.z = 0.04 - pressed.value * 0.015;
      // Atom: electrons orbit; a click kicks the spin, which springs back to its idle speed.
      spin.step(0, dt);
      const speed = still ? 0 : 1.6 + Math.max(0, spin.value) * 1.4;
      orbits.forEach(o => { o.phase += dt * speed; o.e.position.set(Math.cos(o.phase) * 0.62, Math.sin(o.phase) * 0.62 * 0.42, 0); });
      core.rotation.y += dt * (still ? 0 : 0.3 + Math.max(0, spin.value) * 0.5);
      core.position.y = 1.45 + (still ? 0 : Math.sin(t * 1.4) * 0.05);
      // Bricks: lift and tumble out in a cascade, then settle in the new order.
      brickParts.forEach((bp, i) => {
        const slot = order.indexOf(i);
        const lifting = clock - rebuildAt < 0.45 + slot * 0.09;
        const goalY = slot * 0.3 + (lifting && rebuildAt > 0 ? 0.55 + slot * 0.2 : 0);
        const goalR = lifting && rebuildAt > 0 ? (i - 1) * 0.5 : 0;
        if (still) { bp.y.snap(slot * 0.3); bp.r.snap(0); } else if (clock - rebuildAt >= slot * 0.09) { bp.y.step(goalY, dt); bp.r.step(goalR, dt); }
        bp.b.position.y = bp.y.value;
        bp.b.rotation.y = bp.r.value;
      });
    },
  };
}

/* =====================================================================================
   BACKEND — two server racks fed by an API gateway through pipes; requests travel the pipes
   as beads. A padlock (sign-in) opens and shuts with a catch; a pair of gears turns.
   ===================================================================================== */
function gearGeometry(r: number, teeth: number, depth: number) {
  const s = new THREE.Shape();
  const inner = r * 0.8;
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const rr = i % 4 === 1 || i % 4 === 2 ? r : inner;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, r * 0.28, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function buildBackend(ctx: Ctx): Station {
  const { kit } = ctx;
  const id = "backend", h = HUE.backend;
  const root = new THREE.Group();
  const hits = district(ctx, root, id, 1, 1);
  let clock = 0, burstAt = -9;

  // Racks: drive bays with LEDs that answer a request as a wave.
  const leds: { m: THREE.MeshBasicMaterial; rack: number; row: number }[] = [];
  const racks = [[1.45, 5.0], [5.0, 1.45]].map(([x, z], ri) => {
    const r = prop(root, x, z, FACE, "racks", () => burst());
    part(r.object, kit.box(0.95, 2.0, 0.8, 0.08), kit.mat("#2c2556", id), 0, 1.0, 0);
    part(r.object, kit.box(0.99, 0.08, 0.84, 0.03), kit.mat(h.accent, id), 0, 2.0, 0);
    for (let row = 0; row < 6; row++) {
      part(r.object, kit.box(0.78, 0.2, 0.06, 0.03), kit.mat("#463d82", id), 0, 0.32 + row * 0.27, 0.39, false);
      for (let k = 0; k < 3; k++) {
        const m = kit.own("#3ce39b", id, true) as THREE.MeshBasicMaterial;
        part(r.object, kit.sphere(0.028, 10), m, 0.22 + k * 0.08, 0.32 + row * 0.27, 0.43, false);
        leds.push({ m, rack: ri, row: row * 3 + k });
      }
      part(r.object, kit.box(0.3, 0.035, 0.02, 0.01), kit.mat("#8c80d6", id), -0.18, 0.32 + row * 0.27, 0.43, false);
    }
    return r;
  });
  const flash = spring(0);
  function burst() { burstAt = clock; flash.kick(6); gearKick.kick(10); ctx.sound("ui_click_data", SPRING_PEAK); }

  // API gateway: an arch with two routes hanging under it.
  const gateway = prop(root, 3.25, 3.25, FACE, "gateway", () => { swing.kick(9); flash.kick(8); ctx.sound("ui_click_data", SPRING_PEAK); });
  const arch = gateway.object;
  const plates: THREE.Mesh[] = [];
  const swing = spring(0);
  for (const s of [-1, 1]) part(arch, kit.box(0.2, 1.5, 0.2, 0.05), kit.mat(h.side, id), s * 0.62, 0.75, 0);
  part(arch, kit.box(1.6, 0.22, 0.26, 0.06), kit.mat(h.accent, id), 0, 1.55, 0);
  ["GET", "POST"].forEach((t, i) => {
    const plate = part(arch, kit.box(0.5, 0.2, 0.04, 0.03), kit.mat(WHITE, id), (i - 0.5) * 0.6, 1.25, 0.06, false);
    plates.push(plate);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.17), new THREE.MeshBasicMaterial({ map: label(kit, t, { bg: WHITE, fg: h.deep, w: 256, h: 100, size: 64, weight: 800 }), transparent: true }));
    kit.keep(face.geometry); kit.keep(face.material as THREE.Material);
    face.position.z = 0.025;
    plate.add(face);
  });
  // Pipes from the gateway to each rack, with request beads riding them.
  const pipeMat = kit.mat("#b8abf2", id), beadMat = kit.mat(WHITE, id);
  const pipes = [new THREE.Vector3(1.45, 0, 4.5), new THREE.Vector3(4.5, 0, 1.45)].map(end => {
    const start = new THREE.Vector3(3.25, 0, 3.25);
    const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0.35, 0, 0.35));
    const curve = new THREE.CatmullRomCurve3([start.clone().setY(0.14), mid.setY(0.14), end.clone().setY(0.14)]);
    part(root, kit.keep(new THREE.TubeGeometry(curve, 40, 0.07, 10, false)), pipeMat, 0, 0, 0);
    const beads = Array.from({ length: 3 }, (_, i) => ({ mesh: part(root, kit.sphere(0.075, 14), beadMat, 0, 0, 0, false), u: i / 3 }));
    return { curve, beads };
  });

  // The padlock: sign-in. Opens, holds, shuts with a catch.
  const lock = prop(root, 5.1, 3.55, FACE, "lock", () => { openAt = clock; open = true; ctx.sound("ui_pop", SPRING_PEAK); });
  part(lock.object, kit.box(0.7, 0.56, 0.32, 0.1), kit.mat("#ffb21e", id), 0, 0.28, 0);
  part(lock.object, kit.cyl(0.07, 0.07, 0.06, 16), kit.mat(INK, id), 0, 0.33, 0.16).rotation.x = Math.PI / 2;
  part(lock.object, kit.box(0.05, 0.12, 0.04, 0.01), kit.mat(INK, id), 0, 0.24, 0.17);
  const shackle = group(lock.object, 0.2, 0.56, 0);
  part(shackle, kit.torus(0.2, 0.055, Math.PI, 28), kit.mat(STEEL, id), -0.2, 0.18, 0);
  part(shackle, kit.cyl(0.055, 0.055, 0.2, 12), kit.mat(STEEL, id), -0.4, 0.08, 0);
  part(shackle, kit.cyl(0.055, 0.055, 0.2, 12), kit.mat(STEEL, id), 0, 0.08, 0);
  const lift = spring(0), turn = spring(0);
  let open = false, openAt = -9;

  // Gears: always turning, a request kicks them.
  const gears = prop(root, 3.6, 5.15, FACE, "gears", () => { gearKick.kick(12); ctx.sound("ui_click_data", SPRING_PEAK); });
  part(gears.object, kit.box(1.3, 0.14, 0.4, 0.05), kit.mat(INK, id), 0, 0.07, 0);
  const g1 = part(gears.object, kit.custom("gear-a", () => gearGeometry(0.42, 10, 0.14)), kit.mat(h.accent, id), -0.27, 0.6, 0);
  const g2 = part(gears.object, kit.custom("gear-b", () => gearGeometry(0.3, 7, 0.14)), kit.mat("#ff6a4d", id), 0.4, 0.42, 0.02);
  part(gears.object, kit.cyl(0.05, 0.05, 0.52, 10), kit.mat(STEEL, id), -0.27, 0.3, -0.05);
  part(gears.object, kit.cyl(0.05, 0.05, 0.3, 10), kit.mat(STEEL, id), 0.4, 0.2, -0.05);
  const gearKick = spring(0);

  tree(ctx, root, id, 4.95, 4.95, 0.8);
  tree(ctx, root, id, 1.75, 1.85, 0.85);

  return {
    id, root, hits, props: [...racks, gateway, lock, gears],
    focus: new THREE.Vector3(3.3, 0.7, 3.3), anchor: new THREE.Vector3(3.2, 2.6, 3.2),
    spot: { a: DOCK.backend, r: 3.62 },
    arrive: burst,
    update(dt, t) {
      clock += dt;
      const still = ctx.still();
      flash.step(0, dt);
      // LEDs: a soft idle shimmer; a burst sends a wave up both racks.
      leds.forEach(l => {
        const wave = clock - burstAt - l.row * 0.03 - l.rack * 0.08;
        const hit = wave > 0 && wave < 0.35 ? 1 : 0;
        const idle = still ? 0.6 : 0.45 + 0.35 * Math.max(0, Math.sin(t * 3 + l.row * 1.7 + l.rack));
        const v = Math.max(idle, hit);
        l.m.color.setRGB(0.16 + 0.07 * v, 0.45 + 0.44 * v, 0.33 + 0.27 * v).convertSRGBToLinear();
      });
      pipes.forEach(p => p.beads.forEach(b => {
        if (!still) b.u = (b.u + dt * (0.28 + Math.max(0, flash.value) * 0.25)) % 1;
        const pt = p.curve.getPointAt(b.u);
        b.mesh.position.set(pt.x, pt.y + 0.1, pt.z);
        b.mesh.scale.setScalar(Math.sin(b.u * Math.PI) * 1.1 + 0.05);
      }));
      // Padlock: up and round, hold .9 s, back down with a catch.
      if (open && clock - openAt > 1.3) { open = false; ctx.sound("ui_click", SPRING_PEAK); }
      const lg = open ? 1 : 0;
      if (still) { lift.snap(lg); turn.snap(lg); } else { lift.step(lg, dt); if (clock - openAt > (open ? 0.12 : 0)) turn.step(lg, dt); }
      shackle.position.y = 0.56 + lift.value * 0.2;
      shackle.rotation.y = turn.value * Math.PI * 0.9;
      // Gateway: the route plates swing as a request passes under them.
      if (still) swing.snap(0); else swing.step(0, dt);
      plates.forEach((pl, i) => { pl.rotation.x = swing.value * 0.12 * (i ? 1 : -1); });
      gearKick.step(0, dt);
      const gs = still ? 0 : 0.5 + Math.max(0, gearKick.value) * 0.8;
      g1.rotation.z += dt * gs;
      g2.rotation.z -= dt * gs * (10 / 7);
    },
  };
}

/* =====================================================================================
   DATA — a database of three disks that lift apart for a migration, a table being written
   row by row, and a chart that re-sorts when you query it, with a lens that hunts the answer.
   ===================================================================================== */
function buildData(ctx: Ctx): Station {
  const { kit } = ctx;
  const id = "data", h = HUE.data;
  const root = new THREE.Group();
  const hits = district(ctx, root, id, -1, 1);
  let clock = 0;

  const db = prop(root, -4.75, 1.75, FACE, "db", () => migrate());
  const disks = [0, 1, 2].map(i => {
    const d = group(db.object, 0, 0.26 + i * 0.5, 0);
    part(d, kit.cyl(0.78, 0.78, 0.4, 40), kit.mat(i === 2 ? h.accent : h.side, id), 0, 0, 0);
    part(d, kit.cyl(0.8, 0.8, 0.07, 40), kit.mat(WHITE, id), 0, -0.12, 0, false);
    part(d, kit.box(0.22, 0.06, 0.04, 0.02), kit.mat(INK, id), 0.45, 0, 0.62, false).rotation.y = 0.6;
    return { d, y: spring(0), r: spring(0) };
  });
  let migrateAt = -9, turns = 0;
  function migrate() { migrateAt = clock; turns++; ctx.sound("ui_pop", 0.14 + SPRING_PEAK); }

  // A table being written: rows of cells rise in turn, forever.
  const tableProp = prop(root, -4.8, 4.55, FACE, "table", () => { tableAt = clock; ctx.sound("ui_click_data", SPRING_PEAK); });
  const table = tableProp.object;
  let tableAt = -9;
  part(table, kit.box(1.7, 0.12, 1.3, 0.05), kit.mat(h.deep, id), 0, 0.06, 0);
  const cells: THREE.Mesh[] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
    const cell = part(table, kit.box(0.44, 0.1, 0.22, 0.03), kit.mat(r === 0 ? "#ffd166" : WHITE, id), (c - 1) * 0.5, 0.17, (r - 1.5) * 0.28);
    cell.userData.r = r; cell.userData.c = c;
    cells.push(cell);
  }

  // A chart that re-sorts, with a lens hunting the tallest bar.
  const chart = prop(root, -1.75, 4.85, FACE, "chart", () => query());
  part(chart.object, kit.box(2.0, 0.12, 0.6, 0.05), kit.mat(INK, id), 0, 0.06, 0);
  const VALUES = [0.45, 0.9, 0.62, 1.25, 0.75, 1.05];
  let values = VALUES.slice(), sorted = 0, queryAt = -9;
  const bars = VALUES.map((v, i) => {
    const m = part(chart.object, kit.unit(0.08), kit.mat(h.accent, id), (i - 2.5) * 0.3, 0, 0);
    return { m, h: spring(v) };
  });
  const lens = group(chart.object, 0, 1.75, 0.15);
  part(lens, kit.torus(0.2, 0.045, Math.PI * 2, 36), kit.mat(INK, id), 0, 0, 0);
  part(lens, kit.cyl(0.17, 0.17, 0.02, 28), kit.mat("#bff0e6", id), 0, 0, 0, false).rotation.x = Math.PI / 2;
  part(lens, kit.cyl(0.035, 0.035, 0.32, 10), kit.mat(INK, id), 0.2, -0.2, 0).rotation.z = Math.PI / 4;
  const lx = spring(0), ly = spring(1.7);
  function query() {
    sorted = (sorted + 1) % 3;
    values = sorted === 1 ? VALUES.slice().sort((a, b) => a - b) : sorted === 2 ? VALUES.slice().sort((a, b) => b - a) : VALUES.slice();
    queryAt = clock;
    ctx.sound("ui_click_data", 0.35 + SPRING_PEAK);
  }

  // A chain of blocks: every click mines a new one onto the end; the oldest slides out.
  const chain = prop(root, -3.35, 3.0, FACE, "chain", () => { head++; ctx.sound("ui_pop", SPRING_PEAK); });
  const blocks = Array.from({ length: 5 }, (_, i) => {
    const b = group(chain.object);
    part(b, kit.box(0.34, 0.34, 0.34, 0.07), kit.mat(i % 2 ? "#ffb21e" : h.accent, id), 0, 0.17, 0);
    part(b, kit.box(0.36, 0.06, 0.36, 0.02), kit.mat(WHITE, id), 0, 0.3, 0, false);
    return { b, x: spring(0), s: spring(0) };
  });
  for (let k = 0; k < 3; k++) part(chain.object, kit.cyl(0.035, 0.035, 0.18, 10), kit.mat(INK, id), (k - 1) * 0.46, 0.17, 0).rotation.z = Math.PI / 2;
  let head = 0;

  tree(ctx, root, id, -2.4, 1.05, 0.85);
  tree(ctx, root, id, -5.2, 5.1, 0.7);

  return {
    id, root, hits, props: [db, tableProp, chart, chain],
    focus: new THREE.Vector3(-3.3, 0.7, 3.4), anchor: new THREE.Vector3(-3.3, 2.6, 3.4),
    spot: { a: DOCK.data, r: 3.62 },
    arrive: () => { migrate(); query(); },
    update(dt, t) {
      clock += dt;
      const still = ctx.still();
      // Migration: disks lift apart from the top, turn a third, settle back from the bottom.
      disks.forEach((dk, i) => {
        const since = clock - migrateAt;
        const up = since >= 0 && since < 1.1;
        const goalY = up ? (i + 1) * 0.22 : 0;
        const delay = up ? (2 - i) * 0.07 : i * 0.07;
        const turnGoal = turns * (Math.PI * 2 / 3) * (i % 2 ? -1 : 1);
        if (still) { dk.y.snap(0); dk.r.snap(turnGoal); } else if (since >= delay) { dk.y.step(goalY, dt); dk.r.step(turnGoal, dt); }
        dk.d.position.y = 0.26 + i * 0.5 + dk.y.value;
        dk.d.rotation.y = dk.r.value;
      });
      // Table rows rise one after another, a quiet write loop.
      cells.forEach(c => {
        // A click writes a fresh row set: every cell hops once, row by row, over the idle wave.
        const since = clock - tableAt - c.userData.r * 0.09 - c.userData.c * 0.03;
        const hop = since > 0 && since < 0.5 ? Math.sin((since / 0.5) * Math.PI) : 0;
        const phase = still ? 0 : Math.max(0, Math.sin(t * 2.2 - c.userData.r * 0.9 - c.userData.c * 0.25));
        c.position.y = 0.17 + phase * phase * 0.08 + (still ? 0 : hop * 0.22);
      });
      blocks.forEach((bl, i) => {
        const slot = (((i - head) % 5) + 5) % 5;
        const x = (slot - 1.5) * 0.46;
        const on = slot < 4 ? 1 : 0;
        if (slot === 4 && bl.s.value < 0.05) bl.x.snap(x); // the one waiting off the end jumps there unseen
        if (still) { bl.x.snap(x); bl.s.snap(on); } else { bl.x.step(x, dt); bl.s.step(on, dt); }
        bl.b.position.x = bl.x.value;
        bl.b.scale.setScalar(Math.max(0.0001, popped(bl.s.value)));
        bl.b.visible = bl.s.value > 0.002;
      });
      // Bars: each springs to its new height, a cascade from the left.
      let tallest = 0;
      bars.forEach((b, i) => {
        if (values[i] > values[tallest]) tallest = i;
        if (still) b.h.snap(values[i]); else if (clock - queryAt >= i * 0.07) b.h.step(values[i], dt);
        const hv = Math.max(0.02, b.h.value);
        b.m.scale.set(0.22, hv, 0.22);
        b.m.position.y = 0.12 + hv / 2;
      });
      const tx = (tallest - 2.5) * 0.3, ty = values[tallest] + 0.55;
      if (still) { lx.snap(tx); ly.snap(ty); } else if (clock - queryAt > 0.45) { lx.step(tx, dt); ly.step(ty + Math.sin(t * 1.6) * 0.04, dt); }
      lens.position.set(lx.value, ly.value, 0.15);
    },
  };
}

/* =====================================================================================
   DELIVERY — the hub. A rocket on a pad, a launch tower, containers waiting, and three
   checks (build, test, deploy) that light in turn before every launch.
   ===================================================================================== */
export type Delivery = Station & { launch: () => void; busy: () => boolean; hatch: THREE.Vector3 };
function buildDelivery(ctx: Ctx): Delivery {
  const { kit } = ctx;
  const id = "delivery", h = HUE.delivery;
  const root = new THREE.Group();
  const side = part(root, kit.cyl(1.98, 2.02, 0.72, 64), kit.mat(h.side, id), 0, -0.1, 0, false);
  const top = part(root, kit.cyl(1.92, 1.92, 0.12, 64), kit.mat(h.top, id), 0, 0.26, 0, false);
  part(root, kit.cyl(0.66, 0.66, 0.03, 40), kit.mat("#3a3550", id), 0, 0.33, 0, false);
  const ringPad = part(root, kit.torus(1.15, 0.035, Math.PI * 2, 80), kit.mat(h.deep, id), 0, 0.33, 0, false);
  ringPad.rotation.x = Math.PI / 2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const dash = part(root, kit.box(0.18, 0.025, 0.07, 0.01), kit.mat(INK, id), Math.cos(a) * 1.62, 0.33, Math.sin(a) * 1.62, false);
    dash.rotation.y = -a;
  }

  const rocketProp = prop(root, 0, 0, FACE, "rocket", () => launch());
  const rocket = group(rocketProp.object, 0, 0.33, 0);
  const body = group(rocket);
  const profile = [[0, 0], [0.33, 0], [0.4, 0.14], [0.43, 0.5], [0.41, 0.92], [0.33, 1.24], [0.2, 1.46], [0.07, 1.58], [0, 1.6]].map(([x, y]) => new THREE.Vector2(x, y));
  part(body, kit.custom("rocket", () => new THREE.LatheGeometry(profile, 40)), kit.mat(CREAM, id), 0, 0.12, 0);
  part(body, kit.cyl(0.436, 0.436, 0.14, 40), kit.mat("#ff6a4d", id), 0, 0.5, 0, false);
  part(body, kit.cyl(0.2, 0.27, 0.16, 24), kit.mat("#4a5373", id), 0, 0.06, 0);
  const port = group(body, 0, 1.0, 0, FACE);
  part(port, kit.torus(0.13, 0.035, Math.PI * 2, 28), kit.mat(INK, id), 0, 0, 0.39, false);
  const glass = part(port, kit.sphere(0.11, 18), kit.mat("#8fb2ff", id), 0, 0, 0.37, false);
  glass.scale.z = 0.5;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + FACE;
    const fin = group(body, 0, 0, 0, a);
    part(fin, kit.box(0.07, 0.5, 0.36, 0.03), kit.mat("#ff6a4d", id), 0, 0.3, 0.46);
  }
  const ry = spring(0), sq = spring(0);

  // Exhaust: a small pool of puffs, reused.
  const puffMat = kit.mat(WHITE, id);
  const puffs = Array.from({ length: 12 }, () => ({ mesh: part(root, kit.sphere(0.2, 16), puffMat, 0, -5, 0, false), s: spring(0), born: -9, vx: 0, vz: 0 }));
  let puffIndex = 0;

  // Launch tower with an arm that swings clear.
  const tower = group(root, 0.92, 0.32, -0.92, -FACE);
  const steel = kit.mat("#566079", id);
  part(tower, kit.box(0.16, 2.1, 0.16, 0.03), steel, 0, 1.05, 0);
  for (let i = 0; i < 6; i++) {
    const brace = part(tower, kit.box(0.2, 0.05, 0.2, 0.02), kit.mat(h.accent, id), 0, 0.2 + i * 0.36, 0, false);
    brace.rotation.y = i % 2 ? 0.4 : -0.4;
  }
  const arm = group(tower, 0, 1.25, 0);
  part(arm, kit.box(0.58, 0.07, 0.08, 0.02), steel, -0.33, 0, 0);
  const armR = spring(0);

  // Checks: build, test, deploy.
  const checks = prop(root, 0, 0, 0, "checks", () => { if (!busy()) { checkAt = clock; ctx.sound("ui_click_data", 0.7 + SPRING_PEAK); } });
  let checkAt = -99;
  const lamps = [15, 45, 75].map((deg, i) => {
    const a = deg * D;
    const g = group(checks.object, Math.cos(a) * 1.55, 0.32, Math.sin(a) * 1.55);
    part(g, kit.cyl(0.035, 0.045, 0.5, 10), kit.mat(STEEL, id), 0, 0.25, 0);
    const m = kit.own("#c9cfdb", id, true) as THREE.MeshBasicMaterial;
    const bulb = part(g, kit.sphere(0.11, 18), m, 0, 0.58, 0, false);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.15), new THREE.MeshBasicMaterial({ map: label(kit, ["build", "test", "deploy"][i], { bg: INK, fg: WHITE, w: 256, h: 90, size: 52, weight: 700 }), transparent: true }));
    kit.keep(tag.geometry); kit.keep(tag.material as THREE.Material);
    tag.position.set(0, 0.84, 0);
    tag.rotation.y = FACE;
    g.add(tag);
    return { m, bulb, s: spring(1), on: false };
  });

  // Containers waiting their turn.
  const containers = prop(root, -1.0, -1.0, FACE, "containers", () => { packAt = clock; ctx.sound("ui_pop", 0.14 + SPRING_PEAK); });
  const yard = group(containers.object, 0, 0.32, 0);
  let packAt = -9;
  const boxes: { box: THREE.Group; base: number; y: Spring }[] = [];
  [["#3552ff", 0, 0.2, 0], ["#12b39a", 0, 0.62, 0.03], ["#ff6a4d", 0.02, 0.2, -0.5]].forEach(([c, x, y, z]) => {
    const box = group(yard, x as number, y as number, z as number);
    boxes.push({ box, base: y as number, y: spring(0) });
    part(box, kit.box(0.92, 0.4, 0.42, 0.04), kit.mat(c as string, id), 0, 0, 0);
    for (let k = -3; k <= 3; k++) part(box, kit.box(0.035, 0.34, 0.44, 0.01), kit.mat(c as string, id), k * 0.12, 0, 0, false);
  });

  let clock = 0, launchAt = -99;
  const busy = () => clock - launchAt < 6.2;
  function launch() {
    if (busy()) return;
    launchAt = clock;
    ctx.sound("ui_click_data", 0.05 + SPRING_PEAK);
    ctx.sound("ui_big_click", 1.55 + SPRING_PEAK);
  }

  return {
    id, root, hits: [side, top], props: [rocketProp, checks, containers],
    focus: new THREE.Vector3(0, 1.0, 0), anchor: new THREE.Vector3(0, 2.6, 0),
    spot: { a: 110 * D, r: 1.38 },
    hatch: new THREE.Vector3(0, 0.62, 0),
    arrive: launch, launch, busy,
    update(dt) {
      clock += dt;
      const still = ctx.still();
      const since = clock - launchAt;
      // Checks light at 0, .35, .7 s; each bulb pops as it turns green. They go grey after landing.
      lamps.forEach((l, i) => {
        const run = clock - checkAt;
        const on = (since >= i * 0.35 && since < 5.8) || (run >= i * 0.35 && run < 2.6);
        if (on !== l.on) { l.on = on; if (on && !still) l.s.snap(0.25); }
        l.s.step(1, dt);
        l.bulb.scale.setScalar(popped(l.s.value));
        l.m.color.set(on ? "#36d399" : "#c9cfdb").convertSRGBToLinear();
      });
      // Containers: lifted in turn and set back down, as if loaded for the trip.
      boxes.forEach((bx, i) => {
        const run = clock - packAt - i * 0.09;
        const goal = run >= 0 && run < 0.42 ? 0.45 : 0;
        if (still) bx.y.snap(0); else bx.y.step(goal, dt);
        bx.box.position.y = bx.base + Math.max(0, bx.y.value);
      });
      // Arm swings clear at .9 s and back after landing.
      const armGoal = since >= 0.9 && since < 5.6 ? -1.25 : 0;
      if (still) armR.snap(armGoal); else armR.step(armGoal, dt);
      arm.rotation.y = armR.value;
      // Anticipation squash at 1.2 s, lift-off at 1.55 s, gone above the frame, back down at 3.7 s.
      const squash = since >= 1.2 && since < 1.55 ? -0.14 : 0;
      const yGoal = since >= 1.55 && since < 3.7 ? 16 : 0;
      if (since >= 3.7 && since < 3.75 && ry.value > 10) ry.snap(9);
      if (still) { ry.snap(0); sq.snap(0); } else { ry.step(yGoal, dt); sq.step(squash, dt); }
      const landing = Math.min(0, ry.value);
      rocket.position.y = 0.33 + Math.max(0, ry.value);
      body.scale.set(1 - (sq.value + landing * 0.35) * 0.5, 1 + sq.value + landing * 0.35, 1 - (sq.value + landing * 0.35) * 0.5);
      // Exhaust puffs while climbing.
      if (!still && since >= 1.45 && since < 2.4 && Math.floor(since / 0.07) !== Math.floor((since - dt) / 0.07)) {
        const p = puffs[puffIndex++ % puffs.length];
        p.born = clock; p.s.snap(0.2);
        p.vx = (Math.random() - 0.5) * 1.6; p.vz = (Math.random() - 0.5) * 1.6;
        p.mesh.position.set(0, rocket.position.y + 0.05, 0);
      }
      puffs.forEach(p => {
        const age = clock - p.born;
        p.s.step(age < 0.5 ? 1.25 : 0, dt);
        p.mesh.scale.setScalar(Math.max(0.0001, p.s.value));
        if (age < 2) { p.mesh.position.x += p.vx * dt * 0.6; p.mesh.position.z += p.vz * dt * 0.6; p.mesh.position.y = Math.max(0.42, p.mesh.position.y - dt * 0.4); }
        p.mesh.visible = p.s.value > 0.002;
      });
    },
  };
}

export function buildStations(ctx: Ctx) {
  const delivery = buildDelivery(ctx);
  return { list: [buildDesign(ctx), buildFrontend(ctx), buildBackend(ctx), buildData(ctx), delivery] as Station[], delivery };
}
