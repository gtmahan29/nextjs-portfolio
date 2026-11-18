import * as THREE from "three";
import { createSpring } from "./motion-curve";
import { loadStudio } from "./studio-kit";

/*
Station 05, Growing: "What happens when more people show up?"
Built in Blender (design/journey/capacity-field.blend → public/models/journey/capacity-field.glb).

Visitors arrive as packets of light through two ingress gates. A hexagonal load balancer takes each
one and sends it down a lit lane to a server. Three servers are online; when you arrive the traffic
surges, the hub's load ring fills, floor hatches slide open and three more servers rise into the
gaps (autoscaling), their lanes light and traffic spreads across all six (load balancing). Then the
servers update one at a time: each sinks, its ring turns from orange (v1) to mint (v2) and it rises
again, while traffic flows around it (rolling release). Scrolling back undoes it.

MOTION SCORE (seconds after arrival; springs on the shared curve; packets are a P16 loop)
| t (s)          | Element             | Pattern | Goal                                      |
| 0              | traffic             | P16     | 2.5 → 10 packets/s; hub load ring fills    |
| .7 + .35·i     | hatches 2, 4, 6     | P12     | slide open                                 |
| .95 + .35·i    | servers 2, 4, 6     | P12     | rise out of the floor, pop k=3 at the top   |
| 1.2 + .35·i    | their lanes         | P11     | light; routing includes them               |
| 4 + 1.1·k      | server k            | P12     | sinks, flips v1 → v2, rises; lane dims     |
Reduced motion: final state, packets still (no flow).
*/

const MODEL = "/models/journey/capacity-field.glb?v=1";
const SCALE = 1.15;
const ANIMATED = /^(Hub_Crown|Hub_Seg_\d+|Server_\d|Hatch_\d_[LR])$/;
const ORANGE = new THREE.Color("#f97316"), MINT = new THREE.Color("#10b981"), IDLE = new THREE.Color("#9aa4b2");
const SCALED = [2, 4, 6];
const MAX = 120, SPEED = 7.5, PACKET_Y = .3;

type Spring = ReturnType<typeof createSpring>;
type Server = {
  k: number; obj: THREE.Object3D; restY: number; ring: THREE.MeshStandardMaterial; lane: THREE.MeshStandardMaterial;
  path: THREE.CatmullRomCurve3; length: number; rise: Spring; hatch: Spring; update: Spring; hit: Spring;
  hatches: [THREE.Object3D, number][]; v2: boolean; load: number;
};

export function createCapacityField(root: THREE.Group) {
  const holder = new THREE.Group();
  holder.name = "Capacity field";
  holder.scale.setScalar(SCALE);
  root.add(holder);
  const disposables: { dispose(): void }[] = [];
  let built = false, ordered = false, clock = 0, spawnDebt = 0, rr = 0;

  const servers: Server[] = [];
  const ingress: { path: THREE.CatmullRomCurve3; length: number }[] = [];
  const segments: THREE.Mesh[] = [];
  let crown: THREE.Object3D | undefined, lit: THREE.MeshStandardMaterial | undefined, idle: THREE.MeshStandardMaterial | undefined;
  let packets: THREE.InstancedMesh | undefined;
  const pool: { on: boolean; gate: number; server: number; phase: number; d: number }[] = [];
  const load = createSpring(.3);

  const ready = loadStudio(holder, MODEL, ANIMATED).then(kit => {
    disposables.push(...kit.disposables);
    const at = (name: string) => { const o = kit.find(name); return o ? kit.local(o).p : new THREE.Vector3(); };
    const floor = at("Hub").y;
    const hub = at("Hub_Core").setY(floor + PACKET_Y);
    const hubC = at("Hub").setY(floor + PACKET_Y);
    crown = kit.find("Hub_Crown");
    const laneMat = () => { const m = new THREE.MeshStandardMaterial({ color: "#3a4252", emissive: ORANGE, emissiveIntensity: 0, roughness: .4 }); disposables.push(m); return m; };
    const lane = (curve: THREE.CatmullRomCurve3, material: THREE.Material) => {
      const pts = curve.getPoints(48).map(p => p.clone().setY(floor + .05));
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, .055, 6, false);
      disposables.push(g);
      const mesh = new THREE.Mesh(g, material); holder.add(mesh); return mesh;
    };
    // Ingress: from beyond each gate, through it, into the hub.
    for (const side of ["L", "R"]) {
      const a = at(`Gate_${side}_In`).setY(floor + PACKET_Y), b = at(`Gate_${side}_Out`).setY(floor + PACKET_Y);
      const into = b.clone().sub(hubC).setY(0).normalize().multiplyScalar(2.9).add(hubC);
      const path = new THREE.CatmullRomCurve3([a, b, b.clone().lerp(into, .5).add(new THREE.Vector3(0, 0, 0)), into], false, "centripetal");
      ingress.push({ path, length: path.getLength() });
      const m = laneMat(); m.emissiveIntensity = 1.4; lane(path, m);
    }
    for (let k = 1; k <= 6; k++) {
      const obj = kit.find(`Server_${k}`), ringMesh = kit.find(`Server_${k}_Ring`) as THREE.Mesh | undefined;
      if (!obj || !ringMesh) continue;
      const port = at(`Server_${k}_Port`).setY(floor + PACKET_Y);
      const out = port.clone().sub(hubC).setY(0).normalize().multiplyScalar(2.9).add(hubC);
      const mid = out.clone().lerp(port, .5);
      const path = new THREE.CatmullRomCurve3([out, mid, port], false, "centripetal");
      const ring = (ringMesh.material as THREE.MeshStandardMaterial).clone(); ringMesh.material = ring; disposables.push(ring);
      // Every LED on the server follows its ring.
      obj.traverse(o => { if (o instanceof THREE.Mesh && o.name.startsWith(`Server_${k}_Led_`)) o.material = ring; });
      const laneMaterial = laneMat(); lane(path, laneMaterial);
      const hatches: [THREE.Object3D, number][] = [];
      for (const s of ["L", "R"] as const) { const h = kit.find(`Hatch_${k}_${s}`); if (h) hatches.push([h, h.position.x]); }
      const scaled = SCALED.includes(k);
      servers.push({ k, obj, restY: obj.position.y, ring, lane: laneMaterial, path, length: path.getLength(),
        rise: createSpring(scaled ? 0 : 1), hatch: createSpring(scaled ? 0 : 1), update: createSpring(0), hit: createSpring(0), hatches, v2: false, load: 0 });
    }
    for (let k = 1; k <= 12; k++) { const m = kit.find(`Hub_Seg_${k}`) as THREE.Mesh | undefined; if (m) segments.push(m); }
    idle = segments[0]?.material as THREE.MeshStandardMaterial | undefined;
    lit = new THREE.MeshStandardMaterial({ color: ORANGE, emissive: ORANGE, emissiveIntensity: 2.2, roughness: .3 }); disposables.push(lit);

    const geometry = new THREE.SphereGeometry(.16, 12, 8);
    const material = new THREE.MeshBasicMaterial({ color: "#fdba74", toneMapped: false });
    packets = new THREE.InstancedMesh(geometry, material, MAX);
    packets.frustumCulled = false; packets.count = MAX;
    holder.add(packets); disposables.push(geometry, material);
    for (let i = 0; i < MAX; i++) pool.push({ on: false, gate: 0, server: 0, phase: 0, d: 0 });
    built = true;
    apply(0, true);
  }).catch(error => console.error("Capacity field:", error));

  // --- timeline ---
  const scaledIndex = (k: number) => SCALED.indexOf(k);
  const updateStart = (k: number) => 4 + (k - 1) * 1.1;
  const healthy = (s: Server) => s.rise.value > .9 && !(ordered && clock >= updateStart(s.k) && clock < updateStart(s.k) + 1.0);

  const m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), scale = new THREE.Vector3(), q = new THREE.Quaternion();
  function apply(dt: number, reduced: boolean) {
    for (const s of servers) {
      const r = s.rise.value, u = Math.max(0, s.update.value);
      s.obj.position.y = s.restY - (1 - Math.min(1, r)) * 4.2 - u * .9;
      // The pop is inside the rise: past the top it swells a touch, then settles.
      s.obj.scale.setScalar(1 + Math.max(0, r - 1) * 3 * .2);
      s.obj.visible = r > .02;
      for (const [h, x] of s.hatches) h.position.x = x * (1 + Math.min(1, Math.max(0, s.hatch.value)) * 2.15);
      const color = s.v2 ? MINT : ORANGE;
      s.ring.color.copy(color); s.ring.emissive.copy(color);
      s.ring.emissiveIntensity = 1.6 + Math.max(0, s.hit.value) * 2.5 - u * 1.4;
      s.lane.emissive.copy(color);
      s.lane.emissiveIntensity = healthy(s) ? 1.3 : .15;
    }
    const lv = THREE.MathUtils.clamp(load.value, 0, 1);
    segments.forEach((m, i) => { m.material = (i + .5) / segments.length < lv ? lit! : idle!; });
    if (crown && !reduced) crown.rotation.y += dt * (.6 + lv * 2.6);
    if (!packets) return;
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (!p.on || reduced) { packets.setMatrixAt(i, m4.makeScale(0, 0, 0)); continue; }
      const path = p.phase === 0 ? ingress[p.gate].path : servers[p.server].path;
      const L = p.phase === 0 ? ingress[p.gate].length : servers[p.server].length;
      path.getPointAt(Math.min(1, p.d / L), pos);
      packets.setMatrixAt(i, m4.compose(pos, q, scale.setScalar(1)));
    }
    packets.instanceMatrix.needsUpdate = true;
  }

  function flow(dt: number) {
    const rate = ordered ? (clock < .4 ? 4 : 10) : 2.5;
    spawnDebt += dt * rate;
    while (spawnDebt >= 1) {
      spawnDebt -= 1;
      const free = pool.find(p => !p.on);
      if (!free) break;
      Object.assign(free, { on: true, gate: Math.random() < .5 ? 0 : 1, phase: 0, d: 0 });
    }
    for (const p of pool) {
      if (!p.on) continue;
      p.d += dt * SPEED;
      if (p.phase === 0 && p.d >= ingress[p.gate].length) {
        // The balancer picks the next healthy server, in turn.
        const ok = servers.filter(healthy);
        if (!ok.length) { p.on = false; continue; }
        rr = (rr + 1) % ok.length;
        p.server = servers.indexOf(ok[rr]); p.phase = 1; p.d = 0;
      } else if (p.phase === 1 && p.d >= servers[p.server].length) {
        p.on = false; servers[p.server].hit.kick(6);
      }
    }
  }

  return {
    ready,
    /** order: the camera has arrived. near: the station is close enough to be worth animating. */
    update(order: boolean, near: boolean, dt: number, reduced: boolean) {
      if (!built || (!near && !order)) return;
      if (order !== ordered) {
        ordered = order; clock = 0;
        if (!order) for (const s of servers) s.v2 = false;
      }
      clock += dt;
      // Reduced motion draws only on scroll: jump past the timeline to its final state.
      if (reduced && ordered) clock = Math.max(clock, 20);
      const step = (sp: Spring, goal: number) => { if (reduced) sp.snap(goal); else sp.step(goal, dt); };
      for (const s of servers) {
        const i = scaledIndex(s.k);
        const scaledGoal = i < 0 ? 1 : ordered && clock >= .95 + i * .35 ? 1 : 0;
        const hatchGoal = i < 0 ? 1 : ordered ? (clock >= .7 + i * .35 ? 1 : 0) : (s.rise.value < .05 ? 0 : 1);
        step(s.rise, scaledGoal);
        step(s.hatch, hatchGoal);
        const t0 = updateStart(s.k), updating = ordered && clock >= t0 && clock < t0 + .55;
        step(s.update, updating ? 1 : 0);
        if (ordered && clock >= t0 + .5) s.v2 = true;
        if (reduced && ordered) s.v2 = true;
        if (reduced) s.hit.snap(0); else s.hit.step(0, dt);
      }
      step(load, !ordered ? .3 : clock < 2.2 ? 1 : .82);
      if (!reduced) flow(dt);
      apply(dt, reduced);
    },
    dispose() { holder.removeFromParent(); disposables.forEach(d => d.dispose()); },
  };
}
