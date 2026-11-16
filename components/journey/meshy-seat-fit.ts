import * as THREE from "three";
import { yieldToMain } from "./scene-loading";

export type MeshySeatFit = { x:number; rearZ:number; frontZ:number; width:number; top:number[]; backZ:number; backHeight:number };

/** The pelvis and legs stay planted on the chair while the upper body speaks. */
export function anchorSeatedClip(source:THREE.AnimationClip,time:number) {
  const clip=source.clone();
  for(const track of clip.tracks){
    const bone=track.name.split(".")[0];
    if(!/Hips$|(?:Left|Right)(?:UpLeg|Leg|Foot|ToeBase|Toe_End)$/.test(bone))continue;
    const value=Array.from(track.createInterpolant().evaluate(time) as ArrayLike<number>);
    track.times=new Float32Array([0,clip.duration]);track.values=new Float32Array([...value,...value]);
  }
  return clip;
}

/** Fit a contoured cushion and a clear backrest to the actual skinned clothing. */
export async function fitSeatedSurface(model:THREE.Group,clip:THREE.AnimationClip,quietTime:number,signal?:AbortSignal):Promise<MeshySeatFit> {
  const hips=model.getObjectByName("mixamorigHips");
  if(!hips)throw new Error("Cannot fit a chair without a seated hip joint");
  const mixer=new THREE.AnimationMixer(model);mixer.clipAction(clip).play();
  const meshes:THREE.SkinnedMesh[]=[];model.traverse(o=>{if(o instanceof THREE.SkinnedMesh)meshes.push(o);});
  const point=new THREE.Vector3();
  const vertices=(visit:(p:THREE.Vector3)=>void)=>{
    for(const mesh of meshes){
      const position=mesh.geometry.attributes.position;
      for(let i=0;i<position.count;i++){
        mesh.applyBoneTransform(i,point.fromBufferAttribute(position,i)).applyMatrix4(mesh.matrixWorld);visit(point);
      }
    }
  };
  try {
    mixer.setTime(quietTime);model.updateMatrixWorld(true);
    const hip=hips.getWorldPosition(new THREE.Vector3()),frontZ=hip.z+.12;
    let rearZ=Infinity,halfWidth=.28;
    const support=(p:THREE.Vector3)=>p.z<=frontZ&&p.z>=hip.z-.45&&Math.abs(p.x-hip.x)<=.46&&p.y<=hip.y+.06&&p.y>=hip.y-.4;
    vertices(p=>{if(support(p)){rearZ=Math.min(rearZ,p.z);halfWidth=Math.max(halfWidth,Math.abs(p.x-hip.x));}});
    if(!Number.isFinite(rearZ))throw new Error("Seated clothing has no support surface");
    rearZ-=.035;
    const width=2*(halfWidth+.045),bins=new Array<number>(12).fill(Infinity);
    // The full dialogue is sampled before a chair is mounted; no per-frame vertex scans.
    for(let frame=0;frame<=16;frame++){
      await yieldToMain(signal);mixer.setTime(frame*clip.duration/17);model.updateMatrixWorld(true);
      vertices(p=>{
        if(!support(p))return;
        const index=Math.max(0,Math.min(bins.length-1,Math.floor((p.z-rearZ)/(frontZ-rearZ)*bins.length)));
        bins[index]=Math.min(bins[index],p.y);
      });
    }
    for(let i=0;i<bins.length;i++)if(!Number.isFinite(bins[i])){
      let nearest=0,distance=Infinity;
      for(let j=0;j<bins.length;j++)if(Number.isFinite(bins[j])&&Math.abs(j-i)<distance){nearest=j;distance=Math.abs(j-i);}
      bins[i]=bins[nearest];
    }
    // Conservative neighboring minima keep the cushion below every cloth triangle.
    const top=Array.from({length:13},(_,i)=>Math.min(bins[Math.max(0,i-1)],bins[Math.min(11,i)],bins[Math.min(11,i+1)])-.012);
    const backHeight=.46;let backMinimum=rearZ;
    for(let frame=0;frame<=16;frame++){
      await yieldToMain(signal);mixer.setTime(frame*clip.duration/17);model.updateMatrixWorld(true);
      vertices(p=>{if(p.y>=top[0]&&p.y<=top[0]+backHeight&&Math.abs(p.x-hip.x)<=width/2+.04)backMinimum=Math.min(backMinimum,p.z);});
    }
    return {x:hip.x,rearZ,frontZ,width,top,backZ:backMinimum-.06,backHeight};
  }finally{mixer.stopAllAction();mixer.uncacheRoot(model);}
}
