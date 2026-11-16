import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {disposeSceneResources} from './scene-resources';
export const LUMEN_SPACING=64;
export const LUMEN_CAMERA={y:7,fov:32,pitch:Math.atan((470.5-452)/1641)};

/** First laptop and its original two-tier platform. Architecture is archived below. */
export async function createLumenShowroom(renderer,{quality,signal,irradiance,bakedRooms}){
  const scene=new THREE.Scene();scene.background=null;
  const pmrem=new THREE.PMREMGenerator(renderer),environment=new RoomEnvironment();
  const target=pmrem.fromScene(environment,.04);environment.dispose();pmrem.dispose();
  scene.environment=target.texture;scene.environmentIntensity=.6;
  const rooms=bakedRooms;rooms.forEach(room=>scene.add(room));
  const room=rooms[0], PC={x:1,y:1.372,z:-29.8,radius:4.52};
  const body=new THREE.MeshStandardMaterial({color:0xdfd2c2,roughness:.3,metalness:.3});
  const top=new THREE.MeshStandardMaterial({color:0xeee6d9,roughness:.35,metalness:.25});
  function tier(r,y0,y1,b){
    const pts=[new THREE.Vector2(0,y0)];
    for(let i=0;i<=6;i++){const a=-Math.PI/2+i/6*Math.PI/2;pts.push(new THREE.Vector2(r-b+Math.cos(a)*b,y0+b+Math.sin(a)*b));}
    for(let i=0;i<=6;i++){const a=i/6*Math.PI/2;pts.push(new THREE.Vector2(r-b+Math.cos(a)*b,y1-b+Math.sin(a)*b));}
    pts.push(new THREE.Vector2(0,y1));
    const mesh=new THREE.Mesh(new THREE.LatheGeometry(pts,128),body);mesh.name='podiumTier';mesh.position.set(PC.x,0,PC.z);room.add(mesh);
    const cap=new THREE.Mesh(new THREE.CircleGeometry(r-b,128),top);cap.rotation.x=-Math.PI/2;cap.position.set(PC.x,y1+.002,PC.z);room.add(cap);
  }
  tier(4.5,.5,.99,.07);tier(4.52,1.03,1.37,.09);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(4.46,4.46,.05,128,1,true),new THREE.MeshBasicMaterial({color:0xffedbd,toneMapped:false}));band.position.set(PC.x,1.01,PC.z);room.add(band);
  // Broad underside emission with feathered volume, widening toward the bottom.
  const lightMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{tint:{value:new THREE.Color('#c9daf0')}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform vec3 tint;varying vec2 vUv;
      void main(){float h=vUv.y;float width=mix(.49,.31,h);
      float side=1.-smoothstep(width*.65,width,abs(vUv.x-.5));
      float vertical=smoothstep(0.,.45,h)*(1.-smoothstep(.96,1.,h));
      float core=exp(-pow((h-.94)/.09,2.));
      gl_FragColor=vec4(tint,side*(vertical*.17+core*.12));}`});
  const lightField=new THREE.Mesh(new THREE.PlaneGeometry(16,5.5),lightMaterial);
  lightField.position.set(PC.x,-2.18,PC.z-.2);room.add(lightField);
  const aperture=new THREE.Mesh(new THREE.CircleGeometry(4.25,96),new THREE.MeshBasicMaterial({color:0xe8f4ff,toneMapped:false,side:THREE.DoubleSide}));
  aperture.rotation.x=Math.PI/2;aperture.position.set(PC.x,.49,PC.z);room.add(aperture);
  /* Previous hard-edged beam retained for reference:
  // A soft, open frustum widens below the floating platform. Its density fades
  // at the lower edge; it is geometry in the world rather than a screen overlay.
  const beamMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{tint:{value:new THREE.Color('#fff0ba')}},
    vertexShader:`varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;
      void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=-p.xyz;gl_Position=projectionMatrix*p;}`,
    fragmentShader:`uniform vec3 tint;varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;
      void main(){float edge=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),1.4);
      float density=smoothstep(0.,.24,vUv.y)*pow(vUv.y,.7);
      gl_FragColor=vec4(tint,density*(.055+.13*edge));}`});
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(4.25,5.8,3.8,96,1,true),beamMaterial);
  beam.position.set(PC.x,-1.46,PC.z);room.add(beam);
  const haloCanvas=document.createElement('canvas');haloCanvas.width=haloCanvas.height=256;
  const ctx=haloCanvas.getContext('2d'),gradient=ctx.createRadialGradient(128,128,8,128,128,125);
  gradient.addColorStop(0,'#ffe8a65c');gradient.addColorStop(.45,'#ffe8a62b');gradient.addColorStop(1,'#ffe8a600');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
  const haloMap=new THREE.CanvasTexture(haloCanvas);haloMap.colorSpace=THREE.SRGBColorSpace;
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(14,14),new THREE.MeshBasicMaterial({map:haloMap,transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
  halo.rotation.x=-Math.PI/2;halo.position.set(PC.x,-3.38,PC.z);room.add(halo);
  */
  // Recenter the assembly so a service change rotates the platform about its centre.
  room.children.forEach(child=>{child.position.x-=PC.x;child.position.z-=PC.z;});
  room.position.set(PC.x,0,PC.z);
  const assemblies=[room,room.clone(true),room.clone(true)];
  assemblies.slice(1).forEach(assembly=>{assembly.visible=false;scene.add(assembly);});
  scene.add(new THREE.HemisphereLight(0xfff4e8,0xb8a893,1));
  const key=new THREE.DirectionalLight(0xffecd8,2);key.position.set(-6,14,-18);key.target.position.set(1,1,-30);scene.add(key,key.target);
  const fill=new THREE.DirectionalLight(0xf0f4ff,.8);fill.position.set(8,8,-22);scene.add(fill);
  function update(camera,p=0,mouse=[0,0],reduced=false,reference=false){camera.position.set(1,LUMEN_CAMERA.y,0);camera.lookAt(1,3.286,-29.8);renderer.toneMappingExposure=1.15;}
  function dispose(){target.dispose();disposeSceneResources(scene);}
  return {scene,rooms,update,dispose,setQuality:(q)=>{},ready:()=>true,podium:PC,turntable:room,assemblies};
}

// ORIGINAL THREE-ROOM SHOWROOM — commented out at the user's request, recoverable in full.
// import * as THREE from 'three';
// import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
// import { SceneScope } from './scene-loading';
// import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
// import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
// import {disposeSceneResources} from './scene-resources';
// 
// // Adapted from the user-supplied lumen-atelier-showroom.html. No CDN runtime.
// export const LUMEN_SPACING=64;
// export const LUMEN_CAMERA={y:7,fov:32,pitch:Math.atan((470.5-452)/1641)};
// export async function createLumenShowroom(renderer,{quality,signal,irradiance,bakedRooms}){
// const scope=new SceneScope(signal);
// RectAreaLightUniformsLib.init();
// const scene=new THREE.Scene(); scene.background=new THREE.Color(0xe8d4bf);
// const pmrem=new THREE.PMREMGenerator(renderer), environment=new RoomEnvironment();
// const environmentTarget=pmrem.fromScene(environment,.04);
// scene.environment=environmentTarget.texture; scene.environmentIntensity=.38;
// environment.dispose(); pmrem.dispose();
// const SP=LUMEN_SPACING,CAM={...LUMEN_CAMERA,y:2.8};
// // Reference-derived indirect irradiance, not a photograph used as the backdrop.
// irradiance.colorSpace=THREE.NoColorSpace; irradiance.channel=1;
// const palette={floor:0xf0e6d7,sun:[1,.86,.67],exposure:1.15};
// function rngFrom(seed){ let s = seed>>>0; return ()=>{ s = (s*1664525 + 1013904223)>>>0; return s/4294967296; }; }
// 
// /* ---------------- textures ---------------- */
// function canvasTex(w, h, draw, srgb=true){
//   const c = document.createElement('canvas'); c.width=w; c.height=h;
//   const g = c.getContext('2d'); draw(g, w, h);
//   const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
//   t.anisotropy = quality.tier === "high" ? 4 : 1; return t;
// }
// function tileTex(){ // large stone tiles with subtle mottling, 1 texture = 1 tile
//   return canvasTex(512, 512, (g,w,h)=>{
//     g.fillStyle='#ffffff'; g.fillRect(0,0,w,h);
//     const r = rngFrom(7);
//     for(let i=0;i<1400;i++){ const a=r()*0.035; g.fillStyle=`rgba(${150+r()*40|0},${130+r()*30|0},${110+r()*30|0},${a})`;
//       const s=2+r()*26; g.beginPath(); g.arc(r()*w,r()*h,s,0,7); g.fill(); }
//     g.strokeStyle='rgba(120,100,80,.18)'; g.lineWidth=2.2; g.strokeRect(1,1,w-2,h-2);
//   });
// }
// 
// 
// const lightingRig=new THREE.Group();scene.add(lightingRig);
// const plantKeys=[];
// const WZ=-60,archL=(583-836)*60/1641,archR=(1165-836)*60/1641,archC=(archL+archR)/2;
// 
//   // Soft shadows from the actual plants, with LED-height warm keys.
//   for(const [x,tx,z] of [[-23,-13,-28],[23,16,-27]]){
//     const key=new THREE.SpotLight(0xffddb0,90,20,.8,.75,2);
//     key.position.set(x,5.3,z); key.target.position.set(tx,4.8,-39.5);
//     key.castShadow=true;key.shadow.autoUpdate=false;key.shadow.needsUpdate=true;key.shadow.mapSize.set(Math.min(1024,quality.shadows),Math.min(1024,quality.shadows));
//     key.shadow.bias=-.0004;key.shadow.normalBias=.015;key.shadow.radius=6;key.shadow.blurSamples=quality.tier === "low" ? 4 : 12;
//     lightingRig.add(key,key.target);plantKeys.push(key);
//   }
//   // Actual warm architectural wash, separate from visible LED strips.
//   for (const x of (quality.tier === "high" ? [archL + .35, archR - .35] : [])) {
//     const wash = new THREE.RectAreaLight(0xffd6a0, 15, .55, 24);
//     wash.position.set(x, 12.5, WZ + 1.6); lightingRig.add(wash);
//   }
//   for (const [x,y,z] of (quality.tier === "low" ? [] : [[-17.8,5.5,-35],[17.8,5.5,-35],[archC,1.3,-58]])) {
//     const wash = new THREE.PointLight(0xffd2a0, 220, 18, 2);
//     wash.position.set(x,y,z); lightingRig.add(wash);
//   }
// 
// /* ---------------- shared floor + reflectors ---------------- */
// const floorTex = tileTex(); floorTex.wrapS=floorTex.wrapT=THREE.RepeatWrapping; floorTex.repeat.set(320/6.5, 60/6.5);
// floorTex.offset.set(1-(((0.3-SP+160)/6.5)%1+1)%1, 1-((30.83/6.5)%1));
// const mirror = new Reflector(new THREE.PlaneGeometry(320,60), { textureWidth:quality.reflectionSize, textureHeight:quality.reflectionSize/2, multisample:0, color:0xe8ddd0 });
// mirror.rotation.x=-Math.PI/2; mirror.position.set(SP,-0.01,-12); scene.add(mirror);
// const floor = new THREE.Mesh(new THREE.PlaneGeometry(320,60), new THREE.MeshStandardMaterial({ map:floorTex, color:palette.floor, roughness:.42, transparent:true, opacity:.93 }));
// floor.rotation.x=-Math.PI/2; floor.position.set(SP,0,-12); floor.receiveShadow=true; scene.add(floor);
// const mirror2 = new Reflector(new THREE.PlaneGeometry(320,48), { textureWidth:quality.reflectionSize, textureHeight:quality.reflectionSize/2, multisample:0, color:0xe8dfd4 });
// mirror2.rotation.x=-Math.PI/2; mirror2.position.set(SP,0.49,-43.06); scene.add(mirror2);
// 
// scope.defer(dispose);
// const rooms=bakedRooms;
// rooms.forEach(room=>scene.add(room));
// /* ---------------- lights ---------------- */
// const hemi = new THREE.HemisphereLight(0xffead3, 0xd9c6ae, .4); scene.add(hemi);
// const sun = new THREE.DirectionalLight(0xffecd8, 1.7); sun.castShadow=true;
// sun.shadow.mapSize.set(quality.shadows,quality.shadows); Object.assign(sun.shadow.camera,{left:-40,right:40,top:30,bottom:-20,near:1,far:200}); sun.shadow.bias=-0.0004; sun.shadow.radius=6;
// scene.add(sun, sun.target);
// const fill = new THREE.DirectionalLight(0xfff6ed, .20); fill.position.set(0,10,20); scene.add(fill, fill.target);
// 
// /* ---------------- post ---------------- */
// // No screen-space bloom: all glow is real emissive geometry + additive halo cards (robust on every GPU).
// 
// 
// // Keep the two planar reflections from recursively rendering one another.
// for(const [reflector,other] of [[mirror,mirror2],[mirror2,mirror]]){
//   const render=reflector.onBeforeRender;
//   reflector.onBeforeRender=function(...args){const visible=other.visible;other.visible=false;try{render.apply(this,args);}finally{other.visible=visible;}};
// }
// let reflections=quality.reflections,rigRoom=-1;
// function setQuality(q){
//   reflections=q.reflections;mirror.visible=reflections===2;mirror2.visible=reflections>0;
//   for(const reflector of [mirror,mirror2])reflector.getRenderTarget().setSize(q.reflectionSize,q.reflectionSize/2);
//   for(const light of [sun,...plantKeys]){
//     const size=light===sun?q.shadows:Math.min(1024,q.shadows);
//     if(light.shadow.mapSize.x!==size){light.shadow.map?.dispose();light.shadow.mapPass?.dispose();light.shadow.map=null;light.shadow.mapPass=null;light.shadow.mapSize.set(size,size);light.shadow.needsUpdate=true;}
//   }
//   // Keep the same pale materials; authored soft streaks remain on the inexpensive tiers.
// }
// setQuality(quality);
// function update(camera,p,mouse=[0,0],reduced=false,reference=false){
//  const room=Math.round(p);
//  if(room!==rigRoom){rigRoom=room;lightingRig.position.x=room*SP;plantKeys.forEach(key=>{key.shadow.needsUpdate=true;});}
//  rooms.forEach((root,i)=>{root.visible=i===room||Math.abs(i-p)<.9999;});
//  const swing=reduced?0:Math.sin(Math.PI*(p%1));
//  if(reference){
//    camera.position.set(0,2.8,0);
//    camera.lookAt(0,2.8-Math.tan(CAM.pitch)*10,-10);
//  }else{
//    camera.position.set(p*SP+1,LUMEN_CAMERA.y,.8*swing);
//    camera.lookAt(p*SP+1,3.286,-29.8);
//  }
//  sun.position.set(p*SP+26,34,-6);sun.target.position.set(p*SP-4,0,-40);
//  fill.position.set(p*SP,10,20);fill.target.position.set(p*SP,0,-40);
//  sun.color.setRGB(...palette.sun);renderer.toneMappingExposure=palette.exposure;
// }
// function dispose(){
//  mirror.dispose();mirror2.dispose();environmentTarget.dispose();
//  disposeSceneResources(scene);
//  irradiance.dispose();
// 
// }
// return {scene,rooms,update,dispose:scope.dispose,setQuality,ready:()=>Boolean(irradiance.image),podium:{x:1,y:1.372,z:-29.8,radius:4.52}};
// }
