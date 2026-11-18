import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createSpring } from "./motion-curve";
import { createRipples } from "./studio-kit";
import { createIdeaCradle } from "./idea-cradle";
import { STATIONS } from "./data";

/*
Station 01, The Spark: "What if my idea is too vague to build?"
Built in Blender (design/journey/spark-studio.blend → public/models/journey/spark-studio.glb).

The glowing cube above is the idea. Below it, a studio table shows what the station delivers:
  · the brief, one page on a lectern, lit by the idea
  · the scope, three trays: Must, Should, Later
  · the first plan, a Gantt board
  · success measures, a target
  · what we won't build, a wastebasket
Before the visitor arrives the idea is vague: sticky notes and crumpled drafts drift around it.
On arrival they are sorted into the trays and the bin, the brief writes itself, the plan's bars
grow and the dart lands. Scrolling back undoes it all.

MOTION SCORE (goal changes on arrival; every value springs on the shared curve)
| Element          | Pattern | Goal                         | Delay (s)            |
|------------------|---------|------------------------------|----------------------|
| sticky notes ×12 | P12     | drift → stacked in its tray  | 0, +.07 each (mixed) |
| drafts ×3        | P12     | drift → arc into the bin     | .35, +.12            |
| brief lines      | P4-ish  | scaleX 0 → 1 (writes in)     | .45, +.06            |
| brief ticks      | P3      | pop k=2.5                    | after its line       |
| plan bars        | P4-ish  | scaleX 0 → 1                 | .95, +.12            |
| milestone        | P3      | pop                          | 1.5                  |
| dart             | P12     | flies in along the target    | 1.25                 |
| light beam       | –       | brightens with the brief     | .3                   |
| pencil           | P12     | lifts off the table, writes  | .3 → 1.75, then down |
|                  |         | each line as it appears      | (tip follows a spring)|
| dart impact      | P3      | quivers, a ring spreads      | on landing           |
| idea cube        | P12     | grows ×1.35 as you land      | with the reveal      |
| threads ×5       | P11     | light draws from the idea to | trays .2/.3/.4,      |
|                  |         | each deliverable as it forms | plan .9, target 1.15 |
| heartbeat        | P3      | the cube swells a little and | every 2.4 s          |
|                  |         | a pulse runs down every thread |                    |
While you stay: motes of the idea's light drift down the beam onto the page; the idea beats and
feeds its deliverables. The idea is the station's centre: everything on the table is wired to it.
Sound: none of its own; the station's arrival pop already marks the beat.
Reduced motion: every value snaps; nothing drifts; the pencil stays on the table.
*/

const MODEL = "/models/journey/spark-studio.glb?v=2";
/** The table is drawn a little larger than modelled so its details read from the journey camera. */
const SCALE = 1.15;
/** World height of the idea cube's centre; the intro camera looks here (SPARK_IDEA_Y). */
export const SPARK_IDEA_Y = 10.8;
const IDEA_Y = SPARK_IDEA_Y;
/** Landed at the station, the idea is the centrepiece: it grows to this size. */
const CUBE_GROW = 1.35;
/** Half its height once grown, tilt included: the cradle sits below this. */
const CUBE_HALF = 1.25 * CUBE_GROW * 1.12;
/** The cradle's halo under the cube: the beam to the brief starts there. */
const BEAM_TOP = IDEA_Y - CUBE_HALF - .55;
/** One heartbeat of the idea: a pulse leaves along every thread. */
const BEAT = 2.4;
const TRAYS = ["Must", "Should", "Later"] as const;
const NOTE_COLORS = ["#f59e0b", "#fcd77f", "#cfd8e3"];
const NOTES_PER_TRAY = 4;
const ANIMATED = /^(Brief_(Line|Item|Plan|Tick)_\d|Plan_Bar_\d|Plan_Milestone|Target_Dart|Fragments|Pencil)/;
const MOTES = 36;
/** The pencil's lead sits this far from its origin, along its own axis. */
const PENCIL_TIP = 2.88;

type Staged = { spring: ReturnType<typeof createSpring>; delay: number; goal: number; want: number; at: number };
const popped = (v: number, k: number) => (v > 1 ? 1 + (v - 1) * k : Math.max(0, v));

export function createSparkStudio(root: THREE.Group) {
  const holder = new THREE.Group();
  holder.name = "Spark studio";
  holder.scale.setScalar(SCALE);
  root.add(holder);
  const disposables: { dispose(): void }[] = [];
  let clock = 0, ordered = false, settled = false, built = false, changedAt = -Infinity;
  // The cube opens to let its thoughts out (and again to take them back), then closes.
  const open = createSpring(0), presence = createSpring(0);
  const staged: Staged[] = [];
  const stage = (delay: number): Staged => {
    const s = { spring: createSpring(0), delay, goal: 0, want: 0, at: 0 };
    staged.push(s); return s;
  };

  // Filled once the model arrives.
  let notes: THREE.InstancedMesh | undefined, drafts: THREE.InstancedMesh | undefined;
  const noteMotion: { from: THREE.Vector3; fromQ: THREE.Quaternion; to: THREE.Vector3; toQ: THREE.Quaternion; s: Staged; orbit: number; radius: number; height: number; phase: number }[] = [];
  const draftMotion: typeof noteMotion = [];
  const lines: { obj: THREE.Object3D; s: Staged }[] = [];
  const pops: { obj: THREE.Object3D; s: Staged; base: number }[] = [];
  let dart: { obj: THREE.Object3D; s: Staged; rest: THREE.Vector3; restQ: THREE.Quaternion; out: THREE.Vector3; face: THREE.Vector3; normal: THREE.Vector3; hitAt: number } | undefined;
  let beam: { material: THREE.ShaderMaterial; s: Staged } | undefined;
  // The pencil: it lifts off the table and writes the brief, its tip chasing the line being written.
  let pencil: { obj: THREE.Object3D; restP: THREE.Vector3; restQ: THREE.Quaternion; writeQ: THREE.Quaternion; axis: THREE.Vector3;
    normal: THREE.Vector3; down: THREE.Vector3; page: THREE.Matrix4; count: number; widths: number[] } | undefined;
  const pen = createSpring(0), head = [createSpring(0), createSpring(0), createSpring(0)];
  let orderAt = -Infinity;
  let motes: { mesh: THREE.InstancedMesh; length: number; seeds: number[][] } | undefined;
  // The station holds the idea: a halo under the cube, a thread of light down to the table.
  const cradle = createIdeaCradle(root, { y: IDEA_Y, floor: 1.08 * SCALE + .01, half: CUBE_HALF, accent: STATIONS[0].color });
  // The idea's threads: light from the cube to every deliverable on the table.
  const threads: { material: THREE.ShaderMaterial; s: Staged }[] = [];
  const pulse = { value: 0 };
  const grow = createSpring(1), beat = createSpring(0);
  let lastBeat = 0;
  const ripples = createRipples(holder, "#f59e0b", 3);
  disposables.push(ripples);

  const ready = new GLTFLoader().loadAsync(MODEL).then(gltf => {
    const scene = gltf.scene;
    holder.add(scene);
    holder.updateMatrixWorld(true);
    const toHolder = new THREE.Matrix4().copy(holder.matrixWorld).invert();
    const local = (obj: THREE.Object3D) => {
      const m = new THREE.Matrix4().multiplyMatrices(toHolder, obj.matrixWorld);
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      m.decompose(p, q, s); return { p, q };
    };
    const find = (name: string) => scene.getObjectByName(name);
    const isAnimated = (obj: THREE.Object3D) => { for (let o: THREE.Object3D | null = obj; o; o = o.parent) if (ANIMATED.test(o.name)) return true; return false; };

    // Materials: the studio's pearl and graphite take the scene's light the way the rest of the world does.
    scene.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      const m = o.material as THREE.MeshStandardMaterial;
      m.envMapIntensity = .7;
      if (m.name === "Spark amber") { m.emissiveIntensity = .55; m.roughness = .32; }
      if (m.name === "Brushed steel") { m.metalness = .8; m.roughness = .32; }
    });

    // Everything that never moves is merged per material: a handful of draw calls for the whole table.
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
    scene.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; disposables.push(o.geometry); } });

    // The brief writes itself in reading order; each tick lands just after its line.
    const lineOrder = ["Brief_Line_1", "Brief_Line_2", "Brief_Line_3", "Brief_Line_4", "Brief_Line_5",
      "Brief_Item_1", "Brief_Item_2", "Brief_Item_3", "Brief_Plan_1", "Brief_Plan_2", "Brief_Plan_3", "Brief_Line_6"];
    lineOrder.forEach((name, i) => { const obj = find(name); if (obj) lines.push({ obj, s: stage(.45 + i * .06) }); });
    const briefNode = find("Brief"), pencilObj = find("Pencil");
    if (briefNode && pencilObj) {
      const page = new THREE.Matrix4().multiplyMatrices(toHolder, briefNode.matrixWorld);
      const normal = new THREE.Vector3(0, 1, 0).transformDirection(page);
      const right = new THREE.Vector3(1, 0, 0).transformDirection(page);
      const down = new THREE.Vector3(0, 0, 1).transformDirection(page);
      // A right-handed writer: the pencil leans back from the page, to the right and toward you.
      const axis = normal.clone().addScaledVector(right, .6).addScaledVector(down, .5).normalize();
      const widths = lines.map(({ obj }) => {
        const g = (obj as THREE.Mesh).geometry;
        if (!g) return 2;
        g.computeBoundingBox(); return g.boundingBox!.max.x;
      });
      pencil = { obj: pencilObj, restP: pencilObj.position.clone(), restQ: pencilObj.quaternion.clone(),
        writeQ: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis), axis, normal, down, page, count: lines.length, widths };
      const start = writingHead(new THREE.Vector3());
      head.forEach((s, k) => s.snap(start.getComponent(k)));
    }
    [1, 2, 3].forEach(i => { const obj = find(`Brief_Tick_${i}`); if (obj) pops.push({ obj, s: stage(.45 + (5 + i) * .06 + .18), base: 1 }); });
    [1, 2, 3, 4].forEach(i => { const obj = find(`Plan_Bar_${i}`); if (obj) lines.push({ obj, s: stage(.95 + (i - 1) * .12) }); });
    const milestone = find("Plan_Milestone");
    if (milestone) pops.push({ obj: milestone, s: stage(1.5), base: 1 });
    const dartObj = find("Target_Dart");
    const faceObj = find("Target_Face");
    if (dartObj && faceObj) {
      // The face's own +Y is its front: the dart comes from there, slightly from above (its -Z).
      const m = new THREE.Matrix4().multiplyMatrices(toHolder, faceObj.matrixWorld);
      const normal = new THREE.Vector3(0, 1, 0).transformDirection(m);
      dart = { obj: dartObj, s: stage(1.25), rest: dartObj.position.clone(), restQ: dartObj.quaternion.clone(),
        out: dartObj.position.clone().add(new THREE.Vector3(0, 7, -1.4)),
        face: new THREE.Vector3().setFromMatrixPosition(m).addScaledVector(normal, .14), normal, hitAt: -Infinity };
    }

    // Loose ideas: instanced, so twelve notes and three drafts cost two draw calls.
    const noteSource = find("Note") as THREE.Mesh | undefined, draftSource = find("Paper_ball") as THREE.Mesh | undefined;
    const binInside = find("Bin_Inside");
    const rand = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    const chaos = (j: number, count: number, lift = 0) => {
      // The vague idea: its loose thoughts circle the cube itself, a tight, restless cloud.
      const orbit = (j / count) * Math.PI * 2 + rand() * .4;
      return { orbit, radius: 2.7 + rand() * 1.5, height: IDEA_Y / SCALE - 1.5 + rand() * 3 + lift, phase: rand() * Math.PI * 2,
        fromQ: new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() - .5) * 1.8, rand() * Math.PI * 2, (rand() - .5) * 1.8)) };
    };
    if (noteSource) {
      const material = (noteSource.material as THREE.MeshStandardMaterial).clone();
      material.color.set("#ffffff"); material.roughness = .78;
      notes = new THREE.InstancedMesh(noteSource.geometry, material, TRAYS.length * NOTES_PER_TRAY);
      notes.castShadow = true; notes.frustumCulled = false;
      const order = Array.from({ length: notes.count }, (_, i) => i).sort(() => rand() - .5);
      TRAYS.forEach((tray, t) => {
        const slot = find(`Scope_${tray}_slot`);
        if (!slot) return;
        const { p, q } = local(slot);
        for (let k = 0; k < NOTES_PER_TRAY; k++) {
          const j = t * NOTES_PER_TRAY + k;
          notes!.setColorAt(j, new THREE.Color(NOTE_COLORS[t]));
          const to = p.clone().add(new THREE.Vector3(0, .02 + k * .08, 0));
          const toQ = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((k % 2) * 2 - 1) * .07 * (k + 1) / 2));
          noteMotion.push({ ...chaos(j, notes!.count), from: new THREE.Vector3(), to, toQ, s: stage(.22 + order.indexOf(j) * .07) });
        }
      });
      holder.add(notes); disposables.push(material);
    }
    if (draftSource && binInside) {
      const { p } = local(binInside);
      drafts = new THREE.InstancedMesh(draftSource.geometry, draftSource.material as THREE.Material, 3);
      drafts.castShadow = true; drafts.frustumCulled = false;
      [[.38, .05, .2], [-.34, .5, .1], [.02, .95, -.3]].forEach(([x, y, z], i) => {
        draftMotion.push({ ...chaos(i * 4 + 1, 12, .4), from: new THREE.Vector3(), to: p.clone().add(new THREE.Vector3(x, y, z)),
          toQ: new THREE.Quaternion().setFromEuler(new THREE.Euler(i, i * 2, 0)), s: stage(.35 + i * .12) });
      });
      holder.add(drafts);
    }
    noteSource?.parent?.removeFromParent();

    // The idea lights the page: a soft cone from the cube to the brief.
    const page = find("Brief");
    if (page) {
      const top = new THREE.Vector3(0, BEAM_TOP / SCALE, 0), bottom = local(page).p;
      const length = top.distanceTo(bottom);
      const geometry = new THREE.CylinderGeometry(.7, 2.6, length, 40, 1, true);
      geometry.translate(0, -length / 2, 0);
      const material = new THREE.ShaderMaterial({
        // Normal blending: an additive glow vanishes against this pale world; warm tint stays visible.
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uOn: { value: 0 } },
        vertexShader: "varying vec2 vUv;varying float vFacing;void main(){vUv=uv;vec3 n=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vFacing=abs(dot(n,normalize(-mv.xyz)));gl_Position=projectionMatrix*mv;}",
        fragmentShader: "varying vec2 vUv;varying float vFacing;uniform float uOn;void main(){float a=uOn*.30*smoothstep(0.,.25,vUv.y)*(.45+.55*vUv.y)*pow(vFacing,1.4);gl_FragColor=vec4(1.,.71,.22,a);}",
      });
      const cone = new THREE.Mesh(geometry, material);
      cone.position.copy(top);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), bottom.clone().sub(top).normalize());
      cone.renderOrder = 4;
      holder.add(cone); disposables.push(geometry, material);
      beam = { material, s: stage(.3) };
      // Motes of the idea's light, drifting down the beam onto the page.
      const moteGeometry = new THREE.IcosahedronGeometry(.075, 1);
      const moteMaterial = new THREE.MeshBasicMaterial({ color: "#f59e0b", toneMapped: false });
      const mesh = new THREE.InstancedMesh(moteGeometry, moteMaterial, MOTES);
      mesh.frustumCulled = false; mesh.renderOrder = 4;
      cone.add(mesh); disposables.push(moteGeometry, moteMaterial, mesh);
      motes = { mesh, length, seeds: Array.from({ length: MOTES }, () => [rand(), rand(), rand()]) };
    }
    {
      const C = new THREE.Vector3(0, IDEA_Y / SCALE, 0), up = new THREE.Vector3(0, 1, 0);
      const ends: [THREE.Vector3 | undefined, number][] = [
        ...TRAYS.map((tray, t): [THREE.Vector3 | undefined, number] => { const o = find(`Scope_${tray}_slot`); return [o ? local(o).p : undefined, .2 + t * .1]; }),
        [find("Plan_Board") ? local(find("Plan_Board")!).p.add(new THREE.Vector3(0, .9, 0)) : undefined, .9],
        [dart?.face.clone(), 1.15],
      ];
      for (const [T, delay] of ends) {
        if (!T) continue;
        const d = T.clone().sub(C).setY(0).normalize();
        const start = C.clone().addScaledVector(d, CUBE_HALF / SCALE * .8).addScaledVector(up, -.35);
        const curve = new THREE.CubicBezierCurve3(start, start.clone().addScaledVector(d, 2.6).addScaledVector(up, 1.1),
          T.clone().addScaledVector(up, 3.2), T.clone().addScaledVector(up, .2));
        const len = curve.getLength();
        const geometry = new THREE.TubeGeometry(curve, 72, .055, 6, false);
        const material = new THREE.ShaderMaterial({
          transparent: true, depthWrite: false,
          uniforms: { uDraw: { value: 0 }, uPhase: pulse, uLen: { value: len } },
          vertexShader: "varying float vX; void main(){ vX=uv.x; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
          fragmentShader: `uniform float uDraw,uPhase,uLen; varying float vX; void main(){
            if(vX>uDraw) discard;
            float head=uPhase*1.3-.1;
            float p=exp(-pow((vX-head)*uLen/1.3,2.))*step(.99,uDraw);
            float tip=exp(-pow((vX-uDraw)*uLen/.7,2.))*(1.-step(.99,uDraw));
            float hot=max(p,tip);
            gl_FragColor=vec4(mix(vec3(.95,.55,.07),vec3(1.,.93,.66),hot),.62+.38*hot); }`,
        });
        const tube = new THREE.Mesh(geometry, material);
        tube.renderOrder = 4; tube.frustumCulled = false;
        holder.add(tube); disposables.push(geometry, material);
        threads.push({ material, s: stage(delay) });
      }
    }
    built = true;
    apply(0, 0, true);
  }).catch(error => console.error("Spark studio:", error));

  const tmp = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), matrix = new THREE.Matrix4(), scale = new THREE.Vector3();
  const tip = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0);
  function apply(dt: number, time: number, reduced: boolean) {
    // Loose ideas drift slowly while they are still loose.
    const drift = reduced ? 0 : time * .34;
    const present = popped(presence.value, 2.5);
    const place = (mesh: THREE.InstancedMesh, list: typeof noteMotion, arc: number) => {
      list.forEach((n, j) => {
        const a = n.orbit + drift, bob = reduced ? 0 : Math.sin(time * .9 + n.phase) * .28;
        n.from.set(Math.sin(a) * n.radius, n.height + bob, Math.cos(a) * n.radius);
        const t = n.s.spring.value, c = THREE.MathUtils.clamp(t, 0, 1);
        tmp.lerpVectors(n.from, n.to, c);
        tmp.y += Math.sin(Math.PI * c) * arc;
        tmpQ.slerpQuaternions(n.fromQ, n.toQ, c);
        // The catch: a little swell as it lands, inside the same spring.
        // Thoughts appear around the idea as the camera pulls back; once filed they stay.
        scale.setScalar(Math.max(.0001, (1 + Math.max(0, t - 1) * 2.5) * Math.max(present, c)));
        mesh.setMatrixAt(j, matrix.compose(tmp, tmpQ, scale));
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    if (notes) place(notes, noteMotion, 1.4);
    if (drafts) place(drafts, draftMotion, 3.2);
    for (const { obj, s } of lines) { obj.scale.x = Math.max(.0001, s.spring.value); obj.visible = s.spring.value > .002; }
    for (const { obj, s, base } of pops) { obj.scale.setScalar(Math.max(.0001, popped(s.spring.value, 2.5) * base)); obj.visible = s.spring.value > .002; }
    if (dart) {
      const v = dart.s.spring.value, c = THREE.MathUtils.clamp(v, 0, 1);
      dart.obj.position.lerpVectors(dart.out, dart.rest, c);
      // A thrown dart drops a little on its way: the arc rises toward the face's top (its -Z).
      dart.obj.position.z -= Math.sin(Math.PI * c) * .9;
      dart.obj.visible = v > .02;
      // Impact: the first time it reaches the board, a ring spreads from the bullseye.
      if (v >= .995 && dart.hitAt < 0 && ordered) {
        dart.hitAt = clock;
        if (!reduced) ripples.emit(dart.face, 2.4, { normal: dart.normal, life: 1.1 });
      }
      if (v < .5) dart.hitAt = -Infinity;
    }
    if (beam) beam.material.uniforms.uOn.value = Math.max(0, beam.s.spring.value);
    if (pencil) {
      const p = pencil, c = THREE.MathUtils.clamp(pen.value, 0, 1);
      tip.set(head[0].value, head[1].value, head[2].value).addScaledVector(p.normal, .07);
      // While a line is growing the hand scribbles along it and the lead taps the page.
      const writing = reduced ? 0 : Math.min(1, Math.abs(activeLine()?.s.spring.velocity ?? 0) * .35);
      tip.addScaledVector(p.down, Math.sin(time * 31) * .07 * writing).addScaledVector(p.normal, Math.abs(Math.sin(time * 15.5)) * .06 * writing);
      tmp.copy(tip).addScaledVector(p.axis, PENCIL_TIP);
      p.obj.position.lerpVectors(p.restP, tmp, c);
      p.obj.position.y += Math.sin(Math.PI * c) * 1.5;
      p.obj.quaternion.slerpQuaternions(p.restQ, p.writeQ, c);
    }
  }

  /** The brief line being written now: the last one under way. */
  function activeLine() {
    if (!pencil) return undefined;
    let last: (typeof lines)[number] | undefined;
    for (let i = 0; i < pencil.count; i++) if (lines[i].s.spring.value > .02) last = lines[i];
    return last;
  }
  /** Where the lead should be: the growing end of that line, in the holder's space. */
  function writingHead(out: THREE.Vector3) {
    if (!pencil) return out;
    const line = activeLine() ?? lines[0];
    const i = lines.indexOf(line);
    const v = THREE.MathUtils.clamp(line.s.spring.value, 0, 1);
    return out.set(line.obj.position.x + pencil.widths[i] * v, line.obj.position.y + .02, line.obj.position.z).applyMatrix4(pencil.page);
  }

  /** What keeps living while you stay: the motes, the ripple, the dart's quiver. */
  function live(dt: number, time: number, reduced: boolean) {
    ripples.step(dt);
    for (const t of threads) t.material.uniforms.uDraw.value = THREE.MathUtils.clamp(t.s.spring.value, 0, 1);
    // The heartbeat: while every thread is drawn, a pulse leaves the idea every BEAT seconds.
    const wired = ordered && threads.length > 0 && threads.every(t => t.s.spring.value > .99);
    if (wired && !reduced) {
      const phase = (clock % BEAT) / BEAT;
      if (phase < lastBeat) beat.kick(2.6);
      lastBeat = phase; pulse.value = phase;
    } else pulse.value = -1;
    if (reduced) beat.snap(0); else beat.step(0, dt);
    if (motes) {
      const on = Math.max(0, Math.min(1, beam?.s.spring.value ?? 0));
      motes.mesh.visible = on > .01 && !reduced;
      if (motes.mesh.visible) {
        motes.seeds.forEach(([a, b, c], i) => {
          const t = (a + time * (.06 + b * .05)) % 1;
          const r = THREE.MathUtils.lerp(.55, 2.3, t) * Math.sqrt(c) * .85, ang = b * Math.PI * 2 + time * (a - .5) * .5;
          tmp.set(Math.cos(ang) * r, -t * motes!.length, Math.sin(ang) * r);
          scale.setScalar(Math.max(.0001, on * Math.sin(Math.PI * t) ** .6 * (.7 + c * .6)));
          motes!.mesh.setMatrixAt(i, matrix.compose(tmp, tmpQ.identity(), scale));
        });
        motes.mesh.instanceMatrix.needsUpdate = true;
      }
    }
    if (dart && dart.hitAt >= 0) {
      // A struck dart shivers: a fast sine dying away, around its resting tilt.
      const t = clock - dart.hitAt, q = reduced ? 0 : Math.exp(-t * 6) * Math.sin(t * 46) * .22;
      dart.obj.quaternion.copy(dart.restQ).multiply(tmpQ.setFromAxisAngle(X, q));
    }
  }

  return {
    ready,
    /** The idea cube's size: grown at the station, swelling a touch on each heartbeat. */
    get cubeScale() { return grow.value * (1 + Math.max(0, beat.value) * .06); },
    /** How far the idea cube should open right now (0 closed, ~.7 open). */
    get cubeOpen() { return Math.max(0, open.value); },
    /**
     * order: the visitor has reached the station; the vague idea becomes a plan.
     * reveal: the camera has pulled back from the cube; its loose thoughts become visible.
     */
    update(order: boolean, reveal: boolean, dt: number, reduced: boolean, time: number) {
      if (!built) return;
      clock += dt;
      const openGoal = clock - changedAt < .9 ? .7 : 0;
      if (reduced) { open.snap(0); presence.snap(reveal || order ? 1 : 0); }
      else { open.step(openGoal, dt); presence.step(reveal || order ? 1 : 0, dt); }
      if (order !== ordered) {
        if (clock > .5) changedAt = clock;
        ordered = order; settled = false;
        const last = Math.max(...staged.map(s => s.delay));
        // Coming apart plays in reverse order, a little quicker.
        for (const s of staged) { s.want = order ? 1 : 0; s.at = clock + (order ? s.delay : (last - s.delay) * .4); }
      }
      if (order !== (orderAt >= 0)) orderAt = order ? clock : -Infinity;
      if (reduced) grow.snap(reveal || order ? CUBE_GROW : 1); else grow.step(reveal || order ? CUBE_GROW : 1, dt);
      live(dt, time, reduced);
      cradle.update(reveal || order, dt, reduced, time);
      if (settled && order && Math.abs(open.value) < .001) return;
      let moving = false;
      for (const s of staged) {
        // Reduced motion draws only on scroll, so nothing may wait on a delay: go straight to the end.
        if (reduced || clock >= s.at) s.goal = s.want; else moving = true;
        if (reduced) s.spring.snap(s.goal);
        else moving = s.spring.step(s.goal, dt) || moving;
      }
      // The pencil is up while the brief is being written, then laid back down.
      const since = clock - orderAt, penGoal = order && since > .3 && since < 1.75 ? 1 : 0;
      writingHead(tip);
      if (reduced) { pen.snap(0); head.forEach((s, k) => s.snap(tip.getComponent(k))); }
      else {
        moving = pen.step(penGoal, dt) || moving;
        head.forEach((s, k) => { moving = s.step(tip.getComponent(k), dt) || moving; });
      }
      apply(dt, time, reduced);
      settled = !moving;
    },
    dispose() {
      cradle.dispose();
      holder.removeFromParent();
      notes?.dispose(); drafts?.dispose();
      disposables.forEach(d => d.dispose());
    },
  };
}
