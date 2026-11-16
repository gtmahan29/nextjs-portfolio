import * as THREE from "three";

/** Meshy's fragmented UV atlas bleeds between islands in distant mip levels. */
export function cleanMeshySurface(root: THREE.Object3D, anisotropy = 1) {
  const materials = new Set<THREE.MeshStandardMaterial>();
  const discarded = new Set<THREE.Texture>(), retained = new Set<THREE.Texture>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.receiveShadow = false;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(material instanceof THREE.MeshStandardMaterial) || materials.has(material)) continue;
      materials.add(material);
      for (const texture of [material.normalMap,material.bumpMap,material.displacementMap,material.metalnessMap,material.roughnessMap])
        if (texture) discarded.add(texture);
      material.normalMap = null; material.bumpMap = null; material.displacementMap = null;
      material.normalScale.setScalar(0); material.metalness = 0; material.roughness = 1;
      material.metalnessMap = null; material.roughnessMap = null; material.envMapIntensity = .12;
      material.flatShading = false;
      if (material.map) {
        material.map.generateMipmaps = false;
        material.map.minFilter = THREE.LinearFilter;
        material.map.magFilter = THREE.LinearFilter;
        material.map.anisotropy = Math.min(8, anisotropy);
        material.map.needsUpdate = true;
      }
      material.needsUpdate = true;
      Object.values(material).forEach(value => { if (value instanceof THREE.Texture) retained.add(value); });
    }
  });
  return Array.from(discarded).filter(texture => !Array.from(retained).some(used =>
    used === texture || (texture.image && used.image === texture.image)));
}
