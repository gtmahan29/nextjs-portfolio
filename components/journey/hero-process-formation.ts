import * as THREE from "three";
import { CLOSED_POSES, createHolographicProcessCube } from "./holographic-process-cube";

const smooth=(a:number,b:number,value:number)=>THREE.MathUtils.smoothstep(value,a,b);
const easeOut=(value:number)=>value>=1?1:1-Math.pow(2,-8*value);
const easeInOut=(value:number)=>value*value*(3-2*value);

/** Each panel follows one reversible, reserved route into its assigned cube face. */
export function createHeroProcessFormation(environment:THREE.Texture) {
  const scene=new THREE.Scene();scene.environment=environment;
  scene.add(new THREE.HemisphereLight(0xf6fcff,0xb1b7e7,.35));
  const key=new THREE.DirectionalLight(0xffffff,1.5);key.position.set(-4,6,8);key.castShadow=true;key.shadow.mapSize.set(2048,2048);
  Object.assign(key.shadow.camera,{left:-10,right:10,top:7,bottom:-7,near:.1,far:35});
  key.shadow.bias=-.0002;key.shadow.normalBias=.008;key.shadow.radius=3;scene.add(key);
  const fill=new THREE.DirectionalLight(0xecd5ff,.25);fill.position.set(5,2,5);scene.add(fill);
  const camera=new THREE.PerspectiveCamera(32,1,.1,100);
  camera.position.set(0,0,14);camera.lookAt(0,0,0);
  const cube=createHolographicProcessCube();scene.add(cube.root);cube.root.visible=false;
  const assemblyQuaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(.38,-.6,.035));
  const inverseAssembly=assemblyQuaternion.clone().invert();
  const planeHeight=2*14*Math.tan(THREE.MathUtils.degToRad(16));
  let aspect=1,loaded=false;
  const flatPositions=cube.panels.map(()=>new THREE.Vector3());
  const flatQuaternions=cube.panels.map((_,i)=>new THREE.Quaternion().setFromEuler(new THREE.Euler(.035*(i%2?1:-1),.045*(i%3-1),(i%2?1:-1)*.025)));
  const numberTextures:THREE.Texture[]=[], numberMaterials:THREE.SpriteMaterial[]=[];
  const numbers=cube.panels.map((panel,i)=>{
    const canvas=document.createElement("canvas");canvas.width=128;canvas.height=64;
    const ctx=canvas.getContext("2d")!;ctx.font="600 36px Arial";ctx.fillStyle="#346089";ctx.fillText(`0${i+1}`,12,44);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;numberTextures.push(texture);
    const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false});numberMaterials.push(material);
    const number=new THREE.Sprite(material);number.position.set(-.81,1.30,.22);number.scale.set(.54,.27,1);panel.add(number);return number;
  });
  const linkGeometry=new THREE.BufferGeometry();
  const linkMaterial=new THREE.LineDashedMaterial({color:0x5f98b7,transparent:true,opacity:.35,dashSize:.045,gapSize:.075,depthWrite:false});
  const links=new THREE.Line(linkGeometry,linkMaterial);scene.add(links);
  const ready=cube.ready.then(()=>{loaded=true;cube.root.visible=false;});
  const targetWorld=new THREE.Vector3(), targetQuaternion=new THREE.Quaternion();
  const worldPosition=new THREE.Vector3(), localPosition=new THREE.Vector3(), control=new THREE.Vector3();
  const journey=document.getElementById("journey");
  let previousUnits=-1;
  function resize(value:number) {
    aspect=value;camera.aspect=aspect;camera.updateProjectionMatrix();
    const desktop=[[-.29,.21],[0,.17],[.29,.23],[-.26,-.19],[.02,-.23],[.29,-.16]];
    const mobile=[[-.23,.27],[.23,.23],[.23,-.015],[.23,-.29],[-.23,-.25],[-.23,.01]];
    (aspect<1?mobile:desktop).forEach(([x,y],i)=>flatPositions[i].set(x*planeHeight*aspect,y*planeHeight,0));
    const points:THREE.Vector3[]=[];
    flatPositions.forEach((point,i)=>{
      if(i===0){points.push(point.clone().setZ(-.15));return;}
      const previous=flatPositions[i-1];
      for(let j=1;j<=12;j++)points.push(previous.clone().lerp(point,j/12).setZ(-.15));
    });
    linkGeometry.setFromPoints(points);links.computeLineDistances();
  }
  function update(units:number,time:number,reduced:boolean,hero:HTMLElement) {
    const assembly=smooth(3.6,5.4,units);
    const journeyReady=journey?.dataset.sceneState==="ready";
    const handoffEnd=journeyReady?8.28:Infinity;
    cube.root.visible=loaded&&units>.91&&units<handoffEnd;
    cube.root.quaternion.copy(assemblyQuaternion);
    cube.root.position.set(0,0,0);cube.root.scale.setScalar(1-.18*smooth(3.6,4.4,units)*(1-smooth(4.95,5.4,units)));
    cube.core.visible=units>=5.395;
    cube.core.scale.setScalar(1);
    links.visible=false;linkMaterial.opacity=.28*smooth(1.05,2.9,units)*(1-smooth(3.55,4.05,units));
    const flatScale=aspect<1?.65:1.02;
    cube.panels.forEach((panel,i)=>{
      const launch=THREE.MathUtils.clamp((units-(.92+i*.19))/.88,0,1);
      const rise=easeOut(launch);
      worldPosition.copy(flatPositions[i]);
      worldPosition.z=reduced?0:-6*(1-smooth(.05,.86,launch));
      worldPosition.y-=planeHeight*.98*(1-rise);
      worldPosition.x*=.25+.75*rise;
      // A small overshoot gives a thrown panel weight, then settles exactly into its slot.
      worldPosition.y+=Math.sin(launch*Math.PI)*.22;
      worldPosition.x+=Math.sin(launch*Math.PI)*(i%2?-.08:.08);
      const hover=reduced?0:Math.sin(time*.55+i*.7)*.045*launch;
      worldPosition.y+=hover*(1-assembly);
      localPosition.copy(worldPosition).applyQuaternion(inverseAssembly);
      panel.position.copy(localPosition);
      panel.quaternion.copy(inverseAssembly).multiply(flatQuaternions[i]);
      panel.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),reduced?0:(1-rise)*-.65));
      panel.scale.setScalar(flatScale*(.78+.22*rise));
      panel.visible=launch>0;
      numbers[i].visible=units<3.8;
      if(units>=3.6){
        const closed=CLOSED_POSES[i];
        const staging=closed.position.clone().multiplyScalar(2.8);
        const start=flatPositions[i].clone().applyQuaternion(inverseAssembly);
        // Reserve depth-separated lanes before rotating any face toward its dock.
        const gather=smooth(3.6,4.55,units);
        const turn=smooth(4.55,4.95,units);
        const seal=smooth(4.95,5.4,units);
        const lane=new THREE.Vector3(0,0,(i-2.5)*.65).applyQuaternion(inverseAssembly);
        control.copy(start).lerp(staging,.5).add(lane);
        panel.position.copy(start).multiplyScalar((1-gather)**2).addScaledVector(control,2*gather*(1-gather)).addScaledVector(staging,gather*gather);
        panel.quaternion.copy(inverseAssembly).multiply(flatQuaternions[i]).slerp(closed.quaternion,turn);
        if(units>=4.95)panel.position.copy(staging).lerp(closed.position,seal);
        panel.scale.setScalar(THREE.MathUtils.lerp(flatScale,1,gather));
      }
    });
    // The sealed artifact descends first, then meets the exact projected entry artifact.
    if(units>=5.4){
      const drift=smooth(5.7,7.25,units);
      cube.root.position.set(.30*drift,-planeHeight*.29*drift,0);
      cube.root.quaternion.copy(assemblyQuaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),smooth(5.4,6.3,units)*.25));
      const target=smooth(7.15,8.10,units);
      if(target>0){
        const x=Number(journey?.dataset.heroCubeX??.69),y=Number(journey?.dataset.heroCubeY??.42);
        targetWorld.set((x-.5)*planeHeight*aspect,(.5-y)*planeHeight,0);
        cube.root.position.lerp(targetWorld,target);
        const size=Number(journey?.dataset.heroCubeHeight??.34);
        const q=journey?.dataset.heroCubeQuaternion;
        if(q){const values=q.split(',').map(Number);targetQuaternion.set(values[0],values[1],values[2],values[3]);cube.root.quaternion.slerp(targetQuaternion,target);}
        camera.updateMatrixWorld(true);
        let fittedScale=1;
        for(let pass=0;pass<3;pass++){
          let minY=Infinity,maxY=-Infinity;
          for(const x of [-1.1,1.1])for(const y of [-1.1,1.1])for(const z of [-1.1,1.1]){
            const corner=new THREE.Vector3(x,y,z).multiplyScalar(fittedScale).applyQuaternion(cube.root.quaternion).add(targetWorld).project(camera);
            minY=Math.min(minY,corner.y);maxY=Math.max(maxY,corner.y);
          }
          fittedScale*=size/Math.max(.001,(maxY-minY)*.5);
        }
        cube.root.scale.setScalar(THREE.MathUtils.lerp(1,fittedScale,target));
      }
    }
    const transferring=loaded&&units>=6&&units<handoffEnd;
    hero.dataset.transferActive=String(transferring);
    hero.dataset.heroStage=units<.8?'press':units<2.9?'reveal':units<3.6?'ordered':units<5.4?'assemble':units<6?'sealed':'transfer';
    hero.dataset.heroTimeline=units.toFixed(3);
    if(Math.abs(previousUnits-units)>.0005){previousUnits=units;window.dispatchEvent(new Event('hero-process-progress'));}
    return {buttonExit:smooth(.92,1.72,units),titleExit:smooth(.55,1.05,units),mist:smooth(.6,.85,units)*(1-smooth(2.65,3.05,units)),transferring};
  }
  return {scene,camera,ready,resize,update,dispose(){cube.dispose();linkGeometry.dispose();linkMaterial.dispose();numberTextures.forEach(t=>t.dispose());numberMaterials.forEach(m=>m.dispose());}};
}
