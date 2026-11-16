import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { createDashboardPhaseModel } from '../components/journey/imported-models/dashboard-model.js';
import manifest from '../components/journey/imported-models/asset-manifest.json' with {type:'json'};

const asset = await fs.readFile('public/models/journey/dashboard.glb');
function measure(root) {
  root.updateMatrixWorld(true);
  let meshes = 0, triangles = 0, vertices = 0;
  root.traverse(object => { if (object.isMesh) {
    meshes++; vertices += object.geometry.attributes.position.count;
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
  } });
  const bounds = new THREE.Box3().setFromObject(root);
  return { meshes, triangles, vertices, bounds: [...bounds.min.toArray(), ...bounds.max.toArray()] };
}
const sourceStart = performance.now();
const source = measure(createDashboardPhaseModel());
const sourceMs = performance.now() - sourceStart;
const candidateStart = performance.now();
const decoded = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(
  asset.buffer.slice(asset.byteOffset, asset.byteOffset + asset.byteLength), '');
const candidate = measure(decoded.scene);
const candidateMs = performance.now() - candidateStart;
assert.equal(candidate.triangles, source.triangles, 'Triangle topology must be preserved');
source.bounds.forEach((coordinate, i) => assert.ok(Math.abs(coordinate - candidate.bounds[i]) <= manifest.dashboard.maxPositionError*2+.00001, 'World bounds must remain within the declared quantization error'));
assert.equal(candidate.meshes, 10, 'Static surfaces must remain batched');
console.log(JSON.stringify({ source: { ...source, ms: Math.round(sourceMs) },
  candidate: { ...candidate, ms: Math.round(candidateMs) }, bytes: asset.length, quality: 'Topology and bounds preserved' }, null, 2));
