import * as THREE from "three";
import layout from "./cloud-layout.json";
// Deterministic, high-resolution surface graphics inspired by the reference layout.
// The user requested redesigned content rather than enlarged photographic crops.
function createDeviceSurface(kind, maxAnisotropy=8) {
  const mobile=kind==='phone';
  const canvas=document.createElement('canvas');
  canvas.width=mobile?512:1024;canvas.height=mobile?1024:512;
  const ctx=canvas.getContext('2d'),W=mobile?512:1024,H=mobile?1024:(kind==='laptop'?682.667:512);
  ctx.scale(1,kind==='laptop'?.75:1);
  const colors={paper:'#f8f6f1',white:'#fffdfa',ink:'#464440',muted:'#969188',line:'#e9e4dc',amber:'#d89f52',pale:'#f2e4cf'};
  function rect(x,y,w,h,r,fill,stroke){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
  function label(text,x,y,size=14,color=colors.ink,weight=500){ctx.font=weight+' '+size+'px Arial, sans-serif';ctx.fillStyle=color;ctx.fillText(text,x,y);}
  function circle(x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
  function cloud(x,y,s,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x+s*.3,y,s*.23,Math.PI,Math.PI*2);ctx.arc(x+s*.52,y-s*.12,s*.30,Math.PI,Math.PI*2);ctx.arc(x+s*.76,y,s*.22,Math.PI,Math.PI*2);ctx.lineTo(x+s*.93,y+s*.21);ctx.lineTo(x+s*.07,y+s*.21);ctx.closePath();ctx.fill();}
  function landscape(x,y,w,h){
    const g=ctx.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,'#eeece6');g.addColorStop(1,'#d7d0c5');rect(x,y,w,h,12,g);
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    circle(x+w*.83,y+h*.25,h*.12,'#fff9e7');circle(x+w*.83,y+h*.25,h*.084,'#fffdf5');
    ctx.fillStyle='#c0bdb5';ctx.beginPath();ctx.moveTo(x,y+h);ctx.lineTo(x+w*.29,y+h*.25);ctx.quadraticCurveTo(x+w*.32,y+h*.19,x+w*.36,y+h*.27);ctx.lineTo(x+w*.65,y+h);ctx.fill();
    ctx.fillStyle='#aba9a2';ctx.beginPath();ctx.moveTo(x+w*.20,y+h);ctx.lineTo(x+w*.55,y+h*.45);ctx.quadraticCurveTo(x+w*.58,y+h*.40,x+w*.62,y+h*.47);ctx.lineTo(x+w*.95,y+h);ctx.fill();
    ctx.fillStyle='#ccc6bb';ctx.beginPath();ctx.moveTo(x+w*.55,y+h);ctx.lineTo(x+w*.73,y+h*.59);ctx.lineTo(x+w,y+h);ctx.fill();ctx.restore();
  }
  ctx.fillStyle=colors.paper;ctx.fillRect(0,0,W,H);
  if(mobile){
    label('9:41',30,35,16,colors.ink,600);for(let i=0;i<3;i++)rect(405+i*8,24-i*3,5,7+i*3,1,colors.ink);rect(445,19,28,13,3,null,colors.muted);rect(449,23,19,5,1,colors.ink);
    cloud(26,70,37,colors.amber);label('Workspace',76,86,22,colors.ink,600);circle(458,77,15,colors.pale);label('M',451,84,17,colors.amber,600);
    label('YOUR CLOUD',30,143,12,colors.muted,600);label('Everything, in sync.',30,178,28,colors.ink,600);label('Your projects. Ready wherever you are.',30,209,15,colors.muted);
    landscape(28,239,456,308);rect(43,257,82,24,12,'#fffaf0');label('LIVE PREVIEW',54,273,9,colors.amber,600);
    label('Studio collection',30,591,22,colors.ink,600);label('Updated just now',30,620,14,colors.muted);
    rect(28,647,456,89,14,colors.white,colors.line);circle(60,684,13,colors.pale);cloud(48,682,25,colors.amber);label('All files are up to date',86,681,16,colors.ink,600);label('Securely saved to your workspace',86,705,13,colors.muted);
    rect(28,767,456,68,13,colors.amber);label('Open workspace',154,808,19,'#fffdfa',600);label('→',446,809,23,'#fffdfa');
    rect(28,861,456,1,0,colors.line);for(const [i,name]of ['Home','Projects','Activity'].entries()){circle(95+i*160,907,7,i===0?colors.amber:colors.muted);label(name,76+i*160,938,12,i===0?colors.amber:colors.muted);}
    rect(177,988,158,5,3,'#7b7871');
  }else{
    // Browser chrome, then a consistent desktop workspace shell.
    rect(0,0,W,34,0,'#eeeae2');for(let i=0;i<3;i++)circle(18+i*15,17,4,i===0?'#d9a568':'#d1c4b3');rect(270,9,470,17,6,'#f8f6f1');label('studio.cloud / workspace',422,21,9,colors.muted);
    rect(0,34,195,H-34,0,'#f2efe8');cloud(20,66,29,colors.amber);label('CLOUD STUDIO',59,73,13,colors.ink,600);rect(19,99,156,32,7,colors.pale);label('Your workspace',30,120,11,colors.ink,600);
    const items=['Overview','Projects','Library','Activity','Settings'];for(let i=0;i<items.length;i++){const yy=164+i*42;rect(19,yy-20,157,31,6,i===0?'#fffaf1':null);ctx.strokeStyle=i===0?colors.amber:colors.muted;ctx.lineWidth=1.6;ctx.strokeRect(30,yy-10,10,10);label(items[i],52,yy,12,i===0?colors.ink:colors.muted,i===0?600:500);}
    rect(19,H-74,156,45,8,colors.white,colors.line);circle(39,H-52,4,'#91a279');label('All changes saved',53,H-48,10,colors.muted);
    label('Workspace overview',224,79,23,colors.ink,600);label('Create, manage and publish from one place.',225,103,12,colors.muted);
    rect(858,56,134,34,8,colors.amber);label('+ New project',877,78,11,'#fffdfa',600);
    const heroHeight=H-301;
    landscape(224,126,596,heroHeight);rect(239,141,76,23,11,'#fffaf0');label('PREVIEW',255,157,10,colors.amber,600);
    rect(839,126,153,heroHeight,12,colors.white,colors.line);label('IN SYNC',857,154,10,colors.muted,600);circle(867,185,10,colors.pale);cloud(857,184,20,colors.amber);label('Ready to share',855,217,12,colors.ink,600);label('24 files',855,242,11,colors.muted);label('3 collections',855,262,11,colors.muted);rect(854,H-218,122,27,6,colors.pale);label('View library  →',868,H-200,10,colors.amber,600);
    const cw=244,cy=H-156;for(const [i,title]of ['Design system','Studio collection','Website preview'].entries()){const x=224+i*(cw+18);rect(x,cy,cw,129,12,colors.white,colors.line);rect(x+16,cy+16,31,28,7,colors.pale);ctx.strokeStyle=colors.amber;ctx.lineWidth=1.7;ctx.strokeRect(x+24,cy+24,14,12);label(title,x+17,cy+70,13,colors.ink,600);label(['12 components','24 assets','Ready to publish'][i],x+17,cy+93,11,colors.muted);label('→',x+cw-29,cy+74,18,colors.amber);rect(x+17,cy+111,70,3,2,colors.pale);}
  }
  // A restrained static reflection, without another coplanar 3D layer.
  const sheen=ctx.createLinearGradient(0,0,W,H);sheen.addColorStop(0,'rgba(255,255,255,.035)');sheen.addColorStop(.55,'rgba(255,255,255,0)');sheen.addColorStop(1,'rgba(255,255,255,.015)');ctx.fillStyle=sheen;ctx.fillRect(0,0,W,H);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=true;t.anisotropy=Math.min(16,maxAnisotropy);return t;
}

// Layered lanceolate ficus foliage with curved blades and attached petioles.
function createNaturalFoliage(plant,add,line,physical) {
  const stem=physical(0x4a5630,0,.72),vein=physical(0x718345,0,.7);
  const material=new THREE.MeshPhysicalMaterial({color:0xffffff,vertexColors:true,side:THREE.DoubleSide,roughness:.46,metalness:0,clearcoat:.16,clearcoatRoughness:.4});
  const shoots=[[-.16,2.10,-.06],[-.25,1.94,.17],[.12,2.02,-.19],[.27,1.77,.05],[-.12,1.61,.29],[.18,1.53,.26]];
  const root=new THREE.Vector3(.02,.79,.01),up=new THREE.Vector3(0,1,0);
  shoots.forEach((tip,index)=>{
    const curve=new THREE.CatmullRomCurve3([root.clone(),new THREE.Vector3(tip[0]*.35,1.12,tip[2]*.35),new THREE.Vector3(...tip)],false,'centripetal');
    add(plant,new THREE.TubeGeometry(curve,24,.009,7,false),stem,'plant-shoot-'+index);
    for(let j=0;j<3;j++){
      const i=index*3+j,t=j===2?1:.38+j*.23,anchor=curve.getPoint(t),az=Math.atan2(tip[2],tip[0])+(j%2?.67:-.67);
      const lift=j===2?.88:.48,dir=new THREE.Vector3(Math.cos(az)*.68,lift,Math.sin(az)*.68).normalize();
      const base=anchor.clone().addScaledVector(dir,.075);
      line(plant,[anchor.toArray(),base.toArray()],.005,stem,'plant-petiole-'+i);
      const length=.62+(index%3)*.06+(j===2?.04:0),halfWidth=.14+(index%2)*.018,rows=24,cols=8,verts=[],colors=[],indices=[];
      function surface(t,u){const w=halfWidth*Math.pow(Math.max(0,Math.sin(Math.PI*t)),.78)*(1-.15*t);return [u*w,t*length,.032*Math.sin(Math.PI*t)*(1-u*u)+.085*t*t+.009*Math.sin(3*Math.PI*t)*u*u];}
      for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
        const t=row/rows,u=col/cols*2-1;verts.push(...surface(t,u));
        const c=new THREE.Color().setRGB(.085+.035*(1-u*u),.155+.04*(1-u*u)+.012*Math.sin(t*8+i),.031+.016*(1-u*u));colors.push(c.r,c.g,c.b);
      }
      for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const a=row*(cols+1)+col,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
      const leaf=add(plant,g,material,'plant-leaf-'+i,base.toArray());leaf.receiveShadow=false;leaf.quaternion.setFromUnitVectors(up,dir);leaf.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(up,(index%2?.18:-.18)));
      const midrib=[];for(let k=1;k<17;k++){const p=surface(k/18,0);p[2]+=.002;midrib.push(p);}const rib=line(leaf,midrib,.0014,vein,'plant-midrib-'+i);rib.castShadow=false;rib.receiveShadow=false;
    }
  });
}

/* Live procedural factory, JavaScript-compatible TypeScript. Measured structure
 * is persisted in src/layout.json and object-sculpt-spec.json. Hidden sides inferred. */
function createObjectModel(layout, options={}) {
 const root=new THREE.Group();root.name='root';root.userData.pendingTextures=0;const groups={},meshes={},sockets={};
 for(const n of ['Platforms','Server','Cloud','Backdrop','Conduits','Laptop','Plant','Phone','Monitor']){const g=new THREE.Group();g.name=n.toLowerCase();root.add(g);groups['group'+n]=g;}
 const {groupPlatforms,groupServer,groupCloud,groupBackdrop,groupConduits,groupLaptop,groupPlant,groupPhone,groupMonitor}=groups;
 const physical=(color,metalness=.05,roughness=.28)=>{const m=new THREE.MeshPhysicalMaterial({color,metalness,roughness,clearcoat:.3});return m;};
 const porcelain=physical(0xeee6dc),silver=physical(0xbeb8af,.65,.26),aluminum=physical(0xc8c8c5,.78,.23),dark=physical(0x222622,.25,.32),gold=physical(0xd49c4e,.7,.25);
 const matNeonConduit=new THREE.MeshStandardMaterial({color:0xffb93e,emissive:0xff8208,emissiveIntensity:1.8,roughness:.2});const matCloudHalo=matNeonConduit.clone();
 const glass=new THREE.MeshBasicMaterial({color:0xcfbeaa,transparent:true,opacity:.26,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}),edgeGlass=new THREE.MeshPhysicalMaterial({color:0xf4e6d2,roughness:.16,metalness:.15,transparent:true,opacity:.55});
 
 function add(parent,g,m,name,pos=[0,0,0]){const mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.componentId=parent.name;mesh.userData.partId=name;parent.add(mesh);meshes[name]=mesh;return mesh;}
 function outline(w,h,r){const s=new THREE.Shape(),x=-w/2,y=-h/2;r=Math.min(r,w/2,h/2);s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
 function plateXY(w,h,d,r=.1,b=.018){const g=new THREE.ExtrudeGeometry(outline(w,h,r),{depth:d-2*b,bevelEnabled:b>0,bevelSize:b,bevelThickness:b,bevelSegments:3,curveSegments:12,steps:1});g.translate(0,0,-(d-2*b)/2);return g;}
 function slab(w,h,d,r=.15){const g=plateXY(w,d,h,r,Math.min(.055,h*.20));g.rotateX(-Math.PI/2);return g;}
 function line(parent,pts,r,mat,name){const c=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)),false,'centripetal');return add(parent,new THREE.TubeGeometry(c,Math.max(8,pts.length*4),r,8,false),mat,name);}
 function texture(name){root.userData.pendingTextures=(root.userData.pendingTextures||0)+1;const t=new THREE.TextureLoader().load('textures/'+name+'-albedo.png',()=>{root.userData.pendingTextures--;window.dispatchEvent(new Event('model-texture-ready'));},undefined,e=>{root.userData.textureErrors=(root.userData.textureErrors||[]).concat(name);root.userData.pendingTextures--;});t.colorSpace=THREE.SRGBColorSpace;return t;}
 function face(parent,w,h,r,name,pos,kind){
  const g=new THREE.ShapeGeometry(outline(w,h,r),24),uv=g.attributes.uv,p=g.attributes.position;
  for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+w/2)/w,(p.getY(i)+h/2)/h);
  const map=createDeviceSurface(kind,options.maxAnisotropy||8);
  const m=new THREE.MeshBasicMaterial({map,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
  const screen=add(parent,g,m,name,pos);screen.castShadow=false;screen.receiveShadow=false;
  screen.userData.surface={kind,width:map.image.width,height:map.image.height,source:'procedural-canvas',stable:true};return screen;
 }
 const platforms=layout.platforms;
 for(const [id,p] of Object.entries(platforms)){add(groupPlatforms,slab(p.width,p.height,p.depth,p.radius),porcelain,id+'-platform',[p.center[0],p.height/2,p.center[1]]);sockets[id]={left:[p.center[0]-p.width/2,.25,p.center[1]],right:[p.center[0]+p.width/2,.25,p.center[1]],front:[p.center[0],.25,p.center[1]+p.depth/2],rear:[p.center[0],.25,p.center[1]-p.depth/2]};}
 for(let i=0;i<3;i++){const bottom=.65+i*(2/3),h=2/3-.027;add(groupServer,slab(2,h,2,.14),silver,'server-tier-'+i,[0,bottom+h/2,0]);add(groupServer,plateXY(.88,.105,.022,.045,.005),dark,'server-slot-'+i,[.03,bottom+.26,1.01]);add(groupServer,plateXY(.82,.047,.014,.022,.003),gold,'server-slot-inset-'+i,[.03,bottom+.26,1.029]);for(let j=0;j<2;j++){add(groupServer,new THREE.CylinderGeometry(.059,.059,.02,24),gold,'server-led-ring-'+i+'-'+j,[-.77+j*.20,bottom+.29,1.014]).rotation.x=Math.PI/2;add(groupServer,new THREE.SphereGeometry(.045,12,8),matNeonConduit,'server-led-'+i+'-'+j,[-.77+j*.20,bottom+.29,1.029]);}}
 // Cloud is a centered solid, with an immediate canvas surface (no asynchronous image dependency).
 const cloud=new THREE.Group();cloud.name='cloud-body';cloud.position.set(...layout.cloud.center);groupCloud.add(cloud);
 const shape=new THREE.Shape();shape.moveTo(...layout.cloud.bezierStart);
 for(const segment of layout.cloud.bezierSegments)shape.bezierCurveTo(...segment.flat());
 const frontZ=layout.cloud.depth/2;
 const shell=new THREE.ExtrudeGeometry(shape,{depth:layout.cloud.depth,bevelEnabled:true,bevelSize:.045,bevelThickness:.045,bevelSegments:5,curveSegments:48});
 shell.translate(0,0,-frontZ);add(cloud,shell,silver,'cloud-shell');
 const cv=document.createElement('canvas');cv.width=1024;cv.height=512;
 const ctx=cv.getContext('2d'),grad=ctx.createLinearGradient(0,0,0,512);
 grad.addColorStop(0,'#e1d1bd');grad.addColorStop(.40,'#cbb18f');grad.addColorStop(.75,'#c9a778');grad.addColorStop(1,'#ffe3a4');
 ctx.fillStyle=grad;ctx.fillRect(0,0,1024,512);
 const glow=ctx.createRadialGradient(512,490,20,512,490,440);glow.addColorStop(0,'rgba(255,239,179,.55)');glow.addColorStop(1,'rgba(255,239,179,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,1024,512);
 const ct=new THREE.CanvasTexture(cv);ct.colorSpace=THREE.SRGBColorSpace;ct.anisotropy=Math.min(16,options.maxAnisotropy||1);
 const fg=new THREE.ShapeGeometry(shape,48),bb=new THREE.Box3().setFromBufferAttribute(fg.attributes.position),uv=fg.attributes.uv;
 for(let i=0;i<uv.count;i++)uv.setXY(i,(fg.attributes.position.getX(i)-bb.min.x)/(bb.max.x-bb.min.x),(fg.attributes.position.getY(i)-bb.min.y)/(bb.max.y-bb.min.y));uv.needsUpdate=true;
 const front=add(cloud,fg,new THREE.MeshBasicMaterial({map:ct,toneMapped:false,side:THREE.FrontSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}),'cloud-front',[0,0,frontZ+.070]);
 front.receiveShadow=false;front.castShadow=false;
 line(cloud,shape.getPoints(240).map(p=>[p.x,p.y,frontZ+.083]),.022,matCloudHalo,'cloud-luminous-rim');
 for(let i=0;i<3;i++)line(groupCloud,[[layout.cloud.supportXs[i],layout.cloud.supportBottom,0],[layout.cloud.supportXs[i],layout.cloud.supportTop,0]],.032,matNeonConduit,'cloud-support-'+i);
 const cloudPointLight=new THREE.PointLight(0xffb654,.7,5,2);cloudPointLight.position.set(0,3.8,.5);groupCloud.add(cloudPointLight);
 const b=layout.backdrop,wall=new THREE.Group();wall.name='backdrop-shell';wall.position.set(...b.center);wall.rotation.y=b.yaw*Math.PI/180;groupBackdrop.add(wall);
 function bend(g,offset=0){const p=g.attributes.position;for(let i=0;i<p.count;i++){const angle=p.getX(i)/b.radius,z=p.getZ(i)+offset;p.setXYZ(i,(b.radius-z)*Math.sin(angle),p.getY(i),b.radius-(b.radius-z)*Math.cos(angle));}p.needsUpdate=true;g.computeVertexNormals();return g;}
 // Grid caps bend continuously. An extruded outline provides the real side thickness.
 const dense=new THREE.Shape(outline(b.width,b.height,b.cornerRadius).getSpacedPoints(400));const wg=new THREE.ExtrudeGeometry(dense,{depth:b.thickness,bevelEnabled:false});wg.translate(0,0,-b.thickness/2);const sideGlass=glass.clone();sideGlass.opacity=.30;add(wall,bend(wg),[new THREE.MeshBasicMaterial({visible:false}),sideGlass],'backdrop-thickness');
 for(let sign of [-1,1]){const g=new THREE.PlaneGeometry(b.width,b.height,100,24),p=g.attributes.position;for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),ax=Math.abs(x),ay=Math.abs(y),r=b.cornerRadius;if(ax>b.width/2-r&&ay>b.height/2-r){const dx=ax-(b.width/2-r),dy=ay-(b.height/2-r),len=Math.hypot(dx,dy);if(len>r){x=Math.sign(x)*(b.width/2-r+dx*r/len);y=Math.sign(y)*(b.height/2-r+dy*r/len);}}p.setXYZ(i,x,y,sign*b.thickness/2);}const capmat=glass.clone();capmat.opacity=sign>0?.56:.10;add(wall,bend(g),capmat,'backdrop-curved-cap-'+sign);}
 line(wall,outline(b.width,b.height,b.cornerRadius).getSpacedPoints(400).map(p=>{const a=p.x/b.radius,z=.043;return [(b.radius-z)*Math.sin(a),p.y,b.radius-(b.radius-z)*Math.cos(a)];}),.018,edgeGlass,'backdrop-border');
 function chartTexture(name){
  const c=document.createElement('canvas');c.width=900;c.height=550;const x=c.getContext('2d');
  x.fillStyle='#f8f3e9';x.fillRect(0,0,900,550);x.strokeStyle='#ffffff';x.lineWidth=5;x.strokeRect(3,3,894,544);
  x.fillStyle='#eac28c';for(let i=0;i<3;i++){x.beginPath();x.arc(35+i*20,25,5,0,Math.PI*2);x.fill();}
  if(name==='left'){
   x.fillStyle='#fcf7ee';x.fillRect(35,60,440,440);x.fillStyle='#dca454';
   for(let i=0;i<4;i++){x.fillRect(75+i*92,400-i*55,52,90+i*55);}
   x.lineWidth=48;x.strokeStyle='#db9c50';x.beginPath();x.arc(674,210,103,-Math.PI/2,Math.PI*1.5);x.stroke();
   x.strokeStyle='#ece4d9';x.beginPath();x.arc(674,210,103,-Math.PI/2,Math.PI*.12);x.stroke();
   x.fillStyle='#ccc2b6';x.fillRect(525,390,295,20);x.fillRect(525,435,220,19);
  }else{
   x.fillStyle='#dda657';x.fillRect(48,63,280,24);x.fillRect(48,447,180,46);
   for(let i=0;i<5;i++){x.fillStyle='#d9b990';x.beginPath();x.arc(58,132+i*48,9,0,Math.PI*2);x.fill();x.fillStyle='#c9beb0';x.fillRect(86,123+i*48,260-i*30,17);}
   const g=x.createLinearGradient(0,195,0,420);g.addColorStop(0,'#dfa85d');g.addColorStop(1,'#f3eadc');x.fillStyle=g;
   x.beginPath();x.moveTo(420,350);x.bezierCurveTo(475,280,475,410,530,322);x.bezierCurveTo(592,226,610,378,670,316);x.bezierCurveTo(730,225,756,194,800,221);x.lineTo(800,425);x.lineTo(420,425);x.closePath();x.fill();x.strokeStyle='#d99b4d';x.lineWidth=4;x.stroke();
  }const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
 }
 for(const [name,arcCenter] of [['left',-3.85],['right',4.05]]){const g=new THREE.PlaneGeometry(3.7,2.05,50,24),p=g.attributes.position;for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i)+arcCenter,p.getY(i)+.23,.10);const card=add(wall,bend(g),new THREE.MeshBasicMaterial({map:chartTexture(name),transparent:true,opacity:.86,side:THREE.DoubleSide,toneMapped:false,depthWrite:false}),'backdrop-chart-'+name);card.castShadow=false;}
 const lp=platforms.laptop,laptop=new THREE.Group();laptop.name='laptop-body';laptop.position.set(lp.center[0],lp.height+.035,lp.center[1]+.35);groupLaptop.add(laptop);add(laptop,slab(2.6,.075,1.9,.10),aluminum,'laptop-deck');add(laptop,slab(2.35,.013,.94,.025),dark,'keyboard-bed',[0,.046,-.13]);
 for(let row=0;row<5;row++)for(let col=0;col<14;col++)add(laptop,slab(.145,.012,.135,.014),dark,'key-'+row+'-'+col,[-1.08+col*.166,.06,-.51+row*.177]);add(laptop,slab(.84,.008,.42,.035),physical(0xe2e0dc,.5,.3),'trackpad',[0,.045,.59]);
 const lid=new THREE.Group();lid.name='laptop-lid';lid.position.set(0,.038,-.90);lid.rotation.x=-.26;laptop.add(lid);add(lid,plateXY(2.6,1.82,.06,.085),aluminum,'laptop-lid-shell',[0,.91,0]);add(lid,plateXY(2.55,1.77,.022,.065,.007),dark,'laptop-bezel',[0,.91,.04]);face(lid,2.43,1.62,.045,'laptop-screen',[0,.91,.074],'laptop');
 const mp=platforms.monitor,monitor=new THREE.Group();monitor.name='monitor-body';monitor.position.set(mp.center[0]+.1,mp.height,mp.center[1]-.1);groupMonitor.add(monitor);add(monitor,slab(2,.07,1.1,.08),aluminum,'monitor-foot',[0,.035,.10]);add(monitor,new THREE.BoxGeometry(.66,.86,.16),aluminum,'monitor-neck',[0,.49,-.09]);add(monitor,plateXY(4.75,2.45,.14,.085),aluminum,'monitor-shell',[0,2.065,-.03]);add(monitor,plateXY(4.69,2.39,.04,.07,.008),dark,'monitor-bezel',[0,2.065,.065]);face(monitor,4.54,2.22,.045,'monitor-screen',[0,2.065,.110],'monitor');
 const pp=platforms.phone,phone=new THREE.Group();phone.name='phone-body';phone.position.set(pp.center[0],pp.height,pp.center[1]);groupPhone.add(phone);add(phone,slab(1.2,.055,.72,.085),aluminum,'phone-dock',[0,.027,0]);const handset=new THREE.Group();handset.name='handset';handset.position.set(0,.08,.03);handset.rotation.x=-.08;phone.add(handset);add(handset,plateXY(1.04,1.968,.095,.13),aluminum,'phone-chassis',[0,.984,0]);add(handset,plateXY(.995,1.92,.035,.115,.006),dark,'phone-bezel',[0,.984,.06]);face(handset,.91,1.80,.085,'phone-screen',[0,.984,.105],'phone');add(handset,plateXY(.27,.039,.006,.018,0),dark,'phone-speaker',[0,1.88,.111]);
 class RailCurve extends THREE.Curve {
  constructor(points,radius,offset){super();this.offset=offset;this.segments=[];let cursor=new THREE.Vector3(...points[0]);const pushLine=end=>{const len=cursor.distanceTo(end);if(len>1e-5)this.segments.push({start:cursor.clone(),end:end.clone(),len});cursor=end.clone();};for(let i=1;i<points.length-1;i++){const p=new THREE.Vector3(...points[i]),prev=new THREE.Vector3(...points[i-1]),next=new THREE.Vector3(...points[i+1]),da=p.clone().sub(prev).normalize(),db=next.clone().sub(p).normalize(),cross=da.x*db.z-da.z*db.x;if(Math.abs(cross)<.1){pushLine(p);continue;}const r=Math.min(radius,p.distanceTo(prev)*.4,p.distanceTo(next)*.4),start=p.clone().addScaledVector(da,-r),end=p.clone().addScaledVector(db,r);pushLine(start);const sign=Math.sign(cross),center=start.clone().add(new THREE.Vector3(-da.z,0,da.x).multiplyScalar(r*sign));this.segments.push({center,r,theta:Math.atan2(start.z-center.z,start.x-center.x),sweep:sign*Math.PI/2,len:r*Math.PI/2});cursor=end;}pushLine(new THREE.Vector3(...points[points.length-1]));this.length=this.segments.reduce((n,s)=>n+s.len,0);}
  sample(t){let dist=Math.min(t,1)*this.length,s=this.segments[this.segments.length-1];for(const seg of this.segments){s=seg;if(dist<=s.len)break;dist-=s.len;}const f=Math.min(1,dist/s.len);let p,tan;if(s.center){const theta=s.theta+f*s.sweep;p=new THREE.Vector3(s.center.x+s.r*Math.cos(theta),s.center.y,s.center.z+s.r*Math.sin(theta));tan=new THREE.Vector3(-Math.sin(theta)*Math.sign(s.sweep),0,Math.cos(theta)*Math.sign(s.sweep));}else{p=s.start.clone().lerp(s.end,f);tan=s.end.clone().sub(s.start).normalize();}p.add(new THREE.Vector3(-tan.z,0,tan.x).multiplyScalar(this.offset));return {p,tan};}
  getPoint(t){return this.sample(t).p;}getTangent(t){return this.sample(t).tan;}
 }
 const routeRecords=[];function route(name,points){routeRecords.push({name,points,radius:.30,spacing:.12});for(const offset of [-.06,.06])add(groupConduits,new THREE.TubeGeometry(new RailCurve(points,.30,offset),120,.033,8,false),matNeonConduit,name+(offset<0?'-a':'-b'));for(const [i,p] of [points[0],points[points.length-1]].entries())add(groupConduits,slab(.27,.075,.20,.035),gold,name+'-socket-'+i,p);}
 const s=platforms.server,laptopRear=[lp.center[0],.25,lp.center[1]-lp.depth/2];route('server-laptop',[[lp.center[0],.25,s.depth/2],laptopRear]);const laptopRight=[lp.center[0]+lp.width/2,.25,pp.center[1]+.32],phoneLeft=[pp.center[0]-pp.width/2,.25,pp.center[1]+.32];route('laptop-phone',[laptopRight,[phoneLeft[0],.25,laptopRight[2]],phoneLeft]);const monitorLeft=[mp.center[0]-mp.width/2,.25,mp.center[1]+.45];// Two rails share an identical vertical drop curve, offset in Z.
 const start=[.8,.68,-1.8],end=[mp.center[0]-mp.width/2,.25,mp.center[1]-mp.depth/2+.20];
 routeRecords.push({name:'server-monitor',points:[start,[2.3,.68,-1.8],[3.15,.25,-1.8],end],verticalDrop:.43,spacing:.12});
 for(const offset of [-.06,.06]){const c=new THREE.CurvePath();const vec=p=>new THREE.Vector3(p[0],p[1],p[2]+offset);c.add(new THREE.LineCurve3(vec(start),vec([2.3,.68,-1.8])));c.add(new THREE.CubicBezierCurve3(vec([2.3,.68,-1.8]),vec([3.1,.68,-1.8]),vec([2.55,.25,-1.8]),vec([3.15,.25,-1.8])));c.add(new THREE.LineCurve3(vec([3.15,.25,-1.8]),vec(end)));add(groupConduits,new THREE.TubeGeometry(c,140,.033,8,false),matNeonConduit,'server-monitor-'+offset);}
 const phoneRear=[pp.center[0]-.4,.25,pp.center[1]-pp.depth/2];route('server-phone',[[s.width/2,.25,1.0],[phoneRear[0],.25,1.0],phoneRear]);route('phone-monitor',[[pp.center[0]+.3,.25,pp.center[1]-pp.depth/2],[pp.center[0]+.3,.25,mp.center[1]+mp.depth/2]]);
 const plant=new THREE.Group();plant.name='plant-body';plant.position.set(-5.4,0,2.8);groupPlant.add(plant);add(plant,new THREE.CylinderGeometry(.46,.39,.82,40,1,true),porcelain,'pot-wall',[0,.41,0]);add(plant,new THREE.TorusGeometry(.44,.025,8,40),porcelain,'pot-lip',[0,.82,0]).rotation.x=Math.PI/2;add(plant,new THREE.CylinderGeometry(.41,.41,.02,32),physical(0x423827,0,.95),'pot-soil',[0,.785,0]);createNaturalFoliage(plant,add,line,physical);
 wall.traverse(o=>{if(o.isMesh)o.castShadow=false;});
 root.traverse(o=>{if(o.isMesh){for(const m of (Array.isArray(o.material)?o.material:[o.material]))if('envMapIntensity' in m)m.envMapIntensity=.38;}});
 for(const [i,p] of [[0,.3,1.1],[1.5,.32,4.0],[4.8,.3,2.8],[3.0,.6,-1.8]].entries()){const l=new THREE.PointLight(0xffa832,.85,3.0,2);l.name='rail-glow-'+i;l.position.set(...p);groupConduits.add(l);}
 const pillarAssembly=new THREE.Group();pillarAssembly.name='cloud-pillars';groupCloud.add(pillarAssembly);for(let i=0;i<3;i++)pillarAssembly.add(meshes['cloud-support-'+i]);
 const chartAssembly=new THREE.Group();chartAssembly.name='backdrop-charts';wall.add(chartAssembly);for(const name of ['left','right'])chartAssembly.add(meshes['backdrop-chart-'+name]);
 const nodes={'root':root,'server-platform':meshes['server-platform'],'server-unit-chassis':groupServer,'cloud-pillars':pillarAssembly,'cloud-volume':cloud,'curved-backdrop':wall,'backdrop-charts':chartAssembly,'laptop-station':groupLaptop,'phone-station':groupPhone,'monitor-station':groupMonitor,'potted-plant':groupPlant,'conduit-network':groupConduits};
 for(const [id,node] of Object.entries(nodes))node.userData.componentId=id;
 root.userData.sculptRuntime={groups,materials:{matNeonConduit,matCloudHalo},cloudPointLight,nodes,meshes,sockets,colliders:{},destructionGroups:{},routes:routeRecords};return root;
}

export function createCloudPhaseModel() { return createObjectModel(layout, { maxAnisotropy: 8 }); }