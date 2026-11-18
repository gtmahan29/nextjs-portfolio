import * as THREE from "three";
import { createSpring, springCurve } from "./motion-curve";
import { loadStudio } from "./studio-kit";

/*
 * Motion score for Coming Alive. Scroll into the station to start the timed cycle.
 * Beat           Pattern   Motion                                     Start (s)
 * Load           P12       Pallet indexes from the infeed to center    .18
 * Locate         P12       Rear jaw, front jaw and probe align        1.16 / 1.27
 * Test           P12       Ram descends and probe sweeps the pads      1.88 / 2.48
 * Confirm        P3        Result lamps latch as the probe crosses     2.60 / 2.79 / 3.12
 * Release        P12       Ram retracts and jaws clear the pallet      3.80 / 4.12 / 4.23
 * Present        P12       Pallet indexes out and tilts the core       4.78 / 5.63
 *
 * On return toward phase 3 the cycle rewinds from its current pose.
 * Reduced motion shows the verified core on the outfeed. The arrival sound
 * comes from the existing Journey controls. The cycle adds no sound.
 */

const MODEL = "/models/journey/runtime-test-cell.glb?v=1";
const ANIMATED = /^(Carrier|Probe|ClampRear|ClampFront|Check[0-2])$/;
const COMPLETE = 6.7;
const TILT = 0.32;

type Cue = readonly [start: number, duration: number, from: number, to: number];

function move(time: number, [start, duration, from, to]: Cue) {
  return THREE.MathUtils.lerp(from, to, springCurve((time - start) / duration));
}

export function testCellPose(time: number) {
  const scanStart = 2.48;
  return {
    carrier: time < 4.78 ? move(time, [.18, .98, -8.5, 0]) : move(time, [4.78, 1.12, 0, 8.55]),
    rearJaw: time < 4.23 ? move(time, [1.16, .65, 0, 1.04]) : move(time, [4.23, .55, 1.04, 0]),
    frontJaw: time < 4.12 ? move(time, [1.27, .65, 0, 1.04]) : move(time, [4.12, .55, 1.04, 0]),
    probe: time < scanStart ? move(time, [1.27, .61, -2.7, -1.50]) : move(time, [scanStart, 1.50, -1.50, 1.50]),
    ram: time < 3.8 ? move(time, [1.88, .60, 0, 1.14]) : move(time, [3.8, .64, 1.14, 0]),
    beam: time < 3.64 ? move(time, [2.31, .24, 0, 1]) : move(time, [3.64, .16, 1, 0]),
    tilt: move(time, [5.63, 1.07, 0, TILT]),
    lamps: [2.60, 2.79, 3.12].map(at => Math.max(0, move(time, [at, .52, 0, 1]))),
    running: Math.max(0, move(time, [3.22, .52, 0, 1])),
  };
}

export function createRuntimeTestCell(root: THREE.Group) {
  const holder = new THREE.Group();
  holder.name = "Runtime test cell";
  holder.scale.setScalar(1.22);
  root.add(holder);

  let disposed = false;
  let clock = 0;
  let drawnAt = -1;
  let draw: ((time: number) => void) | undefined;
  const playback = createSpring(0);
  const resources = new Set<{ dispose(): void }>();

  const ready = loadStudio(holder, MODEL, ANIMATED).then(kit => {
    if (disposed) {
      holder.clear();
      new Set(kit.disposables).forEach(resource => resource.dispose());
      return;
    }
    kit.disposables.forEach(resource => resources.add(resource));
    const find = (name: string) => {
      const object = kit.find(name);
      if (!object) throw new Error(`Missing test cell node "${name}"`);
      return object;
    };
    const carrier = find("Carrier");
    const product = find("Product");
    const probe = find("Probe");
    const ram = find("Ram");
    const beam = find("Beam");
    const rear = find("ClampRear");
    const front = find("ClampFront");
    const rearHome = rear.position.z;
    const frontHome = front.position.z;
    const productHeight = product.position.y;

    const signal = (name: string) => {
      const group = find(name);
      let material: THREE.MeshStandardMaterial | undefined;
      group.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return;
        material ??= (node.material as THREE.MeshStandardMaterial).clone();
        node.material = material;
      });
      if (!material) throw new Error(`Missing test cell material on "${name}"`);
      const lamp = material;
      resources.add(lamp);
      const dark = new THREE.Color(0x123128);
      const lit = new THREE.Color(0x6cffb2);
      return (value: number) => {
        lamp.color.lerpColors(dark, lit, Math.min(1, value));
        lamp.emissiveIntensity = value * 2.5;
      };
    };
    const checks = ["Check0", "Check1", "Check2"].map(signal);
    const productSignal = signal("ProductSignal");

    beam.traverse(object => {
      object.castShadow = false;
    });

    draw = time => {
      const pose = testCellPose(time);
      carrier.position.x = pose.carrier;
      rear.position.z = rearHome + pose.rearJaw;
      front.position.z = frontHome - pose.frontJaw;
      probe.position.x = pose.probe;
      ram.position.y = -pose.ram;
      beam.visible = pose.beam > .02;
      beam.scale.y = Math.max(.001, pose.beam);
      product.rotation.x = pose.tilt;
      product.position.y = productHeight + 1.91 * Math.sin(pose.tilt);
      checks.forEach((set, i) => set(pose.lamps[i]));
      productSignal(pose.running);
    };
    draw(clock);
  }).catch(error => {
    holder.clear();
    resources.forEach(resource => resource.dispose());
    resources.clear();
    console.error("Runtime test cell:", error);
  });

  return {
    ready,
    update(progress: number, arrived: boolean, dt: number, reduced: boolean) {
      const target = arrived || progress >= .63 ? COMPLETE : 0;
      if (reduced || progress >= .63 || progress <= .49) {
        clock = target;
        playback.snap(0);
      } else if (clock !== target) {
        // Transport reversals keep their velocity. The machine's linked parts
        // stay on the same collision-free cue sequence even if scroll changes direction.
        const direction = Math.sign(target - clock);
        if (playback.value === 0) playback.snap(direction);
        else playback.step(direction, dt);
        clock = THREE.MathUtils.clamp(clock + playback.value * dt, 0, COMPLETE);
        if (clock === target) playback.snap(0);
      }
      if (draw && drawnAt !== clock) {
        draw(clock);
        drawnAt = clock;
      }
    },
    dispose() {
      disposed = true;
      holder.removeFromParent();
      holder.clear();
      resources.forEach(resource => resource.dispose());
      resources.clear();
    },
  };
}
