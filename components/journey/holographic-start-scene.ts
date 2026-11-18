import * as THREE from "three";
import {CASE_VISIBILITY_EVENT, isCaseStudyOpen} from "./case-scene-visibility";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createHeroClouds } from "./hero-clouds";
import { createPressImpact } from "./start-press-impact";
import { createStartMotion } from "./hero-start-motion";
import { createSpring } from "./motion-curve";
import { play } from "./sfx";
import { reportLoad } from "./page-loader";
import { getSceneQuality, scenePixelRatio } from "./scene-quality";

export async function mountStartScene(host: HTMLDivElement, onReady: () => void) {
  const quality = getSceneQuality();
  const lowPower = quality.tier === "low";
  const powerPreference = lowPower ? "low-power" : "default";
  const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, alpha:true, powerPreference });
  renderer.autoClear=false;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = null;
  const impact=createPressImpact(scene);
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const cardCanvas=document.createElement("canvas"); cardCanvas.width=cardCanvas.height=128;
  const cardContext=cardCanvas.getContext("2d")!;
  const cardGradient=cardContext.createRadialGradient(64,64,12,64,64,64);
  cardGradient.addColorStop(0,"rgba(255,255,255,1)"); cardGradient.addColorStop(.55,"rgba(255,255,255,.7)"); cardGradient.addColorStop(1,"rgba(255,255,255,0)");
  cardContext.fillStyle=cardGradient; cardContext.fillRect(0,0,128,128);
  const cardTexture=new THREE.CanvasTexture(cardCanvas);
  // Long studio cards give the optical cap readable, moving reflections.
  for (const [x,y,z,w,h,power] of [[-4,5,-5,4,.7,8],[-5,3,3,.6,5,5],[4,3,-5,1,4,3]]) {
    const card=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:cardTexture,color:new THREE.Color(power,power,power),transparent:true,depthWrite:false,side:THREE.DoubleSide}));
    card.position.set(x,y,z); card.lookAt(0,1,0); room.add(card);
  }
  const environment = pmrem.fromScene(room, .01);
  scene.environment = environment.texture;
  const section=host.closest<HTMLElement>(".hero-start")!;
  const content=host.querySelector<HTMLElement>(".hero-start-next");
  const hit=section.querySelector<HTMLButtonElement>(".hero-start-hit");
  const motion=createStartMotion();
  const activate=()=>motion.activate();section.addEventListener("hero-start-activate",activate);
  // Touch, mouse and keyboard all drive the same physical switch.
  let hoverOn=false;
  const onEnter=()=>{hoverOn=true;motion.hover(true);syncRendering();};
  const onLeave=()=>{hoverOn=false;motion.hover(false);motion.cancel();syncRendering();};
  const onDown=(event:PointerEvent)=>{if(event.button!==0)return;motion.down();syncRendering();};
  const onCancel=()=>{motion.cancel();syncRendering();};
  const onKeyDown=(event:KeyboardEvent)=>{if(event.repeat||(event.key!==" "&&event.key!=="Enter"))return;motion.down();syncRendering();};
  // Space anywhere on the opening screen presses the key, as the hint promises.
  let spaceHeld=false;
  const typing=(el:Element|null)=>!!el&&(el.matches("input,textarea,select,[contenteditable],button,a")||el.closest("[contenteditable]")!==null);
  const onPageKeyDown=(event:KeyboardEvent)=>{
    if(event.key!==" "||typing(document.activeElement)||section.getBoundingClientRect().top<-8||hit?.disabled)return;
    event.preventDefault();if(event.repeat||spaceHeld)return;
    spaceHeld=true;section.dataset.keyHeld="true";motion.down();syncRendering();
  };
  const onPageKeyUp=(event:KeyboardEvent)=>{
    if(event.key!==" "||!spaceHeld)return;
    spaceHeld=false;delete section.dataset.keyHeld;event.preventDefault();hit?.click();
  };
  const onBlur=()=>{if(spaceHeld){spaceHeld=false;delete section.dataset.keyHeld;}motion.hover(false);motion.cancel();syncRendering();};
  hit?.addEventListener("pointerenter",onEnter);hit?.addEventListener("pointerleave",onLeave);
  hit?.addEventListener("pointerdown",onDown);hit?.addEventListener("pointercancel",onCancel);hit?.addEventListener("keydown",onKeyDown);
  hit?.addEventListener("blur",onCancel);
  window.addEventListener("keydown",onPageKeyDown);window.addEventListener("keyup",onPageKeyUp);window.addEventListener("blur",onBlur);
  // The key arrives on the shared spring a moment after the sky opens; its edge light answers hover and impact.
  const entry=createSpring(0),glow=createSpring(0),arrivalSpin=new THREE.Quaternion(),UP=new THREE.Vector3(0,1,0);let readyAt=-1,edgeMaterial:THREE.MeshStandardMaterial|undefined,lastCap="";
  const reviewValue=process.env.NODE_ENV!=="production"?new URLSearchParams(location.search).get("heroReview"):null;
  const review=reviewValue!==null&&Number.isFinite(Number(reviewValue));
  const readUnits=()=>review?Math.max(0,Math.min(8.5,Number(reviewValue))):Math.max(0,-section.getBoundingClientRect().top/Math.max(1,host.clientHeight));
  room.dispose();
  cardTexture.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b4d6, .65));
  const key = new THREE.DirectionalLight(0xffffff, 2.5);
  key.position.set(-3, 8, 4);
  const shadowSize = lowPower ? quality.shadows : 1024;
  key.shadow.mapSize.set(shadowSize, shadowSize);
  key.shadow.camera.left = -5; key.shadow.camera.right = 5;
  key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
  key.shadow.bias = -.001; key.shadow.normalBias = .025; key.shadow.radius = 5;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd2eaff, .8); fill.position.set(5, 4, -4); scene.add(fill);
  const flight=new THREE.Group();flight.position.set(0,.65,0);scene.add(flight);
  const pivot = new THREE.Group();pivot.position.set(0,-.65,0);flight.add(pivot);
  const flightPath=new THREE.CubicBezierCurve3(new THREE.Vector3(),new THREE.Vector3(0,-.18,-.5),new THREE.Vector3(0,1.6,-3.6),new THREE.Vector3(0,1.45,-3.8));
  const cameraSpace=new THREE.Vector3(),faceCamera=new THREE.Quaternion(),tumble=new THREE.Quaternion();
  const tumbleEuler=new THREE.Euler();
  const topFacing=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
  let viewportHeight=7,modelReady=false;
  let lastLift=0;
  const squash=createSpring(0);let lastBow=0;
  pivot.scale.setScalar(.64);
  const press = new THREE.Group(); pivot.add(press);
  const clouds=await createHeroClouds();
  reportLoad("sky",1);
  const cloudRenderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference});
  cloudRenderer.domElement.className="hero-start-cloud-canvas";
  cloudRenderer.domElement.setAttribute("aria-hidden","true");
  renderer.domElement.className="hero-start-product-canvas";
  renderer.domElement.setAttribute("aria-hidden","true");
  host.appendChild(cloudRenderer.domElement);
  let cloudDirty=true, lastCloudTime=-Infinity, cloudScroll=0,cloudCoverage=1,cloudArrival=0,whiteout=0;
  const renderHero=(time=performance.now())=>{
    if (cloudDirty || (!reduced && cloudCoverage>.001 && time-lastCloudTime>=1000/20)) {
      clouds.update(time/1000,reduced,cloudScroll,cloudCoverage,cloudArrival,whiteout);
      clouds.useForeground(cloudArrival>0);
      cloudRenderer.render(clouds.scene,clouds.camera);
      cloudDirty=false; lastCloudTime=time;
    }
    renderer.clear();renderer.render(scene,camera);
    if(cloudArrival>0){renderer.clearDepth();renderer.render(clouds.foregroundScene,clouds.camera);}
  };
  let alive = true, frame = 0, visible = true, targetX = 0, targetY = 0;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const resize = () => {
    if (lowPower && !visible) return;
    const width=host.clientWidth, height=host.clientHeight;
    // Bound fill rate on large/retina displays instead of scaling cost with DPR squared.
    renderer.setPixelRatio(lowPower ? scenePixelRatio(quality,width,height,devicePixelRatio) : Math.min(devicePixelRatio,2,Math.sqrt(4000000/(width*height))));
    renderer.setSize(width,height);
    const cloudScale=Math.min(lowPower ? 1 : 1.25,Math.sqrt((lowPower ? quality.maxPixels : 1800000)/(width*height)));
    cloudRenderer.setPixelRatio(cloudScale); cloudRenderer.setSize(width,height);
    cloudDirty=true;
    camera.aspect=width/height;
    const distance = camera.aspect < 1 ? 12.5 / camera.aspect ** .35 : 11.8;
    camera.position.set(distance*.57,distance*.64,distance*.68);
    camera.lookAt(0,.72,0); camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
    viewportHeight=2*camera.position.distanceTo(new THREE.Vector3(0,.72,0))*Math.tan(THREE.MathUtils.degToRad(16));
    flightPath.v2.set(0,viewportHeight*.20,-3.6);flightPath.v3.set(0,viewportHeight*.18,-3.8);
    faceCamera.copy(camera.quaternion).multiply(topFacing);
    clouds.resize(camera.aspect);
  };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const syncRendering=()=>{
    cancelAnimationFrame(frame); frame=0;
    if(alive && visible && !document.hidden && !isCaseStudyOpen()) frame=requestAnimationFrame(animate);
  };
  const visibility = new IntersectionObserver(([entry]) => {
    const wasVisible = visible;
    visible = entry.isIntersecting;
    if (lowPower && visible !== wasVisible) {
      if (visible) resize();
      else {
        renderer.setSize(1,1,false);
        cloudRenderer.setSize(1,1,false);
      }
    }
    syncRendering();
  });
  visibility.observe(host);
  document.addEventListener("visibilitychange",syncRendering);
  window.addEventListener(CASE_VISIBILITY_EVENT,syncRendering);
  const move = (event: PointerEvent) => {
    const rect=host.getBoundingClientRect();
    targetY=((event.clientX-rect.left)/rect.width-.5)*.12;
    targetX=((event.clientY-rect.top)/rect.height-.5)*.045;
  };
  const leave = () => { targetX=targetY=0; };
  host.parentElement?.addEventListener("pointermove",move);
  host.parentElement?.addEventListener("pointerleave",leave);
  window.addEventListener("scroll",syncRendering,{passive:true});
  let lastMotion=performance.now(),lastUnits=-1;
  let lastRender=0, sampleStart=performance.now(), sampleFrames=0, sampleCost=0;
  const animate = (time:number) => {
    if (!alive) return;
    frame=0;
    if (!visible || document.hidden || isCaseStudyOpen()) return;
    frame=requestAnimationFrame(animate);
    const dt=Math.min(.05,Math.max(0,(time-lastMotion)/1000));lastMotion=time;
    const state=motion.update(readUnits(),dt,modelReady,reduced,review);
    for(const event of motion.drain()){
      play(event==="down"?"key_down":event==="contact"?"key_thock":"key_up");
      // Bottom-out: the whole unit squashes and bows a hair toward you, on the shared spring.
      if(event==="contact"&&!reduced)squash.kick(3.2);
    }
    // The launch has one sound: air, as the key leaves its mount.
    if(state.real&&lastLift<=.04&&state.lift>.04)play("key_whoosh");
    lastLift=state.lift;
    if(modelReady&&readyAt<0)readyAt=time;
    let springsMoving=false;
    if(readyAt>=0&&(reduced||time-readyAt>220)){if(reduced)entry.snap(1);else springsMoving=entry.step(1,dt)||springsMoving;}
    const hovered=hoverOn||state.mode==="held";
    if(reduced)glow.snap(hovered?1:0);else springsMoving=glow.step(hovered?1:0,dt)||springsMoving;
    const e=entry.value;
    const storyVisible=state.contentOpacity>.005||(state.units>=2.12&&state.units<=6.35);
    section.dispatchEvent(new CustomEvent("hero-story-frame",{detail:{units:state.units,visible:storyVisible,contentOpacity:state.contentOpacity,reduced}}));
    const pressHeight=.10-.55*state.cap;
    const moving=springsMoving||state.active||Math.abs(state.units-lastUnits)>.0001||Math.abs(pivot.rotation.x-targetX*(1-state.lift))+Math.abs(pivot.rotation.y-targetY*(1-state.lift))>.001;
    if(!moving&&!cloudDirty&&!flight.visible&&cloudCoverage<.001&&state.contentOpacity===1&&content?.style.opacity==="1")return;
    const interval=moving?1000/60:1000/30;
    if(time-lastRender < interval-1 || (reduced&&!moving&&!cloudDirty)) return;
    lastRender=time-(time-lastRender)%interval;
    const start=performance.now();
    lastUnits=state.units;
    const pointerGain=reduced?0:1-state.lift;
    const follow=1-Math.exp(-dt/.10);
    pivot.rotation.y=THREE.MathUtils.lerp(pivot.rotation.y,targetY*pointerGain,follow);
    pivot.rotation.x=THREE.MathUtils.lerp(pivot.rotation.x,targetX*pointerGain,follow);
    pivot.rotation.z=0;
    flightPath.getPoint(state.lift,cameraSpace);
    cameraSpace.y-=viewportHeight*1.20*state.drop+state.impulse;
    cameraSpace.z+=.60*state.drop;
    cameraSpace.applyQuaternion(camera.quaternion);
    flight.position.copy(cameraSpace).add(new THREE.Vector3(0,.65,0));
    flight.quaternion.identity().slerp(faceCamera,state.lift);
    const turn=reduced?state.drop*.16:state.fallTime;
    tumble.setFromEuler(tumbleEuler.set(1.25*turn,-.46*turn,.10*turn));
    flight.quaternion.multiply(tumble);
    if(e<1)flight.quaternion.multiply(arrivalSpin.setFromAxisAngle(UP,(1-Math.max(0,e))*-.9));
    // The object remains opaque all the way beyond the lower viewport edge.
    flight.visible=state.drop<1;
    press.position.y=pressHeight;

    // Pop inside the arrival: the overshoot of the same spring is the bounce (k = 3 for 3D).
    const arrive=e>1?1+(e-1)*3:Math.max(0,e);
    if(reduced)squash.snap(0);else squash.step(0,dt);
    const sq=squash.value,base=.64*Math.max(.001,arrive);
    pivot.scale.set(base*(1+.035*sq),base*(1-.07*sq),base*(1+.035*sq));
    // The bow is an offset on top of the pointer tilt: last frame's is removed before this one's is added.
    const bow=.05*sq;pivot.rotation.x+=bow-lastBow;lastBow=bow;
    pivot.position.y=-.65-(1-Math.min(1,e))*.9;
    if(edgeMaterial){const flash=state.impact>=0?(1-state.impact)**2:0;edgeMaterial.emissiveIntensity=2.2+1.5*Math.max(0,glow.value)+3*flash;}
    const capText=Math.max(0,state.cap).toFixed(3);if(capText!==lastCap){lastCap=capText;section.style.setProperty("--cap",capText);}
    impact.update(-1,reduced);
    if(content){content.style.opacity='1';content.style.visibility=storyVisible?'visible':'hidden';content.style.transform='none';content.setAttribute("aria-hidden",String(!storyVisible));}
    if(hit){hit.disabled=!state.interactive;hit.style.pointerEvents=state.interactive?"auto":"none";hit.setAttribute("aria-hidden",String(state.units>.25));}
    if(Math.abs(cloudScroll-state.lift*.18)+Math.abs(cloudCoverage-state.cloudCoverage)+Math.abs(cloudArrival-state.cloudArrival)+Math.abs(whiteout-state.whiteout)>.0001){
      cloudScroll=state.lift*.18;cloudCoverage=state.cloudCoverage;cloudArrival=state.cloudArrival;whiteout=state.whiteout;cloudDirty=true;
    }
    section.dataset.heroStage=state.stage;section.dataset.heroTimeline=state.units.toFixed(3);section.dataset.capState=state.mode;
    renderer.domElement.dataset.pressProgress=state.cap.toFixed(3);
    renderer.domElement.dataset.flightLift=state.lift.toFixed(3);renderer.domElement.dataset.flightDrop=state.drop.toFixed(3);
    cloudRenderer.domElement.dataset.cloudCoverage=cloudCoverage.toFixed(3);
    renderHero(time);
    sampleFrames++; sampleCost+=performance.now()-start;
    if(time-sampleStart>=2000){
      renderer.domElement.dataset.renderFps=(sampleFrames*1000/(time-sampleStart)).toFixed(1);
      renderer.domElement.dataset.renderCpuMs=(sampleCost/sampleFrames).toFixed(2);
      renderer.domElement.dataset.drawCalls=String(renderer.info.render.calls);
      sampleStart=time;sampleFrames=sampleCost=0;
    }
  };
  syncRendering();
  try {
    const gltf=await new GLTFLoader().loadAsync("/holographic-start/holographic-start.glb?v=continuous-glass-4",event=>{if(event.total)reportLoad("key",event.loaded/event.total*.95);});
    reportLoad("key",1);
    gltf.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow=true; object.receiveShadow=true;
      for (const mat of Array.isArray(object.material)?object.material:[object.material]) {
        if (mat instanceof THREE.MeshStandardMaterial) mat.envMapIntensity=.8;
        const materialName=mat.name.replaceAll("_"," ").replace(/\.\d+$/, "");
        if (mat instanceof THREE.MeshStandardMaterial && materialName==="Obsidian socket") mat.color.setHex(0x080a18);
        if (mat instanceof THREE.MeshPhysicalMaterial && materialName==="Holographic glass") {
          mat.transmission=.2; mat.thickness=.55; mat.ior=1.52;
          mat.iridescence=.28; mat.iridescenceIOR=1.35; mat.iridescenceThicknessRange=[180,420];
          mat.clearcoat=1; mat.clearcoatRoughness=.035; mat.roughness=.075; mat.metalness=.18;
          mat.envMapIntensity=1.2; mat.emissiveIntensity=.035;
        }
        if (mat instanceof THREE.MeshPhysicalMaterial && materialName.startsWith("Optical ")) {
          const wall=materialName==="Optical spectral walls";
          mat.transmission=wall?.40:.08; mat.thickness=wall?.42:.65; mat.ior=1.48;
          mat.iridescence=wall?.5:.28; mat.iridescenceIOR=1.3; mat.iridescenceThicknessRange=[220,440];
          mat.clearcoat=1; mat.clearcoatRoughness=wall?.035:.065; mat.roughness=wall?.06:.09;
          mat.envMapIntensity=1.35; mat.emissiveIntensity=.25;
        }
        if (mat instanceof THREE.MeshPhysicalMaterial && materialName==="Optical blue crown") {
          mat.transmission=.16; mat.metalness=0; mat.roughness=.055;
          mat.clearcoat=1; mat.clearcoatRoughness=.025; mat.envMapIntensity=.85;
          mat.iridescence=.4; mat.dispersion=0; mat.thickness=.35; mat.emissiveIntensity=.04;
        }
        if (mat instanceof THREE.MeshPhysicalMaterial && materialName==="Smooth spectral glass") {
          mat.transmission=.48; mat.thickness=.35; mat.ior=1.46;
          mat.dispersion=0; mat.iridescence=.45; mat.iridescenceThicknessRange=[180,400];
          mat.metalness=0; mat.roughness=.045; mat.clearcoat=1; mat.clearcoatRoughness=.025;
          mat.envMapIntensity=1.1;
        }
        if (materialName==="Optical lettering") {
          // Keep the inscription out of the glass transmission capture to avoid a second refracted copy.
          mat.transparent=true; mat.opacity=1; object.renderOrder=10;
        }
        if (mat instanceof THREE.MeshPhysicalMaterial && materialName==="Clear dispersive crystal") {
          mat.color.setHex(0xf5fcff); mat.transmission=1; mat.thickness=.56;
          mat.ior=1.52; mat.roughness=.025; mat.metalness=0;
          mat.dispersion=.75;
          mat.iridescence=.7; mat.iridescenceIOR=1.3; mat.iridescenceThicknessRange=[260,580];
          mat.clearcoat=1; mat.clearcoatRoughness=.02; mat.envMapIntensity=1;
          mat.attenuationColor.setHex(0xc8f4ff); mat.attenuationDistance=2.4;
        }
        if (mat instanceof THREE.MeshPhysicalMaterial && materialName==="Pearl titanium") {
          mat.metalness=.32; mat.roughness=.2; mat.clearcoat=1; mat.clearcoatRoughness=.07;
        }
      }
      const objectName=object.name.replaceAll("_"," ").replace(/\.\d+$/, "");
      if (objectName==="Cyan lower optical edge" && !Array.isArray(object.material) && object.material instanceof THREE.MeshStandardMaterial) {
        const edge=object.material.clone(); edge.map=null; edge.emissiveMap=null;
        edge.color.setHex(0x72eeff); edge.emissive.setHex(0x28dbff); edge.emissiveIntensity=2.2;
        object.material=edge;edgeMaterial=edge;
      }
    });
    pivot.add(gltf.scene);
    const initialPress=press.position.y;
    press.position.y=0;
    scene.updateMatrixWorld(true);
    const moving: THREE.Object3D[] = [];
    gltf.scene.traverse(object => {
      const name=object.name.replaceAll("_"," ").replace(/\.\d+$/, "");
      if (["Glass button","Glass upper specular edge","Cyan lower optical edge","Start inscription","Optical inner core"].includes(name)) moving.push(object);
    });
    moving.forEach(object=>press.attach(object));
    impact.bind(press);
    press.position.y=initialPress;
    renderHero();
    modelReady=true;renderer.domElement.dataset.modelReady="true"; onReady();
    // The first frame with the key in it is on screen: the loader may leave.
    requestAnimationFrame(()=>requestAnimationFrame(()=>reportLoad("frame",1)));
  } catch (error) { console.error("Holographic hero:",error); }
  return () => {
    alive=false;impact.dispose();section.removeEventListener("hero-start-activate",activate);
    hit?.removeEventListener("pointerenter",onEnter);hit?.removeEventListener("pointerleave",onLeave);
    hit?.removeEventListener("pointerdown",onDown);hit?.removeEventListener("pointercancel",onCancel);hit?.removeEventListener("keydown",onKeyDown);hit?.removeEventListener("blur",onCancel);
    window.removeEventListener("keydown",onPageKeyDown);window.removeEventListener("keyup",onPageKeyUp);window.removeEventListener("blur",onBlur);window.removeEventListener("scroll",syncRendering);cancelAnimationFrame(frame); observer.disconnect(); visibility.disconnect();
    document.removeEventListener("visibilitychange",syncRendering);
    window.removeEventListener(CASE_VISIBILITY_EVENT,syncRendering);
    host.parentElement?.removeEventListener("pointermove",move); host.parentElement?.removeEventListener("pointerleave",leave);
    const textures=new Set<THREE.Texture>();
    scene.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); for (const mat of Array.isArray(object.material)?object.material:[object.material]) { for(const value of Object.values(mat)) if(value instanceof THREE.Texture) textures.add(value); mat.dispose(); } } });
    textures.forEach(texture=>texture.dispose());
    // Both canvases are ours and leave the page: drop their contexts now, not at garbage collection.
    clouds.dispose(); environment.dispose(); pmrem.dispose(); cloudRenderer.dispose(); renderer.dispose();
    cloudRenderer.forceContextLoss(); renderer.forceContextLoss(); cloudRenderer.domElement.remove(); renderer.domElement.remove();
  };
}



