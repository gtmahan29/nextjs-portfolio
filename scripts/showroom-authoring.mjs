import * as THREEBase from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Authored geometry is evaluated only by export-showroom-assets.mjs.
export function createAuthoredRooms(quality,THREE=THREEBase){
const scene=new THREE.Scene(), F=1641,CX=836,SP=64;
function projectIrradiance(mesh,offsetX){
 const p=mesh.geometry.attributes.position,uv=[];
 mesh.updateWorldMatrix(true,false);
 for(let i=0;i<p.count;i++){
   const q=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld),d=Math.max(1,-q.z);
   uv.push((CX+F*(q.x-offsetX)/d)/1672,1-(452-F*(q.y-2.8)/d)/941);
 }
 mesh.geometry.setAttribute('uv1',new THREE.Float32BufferAttribute(uv,2));
}
const px2x=(px,d)=>(px-CX)*d/F;
const VARIANTS = [
  { key:'Collection I', name:'Ivory Atelier', text:'The reference reconstruction — arched niche, two-tier satin plinth, golden olive accents and warm linear light.',
    wall:0xe9d0b6, niche:0xd0b498, floor:0xb39f8a, stage:0xead4bd, podium:0xd6bea2,
    glow:[1.0,0.80,0.52], podiumType:'two', leftWall:'curved', rings:[8.8], nicheType:'plain', plant:'olive', sun:[1,0.89,0.75], exposure:0.82 },
  { key:'Collection II', name:'Champagne Dusk', text:'Amber dusk light, mirrored arched screens, a three-step plinth, double inlay rings and a fluted niche.',
    wall:0xe8cbab, niche:0xcfae8c, floor:0xb09a80, stage:0xe8cfb2, podium:0xd8b88f,
    glow:[1.0,0.64,0.30], podiumType:'three', leftWall:'arch', rings:[8.8,9.8], nicheType:'fluted', plant:'olive', sun:[1,0.86,0.68], exposure:0.78 },
  { key:'Collection III', name:'Pearl Moon', text:'Pearl-blush palette, a moon disc inside the arch, a tall pedestal with a floating halo and pampas plumes.',
    wall:0xeedfd8, niche:0xdccbc4, floor:0xbfb1aa, stage:0xeee0d9, podium:0xdcc9c0,
    glow:[1.0,0.88,0.74], podiumType:'pedestal', leftWall:'curved', rings:[7.4,8.8], nicheType:'moon', plant:'pampas', sun:[1,0.97,0.95], exposure:0.84 },
];


// Consistent reference palette and the first circular platform on every slide.
const palette={wall:0xf2e9dc,niche:0xe0c7af,floor:0xf0e6d7,stage:0xf0e8dd,podium:0xe9e1d6,glow:[1,.80,.52],rings:[8.8],sun:[1,.86,.67],exposure:1.15,podiumType:'two'};
VARIANTS.forEach(v=>Object.assign(v,palette));
/* ---------------- deterministic rng ---------------- */
function rngFrom(seed){ let s = seed>>>0; return ()=>{ s = (s*1664525 + 1013904223)>>>0; return s/4294967296; }; }

/* ---------------- textures ---------------- */
function canvasTex(w, h, draw, srgb=true){
  const c = document.createElement('canvas'); c.width=w; c.height=h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = quality.tier === "high" ? 4 : 1; return t;
}
const glowTexH = canvasTex(8,128,(g,w,h)=>{
 const gr=g.createLinearGradient(0,0,0,h);
 gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(.35,'rgba(255,255,255,0)');
 gr.addColorStop(.48,'rgba(255,255,255,1)');gr.addColorStop(.52,'rgba(255,255,255,1)');
 gr.addColorStop(.65,'rgba(255,255,255,0)');gr.addColorStop(1,'rgba(255,255,255,0)');
 g.fillStyle=gr;g.fillRect(0,0,w,h);
});
const glowTexV = canvasTex(256, 256, (g,w,h)=>{ const gr=g.createLinearGradient(0,0,w,0);
  gr.addColorStop(0,'rgba(255,255,255,0)'); gr.addColorStop(.42,'rgba(255,255,255,.35)'); gr.addColorStop(.5,'rgba(255,255,255,1)');
  gr.addColorStop(.58,'rgba(255,255,255,.35)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h);
  g.globalCompositeOperation='destination-in'; const v=g.createLinearGradient(0,0,0,h); v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(.12,'#000'); v.addColorStop(.88,'#000'); v.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=v; g.fillRect(0,0,w,h); });
const glowTexRad = canvasTex(256, 256, (g,w,h)=>{ const gr=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);
  gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.5,'rgba(255,255,255,.35)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h); });
const glowTexBand = canvasTex(8, 128, (g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'rgba(255,255,255,0)'); gr.addColorStop(.5,'rgba(255,255,255,1)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h); });
const glowTexRing = canvasTex(512, 512, (g,w,h)=>{ const gr=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);
  gr.addColorStop(0,'rgba(255,255,255,0)'); gr.addColorStop(.62,'rgba(255,255,255,.15)'); gr.addColorStop(.72,'rgba(255,255,255,1)'); gr.addColorStop(.8,'rgba(255,255,255,.15)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h); });

function tileTex(){ // large stone tiles with subtle mottling, 1 texture = 1 tile
  return canvasTex(512, 512, (g,w,h)=>{
    g.fillStyle='#ffffff'; g.fillRect(0,0,w,h);
    const r = rngFrom(7);
    for(let i=0;i<1400;i++){ const a=r()*0.035; g.fillStyle=`rgba(${150+r()*40|0},${130+r()*30|0},${110+r()*30|0},${a})`;
      const s=2+r()*26; g.beginPath(); g.arc(r()*w,r()*h,s,0,7); g.fill(); }
    g.strokeStyle='rgba(120,100,80,.18)'; g.lineWidth=2.2; g.strokeRect(1,1,w-2,h-2);
  });
}

/* ---------------- material helpers ---------------- */
const ledMat = (glow, k=3.2) => new THREE.MeshBasicMaterial({ color:new THREE.Color(glow[0]*k, glow[1]*k, glow[2]*k), toneMapped:false });
// Additive warm glow cards (not tone-mapped): display-space add = sRGB(color) * opacity * mask
const haloMat = (tex, glow, op) => new THREE.MeshBasicMaterial({ map:tex, color:new THREE.Color().setRGB(1, Math.min(1,glow[1]*0.86), Math.min(1,glow[2]*0.55), THREE.SRGBColorSpace),
  transparent:true, opacity:op, blending:THREE.AdditiveBlending, depthWrite:false, toneMapped:false });

function normalizeUV(geo){
  geo.computeBoundingBox(); const b=geo.boundingBox, p=geo.attributes.position, uv=geo.attributes.uv;
  for(let i=0;i<p.count;i++) uv.setXY(i,(p.getX(i)-b.min.x)/(b.max.x-b.min.x),(p.getY(i)-b.min.y)/(b.max.y-b.min.y));
  uv.needsUpdate=true; return geo;
}
function archPath(path, cx, w, springY, baseY, ccw=false){
  const r=w/2;
  path.moveTo(cx-r, baseY); path.lineTo(cx-r, springY);
  path.absarc(cx, springY, r, Math.PI, 0, true);
  path.lineTo(cx+r, baseY); path.lineTo(cx-r, baseY);
  return path;
}

/* ---------------- plants ---------------- */
const leafGeo = (()=>{ const s=new THREE.Shape(); s.moveTo(0,0); s.quadraticCurveTo(0.45,0.5,0,1.2); s.quadraticCurveTo(-0.45,0.5,0,0);
  const g=new THREE.ShapeGeometry(s,4); g.translate(0,0,0); return g; })();
function makeOlive(seed, h, spreadDir=1){
  const r = rngFrom(seed), tubes=[], leaves=[];
  const V=THREE.Vector3;
  function br(start, dir, len, rad, depth){
    const end = start.clone().addScaledVector(dir, len);
    const mid = start.clone().lerp(end,.5).add(new V((r()-.5)*len*.25, (r()-.2)*len*.1, (r()-.5)*len*.2));
    const cv = new THREE.QuadraticBezierCurve3(start, mid, end);
    tubes.push(new THREE.TubeGeometry(cv, 5, rad, 5, false));
    if (depth>=1){ const n = depth>=2 ? 9 : 7; for(let i=0;i<n;i++) leaves.push(cv.getPoint((depth===1?.45:.1)+(depth===1?.55:.9)*r()).add(new V((r()-.5)*.08*h,(r()-.5)*.06*h,(r()-.5)*.08*h))); }
    if (depth<3){
      const k = depth===0 ? 9 : 2 + (r()*2|0);
      for(let i=0;i<k;i++){
        const nd = depth===0 ? new V((r()-.5)*1.3 + spreadDir*0.12, 1, (r()-.5)*0.5).normalize() : dir.clone().add(new V((r()-.5)*1.6 + spreadDir*0.15, r()*0.3, (r()-.5)*0.7)).normalize();
        if (nd.y < 0.35) nd.y = 0.35 + r()*0.3;
        br(end, nd.normalize(), depth===0 ? h*(0.45+r()*0.2) : len*(0.42+r()*0.18), depth===0? rad*0.9 : rad*0.6, depth+1);
      }
    } else for(let i=0;i<5;i++) leaves.push(end.clone().add(new V((r()-.5)*.12*h,(r()-.5)*.12*h,(r()-.5)*.12*h)));
  }
  br(new V(0,0,0), new V(0,1,0), h*0.04, h*0.012, 0);
  const grp = new THREE.Group();
  const bm = new THREE.MeshStandardMaterial({ color:0x9c7444, roughness:.55, metalness:.35 });
  const bg = new THREE.Mesh(mergeGeometries(tubes), bm); bg.castShadow=true; grp.add(bg); tubes.forEach(g=>g.dispose());
  const lm = new THREE.MeshStandardMaterial({ color:0xd6ad6a, roughness:.38, metalness:.55, side:THREE.DoubleSide, emissive:0x4a3010, emissiveIntensity:.35 });
  const im = new THREE.InstancedMesh(leafGeo, lm, leaves.length); const m=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler();
  leaves.forEach((p,i)=>{ e.set(r()*6.28, r()*6.28, r()*6.28); q.setFromEuler(e); const s=h*(0.03+r()*0.022);
    m.compose(p,q,new THREE.Vector3(s,s,s)); im.setMatrixAt(i,m); });
  im.castShadow=true; grp.add(im);
  return grp;
}
function makePampas(seed, h){
  const r=rngFrom(seed), grp=new THREE.Group(), tubes=[], plumes=[];
  for(let i=0;i<9;i++){
    const a=(i/9-0.5)*1.4 + (r()-.5)*.2, l=h*(0.75+r()*0.3);
    const end=new THREE.Vector3(Math.sin(a)*l*0.45,l,(r()-.5)*0.5);
    const cv=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,0,0), new THREE.Vector3(end.x*.2,l*.55,0), end);
    tubes.push(new THREE.TubeGeometry(cv,8,h*0.006,4,false));
    const pg=new THREE.SphereGeometry(1,12,10); pg.scale(h*0.05,h*0.17,h*0.05);
    const t=cv.getTangent(1); const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),t);
    pg.applyQuaternion(q); const tip=end.clone().addScaledVector(t,h*0.12); pg.translate(tip.x,tip.y,tip.z); plumes.push(pg);
  }
  const s=new THREE.Mesh(mergeGeometries(tubes), new THREE.MeshStandardMaterial({color:0xb08e5e,roughness:.7})); s.castShadow=true;
  const p=new THREE.Mesh(mergeGeometries(plumes), new THREE.MeshStandardMaterial({color:0xf0e0c6,roughness:1,emissive:0x3a2a18,emissiveIntensity:.25})); p.castShadow=true; tubes.forEach(g=>g.dispose()); plumes.forEach(g=>g.dispose());
  grp.add(s,p); return grp;
}


/* ---------------- one showroom ---------------- */
function buildShowroom(v, X){
  const G = new THREE.Group(); G.position.x = X; scene.add(G);
  const wallM = new THREE.MeshStandardMaterial({ color:v.wall, roughness:.9 });
  const wallM2 = new THREE.MeshStandardMaterial({ color:new THREE.Color(v.wall).multiplyScalar(.97), roughness:.9 });
  const LED = ledMat([1,0.8+0.15*v.glow[1],0.45+0.45*v.glow[2]],1.0);
  const add=(m,cast=true,rec=true)=>{ m.castShadow=cast; m.receiveShadow=rec; G.add(m); return m; };
  const box=(w,h,d,x,y,z,mat=wallM)=>{ const m=add(new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat),false); m.position.set(x,y,z); return m; };
  const ledV=(x,y0,y1,z,w=0.09,hw=3.0,ho=0.42)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(w,y1-y0,0.05),LED); m.position.set(x,(y0+y1)/2,z); G.add(m);
    const h=new THREE.Mesh(new THREE.PlaneGeometry(hw,y1-y0), haloMat(glowTexV,v.glow,ho)); h.position.set(x,(y0+y1)/2,z+0.04); G.add(h); };

  /* ---- back wall with arched niche (z = -62) ---- */
  const WZ=-60, archL=px2x(583,60), archR=px2x(1165,60), archW=archR-archL, archC=(archL+archR)/2, spring=14.57, top=40;
  const wallShape = new THREE.Shape(); wallShape.moveTo(-46,0.5); wallShape.lineTo(46,0.5); wallShape.lineTo(46,top); wallShape.lineTo(-46,top); wallShape.lineTo(-46,0.5);
  wallShape.holes.push(archPath(new THREE.Path(), archC, archW, spring, 0.5));
  add(new THREE.Mesh(new THREE.ShapeGeometry(wallShape,48), wallM)).position.z = WZ;
  // reveal (frame depth)
  const fr = new THREE.Shape(); archPath(fr, archC, archW+0.6, spring, 0.5); fr.holes.push(archPath(new THREE.Path(), archC, archW, spring, 0.5));
  const frG = new THREE.ExtrudeGeometry(fr,{depth:1.6,bevelEnabled:false,curveSegments:64}); frG.translate(0,0,WZ-1.6);
  add(new THREE.Mesh(frG, wallM2));
  // niche back panel with painted light
  const nb = new THREE.Shape(); archPath(nb, archC, archW, spring, 0.5);
  const nbG = normalizeUV(new THREE.ShapeGeometry(nb,64));
  // texture spans y 0.5..(spring+r) = image -160..515 approx -> fine
  const nicheM=new THREE.MeshStandardMaterial({ roughness:.95 });
  add(new THREE.Mesh(nbG,nicheM)).position.z = WZ-1.6;
  // LED along arch opening (tube)
  const ap = new THREE.CurvePath(); const rr=archW/2-0.05;
  ap.add(new THREE.LineCurve3(new THREE.Vector3(archC-rr,0.5,0), new THREE.Vector3(archC-rr,spring,0)));
  ap.add(new THREE.CatmullRomCurve3(new THREE.EllipseCurve(archC,spring,rr,rr,Math.PI,0,true).getPoints(80).map(p=>new THREE.Vector3(p.x,p.y,0))));
  ap.add(new THREE.LineCurve3(new THREE.Vector3(archC+rr,spring,0), new THREE.Vector3(archC+rr,0.5,0)));
  const at = new THREE.Mesh(new THREE.TubeGeometry(ap,300,0.07,6,false), LED); at.position.z=WZ-0.12; G.add(at);
  // pilasters & LED reveals (depth 61)
  const D=59;
  const pil=(p0,p1,dz=0.6)=>{ const x0=px2x(p0,D), x1=px2x(p1,D); box(x1-x0,top-0.5,dz,(x0+x1)/2,(top+0.5)/2,WZ+dz/2); return [x0,x1]; };
  pil(450,540,1.2); pil(360,432,0.9); pil(125,345,2.0); pil(1218,1305,1.2); pil(1345,1470,0.9);
  ledV(px2x(441,D),0.5,top,WZ+0.3,0.14); ledV(px2x(352,D),0.5,top,WZ+0.3,0.12); ledV(px2x(1322,D),0.5,top,WZ+0.3,0.22);
  // bright daylight opening (top-right)
  const winX0=px2x(1472,D), winX1=px2x(1600,D);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(winX1-winX0, top), new THREE.MeshBasicMaterial({ color:new THREE.Color(1.0,0.985,0.96), toneMapped:false }));
  win.position.set((winX0+winX1)/2, top/2, WZ+0.05); G.add(win);
  // far right column with LED (behind right panel)
  box(3.2,top,1.0,20.5,top/2,-40.5); ledV(18.95,0.5,top,-39.95,0.12,1.6,.4);
  // far left block + LED edge of curved wall
  box(2.6,11.7,1.2,-20.0,0.5+5.85,-40.1);

  /* ---- left element ---- */
  const sideM = new THREE.MeshStandardMaterial({ color:v.wall, roughness:.85 });
  const goldEdge = new THREE.MeshStandardMaterial({ color:0xc8924a, roughness:.3, metalness:.7, emissive:new THREE.Color(0.62,0.40,0.14), emissiveIntensity:1.0 });
  function archPanel(mirror){ // reference right-side panel: quarter-round top, gilded edge
    const s=new THREE.Shape(); s.moveTo(14.7,0.5); s.lineTo(14.7,6.2); s.quadraticCurveTo(14.7,8.95,16.9,9.2); s.lineTo(18.9,9.67); s.lineTo(18.9,0.5); s.lineTo(14.7,0.5);
    const g=new THREE.ExtrudeGeometry(s,{depth:0.5,bevelEnabled:false,curveSegments:40}); g.translate(0,0,-39.8);
    if (mirror){ g.scale(-1,1,1); g.translate(2*1.0,0,0); }
    const m=add(new THREE.Mesh(g,[sideM,goldEdge])); m.name=mirror?'archPanelL':'archPanelR';
    // LED along curved edge
    const pts=[]; for(let t=0;t<=1.0001;t+=0.02){ let x,y; if(t<0.5){ x=14.72; y=0.5+t/0.5*5.7; } else { const u=(t-0.5)/0.5; x=(1-u)*(1-u)*14.72+2*(1-u)*u*14.72+u*u*16.9; y=(1-u)*(1-u)*6.2+2*(1-u)*u*8.97+u*u*9.22; }
      pts.push(new THREE.Vector3(mirror? 2-x : x, y, -39.28)); }
    G.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),120,0.06,6,false),LED));
    const hh=new THREE.Mesh(new THREE.PlaneGeometry(2.4,5.8),haloMat(glowTexV,v.glow,.4)); hh.position.set(mirror?2-14.75:14.75,3.4,-39.2); G.add(hh);
  }
  if (v.leftWall==='curved'){
    const s=new THREE.Shape(); s.moveTo(-18.6,0.5); s.lineTo(-18.6,11.7); s.quadraticCurveTo(-14.0,11.3,-10.9,10.4); s.quadraticCurveTo(-8.77,9.9,-8.77,8.2); s.lineTo(-8.77,0.5); s.lineTo(-18.6,0.5);
    const g=new THREE.ExtrudeGeometry(s,{depth:0.6,bevelEnabled:true,bevelSize:0.05,bevelThickness:0.05,bevelSegments:2,curveSegments:40}); g.translate(0,0,-39.9);
    add(new THREE.Mesh(g,sideM)).name='curvedWall';
    ledV(-18.66,0.5,11.6,-39.2,0.14,1.8,.5);
  } else { archPanel(true); box(3.2,40,1.0,2-20.5,20,-40.5); ledV(2-18.95,0.5,40,-39.95,0.12); }
  archPanel(false);

  /* ---- planters & plants ---- */
  const plM = new THREE.MeshStandardMaterial({ color:new THREE.Color(v.wall).multiplyScalar(1.0), roughness:.5, metalness:.05 });
  function planter(x0,x1,z0,z1,h,roundRight){
    const r=(z1-z0)/2, s=new THREE.Shape();
    if (roundRight){ s.moveTo(x0,z0); s.lineTo(x1-r,z0); s.absarc(x1-r,z0+r,r,-Math.PI/2,Math.PI/2,false); s.lineTo(x0,z1); s.lineTo(x0,z0); }
    else { s.moveTo(x1,z0); s.lineTo(x0+r,z0); s.absarc(x0+r,z0+r,r,-Math.PI/2,-Math.PI*1.5,true); s.lineTo(x1,z1); s.lineTo(x1,z0); }
    const g=new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:true,bevelSize:.06,bevelThickness:.06,bevelSegments:3,curveSegments:40});
    g.rotateX(Math.PI/2); g.translate(0,0.5+h,0); // shape y->z, extrude downwards
    add(new THREE.Mesh(g,plM)).name=roundRight?'planterL':'planterR';
  }
  planter(-24,-12.4,-38,-34.9,1.39,true);
  planter(13.7,24,-35.5,-32,1.27,false);
  const mk = v.plant==='olive' ? makeOlive : makePampas;
  const p1=mk(11,2.4, 1); p1.position.set(-16.2,1.95,-36.4); p1.name='plantL'; G.add(p1);
  const p2=mk(23,3.3,-1); p2.position.set(15.6,1.83,-33.7); p2.rotation.y=Math.PI; p2.name='plantR'; G.add(p2);

  /* ---- stage (two-tier front step) ---- */
  const stageM = new THREE.MeshStandardMaterial({ color:v.stage, roughness:.45 });
  box(92,0.28,0.6,0,0.36,-19.36,stageM);          // upper riser
  box(92,0.22,0.6,0,0.11,-18.83,stageM);                                // lower step
  const sl=new THREE.Mesh(new THREE.BoxGeometry(92,0.035,0.04),LED); sl.position.set(0,0.235,-19.04); G.add(sl);
  const sh=new THREE.Mesh(new THREE.PlaneGeometry(92,1.2),haloMat(glowTexH,v.glow,.6)); sh.rotation.x=-Math.PI/2; sh.position.set(0,0.225,-18.8); G.add(sh);
  const fh=new THREE.Mesh(new THREE.PlaneGeometry(92,2.6),haloMat(glowTexH,v.glow,.35)); fh.rotation.x=-Math.PI/2; fh.position.set(0,0.012,-18.0); G.add(fh);
  // stage top: glossy translucent over reflector
  const stTop=new THREE.Mesh(new THREE.PlaneGeometry(92,48), new THREE.MeshStandardMaterial({ color:v.stage, roughness:.3, transparent:true, opacity:.86 }));
  stTop.rotation.x=-Math.PI/2; stTop.position.set(0,0.5,-19.06-24); stTop.receiveShadow=true; G.add(stTop);

  /* ---- inlay rings ---- */
  const PC = new THREE.Vector3(1.0,0.5,-29.8);
  v.rings.forEach((R,i)=>{
    const ring=new THREE.Mesh(new THREE.RingGeometry(R-0.045,R+0.045,quality.tier === "low" ? 96 : 160), ledMat([1,0.86+0.14*v.glow[1],0.62+0.38*v.glow[2]],1.0)); ring.rotation.x=-Math.PI/2; ring.position.set(PC.x,0.506,PC.z); G.add(ring);
    const rh=new THREE.Mesh(new THREE.PlaneGeometry(2*R*1.24,2*R*1.24), haloMat(glowTexRing,v.glow,.15)); rh.rotation.x=-Math.PI/2; rh.position.set(PC.x,0.507+i*0.001,PC.z); G.add(rh);
  });
  const inl=new THREE.Mesh(new THREE.CircleGeometry(v.rings[v.rings.length-1]-0.05,quality.tier === "low" ? 96 : 160), new THREE.MeshStandardMaterial({color:0xffffff,roughness:.25,transparent:true,opacity:.18}));
  inl.rotation.x=-Math.PI/2; inl.position.set(PC.x,0.503,PC.z); G.add(inl);

  /* ---- podium ---- */
  const pM = new THREE.MeshStandardMaterial({ color:0xdfd2c2, roughness:.3, metalness:.3, envMapIntensity:1.2 });
  const pTop = new THREE.MeshStandardMaterial({ color:new THREE.Color(v.podium).lerp(new THREE.Color(0xffffff),.45), roughness:.35, metalness:.25 });
  function tier(r,y0,y1,b){ const pts=[new THREE.Vector2(0,y0)]; for(let i=0;i<=6;i++){const a=-Math.PI/2+i/6*Math.PI/2; pts.push(new THREE.Vector2(r-b+Math.cos(a)*b,y0+b+Math.sin(a)*b));}
    for(let i=0;i<=6;i++){const a=i/6*Math.PI/2; pts.push(new THREE.Vector2(r-b+Math.cos(a)*b,y1-b+Math.sin(a)*b));} pts.push(new THREE.Vector2(0,y1));
    const m=add(new THREE.Mesh(new THREE.LatheGeometry(pts,160),pM)); m.position.set(PC.x,0,PC.z); m.name='podiumTier';
    const t=new THREE.Mesh(new THREE.CircleGeometry(r-b,160),pTop); t.rotation.x=-Math.PI/2; t.position.set(PC.x,y1+0.002,PC.z); t.receiveShadow=true; G.add(t); }
  function gap(r,y){ const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,0.05,160,1,true),LED); const gh=new THREE.Mesh(new THREE.CylinderGeometry(r+0.08,r+0.08,0.24,160,1,true),haloMat(glowTexBand,v.glow,.5)); gh.position.set(PC.x,y,PC.z); G.add(gh); m.position.set(PC.x,y,PC.z); G.add(m); }
  tier(4.5,0.5,0.99,0.07); gap(4.46,1.01); tier(4.52,1.03,1.37,0.09);
  const pg=new THREE.Mesh(new THREE.PlaneGeometry(12.5,12.5),haloMat(glowTexRad,v.glow,.22)); pg.rotation.x=-Math.PI/2; pg.position.set(PC.x,0.509,PC.z+0.6); G.add(pg);
  // blurred reflection streaks of the vertical LEDs on the glossy floor: quads along camera rays so each
  // projects to the same image column as its LED (reference camera), fading toward the viewer
  const streakTex = canvasTex(64,256,(g,w,h)=>{ const gx=g.createLinearGradient(0,0,w,0); gx.addColorStop(0,'rgba(255,255,255,0)'); gx.addColorStop(.5,'rgba(255,255,255,1)'); gx.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=gx; g.fillRect(0,0,w,h); g.globalCompositeOperation='destination-in'; const gy=g.createLinearGradient(0,0,0,h); gy.addColorStop(0,'rgba(0,0,0,0)'); gy.addColorStop(.6,'rgba(0,0,0,.6)'); gy.addColorStop(1,'#000'); g.fillStyle=gy; g.fillRect(0,0,w,h); });
  [[60,39.3,.5],[352,59,.35],[441,59,.4],[583,60,.45],[1165,60,.45],[1322,59,.55],[1452,39.3,.45],[1625,39.3,.35],[640,29.8,.3],[1140,29.8,.3]].forEach(([px,dL,op])=>{
    const xL=(px-CX)*dL/F, hw=0.02*dL, d0=9.0, d1=18.5, pos=[];
    for(const d of [d0,d1]) { const k=d/dL; pos.push(xL*k-hw*k,0,-d, xL*k+hw*k,0,-d); }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1],2)); g.setIndex([0,1,2,1,3,2]);
    const m=new THREE.Mesh(g,haloMat(streakTex,v.glow,op*1.3)); m.position.y=0.015; m.renderOrder=2; G.add(m);
  });
  const paints=[wallM,wallM2,sideM,nicheM];
  paints.forEach(m=>{m.userData.referencePaint=true;});
  G.updateMatrixWorld(true);
  G.traverse(o=>{if(o.isMesh && (Array.isArray(o.material)?o.material:[o.material]).some(m=>paints.includes(m))) { projectIrradiance(o,X); o.castShadow=false; }});
  // Adjacent rooms meet at a shared boundary, so the camera moves right
  // without travelling through a long empty corridor or overlapping walls.
  const planes=[new THREE.Plane(new THREE.Vector3(1,0,0),-(X-SP/2)),new THREE.Plane(new THREE.Vector3(-1,0,0),X+SP/2)];
  G.traverse(o=>{if(o.isMesh)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.clippingPlanes=planes;m.clipShadows=true;});});
  return G;
}


const rooms=VARIANTS.map((v,i)=>buildShowroom(v,i*SP));
return {rooms,scene};
}
