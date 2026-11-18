import * as THREE from "three";
import { createSpring } from "./motion-curve";
import { loadStudio, popped } from "./studio-kit";

/*
Station 04, Coming Alive: "Will it feel slow or break for real users?"
Built in Blender (design/journey/proving-ground.blend → public/models/journey/proving-ground.glb).

The system assembled at station 03 (three layers, two features) stands on a turntable in a test
arena and is proven before anyone uses it:
  · it powers up, layer by layer, and starts to turn
  · a light pulse laps the track: the page load, one fast lap
  · twelve probes fire at it in turn; each cap turns green as its test passes
  · the speed gauge swings into the green zone, and its overshoot is the needle's wobble
  · three performance-budget meters rise and settle under their budget line
  · a crown of light closes the run: verified for release
While you stay, it keeps turning and the track pulse runs another lap every few seconds.

MOTION SCORE (seconds after arrival; every value on the shared spring)
| t (s)        | Element          | Pattern | Goal                                    |
| 0, .15, .3   | layers           | P3      | lights on, bottom to top                |
| .45          | features         | P3      | lights on                               |
| .6           | track pulse      | P16     | one lap (2π), repeats every 3.2 s       |
| .9 + .14·k   | probe k          | P11     | beam shoots out and back; cap → green   |
| 1.3          | gauge needle     | P12     | slow → fast (green), wobble = overshoot |
| 1.9 + .14·k  | meter k          | P4      | rises, settles under the budget line    |
| 2.9          | crown            | P3      | pops around the top                     |
Scrolling back plays it in reverse; reduced motion shows the verified state.
*/

const MODEL = "/models/journey/proving-ground.glb?v=1";
const SCALE = 1.15;
const ANIMATED = /^(Turntable|Track_Pulse|Probe_\d+|Gauge_Needle|Meter_Fill_\d)/;
const MINT = new THREE.Color("#10b981"), IDLE = new THREE.Color("#9aa4b2");
const GAUGE_FROM = THREE.MathUtils.degToRad(225), GAUGE_TO = THREE.MathUtils.degToRad(-22);
const LEVELS = [.56, .68, .44];

type Cue = { at: number; s: ReturnType<typeof createSpring> };
const cue = (at: number): Cue => ({ at, s: createSpring(0) });

export function createProvingGround(root: THREE.Group) {
  const holder = new THREE.Group();
  holder.name = "Proving ground";
  holder.scale.setScalar(SCALE);
  root.add(holder);
  const disposables: { dispose(): void }[] = [];
  let built = false, ordered = false, clock = 0, lapGoal = 0, nextLap = Infinity;

  const glow = (materials: THREE.MeshStandardMaterial[], v: number) => {
    for (const m of materials) {
      m.color.copy(IDLE).lerp(MINT, THREE.MathUtils.clamp(v, 0, 1));
      m.emissive.copy(MINT);
      m.emissiveIntensity = Math.max(0, v) * 2.2;
    }
  };

  const layers: { mats: THREE.MeshStandardMaterial[]; c: Cue }[] = [];
  const probes: { cap: THREE.MeshStandardMaterial; beam: THREE.Mesh; from: THREE.Vector3; length: number; fire: Cue; pass: Cue }[] = [];
  const meters: { obj: THREE.Object3D; level: number; c: Cue }[] = [];
  let turntable: THREE.Object3D | undefined, pulse: THREE.Object3D | undefined, needle: THREE.Object3D | undefined, crown: THREE.Object3D | undefined;
  const needleCue = cue(1.3), crownCue = cue(2.9), lap = createSpring(0);

  const ready = loadStudio(holder, MODEL, ANIMATED).then(kit => {
    disposables.push(...kit.disposables);
    const meshesNamed = (test: (name: string) => boolean) => {
      const out: THREE.Mesh[] = [];
      kit.scene.traverse(o => { if (o instanceof THREE.Mesh && test(o.name)) out.push(o); });
      return out;
    };
    const own = (meshes: THREE.Mesh[]) => {
      const m = (meshes[0]?.material as THREE.MeshStandardMaterial | undefined)?.clone() ?? new THREE.MeshStandardMaterial();
      meshes.forEach(mesh => { mesh.material = m; });
      disposables.push(m);
      return m;
    };
    // Each layer's light bands share one material, so a layer lights as one.
    [1, 2, 3].forEach((k, i) => layers.push({ mats: [own(meshesNamed(n => n.startsWith(`Tower_Light_${k}_`)))], c: cue(i * .15) }));
    layers.push({ mats: [own(meshesNamed(n => n.startsWith("Tower_Light_F")))], c: cue(.45) });

    turntable = kit.find("Turntable");
    pulse = kit.find("Track_Pulse");
    needle = kit.find("Gauge_Needle");
    crown = kit.find("Tower_Crown");
    const tower = kit.find("Tower");
    const aim = tower ? kit.local(tower).p.add(new THREE.Vector3(0, 1.9, 0)) : new THREE.Vector3(0, 2.6, 0);

    // Beams are built here: a unit cylinder from the probe head toward the system.
    const beamGeometry = new THREE.CylinderGeometry(.045, .045, 1, 10, 1, true).translate(0, .5, 0);
    const beamMaterial = new THREE.MeshBasicMaterial({ color: "#6ee7b7", transparent: true, opacity: .9, toneMapped: false });
    disposables.push(beamGeometry, beamMaterial);
    for (let k = 1; k <= 12; k++) {
      const probe = kit.find(`Probe_${k}`);
      const capMesh = kit.find(`Probe_Cap_${k}`) as THREE.Mesh | undefined;
      const head = kit.find(`Probe_Beam_${k}`);
      if (!probe || !capMesh || !head) continue;
      head.visible = false;
      const from = kit.local(head).p;
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      beam.position.copy(from);
      const dir = aim.clone().sub(from);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      beam.visible = false;
      holder.add(beam);
      probes.push({ cap: own([capMesh]), beam, from, length: dir.length() - 1.6, fire: cue(.9 + (k - 1) * .14), pass: cue(1.15 + (k - 1) * .14) });
    }
    [1, 2, 3].forEach((k, i) => { const obj = kit.find(`Meter_Fill_${k}`); if (obj) meters.push({ obj, level: LEVELS[i], c: cue(1.9 + i * .14) }); });
    // The meter tubes are glass: the fills must be seen rising inside them.
    holder.traverse(o => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m?.name === "Tube glass") { m.transparent = true; m.opacity = .28; m.depthWrite = false; m.roughness = .05; (o as THREE.Mesh).renderOrder = 3; }
    });
    built = true;
    apply();
  }).catch(error => console.error("Proving ground:", error));

  function apply() {
    for (const l of layers) glow(l.mats, l.c.s.value);
    for (const p of probes) {
      glow([p.cap], p.pass.s.value);
      // The beam shoots out, touches the system, and is drawn back in.
      const f = p.fire.s.value;
      p.beam.visible = f > .01;
      p.beam.scale.set(1 + Math.max(0, f - 1) * 3, Math.max(.001, Math.min(1, f) * p.length), 1 + Math.max(0, f - 1) * 3);
    }
    // Blender's local Z (the dial's normal) is local Y once exported.
    if (needle) needle.rotation.y = THREE.MathUtils.lerp(GAUGE_FROM, GAUGE_TO, needleCue.s.value);
    for (const m of meters) m.obj.scale.set(1, Math.max(.001, m.c.s.value * m.level), 1);
    if (crown) { const v = popped(crownCue.s.value, 2.5); crown.scale.setScalar(Math.max(.001, v)); crown.visible = v > .002; }
    if (pulse) pulse.rotation.y = -lap.value;
  }

  const all = () => [...layers.map(l => l.c), ...probes.flatMap(p => [p.fire, p.pass]), ...meters.map(m => m.c), needleCue, crownCue];

  return {
    ready,
    /** order: the camera has reached the station. active: it is on screen, so the loops run. */
    update(order: boolean, active: boolean, dt: number, reduced: boolean) {
      if (!built) return;
      if (order !== ordered) {
        ordered = order; clock = 0;
        if (order) { lapGoal = Math.ceil(lap.value / (Math.PI * 2)) * Math.PI * 2 + Math.PI * 2; nextLap = 3.8; }
      }
      clock += dt;
      // Reduced motion draws only on scroll: show the verified state at once rather than waiting out the cues.
      if (reduced && ordered) clock = Math.max(clock, 10);
      if (ordered && active && !reduced && clock > nextLap) { lapGoal += Math.PI * 2; nextLap = clock + 3.2; }
      for (const c of all()) {
        // A probe's beam is only out for a moment; everything else holds once it has arrived.
        const isFire = probes.some(p => p.fire === c);
        const goal = ordered && clock >= c.at && !(isFire && clock >= c.at + .38) ? 1 : 0;
        if (reduced) c.s.snap(isFire ? 0 : goal); else c.s.step(goal, dt);
      }
      if (reduced) lap.snap(lapGoal); else lap.step(ordered && clock >= .6 ? lapGoal : lap.value, dt);
      if (turntable && ordered && !reduced) turntable.rotation.y += dt * (active ? .22 : .08);
      apply();
    },
    dispose() { holder.removeFromParent(); disposables.forEach(d => d.dispose()); },
  };
}
