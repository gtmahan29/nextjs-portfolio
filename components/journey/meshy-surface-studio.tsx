"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { MESHY_ASSETS } from "./meshy-population-layout";
import { cleanMeshySurface } from "./meshy-surface";
import { disposeSceneResources } from "./scene-resources";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createMeshyFurniture } from "./meshy-chair";
import { anchorSeatedClip, fitSeatedSurface } from "./meshy-seat-fit";
import { inPlaceClip, quietPoseTime } from "./meshy-animation";

/** Close-up inspection of the actual GLBs, with identical pose and lighting on both sides. */
export default function MeshySurfaceStudio() {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const [asset,setAsset]=useState(1),[status,setStatus]=useState("Loading…");
  const [seating,setSeating]=useState(false);
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    let disposed=false;
    const scene=new THREE.Scene();scene.background=new THREE.Color("#d9e1e6");
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
    const camera=new THREE.PerspectiveCamera(28,1,.01,100);
    camera.position.set(seating?2.8:0,1.35,seating?3.4:7.1);camera.lookAt(0,.9,0);
    const controls=new OrbitControls(camera,canvas);controls.target.set(0,.9,0);controls.update();
    controls.addEventListener("change",()=>renderer.render(scene,camera));
    const furniture=createMeshyFurniture();
    scene.add(new THREE.HemisphereLight("#ffffff","#7d858a",2));
    const sun=new THREE.DirectionalLight("#fff8ef",2.5);sun.position.set(-2,4,4);scene.add(sun);
    const roots:THREE.Object3D[]=[],mixers:THREE.AnimationMixer[]=[];
    let source:THREE.Object3D|undefined;
    const resize=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);};
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
    const controller=new AbortController();
    setStatus("Loading…");
    void (async()=>{
      try {
        const response=await fetch(`/3d-models-glb/${MESHY_ASSETS[asset].file}`,{signal:controller.signal});
        const buffer=await response.arrayBuffer();const gltf=await new GLTFLoader().parseAsync(buffer,"/3d-models-glb/");
        source=gltf.scene;if(disposed){disposeSceneResources(source);return;}
        const bounds=new THREE.Box3().setFromObject(source),scale=1.7/(bounds.max.y-bounds.min.y);
        const center=bounds.getCenter(new THREE.Vector3());
        const seatedSource=gltf.animations.find(c=>c.name==="Sitting_Answering_Questions");
        const seatedClip=seating&&seatedSource?inPlaceClip(seatedSource):undefined;
        const quietTime=seatedClip?quietPoseTime(gltf.scene,seatedClip):.1;
        const anchored=seatedClip&&anchorSeatedClip(seatedClip,quietTime);
        const seatFit=anchored?await fitSeatedSurface(gltf.scene,anchored,quietTime,controller.signal):undefined;
        if(disposed)return;
        for(let side=seating?1:0;side<2;side++){
          const model=clone(source);model.traverse(object=>{
            if(!(object instanceof THREE.Mesh))return;
            object.material=Array.isArray(object.material)?object.material.map(m=>m.clone()):object.material.clone();
            if(side===1)for(const material of Array.isArray(object.material)?object.material:[object.material]){
              if(material instanceof THREE.MeshStandardMaterial&&material.map)material.map=material.map.clone();
            }
            if(object instanceof THREE.SkinnedMesh)object.frustumCulled=false;
          });
          if(side===1)cleanMeshySurface(model,renderer.capabilities.getMaxAnisotropy());
          model.scale.setScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
          const wrapper=new THREE.Group();wrapper.position.x=seating?0:side===0?-.75:.75;wrapper.rotation.y=-.35;wrapper.add(model);
          const clip=anchored??gltf.animations.find(c=>c.name==="Sitting_Answering_Questions")??gltf.animations.find(c=>c.name==="Talk_with_Hands_Open");
          const mixer=new THREE.AnimationMixer(model);if(clip){mixer.clipAction(clip).play();mixer.setTime(anchored?quietTime:.1);}
          wrapper.updateMatrixWorld(true);
          if(seatFit){
            model.traverse(o=>{if(o instanceof THREE.SkinnedMesh)o.computeBoundingBox();});
            model.position.y+=.04-new THREE.Box3().setFromObject(model).min.y;
            wrapper.add(furniture.buildSeated(seatFit,model.position,scale,"meeting"));
          }
          mixers.push(mixer);scene.add(wrapper);roots.push(wrapper);
        }
        setStatus(seating?"Fitted chair · pelvis and feet anchored":"Left: original GLB · Right: repaired surface");
        renderer.render(scene,camera);
      }catch(error){if(!disposed)setStatus(String(error));}
    })();
    return()=>{disposed=true;controller.abort();observer.disconnect();controls.dispose();
      mixers.forEach(m=>{m.stopAllAction();m.uncacheRoot(m.getRoot());});
      const resources=new THREE.Group();roots.forEach(r=>resources.add(r));if(source)resources.add(source);
      const skeletons=new Set<THREE.Skeleton>();resources.traverse(o=>{if(o instanceof THREE.SkinnedMesh)skeletons.add(o.skeleton);});
      skeletons.forEach(s=>s.dispose());disposeSceneResources(resources);furniture.dispose();renderer.dispose();};
  },[asset,seating]);
  return <main style={{height:"100vh",background:"#d9e1e6",color:"#243746",display:"flex",flexDirection:"column"}}>
    <header style={{padding:16,display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
      <a href="/?scenePerf=1">← Journey</a>
      <label>Character <select aria-label="Character" style={{background:"#fff",color:"#243746",padding:4,borderRadius:4}} value={asset} onChange={e=>setAsset(Number(e.target.value))}>
        {MESHY_ASSETS.map((model,i)=><option disabled={seating&&i!==0&&i!==1} value={i} key={model.file}>{["Blueprint Dreamer","Shadow Scout","Crafter Ava","Midnight Scholar","Minimal Muse","Coral Boy"][i]}</option>)}
      </select></label>
      <button style={{background:"#fff",padding:6,borderRadius:4}} onClick={()=>{if(!seating&&asset!==0&&asset!==1)setAsset(1);setSeating(!seating);}}>{seating?"Surface comparison":"Inspect chair"}</button>
      <span role="status">{status} · Drag to rotate</span>
    </header>
    <canvas ref={canvasRef} style={{width:"100%",flex:1,minHeight:0}} aria-label={seating?"Seated character and fitted chair":"Original character on left, repaired character on right"} />
  </main>;
}
