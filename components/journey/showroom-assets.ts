import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {sceneDecoder} from './scene-decoder';
import {yieldToMain} from './scene-loading';
import {createReferencePaint} from './reference-paint';
import {disposeSceneResources} from './scene-resources';
import assets from './imported-models/asset-manifest.json';

/** Downloads overlap; parsing yields between assets and never happens during a slide. */
export async function loadShowroomAssets(signal:AbortSignal,irradiance:THREE.Texture,low:boolean){
  // Original three-room asset selection retained:
  // const urls=low?[assets.showroomRoomsLow.url,assets.showroomMacbookLow.url,assets.showroomIphoneLow.url]:[assets.showroomRooms.url,assets.showroomMacbook.url,assets.showroomIphone.url];
  const urls=[low?assets.showroomMacbookLow.url:assets.showroomMacbook.url,low?assets.showroomIphoneLow.url:assets.showroomIphone.url];
  const buffers=await Promise.all(urls.map(async url=>{
    const response=await fetch(url,{signal});if(!response.ok)throw new Error(`Showroom asset ${response.status}`);
    return response.arrayBuffer();
  }));
  const roots:THREE.Group[]=[];
  try{
    const loader=new GLTFLoader().setMeshoptDecoder(sceneDecoder());
    const restored=new Map<THREE.Material,THREE.Material>();
    for(const bytes of buffers){
      await yieldToMain(signal);
      signal.throwIfAborted();const {scene}=await loader.parseAsync(bytes,'');roots.push(scene);
      scene.traverse(object=>{
        if(!(object instanceof THREE.Mesh))return;
        object.castShadow=object.userData.castShadow??true;object.receiveShadow=object.userData.receiveShadow??true;
        object.renderOrder=object.userData.renderOrder??0;
        const restore=(m:THREE.Material)=>{
          if(restored.has(m))return restored.get(m)!;
          if(m.userData.referencePaint){const paint=createReferencePaint(irradiance);paint.userData.referencePaint=true;restored.set(m,paint);return paint;}
          if(m.userData.blending!==undefined)m.blending=m.userData.blending;
          if(m.userData.depthWrite!==undefined)m.depthWrite=m.userData.depthWrite;
          if(m.userData.toneMapped!==undefined)m.toneMapped=m.userData.toneMapped;
          if(m instanceof THREE.MeshStandardMaterial&&m.userData.envMapIntensity!==undefined)m.envMapIntensity=m.userData.envMapIntensity;
          return m;
        };
        object.material=Array.isArray(object.material)?object.material.map(restore):restore(object.material);
      });
    }
    signal.throwIfAborted();
    /* Original architecture and additional devices retained:
    const rooms=[0,1,2].map(i=>{
      const room=roots[0].getObjectByName(`room-${i}`) as THREE.Group;
      if(!room)throw new Error('Incomplete showroom asset');
      room.removeFromParent();return room;
    });
    const devices=[roots[1],roots[2],roots[1].clone(true)];
    */
    const rooms=[new THREE.Group()];
    const devices=[roots[0],roots[1],roots[0].clone(true)];
    // Geometry and chassis textures are shared; per-room materials own clipping/display state.
    [...rooms,...devices].forEach((root,i)=>{
      const clones=new Map<THREE.Material,THREE.Material>();
      root.traverse(o=>{if(o instanceof THREE.Mesh){
        const copy=(m:THREE.Material)=>{let next=clones.get(m);if(!next){next=m.clone();if(next instanceof THREE.ShaderMaterial)next.uniforms.irradiance.value=irradiance;clones.set(m,next);}return next;};
        o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);
      }});
    });
    return {rooms,devices};
  }catch(error){roots.forEach(disposeSceneResources);throw error;}
}
