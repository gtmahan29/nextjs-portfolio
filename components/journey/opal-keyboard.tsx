"use client";
import { useEffect, useRef } from "react";
import type { Group, Material, BufferGeometry } from "three";
import type { KeyboardFrame } from "@/components/lib/isometric/keyboard-performance";

const PHRASE="MAKE IT REAL.";
const CONTACTS=[.22,.42,.59,.79,1.02,1.24,1.43,1.72,1.95,2.14,2.35,2.62,2.87];
const codeFor=(letter:string)=>letter===" "?"Space":letter==="."?"Period":letter;
const travel=(t:number)=>t<0||t>.43?0:t<.055?1-Math.pow(1-t/.055,3):t<.095?1:Math.exp(-(t-.095)*23)*(1+(t-.095)*23);

/** The actual Blender asset, rendered at device resolution; no image plane or SVG surrogate. */
export default function OpalKeyboard(){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const element=host.current;if(!element)return;const node:HTMLDivElement=element;
  let disposed=false,gen=0,live=false,cleanup:(()=>void)|undefined;
  let latest:KeyboardFrame={angle:0,time:-1,demo:-1,reduced:false};
  let draw:((frame:KeyboardFrame)=>void)|undefined;
  const receive=(event:Event)=>{latest=(event as CustomEvent<KeyboardFrame>).detail;draw?.(latest);};
  node.addEventListener('iso-keyboard',receive);
  async function mount(){
   // Each build has its own generation: a release mid-load leaves the stale build to dispose itself.
   const mine=++gen,stale=()=>disposed||mine!==gen;
   const [THREE,{GLTFLoader},{createOpalKeyboardRig}]=await Promise.all([
    import('three'),import('three/examples/jsm/loaders/GLTFLoader.js'),import('./opal-keyboard-rig')
   ]);
   if(stale())return;
   // Phones share one memory pool between the page and the GPU: a lighter canvas and shadow there.
   const phone=matchMedia('(any-pointer: coarse) and (max-width: 860px)').matches;
   const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:phone?'default':'high-performance'});
   renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
   renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
   renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
   renderer.domElement.setAttribute('aria-hidden','true');node.appendChild(renderer.domElement);
   const scene=new THREE.Scene();
   // A long lens, not an orthographic plan: the far row recedes a little, like a product photo.
   const camera=new THREE.PerspectiveCamera(17,1.25,1,200);
   const view=new THREE.Vector3(0,23,18).normalize(),target=new THREE.Vector3(0,.4,0);let distance=60;
   // Local studio cards create broad highlights with dark gaps that describe the rolled edges.
   const pmrem=new THREE.PMREMGenerator(renderer),studio=new THREE.Scene();
   studio.background=new THREE.Color(.035,.045,.065);
   const cards:InstanceType<typeof THREE.Mesh>[]=[];
   const card=(width:number,height:number,x:number,y:number,z:number,intensity:number)=>{
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({color:new THREE.Color(intensity,intensity,intensity),side:THREE.DoubleSide}));
    panel.position.set(x,y,z);panel.lookAt(0,0,0);studio.add(panel);cards.push(panel);
   };
   card(11,6,-5,9,4,3.5);card(13,2,2,7,-5,2.0);card(3,7,10,3,0,1.4);
   const environment=pmrem.fromScene(studio,.035);scene.environment=environment.texture;
   cards.forEach(panel=>{panel.geometry.dispose();(panel.material as InstanceType<typeof THREE.MeshBasicMaterial>).dispose();});pmrem.dispose();
   scene.add(new THREE.HemisphereLight(0xffffff,0x364358,.12));
   const key=new THREE.DirectionalLight(0xfffaf4,1.8);key.position.set(-5,9,5);key.castShadow=true;
   key.shadow.mapSize.set(phone?2048:4096,phone?1024:2048);Object.assign(key.shadow.camera,{left:-12,right:12,top:8,bottom:-8,near:.5,far:40});
   key.shadow.bias=-.00015;key.shadow.normalBias=.015;key.shadow.radius=6;scene.add(key);
   const fill=new THREE.DirectionalLight(0xe2edff,.42);fill.position.set(5,7,-6);scene.add(fill);
   const cyan=new THREE.PointLight(0x38dfff,5,10,2);cyan.position.set(-6,1,0);scene.add(cyan);
   const pink=new THREE.PointLight(0xff72db,5,10,2);pink.position.set(6,1,0);scene.add(pink);
   // PBT grain: a fine, irregular texture that breaks up highlights the way real keycaps do.
   const grainSize=256,grainData=new Uint8Array(grainSize*grainSize*4);
   for(let i=0;i<grainSize*grainSize;i++){const n=150+Math.floor(Math.random()*70);grainData.set([n,n,n,255],i*4);}
   const grain=new THREE.DataTexture(grainData,grainSize,grainSize);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.repeat.set(9,9);grain.needsUpdate=true;
   // A soft contact shadow where the case meets the desk, plus the light's own cast shadow.
   const contactCanvas=document.createElement('canvas');contactCanvas.width=512;contactCanvas.height=256;
   const contactPaint=contactCanvas.getContext('2d')!;contactPaint.filter='blur(18px)';contactPaint.fillStyle='rgba(8,18,40,.62)';
   contactPaint.beginPath();contactPaint.roundRect(48,48,416,160,60);contactPaint.fill();
   const contactTexture=new THREE.CanvasTexture(contactCanvas);
   const contact=new THREE.Mesh(new THREE.PlaneGeometry(20.5,9.4),new THREE.MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false,toneMapped:false}));
   contact.rotation.x=-Math.PI/2;contact.position.y=-.03;contact.renderOrder=-1;scene.add(contact);
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,24),new THREE.ShadowMaterial({opacity:.16}));
   floor.rotation.x=-Math.PI/2;floor.position.y=-.026;floor.receiveShadow=true;scene.add(floor);
   let model:Group|undefined,rig:ReturnType<typeof createOpalKeyboardRig>|undefined;
   const resize=()=>{
    const width=node.clientWidth,height=node.clientHeight;if(!width||!height)return;
    renderer.setPixelRatio(phone?Math.min(window.devicePixelRatio||1,2):Math.min(Math.max(window.devicePixelRatio||1,2.5),3,Math.sqrt(6000000/(width*height))));renderer.setSize(width,height,false);
    const aspect=width/height;camera.aspect=aspect;camera.updateProjectionMatrix();
    // Frame the board's 20-unit width with a little air on each side.
    distance=11.6/(Math.tan(THREE.MathUtils.degToRad(17/2))*aspect);
    draw?.(latest);
   };
   let signature='',lastText='';
   draw=frame=>{
    if(stale()||!model||!rig)return;
    const sig=[frame.angle.toFixed(4),frame.time.toFixed(4),frame.demo?.toFixed(4),JSON.stringify(frame.presses),frame.reduced,node.clientWidth,node.clientHeight].join(':');
    if(sig===signature)return;signature=sig;
    const a=Math.max(0,Math.min(1,frame.angle));
    camera.position.copy(target).addScaledVector(view,distance);camera.lookAt(target);camera.updateMatrixWorld();
    rig.resetKeys();
    const time=frame.reduced?4:frame.time;
    if(time>=0){
     const presses=new Map<string,number>();
     CONTACTS.forEach((at,i)=>{const code=codeFor(PHRASE[i]);presses.set(code,Math.max(presses.get(code)??0,frame.reduced?0:travel(time-at)));});
     presses.forEach((amount,code)=>rig!.press(code,amount));
     const count=CONTACTS.filter(at=>time>=at+.055).length,text=PHRASE.slice(0,count);
     if(text!==lastText){lastText=text;node.dispatchEvent(new CustomEvent('iso-typed',{bubbles:true,detail:text}));}
    }else{
     if(lastText){lastText='';node.dispatchEvent(new CustomEvent('iso-typed',{bubbles:true,detail:''}));}
     const demo=frame.demo??-1,index=Math.floor(demo/.32);
     if(!frame.reduced&&demo>=0&&index<5)rig.press('BUILD'[index],travel(demo-index*.32));
    }
    const contacts=new Map<string,number>();
    frame.presses?.forEach(({code,amount})=>contacts.set(code,Math.max(contacts.get(code)??0,amount)));
    contacts.forEach((amount,code)=>rig!.press(code,frame.reduced?0:amount));
    rig.update(1/60);renderer.render(scene,camera);
    node.dataset.angle=a.toFixed(3);node.dataset.typed=lastText;
   };
   const observer=new ResizeObserver(()=>{signature='';resize();});observer.observe(node);
   cleanup=()=>{
    observer.disconnect();rig?.dispose();
    const materials=new Set<Material>(),geometries=new Set<BufferGeometry>();
    scene.traverse(object=>{if(object instanceof THREE.Mesh){geometries.add(object.geometry);(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>materials.add(m));}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());grain.dispose();contactTexture.dispose();environment.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
   };
   resize();
   try{
    const gltf=await new GLTFLoader().loadAsync('/models/hero-keyboard/hero-keyboard-tight65.glb?v=soft-travel-13');
    if(stale()){gltf.scene.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>m.dispose());}});return;}
    model=gltf.scene;
    const styledMaterials=new Set<string>();
    const rgbEnabled={value:1},rgbFlow={value:0};
    const opticalBand=new THREE.MeshPhysicalMaterial({name:'Continuous optical diffuser',color:0x7d9db8,roughness:.18,metalness:.05,clearcoat:.8,clearcoatRoughness:.13});
    opticalBand.userData.rgbWashUniform=rgbEnabled;
    opticalBand.onBeforeCompile=shader=>{
     shader.uniforms.uOpticalRGB=rgbEnabled;shader.uniforms.uOpticalFlow=rgbFlow;
     shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vOpticalPosition;').replace('#include <project_vertex>','#include <project_vertex>\nvOpticalPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
     shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vOpticalPosition;\nuniform float uOpticalRGB;\nuniform float uOpticalFlow;');
     shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float t=clamp((vOpticalPosition.x+8.425)/16.85+uOpticalFlow*.025,0.0,1.0);
      vec3 spectrum=t<.48?mix(vec3(.015,.75,1.),vec3(.36,.19,1.),smoothstep(0.,.48,t)):mix(vec3(.36,.19,1.),vec3(1.,.20,.72),smoothstep(.48,1.,t));
      diffuseColor.rgb=mix(vec3(.48,.57,.65),spectrum*.48,uOpticalRGB);
     `).replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance=spectrum*1.65*uOpticalRGB;');
    };
    opticalBand.customProgramCacheKey=()=> 'continuous-optical-rgb-v6';

    model.traverse(object=>{
     if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;
      const sourceMaterials=Array.isArray(object.material)?object.material:[object.material];
      if(sourceMaterials.every(m=>m.name.startsWith('RGB_'))){object.material=Array.isArray(object.material)?sourceMaterials.map(()=>opticalBand):opticalBand;return;}
      for(const mat of Array.isArray(object.material)?object.material:[object.material])if(mat instanceof THREE.MeshStandardMaterial){
       mat.envMapIntensity=.75;
       if(mat instanceof THREE.MeshPhysicalMaterial){mat.clearcoat=.22;mat.clearcoatRoughness=.22;}
       // Keycaps: dye-sublimated PBT, matte with a fine grain, not glossy plastic.
       if(mat.name.includes('keycaps')||mat.name.includes('modifiers')||mat.name.includes('Escape')){
        mat.roughness=.5;mat.roughnessMap=grain;mat.bumpMap=grain;mat.bumpScale=.35;mat.envMapIntensity=.7;mat.emissive.setHex(0x000000);mat.emissiveIntensity=0;
        if(mat instanceof THREE.MeshPhysicalMaterial){mat.clearcoat=0;mat.sheen=.35;mat.sheenRoughness=.6;mat.sheenColor.setHex(0xffffff);}
       }
       // The case: bead-blasted anodised aluminium with a soft, wide highlight.
       if(mat.name.startsWith('Polished pearl')){mat.metalness=.92;mat.roughness=.34;mat.roughnessMap=grain;mat.envMapIntensity=1.05;mat.color.setRGB(.78,.81,.86);}
       if(mat.name.startsWith('Ceramic white')){mat.roughness=.42;mat.roughnessMap=grain;}
       if(mat.name.startsWith('Legend')){mat.color.setHex(0x1d2634);mat.roughness=.9;mat.metalness=0;mat.envMapIntensity=0;object.castShadow=false;}
       const strength=Math.min(.2,Number(mat.userData.rgb_wash??0));
       if(strength>0&&!styledMaterials.has(mat.uuid)){
        styledMaterials.add(mat.uuid);
        const neutral=mat.userData.neutral_color as number[]|undefined;
        if(neutral?.length===3)mat.color.setRGB(neutral[0],neutral[1],neutral[2]);
        const enabled={value:1};mat.userData.rgbWashUniform=enabled;
        mat.onBeforeCompile=shader=>{
         shader.uniforms.uKeyboardRGB=enabled;shader.uniforms.uKeyboardWash={value:strength};
         shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vKeyboardPosition;').replace('#include <project_vertex>','#include <project_vertex>\nvKeyboardPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
         shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vKeyboardPosition;\nuniform float uKeyboardRGB;\nuniform float uKeyboardWash;');
         shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          float keyboardT=clamp((vKeyboardPosition.x+8.425)/16.85,0.0,1.0);
          vec3 keyboardTint=keyboardT<0.36?mix(vec3(.04,.78,.96),vec3(.19,.35,.91),keyboardT/.36):keyboardT<.66?mix(vec3(.19,.35,.91),vec3(.53,.27,.83),(keyboardT-.36)/.30):mix(vec3(.53,.27,.83),vec3(.96,.34,.72),(keyboardT-.66)/.34);
          float lowerGlow=1.0-smoothstep(1.02,1.48,vKeyboardPosition.y);
          diffuseColor.rgb=mix(diffuseColor.rgb,keyboardTint,uKeyboardWash*uKeyboardRGB*lowerGlow*.55);
         `).replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=keyboardTint*lowerGlow*uKeyboardWash*uKeyboardRGB*.35;');
        };
        mat.customProgramCacheKey=()=> 'opal-global-wash-v6';mat.needsUpdate=true;
       }
      }
     }
    });
    const glowGeometry=new THREE.PlaneGeometry(19,8);
    const glowMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{opacity:{value:.16}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 vUv;uniform float opacity;void main(){vec2 q=abs(vUv*2.0-1.0);float alpha=(1.0-smoothstep(.72,1.0,max(q.x,q.y)))*opacity;vec3 c=vUv.x<.5?mix(vec3(.12,.8,1.),vec3(.5,.35,.95),vUv.x*2.):mix(vec3(.5,.35,.95),vec3(1.,.38,.8),(vUv.x-.5)*2.);gl_FragColor=vec4(c,alpha);}' });
    const glow=new THREE.Mesh(glowGeometry,glowMaterial);glow.rotation.x=-Math.PI/2;glow.position.y=-.02;scene.add(glow);
    scene.add(model);rig=createOpalKeyboardRig(model);rig.setRGB(true);rig.update(1);
    node.dataset.modelReady='true';node.dataset.rgb='on';node.setAttribute('aria-busy','false');signature='';draw(latest);
   }catch(error){console.error('Blender keyboard:',error);node.dataset.loadError='true';}
  }
  const build=()=>{if(live||disposed)return;live=true;mount().catch(error=>console.error('Blender keyboard renderer:',error));};
  const release=()=>{
   if(!live)return;live=false;gen++;draw=undefined;cleanup?.();cleanup=undefined;
   delete node.dataset.modelReady;node.setAttribute('aria-busy','true');
  };
  // Phones: the keyboard's canvas, shadow map and model hold about 80 MB of GPU memory. Like the
  // hero around it, it gives that back once the visitor is three screens away and rebuilds within
  // a screen and a half of coming back.
  const onPhone=matchMedia('(any-pointer: coarse) and (max-width: 860px)').matches;
  const anchor=node.closest<HTMLElement>('.hero-start')??node;
  const near=onPhone?new IntersectionObserver(([entry])=>{if(entry.isIntersecting)build();},{rootMargin:`${innerHeight*1.5}px 0px`}):undefined;
  const keeper=onPhone?new IntersectionObserver(([entry])=>{if(!entry.isIntersecting)release();},{rootMargin:`${innerHeight*3}px 0px`}):undefined;
  if(near&&keeper){near.observe(anchor);keeper.observe(anchor);}else build();
  return()=>{disposed=true;near?.disconnect();keeper?.disconnect();release();node.removeEventListener('iso-keyboard',receive);};
 },[]);
 return <div className="opal-keyboard-model" data-opal-keyboard="" role="img" aria-label="Opal mechanical keyboard, RGB lighting on" aria-busy="true" ref={host}/>;
}





