import * as THREE from "three";
import { createSpring } from "./motion-curve";
import { loadStudio, popped } from "./studio-kit";

/*
Station 06, Out in the World: "What happens after launch?"
Built in Blender (design/journey/launch-world.blend → public/models/journey/launch-world.glb).

The finished product (the gold idea cube, complete) sits on a launch dais in front of a pearl
globe. Three scroll beats, as before (launch-story.ts):
  0 · go live:   light arcs leave the product and land around the world; a pin pops where each
                 lands, and the world keeps turning with its users on it
  1 · monitor:   two satellites come into orbit, each sweeping a scan cone over the globe; the
                 analytics panel's bars rise and keep breathing
  2 · hand over: the pearl case opens and the key (accounts), the code (repository) and the book
                 (documentation) rise out of it toward you: a live product that is fully yours
Going back plays a beat in reverse. Reduced motion shows each beat's finished pose.

MOTION SCORE (seconds after the beat begins; springs on the shared curve)
| beat | t (s)        | Element      | Pattern | Goal                                  |
| 0    | 0            | product      | P3      | lifts, its band brightens             |
| 0    | .15 + .12·i  | arc i        | P11     | head draws out, tail follows (+.75)   |
| 0    | .6 + .12·i   | pin i        | P3      | pops on the globe                     |
| 1    | 0, .2        | satellites   | P3      | pop into orbit (P16 loop)             |
| 1    | .25 + .07·k  | bars         | P4      | rise; breathe while on screen         |
| 2    | 0            | lid          | P12     | opens on its hinge                    |
| 2    | .35 + .12·k  | key/code/book| P12     | rise out of the case, pop k=3          |
*/

const MODEL = "/models/journey/launch-world.glb?v=1";
const SCALE = 1.15;
const ANIMATED = /^(Globe|Product|Chart_Bar_\d|Case_Lid|Hand_(Key|Code|Book)|Fragments)$/;
const BARS = [.34, .48, .41, .6, .55, .73, .66, .9];
const TARGETS: [number, number][] = [[-38, 22], [-14, 40], [10, 8], [32, 30], [-26, -12], [22, -20], [2, 52]];
const SEGMENTS = 80;

type Spring = ReturnType<typeof createSpring>;
type Cue = { beat: number; at: number; s: Spring };

export function createLaunchWorld(root: THREE.Group) {
  const holder = new THREE.Group();
  holder.name = "Launch world";
  holder.scale.setScalar(SCALE);
  root.add(holder);
  const disposables: { dispose(): void }[] = [];
  let built = false, beat = -1, clock = 0, spin = 0;
  const started = [-1, -1, -1];
  const cues: Cue[] = [];
  const cue = (b: number, at: number, initial = 0): Cue => { const c = { beat: b, at, s: createSpring(initial) }; cues.push(c); return c; };

  let globe: THREE.Object3D | undefined, product: THREE.Object3D | undefined, lid: THREE.Object3D | undefined;
  let productY = 0;
  const productCue = cue(0, 0);
  const arcs: { geometry: THREE.TubeGeometry; head: Cue; tail: Cue; pin: THREE.Mesh; pinCue: Cue; target: THREE.Vector3; placed: boolean }[] = [];
  const sats: { obj: THREE.Object3D; cone: THREE.Mesh; c: Cue; tilt: number; phase: number }[] = [];
  const bars: { obj: THREE.Object3D; level: number; c: Cue }[] = [];
  const items: { obj: THREE.Object3D; restY: number; c: Cue }[] = [];
  const lidCue = cue(2, 0);
  const globeCenter = new THREE.Vector3();
  let globeR = 3.6;

  const ready = loadStudio(holder, MODEL, ANIMATED).then(kit => {
    disposables.push(...kit.disposables);
    globe = kit.find("Globe"); product = kit.find("Product"); lid = kit.find("Case_Lid");
    if (globe) globeCenter.copy(kit.local(globe).p);
    const body = kit.find("Globe_body");
    if (body) { const box = new THREE.Box3().setFromObject(body); globeR = (box.max.x - box.min.x) / 2 / SCALE; }
    if (product) productY = product.position.y;
    const origin = kit.find("Launch_Origin") ? kit.local(kit.find("Launch_Origin")!).p : new THREE.Vector3();

    // Arcs to points on the side of the world that faces you.
    const arcMaterial = new THREE.MeshBasicMaterial({ color: "#f472b6", toneMapped: false });
    const pinGeometry = new THREE.SphereGeometry(.13, 14, 10);
    disposables.push(arcMaterial, pinGeometry);
    TARGETS.forEach(([lon, lat], i) => {
      const dir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - lat), THREE.MathUtils.degToRad(lon));
      const target = globeCenter.clone().addScaledVector(dir, globeR + .05);
      const curve = new THREE.CubicBezierCurve3(origin, origin.clone().add(new THREE.Vector3(dir.x * 2, 4.5, 1.5)),
        target.clone().addScaledVector(dir, 3.2), target);
      const geometry = new THREE.TubeGeometry(curve, SEGMENTS, .05, 6, false);
      geometry.setDrawRange(0, 0);
      const tube = new THREE.Mesh(geometry, arcMaterial);
      tube.frustumCulled = false;
      holder.add(tube);
      const pin = new THREE.Mesh(pinGeometry, arcMaterial);
      pin.visible = false;
      globe?.add(pin);
      disposables.push(geometry);
      arcs.push({ geometry, head: cue(0, .15 + i * .12), tail: cue(0, .9 + i * .12), pin, pinCue: cue(0, .6 + i * .12), target, placed: false });
    });

    const satSource = kit.find("Satellite");
    const coneGeometry = new THREE.ConeGeometry(1, 1, 32, 1, true).translate(0, -.5, 0);
    const coneMaterial = new THREE.MeshBasicMaterial({ color: "#f9a8d4", transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    disposables.push(coneGeometry, coneMaterial);
    if (satSource) [0, 1].forEach(i => {
      const obj = i === 0 ? satSource : satSource.clone(true);
      holder.attach(obj);
      const cone = new THREE.Mesh(coneGeometry, coneMaterial);
      cone.renderOrder = 4;
      holder.add(cone);
      sats.push({ obj, cone, c: cue(1, i * .2), tilt: i ? -.5 : .42, phase: i * Math.PI });
    });
    kit.find("Fragments")?.removeFromParent();

    for (let k = 1; k <= 8; k++) { const obj = kit.find(`Chart_Bar_${k}`); if (obj) bars.push({ obj, level: BARS[k - 1], c: cue(1, .25 + (k - 1) * .07) }); }
    ["Hand_Key", "Hand_Code", "Hand_Book"].forEach((name, k) => { const obj = kit.find(name); if (obj) items.push({ obj, restY: obj.position.y, c: cue(2, .35 + k * .12) }); });
    built = true;
    apply(0, 0, true);
  }).catch(error => console.error("Launch world:", error));

  const tmp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function apply(dt: number, time: number, reduced: boolean) {
    if (globe && !reduced) { spin += dt * (beat >= 0 ? .16 : .06); globe.rotation.y = spin; }
    if (product) {
      const v = productCue.s.value;
      product.position.y = productY + v * .5;
      product.rotation.y = Math.PI / 4 + (reduced ? 0 : time * .3 * Math.min(1, Math.max(0, v)));
    }
    for (const a of arcs) {
      const h = THREE.MathUtils.clamp(a.head.s.value, 0, 1), t = THREE.MathUtils.clamp(a.tail.s.value, 0, 1);
      const from = Math.floor(t * SEGMENTS), to = Math.floor(h * SEGMENTS);
      a.geometry.setDrawRange(from * 36, Math.max(0, to - from) * 36);
      // The user lands where the arc lands, then turns with the world.
      if (!a.placed && a.pinCue.s.value > .001 && globe) {
        a.placed = true;
        globe.updateMatrixWorld(true);
        a.pin.position.copy(globe.worldToLocal(holder.localToWorld(tmp.copy(a.target))));
      }
      if (a.pinCue.s.value < .001) a.placed = false;
      const v = popped(a.pinCue.s.value, 2.5);
      a.pin.visible = v > .002 && a.placed;
      a.pin.scale.setScalar(Math.max(.001, v));
    }
    for (const s of sats) {
      const v = popped(s.c.s.value, 2.5);
      const ang = s.phase + time * .55;
      tmp.set(Math.cos(ang) * (globeR + 2), 0, Math.sin(ang) * (globeR + 2)).applyAxisAngle(new THREE.Vector3(1, 0, 0), s.tilt).add(globeCenter);
      s.obj.position.copy(tmp);
      s.obj.lookAt(holder.localToWorld(globeCenter.clone()));
      s.obj.scale.setScalar(Math.max(.001, v));
      s.obj.visible = v > .002;
      // The scan cone reaches from the satellite to the surface.
      const toward = globeCenter.clone().sub(tmp), dist = toward.length() - globeR * .92;
      s.cone.position.copy(tmp);
      s.cone.quaternion.setFromUnitVectors(up, toward.normalize().negate());
      s.cone.scale.set(1.4 * Math.min(1, Math.max(0, v)), dist, 1.4 * Math.min(1, Math.max(0, v)));
      s.cone.visible = v > .05;
    }
    for (const b of bars) {
      const breathe = reduced ? 0 : Math.sin(time * 1.7 + b.level * 9) * .04;
      b.obj.scale.set(1, Math.max(.001, b.c.s.value * (b.level + breathe * Math.min(1, b.c.s.value))), 1);
    }
    if (lid) lid.rotation.x = -THREE.MathUtils.degToRad(108) * Math.max(0, lidCue.s.value);
    for (const it of items) {
      const v = it.c.s.value;
      it.obj.position.y = it.restY - 1.7 * (1 - Math.min(1, v));
      it.obj.scale.setScalar(Math.max(.001, 1 + Math.max(0, v - 1) * 3));
      it.obj.visible = v > .01;
    }
    if (items[0] && !reduced) items[0].obj.rotation.y = time * .5 * Math.min(1, Math.max(0, items[0].c.s.value));
  }

  return {
    ready,
    /** beat: -1 before the station, then 0 go live, 1 monitor, 2 hand over. near: worth animating. */
    update(nextBeat: number, near: boolean, dt: number, reduced: boolean) {
      if (!built || (!near && beat === nextBeat)) return;
      clock += dt;
      if (nextBeat !== beat) {
        for (let b = 0; b < 3; b++) if (b <= nextBeat && started[b] < 0) started[b] = clock;
        for (let b = 0; b < 3; b++) if (b > nextBeat) started[b] = -1;
        beat = nextBeat;
      }
      for (const c of cues) {
        // Reduced motion draws only on scroll, so a beat shows its finished pose at once.
        const goal = started[c.beat] >= 0 && (reduced || clock - started[c.beat] >= c.at) ? 1 : 0;
        if (reduced) c.s.snap(goal); else c.s.step(goal, dt);
      }
      apply(dt, clock, reduced);
    },
    dispose() { holder.removeFromParent(); disposables.forEach(d => d.dispose()); },
  };
}
