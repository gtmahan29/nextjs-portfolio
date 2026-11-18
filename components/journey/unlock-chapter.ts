import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createJourneyDoor } from "./journey-door";
import { transferEase as ease } from "./laptop-transfer";
import { disposeSceneResources } from "./scene-resources";

export const UNLOCK_SCROLL_VH = 6.4;

export function createUnlockChapter(scene: THREE.Scene, center: THREE.Vector3, canvas: HTMLCanvasElement) {
  const root = new THREE.Group();
  root.name = "Unlock chapter";
  root.visible = false;
  scene.add(root);

  const door = createJourneyDoor();
  const key = new THREE.Group();
  key.name = "Traveling key";
  root.add(door.root, key);

  let keyReady = false;
  let disposed = false;
  let opening = 0;
  const keyUrl = "/golden-cube/golden-key.glb";
  new GLTFLoader().load(keyUrl, ({ scene: asset }) => {
    if (disposed) {
      disposeSceneResources(asset);
      return;
    }
    asset.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.renderOrder = 105;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        material.transparent = true;
        if (material instanceof THREE.MeshStandardMaterial) material.envMapIntensity = 1.4;
      }
    });
    key.add(asset);
    keyReady = true;
    window.dispatchEvent(new Event("journey-screen-visible"));
  }, undefined, error => {
    if (disposed) return;
    console.error("Unlock key failed", error);
    canvas.dataset.unlockError = keyUrl;
  });

  const axis = new THREE.Vector3(0, 0, 1);
  const align = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2));
  const spin = new THREE.Euler();
  const roll = new THREE.Quaternion();
  const previousView = new THREE.Quaternion();
  const socket = new THREE.Vector3(), tipOffset = new THREE.Vector3(), edge = new THREE.Vector3();
  const target = new THREE.Vector3(), cameraEnd = new THREE.Vector3();

  return {
    root,
    get opening() { return opening; },
    update(progress: number, camera: THREE.PerspectiveCamera, reduced: boolean, mobile: boolean) {
      const p = THREE.MathUtils.clamp(progress, 0, 1);
      root.visible = p > .001;
      opening = 0;
      if (!root.visible) return;

      const height = Math.max(14.5, 42 / camera.aspect);
      const width = height * camera.aspect;
      const doors = ease(.835, .995, p);
      const turn = ease(.747, .824, p);
      const descent = ease(.35, .62, p);
      const insert = ease(.64, .744, p);
      const settle = ease(.01, .16, p);
      door.fit(camera.aspect);
      door.root.visible = p >= .20;
      door.root.position.copy(center);
      door.root.position.y -= height * 1.65;
      door.root.scale.setScalar(height);
      const travel = door.pose(doors, turn);

      target.copy(center).lerp(door.root.position, descent);
      const fov = mobile ? 23 : 19;
      const distance = height / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)));
      cameraEnd.copy(target).addScaledVector(axis, distance);
      camera.position.lerp(cameraEnd, settle);
      camera.fov = THREE.MathUtils.lerp(camera.fov, fov, settle);
      camera.updateProjectionMatrix();
      previousView.copy(camera.quaternion);
      camera.lookAt(target);
      camera.quaternion.slerp(previousView, 1 - settle);
      camera.updateMatrixWorld(true);

      door.socket.getWorldPosition(socket);
      key.visible = keyReady && p > .16 && doors < 1;
      if (key.visible) {
        const flight = ease(.35, .63, p);
        const lift = ease(.24, .38, p);
        const alignAmount = ease(.50, .64, p);
        const scale = THREE.MathUtils.lerp(2.4, Math.min(1.75, height * .045), flight);
        key.scale.setScalar(scale);
        spin.set(reduced ? 0 : Math.sin(flight * Math.PI) * .45, reduced ? 0 : flight * Math.PI * 2, 0);
        key.quaternion.setFromEuler(spin).slerp(align, alignAmount);
        roll.setFromAxisAngle(axis, -turn * Math.PI / 2);
        key.quaternion.premultiply(roll);

        tipOffset.set(0, 1.2 * scale, 0).applyQuaternion(key.quaternion);
        const arc = reduced ? 0 : Math.sin(flight * Math.PI) * width * .035;
        const startY = target.y + THREE.MathUtils.lerp(.18, height * .23, lift);
        key.position.set(
          THREE.MathUtils.lerp(center.x, socket.x, flight) + arc - tipOffset.x,
          THREE.MathUtils.lerp(startY, socket.y, flight) - tipOffset.y,
          THREE.MathUtils.lerp(center.z + 3, socket.z + height * .04, flight),
        );
        // Once seated, the key turns with the cylinder and rides the left leaf.
        key.position.lerp(socket, insert);
      }

      // Project the actual inner edge after positioning the camera. The DOM page
      // behind the door clips to this gap, so it never spills over the moving leaves.
      if (doors > 0) {
        edge.copy(door.edge);
        edge.x += travel;
        door.root.localToWorld(edge).project(camera);
        opening = THREE.MathUtils.clamp(edge.x, 0, 1);
      }
      canvas.dataset.unlockState = JSON.stringify({ progress: p, keyReady, doors, turn, opening });
    },
    dispose() {
      disposed = true;
      root.removeFromParent();
      door.dispose();
      disposeSceneResources(key);
    },
  };
}
