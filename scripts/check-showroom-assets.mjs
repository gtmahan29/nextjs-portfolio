import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {loadImage,createCanvas} from '@napi-rs/canvas';
import manifest from '../components/journey/imported-models/asset-manifest.json' with {type:'json'};
globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{const image=await loadImage(Buffer.from(await blob.arrayBuffer()));image.close=()=>{};return image;};
globalThis.ProgressEvent=class{constructor(type,props){Object.assign(this,{type},props);}};
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),sizes={};
for(const name of ['showroomRooms','showroomMacbook','showroomIphone','showroomRoomsLow','showroomMacbookLow','showroomIphoneLow','cloud']){
  const bytes=await fs.readFile(`public${manifest[name].url}`);
  assert.equal(bytes.length,manifest[name].bytes);
  const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  scene.updateMatrixWorld(true);
  if(name==='cloud'){
    const checked=new Set();
    scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){
      if(!m.map||checked.has(m.map))continue;checked.add(m.map);
      const image=m.map.image,c=createCanvas(image.width,image.height),ctx=c.getContext('2d');ctx.drawImage(image,0,0);
      const pixels=ctx.getImageData(0,0,c.width,c.height).data;let luminance=0,alpha=0;
      for(let i=0;i<pixels.length;i+=4){luminance+=pixels[i]+pixels[i+1]+pixels[i+2];alpha+=pixels[i+3];}
      assert.ok(luminance/(pixels.length/4*3)>30,'Cloud and device images must contain authored colors');
      assert.ok(alpha/(pixels.length/4)>30,'Exported canvas images must not be empty');
    }});
    assert.equal(checked.size,6,'All six authored cloud/screen textures must survive export');
  }
  let triangles=0,instances=0,paint=0,screens=0;
  scene.traverse(o=>{if(o.isMesh){
    const p=o.geometry.attributes.position;
    for(let i=0;i<p.count;i++)assert.ok(Number.isFinite(p.getX(i))&&Number.isFinite(p.getY(i))&&Number.isFinite(p.getZ(i)),'Decoded vertices must be finite');
    const count=o.isInstancedMesh?o.count:1;instances+=o.isInstancedMesh?o.count:0;
    triangles+=(o.geometry.index?.count??p.count)/3*count;
    screens+=o.userData.showroomScreen?1:0;
    for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.userData.referencePaint){paint++;assert.ok(o.geometry.attributes.uv1,'Reference irradiance UVs must survive export');}
  }});
  const bounds=new THREE.Box3().setFromObject(scene);
  if(name==='showroomMacbook'||name==='showroomMacbookLow'){
    const lid=scene.getObjectByName('lid');assert.ok(lid,'The laptop hinge must survive batching');
    const open=lid.rotation.x;lid.rotation.x=Math.PI/2;scene.updateMatrixWorld(true);
    const closed=new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
    assert.ok(closed.y<.3,'Closing the lid must fold all display surfaces into the base');
    const lidBounds=new THREE.Box3().setFromObject(lid),baseBounds=new THREE.Box3().setFromObject(scene.getObjectByName('base'));
    assert.ok(Math.abs(lidBounds.min.z-baseBounds.min.z)<.02&&Math.abs(lidBounds.max.z-baseBounds.max.z)<.02,'Closed lid must cover the chassis front and rear');
    lid.rotation.x=open;scene.updateMatrixWorld(true);
  }
  if(name.startsWith('showroomRooms')){
    for(let i=0;i<3;i++)assert.ok(scene.getObjectByName(`room-${i}`));
    assert.ok(paint>=3);assert.ok(instances>100,'Foliage instancing must be preserved');
    const podiums=[];scene.traverse(o=>{if(o.name.startsWith('podiumTier'))podiums.push(o);});
    // The tier is part of a static batch; material / bounds remain in the decoded scene.
  }else if(name!=='cloud')assert.equal(screens,1,'Exactly one authored screen must be preserved');
  else assert.equal(triangles,manifest.cloud.triangles,'Cloud topology must be preserved');
  sizes[name]={bytes:bytes.length,triangles,instances,bounds:[...bounds.min.toArray(),...bounds.max.toArray()]};
  console.log(JSON.stringify({name,...sizes[name]}));
}
for(const name of ['showroomRooms','showroomMacbook','showroomIphone']){
  assert.ok(sizes[name+'Low'].bytes<sizes[name].bytes*.65,'Mobile asset payload budget');
  assert.ok(sizes[name+'Low'].triangles<sizes[name].triangles*.65,'Mobile geometry budget');
  sizes[name].bounds.forEach((v,i)=>assert.ok(Math.abs(v-sizes[name+'Low'].bounds[i])<.08,'Mobile silhouettes must retain the authored world bounds'));
}
console.log('Showroom high/mobile assets, screen metadata, foliage instancing and cloud topology passed.');
