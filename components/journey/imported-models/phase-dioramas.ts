import * as THREE from "three";

import assets from './asset-manifest.json';
import {disposeSceneResources} from '../scene-resources';
import {sceneDecoder} from '../scene-decoder';
import {yieldToMain} from '../scene-loading';
export type PhaseSite = { idx: number; px: number; pz: number };
const disposeTree=disposeSceneResources;

/** Standalone authored models, loaded only as their part of the story approaches. */
export function mountPhaseDioramas(scene: THREE.Scene, sites: [PhaseSite, PhaseSite], scaleBoost = 1,
  prepare?: (model: THREE.Group) => Promise<unknown>, options:{saveData?:boolean;onReady?:()=>void}={}) {
  let disposed = false;
  const controller = new AbortController();
  const mounted: THREE.Group[] = [];
  const requested = new Set<number>();
  const downloads=new Map<number,Promise<ArrayBuffer>>();
  const download=(index:number)=>{
    let promise=downloads.get(index);if(promise)return promise;
    const asset=index===4?assets.dashboard:assets.cloud;
    promise=fetch(asset.url,{signal:controller.signal}).then(response=>{if(!response.ok)throw new Error(`Journey asset HTTP ${response.status}`);return response.arrayBuffer();});
    downloads.set(index,promise);return promise;
  };
  const build = async (index: number, site: PhaseSite) => {
    const [{GLTFLoader},buffer]=await Promise.all([
      import("three/examples/jsm/loaders/GLTFLoader.js"),download(index),
    ]);
    if(disposed)return;
    await yieldToMain(controller.signal);
    const asset=await new GLTFLoader().setMeshoptDecoder(sceneDecoder()).parseAsync(buffer,"/models/journey/");
    const model=asset.scene;
    // Keep the shared journey lighting shader stable when a new station arrives.
    const lights:THREE.Light[]=[];model.traverse(o=>{if(o instanceof THREE.Light)lights.push(o);});lights.forEach(o=>{o.removeFromParent();o.dispose();});
    if(index===5)model.traverse(o=>{if(o instanceof THREE.Mesh)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{
      if(m instanceof THREE.MeshBasicMaterial)m.toneMapped=false;
      // glTF does not preserve Three.js depthWrite/renderOrder. The curved
      // transparent shell must not write an opaque depth mask over its charts.
      if(m.transparent){m.depthWrite=false;o.renderOrder=m.map?2:1;}
      if(m instanceof THREE.MeshStandardMaterial)m.envMapIntensity=.38;
    });});
    if (disposed) { disposeTree(model); return; }
    if (index === 4) {
      const adjusted = new Set<THREE.Material>();
      model.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (adjusted.has(material)) continue;
          adjusted.add(material);
          if (material instanceof THREE.MeshStandardMaterial) material.emissiveIntensity *= .25;
        }
      });
    }
    const wrapper = new THREE.Group();
    wrapper.name = index === 4 ? "fifth-phase-network-dashboard" : "sixth-phase-cloud-diorama";
    wrapper.position.set(site.px, 0, site.pz);
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true; object.receiveShadow = true;
    });
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3());
    const scale = Math.min(21 / Math.max(size.x, size.z, .01), 11 / Math.max(size.y, .01)) * scaleBoost;
    const center = bounds.getCenter(new THREE.Vector3());
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    wrapper.add(model);
    wrapper.updateMatrixWorld(true);
    wrapper.traverse(object => { object.matrixAutoUpdate = false; });
    try{await prepare?.(wrapper);}catch(error){disposeTree(wrapper);throw error;}
    if (disposed) { disposeTree(wrapper); return; }
    scene.add(wrapper); mounted.push(wrapper);options.onReady?.();
  };
  return {
    preload(){if(!options.saveData)for(const index of [4,5])void download(index).catch(()=>{});},
    update(progress: number) {
      sites.forEach((site, i) => {
        const index = i + 4;
        if (progress < (options.saveData ? (i === 0 ? .32 : .60) : (i === 0 ? .18 : .42)) || requested.has(index)) return;
        requested.add(index);
        void build(index, site).catch(error => { if (!disposed) console.error("Journey phase model failed to mount", error); });
      });
      mounted.forEach(root => { root.visible = progress > .48; });
    },
    dispose() { disposed = true; controller.abort();downloads.clear(); mounted.forEach(root => { root.removeFromParent(); disposeTree(root); }); }
  };
}
