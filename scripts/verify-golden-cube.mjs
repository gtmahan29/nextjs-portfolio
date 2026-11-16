import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import * as THREE from 'three';

const buffer=await readFile('public/golden-cube/golden-cube.glb');
assert.equal(buffer.toString('ascii',0,4),'glTF');
const document=JSON.parse(buffer.toString('utf8',20,20+buffer.readUInt32LE(12)));
const source=(await readFile('public/golden-cube/controller.js','utf8')).replace("'three'",JSON.stringify(pathToFileURL(path.resolve('node_modules/three/build/three.module.js')).href));
const { GoldenCubeController,PANEL_NAMES }=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const nodes=document.nodes.map(n=>{
  const o=new THREE.Object3D();o.name=n.name??'';o.userData=n.extras??{};
  if(n.translation)o.position.fromArray(n.translation);
  if(n.rotation)o.quaternion.fromArray(n.rotation);
  if(n.scale)o.scale.fromArray(n.scale);
  return o;
});
document.nodes.forEach((n,i)=>n.children?.forEach(j=>nodes[i].add(nodes[j])));
const root=new THREE.Scene();document.scenes[document.scene??0].nodes.forEach(i=>root.add(nodes[i]));
assert.equal(document.scenes.length,1);assert.equal(root.getObjectByName('Cube'),undefined);
for(const m of document.materials)assert.equal(m.extensions?.KHR_materials_transmission?.transmissionFactor??0,0,m.name+' must be opaque');
const rig=new GoldenCubeController(root);
root.updateMatrixWorld(true);
for(const name of PANEL_NAMES){
  const hinge=root.getObjectByName('Hinge_'+name),panel=root.getObjectByName('Panel_'+name),face=root.getObjectByName('Face_'+name);
  const before=panel.getWorldPosition(new THREE.Vector3());
  const normal=new THREE.Vector3(0,1,0).applyQuaternion(face.getWorldQuaternion(new THREE.Quaternion()));
  rig.setPanel(name,1,{immediate:true});root.updateMatrixWorld(true);
  const movement=panel.getWorldPosition(new THREE.Vector3()).sub(before);
  assert.ok(movement.dot(normal)>0.8,name+' should open outward');
  for(const [other,p] of rig.panels)if(other!==name)assert.equal(p.value,0,other+' must stay closed');
  rig.setPanel(name,0,{immediate:true});root.updateMatrixWorld(true);
  assert.ok(panel.getWorldPosition(new THREE.Vector3()).distanceTo(before)<1e-6,name+' closes to its original position');
  assert.ok(hinge.quaternion.angleTo(rig.panels.get(name).closed)<1e-6);
}
// Read shell positions from the exported GLB. Every front boundary point must
// coincide with a point on a neighboring panel, including rounded corners.
const jsonLength=buffer.readUInt32LE(12),binaryStart=20+jsonLength+8;
function positions(node){
  const mesh=document.meshes[document.nodes[nodes.indexOf(node)].mesh];
  const acc=document.accessors[mesh.primitives[0].attributes.POSITION],view=document.bufferViews[acc.bufferView];
  const offset=binaryStart+(view.byteOffset??0)+(acc.byteOffset??0),stride=view.byteStride??12;
  return Array.from({length:acc.count},(_,i)=>new THREE.Vector3(buffer.readFloatLE(offset+i*stride),buffer.readFloatLE(offset+i*stride+4),buffer.readFloatLE(offset+i*stride+8)).applyMatrix4(node.matrixWorld));
}
const shells=PANEL_NAMES.map(name=>root.getObjectByName('Layer_'+name+'_shell'));
// Export duplicates vertices for flat normals; identify the boundary by local
// position: front outer vertices have both X and Y within the outer border.
const boundaries=shells.map(shell=>positions(shell).filter(p=>{
  const q=p.clone().sub(root.getObjectByName('GoldenCube').getWorldPosition(new THREE.Vector3()));
  return [Math.abs(q.x),Math.abs(q.y),Math.abs(q.z)].sort((a,b)=>b-a)[1]>.98;
}));
for(let i=0;i<boundaries.length;i++)for(const p of boundaries[i]){
  assert.ok(boundaries.some((other,j)=>j!==i&&other.some(q=>q.distanceTo(p)<1e-5)),'closed shell boundary must meet neighboring face');
}
rig.openAll();for(let i=0;i<30;i++)rig.update(1/30);assert.ok([...rig.panels.values()].every(p=>p.value===1));
rig.closeAll();for(let i=0;i<30;i++)rig.update(1/30);assert.ok([...rig.panels.values()].every(p=>p.value===0));
console.log(`Verified ${PANEL_NAMES.length} independent outward hinges, exact close, sealed boundaries, opaque materials; ${buffer.length} bytes.`);
