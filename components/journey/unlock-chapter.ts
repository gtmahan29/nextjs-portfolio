import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { transferEase as ease } from "./laptop-transfer";

export const UNLOCK_SCROLL_VH = 6.4;
export function unlockState(progress: number) {
  return {
    clear: ease(0,.14,progress), grow: ease(.01,.16,progress), open: ease(.22,.35,progress),
    fly: ease(.36,.64,progress), insert: ease(.65,.75,progress), turn: ease(.76,.83,progress),
    doors: ease(.84,.95,progress), content: ease(.89,.98,progress),
  };
}

export function createUnlockChapter(scene: THREE.Scene, center: THREE.Vector3, canvas: HTMLCanvasElement) {
  const root = new THREE.Group(); root.name = "Unlock chapter"; scene.add(root); root.visible = false;
  const key = new THREE.Group(); key.name = "Traveling key"; root.add(key);
  const doorCenter = center.clone().add(new THREE.Vector3(0,-28,0));
  const doors = new THREE.Group(); doors.name = "Double door stage";
  doors.position.copy(doorCenter).add(new THREE.Vector3(0,-6.9,0)); doors.scale.setScalar(3); root.add(doors);
  let left: THREE.Object3D | undefined, right: THREE.Object3D | undefined, lock: THREE.Object3D | undefined;
  const lockBaseScale = new THREE.Vector3();
  const lockBasePosition = new THREE.Vector3();
  const lockRestRotation = new THREE.Quaternion();
  let keyReady = false, doorsReady = false, disposed = false;
  const meshes: THREE.Mesh[] = [];
  const doorMaterials = new Set<THREE.Material>();
  const loader = new GLTFLoader();
  function load(url: string, parent: THREE.Group, ready: (asset: THREE.Group) => void) {
    loader.load(url, gltf => {
      if (disposed) { gltf.scene.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose()); } }); return; }
      gltf.scene.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return;
        meshes.push(o); o.renderOrder = parent === key ? 105 : 103;
        if(parent===doors && !Array.isArray(o.material) && o.material instanceof THREE.MeshStandardMaterial && o.material.name.startsWith("Door reference ")) {
          const original=o.material;
          o.material=new THREE.MeshBasicMaterial({map:original.map,toneMapped:false});
          original.dispose();
        }
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        materials.forEach(m => {
          m.transparent = true; m.opacity = 1; m.depthWrite = true;
          if(parent===doors)doorMaterials.add(m);
          if(m instanceof THREE.MeshStandardMaterial) {
            m.envMapIntensity=parent===doors?.65:1.4;
            if(m.name==="Door reference gold") {m.metalness=.5;m.emissive.set('#ffffff');m.emissiveMap=m.map;m.emissiveIntensity=.25;}
          }
        });
      });
      parent.add(gltf.scene); ready(gltf.scene);
      window.dispatchEvent(new Event("journey-screen-visible"));
    },undefined,error=>{console.error("Unlock asset failed",url,error);canvas.dataset.unlockError=url;});
  }
  load("/golden-cube/golden-key.glb",key,()=>{keyReady=true;});
  load("/golden-cube/golden-doors.glb",doors,asset=>{
    left=asset.getObjectByName("DoorHinge_left");right=asset.getObjectByName("DoorHinge_right");lock=asset.getObjectByName("LockRotor");doorsReady=!!left&&!!right&&!!lock;
    if(lock){lockBaseScale.copy(lock.scale);lockBasePosition.copy(lock.position);lockRestRotation.copy(lock.quaternion);}
  });
  const socket = doorCenter.clone().add(new THREE.Vector3(0,(2.616-2.3)*3,.21*3));
  const align = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2));
  const shaftAxis = new THREE.Vector3(0,1,0).applyQuaternion(align);
  const rotation = new THREE.Quaternion(), roll = new THREE.Quaternion();
  const cameraStart = new THREE.Vector3(), cameraEnd = new THREE.Vector3(), target = new THREE.Vector3();
  const leafAxis = new THREE.Vector3(0,0,-1);
  return {
    root,
    update(progress: number, camera: THREE.PerspectiveCamera, reduced: boolean, mobile: boolean) {
      const p = THREE.MathUtils.clamp(progress,0,1), s = unlockState(p);
      root.visible = p > .001 && keyReady && doorsReady;
      if (!root.visible) return s;
      const move = s.fly;
      const viewportHeight=Math.max(14.5,42/camera.aspect);
      const viewportWidth=viewportHeight*camera.aspect;
      const doorHeightFactor=1.85;
      // Adjacent full-height sections: the doorway exists below the cube from
      // the beginning. Scroll exposes that stationary set, never an opacity cue.
      doorCenter.y=center.y-Math.max(28,viewportHeight*(.5+doorHeightFactor*.5+.15));
      const approachAmount=ease(.36,.60,p);
      const stageY=THREE.MathUtils.lerp(center.y,doorCenter.y,approachAmount);
      const doorScaleX=viewportWidth/8.427*1.025;
      const doorScaleY=viewportHeight/4.5*1.025*doorHeightFactor;
      // Equal width/depth scaling preserves rigid inward hinge motion.
      doors.scale.set(doorScaleX,doorScaleY,doorScaleX);
      doors.position.y=doorCenter.y-2.3*doorScaleY;
      // Keep the lock at its original screen height while cropping the tall leaves.
      lock!.position.copy(lockBasePosition);
      lock!.position.z=-2.3+(lockBasePosition.z+2.3)/doorHeightFactor;
      socket.y=doorCenter.y+(2.616-2.3)*doorScaleY/doorHeightFactor;
      socket.z=center.z+.21*doorScaleX;
      // Keep both leaves in portrait framing and preserve a round lock plate.
      lock!.scale.copy(lockBaseScale); lock!.scale.z *= doorScaleX/doorScaleY;
      key.visible = p > .16 && p < .995;
      // Cull the lower set while the old concierge camera is still settling.
      // At .20 it is outside the front-facing view; scroll brings it in later.
      doors.visible = p >= .20;
      doorMaterials.forEach(material=>{material.opacity=1;});
      key.scale.setScalar(THREE.MathUtils.lerp(THREE.MathUtils.lerp(2.4,2,move),1.8,s.insert));
      rotation.setFromEuler(new THREE.Euler(reduced ? 0 : Math.sin(move*Math.PI)*.5, reduced ? 0 : move*Math.PI*2, reduced ? 0 : move*Math.PI*2));
      rotation.slerp(align,ease(.57,.65,p));
      roll.setFromAxisAngle(shaftAxis,s.turn*Math.PI/2);
      key.quaternion.copy(rotation).premultiply(roll);
      // Compose the visible center, then recover the tip position. This keeps
      // the spinning key inside the frame and makes its descent monotonic.
      const keyCenter=new THREE.Vector3(0,1.2*key.scale.x,0).applyQuaternion(key.quaternion);
      const socketHeight=socket.y-doorCenter.y;
      const flightHeight=THREE.MathUtils.lerp(viewportHeight*.28,socketHeight,move);
      const lift=ease(.32,.38,p);
      const screenHeight=THREE.MathUtils.lerp(.18,flightHeight,lift);
      const sway=Math.sin(move*Math.PI*2)*Math.sin(move*Math.PI)*viewportWidth*.035;
      key.position.set(center.x+sway-keyCenter.x,stageY+screenHeight-keyCenter.y,center.z+3);
      // Alignment is complete before insertion, so this is a straight axial move.
      // Seat the entire bit behind the plate before the quarter turn.
      key.position.lerp(socket.clone().add(new THREE.Vector3(0,0,-.21*doorScaleX)),s.insert);
      // While opening, the inserted key follows the lock mounted on the left leaf.
      left!.quaternion.setFromAxisAngle(leafAxis,-left!.userData.open_angle_rad*s.doors);
      right!.quaternion.setFromAxisAngle(leafAxis,-right!.userData.open_angle_rad*s.doors);
      // The escutcheon and keyhole are architectural parts, not the turning key.
      lock!.quaternion.copy(lockRestRotation);
      root.updateMatrixWorld(true);
      if(s.doors>0){
        const lockPosition=lock!.getWorldPosition(new THREE.Vector3());
        const lockRotation=lock!.getWorldQuaternion(new THREE.Quaternion());
        const normal=new THREE.Vector3(0,1,0).applyQuaternion(lockRotation);
        key.position.copy(lockPosition).addScaledVector(normal,-.145*doorScaleX);
        const leafTurn=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-left!.userData.open_angle_rad*s.doors);
        key.quaternion.copy(rotation).premultiply(roll).premultiply(leafTurn);
      }
      cameraStart.copy(camera.position);
      const fov=mobile?23:19;
      // Fit the complete opened cube first, then size the doorway to that same
      // projection. The camera needs no depth zoom during the key's descent.
      const doorDistance=viewportHeight/(2*Math.tan(THREE.MathUtils.degToRad(fov/2)));
      const settle=ease(.01,.16,p);
      cameraEnd.copy(center).add(new THREE.Vector3(0,0,doorDistance));
      cameraEnd.y=stageY;
      camera.position.lerpVectors(cameraStart,cameraEnd,settle);
      target.copy(center).lerp(doorCenter,approachAmount);
      camera.fov=THREE.MathUtils.lerp(camera.fov,fov,settle);
      camera.updateProjectionMatrix();camera.lookAt(target);camera.updateMatrixWorld(true);
      canvas.dataset.unlockState=JSON.stringify({progress:p,keyReady,doorsReady,...s,keyTip:key.position.toArray(),socket:socket.toArray(),lockRotation:lock!.quaternion.toArray(),doorScreenCenterY:doors.position.y+2.3*doorScaleY-camera.position.y});
      return s;
    },
    dispose(){disposed=true;scene.remove(root);},
  };
}
