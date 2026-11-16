import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

// Run with node scripts/check-character.mjs. No browser or renderer is required.
const modules = new Map();
function moduleUrl(file) {
  if (modules.has(file)) return modules.get(file);
  let code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  code = code.replace(/from "([^"]+)"/g, (_, name) => {
    const url = name.startsWith(".") ? moduleUrl(path.resolve(path.dirname(file), `${name}.ts`))
      : pathToFileURL(path.resolve(name === "three" ? "node_modules/three/build/three.module.js" : `node_modules/${name}`)).href;
    return `from "${url}"`;
  });
  const url = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  modules.set(file, url);
  return url;
}

const { createConversationCharacter } = await import(moduleUrl(path.resolve("components/journey/conversation-character.ts")));
const { sampleFoot, WALK_SPEED, WALK_PERIOD } = await import(moduleUrl(path.resolve("components/journey/character-gait.ts")));
const { HAIR_STYLES } = await import(moduleUrl(path.resolve("components/journey/character-hair.ts")));
const THREE = await import(pathToFileURL(path.resolve("node_modules/three/build/three.module.js")));

const { createStudioPeople } = await import(moduleUrl(path.resolve("components/journey/people.ts")));
const route = [[-60,0],[-30,0],[0,0],[35,0],[70,0],[105,0],[140,0],[158,2],[173,11],[182,26],[185,45],[185,111.92307692307693],[185,190],[185,300],[188,322],[197,340],[212,356],[232,366],[255,370],[290,370],[325,370],[365,370],[405,370],[445,370],[485,370],[525,370],[565,370],[605,370],[645,370],[685,370],[725,370]];
const indices = [2,6,12,20,24,28];
const scene = new THREE.Scene();
const population = createStudioPeople(scene, indices.map(i=>({x:route[i][0],z:route[i][1],heading:Math.atan2(route[i+1][0]-route[i-1][0],route[i+1][1]-route[i-1][1])})),route,indices);
assert.equal(population.residents.length, 41);
assert.equal(population.residents.filter(r=>r.curve).length, 8);
const compositions=indices.map((_,station)=>population.residents.filter(r=>r.station===station).map(r=>r.activity).sort().join());
assert.equal(new Set(compositions).size,6,"Station casts repeat the same activity mix");
const signatures = new Set(population.residents.map(r=>{
 const materials=r.character.mesh.material;
 return materials.map(m=>m.color.getHexString()).join()+r.character.root.getObjectByProperty("name","head").children.map(c=>c.name).join();
}));
assert.equal(signatures.size,41,"Resident appearances repeat");
const a=population.residents[0].character,b=population.residents[4].character;
assert.equal(a.mesh.geometry,b.mesh.geometry,"Same outfit should share body geometry");
assert.notEqual(a.bones[0],b.bones[0],"Residents must have independent skeletons");
let lowest=Infinity;
for(const time of [-.001,1,3,12,100,1000]) {
 population(time,false);
 for(const {character} of population.residents) {
  assert(Number.isFinite(character.root.position.length()),"Invalid resident position");
  character.root.updateMatrixWorld(true);character.mesh.skeleton.update();
  const p=character.mesh.geometry.getAttribute("position");
  for(let i=0;i<p.count;i+=97) {
   const v=character.mesh.applyBoneTransform(i,new THREE.Vector3().fromBufferAttribute(p,i));
   assert(Number.isFinite(v.length()),"Invalid resident skinning");lowest=Math.min(lowest,v.y);
  }
 }
}
assert(lowest>-.015,"Working or walking geometry clips below its supporting surface");
for(const motion of ["work","bend"]) {
 const worker=createConversationCharacter({outfit:"workwear"});worker.setMotion(motion);
 for(const time of [1,3,5,9]) {
  worker.update(time);worker.root.updateMatrixWorld(true);
  for(const side of [-1,1]) {
   const wrist=worker.bones.find(b=>b.name===side+"-wrist").getWorldPosition(new THREE.Vector3());
   const rhythm=Math.sin(time*2);
   const target=new THREE.Vector3(side*.28+(side===-1?rhythm*.025:0),motion==="bend"?1.12:1.76,(motion==="bend"?1.05:.72)+(side===-1?rhythm*.035:0));
   assert(wrist.distanceTo(target)<.001,"Working hand misses work surface");
  }
 }
 worker.dispose();
}
const { buildStationDistrict, buildInterstationDistricts, insideDistrict } = await import(moduleUrl(path.resolve("components/journey/district-buildings.ts")));
const footprints=[];let blocks=0;const B=()=>{blocks++;};
indices.forEach((index,i)=>{
 const x=route[index][0],z=route[index][1],heading=Math.atan2(route[index+1][0]-route[index-1][0],route[index+1][1]-route[index-1][1]);
 const cs=Math.cos(heading),sn=Math.sin(heading);
 footprints.push(...buildStationDistrict({B,heading,lx:(v,u)=>[x+v*cs+u*sn,z-v*sn+u*cs]},i));
});
footprints.push(...buildInterstationDistricts(B,route,indices));
let intersections=0;
for(const resident of population.residents.filter(r=>r.curve)) {
 for(let i=0;i<1000;i++) {
  const point=resident.curve.getPointAt(i/1000);
  if(insideDistrict(point.x,point.z,footprints,.55)) intersections++;
 }
}
assert.equal(intersections,0,"A pedestrian route intersects a satellite building");
assert(blocks<1000,"Satellite buildings exceed the instance budget");
const { buildStation } = await import(moduleUrl(path.resolve("components/journey/buildings.ts")));
const { STATIONS } = await import(moduleUrl(path.resolve("components/journey/data.ts")));
for(let station=0;station<indices.length;station++) {
 const index=indices[station],px=route[index][0],pz=route[index][1];
 const heading=Math.atan2(route[index+1][0]-route[index-1][0],route[index+1][1]-route[index-1][1]);
 const cs=Math.cos(heading),sn=Math.sin(heading),geometryScene=new THREE.Scene();
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),new THREE.MeshBasicMaterial());ground.rotation.x=-Math.PI/2;geometryScene.add(ground);
 buildStation(STATIONS[station].building,{B,scene:geometryScene,heading,lx:(v,u)=>[px+v*cs+u*sn,pz-v*sn+u*cs],px,pz,accent:new THREE.Color(STATIONS[station].color),accentHex:STATIONS[station].color,frameMat:new THREE.MeshStandardMaterial(),winMat:new THREE.MeshStandardMaterial(),stationData:STATIONS[station]});
 geometryScene.updateMatrixWorld(true);
 for(const resident of population.residents.filter(r=>r.station===station)) {
  const feet=resident.character.root.position;
  const ray=new THREE.Raycaster(new THREE.Vector3(feet.x,feet.y+.04,feet.z),new THREE.Vector3(0,-1,0),0,.08);
  const hit=ray.intersectObjects(geometryScene.children,true);if(!hit.length)console.log("Unsupported",station,resident.activity,feet.toArray());assert(hit.length>0,"Resident floats above or sinks into station "+station);
 }
}
population(1010,true);population.dispose();
console.log("PASS population",{residents:41,walkers:8,distinctStationCasts:new Set(compositions).size,uniqueAppearances:signatures.size,lowestVertex:lowest,workingHands:"on target"});
