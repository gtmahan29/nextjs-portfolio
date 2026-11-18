import * as THREE from "three";
import {gsap} from "gsap";
import {ScrollTrigger} from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);
import type {SceneContext} from "./use-scene-runtime";
import {SceneScope} from "./scene-loading";
import {scenePixelRatio} from "./scene-quality";
import {loadSceneTexture} from "./scene-textures";
import {createLumenShowroom,LUMEN_CAMERA} from "./lumen-showroom-scene";
import {loadShowroomAssets} from "./showroom-assets";
import {createProductPreview} from "./showcase-content";
import assets from "./imported-models/asset-manifest.json";
import {createLaptopTransfer} from "./laptop-transfer";
import {createCameraProgress} from "./camera-motion";
import {createSpring,SPRING_PEAK} from "./motion-curve";
import {play} from "./sfx";
import {CASE_VISIBILITY_EVENT,isCaseStudyOpen} from "./case-scene-visibility";

/** One camera handoff, followed by three services on the same floating turntable. */
export async function mountScene({canvas,section:hall,signal,quality,onActive,onAudit}:SceneContext){
 const scope=new SceneScope(signal);
 try{
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Transparent canvas: the giant service word sits behind the mockup in the DOM.
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setClearColor(0x000000,0);
  scope.defer(()=>renderer.dispose());renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const irradiance=await loadSceneTexture(quality.tier==='low'?assets.irradiance418.url:assets.irradiance836.url,signal);
  scope.defer(()=>irradiance.dispose());
  const baked=await loadShowroomAssets(signal,irradiance,quality.tier!=='high');
  const world=await createLumenShowroom(renderer,{quality,signal,irradiance,bakedRooms:baked.rooms});scope.defer(world.dispose);
  const camera=new THREE.PerspectiveCamera(LUMEN_CAMERA.fov,1,.1,160);
  const turntable=world.turntable as THREE.Group;
  const assemblies=world.assemblies as THREE.Group[];
  const baseScales:number[]=[],homeY:number[]=[],homeX:number[]=[],screens:THREE.Mesh[]=[];
  baked.devices.forEach((device,i)=>{
   let screen:THREE.Mesh|undefined;
   device.traverse(o=>{if(o instanceof THREE.Mesh&&o.userData.showroomScreen)screen=o;});
   if(!screen)throw new Error('Device screen missing');screens.push(screen);
   const display=screen.material as THREE.MeshBasicMaterial;
   if(i===0)display.color.set('#101521');
   else display.map=createProductPreview(i,quality.textureSize);
   device.rotation.y=i===1?-.12:-.1;
   const size=new THREE.Box3().setFromObject(device).getSize(new THREE.Vector3());
   const scale=(i===1?5.25:4.7)/size.y;device.scale.setScalar(scale);baseScales.push(scale);
   const bounds=new THREE.Box3().setFromObject(device);
   device.position.set(-(bounds.min.x+bounds.max.x)/2,world.podium.y-bounds.min.y,0);homeY.push(device.position.y);homeX.push(device.position.x);
   // Departures clear the front edge before falling. No clipping plane or scale morph.
   assemblies[i].add(device);device.visible=true;
  });
  renderer.localClippingEnabled=true;turntable.updateMatrixWorld(true);
  const transfer=createLaptopTransfer(hall,baked.devices[0],screens[0]);scope.defer(transfer.dispose);
  const handoffProgress=()=>reduced?1:transfer.progress();
  const panels=Array.from(hall.querySelectorAll<HTMLElement>('[data-service]'));
  // Copy is scroll-triggered, not scroll-scrubbed: scroll decides which service is on stage,
  // then every element runs the shared spring in real time, so each move always overshoots
  // and is caught, however fast or slow the visitor scrolls.
  const parts=Array.from(hall.querySelectorAll<HTMLElement>('[data-svc]')).map(node=>({
   node,svc:node.dataset.svc==='all'?-1:Number(node.dataset.svc),delay:Number(node.dataset.delay??0)/1000,
   e:createSpring(0),x:createSpring(0),eWant:0,xWant:0,eGoal:0,xGoal:0,eAt:0,xAt:0,eLast:-1,xLast:-1}));
  let width=1,height=1,top=0,span=1,hallHeight=1,target=0,position=0,handoffPosition=0;
  let finalHold=0;
  let frame=0,last=performance.now(),visible=true,disposed=false,active=-1,prepared=false;
  const clamp=THREE.MathUtils.clamp;
  // Lenis smooths the wheel; this critically damped follower adds weight without a
  // second time-based scrub, so the story eases to rest the moment input stops.
  const follow=createCameraProgress(0,.5);
  // Layout is read here only (resize/refresh), never from scroll or render frames.
  const measure=()=>{top=hall.getBoundingClientRect().top+scrollY;hallHeight=hall.offsetHeight;span=Math.max(1,hallHeight-innerHeight);transfer.measure();target=clamp((scrollY-top)/span,0,1);};
  measure();position=follow(target,0,true);handoffPosition=handoffProgress();
  const dataset=(key:string,value:string)=>{if(hall.dataset[key]!==value)hall.dataset[key]=value;};

  const request=()=>{if(prepared&&!frame&&!disposed&&visible&&!document.hidden&&!isCaseStudyOpen()){last=performance.now();frame=requestAnimationFrame(tick);}};
  const resize=()=>{
   width=canvas.clientWidth;height=canvas.clientHeight;
   if(!width||!height)return;
   const ratio=scenePixelRatio(quality,width,height,devicePixelRatio);
   const old=renderer.getSize(new THREE.Vector2());
   if(old.x!==width||old.y!==height||renderer.getPixelRatio()!==ratio){renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);}
   camera.aspect=width/height;camera.fov=width<700?48:LUMEN_CAMERA.fov;camera.updateProjectionMatrix();measure();request();
  }
  /** Where scroll calls in the next service. Everything else is timed by the spring. */
  const STAGE_AT=[.26,.6];
  const stageOf=(p:number)=>p<STAGE_AT[0]?0:p<STAGE_AT[1]?1:2;
  /** A new service waits this long, so the outgoing one is already shrinking when it pops in. */
  const HANDOVER=.12;
  const devices=baked.devices.map((_,i)=>createSpring(i===0?1:0));
  const deviceWant=baked.devices.map((_,i)=>i===0?1:0),deviceAt=baked.devices.map(()=>0);
  const roll=createSpring(0),lower=createSpring(0);
  let rollWant=0,rollAt=0,clock=0;
  const panelVisible=panels.map(()=>false);
  const step=(spring:ReturnType<typeof createSpring>,goal:number,dt:number)=>{
   if(reduced){spring.snap(goal);return false;}
   return spring.step(goal,dt);
  };
  /** Advances every spring by dt and writes the results. Returns true while anything still moves. */
  const pose=(p:number,dt:number,mobile:boolean)=>{
   clock+=dt;
   // Until the laptop has landed, the copy waits behind its masks.
   const ready=handoffPosition>=.999;
   const stage=stageOf(p);
   let moving=false;
   if(stage!==active){
    const first=active<0;active=stage;onActive?.(stage);
    // The pop is heard at the top of the overshoot, the moment the platform is caught.
    if(!first&&ready)play('ui_pop',HANDOVER+SPRING_PEAK);
   }
   for(const part of parts){
    const wantE=ready&&(part.svc<0||part.svc<=stage)?1:0;
    const wantX=ready&&part.svc>=0&&part.svc<stage?1:0;
    if(wantE!==part.eWant){part.eWant=wantE;part.eAt=clock+(wantE?part.delay+(part.svc>0?HANDOVER+.06:0):part.delay*.4);}
    if(wantX!==part.xWant){part.xWant=wantX;part.xAt=clock+part.delay*.5;}
    if(clock>=part.eAt)part.eGoal=part.eWant;else moving=true;
    if(clock>=part.xAt)part.xGoal=part.xWant;else moving=true;
    moving=step(part.e,part.eGoal,dt)||moving;
    moving=step(part.x,part.xGoal,dt)||moving;
    const e=part.e.value,x=part.x.value;
    if(Math.abs(e-part.eLast)>.0005){part.eLast=e;part.node.style.setProperty('--e',e.toFixed(4));}
    if(Math.abs(x-part.xLast)>.0005){part.xLast=x;part.node.style.setProperty('--x',x.toFixed(4));}
   }
   panels.forEach((panel,i)=>{
    const own=parts.filter(part=>part.svc===i);
    const showing=ready&&(stage===i||own.some(part=>part.e.value>.001&&part.x.value<.999));
    if(panelVisible[i]!==showing||!panel.hasAttribute('aria-hidden')){panelVisible[i]=showing;panel.dataset.current=String(showing);panel.setAttribute('aria-hidden',String(!showing));panel.inert=!showing;}
   });
   baked.devices.forEach((_,i)=>{
    const want=(ready?stage===i:i===0)?1:0;
    if(want!==deviceWant[i]){deviceWant[i]=want;deviceAt[i]=clock+(want&&i>0?HANDOVER:0);}
    const goal=clock>=deviceAt[i]?deviceWant[i]:1-deviceWant[i];
    if(clock<deviceAt[i])moving=true;
    moving=step(devices[i],goal,dt)||moving;
   });
   // One value moves the giant word and the counter, landing together with the platform.
   if(stage!==rollWant){rollWant=stage;rollAt=clock+HANDOVER;}
   if(clock<rollAt)moving=true;
   moving=step(roll,clock>=rollAt?rollWant:roll.value,dt)||moving;
   hall.style.setProperty('--pos',roll.value.toFixed(4));
   moving=step(lower,ready&&mobile?1:0,dt)||moving;
   return moving;
  };

  const tick=(now:number)=>{
   frame=0;if(disposed||!visible||document.hidden||isCaseStudyOpen())return;
   const dt=Math.min(.05,(now-last)/1000),springDt=Math.min(.25,(now-last)/1000);last=now;
   const rawHandoff=handoffProgress();
   const oldHandoff=handoffPosition,oldPosition=position;
   // Lenis already smooths the source scroll. A second, asymptotic handoff
   // used to hide the service timeline while that timeline kept advancing.
   handoffPosition=rawHandoff;
   // No normal page movement is permitted between the full-screen page and its display.
   if(rawHandoff===1&&handoffPosition>.99999)handoffPosition=1;
   if(rawHandoff===0&&handoffPosition<.00001)handoffPosition=0;
   // ScrollTrigger and the CSS sticky range use the same section bounds.
   // A single damped playhead drives objects and typography in both directions.
   position=follow(target,dt,reduced);
   const p=position;
   const mobile=width<700;
   const animating=pose(p,springDt,mobile);
   // The mockup stays centred, in front of the giant word. On phones it settles a little lower.
   const baseY=-1.6*lower.value;
   turntable.position.set(world.podium.x,baseY,world.podium.z);
   turntable.rotation.set(0,0,0);turntable.visible=true;
   assemblies.forEach((assembly,i)=>{if(i>0){assembly.position.copy(turntable.position);assembly.visible=false;}});
   world.update(camera);
   if(mobile){camera.position.y=7.2;camera.lookAt(1,3.286,world.podium.z);}
   if(handoffPosition<1){assemblies[0].scale.setScalar(1);assemblies[0].rotation.set(0,0,0);baked.devices.forEach((device,i)=>{device.visible=i===0;device.scale.setScalar(baseScales[i]);device.position.set(homeX[i],homeY[i],0);device.rotation.set(0,i===1?-.12:-.1,0);});}
   if(handoffPosition===0||handoffPosition===1){
    baked.devices.forEach((device,i)=>{
     const assembly=assemblies[i];
     // The platform grows from a point, overshoots and is caught at full size while it spins in;
     // leaving, it spins out and shrinks away. The pop lives inside the move, not on top of it.
     const g=devices[i].value;
     assembly.visible=g>.002;
     const side=i===1?1:-1;
     assembly.scale.setScalar(Math.max(.0001,g));
     assembly.position.set(world.podium.x,baseY-1.6*(1-g),world.podium.z);
     assembly.rotation.set(.12*(1-g),side*1.25*(1-g),0);
     device.visible=true;device.scale.setScalar(baseScales[i]);
     device.position.set(homeX[i],homeY[i],0);
     device.rotation.set(0,i===1?-.12:-.1,0);
    });
   }
   const handoff=transfer.update(camera,handoffPosition,width,height,!reduced&&devices[0].value>.002);
   renderer.render(world.scene,camera);
   if(p>=.99&&handoffPosition>=.999)finalHold+=dt;else finalHold=0;
   // Attribute writes restyle the whole hall subtree; only write real changes.
   dataset('servicesComplete',String(reduced||finalHold>=.45));
   if(!canvas.dataset.sceneReady)canvas.dataset.sceneReady='true';dataset('sceneRendered','true');
   const moving=animating||(p>=.99&&finalHold<.45)||Math.abs(target-position)>.00001||Math.abs(rawHandoff-handoffPosition)>.00001||Math.abs(oldPosition-position)>.000001||Math.abs(oldHandoff-handoffPosition)>.000001;
   if(moving||handoff.changed)frame=requestAnimationFrame(tick);
  }
  // Returning after a jump (anchor, reload) must not replay the story from a stale pose.
  const show=(next:boolean)=>{if(next&&!visible)position=follow(target,0,true);if(!next&&visible)transfer.reset();visible=next;};
  const inHandoff=()=>{const p=handoffProgress();return p>0&&p<1;};
  const scroll=()=>{target=clamp((scrollY-top)/span,0,1);show(scrollY+innerHeight>top&&scrollY<top+hallHeight||inHandoff());request();};
  const observer=new IntersectionObserver(([entry])=>{show(entry.isIntersecting||inHandoff());if(visible)request();},{rootMargin:'0px'});observer.observe(hall);
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);resizeObserver.observe(hall);
  window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',request);window.addEventListener(CASE_VISIBILITY_EVENT,request);
  scope.defer(()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();resizeObserver.disconnect();window.removeEventListener('scroll',scroll);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',request);window.removeEventListener(CASE_VISIBILITY_EVENT,request);delete hall.dataset.servicesComplete;panels.forEach(panel=>{panel.inert=false;panel.removeAttribute('aria-hidden');});
   // Static fallback overrides transforms in CSS; release the inline spring values as well.
   parts.forEach(part=>{part.node.style.removeProperty('--e');part.node.style.removeProperty('--x');});hall.style.removeProperty('--pos');});
  resize();
  // Compile every incoming assembly before scrolling can expose it.
  assemblies.forEach(assembly=>{assembly.visible=true;});
  screens.forEach(screen=>{const map=(screen.material as THREE.MeshBasicMaterial).map;if(map)renderer.initTexture(map);});
  await renderer.compileAsync(world.scene,camera);signal.throwIfAborted();
  assemblies.forEach((assembly,i)=>{assembly.visible=i===0;});
  // Paint and upload before the source page reaches the first transfer pixel.
  if(!reduced){
   // Native sticky is the pin: changing its ancestors would break the earlier
   // fixed, projected page-to-laptop transfer. ScrollTrigger only reports progress.
   const trigger=ScrollTrigger.create({id:'journey-services',trigger:hall,start:'top top',end:'bottom bottom',invalidateOnRefresh:true,
    onUpdate:self=>{target=self.progress;request();},onRefresh:self=>{measure();target=self.progress;request();}});
   scope.defer(()=>trigger.kill());
   ScrollTrigger.refresh();
  }
  measure();position=follow(target,0,true);
  prepared=true;visible=true;tick(performance.now());onAudit?.('Three services; prewarmed continuous laptop handoff');
  return scope.dispose;
 }catch(error){scope.dispose();throw error;}
}

// ORIGINAL SHOWROOM RUNTIME — preserved in comments.
// import * as THREE from "three";
// import {CASE_VISIBILITY_EVENT, isCaseStudyOpen} from "./case-scene-visibility";
// import type {SceneContext} from "./use-scene-runtime";
// import {SceneScope,yieldToMain} from "./scene-loading";
// import {AdaptiveSceneQuality,scenePixelRatio} from "./scene-quality";
// import {loadSceneTexture} from "./scene-textures";
// import {createSceneProfiler} from "./scene-profiler";
// import {createLumenShowroom,LUMEN_CAMERA,LUMEN_SPACING} from "./lumen-showroom-scene";
// import {loadShowroomAssets} from "./showroom-assets";
// import {disposeSceneResources} from "./scene-resources";
// import {createProductPreview} from "./showcase-content";
// import assets from "./imported-models/asset-manifest.json";
// import {warmShowroom} from "./showroom-warmup";
// import {createLaptopTransfer} from './laptop-transfer';
// import {SAMPLE_VIDEOS} from './sample-videos';
// 
// export async function mountScene({canvas,section:hall,signal,quality,onActive,onAudit}:SceneContext) {
//   const scope=new SceneScope(signal);
//   try {
//     const params=new URLSearchParams(location.search), review=params.has("showroomReview");
//     // Original review room/slide selection retained:
//     // const emptyRoom=params.get("showroomReview")==="front",reviewSlide=Math.max(0,Math.min(2,Number(params.get("slide"))||0));
//     const emptyRoom=false,reviewSlide=0;
//     const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
//     const renderer=new THREE.WebGLRenderer({canvas,antialias:quality.antialias,powerPreference:quality.tier==="low"?"low-power":"high-performance"});
//     scope.defer(()=>renderer.dispose());
//     renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
//     renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;
//     renderer.shadowMap.autoUpdate=false;renderer.localClippingEnabled=true;
//     const irradiance=await loadSceneTexture(quality.tier==="low"?assets.irradiance418.url:assets.irradiance836.url,signal);
//     scope.defer(()=>irradiance.dispose());irradiance.channel=1;
//     const baked=await loadShowroomAssets(signal,irradiance,quality.tier!=="high");
//     scope.defer(()=>[...baked.rooms,...baked.devices].forEach(disposeSceneResources));
//     const world=await createLumenShowroom(renderer,{quality,signal,irradiance,bakedRooms:baked.rooms});scope.defer(world.dispose);
//     const camera=new THREE.PerspectiveCamera(LUMEN_CAMERA.fov,1,.1,200),framingCenter=new THREE.Vector3();
//     const adaptive=new AdaptiveSceneQuality(quality),profiler=createSceneProfiler(canvas,renderer,"showroom");
//     let firstScreen:THREE.Mesh|undefined;
//     const screens:THREE.Mesh[]=[];
//     const checks:{slide:number;podiumDiameter:number;deviceContactGap:number}[]=[];
//     for(const [index,room] of Array.from(world.rooms.entries()) as [number,THREE.Group][]) {
//       if(!emptyRoom){
//         const podiumBounds=new THREE.Box3();room.updateMatrixWorld(true);
//         room.traverse(o=>{if(o.name==="podiumTier")podiumBounds.union(new THREE.Box3().setFromObject(o));});
//         const group=baked.devices[index];let screen:THREE.Mesh|undefined;
//         group.traverse(o=>{if(o instanceof THREE.Mesh&&o.userData.showroomScreen)screen=o;});
//         if(!screen)throw new Error("Showroom display missing");
//         screens.push(screen);
//         const device={group,screen};
//         if(index===0)firstScreen=screen;
//         (device.screen.material as THREE.MeshBasicMaterial).map=createProductPreview(index,quality.textureSize);
//         device.group.rotation.y=index===1?-.08:-.1;
//         const initial=new THREE.Box3().setFromObject(device.group).getSize(new THREE.Vector3());device.group.scale.setScalar(4.7/initial.y);
//         const bounds=new THREE.Box3().setFromObject(device.group);
//         device.group.position.set(world.podium.x-(bounds.min.x+bounds.max.x)/2,world.podium.y-bounds.min.y,world.podium.z);
//         device.group.traverse(o=>{
//           if(!(o instanceof THREE.Mesh))return;o.castShadow=true;o.receiveShadow=true;
//           (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m instanceof THREE.MeshStandardMaterial)m.envMapIntensity=1.2;});
//         });
//         room.add(device.group);room.updateMatrixWorld(true);
//         checks.push({slide:index+1,podiumDiameter:Number(podiumBounds.getSize(new THREE.Vector3()).x.toFixed(2)),deviceContactGap:Number((new THREE.Box3().setFromObject(device.group).min.y-world.podium.y).toFixed(6))});
//       }
//       // Exported surfaces are already merged. Keep per-room clipping on devices.
//       const x=index*LUMEN_SPACING;
//       const planes=[new THREE.Plane(new THREE.Vector3(1,0,0),-(x-LUMEN_SPACING/2)),new THREE.Plane(new THREE.Vector3(-1,0,0),x+LUMEN_SPACING/2)];
//       room.traverse(o=>{if(o instanceof THREE.Mesh)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.clippingPlanes=planes;m.clipShadows=true;});});
//       room.updateMatrixWorld(true);room.traverse(o=>{o.matrixAutoUpdate=false;o.matrixWorldAutoUpdate=false;});
//       await yieldToMain(signal);
//     }
//     // Static room matrices remain frozen. The first device owns the moving joint.
//     baked.devices[0].traverse(o=>{o.matrixWorldAutoUpdate=true;});
//     baked.devices.forEach(device=>device.traverse(o=>{o.matrixWorldAutoUpdate=true;}));
//     const transfer=!review&&!reduced&&firstScreen?createLaptopTransfer(hall,baked.devices[0],firstScreen):undefined;
//     scope.defer(()=>transfer?.dispose());
//     onAudit?.(JSON.stringify(checks));
//     let target=review?reviewSlide:0,position=target,index=-1,top=0,span=1;
//     let storyVelocity=0;
//   let frame=0,last=performance.now(),renderedAt=0,visible=review,lastShadow=-Infinity,shadowPosition=Infinity,shadowTransfer=-1;
//     let width=0,height=0,prepared=false;
//     const invalidate=()=>{if(prepared&&!frame&&visible&&!document.hidden&&!isCaseStudyOpen()){last=performance.now();frame=requestAnimationFrame(tick);}};
//     const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),focusCenter=new THREE.Vector3();
//     const home=baked.devices.map(d=>({y:d.position.y,yaw:d.rotation.y}));
//     let hovered=-1,focusTarget=0,focus=0,previewAnnounced=false,previewScroll=0;
//     const screenCenter=new THREE.Vector3(),screenNormal=new THREE.Vector3(),previewEye=new THREE.Vector3(),previewRotation=new THREE.Quaternion(),previewView=new THREE.Matrix4();
//     const originalMaps=screens.map(s=>(s.material as THREE.MeshBasicMaterial).map);
//     const video=document.createElement('video');video.playsInline=true;video.loop=true;video.preload='none';video.crossOrigin='anonymous';
//     const videoTexture=new THREE.VideoTexture(video);videoTexture.colorSpace=THREE.SRGBColorSpace;
//     const blankCanvas=document.createElement('canvas');blankCanvas.width=1280;blankCanvas.height=800;
//     const blankContext=blankCanvas.getContext('2d')!;blankContext.fillStyle='#11151b';blankContext.fillRect(0,0,1280,800);
//     const blankTexture=new THREE.CanvasTexture(blankCanvas);blankTexture.colorSpace=THREE.SRGBColorSpace;
//     const restoreScreens=()=>{video.pause();screens.forEach((s,i)=>(s.material as THREE.MeshBasicMaterial).map=originalMaps[i]);};
//     scope.defer(()=>{video.pause();video.removeAttribute('src');video.load();videoTexture.dispose();blankTexture.dispose();});
//     const videoFrame=()=>{if(signal.aborted)return;if(focusTarget&&!video.paused)invalidate();video.requestVideoFrameCallback?.(videoFrame);};
//     video.requestVideoFrameCallback?.(videoFrame);
//     const hit=(event:PointerEvent)=>{
//       if((transfer?.progress()??1)<.99||Math.abs(position-target)>.01)return false;
//       const rect=canvas.getBoundingClientRect();
//       pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
//       raycaster.setFromCamera(pointer,camera);
//       return raycaster.intersectObject(baked.devices[Math.round(position)],true).length>0;
//     };
//     const hover=(event:PointerEvent)=>{const next=hit(event)?Math.round(position):-1;if(next!==hovered){hovered=next;canvas.style.cursor=next>=0?'pointer':'';invalidate();}};
//     const leave=()=>{hovered=-1;canvas.style.cursor='';invalidate();};
//     const open=()=>{
//       if((transfer?.progress()??1)<.99)return;
//       const selected=Math.round(position),src=SAMPLE_VIDEOS[selected];
//       (screens[selected].material as THREE.MeshBasicMaterial).map=src?videoTexture:blankTexture;
//       if(src){video.src=src;void video.play().catch(()=>hall.dispatchEvent(new Event('showroom-video-paused')));}
//       focusTarget=1;previewScroll=scrollY;previewAnnounced=false;hall.dataset.preview='true';invalidate();
//     };
//     let pressX=0,pressY=0,pressed=false;
//     const press=(event:PointerEvent)=>{pressX=event.clientX;pressY=event.clientY;pressed=true;};
//     const select=(event:PointerEvent)=>{if(pressed&&Math.hypot(event.clientX-pressX,event.clientY-pressY)<8&&hit(event))open();pressed=false;};
//     const close=()=>{focusTarget=0;previewAnnounced=false;restoreScreens();delete hall.dataset.preview;invalidate();};
//     // Original sample interaction retained, disabled for the laptop handoff:
//     // canvas.addEventListener('pointerdown',press);canvas.addEventListener('pointermove',hover);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('pointerup',select);
//     hall.addEventListener('showroom-preview-open',open);hall.addEventListener('showroom-preview-close',close);
//     scope.defer(()=>{canvas.removeEventListener('pointerdown',press);canvas.removeEventListener('pointermove',hover);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('pointerup',select);hall.removeEventListener('showroom-preview-open',open);hall.removeEventListener('showroom-preview-close',close);canvas.style.cursor='';});
//     const measure=()=>{
//       const rect=hall.getBoundingClientRect();top=rect.top+scrollY;span=Math.max(1,hall.offsetHeight-innerHeight);
//       visible=review||rect.top<innerHeight&&rect.bottom>0;
//       transfer?.measure();
//       const handoff=transfer?.progress()??0;visible ||= handoff>0&&handoff<1;
//       // Original three-room scroll travel retained:
//       // if(!review)target=THREE.MathUtils.clamp((scrollY-top)/span,0,1)*2;
//       target=0;
//     };
//     const resize=()=>{
//       const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
//       if(w!==width||h!==height||renderer.getPixelRatio()!==scenePixelRatio(adaptive.current,w,h,devicePixelRatio)){
//         width=w;height=h;renderer.setPixelRatio(scenePixelRatio(adaptive.current,w,h,devicePixelRatio));renderer.setSize(w,h,false);
//         camera.aspect=w/h;camera.fov=w<700?48:LUMEN_CAMERA.fov;camera.updateProjectionMatrix();shadowPosition=Infinity;
//       }
//       measure();invalidate();
//     };
//     const scroll=()=>{
//       if(focusTarget&&Math.abs(scrollY-previewScroll)>24){close();hall.dispatchEvent(new Event('showroom-preview-dismiss'));}
//       // Original three-room scroll travel retained:
//       // if(!review)target=THREE.MathUtils.clamp((scrollY-top)/span,0,1)*2;
//       target=0;
//       const handoff=transfer?.progress()??0;
//       // Restore fixed overlays even when a jump skips the visible render loop.
//       if(handoff<=0||handoff>=1)transfer?.reset();
//       visible=review||scrollY+innerHeight>top&&scrollY<top+span+innerHeight||handoff>0&&handoff<1;
//       invalidate();
//     };
//     const tick=(now:number)=>{
//       frame=0;if(!visible||document.hidden||isCaseStudyOpen())return;
//       if(now-renderedAt<1000/adaptive.current.fps-1){frame=requestAnimationFrame(tick);return;}
//       const elapsed=renderedAt?now-renderedAt:1000/adaptive.current.fps;
//       const dt=Math.min(.05,(now-last)/1000);last=now;renderedAt=now;
//       const cpuStart=performance.now();profiler.begin(now);
//       position=reduced?target:THREE.MathUtils.lerp(position,target,1-Math.exp(-dt*8));
//       if(Math.abs(position-target)<.0001)position=target;
//       const moving=position!==target,nextIndex=Math.round(position);
//       if(index!==nextIndex){index=nextIndex;onActive?.(index);}
//       world.update(camera,position,[0,0],reduced||review,emptyRoom);
//       if(width<700&&!emptyRoom){camera.position.y=7.2;camera.lookAt(position*LUMEN_SPACING+world.podium.x,3.286,world.podium.z);}
//       const handoffProgress=transfer?.progress()??1;
//       const handoff=transfer?.update(camera,handoffProgress,width,height);
//       focus=reduced?focusTarget:THREE.MathUtils.lerp(focus,focusTarget,1-Math.exp(-dt*7));
//       if(Math.abs(focus-focusTarget)<.002)focus=focusTarget;
//       let deviceMoving=false;
//       baked.devices.forEach((device,i)=>{
//         const lift=!handoff?.active&&hovered===i&&!focusTarget ? .12:0;
//         const nextY=THREE.MathUtils.lerp(device.position.y,home[i].y+lift,reduced?1:1-Math.exp(-dt*10));
//         deviceMoving ||= Math.abs(nextY-device.position.y)>.0001;
//         device.position.y=nextY;device.updateMatrix();device.updateMatrixWorld(true);
//       });
//       if(focus>0&&handoffProgress>=.99){
//         const screen=screens[nextIndex];screen.geometry.computeBoundingBox();const bounds=screen.geometry.boundingBox!;
//         bounds.getCenter(screenCenter).applyMatrix4(screen.matrixWorld);
//         screenNormal.set(0,0,1).transformDirection(screen.matrixWorld);
//         const scale=screen.getWorldScale(focusCenter);
//         const distance=Math.max((bounds.max.y-bounds.min.y)*scale.y,(bounds.max.x-bounds.min.x)*scale.x/camera.aspect)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))/.78;
//         previewEye.copy(screenCenter).addScaledVector(screenNormal,distance);
//         previewView.lookAt(previewEye,screenCenter,camera.up);previewRotation.setFromRotationMatrix(previewView);
//         camera.position.lerp(previewEye,focus);camera.quaternion.slerp(previewRotation,focus);
//       }
//       if(focus===1&&!previewAnnounced){previewAnnounced=true;hall.dispatchEvent(new CustomEvent('showroom-preview-ready',{detail:nextIndex}));}
//       if((shadowPosition!==position||shadowTransfer!==handoffProgress)&&(!moving&&!handoff?.active||now-lastShadow>=1000/adaptive.current.shadowHz)){
//         renderer.shadowMap.needsUpdate=true;lastShadow=now;shadowPosition=position;shadowTransfer=handoffProgress;
//       }
//       renderer.render(world.scene,camera);
//       canvas.dataset.sceneReady="true";hall.dataset.sceneRendered="true";canvas.dataset.quality=adaptive.current.tier;
//       if(!moving){
//         framingCenter.set(position*LUMEN_SPACING+world.podium.x,3.286,world.podium.z).project(camera);
//         canvas.dataset.framing=JSON.stringify({centerX:Number(framingCenter.x.toFixed(4)),centerY:Number(framingCenter.y.toFixed(4)),cameraY:camera.position.y});
//         canvas.dataset.showroomReady="true";
//       }
//       profiler.end(now,{slide:index+1,quality:adaptive.current.tier,settled:!moving&&!handoff?.active,reflections:adaptive.current.reflections,transfer:transfer?.progress()});
//       if(adaptive.sample(now,performance.now()-cpuStart,elapsed)){world.setQuality(adaptive.current);resize();}
//       if(moving||deviceMoving||focus!==focusTarget||handoff?.changed||handoff?.active&&shadowTransfer!==handoffProgress)frame=requestAnimationFrame(tick);
//       // A settled showroom is static. No RAF, reflection, shadow or React work runs.
//     };
//     measure();position=target;resize();
//     // Prewarm all rooms with the same shared light rig: slide changes do not compile new light counts.
//     // Initialize clipping before compilation. Otherwise compileAsync prepares
//     // unclipped programs and the first real frame recompiles every room.
//     renderer.render(new THREE.Scene(),camera);
//     world.update(camera,position,[0,0],true,emptyRoom);
//     await warmShowroom(renderer,world.scene,camera,scope,signal);
//     // Scroll may have changed during asynchronous preparation. The first live
//     // frame must use today's destination, not the position captured before warmup.
//     measure();position=target;resize();
//     prepared=true;
//     // Finish the real first frame offscreen, including uploads/shadow targets.
//     // Entry can then reveal the canvas without a substitute image or first-draw stall.
//     const initiallyVisible=visible;visible=true;tick(performance.now());visible=initiallyVisible;
//     const observer=new ResizeObserver(resize);observer.observe(canvas);observer.observe(hall);
//     const visibility=new IntersectionObserver(([entry])=>{
//       const handoff=transfer?.progress()??0;
//       visible=review||entry.isIntersecting||handoff>0&&handoff<1;if(visible)invalidate();else{cancelAnimationFrame(frame);frame=0;}
//     });visibility.observe(hall);
//     const tabVisibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else invalidate();};
//     window.addEventListener("scroll",scroll,{passive:true});window.addEventListener("resize",resize);
//     document.addEventListener("visibilitychange",tabVisibility);
//     window.addEventListener(CASE_VISIBILITY_EVENT,invalidate);
//     scope.defer(()=>window.removeEventListener(CASE_VISIBILITY_EVENT,invalidate));
//     scope.defer(()=>{cancelAnimationFrame(frame);observer.disconnect();visibility.disconnect();window.removeEventListener("scroll",scroll);window.removeEventListener("resize",resize);document.removeEventListener("visibilitychange",tabVisibility);});
//     invalidate();return scope.dispose;
//   }catch(error){scope.dispose();throw error;}
// }
// 
