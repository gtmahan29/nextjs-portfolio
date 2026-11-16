import { camera, corners, facing, fit, footprint, prism, project, type Ring } from "./iso";
import { bag, draw, el, solid, type Mount, type Solid } from "./stage";

export type KeyboardFrame = { angle: number; time: number; demo?: number; presses?: {code:string;amount:number}[]; reduced: boolean };
export const TYPE_PHRASE = "MAKE IT REAL.";
const LETTERS="MAKEITREAL.";
export const TYPE_TIMES = [.22,.42,.59,.79,1.24,1.43,1.95,2.14,2.35,2.62,2.87];

/** Cinematic clock for Keys. Geometry, spacing and key count match the installed figure. */
export const mountKeyboardPerformance: Mount<object> = ({stage,svg}) => {
 const b=bag();
 // These are the exact dimensions and footprints of ui/keys.tsx.
 const ROWS=["1234567890","QWERTYUIOP","ASDFGHJKL;","ZXCVBNM,./"];
 const COLS=10,PITCH=13,CAP=10.6,UP=4.2,PAD=7;
 const EXT_X=COLS*PITCH+PITCH/2,EXT_Y=ROWS.length*PITCH;
 const g=el("g",null,svg);
 const base=solid(g,"keyboard-chassis");
 const [br,bb]=footprint(-PAD,-PAD,EXT_X+PAD,EXT_Y+PAD,8,2.4);
 type Key={char:string;ring:Ring;bevel:Ring;shape:Solid};
 const keys:Key[]=[];
 // Preserve the original diagonal paint order as well as the staggered rows.
 for(let s=0;s<COLS+ROWS.length;s++)for(let j=0;j<ROWS.length;j++){
  const i=s-j;if(i<0||i>=COLS)continue;
  const x=i*PITCH+j*(PITCH/6)+(PITCH-CAP)/2,y=j*PITCH+(PITCH-CAP)/2;
  const [ring,bevel]=footprint(x,y,x+CAP,y+CAP,2.2,1.6);
  const shape=solid(g,"keyboard-cap");shape.g.dataset.key=ROWS[j][i];
  keys.push({char:ROWS[j][i],ring,bevel,shape});
 }
 let previous="";
 const render=({angle,time,demo=-1,reduced}:KeyboardFrame)=>{
  const c=camera(45*(1-angle)-3*angle,.5,2.05);
  fit(c,corners(-PAD,-PAD,EXT_X+PAD,EXT_Y+PAD,-5,UP),200,160);
  const P=project(c),front=facing(c);
  draw(base,prism(P,front,br,bb,-5,0));
  let count=0;TYPE_TIMES.forEach(t=>{if(time>=t+.055)count++});
  // Word gaps are layout spacing; every emitted letter has a matching physical key.
  const raw=LETTERS.slice(0,count);
  const text=raw.slice(0,4)+(raw.length>4?' '+raw.slice(4,6):'')+(raw.length>6?' '+raw.slice(6):'');
  if(text!==previous){previous=text;stage.dispatchEvent(new CustomEvent("iso-typed",{bubbles:true,detail:text}));}
  keys.forEach(key=>{
   let depression=0,glow=0;
   TYPE_TIMES.forEach((at,i)=>{
    if(LETTERS[i]!==key.char)return;
    const t=time-at;
    if(t>=0&&t<.38){
     const down=t<.055?1-Math.pow(1-t/.055,3):t<.095?1:Math.exp(-(t-.095)*23)*(1+(t-.095)*23);
     depression=Math.max(depression,down);glow=Math.max(glow,Math.exp(-Math.max(0,t-.055)*10)*Math.min(1,t/.04));
    }
   });
   if(time<0&&demo>=0){
    const chars="BUILD",index=Math.floor(demo/.32),t=demo-index*.32;
    if(index<chars.length&&chars[index]===key.char){depression=Math.sin(Math.min(1,t/.24)*Math.PI);glow=depression*.8;}
   }
   if(reduced){depression=0;glow=0}
   draw(key.shape,prism(P,front,key.ring,key.bevel,0,Math.max(.4,UP-depression*3.8)));
   key.shape.g.style.setProperty('--key-contact',glow.toFixed(3));
   key.shape.g.dataset.pressed=String(depression>.4);
  });
 };
 const handler=(event:Event)=>render((event as CustomEvent<KeyboardFrame>).detail);
 stage.addEventListener('iso-keyboard',handler);
 b.add(()=>stage.removeEventListener('iso-keyboard',handler));
 render({angle:0,time:-1,reduced:false});
 return {set(){},destroy:b.dispose};
};
