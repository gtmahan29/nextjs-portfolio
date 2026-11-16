import { camera, type Vec3 } from "@/components/lib/isometric/iso";
import { box, cylinder, rotateX, scale, translate, type Mesh } from "@/components/lib/isometric/mesh";
import { scene, type Drawable, type Stroke } from "@/components/lib/isometric/scene";
import { pcCaseEntity } from "@/components/ui/pc-case";

const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const ease=(v:number)=>{const t=clamp(v);return t*t*t*(t*(t*6-15)+10)};
const at=(p:number,a:number,b:number)=>ease((p-a)/(b-a));

/** A common camera and coordinate system for the installed PC entity and its workstation. */
export function mountStudioWorkstation(group:SVGGElement){
 const renderer=scene(group),pc=pcCaseEntity.init({open:true,on:false});
 const cam=camera(45,.5,2.5);cam.ox=500;cam.oy=360;
 const ctx={value:10,hover:null,camera:cam,read:()=>{}};
 return (p:number)=>{
  const out:(Drawable|Stroke)[]=[];
  const add=(mesh:Mesh,cls:string,layer=0)=>out.push({mesh,cls,shade:true,layer});
  const cable=(pts:Vec3[],cls='studio-cable',layer=0)=>out.push({pts,cls,layer});
  // A real desktop: the keyboard, screen and tower sit on the same surface.
  add(box(-110,-55,-6,110,63,0),'studio-desk',-4);
  add(box(-110,60,-6,110,63,-3),'studio-edge',-3);
  for(const x of [-92,92]){
   add(box(x-3,-39,-38,x+3,-33,-6),'studio-leg',-5);
   add(box(x-3,45,-38,x+3,51,-6),'studio-leg',-5);
  }
  // Display stand, bezel and a window physically contained inside it.
  add(box(-24,-27,0,24,-11,2),'studio-metal');
  add(box(-3,-24,2,3,-19,26),'studio-metal');
  add(box(-60,-25,24,60,-20,100),'studio-bezel');
  add(box(-57,-19.9,27,57,-19.2,97),'studio-screen');
  const display=(x:number,z:number,w:number,h:number,cls:string,depth=0)=>add(box(x,-19+depth,z,x+w,-18.5+depth,z+h),cls,2);
  // Header and actual product interface, progressively populated by the machine.
  const boot=at(p,.22,.31),layout=at(p,.28,.39),cards=at(p,.35,.46),chart=at(p,.43,.55);
  display(-53,86,106,7,'studio-toolbar');
  for(let i=0;i<3;i++)add(translate(rotateX(cylinder(0,0,0,1,1,12),Math.PI/2),[-48+i*4,-18,89.5]),['studio-coral','studio-amber','studio-mint'][i],3);
  display(-53,31,20,52*boot,'studio-sidebar');
  for(let i=0;i<4;i++)display(-49,75-i*8,12*boot,1,'studio-sidebar-ink',.1);
  for(let i=0;i<3;i++){
   const q=at(cards,i*.16,.65+i*.16),z=67+(1-q)*12;
   display(-28+i*27,z,23,13*q,'studio-card');
   display(-24+i*27,z+8,10*q,1.7,['studio-violet','studio-coral','studio-mint'][i],.2);
   display(-24+i*27,z+4,14*q,.8,'studio-label',.2);
  }
  display(-28,34,77,28*layout,'studio-panel');
  for(let i=0;i<3;i++)display(-24,39+i*7,69,.4,'studio-grid',.1);
  for(let i=0;i<9;i++){
   const q=at(chart,i*.045,.55+i*.045),height=[5,8,6,12,10,16,15,20,24][i]*q;
   display(-22+i*7.5,36,4.5,height,i===8?'studio-coral':'studio-violet',.3);
  }
  // The installed PC case: panel, RAM, GPU, fan blades and power light each have a cue.
  pc.panel.x=pc.panel.to=1-at(p,.19,.31);pc.panel.v=0;
  pc.ram.x=pc.ram.to=1-at(p,.07,.17);pc.ram.v=0;
  pc.gpu.x=pc.gpu.to=1-at(p,.14,.23);pc.gpu.v=0;
  pc.on=p>.23;pc.fan.x=pc.fan.to=at(p,.23,.34);pc.fan.v=0;
  pc.spin=at(p,.23,.60)*Math.PI*18;
  const parts:(Drawable|Stroke)[]=[];pcCaseEntity.draw(pc,parts,ctx);
  const origin:Vec3=[74,-43,2];
  parts.forEach(part=>{
   const cls=`studio-pc ${part.cls??''}`;
   if('mesh' in part)out.push({...part,mesh:translate(scale(part.mesh,.86),origin),cls,layer:4});
   else out.push({...part,pts:part.pts.map(v=>[v[0]*.86+origin[0],v[1]*.86+origin[1],v[2]*.86+origin[2]] as Vec3),cls,layer:4});
  });
  // Cables are physically routed across the back of the desk to the connected devices.
  cable([[84,-23,1],[69,-23,1],[69,-43,1],[0,-43,1],[0,-26,1]],'studio-cable',-1);
  const signal=at(p,.23,.33);
  for(let i=0;i<8;i++)if(i/8<signal)add(box(8+i*7,-44,1,10+i*7,-42,1.8),'studio-mint',0);
  renderer.render(cam,out);
 };
}
