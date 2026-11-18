import * as THREE from "three";
import { createSpring, springCurve } from "./motion-curve";
import { createRipples, loadStudio, popped } from "./studio-kit";

/*
Station 03, Building the System: "Will it hold together as it grows?"
Built in Blender (design/journey/system-foundry.blend → public/models/journey/system-foundry.glb).

A clean production cell. The idea cube docks at the intake; a laser ring descends and cuts it into
the system's three layers: Data, API, Interface. Each layer is pushed onto an independent mover,
indexes into the QA tunnel (light curtains flash, the raw gold comes out finished: tested
interfaces), and stops at the end of the line. A cobot picks it with a suction plate and stacks it
on a precision fixture: data first, then API, then interface. Then two feature modules come down
the same line and the arm slots them into the interface's sockets. Two sockets stay open: room to
grow. Behind the line the documentation wall lights one row of the schema per layer placed.

MOTION SCORE (all values spring on the shared curve; times are seconds after arrival)
| t (s)           | Element            | Pattern | Goal                                          |
|-----------------|--------------------|---------|-----------------------------------------------|
| 0 → .9          | laser ring         | P12     | descends through the cube, then parks on top   |
| .55             | cut                | P12     | the three layers part (gaps open)             |
| 1.2 + 3.1·i     | item i             | P12     | pushed from the intake onto its mover         |
| +.7, +1.4       | item i             | P12     | indexes into the QA tunnel, then to the end   |
| +1.95           | robot              | IK      | dips, grips, lifts (1.1 s of curve)           |
| +2.8            | robot              | IK      | swings and sets it; overshoot = press (1.85 s) |
| +4.25           | robot              | IK      | rises and swings back above the line (1.4 s)  |
| on seat         | schema row/feature | P3      | pops on the documentation wall                |
| .55             | sparks             | P13     | fly off both seams as the laser cuts          |
| grip, seat      | ring               | P3      | spreads from the plate / the fixture          |
| after the run   | stack pulse        | P16     | a ring climbs the system every 2.6 s          |
The robot's tool follows each leg's path by one spring; joints come from exact inverse kinematics,
so the suction plate always points straight down. Sound: the station's arrival pop only.
Reduced motion: the finished system is shown at once. Scrolling back past station 02 resets it.
*/

const MODEL = "/models/journey/system-foundry.glb?v=2";
const SCALE = 1.3;
const TICK = 3.1;
/**
 * The robot's legs run on the shared spring curve, stretched in time (as CSS does with
 * --ease-spring) so a cobot moves at a calm, readable pace: dip, swing, return.
 */
const DIP = { at: 0, dur: 1.1 }, CARRY = { at: .85, dur: 1.85 }, BACK = { at: 2.3, dur: 1.4 };
const leg = (clock: number, start: number, l: { at: number; dur: number }) =>
  clock <= start + l.at ? 0 : springCurve(Math.min(1, (clock - start - l.at) / l.dur));
const ANIMATED = /^(Parts|Robot_Turret|Scanner_Ring|Test_Light|Doc_Row_\d|Doc_Feature_\d)/;
const LAYERS = ["Data", "API", "UI"] as const;
const FEATURE_SOCKETS = [1, 4];
const UP = new THREE.Vector3(0, 1, 0);

const SPARKS = 48;
type Spring = ReturnType<typeof createSpring>;
type Item = {
  obj: THREE.Object3D; half: number; layer: number; raw?: THREE.Object3D; done?: THREE.Object3D;
  load: number; pick: number; target: THREE.Vector3;
  transfer: Spring; belt: Spring; appear: Spring;
  from: THREE.Vector3; finished: boolean; enteredGate: boolean; exitedGate: boolean; gripped: boolean; seated: boolean;
};

export function createSystemFoundry(root: THREE.Group) {
  const holder = new THREE.Group();
  holder.name = "System foundry";
  holder.scale.setScalar(SCALE);
  root.add(holder);
  const disposables: { dispose(): void }[] = [];
  let built = false, clock = 0, running = false, finishedAt = Infinity;

  const items: Item[] = [];
  const pops: { obj: THREE.Object3D; at: () => number; s: Spring }[] = [];
  const ring = createSpring(0), cut = createSpring(0), flash = createSpring(0);
  const dock = new THREE.Vector3(), P0 = new THREE.Vector3(), P1 = new THREE.Vector3(), P2 = new THREE.Vector3(), hover = new THREE.Vector3();
  let ringNode: THREE.Object3D | undefined, ringTop = 0, ringBottom = 0;
  let laser: THREE.MeshStandardMaterial | undefined, test: THREE.MeshStandardMaterial | undefined;
  let robot: THREE.Object3D | undefined, turret: THREE.Object3D | undefined, shoulder: THREE.Object3D | undefined;
  let elbow: THREE.Object3D | undefined, wrist: THREE.Object3D | undefined, tool: THREE.Object3D | undefined;
  let SH = 0, L1 = 0, L2 = 0, TOOL = 0;
  const ripples = createRipples(holder, "#0ea5e9", 4);
  disposables.push(ripples);
  // Sparks: one burst when the laser parts the cube. Ballistic, gone in under a second.
  let sparks: THREE.InstancedMesh | undefined, sparked = false, pulseAt = 0, halfW = .5;
  const spark = Array.from({ length: SPARKS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), age: 1, life: 1 }));

  const ready = loadStudio(holder, MODEL, ANIMATED).then(kit => {
    disposables.push(...kit.disposables);
    const at = (name: string) => { const o = kit.find(name); return o ? kit.local(o).p : new THREE.Vector3(); };
    dock.copy(at("Intake_Dock"));
    P0.copy(at("Belt_Start")); P2.copy(at("Belt_Pick"));
    P1.set(at("Test_Gate").x, P0.y, P0.z);
    const base = at("Fixture_Base");

    // Lights that respond: one material for the laser, one for the QA tunnel.
    const claim = (prefix: string) => {
      let shared: THREE.MeshStandardMaterial | undefined;
      kit.scene.traverse(o => {
        if (!(o instanceof THREE.Mesh) || !o.name.startsWith(prefix)) return;
        shared ??= (o.material as THREE.MeshStandardMaterial).clone();
        o.material = shared;
      });
      if (shared) disposables.push(shared);
      return shared;
    };
    laser = claim("Scanner_Laser"); test = claim("Test_Light");

    ringNode = kit.find("Scanner_Ring");
    if (ringNode) { ringTop = ringNode.position.y; ringBottom = dock.y - 1.75; }

    robot = kit.find("Robot"); turret = kit.find("Robot_Turret"); shoulder = kit.find("Robot_Shoulder");
    elbow = kit.find("Robot_Elbow"); wrist = kit.find("Robot_Wrist"); tool = kit.find("Robot_Tool");
    if (turret && shoulder && elbow && wrist && tool) { SH = turret.position.y + shoulder.position.y; L1 = elbow.position.y; L2 = wrist.position.y; TOOL = tool.position.y; }

    // The system's parts. Layers start as the idea cube; features are cloned from one module.
    const parts = kit.find("Parts");
    const ui = kit.find("Layer_UI");
    const make = (obj: THREE.Object3D, half: number, layer: number, i: number, target: THREE.Vector3): Item => {
      // Find its raw and finished forms first: once moved, the part is no longer under the model.
      const raw = obj.getObjectByName(`${obj.name}_raw`), done = obj.getObjectByName(`${obj.name}_done`);
      holder.attach(obj);
      obj.quaternion.identity(); obj.scale.setScalar(1);
      const load = 1.2 + i * TICK;
      return { obj, half, layer, raw, done, load, pick: load + 1.95, target,
        transfer: createSpring(0), belt: createSpring(0), appear: createSpring(layer >= 0 ? 1 : 0),
        from: new THREE.Vector3(), finished: false, enteredGate: false, exitedGate: false, gripped: false, seated: false };
    };
    LAYERS.forEach((name, k) => {
      const obj = kit.find(`Layer_${name}`);
      if (!obj) return;
      items.push(make(obj, .5, k, k, base.clone().add(new THREE.Vector3(0, .5 + k * 1.02, 0))));
    });
    const feature = kit.find("Feature");
    if (feature && ui) {
      FEATURE_SOCKETS.forEach((socket, j) => {
        const node = kit.find(`UI_Socket_${socket}`);
        const offset = node ? node.position.clone() : new THREE.Vector3();
        const target = base.clone().add(new THREE.Vector3(0, .5 + 2 * 1.02, 0)).add(offset).add(new THREE.Vector3(0, .36 - .12, 0));
        const obj = j === 0 ? feature : feature.clone(true);
        items.push(make(obj, .36, -1, 3 + j, target));
      });
    }
    parts?.removeFromParent();
    // The layers' half width in the holder's space: sparks and rings are sized from it.
    const first = items.find(item => item.layer >= 0);
    if (first) { const box = new THREE.Box3().setFromObject(first.obj); halfW = (box.max.x - box.min.x) / 2 / SCALE; }
    const sparkGeometry = new THREE.BoxGeometry(.15, .15, .15);
    const sparkMaterial = new THREE.MeshBasicMaterial({ color: "#7dd3fc", toneMapped: false });
    sparks = new THREE.InstancedMesh(sparkGeometry, sparkMaterial, SPARKS);
    sparks.frustumCulled = false; sparks.visible = false;
    holder.add(sparks); disposables.push(sparkGeometry, sparkMaterial, sparks);
    hover.copy(P2).add(new THREE.Vector3(0, 2 + 1.7, 0));
    if (robot) baseAt.copy(kit.local(robot).p);

    // The schema behind the line lights one row per layer seated, then one mark per feature.
    items.forEach((item, i) => {
      const name = item.layer >= 0 ? `Doc_Row_${item.layer + 1}` : `Doc_Feature_${i - 2}`;
      const obj = kit.find(name);
      if (obj) pops.push({ obj, at: () => item.pick + BACK.at, s: createSpring(0) });
    });
    for (const k of [3, 4]) { const obj = kit.find(`Doc_Feature_${k}`); if (obj) obj.scale.setScalar(.0001); }
    finishedAt = Math.max(...items.map(item => item.pick)) + BACK.at + BACK.dur;
    built = true;
    reset();
    apply(0, true);
  }).catch(error => console.error("System foundry:", error));

  function reset() {
    clock = 0; running = false; sparked = false; pulseAt = 0;
    ring.snap(0); cut.snap(0); flash.snap(0);
    for (const item of items) {
      for (const s of [item.transfer, item.belt]) s.snap(0);
      item.appear.snap(item.layer >= 0 ? 1 : 0);
      item.finished = item.enteredGate = item.exitedGate = item.gripped = item.seated = false;
      if (item.raw) item.raw.visible = true;
      if (item.done) item.done.visible = false;
    }
    for (const p of pops) p.s.snap(0);
  }

  // --- paths ---
  // A robot does not cut across its own base: it swings. Carry and return legs therefore blend
  // angle around the base, reach and height separately, then drop or rise straight.
  type Path = { getPoint(u: number): THREE.Vector3 };
  const baseAt = new THREE.Vector3();
  const swing = (a: THREE.Vector3, b: THREE.Vector3, u: number, out: THREE.Vector3) => {
    const pa = Math.atan2(a.x - baseAt.x, a.z - baseAt.z), pb = Math.atan2(b.x - baseAt.x, b.z - baseAt.z);
    let dp = pb - pa; if (dp > Math.PI) dp -= Math.PI * 2; if (dp < -Math.PI) dp += Math.PI * 2;
    const ra = Math.hypot(a.x - baseAt.x, a.z - baseAt.z), rb = Math.hypot(b.x - baseAt.x, b.z - baseAt.z);
    const p = pa + dp * u, r = THREE.MathUtils.lerp(ra, rb, u);
    return out.set(baseAt.x + Math.sin(p) * r, THREE.MathUtils.lerp(a.y, b.y, u), baseAt.z + Math.cos(p) * r);
  };
  const legs = new Map<Item, Path[]>();
  function pathsFor(item: Item): Path[] {
    let p = legs.get(item);
    if (p) return p;
    const pickTop = P2.clone().add(new THREE.Vector3(0, item.half * 2, 0));
    const targetTop = item.target.clone().add(new THREE.Vector3(0, item.half, 0));
    const lift = pickTop.clone().add(new THREE.Vector3(0, 2.5, 0));
    const above = targetTop.clone().add(new THREE.Vector3(0, 1.7, 0));
    const rise = targetTop.clone().add(new THREE.Vector3(0, 1.7, 0));
    const dip = new THREE.CatmullRomCurve3([hover, pickTop, lift], false, "centripetal");
    const out = new THREE.Vector3();
    p = [
      // Dip onto the part, grip on the way through, and lift it clear of the line.
      dip,
      // Swing to the fixture at height, then set it straight down onto the stack.
      { getPoint: u => u <= .72 ? swing(lift, above, u / .72, out) : out.lerpVectors(above, targetTop, (u - .72) / .28) },
      // Rise straight off the part, then swing back above the line.
      { getPoint: u => u <= .25 ? out.lerpVectors(targetTop, rise, u / .25) : swing(rise, hover, (u - .25) / .75, out) },
    ];
    legs.set(item, p);
    return p;
  }
  const beltX = (index: number) => index <= 1 ? THREE.MathUtils.lerp(P0.x, P1.x, index) : THREE.MathUtils.lerp(P1.x, P2.x, index - 1);
  /** Where the next unloaded layer waits: the magazine closes up as layers leave. */
  const dockPosition = (item: Item, loaded: number) => {
    const gap = .32 * Math.max(0, cut.value);
    return dock.clone().add(new THREE.Vector3(0, -1 + (item.layer - loaded) * (1 + gap), 0));
  };

  // --- inverse kinematics: turret yaw, two-link arm, wrist keeps the plate facing down ---
  const local = new THREE.Vector3(), world = new THREE.Vector3();
  function reach(target: THREE.Vector3) {
    if (!robot || !turret || !shoulder || !elbow || !wrist) return;
    robot.worldToLocal(holder.localToWorld(local.copy(target)));
    const psi = Math.atan2(local.x, local.z);
    const r = Math.hypot(local.x, local.z), v = local.y + TOOL - SH;
    const d = THREE.MathUtils.clamp(Math.hypot(r, v), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
    const a = Math.atan2(r, v);
    const b = Math.acos(THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const e = Math.PI - Math.acos(THREE.MathUtils.clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
    turret.rotation.set(0, psi, 0);
    shoulder.rotation.set(a - b, 0, 0);
    elbow.rotation.set(e, 0, 0);
    wrist.rotation.set(Math.PI - (a - b) - e, 0, 0);
  }

  const toolAt = new THREE.Vector3(), tmp = new THREE.Vector3();
  function apply(dt: number, reduced: boolean) {
    const loaded = items.filter(item => item.layer >= 0 && clock >= item.load).length;
    // Laser ring and the cut.
    if (ringNode) ringNode.position.y = THREE.MathUtils.lerp(ringTop, ringBottom, ring.value);
    if (laser) laser.emissiveIntensity = 2.2 + Math.min(5, Math.abs(ring.velocity) * 2.5);
    if (test) test.emissiveIntensity = 2.2 + Math.max(0, flash.value) * 6;

    // Robot: the item it is handling decides the leg; the tool follows that leg's path.
    let active: Item | undefined;
    for (const item of items) if (clock >= item.pick) active = item;
    let carrying: Item | undefined;
    if (!active) toolAt.copy(hover);
    else {
      const [p1, p2, p3] = pathsFor(active);
      if (clock >= active.pick + BACK.at) toolAt.copy(p3.getPoint(THREE.MathUtils.clamp(leg(clock, active.pick, BACK), 0, 1)));
      else if (clock >= active.pick + CARRY.at) {
        const u = leg(clock, active.pick, CARRY);
        toolAt.copy(p2.getPoint(THREE.MathUtils.clamp(u, 0, 1)));
        // The overshoot of the same curve seats the part: a short press, then it settles.
        toolAt.y -= Math.max(0, u - 1) * 1.3;
        carrying = active;
        // Seated: the overshoot presses it home and a ring runs out over the fixture.
        if (u >= 1 && !active.seated) {
          active.seated = true;
          if (!reduced) ripples.emit(tmp.copy(active.target).addScaledVector(UP, -active.half + .02), (active.layer >= 0 ? halfW : active.half) * 1.7, { life: 1 });
        }
      } else {
        const u = leg(clock, active.pick, DIP);
        toolAt.copy(p1.getPoint(THREE.MathUtils.clamp(u, 0, 1)));
        if (u >= .45) {
          carrying = active;
          // The suction takes hold: a small ring around the plate.
          if (!active.gripped) { active.gripped = true; if (!reduced) ripples.emit(tmp.copy(P2).addScaledVector(UP, active.half * 2 + .03), (active.layer >= 0 ? halfW : active.half) * 1.15, { life: .6, strength: .8 }); }
        }
      }
    }
    reach(toolAt);
    if (tool) { robot?.updateMatrixWorld(true); holder.worldToLocal(tool.getWorldPosition(world)); toolAt.copy(world); }

    for (const item of items) {
      const o = item.obj;
      if (carrying === item) {
        o.position.copy(toolAt).addScaledVector(UP, -item.half);
      } else if (clock >= item.pick + BACK.at) {
        o.position.copy(item.target);
      } else if (clock >= item.load || item.layer < 0) {
        // On its mover: pushed out of the intake, then indexed along the line.
        if (item.layer >= 0) {
          const c = THREE.MathUtils.clamp(item.transfer.value, 0, 1);
          const start = item.from, end = tmp.copy(P0).addScaledVector(UP, item.half);
          o.position.lerpVectors(start, end, c).addScaledVector(UP, Math.sin(Math.PI * c) * .9);
        } else o.position.copy(P0).addScaledVector(UP, item.half);
        o.position.x += beltX(item.belt.value) - P0.x;
      } else {
        o.position.copy(dockPosition(item, loaded));
        item.from.copy(o.position);
      }
      const s = item.layer >= 0 ? 1 : popped(item.appear.value, 2.5);
      o.scale.setScalar(Math.max(.0001, s));
      o.visible = s > .002;
      // Inside the tunnel, out of sight, the raw gold becomes the finished part.
      const b = item.belt.value;
      if (!item.enteredGate && b > .25) { item.enteredGate = true; if (!reduced) flash.kick(9); }
      if (!item.finished && b > .7) { item.finished = true; if (item.raw) item.raw.visible = false; if (item.done) item.done.visible = true; }
      if (!item.exitedGate && b > 1.3) { item.exitedGate = true; if (!reduced) flash.kick(9); }
    }
    for (const p of pops) { const v = popped(p.s.value, 2.5); p.obj.scale.setScalar(Math.max(.0001, v)); p.obj.visible = v > .002; }
    void dt;
  }

  const sm = new THREE.Matrix4(), sq = new THREE.Quaternion(), ss = new THREE.Vector3();
  function burst() {
    // Both seams of the cube, all the way round: sparks leave the cut outward and up.
    spark.forEach((sp, i) => {
      const seam = i % 2 ? .5 : -.5, side = Math.floor(Math.random() * 4), t = Math.random() * 2 - 1;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]][side];
      sp.p.set(dock.x + (n[0] ? n[0] * halfW : t * halfW), dock.y + seam, dock.z + (n[1] ? n[1] * halfW : t * halfW));
      sp.v.set(n[0] * (1.6 + Math.random() * 2.6) + (Math.random() - .5), 1 + Math.random() * 2.4, n[1] * (1.6 + Math.random() * 2.6) + (Math.random() - .5));
      sp.age = 0; sp.life = .6 + Math.random() * .5;
    });
  }
  /** What keeps moving after the run: rings, sparks, and a pulse climbing the finished stack. */
  function live(dt: number, reduced: boolean) {
    ripples.step(dt);
    if (sparks) {
      let any = false;
      spark.forEach((sp, i) => {
        if (sp.age >= sp.life) { sparks!.setMatrixAt(i, sm.makeScale(0, 0, 0)); return; }
        sp.age += dt; any = true;
        sp.v.y -= 9.8 * dt; sp.p.addScaledVector(sp.v, dt);
        // Stretched along its flight, shrinking as it cools.
        const k = Math.max(0, 1 - sp.age / sp.life);
        sq.setFromUnitVectors(UP, tmp.copy(sp.v).normalize());
        sparks!.setMatrixAt(i, sm.compose(sp.p, sq, ss.set(k, k * (1 + sp.v.length() * .5), k)));
      });
      sparks.visible = any;
      if (any) sparks.instanceMatrix.needsUpdate = true;
    }
    const done = items.filter(item => item.layer >= 0);
    if (!reduced && running && clock > finishedAt && done.length && clock - pulseAt > 2.6) {
      pulseAt = clock;
      const bottom = done[0].target.clone().addScaledVector(UP, -done[0].half);
      // The light rises through data, API and interface: the layers working as one.
      ripples.emit(bottom, halfW * 1.22, { life: 1.6, rise: 2.1, steady: true });
    }
  }

  return {
    ready,
    /**
     * order: the camera has reached the station; production runs.
     * far: the visitor is back at station 02 or before; the cell quietly resets.
     */
    update(order: boolean, far: boolean, dt: number, reduced: boolean, time: number) {
      if (!built) return;
      if (far && clock > 0) { reset(); apply(0, true); }
      if (order && !running) running = true;
      if (!order) running = false;
      if (reduced && running) clock = Math.max(clock, finishedAt + 1);
      else if (running) clock += dt;
      if (running && clock > .55 && !sparked) { sparked = true; if (!reduced) burst(); }
      live(dt, reduced);
      if (running && clock > finishedAt + 1.5 && !reduced) return;

      const step = (s: Spring, goal: number) => { if (reduced) s.snap(goal); else s.step(goal, dt); };
      step(ring, clock > 0 && clock < .9 ? 1 : 0);
      step(cut, clock > .55 ? 1 : 0);
      if (reduced) flash.snap(0); else flash.step(0, dt);
      for (const item of items) {
        step(item.transfer, clock >= item.load ? 1 : 0);
        step(item.appear, item.layer >= 0 || clock >= item.load ? 1 : 0);
        step(item.belt, clock >= item.load + 1.4 ? 2 : clock >= item.load + .7 ? 1 : 0);
      }
      for (const p of pops) step(p.s, clock >= p.at() ? 1 : 0);
      apply(dt, reduced);
      // Before production the idea floats in its dock, as it does at every station.
      if (clock === 0) for (const item of items) if (item.layer >= 0) item.obj.position.y += Math.sin(time * 1.15) * .08;
    },
    dispose() { holder.removeFromParent(); disposables.forEach(d => d.dispose()); },
  };
}
