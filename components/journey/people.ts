import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { createConversationCharacter, type CharacterAppearance, type CharacterMotion } from "./conversation-character";
import { HAIR_STYLES } from "./character-hair";
import { WALK_SPEED } from "./character-gait";
import type { DistrictSite } from "./district-buildings";

type Resident = { character: ReturnType<typeof createConversationCharacter>; phase: number; curve?: THREE.CatmullRomCurve3; length?: number; scale: number; station?: number; activity: CharacterMotion };
const SHIRTS = ["#859cab", "#d4b19a", "#78968a", "#d4c5a5", "#8c88a0", "#536f80", "#b88978", "#c6d2d1", "#989d78", "#b49fa5", "#667c9b", "#e1d3c4"];
const SKINS = ["#e4bda1", "#cb9a78", "#a97352", "#805239", "#f0d0b5", "#ba8664"];
const HAIR = ["#382b25", "#654735", "#9a7350", "#272526", "#b8a383", "#754c39"];
const OUTFITS = ["crew", "tee", "coat", "workwear"] as const;

/** Every resident uses the same tested skeleton, with independent clothes, colors and activity. */
export function createStudioPeople(scene: THREE.Scene, sites: DistrictSite[], route: [number, number][], stationIndices: number[]) {
  const residents: Resident[] = [];
  let nextResident = 0;
  const fixtures = new THREE.Group(); fixtures.name = "resident-workstations"; scene.add(fixtures);
  const fixtureGeometry = new RoundedBoxGeometry(1, 1, 1, 2, .04);
  const fixtureMaterials = ["#d2dee7", "#b3c5d3", "#647f92", "#edf3f5"].map(color => new THREE.MeshStandardMaterial({ color, roughness: .74 }));
  const appearance = (id: number): CharacterAppearance => ({
    outfit: OUTFITS[id % 4], detailedHair: false, shirt: SHIRTS[id % SHIRTS.length], pants: ["#495e6b", "#6f736b", "#a39887", "#677689", "#675e5c"][Math.floor(id / 2) % 5],
    skin: SKINS[id % SKINS.length], hair: HAIR[(id * 3 + Math.floor(id / 5)) % HAIR.length],
    hairStyle: HAIR_STYLES[(id + Math.floor(id / 4)) % HAIR_STYLES.length], shoes: ["#536776", "#a8aaa4", "#74675b"][id % 3],
  });
  const add = (id: number, position: THREE.Vector3, yaw: number, motion: CharacterMotion, phase: number) => {
    const character = createConversationCharacter(appearance(id));
    const scale = .94 + (id % 5) * .035;
    character.root.position.copy(position); character.root.rotation.y = yaw; character.root.scale.setScalar(scale);
    character.root.name = `resident-${id}-${motion}`;
    character.setMotion(motion); scene.add(character.root);
    const resident: Resident = { character, scale, phase, activity: motion }; residents.push(resident); return resident;
  };
  const workbench = (resident: Resident, low: boolean, shared = false) => {
    const group = new THREE.Group(); group.name = low ? "low-repair-bench" : "standing-console";
    group.position.copy(resident.character.root.position); group.rotation.y = resident.character.root.rotation.y;
    group.scale.setScalar(resident.scale); fixtures.add(group);
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat = 0, angle = 0) => {
      const mesh = new THREE.Mesh(fixtureGeometry, fixtureMaterials[mat]);
      mesh.position.set(x, y + h / 2, z); mesh.scale.set(w, h, d); mesh.rotation.x = angle;
      mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
    };
    const surface = low ? 1.065 : 1.705, z = low ? 1.24 : .95;
    box(0, surface - .09, z, 1.05, .09, .66);
    [-1, 1].forEach(side => box(side * .43, 0, z, .09, surface - .09, .48, 1));
    if (shared) {
      box(0, surface, z, .82, .022, .44, 3);
      box(.24, surface + .022, z, .18, .012, .25, 1);
    } else if (low) {
      box(0, surface, z + .12, .42, .12, .27, 2);
      box(.32, surface, z, .07, .025, .22, 2);
    } else {
      box(0, surface, z + .20, .07, .16, .07, 1);
      box(0, surface + .16, z + .21, .65, .42, .055, 2, -.13);
      box(0, surface + .18, z + .165, .57, .33, .025, 3, -.13);
      box(0, surface, z - .08, .60, .025, .20, 2);
    }
  };
  sites.forEach(({ x, z, heading }, station) => {
    const cs = Math.cos(heading), sn = Math.sin(heading);
    const at = (v: number, u: number, y = 0) => new THREE.Vector3(x + v * cs + u * sn, y, z - v * sn + u * cs);
    const spawn = (v: number, u: number, motion: CharacterMotion, yaw: number, y = 0, phase = 0) => {
      const resident = add(nextResident++, at(v, u, y), yaw, motion, phase + station * 1.7);
      resident.station = station; return resident;
    };
    const worker = (v: number, u: number, low: boolean, yaw: number, y = 0) =>
      workbench(spawn(v, u, low ? "bend" : "work", yaw, y, v * .13), low);
    const discussion = (positions: [number, number][], y = 0, oneSpeaker = false) => {
      const center = positions.reduce((sum, [v, u]) => sum.add(at(v, u, y)), new THREE.Vector3()).multiplyScalar(1 / positions.length);
      positions.forEach(([v, u], i) => {
        const point = at(v, u, y);
        spawn(v, u, oneSpeaker && i > 0 ? "idle" : "talk", Math.atan2(center.x - point.x, center.z - point.z), y, i * (positions.length === 2 ? 6 : 4));
      });
    };
    // Each station has its own composition and activity, rather than a repeated cast.
    if (station === 0) {
      discussion([[-18, -11], [-20, -10], [-19, -13]], 0, true);
      spawn(6, 8, "idle", heading + Math.PI, 2.2);
      worker(-21, 17, true, heading);
    } else if (station === 1) {
      const designer = spawn(8, -3.5, "work", heading + Math.PI / 2, 2.2);
      const colleague = spawn(8 + 1.9 * designer.scale, -3.5, "work", heading - Math.PI / 2, 2.2, 2.3);
      colleague.scale = designer.scale; colleague.character.root.scale.setScalar(designer.scale);
      workbench(designer, false, true);
      worker(-28, 27.5, false, heading + Math.PI);
      spawn(-22, 28, "idle", heading - Math.PI / 2);
      discussion([[18, 12], [20, 11]]);
    } else if (station === 2) {
      worker(-7.5, 7.5, true, heading - Math.PI / 2, 2.2);
      worker(6, 8, false, heading + Math.PI / 2, 2.2);
      worker(-20, 15, true, heading);
      worker(-18, 18, true, heading + .22);
      worker(-28, 27.5, false, heading + Math.PI);
      spawn(-24, 28, "idle", heading - Math.PI / 2);
    } else if (station === 3) {
      discussion([[-20, -10], [-18, -12], [-22, -12]], 0, true);
      // Include the upper bevel on the runtime station's square plinth.
      worker(-5, 7, false, heading + Math.PI / 2, 2.52);
      worker(-5, -7, false, heading + Math.PI / 2, 2.52);
      worker(-28, 27.5, false, heading + Math.PI);
      spawn(23, -20, "idle", heading + Math.PI);
    } else if (station === 4) {
      worker(-28, 27.5, false, heading + Math.PI);
      // This campus has ground-level tower courtyards, not an elevated plinth.
      worker(-15, -7, true, heading + Math.PI / 2);
      spawn(24, -12, "idle", heading + Math.PI / 2);
      // A busy campus: two people circulate between the annex and the service yard.
      const curve = new THREE.CatmullRomCurve3(Array.from({ length: 12 }, (_, i) => {
        const angle = i / 12 * Math.PI * 2;
        return at(-23 + Math.cos(angle) * 3, -11 + Math.sin(angle) * 6);
      }), true, "centripetal");
      for (const phase of [.12, .63]) {
        const walker = spawn(-23, -11, "walk", 0);
        walker.curve = curve; walker.length = curve.getLength(); walker.phase = phase;
      }
    } else {
      // Ground-level briefing beside the diorama, clear of its enlarged mobile footprint.
      discussion([[-8, -20], [-10, -18], [-11, -21], [-8.5, -23]], 0, true);
      worker(-28, 27.5, false, heading + Math.PI);
      spawn(22, -26, "idle", heading - Math.PI / 2);
    }
  });
  for (let gap = 0; gap < sites.length - 1; gap++) {
    const samples = route.slice(stationIndices[gap] + 1, stationIndices[gap + 1]);
    if (samples.length < 2) continue;
    const offsets = (side: number) => samples.map(([x, z], i) => {
      const previous = samples[Math.max(0, i - 1)], next = samples[Math.min(samples.length - 1, i + 1)];
      const tangent = new THREE.Vector2(next[0] - previous[0], next[1] - previous[1]).normalize();
      return new THREE.Vector3(x + tangent.y * side, 0, z - tangent.x * side);
    });
    const curve = new THREE.CatmullRomCurve3([...offsets(17), ...offsets(20).reverse()], true, "centripetal");
    // Quiet first gap, a technical service corridor, then busier late-stage routes.
    const traffic = [1, 0, 2, 1, 2][gap] ?? 1;
    for (let i = 0; i < traffic; i++) {
      const phase = (gap * .14 + i * .47) % 1;
      const resident = add(nextResident++, curve.getPointAt(phase), 0, "walk", 0);
      resident.curve = curve; resident.length = curve.getLength(); resident.phase = phase;
    }
  }
  const tangent = new THREE.Vector3(), point = new THREE.Vector3();
  const visibilitySphere = new THREE.Sphere(new THREE.Vector3(), 12);
  const animate = (time: number, reducedMotion: boolean, cameraPosition?: THREE.Vector3, frustum?: THREE.Frustum) => {
    residents.forEach(resident => {
      const { character, curve, scale, phase } = resident;
      // Pose time and travelled distance use the same speed, preserving foot contact.
      if (curve) {
        const cycle = phase + (reducedMotion ? 0 : time * WALK_SPEED * scale / resident.length!);
        const u = ((cycle % 1) + 1) % 1;
        curve.getPointAt(u, point); curve.getTangentAt(u, tangent);
        character.root.position.copy(point); character.root.rotation.y = Math.atan2(tangent.x, tangent.z);
      }
      visibilitySphere.center.copy(character.root.position); visibilitySphere.center.y += 5;
      character.root.visible = !frustum || frustum.intersectsSphere(visibilitySphere);
      if (character.root.visible && (!cameraPosition || character.root.position.distanceToSquared(cameraPosition) < 230 ** 2))
        character.update(time + (curve ? phase * 7 : phase), reducedMotion);
    });
  };
  animate(0, false);
  return Object.assign(animate, { residents, dispose: () => residents.forEach(r => r.character.dispose()) });
}
