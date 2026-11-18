import * as THREE from "three";
import { createSpring } from "./motion-curve";
import { productFallback, productPhone, releaseMonitor } from "./release-screens";
import { loadStudio } from "./studio-kit";
import { loadReleaseDevice, mountReleaseDevice } from "./release-devices";
import { disposeSceneResources } from "./scene-resources";

/*
 * Motion score for the Phase 6 model. Native scroll selects the beat.
 * Go live    P12   Laptop opens, phone tilts up               0 / .22 s
 * Go live    P4    Product loads onto both screens            .42 / .68 s
 * Monitor    P4    Release checks wipe into the laptop       0 s
 * Hand over  P12   Folio slides in, cover opens               0 / .31 s
 * Hand over  P12   Repository, accounts and runbook slide out .59 + .09 s each
 *
 * Reversing seats the cards ahead of closing the folio. Reduced motion and
 * skipped beats display their complete pose. Sound uses the Journey arrival cue.
 */

const MODEL = "/models/journey/release-desk.glb?v=5";
const ANIMATED = /^OwnershipFolio$/;
const CUES = {
  laptop: [[0, 0, .21]],
  phone: [[0, .22, .12]],
  screens: [[0, .42, 0], [0, .68, 0]],
  health: [[1, 0, 0]],
  folio: [[2, 0, .61]],
  cover: [[2, .31, .32]],
  cards: [[2, .59, .13], [2, .68, .07], [2, .77, 0]],
};

export function createReleaseMotion() {
  const makeTrack = ([beat, enter, exit]: number[]) =>
    ({ beat, enter, exit, goal: 0, delay: 0, spring: createSpring(0) });
  const tracks = {
    laptop: CUES.laptop.map(makeTrack),
    phone: CUES.phone.map(makeTrack),
    screens: CUES.screens.map(makeTrack),
    health: CUES.health.map(makeTrack),
    folio: CUES.folio.map(makeTrack),
    cover: CUES.cover.map(makeTrack),
    cards: CUES.cards.map(makeTrack),
  };
  const all = Object.values(tracks).flat();
  let previous: number | undefined;
  return {
    value: (channel: keyof typeof tracks, index = 0) => tracks[channel][index].spring.value,
    update(beat: number, dt: number, reduced: boolean, immediate: boolean) {
      const snap = reduced || immediate || previous === undefined || Math.abs(beat - previous) > 1;
      let dirty = previous !== beat;
      previous = beat;
      all.forEach(track => {
        const goal = Number(beat >= track.beat);
        if (snap) {
          dirty = dirty || track.spring.value !== goal;
          track.goal = goal;
          track.delay = 0;
          track.spring.snap(goal);
          return;
        }
        if (track.goal !== goal) {
          track.delay = goal ? track.enter : track.exit;
          track.goal = goal;
        }
        const stepTime = Math.max(0, dt - track.delay);
        track.delay = Math.max(0, track.delay - dt);
        if (stepTime && (track.spring.value !== goal || track.spring.velocity !== 0)) {
          track.spring.step(goal, stepTime);
          dirty = true;
        }
      });
      return dirty;
    },
  };
}

export function createReleaseDesk(holder: THREE.Group) {
  const controller = new AbortController();
  const motion = createReleaseMotion();
  const resources = new Set<{ dispose(): void }>();
  let pending: Promise<void> | undefined;
  let draw: (() => void) | undefined;
  holder.visible = false;

  const disposeModel = () => {
    holder.clear();
    resources.forEach(resource => resource.dispose());
    resources.clear();
  };

  return {
    load(prepare: (group: THREE.Group) => Promise<unknown>, compact: boolean) {
      pending ??= (async () => {
        try {
          const trackDevice = (model: THREE.Group) => {
            resources.add({ dispose: () => disposeSceneResources(model) });
            return model;
          };
          const results = await Promise.allSettled([
            loadStudio(holder, MODEL, ANIMATED, controller.signal).then(kit => {
              kit.disposables.forEach(resource => resources.add(resource));
              return kit;
            }),
            loadReleaseDevice("macbook", compact, controller.signal).then(trackDevice),
            loadReleaseDevice("iphone", compact, controller.signal).then(trackDevice),
          ] as const);
          const [desk, computer, handset] = results;
          if (desk.status === "rejected") throw desk.reason;
          if (computer.status === "rejected") throw computer.reason;
          if (handset.status === "rejected") throw handset.reason;
          const kit = desk.value;
          controller.signal.throwIfAborted();
          const find = (name: string) => {
            const object = kit.find(name);
            if (!object) throw new Error(`Missing release desk node "${name}"`);
            return object;
          };
          const phone = find("PhoneMount");
          const phoneSeatY = phone.position.y;
          const laptopMesh = mountReleaseDevice(computer.value, find("LaptopMount"), "macbook");
          const phoneMesh = mountReleaseDevice(handset.value, phone, "iphone");
          const laptop = computer.value.getObjectByName("lid");
          if (!laptop) throw new Error("Missing showroom laptop hinge");
          const openAngle = laptop.rotation.x;
          const folio = find("OwnershipFolio");
          const cover = find("FolioCover");
          const folioX = folio.position.x;
          const folioZ = folio.position.z;
          const cards = Array.from({ length: 3 }, (_, i) => {
            const object = find(`OwnershipCard${i}`);
            return { object, x: object.position.x, y: object.position.y, z: object.position.z };
          });

          let image: HTMLImageElement | undefined;
          const product = await new THREE.TextureLoader().loadAsync("/work/aaq-gold.png").then(texture => {
            image = texture.image;
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = 4;
            return texture;
          }).catch(productFallback);
          resources.add(product);
          controller.signal.throwIfAborted();

          const production = releaseMonitor();
          resources.add(production);
          const screen = (mesh: THREE.Mesh, map: THREE.Texture, dashboard = map) => {
            const reveal = { value: 0 };
            const status = { value: 0 };
            const material = new THREE.MeshBasicMaterial({ map, toneMapped: false });
            material.onBeforeCompile = shader => {
              shader.uniforms.uScreenReveal = reveal;
              shader.uniforms.uMonitorAmount = status;
              shader.uniforms.uDashboard = { value: dashboard };
              shader.fragmentShader = "uniform float uScreenReveal; uniform float uMonitorAmount; uniform sampler2D uDashboard;\n" + shader.fragmentShader.replace(
                "#include <map_fragment>",
                `#include <map_fragment>
                  if (vMapUv.x < uMonitorAmount) diffuseColor.rgb = texture2D(uDashboard, vMapUv).rgb;
                  if (vMapUv.y > uScreenReveal) diffuseColor.rgb = vec3(.009, .012, .015);`,
              );
            };
            for (const old of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) resources.add(old);
            mesh.material = material;
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            return (value: number, monitoring = 0) => {
              reveal.value = THREE.MathUtils.clamp(value, 0, 1);
              status.value = THREE.MathUtils.clamp(monitoring, 0, 1);
            };
          };
          const desktopScreen = screen(laptopMesh, product, production);
          resources.delete(product);
          const phoneScreen = screen(phoneMesh, productPhone(image));

          const v = motion.value;
          draw = () => {
            laptop.rotation.x = THREE.MathUtils.lerp(Math.PI / 2, openAngle, THREE.MathUtils.clamp(v("laptop"), 0, 1));
            const phoneTilt = THREE.MathUtils.clamp(v("phone"), 0, 1);
            phone.rotation.x = THREE.MathUtils.lerp(-.38, -.11, phoneTilt);
            phone.position.y = phoneSeatY + THREE.MathUtils.lerp(.030, -.010, phoneTilt);
            desktopScreen(v("screens", 0), v("health"));
            phoneScreen(v("screens", 1));
            folio.position.x = folioX - .67 * v("folio");
            folio.position.z = folioZ + 2.02 * v("folio");
            const opening = THREE.MathUtils.clamp(v("cover"), 0, 1);
            cover.rotation.x = -1.13 * opening;
            // Retract the cards into the tray before the cover reaches them.
            const clearance = THREE.MathUtils.smootherstep(opening, .12, .35);
            cards.forEach(({ object, x, y, z }, i) => {
              const exposing = Math.max(0, v("cards", i)) * clearance;
              object.position.set(x + (i - 1) * .10 * exposing, y + .045 * exposing, z + (1.40 - i * .07) * exposing);
              object.rotation.y = (i - 1) * .10 * exposing;
            });
          };

          await prepare(holder);
          controller.signal.throwIfAborted();
          draw();
          holder.visible = true;
        } catch (error) {
          disposeModel();
          draw = undefined;
          if (!controller.signal.aborted) console.error("Release desk:", error);
        }
      })();
      return pending;
    },
    update(beat: number, dt: number, reduced: boolean, immediate: boolean) {
      if (motion.update(beat, dt, reduced, immediate)) draw?.();
    },
    dispose() {
      controller.abort();
      holder.visible = false;
      holder.removeFromParent();
      if (pending) void pending.then(disposeModel);
      else disposeModel();
    },
  };
}
