import * as THREE from "three";
import { createIvoryIlluminatedArchitecturalShowroomModel } from "./showroom-reference-model";

/** Hand refinement of the forge blockout. All coordinates are in the sculpt spec. */
export function createShowroomArchitecture() {
  const root = createIvoryIlluminatedArchitecturalShowroomModel({materialMaps:false});
  const runtime = root.userData.sculptRuntime;
  const nodes = runtime.nodes as Record<string, THREE.Group>;
  nodes.root.position.set(0, 0, 0);
  const meshFor = (id: string) => nodes[id].children.find(o => (o as THREE.Mesh).isMesh) as THREE.Mesh;
  function replace(id: string, geometry: THREE.BufferGeometry, position?: THREE.Vector3) {
    const mesh = meshFor(id); mesh.geometry.dispose(); mesh.geometry = geometry;
    mesh.position.set(0, 0, 0); mesh.quaternion.identity();
    if (position) nodes[id].position.copy(position);
    return mesh;
  }
  const arch = new THREE.Shape();
  arch.moveTo(-4, 0); arch.lineTo(4, 0); arch.lineTo(4, 5.5);
  arch.absarc(0, 5.5, 4, 0, Math.PI, false); arch.lineTo(-4, 0);
  replace("arch-panel", new THREE.ExtrudeGeometry(arch, { depth: .18, bevelEnabled: true, bevelSize: .018, bevelThickness: .018, bevelSegments: 3, curveSegments: 96 }), new THREE.Vector3(0,.25,-3.43));
  const left = new THREE.Shape(); left.moveTo(-1.9,0); left.lineTo(1.9,0); left.lineTo(1.9,3.6);
  left.quadraticCurveTo(1.9,4.2,1.3,4.35); left.lineTo(-1.9,4.95); left.closePath();
  replace("partition-left",new THREE.ExtrudeGeometry(left,{depth:.2,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:3,curveSegments:48}),new THREE.Vector3(-5.6,.25,-1.9));
  const right = new THREE.Shape(); right.moveTo(-1.15,0); right.lineTo(1.15,0); right.lineTo(1.15,4.5);
  right.bezierCurveTo(-.15,4.25,-1.15,4,-1.15,2.95); right.closePath();
  replace("partition-right",new THREE.ExtrudeGeometry(right,{depth:.2,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:3,curveSegments:48}),new THREE.Vector3(6.8,.25,-1.4));
  replace("podium",new THREE.CylinderGeometry(2.7,2.7,.6,128),new THREE.Vector3(.45,.55,0));
  replace("deck",new THREE.BoxGeometry(24,.25,14.2),new THREE.Vector3(0,.125,-2.8));
  nodes["partition-left"].position.x=-6.8;
  nodes["partition-right"].position.x=7.7;
  replace("planter--7",new THREE.CylinderGeometry(1.25,1.25,.5,64),new THREE.Vector3(-7.6,.5,-1.2));
  replace("planter-7",new THREE.CylinderGeometry(1.25,1.25,.5,64),new THREE.Vector3(8,.5,-1.2));
  // Fine elements belong to later passes; don't show placeholder boxes in blockout.
  for (const id of ["arch-diffuser","podium-band","floor-ring","deck-strip","tile-joints","plant-branches"]) nodes[id].visible=false;
  const clay=new THREE.MeshStandardMaterial({color:0xe5ddd2,roughness:.9});
  const oldMaterials = new Set<THREE.Material>();
  root.traverse(o=>{if((o as THREE.Mesh).isMesh){const material=(o as THREE.Mesh).material;(Array.isArray(material)?material:[material]).forEach(m=>oldMaterials.add(m));}});
  oldMaterials.forEach(m=>m.dispose());
  root.traverse(o=>{if((o as THREE.Mesh).isMesh){const m=o as THREE.Mesh;m.material=clay;m.castShadow=true;m.receiveShadow=true;}});
  return {root, podiumTop:.85, nodes};
}
