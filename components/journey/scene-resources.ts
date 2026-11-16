import * as THREE from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";

export function disposeSceneResources(root:THREE.Object3D) {
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  root.traverse(object=>{
    if(object instanceof THREE.Light)object.dispose();
    const mesh=object as THREE.Mesh;
    if(object instanceof THREE.InstancedMesh)object.dispose();
    if(mesh.geometry)geometries.add(mesh.geometry);
    if(mesh.material)(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(material=>{
      materials.add(material);Object.values(material).forEach(value=>{if(value instanceof THREE.Texture)textures.add(value);});
      const shader=material as THREE.ShaderMaterial;
      Object.values(shader.uniforms??{}).forEach(uniform=>{if(uniform.value instanceof THREE.Texture)textures.add(uniform.value);});
    });
  });
  textures.forEach(t=>{t.dispose();if(typeof ImageBitmap!=="undefined"&&t.image instanceof ImageBitmap)t.image.close();});materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());
}

/** Static room parts only. Preserve instancing, transparency, clipping and shadow behavior. */
export function batchStaticRoom(root:THREE.Group) {
  root.updateMatrixWorld(true);
  const inverse=root.matrixWorld.clone().invert(),batches=new Map<string,THREE.Mesh[]>(),retired=new Set<THREE.BufferGeometry>();
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh)||object instanceof THREE.InstancedMesh||Array.isArray(object.material)||object.material.transparent)return;
    const layout=Object.entries(object.geometry.attributes).map(([name,a])=>`${name}:${(a as THREE.BufferAttribute).itemSize}:${(a as THREE.BufferAttribute).normalized}`).sort().join("|");
    const key=`${object.material.uuid}:${layout}:${object.castShadow}:${object.receiveShadow}:${object.renderOrder}:${object.layers.mask}`;
    const list=batches.get(key)??[];list.push(object);batches.set(key,list);
  });
  for(const meshes of Array.from(batches.values())){
    if(meshes.length<2)continue;
    const parts=meshes.map(mesh=>{
      const part=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
      part.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));return part;
    });
    const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(!merged)continue;
    const source=meshes[0],mesh=new THREE.Mesh(merged,source.material);
    mesh.name="static-room-batch";mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;
    mesh.renderOrder=source.renderOrder;mesh.layers.mask=source.layers.mask;root.add(mesh);
    meshes.forEach(old=>{retired.add(old.geometry);old.removeFromParent();});
  }
  root.traverse(o=>{if(o instanceof THREE.Mesh)retired.delete(o.geometry);});retired.forEach(g=>g.dispose());
  root.updateMatrixWorld(true);
  root.traverse(object=>{object.matrixAutoUpdate=false;object.matrixWorldAutoUpdate=false;});
}
