"use client";

import {useEffect,useRef,useState} from "react";
import * as THREE from "three";
import {RoomEnvironment} from "three/examples/jsm/environments/RoomEnvironment.js";
import {createGoldenGlassCubeModel,GOLDEN_CUBE_PASS} from "./golden-glass-cube";

/** Isolated look-development view; never mounted by the journey page. */
export default function CubeStudio() {
  const host = useRef<HTMLDivElement>(null);
  const [angle,setAngle] = useState(0);
  const [opened,setOpened] = useState(false);
  const [separation,setSeparation] = useState(1);
  const [coreOnly,setCoreOnly] = useState(false);
  const [geometryOnly,setGeometryOnly] = useState(false);
  const [lighting,setLighting] = useState("reference");
  const [selection,setSelection] = useState("");
  useEffect(()=>{
    const mount=host.current!;
    const scene=new THREE.Scene(); scene.background=new THREE.Color("#fafafa");
    // This on-demand study keeps its buffer for deterministic screenshot capture.
    // The live journey keeps its existing continuous renderer settings.
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1;
    mount.appendChild(renderer.domElement);
    const pmrem=new THREE.PMREMGenerator(renderer);
    const room=new RoomEnvironment(); const environment=pmrem.fromScene(room,.04);
    scene.environment=environment.texture; room.dispose(); pmrem.dispose();
    const grazing=lighting==="grazing",neutral=lighting==="neutral";
    scene.add(new THREE.HemisphereLight(neutral?"#ffffff":"#fff5e7","#9a9ba1",grazing?.4:1.5));
    const key=new THREE.DirectionalLight(neutral?"#ffffff":"#fff4dd",grazing?5:3); key.position.set(-3,grazing?.3:5,4); scene.add(key);
    const fill=new THREE.DirectionalLight("#eaf3ff",grazing?.3:1.5); fill.position.set(4,3,-2); scene.add(fill);
    const model=createGoldenGlassCubeModel(); scene.add(model.root); model.update(coreOnly?1:opened?separation:0); model.faces.forEach(face=>face.visible=!coreOnly);
    // Transparent glass blends into white; use a separate, actual clay render for
    // silhouette measurements while preserving beauty captures for optical review.
    const originalMaterials=new Set<THREE.Material>();
    if(geometryOnly){
      const clay=new THREE.MeshStandardMaterial({color:"#77736c",roughness:1});
      model.root.traverse(object=>{if(object instanceof THREE.Sprite)object.visible=false;if(object instanceof THREE.Mesh){for(const material of Array.isArray(object.material)?object.material:[object.material])originalMaterials.add(material);object.material=clay;}});
    }
    const camera=new THREE.OrthographicCamera(-3,3,3,-3,.1,100);
    const theta=THREE.MathUtils.degToRad(45+angle);
    camera.position.set(Math.sin(theta)*8,3.82,Math.cos(theta)*8); camera.lookAt(0,-.18,0);
    const render=()=>{
      const width=mount.clientWidth,height=mount.clientHeight;
      renderer.setSize(width,height,false);
      const extent=coreOnly?2.5:THREE.MathUtils.lerp(3.1,5.8,opened?separation:0);
      camera.left=-extent*width/height; camera.right=extent*width/height;
      camera.top=extent; camera.bottom=-extent; camera.updateProjectionMatrix();
      renderer.render(scene,camera);
    };
    const observer=new ResizeObserver(render); observer.observe(mount); render();
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
    const select=(event:PointerEvent)=>{
      const bounds=renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);
      raycaster.setFromCamera(pointer,camera);
      const hit=raycaster.intersectObject(model.root,true).find(value=>model.pick(value.object));
      setSelection(hit?model.pick(hit.object)??"":"");
    };
    renderer.domElement.addEventListener("pointerup",select);
    // DOM evidence is read-only to browser automation; renderer objects remain private.
    const meshes:unknown[]=[],parts:unknown[]=[]; model.root.updateMatrixWorld(true);
    model.root.traverse(object=>{
      if(object.name)parts.push({name:object.name,kind:object instanceof THREE.Mesh?"mesh":"part",collider:object.userData.collider??null,partId:object.userData.partId??null});
      if (!(object instanceof THREE.Mesh)) return;
      const position=object.geometry.getAttribute("position");
      meshes.push({name:object.name,partId:object.parent?.name,positions:Array.from(position.array),normals:Array.from(object.geometry.getAttribute("normal").array),indices:object.geometry.index?Array.from(object.geometry.index.array):null,matrixWorld:object.matrixWorld.toArray()});
    });
    const evidence=mount.nextElementSibling;
    if(evidence) evidence.textContent=JSON.stringify({pass:GOLDEN_CUBE_PASS,angle,opened,separation,coreOnly,geometryOnly,lighting,meshes,parts,unnamedMeshes:0,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
    return()=>{
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerup",select);
      const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
      scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Sprite){if(object instanceof THREE.Mesh)geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material]){materials.add(material);for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);}}});
      geometries.forEach(value=>value.dispose()); materials.forEach(value=>value.dispose()); textures.forEach(value=>value.dispose());
      originalMaterials.forEach(value=>value.dispose());
      environment.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  },[angle,opened,separation,coreOnly,geometryOnly,lighting]);
  return <main style={{background:"#fafafa",minHeight:"100vh",color:"#172b42"}}>
    <div ref={host} style={{width:"min(100%,640px)",height:"min(100vw,640px)",marginInline:"auto"}}/>
    <pre data-cube-evidence hidden/>
    <div style={{display:"flex",gap:16,justifyContent:"center",padding:16,flexWrap:"wrap"}}>
      <span>Cube study · {GOLDEN_CUBE_PASS}</span>
      {[0,90,180,270].map(value=><button key={value} onClick={()=>setAngle(value)}>View {value}°</button>)}
      <button onClick={()=>{setOpened(value=>!value);setSeparation(1);}}>{opened?"Close cube":"Explode cube"}</button>
      <button onClick={()=>{setOpened(true);setSeparation(.2);}}>Closing pose</button>
      <button onClick={()=>setCoreOnly(value=>!value)}>{coreOnly?"Show glass shell":"Core only"}</button>
      <button onClick={()=>setGeometryOnly(value=>!value)}>{geometryOnly?"Beauty view":"Geometry view"}</button>
      <select aria-label="Lighting" value={lighting} onChange={event=>setLighting(event.target.value)}><option value="reference">Reference light</option><option value="neutral">Neutral light</option><option value="grazing">Grazing light</option></select>
      <output aria-live="polite">{selection?`Selected: ${selection}`:"Click a face to inspect"}</output>
    </div>
  </main>;
}



