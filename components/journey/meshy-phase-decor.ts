import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { DistrictSite } from "./district-buildings";

/** Activity-specific set dressing around the authored main models, never over them. */
export function createMeshyPhaseDecor(sites: DistrictSite[]) {
  const root = new THREE.Group(); root.name = "journey-phase-workspaces";
  const box = new RoundedBoxGeometry(1, 1, 1, 2, .055);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 20);
  const sphere = new THREE.IcosahedronGeometry(1, 1);
  const ring = new THREE.TorusGeometry(1, .055, 6, 32);
  const colors = ["#e6ecec", "#c8b79e", "#526575", "#b4d2d9", "#83a590", "#dab769"];
  const shared = colors.map(color => new THREE.MeshStandardMaterial({color,roughness:.85}));
  const themes = ["concept-briefing", "design-atelier", "coding-floor", "device-test-lab", "operations-room", "handover-lounge"];
  sites.forEach(({x,z,heading},phase)=>{
    const set = new THREE.Group(); set.name = `phase-${phase+1}-${themes[phase]}`;
    set.position.set(x,0,z); set.rotation.y=heading; root.add(set);
    const accent = new THREE.MeshStandardMaterial({color:["#deb760","#ab9fd1","#79a8c0","#82b6a4","#d5a575","#d3a5b9"][phase],roughness:.84});
    const materials=[...shared,accent];
    const add=(geometry:THREE.BufferGeometry,v:number,y:number,u:number,w:number,h:number,d:number,mat:number,ry=0)=>{
      const mesh=new THREE.Mesh(geometry,materials[mat]);mesh.position.set(v,y,u);mesh.scale.set(w,h,d);mesh.rotation.y=ry;
      mesh.castShadow=mesh.receiveShadow=true;set.add(mesh);return mesh;
    };
    const B=(v:number,y:number,u:number,w:number,h:number,d:number,mat=0,ry=0)=>add(box,v,y,u,w,h,d,mat,ry);
    const table=(v:number,u:number,radius:number,height:number)=>{
      add(cylinder,v,height,u,radius,.12,radius,1);
      add(cylinder,v,height/2,u,.18,height,.18,2);
      add(cylinder,v,.09,u,.75,.18,.75,2);
      B(v-.3,height+.085,u+.1,.55,.04,.40);B(v+.3,height+.1,u-.15,.25,.035,.40,6);
    };
    const board=(v:number,u:number,w:number,kind:"notes"|"flow"|"checks"|"metrics",yaw=0)=>{
      const face=new THREE.Group();face.position.set(v,0,u);face.rotation.y=yaw;
      const start=set.children.length;
      B(0,2.5,0,w,2.6,.14);B(-w*.39,1.1,0,.075,2.2,.075,2);B(w*.39,1.1,0,.075,2.2,.075,2);
      if(kind==="notes")for(let i=0;i<6;i++)B((i%3-1)*w*.24,2.1+Math.floor(i/3)*.65,.09,.50,.45,.025,i%2?6:5);
      else if(kind==="flow"){
        for(let i=0;i<3;i++){
          B((i-1)*w*.28,2.55,.10,w*.23,1.25,.025,2);B((i-1)*w*.28,2.5,.12,w*.20,1.06,.018,3);
          B((i-1)*w*.28,2.88,.14,w*.16,.15,.008,6);B((i-1)*w*.28,2.46,.14,w*.14,.45,.008,0);
        }
      }else for(let i=0;i<4;i++){
        B(-w*.35,1.75+i*.46,.10,.19,.19,.025,kind==="checks"?4:6);
        B(.1,1.75+i*.46,.10,w*(.32+i*.09),.10,.025,kind==="checks"?2:3);
      }
      // Flatten transforms before material batching.
      for(const mesh of set.children.slice(start) as THREE.Mesh[]){
        mesh.position.applyAxisAngle(new THREE.Vector3(0,1,0),yaw).add(face.position);mesh.rotation.y+=yaw;
      }
    };
    const rack=(v:number,u:number,height=3.5,yaw=0)=>{
      const start=set.children.length;
      B(v,height/2,u,1.5,height,1.0,2);B(v,height/2,u+.53,1.3,height-.25,.07,0);
      for(let i=0;i<5;i++){
        B(v,.4+i*(height-.7)/5,u+.59,1.05,.25,.04,2);
        B(v+.42,.4+i*(height-.7)/5,u+.62,.08,.07,.025,4);
      }
      if(yaw)for(const mesh of set.children.slice(start) as THREE.Mesh[]){
        mesh.position.sub(new THREE.Vector3(v,0,u)).applyAxisAngle(new THREE.Vector3(0,1,0),yaw).add(new THREE.Vector3(v,0,u));mesh.rotation.y+=yaw;
      }
    };
    const plant=(v:number,u:number)=>{
      add(cylinder,v,.4,u,.45,.8,.45,0);
      add(sphere,v,1.3,u,.75,.95,.70,4);add(sphere,v+.4,1.15,u-.2,.50,.60,.50,4);
    };
    if(phase===0){
      table(-20,-9,1.85,1.65);board(-26,-12,3.6,"notes",Math.PI/2);
      B(-20,.025,-9,9,.045,9,6);plant(-27,-7);
    }else if(phase===1){
      board(-29,-14,4,"flow",Math.PI/2);board(28,14,3.2,"flow",-Math.PI/2);
      B(-30,1.3,14,1.3,2.6,3.8,1);
      for(let i=0;i<8;i++)B(-29.31,1+(i%4)*.43,13.1+Math.floor(i/4)*1.2,.07,.31,.80,i%3+3);
      B(-22.2,.025,-14,7,.045,5,6);B(22.8,.025,14,7,.045,5,6);
    }else if(phase===2){
      rack(25,-11);rack(28,-11);board(-31,0,3.8,"flow",Math.PI/2);
      B(-22,.025,-14,14,.045,5,3);B(-22,.025,14,14,.045,5,3);
      B(-31,.09,0,.18,.12,28,2);B(-27,.09,-14,8,.12,.18,2);B(-27,.09,14,8,.12,.18,2);
      for(let i=0;i<3;i++)B(22+i*1.6,.5,-13,1.1,1,.8,1);
    }else if(phase===3){
      board(-28,-7,3.5,"checks",Math.PI/2);board(25,-16,3,"metrics");
      B(23,1.1,-18,4,2.2,.8,2);
      for(let i=0;i<3;i++){B(21.8+i*1.2,1.3,-17.56,.75,1.1,.05,3);B(21.8+i*1.2,.72,-17.53,.55,.05,.03,4);}
      const clock=add(ring,24,3.65,-18,.75,.75,.75,6);clock.rotation.x=0;
      B(24,3.65,-17.97,.07,.70,.04,2);B(24.2,3.3,-17.97,.40,.07,.04,2);
      B(-24,.025,-6,6,.045,13,4);
    }else if(phase===4){
      board(-14,18.5,6,"metrics",-Math.PI/2);
      for(let i=0;i<3;i++)rack(16,-27+i*3.2,4.4,-Math.PI/2);
      B(-21.5,.025,18.5,11,.045,12,6);B(14,.025,-24,7,.045,12,3);
      for(let i=0;i<4;i++)B(10,.10,-28+i*2,.55,.20,.9,2);
    }else{
      table(-7.5,24,1.0,.95);table(-18,2,.75,1.55);
      board(10,-20,3.8,"metrics",Math.PI/2);plant(-13,26);plant(8,-16);plant(-14,22);
      B(-7.5,.025,24,8,.045,6,6);B(-18,.025,2,8,.045,8,6);
    }
    set.updateMatrixWorld(true);
    set.userData.navigationBoxes = set.children.filter((o):o is THREE.Mesh=>o instanceof THREE.Mesh)
      .map(mesh=>{mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);})
      .filter(box=>box.max.y>.25 && box.min.y<3.5);
    // Keep each themed workspace to one draw per material, instead of hundreds of props.
    for(const material of materials){
      const meshes=set.children.filter((o):o is THREE.Mesh=>o instanceof THREE.Mesh&&o.material===material);
      if(!meshes.length)continue;
      const parts=meshes.map(mesh=>{mesh.updateMatrix();return (mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone()).applyMatrix4(mesh.matrix);});
      const merged=mergeGeometries(parts);parts.forEach(part=>part.dispose());if(!merged)continue;
      meshes.forEach(mesh=>mesh.removeFromParent());
      const mesh=new THREE.Mesh(merged,material);mesh.castShadow=mesh.receiveShadow=true;set.add(mesh);
    }
  });
  box.dispose();cylinder.dispose();sphere.dispose();ring.dispose();
  return root;
}
