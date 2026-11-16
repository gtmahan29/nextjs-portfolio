// Offline conversion of the authored rooms and supplied devices. No production build.
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {createCanvas,CanvasElement,Image,ImageData} from '@napi-rs/canvas';
import {createAuthoredRooms} from './showroom-authoring.mjs';
import {createImportedMacbook} from '../components/journey/imported-models/devices/macbook.js';
import {createImportedIphone} from '../components/journey/imported-models/devices/iphone.js';
import {batchStaticRoom} from '../components/journey/scene-resources.ts';
import {compressSceneAsset} from './scene-asset-codec.mjs';
import {writeSceneAsset} from './write-scene-asset.mjs';
globalThis.HTMLCanvasElement=CanvasElement;globalThis.HTMLImageElement=Image;globalThis.ImageData=ImageData;
// Match browser canvas: native data() must not be mistaken for texture bytes.
Object.defineProperty(CanvasElement.prototype,'data',{value:undefined,configurable:true});
globalThis.document={createElement:()=>createCanvas(1,1),createElementNS:()=>createCanvas(1,1)};
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};

function preserve(root){
  const textures=new Map();
  root.traverse(o=>{
    delete o.userData.sculptRuntime;
    if(!o.isMesh)return;
    o.userData={...o.userData,castShadow:o.castShadow,receiveShadow:o.receiveShadow,renderOrder:o.renderOrder};
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
      for(const [key,t] of Object.entries(m))if(t?.isDataTexture){
        if(!textures.has(t)){
          const c=createCanvas(t.image.width,t.image.height),ctx=c.getContext('2d');
          ctx.putImageData(new ImageData(new Uint8ClampedArray(t.image.data),t.image.width,t.image.height),0,0);
          const next=new THREE.CanvasTexture(c);next.copy(t);next.image=c;next.isDataTexture=false;textures.set(t,next);
        }
        m[key]=textures.get(t);
      }
      m.userData={...m.userData,blending:m.blending,depthWrite:m.depthWrite,toneMapped:m.toneMapped,envMapIntensity:m.envMapIntensity};
    }
  });
}
function batchDevice(group){
  if(group.getObjectByName('lid')){
    for(const name of ['base','lid'])batchStaticRoom(group.getObjectByName(name));
  }else batchStaticRoom(group);
}
async function exportAsset(name,root){
  root.traverse(o=>{if(o.isMesh){const old=o.geometry;o.geometry=mergeVertices(old);}});
  preserve(root);
  const glb=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true,maxTextureSize:name.endsWith('Low')?512:1024});
  // Preserve authored transforms and instancing exactly; lossless meshopt here.
  const {asset}=await compressSceneAsset(glb,{quantize:false});
  await writeSceneAsset(name,asset,'glb','showroom');
  console.log(JSON.stringify({name,bytes:asset.length,sourceBytes:glb.byteLength}));
}
const {rooms}=createAuthoredRooms({tier:'high'}),root=new THREE.Group();
function prepareRooms(rooms){const root=new THREE.Group();for(const [i,room] of rooms.entries()){
  room.name=`room-${i}`;
  const paint=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9});paint.userData.referencePaint=true;
  room.traverse(o=>{if(o.isMesh){const replace=m=>m.userData.referencePaint?paint:m;o.material=Array.isArray(o.material)?o.material.map(replace):replace(o.material);}});
  batchStaticRoom(room);root.add(room);
}return root;}
await exportAsset('showroomRooms',prepareRooms(rooms));
for(const [name,factory] of [['showroomMacbook',createImportedMacbook],['showroomIphone',createImportedIphone]]){
  const {group,screen}=factory(false);screen.userData.showroomScreen=true;
  batchDevice(group);await exportAsset(name,group);
}
// Offline mobile LODs: retain authored shapes, instancing and textures while
// reducing the bevel/curve tessellation that cannot be resolved on small screens.
const lowThree={...THREE};
const limits={CircleGeometry:[[1,48]],RingGeometry:[[2,64]],CylinderGeometry:[[3,48]],SphereGeometry:[[1,16],[2,10]],LatheGeometry:[[1,64]],TubeGeometry:[[1,100],[3,4]],ShapeGeometry:[[1,24]]};
for(const [name,caps] of Object.entries(limits))lowThree[name]=class extends THREE[name]{constructor(...args){for(const [i,max] of caps)if(args[i]!==undefined)args[i]=Math.min(args[i],max);super(...args);}};
lowThree.ExtrudeGeometry=class extends THREE.ExtrudeGeometry{constructor(shape,options={}){super(shape,{...options,curveSegments:Math.min(options.curveSegments??12,16),bevelSegments:Math.min(options.bevelSegments??3,1)});}};
await exportAsset('showroomRoomsLow',prepareRooms(createAuthoredRooms({tier:'low'},lowThree).rooms));
for(const [name,path] of [['showroomMacbookLow','macbook'],['showroomIphoneLow','iphone']]){
  const source=await fs.readFile(`components/journey/imported-models/devices/${path}.js`,'utf8');
  const factory=new Function('THREE',source.replace(/^import .*$/gm,'').replace('export function','function')+`;return createImported${path==='iphone'?'Iphone':'Macbook'};`)(lowThree);
  const {group,screen}=factory(false);screen.userData.showroomScreen=true;batchDevice(group);await exportAsset(name,group);
}
