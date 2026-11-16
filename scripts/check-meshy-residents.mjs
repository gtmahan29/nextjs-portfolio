import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import * as THREE from "three";

// Exercise the real loader, skeleton cloning, clips and lifecycle without WebGL.
const modules = new Map();
function moduleUrl(file) {
  if (modules.has(file)) return modules.get(file);
  let code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  code = code.replace(/from ["']([^"']+)["']/g, (_, name) => {
    const url = name.startsWith(".") ? moduleUrl(path.resolve(path.dirname(file), `${name}.ts`))
      : pathToFileURL(path.resolve(name === "three" ? "node_modules/three/build/three.module.js" : `node_modules/${name}`)).href;
    return `from "${url}"`;
  });
  const url = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  modules.set(file, url);
  return url;
}

const requested = [];
globalThis.window = { setTimeout, clearTimeout, addEventListener() {} };
globalThis.ProgressEvent = class { constructor(type, properties) { Object.assign(this, { type }, properties); } };
globalThis.fetch = async url => {
  if (url.startsWith("data:")) return new Response(Buffer.from(url.split(",")[1], "base64"));
  requested.push(url);
  const buffer = fs.readFileSync(path.join("public", url));
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString());
  const binary = buffer.subarray(28 + jsonLength);
  // Texture decoding needs a browser; keep the exact geometry, skin and animation.
  delete json.images; delete json.textures;
  json.materials = json.materials?.map(() => ({ pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] } }));
  const jsonBytes = Buffer.from(JSON.stringify(json));
  const paddedLength = Math.ceil(jsonBytes.length / 4) * 4;
  const rebuilt = Buffer.alloc(28 + paddedLength + binary.length);
  rebuilt.writeUInt32LE(0x46546c67, 0); rebuilt.writeUInt32LE(2, 4); rebuilt.writeUInt32LE(rebuilt.length, 8);
  rebuilt.writeUInt32LE(paddedLength, 12); rebuilt.writeUInt32LE(0x4e4f534a, 16);
  rebuilt.fill(32, 20, 20 + paddedLength); jsonBytes.copy(rebuilt, 20);
  rebuilt.writeUInt32LE(binary.length, 20 + paddedLength); rebuilt.writeUInt32LE(0x004e4942, 24 + paddedLength);
  binary.copy(rebuilt, 28 + paddedLength);
  return new Response(rebuilt);
};


const { mountMeshyResidents } = await import(moduleUrl(path.resolve("components/journey/meshy-residents.ts")));
const { MESHY_ASSETS } = await import(moduleUrl(path.resolve("components/journey/meshy-population-layout.ts")));
const { cleanMeshySurface } = await import(moduleUrl(path.resolve("components/journey/meshy-surface.ts")));
const texture = new THREE.Texture(), detail = new THREE.Texture();
const surface = new THREE.MeshStandardMaterial({map:texture,normalMap:detail,bumpMap:detail,metalnessMap:detail,roughnessMap:detail});
const fixtureGeometry = new THREE.BoxGeometry();
const surfaceMesh = new THREE.Mesh(fixtureGeometry,surface);
const positionsBefore = Float32Array.from(fixtureGeometry.attributes.position.array);
cleanMeshySurface(surfaceMesh,16);
assert.equal(surface.map,texture,'Authored clothing colors must be retained');
assert.equal(surface.normalMap,null);assert.equal(surface.bumpMap,null);
assert.equal(surface.metalnessMap,null);assert.equal(surface.roughnessMap,null);
assert.equal(texture.generateMipmaps,false,'Distant mip levels must not bleed neighboring UV islands');
assert.equal(texture.minFilter,THREE.LinearFilter);assert.equal(texture.anisotropy,8);
assert.deepEqual(fixtureGeometry.attributes.position.array,positionsBefore,'Surface repair must preserve rigged geometry');
fixtureGeometry.dispose();surface.dispose();texture.dispose();detail.dispose();
const {clearWalkSegment,planWalk,walkObstacle}=await import(moduleUrl(path.resolve("components/journey/meshy-navigation.ts")));
const thinBoard=[walkObstacle(new THREE.Box3(new THREE.Vector3(-2,0,-.04),new THREE.Vector3(2,3,.04)))];
const boardStart=new THREE.Vector3(0,0,-6),boardEnd=new THREE.Vector3(0,0,6);
assert(!clearWalkSegment(boardStart,boardEnd,thinBoard),'A thin whiteboard must block a crossing segment');
const aroundBoard=planWalk(boardStart,boardEnd,thinBoard);
assert(aroundBoard.length>2,'Whiteboard needs a detour');
aroundBoard.slice(1).forEach((p,i)=>assert(clearWalkSegment(aroundBoard[i],p,thinBoard),'Every detour segment must clear the inflated whiteboard'));
const scene = new THREE.Scene();
const sites = [{x:0,z:0,heading:Math.PI/2},{x:140,z:0,heading:Math.PI/2},{x:185,z:190,heading:0},{x:325,z:370,heading:Math.PI/2},{x:485,z:370,heading:Math.PI/2},{x:645,z:370,heading:Math.PI/2}];
const {buildStationDistrict}=await import(moduleUrl(path.resolve("components/journey/district-buildings.ts")));
const districtBoxes=[];
const boxGeo=new THREE.BoxGeometry(1,1,1),boxMaterial=new THREE.MeshBasicMaterial();
for(let i=0;i<4;i++){
  const site=sites[i],c=Math.cos(site.heading),sn=Math.sin(site.heading);
  buildStationDistrict({heading:site.heading,lx:(v,u)=>[site.x+v*c+u*sn,site.z-v*sn+u*c],B:(x,y,z,w,h,d,color,heading)=>{
    const mesh=new THREE.Mesh(boxGeo,boxMaterial);mesh.position.set(x,y+h/2,z);mesh.scale.set(w,h,d);mesh.rotation.y=heading??0;districtBoxes.push(mesh);
  }},i);
}
const district=new THREE.InstancedMesh(boxGeo,boxMaterial,districtBoxes.length);
districtBoxes.forEach((mesh,i)=>{mesh.updateMatrix();district.setMatrixAt(i,mesh.matrix);});scene.add(district);
const route = sites.flatMap(site => [[site.x,site.z],[site.x+40,site.z],[site.x+80,site.z]]);
let ready = 0;
const population = mountMeshyResidents(scene, sites, route, [0,3,6,9,12,15], { onReady() { ready++; } });
assert.equal(requested.length, 0);
population.update(0, false);
const timeout = Date.now() + 20000;
while (ready < 6 && Date.now() < timeout) await new Promise(resolve => setTimeout(resolve, 20));
assert.equal(ready, 6, "Every asset must mount");
assert.equal(requested.length, 6, "Assets must be downloaded once, regardless of resident count");
population.update(0,false);
const {residents,layout} = population;
assert.equal(residents.length, layout.members.length);
assert.equal(residents.filter(r=>r.root.userData.role==='director').length,3);
assert(residents.filter(r=>r.root.userData.role!=='director').length>=40);
for(let station=0;station<6;station++) {
  const locals=residents.filter(r=>r.member.station===station);
  assert(locals.length>=5, 'All six phases must be populated');
  assert.equal(locals.filter(r=>r.member.activity==='sit').length,[2,4,6,3,4,2][station]);
}
const compositions=sites.map((_,station)=>JSON.stringify(layout.members.filter(m=>m.station===station).map(m=>[m.asset,m.activity,m.fixture])));
assert.equal(new Set(compositions).size,6,'Each phase needs a distinct cast and workspace composition');
const decor=scene.getObjectByName('journey-phase-workspaces');
assert.equal(new Set(decor.children.map(set=>set.name)).size,6);
assert.equal(residents.filter(r=>r.member.station===2&&r.member.activity==='sit').length,6,'Architecture must have the largest coding floor');
for(const group of layout.discussions) assert(group.members.length===2 || group.members.length===3);
const seated=residents.filter(r=>r.member.activity==='sit');
const listeners=residents.filter(r=>r.member.asset===5);
assert(listeners.every(r=>r.member.listenTo!==undefined),'Unrigged characters must belong to a conversation as listeners');
for(const r of listeners){
  const group=layout.discussions[r.member.listenTo];
  const peers=group.members.map(id=>layout.members[id]);
  assert(Math.min(...peers.map(p=>p.position.distanceTo(r.root.position)))<5,'Listeners must stand close to their group');
  assert(Math.min(...peers.map(p=>p.position.distanceTo(r.root.position)))>2,'Listeners need body/chair clearance');
}
let furnitureChecks=0;
const plantedFeet=new Map();
function checkFurniture(r){
  const fixture=r.root.getObjectByName('meshy-office-chair-and-desk');
  const surface=fixture.userData.seatSurface,boxes=fixture.userData.collisionBoxes;
  r.root.updateMatrixWorld(true);
  const feet=['Left','Right'].map(side=>r.model.getObjectByName('mixamorig'+side+'Foot').getWorldPosition(new THREE.Vector3()));
  const planted=plantedFeet.get(r.member.id);
  if(planted)assert(feet.every((foot,i)=>foot.distanceTo(planted[i])<1e-5),'Seated feet must remain planted through speech/listening transitions');
  else plantedFeet.set(r.member.id,feet);
  const inverse=r.root.matrixWorld.clone().invert(),point=new THREE.Vector3();
  r.model.traverse(mesh=>{
    if(!(mesh instanceof THREE.SkinnedMesh))return;
    const position=mesh.geometry.attributes.position;
    for(let i=0;i<position.count;i++){
      mesh.applyBoneTransform(i,point.fromBufferAttribute(position,i)).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
      furnitureChecks++;
      const dx=Math.abs(point.x-surface.x);
      if(dx<surface.width/2-.004&&point.z>surface.rearZ+.004&&point.z<surface.frontZ-.004){
        const t=(point.z-surface.rearZ)/(surface.frontZ-surface.rearZ)*(surface.top.length-1),j=Math.floor(t);
        const edge=Math.max(0,(dx-surface.width*.25)/(surface.width*.25))*.02/.11*surface.thickness;
        const roof=surface.top[j]*(1-(t-j))+surface.top[j+1]*(t-j)-edge;
        assert(!(point.y<roof-.004&&point.y>roof-surface.thickness+.004),'Body intersects fitted cushion: '+r.root.name+' '+point.toArray());
      }
      for(const box of boxes)if(Math.abs(point.x-box.x)<box.w/2-.004&&Math.abs(point.y-box.y)<box.h/2-.004&&Math.abs(point.z-box.z)<box.d/2-.004)
        assert.fail('Body intersects furniture '+(box.name??'desk')+': '+r.root.name+' '+point.toArray());
    }
  });
}
for(const r of seated) {
  const chair=r.root.getObjectByName('meshy-office-chair-and-desk');
  assert(chair && chair.userData.seatY>.4 && chair.userData.seatY<2, 'Every seated pose needs a fitted chair');
  checkFurniture(r);
}
const speakersSeen = layout.discussions.map(()=>new Set());
const walkers=residents.filter(r=>r.member.activity==='walk');
const previous=walkers.map(r=>r.root.position.clone());
const previousDistance=walkers.map(r=>r.distance);
let maxTravelError=0,minWalkerSeparation=Infinity;
const tripStates=new Map(walkers.map(r=>[r.member.id,new Set()]));
const stoppedFrames=new Map(),returnsSeen=new Set(),previousStates=new Map();
const gesturesSeen = new Set(), lastGesture = new Map();
const gaitSamples = new Map();
for (const r of walkers) if (!gaitSamples.has(r.member.asset)) gaitSamples.set(r.member.asset,{resident:r,frames:[]});
for(let frame=0;frame<12000;frame++) {
  population.update(1/30,false);
  if(frame<600&&frame%30===0)for(const r of seated.filter(r=>r.member.group!==undefined))checkFurniture(r);
  for(const group of layout.discussions) {
    const speakers=residents.filter(r=>r.member.group===group.id&&r.root.userData.speaking);
    assert(speakers.length<=1, 'Two members of the same group must never speak together');
    speakers.forEach(r=>speakersSeen[group.id].add(r.member.id));
    for (const r of speakers) {
      const arm=r.model.getObjectByName('mixamorigRightArm');
      const before=lastGesture.get(r.member.id);
      if (before && before.angleTo(arm.quaternion)>.001) gesturesSeen.add(r.member.id);
      lastGesture.set(r.member.id,arm.quaternion.clone());
    }
  }
  walkers.forEach((r,i)=>{
    const actual=r.root.position.distanceTo(previous[i]);
    const expected=r.speed/30;
    assert(actual<=expected*1.001,'A trip must never teleport or exceed calibrated speed');
    const travel=r.distance-previousDistance[i];previousDistance[i]=r.distance;
    if(travel>0&&r.state!=="home"&&r.state!=="destination")maxTravelError=Math.max(maxTravelError,Math.abs(travel-expected)/expected);
    tripStates.get(r.member.id).add(r.state);
    if(previousStates.get(r.member.id)==='returning'&&r.state==='home')returnsSeen.add(r.member.id);
    previousStates.set(r.member.id,r.state);
    if(r.state==='destination'&&actual===0){stoppedFrames.set(r.member.id,(stoppedFrames.get(r.member.id)??0)+1);assert(r.walk.paused&&r.walk.weight===0,'Feet must stop at the destination');}
    if(actual>0)assert(clearWalkSegment(previous[i],r.root.position,population.navigation),'Walkers must clear all decor, furniture and district obstacles: '+r.member.id);
    previous[i].copy(r.root.position);
    assert(r.speed>1&&r.speed<4, 'Calibrated adult walking speed must be plausible');
  });
  for(let i=0;i<walkers.length;i++)for(let j=i+1;j<walkers.length;j++){
    if(!walkers[i].initialized||!walkers[j].initialized)continue;
    const separation=walkers[i].root.position.distanceTo(walkers[j].root.position);
    minWalkerSeparation=Math.min(minWalkerSeparation,separation);
    assert(separation>2,'Walkers must never pass through one another');
  }
  for (const sample of gaitSamples.values()) {
    const r=sample.resident;if(r.walk.paused||sample.frames.length>=180)continue;r.root.updateMatrixWorld(true);
    sample.frames.push({frame,forward:new THREE.Vector3(Math.sin(r.root.rotation.y),0,Math.cos(r.root.rotation.y)),
      feet:['Left','Right'].map(side=>r.model.getObjectByName('mixamorig'+side+'Foot').getWorldPosition(new THREE.Vector3()))});
  }
}
assert(maxTravelError<.035, 'Moving trips must advance at calibrated speed');
for(const r of walkers){assert(tripStates.get(r.member.id).has('destination'),'Walker must reach a real destination: '+r.member.id);assert(tripStates.get(r.member.id).has('returning'),'Walker must return: '+r.member.id);assert(returnsSeen.has(r.member.id),'Every walker must complete the return home: '+r.member.id+' '+r.state);assert(stoppedFrames.get(r.member.id)>90,'Destination dwell must last several seconds');}
layout.discussions.forEach((group,i)=>assert.equal(speakersSeen[i].size,group.members.length,'Every member must get a turn'));
assert.equal(gesturesSeen.size,layout.discussions.reduce((sum,g)=>sum+g.members.length,0),'Scheduled speakers must actually animate their bones');
const supportSlip = [];
for (const {resident:r,frames} of gaitSamples.values()) {
  const residuals=[];
  for(let foot=0;foot<2;foot++) {
    const heights=frames.map(f=>f.feet[foot].y), min=Math.min(...heights), max=Math.max(...heights);
    for(let i=1;i<frames.length;i++) {
      if(frames[i].frame!==frames[i-1].frame+1)continue;
      if(Math.max(heights[i],heights[i-1])>min+(max-min)*.28)continue;
      const velocity=frames[i].feet[foot].clone().sub(frames[i-1].feet[foot]).multiplyScalar(30);
      residuals.push(Math.abs(velocity.dot(frames[i].forward))/r.speed);
    }
  }
  residuals.sort((a,b)=>a-b);
  const median=residuals[Math.floor(residuals.length/2)];supportSlip.push(median);
  assert(median<.4,'Supporting foot should remain mostly planted after travel calibration');
}
scene.updateMatrixWorld(true);
for(const r of residents) {
  r.model.traverse(o=>{if(o instanceof THREE.SkinnedMesh) o.computeBoundingBox();});
  const b=new THREE.Box3().setFromObject(r.model);
  assert(Number.isFinite(b.min.length()));
  assert(b.min.y>-.4&&b.min.y<.6, 'Characters must stay grounded: '+r.root.name+' '+b.min.y);
}
const frozen=walkers.map(r=>({position:r.root.position.clone(),time:r.walk.time}));
population.update(1,true);
assert(walkers.every((r,i)=>r.root.position.equals(frozen[i].position)&&r.walk.time===frozen[i].time));
assert(residents.every(r=>!r.root.userData.speaking));
population.update(.016,false,new THREE.Vector3(10000,10000,10000));
assert(residents.every(r=>!r.root.visible), 'Far-away crowds must be culled');
const skeletons=[];residents.forEach(r=>r.model.traverse(o=>{if(o instanceof THREE.SkinnedMesh)skeletons.push(o.skeleton);}));
assert.equal(new Set(skeletons).size,skeletons.length,'Every character needs its own skeleton');
population.dispose();population.dispose();
assert.deepEqual(scene.children,[district],'Population cleanup must preserve the surrounding district');
const cancelled=mountMeshyResidents(scene,sites,route,[0,3,6,9,12,15],{onReady(){throw new Error('Disposed population mounted');}});
cancelled.update(0,false);cancelled.dispose();await new Promise(resolve=>setTimeout(resolve,50));
assert.deepEqual(scene.children,[district],'Population cleanup must preserve the surrounding district');
district.removeFromParent();boxGeo.dispose();boxMaterial.dispose();
console.log('PASS', {residents:residents.length,directors:3,chairs:seated.length,discussionGroups:layout.discussions.length,listeners:listeners.length,furnitureVertexChecks:furnitureChecks,walkers:walkers.length,maxTravelError,minWalkerSeparation,supportSlip,roles:MESHY_ASSETS.map(a=>a.role)});
