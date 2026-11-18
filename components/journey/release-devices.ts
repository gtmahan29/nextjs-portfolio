import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import assets from "./imported-models/asset-manifest.json";
import { sceneDecoder } from "./scene-decoder";

type ReleaseDevice = "macbook" | "iphone";

export async function loadReleaseDevice(kind: ReleaseDevice, compact: boolean, signal: AbortSignal) {
  const models = kind === "macbook"
    ? [assets.showroomMacbook, assets.showroomMacbookLow]
    : [assets.showroomIphone, assets.showroomIphoneLow];
  const response = await fetch(models[compact ? 1 : 0].url, { signal });
  if (!response.ok) throw new Error(`Release ${kind} HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  signal.throwIfAborted();
  return (await new GLTFLoader().setMeshoptDecoder(sceneDecoder()).parseAsync(buffer, "")).scene;
}

/** Fit the showroom geometry to its own desk area and retain its original screen and pivots. */
export function mountReleaseDevice(model: THREE.Group, mount: THREE.Object3D, kind: ReleaseDevice) {
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = kind === "macbook" ? 11.65 / size.x : 4.85 / size.y;
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -bounds.min.y * scale, 0);

  let screen: THREE.Mesh | undefined;
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object.userData.showroomScreen) screen = object;
    object.castShadow = object.userData.castShadow ?? true;
    object.receiveShadow = object.userData.receiveShadow ?? true;
    object.renderOrder = object.userData.renderOrder ?? 0;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (typeof material.userData.depthWrite === "boolean") material.depthWrite = material.userData.depthWrite;
      if (typeof material.userData.toneMapped === "boolean") material.toneMapped = material.userData.toneMapped;
      if (material instanceof THREE.MeshStandardMaterial && typeof material.userData.envMapIntensity === "number") {
        material.envMapIntensity = material.userData.envMapIntensity;
      }
    }
  });
  if (!screen) throw new Error(`Missing showroom screen on release ${kind}`);
  mount.add(model);
  return screen;
}
