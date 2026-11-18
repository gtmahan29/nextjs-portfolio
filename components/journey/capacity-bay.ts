import * as THREE from "three";
import { createSpring, springCurve } from "./motion-curve";
import { loadStudio } from "./studio-kit";

/*
 * Motion score for Growing. Entering the station starts the timed cycle.
 * Beat         Pattern     Motion                                     Start (s)
 * Demand       P3 / P16    Gauge fills. Requests flow to the primary.  .22 + .12 per light
 * Expand       P12         Hatches split open and racks rise.         .91 / 1.64, 1.87 / 2.60
 * Connect      P3 / P16    Rack lamps light, then traffic joins.       2.94 / 3.90
 * Roll out     P12 / P16   The spare racks serve while the core       4.12 reroute, 5.72 / 6.60 tray
 *                          draws out and reseats.
 * Restore      P3 / P16    The primary rejoins live service.           7.40
 *
 * Scroll back to rewind the equipment. Reduced motion shows all three racks
 * online in the final pose. The existing station arrival cue owns sound.
 */

const MODEL = "/models/journey/capacity-bay.glb?v=1";
const ANIMATED = /^(Rack[0-2]|Hatch[12](Back|Front)|Demand[0-5])$/;
const COMPLETE = 8;
const READY = [0, 2.94, 3.90] as const;
const REROUTE = 4.12;
const RESTORE = 7.40;
const RESERVE_RACKS = [1, 2] as const;

const springMove = (time: number, at: number, duration: number) => springCurve((time - at) / duration);

export function capacityPose(time: number) {
  const expand = (i: number) => {
    const start = .91 + i * .96;
    return {
      rear: 2.25 * springMove(time, start, .62),
      front: 2.25 * springMove(time, start + .10, .62),
      lift: -8 + 8 * springMove(time, start + .73, 1.3),
      lamp: springMove(time, READY[i + 1], .52),
    };
  };
  return {
    demand: Array.from({ length: 6 }, (_, i) => i < 2 ? 1 : springMove(time, .22 + (i - 2) * .12, .52)),
    reserves: RESERVE_RACKS.map((_, i) => expand(i)),
    primary: time < RESTORE ? 1 - springMove(time, 4.93, .54) : springMove(time, RESTORE, .56),
    tray: time < 6.60 ? 2.20 * springMove(time, 5.72, .75) : 2.20 * (1 - springMove(time, 6.60, .80)),
  };
}

// Paths follow the inlaid channels and terminate inside their rack docks.
const QUEUE = [[0, 8.58], [0, 4.45]] as const;
const LOCATIONS = [
  [...QUEUE, [-6.38, 4.45], [-9, 2.38], [-9, .44]],
  [...QUEUE, [0, .44]],
  [...QUEUE, [6.38, 4.45], [9, 2.38], [9, .44]],
];
function makeTraffic() {
  const geometry = new THREE.SphereGeometry(.17, 10, 6);
  const material = new THREE.MeshBasicMaterial({ color: 0xffbe56, toneMapped: false });
  const lights = new THREE.InstancedMesh(geometry, material, 12);
  lights.count = 0;
  lights.frustumCulled = false;
  lights.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const routes = LOCATIONS.map(() => new THREE.CurvePath<THREE.Vector3>());
  LOCATIONS.forEach((points, route) => {
    for (let i = 1; i < points.length; i++) {
      const [x, z] = points[i - 1];
      const [endX, endZ] = points[i];
      routes[route].add(new THREE.LineCurve3(new THREE.Vector3(x, 1.41, z), new THREE.Vector3(endX, 1.41, endZ)));
    }
  });
  const transform = new THREE.Object3D();
  const origin = new THREE.Vector3();
  const next = new THREE.Vector3();
  const packets: { route: number; age: number }[] = [];
  let nextRequest = 0;
  let routeIndex = 0;

  function render(dt: number, showTime: number) {
    nextRequest -= dt;
    if (nextRequest <= 0 && packets.length < lights.instanceMatrix.count) {
      const primaryOnline = showTime < REROUTE || showTime >= RESTORE;
      const online = [
        ...(primaryOnline ? [0] : []),
        ...(showTime >= READY[1] + .37 ? [1] : []),
        ...(showTime >= READY[2] + .37 ? [2] : []),
      ];
      packets.push({ route: online[routeIndex++ % online.length], age: 0 });
      nextRequest = showTime < .60 ? .62 : .31;
    }
    let count = 0;
    for (let i = packets.length - 1; i >= 0; i--) {
      const packet = packets[i];
      packet.age += dt;
      const route = routes[packet.route];
      const t = packet.age / (.65 + route.getLength() / 18);
      if (t >= 1) { packets.splice(i, 1); continue; }
      // The first rise of the shared spring carries the request into the socket.
      const position = springCurve(t * .31) / springCurve(.31);
      route.getPoint(position, origin);
      route.getPoint(Math.min(position + .015, 1), next);
      transform.position.copy(origin);
      transform.rotation.y = Math.atan2(next.x - origin.x, next.z - origin.z);
      transform.scale.set(.83, .7, 2.15);
      transform.updateMatrix();
      lights.setMatrixAt(count++, transform.matrix);
    }
    lights.count = count;
    lights.instanceMatrix.needsUpdate = true;
  }

  return {
    lights,
    render,
    clear() { lights.count = 0; packets.length = 0; nextRequest = 0; },
    dispose() { lights.dispose(); geometry.dispose(); material.dispose(); },
  };
}

export function createCapacityBay(holder: THREE.Group) {
  const controller = new AbortController();
  const playback = createSpring(0);
  const resources = new Set<{ dispose(): void }>();
  let clock = 0;
  let drawnAt = -1;
  let pending: Promise<void> | undefined;
  let draw: ((time: number) => void) | undefined;
  let traffic: ReturnType<typeof makeTraffic> | undefined;
  holder.visible = false;

  function free() {
    holder.clear();
    resources.forEach(resource => resource.dispose());
    resources.clear();
  }

  return {
    load(prepare: (root: THREE.Group) => Promise<unknown>) {
      pending ??= (async () => {
        try {
          const kit = await loadStudio(holder, MODEL, ANIMATED, controller.signal);
          kit.disposables.forEach(resource => resources.add(resource));
          controller.signal.throwIfAborted();
          const node = (name: string) => {
            const object = kit.find(name);
            if (!object) throw new Error(`Missing capacity bay node "${name}"`);
            return object;
          };
          const lamp = (name: string) => {
            const object = node(name);
            const materials = new Map<THREE.Material, THREE.MeshStandardMaterial>();
            object.traverse(mesh => {
              if (!(mesh instanceof THREE.Mesh) || !(mesh.material instanceof THREE.MeshStandardMaterial)) return;
              const original = mesh.material;
              let material = materials.get(original);
              if (!material) {
                material = original.clone();
                materials.set(original, material);
                resources.add(material);
              }
              mesh.material = material;
            });
            const dark = new THREE.Color(0x4b301e);
            const lit = new THREE.Color(0xffa63b);
            return (power: number) => {
              materials.forEach(material => {
                material.color.lerpColors(dark, lit, THREE.MathUtils.clamp(power, 0, 1));
                material.emissiveIntensity = Math.max(0, power) * 1.55;
              });
            };
          };
          const reserves = RESERVE_RACKS.map(i => {
            const rack = node(`Rack${i}`);
            const rear = node(`Hatch${i}Back`);
            const front = node(`Hatch${i}Front`);
            return {
              rack, rear, front, lamp: lamp(`RackLamp${i}`),
              rackHome: rack.position.y, rearHome: rear.position.z, frontHome: front.position.z,
            };
          });
          const primary = lamp("RackLamp0");
          const demand = Array.from({ length: 6 }, (_, i) => lamp(`Demand${i}`));
          const blade = node("ServiceBlade");
          const bladeHome = blade.position.z;
          traffic = makeTraffic();
          holder.add(traffic.lights);
          resources.add(traffic);

          draw = time => {
            const pose = capacityPose(time);
            reserves.forEach(({ rack, rear, front, lamp, rackHome, rearHome, frontHome }, i) => {
              const position = pose.reserves[i];
              rack.position.y = rackHome + position.lift;
              rack.visible = position.lift > -7.68;
              rear.position.z = rearHome - position.rear;
              front.position.z = frontHome + position.front;
              lamp(position.lamp);
            });
            primary(pose.primary);
            blade.position.z = bladeHome + pose.tray;
            demand.forEach((set, i) => set(pose.demand[i]));
          };
          await prepare(holder);
          controller.signal.throwIfAborted();
          draw(clock);
          holder.visible = true;
        } catch (error) {
          free();
          draw = undefined;
          traffic = undefined;
          if (!controller.signal.aborted) console.error("Capacity bay:", error);
        }
      })();
      return pending;
    },
    update(progress: number, arrived: boolean, dt: number, reduced: boolean) {
      const past = progress >= .769;
      const target = arrived || past ? COMPLETE : 0;
      if (reduced || past || progress <= .63) {
        clock = target;
        playback.snap(0);
      } else if (holder.visible && clock !== target) {
        const direction = Math.sign(target - clock);
        if (playback.value === 0) playback.snap(direction);
        else playback.step(direction, dt);
        clock = THREE.MathUtils.clamp(clock + playback.value * dt, 0, COMPLETE);
        if (clock === target) playback.snap(0);
      }
      if (!holder.visible) return;
      if (draw && drawnAt !== clock) {
        draw(clock);
        drawnAt = clock;
      }
      if (!reduced && progress > .65 && progress < .785) traffic?.render(dt, clock);
      else if (traffic?.lights.count) traffic.clear();
    },
    dispose() {
      controller.abort();
      holder.removeFromParent();
      holder.visible = false;
      if (pending) void pending.then(free);
      else free();
    },
  };
}
