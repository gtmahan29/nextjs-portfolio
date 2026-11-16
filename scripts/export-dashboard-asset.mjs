// Offline asset conversion, not a Next.js/production build.
import fs from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createDashboardPhaseModel } from '../components/journey/imported-models/dashboard-model.js';
import {compressSceneAsset} from './scene-asset-codec.mjs';
import {writeSceneAsset} from './write-scene-asset.mjs';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
};
const start = performance.now();
const root = createDashboardPhaseModel();
root.updateMatrixWorld(true);
const groups = new Map();
let beforeVertices = 0, beforeMeshes = 0;
root.traverse(object => {
  object.userData = {};
  if (!object.isMesh) return;
  beforeMeshes++; beforeVertices += object.geometry.attributes.position.count;
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  const ranges = Array.isArray(object.material) ? object.geometry.groups : [{ start: 0,
    count: object.geometry.index?.count ?? object.geometry.attributes.position.count, materialIndex: 0 }];
  for (const range of ranges) {
    const material = materials[range.materialIndex];
    const source = object.geometry.clone().applyMatrix4(object.matrixWorld);
    const indices = source.index?.array ?? Array.from({ length: source.attributes.position.count }, (_, i) => i);
    source.setIndex(Array.from(indices.slice(range.start, range.start + range.count))); source.clearGroups();
    const geometry = mergeVertices(source); source.dispose();
    const { uuid, metadata, name, ...properties } = material.toJSON();
    const key = JSON.stringify(properties);
    const group = groups.get(key) ?? { materials: [material], geometries: [] };
    group.geometries.push(geometry); groups.set(key, group);
  }
});
const output = new THREE.Group();
for (const { materials, geometries } of groups.values()) {
  // Multi-material meshes retain their authored face/edge groups.
  if (materials.length > 1) {
    geometries.forEach(geometry => output.add(new THREE.Mesh(geometry, materials)));
  } else {
    output.add(new THREE.Mesh(mergeGeometries(geometries), materials[0]));
    geometries.forEach(geometry => geometry.dispose());
  }
}
let vertices = 0, triangles = 0;
output.traverse(object => { if (object.isMesh) {
  vertices += object.geometry.attributes.position.count;
  triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
} });
await fs.mkdir('public/models/journey', { recursive: true });
const glb = await new GLTFExporter().parseAsync(output, { binary: true, onlyVisible: true });
const {asset,maxPositionError,quantizedAttributes}=await compressSceneAsset(glb);
await fs.writeFile('public/models/journey/dashboard.glb', asset);
await writeSceneAsset('dashboard',asset,'glb','journey',{maxPositionError,triangles});
console.log(JSON.stringify({ beforeMeshes, meshes: output.children.length, beforeVertices,
  vertices, triangles, bytes: asset.length, uncompressedBytes: glb.byteLength,
  maxPositionError,quantizedAttributes,offlineMs: Math.round(performance.now() - start) }));
