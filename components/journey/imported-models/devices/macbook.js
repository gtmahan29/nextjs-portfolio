import * as THREE from "three";

// Converted from the supplied procedural model; renderer and demo controls are omitted.
export function createImportedMacbook(loadDisplay=true) {
const scene = new THREE.Group();
const aluminum=new THREE.MeshStandardMaterial({color:0xc5c7cb,metalness:1,roughness:.32,envMapIntensity:1});const black=new THREE.MeshPhysicalMaterial({specularIntensity:.12,envMapIntensity:.12,color:0x101114,metalness:0,roughness:.48});const trim=new THREE.MeshStandardMaterial({color:0xaeb0b4,metalness:1,roughness:.22});
function shape(w,h,r){let s=new THREE.Shape(),x=-w/2,y=-h/2;r=Math.min(r,w/2,h/2);s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s}
function rounded(w,h,d,r,b=.006){let g=new THREE.ExtrudeGeometry(shape(w-2*b,h-2*b,Math.max(.001,r-b)),{depth:Math.max(.001,d-2*b),bevelEnabled:b>0,bevelSegments:3,steps:1,bevelSize:b,bevelThickness:b,curveSegments:w<.5&&h<.3?6:10});g.translate(0,0,-d/2+b);return g}
const parts=[];
function mesh(id,g,m,parent,pos=[0,0,0],rot=[0,0,0],detail=false){let o=new THREE.Mesh(g,m);o.name=id;o.userData.componentId=id;o.userData.explodeWithParent=detail;o.castShadow=true;o.receiveShadow=true;o.position.fromArray(pos);o.rotation.fromArray(rot);parent.add(o);if(!detail)parts.push(o);return o}
function group(id,parent){let g=new THREE.Group();g.name=id;g.userData.componentId=id;parent.add(g);return g}
function createLaptopModel(){
const root=new THREE.Group();root.name='root';scene.add(root);
const base=group('base',root);base.position.y=.09;
mesh('base-shell',rounded(3.4,2.25,.095,.09,.016),aluminum,base,[0,0,0],[-Math.PI/2,0,0],true);
const lid=group('lid',root);lid.position.set(0,.155,-1.08);lid.rotation.x=(90-102)*Math.PI/180;
mesh('lid-shell',rounded(3.4,2.11,.06,.085,.012),aluminum,lid,[0,1.055,0],[0,0,0],true);
const hinge=mesh('hinge',new THREE.CylinderGeometry(.027,.027,2.95,32),black,root,[0,.15,-1.06],[0,0,Math.PI/2]);
root.userData.sculptRuntime={pivots:{lid},sockets:{'rear-hinge':[0,.155,-1.08]},colliders:[{id:'base',dimensions:[3.4,.095,2.25]}],destructionGroups:['base','lid','hinge'],parts};
return {root,base,lid,hinge};}
const model=createLaptopModel();
// Form: physically open front finger-lift, contained above the lower case lip.
const shell=model.base.children[0];
const fp=shape(3.368,2.218,.074);fp.curves=[];
let w=3.368,h=2.218,r=.074,x=-w/2,y=-h/2;fp.moveTo(x+r,y);fp.lineTo(-.265,y);fp.quadraticCurveTo(-.255,y+.065,-.225,y+.065);fp.lineTo(.225,y+.065);fp.quadraticCurveTo(.255,y+.065,.265,y);fp.lineTo(w/2-r,y);fp.quadraticCurveTo(w/2,y,w/2,y+r);fp.lineTo(w/2,h/2-r);fp.quadraticCurveTo(w/2,h/2,w/2-r,h/2);fp.lineTo(-w/2+r,h/2);fp.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);fp.lineTo(-w/2,-h/2+r);fp.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
const sg=new THREE.ExtrudeGeometry(fp,{depth:.038,bevelEnabled:true,bevelThickness:.014,bevelSize:.016,bevelSegments:3,curveSegments:10});sg.translate(0,0,-.019);shell.geometry.dispose();shell.geometry=sg;shell.position.y=.013;
mesh('lower-case',rounded(3.4,2.25,.027,.09,.006),trim,model.base,[0,-.032,0],[-Math.PI/2,0,0],true);
// PASS_DETAILS
const gasket=mesh('gasket',rounded(3.365,2.078,.008,.07,.001),black,model.lid,[0,1.057,.033]);
const bezel=mesh('bezel',rounded(3.33,2.05,.012,.062,.001),black,model.lid,[0,1.057,.042]);
const screen=mesh('screen',new THREE.ShapeGeometry(shape(3.25,1.94,.027)),new THREE.MeshBasicMaterial({color:0x101621}),model.lid,[0,1.083,.05]);
const keyboard=group('keyboard',model.base);keyboard.position.set(0,.049,-.48);
mesh('keyboard-bed',rounded(2.95,.91,.004,.037,.001),black,keyboard,[0,0,0],[-Math.PI/2,0,0],true);
const keycaps=group('keycaps',keyboard);keycaps.userData.explodeWithParent=true;
const keyRows=[
 ['esc','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','◉'],
 ['`','1','2','3','4','5','6','7','8','9','0','−','=','delete'],
 ['tab','Q','W','E','R','T','Y','U','I','O','P','[',']','\\'],
 ['caps lock','A','S','D','F','G','H','J','K','L',';','\'','return'],
 ['shift','Z','X','C','V','B','N','M',',','.','/','shift'],
 ['fn','control','option','command',' ','command','option','◀','▼','▶']];
const keySpecs=[];const keymat=new THREE.MeshPhysicalMaterial({specularIntensity:.16,envMapIntensity:.18,color:0x18191b,roughness:.44,metalness:0});
keyRows.forEach((row,ri)=>{let weights=row.map((t,i)=>ri===5?(i===4?5.5:i===3||i===5?1.3:1):ri===4?(i===0?2.35:i===row.length-1?2.6:1):ri===3?(i===0?1.8:i===row.length-1?2.4:1):ri===2?(i===0?1.45:1):ri===1?(i===row.length-1?1.7:1):1);let gap=.014,width=2.85,total=weights.reduce((a,b)=>a+b,0),unit=(width-gap*(row.length-1))/total,x=-width/2,h=ri===0?.078:.124,z=-.398+ri*.148;
row.forEach((text,i)=>{let w=weights[i]*unit,cx=x+w/2;keySpecs.push({text,x:cx,z,w,h,row:ri});x+=w+gap;})});
const batches=new Map();for(const k of keySpecs){let id=k.w.toFixed(6)+'-'+k.h;if(!batches.has(id))batches.set(id,[]);batches.get(id).push(k);}let batchIndex=0;for(const ks of batches.values()){let k=ks[0],inst=new THREE.InstancedMesh(rounded(k.w,k.h,.012,.015,.0025),keymat,ks.length);inst.name='key-batch-'+batchIndex++;inst.userData.explodeWithParent=true;inst.castShadow=inst.receiveShadow=true;let dummy=new THREE.Object3D();ks.forEach((a,i)=>{dummy.position.set(a.x,.009,a.z);dummy.rotation.x=-Math.PI/2;dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);});inst.instanceMatrix.needsUpdate=true;keycaps.add(inst);}
const trackpad=group('trackpad',model.base);trackpad.position.set(0,.050,.60);
mesh('trackpad-seam',rounded(1.59,.93,.002,.028,.0005),new THREE.MeshStandardMaterial({color:0x777b80,metalness:1,roughness:.55}),trackpad,[0,0,0],[-Math.PI/2,0,0],true);
mesh('trackpad-panel',rounded(1.579,.919,.002,.024,.0005),aluminum,trackpad,[0,.001,0],[-Math.PI/2,0,0],true);
const speakers=[];for(const [id,x]of [['speaker-l',1.56],['speaker-r',-1.56]]){let g=group(id,model.base);g.position.set(x,.048,-.48);mesh(id+'-panel',new THREE.PlaneGeometry(.18,.91),aluminum,g,[0,0,0],[-Math.PI/2,0,0],true);speakers.push(g)}
const webcam=group('camera',model.lid);webcam.position.set(0,2.083,.053);mesh('camera-ring',new THREE.CircleGeometry(.011,24),new THREE.MeshBasicMaterial({color:0x080a0c}),webcam,[0,0,0],[0,0,0],true);mesh('camera-lens',new THREE.SphereGeometry(.006,16,8),new THREE.MeshPhysicalMaterial({color:0x213444,roughness:.08,metalness:.15,clearcoat:1}),webcam,[0,0,.001],[0,0,0],true);
// Material pass: independent seeded roughness/normal fields, clean satin conductor.
function dataMap(kind){const n=256,a=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){let i=(y*n+x)*4,v=((Math.imul(x+17,374761393)^Math.imul(y+29,668265263))>>>0)%256;let k=kind==='roughness'?252+v*.008:128+(v-128)*.015;a[i]=k;a[i+1]=k;a[i+2]=kind==='normal'?255:k;a[i+3]=255;}let t=new THREE.DataTexture(a,n,n);t.needsUpdate=true;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
aluminum.roughness=.35;aluminum.roughnessMap=dataMap('roughness');aluminum.normalMap=dataMap('normal');aluminum.normalScale=new THREE.Vector2(.005,.005);aluminum.needsUpdate=true;
black.color.setHex(0x010102);black.roughness=.55;keymat.color.setHex(0x020203);keymat.roughness=.52;keymat.roughnessMap=dataMap('roughness');keymat.needsUpdate=true;
const display=loadDisplay?new THREE.TextureLoader().load('/models/showcase-devices/macbook-display.png'):null;if(display){display.colorSpace=THREE.SRGBColorSpace;display.anisotropy=4;}
const suv=screen.geometry.getAttribute('uv'),sp=screen.geometry.getAttribute('position');for(let i=0;i<suv.count;i++)suv.setXY(i,sp.getX(i)/3.25+.5,sp.getY(i)/1.94+.5);suv.needsUpdate=true;screen.material=new THREE.MeshBasicMaterial({map:display,toneMapped:false});
const legendCanvas=document.createElement('canvas');legendCanvas.width=1200;legendCanvas.height=400;const lc=legendCanvas.getContext('2d');lc.fillStyle='#bdc1c6';lc.textAlign='center';lc.textBaseline='middle';
for(const k of keySpecs){let cx=(k.x/2.95+.5)*1200,cy=(k.z/.91+.5)*400;lc.font=(k.text.length>2?'10':'15')+'px Arial';lc.fillText(k.text,cx,cy);if(k.row===0&&k.text!=='esc'){lc.font='9px Arial';lc.fillText(['','☀','☀','▤','⌕','◉','◀','▶','▶','♪','−','+','◼',''][keySpecs.filter(a=>a.row===0).indexOf(k)]||'',cx,cy-25);}}
const legendTexture=new THREE.CanvasTexture(legendCanvas);legendTexture.colorSpace=THREE.SRGBColorSpace;legendTexture.anisotropy=8;
mesh('key-legends',new THREE.PlaneGeometry(2.95,.91),new THREE.MeshBasicMaterial({map:legendTexture,transparent:true,depthWrite:false,toneMapped:false}),keyboard,[0,.016,0],[-Math.PI/2,0,0],true);
// MATERIAL_END
aluminum.normalScale.set(.0005,.0005);
for(const speaker of speakers){const c=document.createElement('canvas');c.width=512;c.height=2048;const ctx=c.getContext('2d');ctx.fillStyle='rgba(45,48,52,.72)';for(let y=0;y<120;y++)for(let x=0;x<24;x++){ctx.beginPath();ctx.ellipse((x+.5)*512/24,(y+.5)*2048/120,3.5,2.8,0,0,Math.PI*2);ctx.fill();}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;mesh(speaker.name==='speaker-l'?'speaker-dots-l':'speaker-dots-r',new THREE.PlaneGeometry(.18,.90),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,toneMapped:false}),speaker,[0,.0015,0],[-Math.PI/2,0,0],true);}
// SURFACE_END
// Keep the closing display face above the keycaps. Hinge leaves bridge the panel offset.
for(const o of model.lid.children)o.position.z-=.06;
for(const x of [-1.2,1.2])mesh('hinge-leaf-'+x,new THREE.BoxGeometry(.12,.04,.09),black,model.lid,[x,.02,-.04],[0,0,0],true);
// Match the closed lid footprint to the 2.25-deep chassis, around its rear edge.
model.lid.position.z=-1.125;
for(const part of model.lid.children){part.position.y*=2.25/2.11;part.scale.y*=2.25/2.11;}
const hingeSocket=new THREE.Object3D();hingeSocket.name='rear-hinge-socket';hingeSocket.position.set(0,.155,-1.125);model.root.add(hingeSocket);
model.root.userData.sculptRuntime.sockets={'rear-hinge':hingeSocket};model.root.userData.sculptRuntime.colliders.push({id:'lid',type:'box',dimensions:[3.4,2.25,.06],pivot:'lid'},{id:'hinge',type:'cylinder',radius:.027,length:2.95});

return { group: model.root, screen };
}
