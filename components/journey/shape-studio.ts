import * as THREE from "three";
import { createSpring, springCurve } from "./motion-curve";
import { createRipples, createStage, loadStudio, popped, type Staged } from "./studio-kit";
import { createIdeaCradle } from "./idea-cradle";
import { STATIONS } from "./data";

/*
Station 02, Taking Shape: "What if I only see it once it's built?"
Built in Blender (design/journey/shape-studio.blend → public/models/journey/shape-studio.glb).

The idea arrives as a cube: six panels with a gold glow inside, held in its cradle. Here it takes
shape, and it opens the way a box does: it stops turning and squares up, its four sides hinge
down flat on their edges and the lid folds out past the back, so the cube lies open as its own
net, a cross of six screens facing up: the whole product at a glance (onboarding, sign-up, home,
detail, checkout, success). Then each panel lifts off the net and lands on its stand. Links draw themselves from each screen's button to the next screen,
the way a prototype is wired, and a cursor then clicks through the flow, screen after screen.
Beside it, the design system the screens are made from, and three versions of one screen
(changes are cheap here).

MOTION SCORE (goal changes on arrival; every value springs on the shared curve)
| Element          | Pattern | Goal                                   | Delay (s)        |
|------------------|---------|----------------------------------------|------------------|
| folded cube      | P16     | slow turn while it is still an idea    | –                |
| squaring up      | P12     | the turn settles to the nearest quarter | 0               |
| four sides       | P12     | hinge 90° on their bottom edge (flop =  | .3, +.06        |
|                  |         | the spring's overshoot)                 |                 |
| lid              | P12     | hinges 90° off the back, rides with it  | .8              |
| idea core        | P3      | shrinks away once the net is open       | 1.1             |
| six screens      | P12     | net → its stand, pop k=3 at land        | 1.35, +.12      |
| flow links ×5    | P11     | draw along their length, head pops      | 2.2, +.18       |
| swatches ×6      | P3      | pop                                    | .35, +.06        |
| components ×3    | P3      | pop                                    | .8, +.08         |
| cursor           | P16     | loops the flow; presses each button    | after links      |
| click            | P3      | a ring spreads from the pressed button | on each press    |
| signal           | P11     | a bead of light runs the link to the   | +.1 after press  |
|                  |         | next screen, which lifts to receive it | (.65 s of curve) |
Sound: none of its own; the station's arrival pop marks the beat.
Reduced motion: everything snaps; the cursor rests on the last screen.
*/

const MODEL = "/models/journey/shape-studio.glb?v=1";
const SCALE = 1.15;
const CUBE_Y = 7.6;
const ANIMATED = /^(Screen_\d|Swatch_\d|DS_Component_\d|Fragments)/;
const VIOLET = "#8b5cf6";
// Which side of the cube each screen folds onto, and the flow's entry side for the next screen.
const NORMALS = [[0, 0, 1], [1, 0, 0], [0, 0, -1], [-1, 0, 0], [0, 1, 0], [0, -1, 0]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
const DWELL = 1.5;

export function createShapeStudio(root: THREE.Group) {
  const holder = new THREE.Group();
  holder.name = "Shape studio";
  holder.scale.setScalar(SCALE);
  root.add(holder);
  const stage = createStage();
  // The same cradle as at station 01: the idea arrives held. It lets go as the cube unfolds.
  const cradle = createIdeaCradle(root, { y: CUBE_Y, floor: 1.08 * SCALE + .01, half: 1.45 * 1.2414 * SCALE, accent: STATIONS[1].color });
  const disposables: { dispose(): void }[] = [];
  let built = false, ordered = false, settled = false;

  type Screen = { obj: THREE.Object3D; rest: THREE.Vector3; restQ: THREE.Quaternion; scale: number; foldQ: THREE.Quaternion; s: Staged; hinge: Staged;
    button?: THREE.Object3D; buttonAt: THREE.Vector3; press: ReturnType<typeof createSpring>; receive: ReturnType<typeof createSpring> };
  const screens: Screen[] = [];
  const links: { geometry: THREE.TubeGeometry; head: THREE.Mesh; count: number; s: Staged; curve: THREE.CubicBezierCurve3 }[] = [];
  const ripples = createRipples(holder, VIOLET, 3);
  disposables.push(ripples);
  // The signal a click sends: one bead, running the link from the pressed screen to the next.
  let bead: THREE.Mesh | undefined, beadLink = -1, beadAt = -Infinity;
  const SIGNAL = .65;
  const pops: { obj: THREE.Object3D; s: Staged }[] = [];
  let core: { obj: THREE.Object3D; s: Staged } | undefined;
  let cursor: THREE.Object3D | undefined;
  const cursorPos = [createSpring(0), createSpring(0), createSpring(0)], cursorDip = createSpring(1);
  let spin = 0, loopStart = 0, lastClick = -1, squareYaw = 0, orderClock = 0;
  const squaring = stage.add(0);
  let linkMaterial: THREE.MeshStandardMaterial | undefined;

  const ready = loadStudio(holder, MODEL, ANIMATED).then(kit => {
    disposables.push(...kit.disposables);
    const center = new THREE.Vector3(0, CUBE_Y / SCALE, 0);
    const look = new THREE.Matrix4(), zero = new THREE.Vector3();

    for (let i = 1; i <= 6; i++) {
      const obj = kit.find(`Screen_${i}`);
      if (!obj) continue;
      const { p, q, s } = kit.local(obj);
      holder.attach(obj);
      const n = NORMALS[i - 1];
      // Folded, the screen's face points into the cube, so the gold back is what you see.
      look.lookAt(zero, n, Math.abs(n.y) > .5 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0));
      const button = kit.find(`Screen_${i}_Button`);
      const buttonAt = button ? kit.local(button).p : p.clone();
      screens.push({ obj, rest: p, restQ: q, scale: s.x, foldQ: new THREE.Quaternion().setFromRotationMatrix(look),
        s: stage.add(1.35 + (i - 1) * .12), hinge: stage.add(i === 5 ? .8 : i === 6 ? 0 : .3 + (i - 1) * .06), button, buttonAt, press: createSpring(1), receive: createSpring(0) });
    }
    const half = 1.45 * (screens[0]?.scale ?? 1);

    // The prototype's wiring: a link from each screen's button to the next screen's edge.
    linkMaterial = new THREE.MeshStandardMaterial({ color: VIOLET, emissive: VIOLET, emissiveIntensity: .55, roughness: .35 });
    const headGeometry = new THREE.ConeGeometry(.2, .42, 16);
    headGeometry.rotateX(Math.PI / 2);
    disposables.push(linkMaterial, headGeometry);
    for (let i = 0; i < screens.length - 1; i++) {
      const from = screens[i], to = screens[i + 1];
      const a = from.buttonAt.clone().add(new THREE.Vector3(0, 0, .25));
      const sideways = Math.abs(to.rest.x - from.rest.x) > 1;
      const dir = Math.sign(to.rest.x - from.rest.x) || 1;
      // Along a row, into the next screen's near edge; down a column, into its top.
      const b = sideways ? to.rest.clone().add(new THREE.Vector3(-dir * (half + .15), 0, .3)) : to.rest.clone().add(new THREE.Vector3(0, half + .2, .5));
      const c1 = a.clone().add(new THREE.Vector3(0, -.4, 1.6));
      const c2 = sideways ? b.clone().add(new THREE.Vector3(-dir * 1.4, 0, .8)) : b.clone().add(new THREE.Vector3(0, 1.3, 1.2));
      const curve = new THREE.CubicBezierCurve3(a, c1, c2, b);
      const geometry = new THREE.TubeGeometry(curve, 64, .07, 8, false);
      const tube = new THREE.Mesh(geometry, linkMaterial);
      tube.castShadow = true;
      const head = new THREE.Mesh(headGeometry, linkMaterial);
      head.position.copy(b);
      head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangent(1).normalize());
      holder.add(tube, head);
      disposables.push(geometry);
      links.push({ geometry, head, count: geometry.index!.count, s: stage.add(2.2 + i * .18), curve });
    }
    const beadGeometry = new THREE.SphereGeometry(.17, 16, 12);
    const beadMaterial = new THREE.MeshBasicMaterial({ color: "#6d28d9", toneMapped: false });
    bead = new THREE.Mesh(beadGeometry, beadMaterial);
    bead.visible = false; bead.renderOrder = 5;
    holder.add(bead); disposables.push(beadGeometry, beadMaterial);

    for (let k = 1; k <= 6; k++) { const obj = kit.find(`Swatch_${k}`); if (obj) pops.push({ obj, s: stage.add(.35 + (k - 1) * .06) }); }
    for (let k = 1; k <= 3; k++) { const obj = kit.find(`DS_Component_${k}`); if (obj) pops.push({ obj, s: stage.add(.8 + (k - 1) * .08) }); }

    const coreObj = kit.find("Idea_Core"), cursorObj = kit.find("Cursor");
    if (coreObj) {
      holder.attach(coreObj); coreObj.position.copy(center);
      const m = (coreObj as THREE.Mesh).material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 1.4;
      core = { obj: coreObj, s: stage.add(1.1, 0) };
    }
    if (cursorObj) {
      holder.attach(cursorObj);
      cursorObj.scale.setScalar(1.4);
      cursor = cursorObj;
      const last = screens[screens.length - 1];
      if (last) cursorPos.forEach((s, k) => s.snap(last.buttonAt.getComponent(k) + [.25, -.2, .9][k]));
    }
    kit.find("Fragments")?.removeFromParent();
    built = true;
    apply(0, true, 0);
  }).catch(error => console.error("Shape studio:", error));

  const tmpB = new THREE.Vector3();
  // Net unfolding: a side's hinge axis is up × its normal (that turns its top outward and down).
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), .32);
  const frameQ = new THREE.Quaternion(), squareQ = new THREE.Quaternion(), hingeQ = new THREE.Quaternion(), backQ = new THREE.Quaternion();
  const netP = new THREE.Vector3(), netQ = new THREE.Quaternion(), edge = new THREE.Vector3(), lidHinge = new THREE.Vector3(), backHinge = new THREE.Vector3();
  const X_NEG = new THREE.Vector3(-1, 0, 0), UP_AXIS = new THREE.Vector3(0, 1, 0);
  const axisOf = (n: THREE.Vector3) => new THREE.Vector3().crossVectors(UP_AXIS, n).normalize();
  const tmp = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), spinQ = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  function apply(dt: number, reduced: boolean, time: number) {
    const center = tmp.set(0, CUBE_Y / SCALE, 0).clone();
    // Turning while it is still an idea; on arrival it squares up to the nearest quarter turn.
    if (!reduced && !ordered) spin += dt * .32;
    spinQ.setFromAxisAngle(Y, spin).multiply(tilt);
    squareQ.setFromAxisAngle(Y, squareYaw);
    frameQ.slerpQuaternions(spinQ, squareQ, THREE.MathUtils.clamp(squaring.spring.value, 0, 1));
    const half = 1.45 * (screens[0]?.scale ?? 1);
    const angle = (st: Staged | undefined) => Math.max(0, st?.spring.value ?? 0) * Math.PI / 2;
    screens.forEach((sc, i) => {
      // The net pose, in the cube's own frame: sides hinge on their bottom edge, the lid off the back.
      const n = NORMALS[i];
      if (i === 5) { netP.copy(n).multiplyScalar(half); netQ.copy(sc.foldQ); }
      else if (i === 4) {
        const back = screens[2];
        hingeQ.setFromAxisAngle(X_NEG, angle(sc.hinge));
        netP.set(0, 0, half).applyQuaternion(hingeQ).add(lidHinge.set(0, half, -half));
        backQ.setFromAxisAngle(axisOf(NORMALS[2]), angle(back?.hinge));
        backHinge.set(0, -half, -half);
        netP.sub(backHinge).applyQuaternion(backQ).add(backHinge);
        netQ.copy(backQ).multiply(hingeQ).multiply(sc.foldQ);
      } else {
        hingeQ.setFromAxisAngle(axisOf(n), angle(sc.hinge));
        netP.set(0, half, 0).applyQuaternion(hingeQ).add(edge.copy(n).multiplyScalar(half).setY(-half));
        netQ.copy(hingeQ).multiply(sc.foldQ);
      }
      netP.applyQuaternion(frameQ).add(center);
      netQ.premultiply(frameQ);
      const t = sc.s.spring.value, c = THREE.MathUtils.clamp(t, 0, 1);
      sc.obj.position.lerpVectors(netP, sc.rest, c);
      sc.obj.position.y += Math.sin(Math.PI * c) * 2.2;
      tmpQ.slerpQuaternions(netQ, sc.restQ, c);
      sc.obj.quaternion.copy(tmpQ);
      // Receiving the signal, the screen lifts toward you for a beat, like a page arriving.
      if (reduced) sc.receive.snap(0); else sc.receive.step(0, dt);
      sc.obj.scale.setScalar(sc.scale * (1 + Math.max(0, t - 1) * 3 + Math.max(0, sc.receive.value) * .06));
      sc.obj.position.z += Math.max(0, sc.receive.value) * .35;
      if (sc.button) {
        if (reduced) sc.press.snap(1); else sc.press.step(1, dt);
        sc.button.scale.set(1, 1, 1).multiplyScalar(Math.max(.6, sc.press.value));
      }
    });
    if (core) {
      // The idea glows inside the folded cube and is gone once its faces have become screens.
      const v = popped(1 - core.s.spring.value, 2.5);
      core.obj.scale.setScalar(Math.max(.0001, v));
      core.obj.quaternion.copy(frameQ);
      core.obj.visible = v > .002;
    }
    for (const link of links) {
      const v = THREE.MathUtils.clamp(link.s.spring.value, 0, 1);
      link.geometry.setDrawRange(0, Math.floor(link.count * v / 6) * 6);
      const h = popped(link.s.spring.value > .97 ? link.s.spring.value : 0, 2.5);
      link.head.scale.setScalar(Math.max(.0001, h));
      link.head.visible = h > .002;
    }
    for (const { obj, s } of pops) { const v = popped(s.spring.value, 2.5); obj.scale.setScalar(Math.max(.0001, v)); obj.visible = v > .002; }
    if (cursor) {
      cursor.visible = ordered && (links.at(-1)?.s.spring.value ?? 0) > .9;
      cursor.position.set(cursorPos[0].value, cursorPos[1].value, cursorPos[2].value);
      cursor.rotation.set(Math.PI / 2, 0, .38);
      cursor.scale.setScalar(1.4 * cursorDip.value);
    }
    if (bead) {
      const u = (stage.clock - beadAt) / SIGNAL;
      bead.visible = beadLink >= 0 && u >= 0 && u < 1 && !reduced;
      if (bead.visible) {
        const link = links[beadLink];
        link.curve.getPoint(springCurve(u) > 1 ? 1 : Math.max(0, springCurve(u)), bead.position);
        // Swells mid-run, so it reads as something travelling rather than a dot.
        bead.scale.setScalar(.7 + Math.sin(Math.PI * u) * .6);
      } else if (beadLink >= 0 && u >= 1) {
        screens[beadLink + 1]?.receive.kick(4.5);
        beadLink = -1;
      }
    }
    ripples.step(dt);
  }

  return {
    ready,
    /**
     * order: the visitor has reached the station; the cube unfolds into the prototype.
     * active: the station is on screen now; only then does the cursor keep clicking.
     */
    update(order: boolean, active: boolean, dt: number, reduced: boolean, time: number) {
      if (!built) return;
      // The cradle holds the cube while it opens, and lets go as the panels lift off.
      cradle.update(!order || (!reduced && stage.clock - orderClock < 1.3), dt, reduced, time);
      if (order !== ordered) { ordered = order; settled = false; stage.set(order ? 1 : 0); if (order) { loopStart = stage.clock + 3.6; orderClock = stage.clock; squareYaw = Math.round(spin / (Math.PI / 2)) * Math.PI / 2; } }
      // The idea core runs opposite to the screens: it is 1 while folded.
      if (core) core.s.want = order ? 1 : 0;
      const looping = ordered && active && !reduced && stage.clock > loopStart;
      if (settled && !looping && ordered) return;
      let moving = stage.step(dt, reduced);
      if (looping && cursor) {
        // Click through the flow: move to a screen's button, press it, then on to the next.
        const k = Math.floor((stage.clock - loopStart) / DWELL) % screens.length;
        const into = (stage.clock - loopStart) % DWELL;
        const goal = screens[k].buttonAt;
        cursorPos.forEach((s, axis) => s.step(goal.getComponent(axis) + [.25, -.2, .9][axis], dt));
        if (into > .75 && lastClick !== k) {
          lastClick = k;
          screens[k].press.snap(.78);
          cursorDip.snap(.82);
          if (linkMaterial) linkMaterial.emissiveIntensity = 1.4;
          ripples.emit(tmpB.copy(screens[k].buttonAt).add(new THREE.Vector3(0, 0, .3)), 1.1, { normal: new THREE.Vector3(0, 0, 1), life: .75 });
          // The last screen ends the flow; every other one sends its signal on to the next.
          if (k < links.length) { beadLink = k; beadAt = stage.clock + .1; }
        }
        cursorDip.step(1, dt);
        if (linkMaterial) linkMaterial.emissiveIntensity += (.55 - linkMaterial.emissiveIntensity) * Math.min(1, dt * 4);
        moving = true;
      }
      apply(dt, reduced, time);
      // The folded cube keeps turning while it is still an idea.
      settled = !moving && ordered;
    },
    dispose() { cradle.dispose(); holder.removeFromParent(); disposables.forEach(d => d.dispose()); },
  };
}
