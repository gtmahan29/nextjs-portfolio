// Offline asset conversion, not a Next.js/production build.
import fs from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {createCanvas,CanvasElement,Image,ImageData} from '@napi-rs/canvas';
import layout from '../components/journey/imported-models/cloud-layout.json' with {type:'json'};
globalThis.HTMLCanvasElement=CanvasElement;globalThis.HTMLImageElement=Image;globalThis.ImageData=ImageData;
// Native canvas exposes data() unlike browser canvas. GLTFExporter interprets
// any .data property as a DataTexture byte array, silently exporting blank PNGs.
Object.defineProperty(CanvasElement.prototype,'data',{value:undefined,configurable:true});
globalThis.document={createElement:()=>createCanvas(1,1),createElementNS:()=>createCanvas(1,1)};
const cloudSource=await fs.readFile('components/journey/imported-models/cloud-model.js','utf8');
const factory=new Function('THREE','layout',cloudSource.replace(/^import .*$/gm,'').replace('export function createCloudPhaseModel','function createCloudPhaseModel')+';return createCloudPhaseModel;')(THREE,layout);
import {compressSceneAsset} from './scene-asset-codec.mjs';
import {writeSceneAsset} from './write-scene-asset.mjs';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
};
const start = performance.now();
const root = factory();
const decorativeLights=[];root.traverse(o=>{if(o.isLight)decorativeLights.push(o);});decorativeLights.forEach(o=>o.removeFromParent());
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
    // glTF has no material.visible flag. Omit the hidden extrusion caps instead
    // of exporting them as opaque white faces over the curved glass and charts.
    if (!material || material.visible === false) continue;
    const source = object.geometry.clone().applyMatrix4(object.matrixWorld);
    const indices = source.index?.array ?? Array.from({ length: source.attributes.position.count }, (_, i) => i);
    source.setIndex(Array.from(indices.slice(range.start, range.start + range.count))); source.clearGroups();
    const geometry = mergeVertices(source); source.dispose();
    const { uuid, metadata, name, ...properties } = material.toJSON();
    const key = JSON.stringify(properties)+(material.transparent?object.uuid:"");
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
await fs.writeFile('public/models/journey/cloud.glb', asset);
await writeSceneAsset('cloud',asset,'glb','journey',{maxPositionError,triangles});
console.log(JSON.stringify({ beforeMeshes, meshes: output.children.length, beforeVertices,
  vertices, triangles, bytes: asset.length, uncompressedBytes: glb.byteLength,
  maxPositionError,quantizedAttributes,offlineMs: Math.round(performance.now() - start) }));
