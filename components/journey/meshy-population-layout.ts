import * as THREE from "three";
import type { DistrictSite } from "./district-buildings";

export const MESHY_ASSETS = [
  { file: "Meshy_AI_Blueprint_Dreamer_All_Animations.glb", role: "programmer" },
  { file: "Meshy_AI_Shadow_Scout_All_Animations.glb", role: "developer" },
  { file: "Meshy_AI_3D_Female_Crafter_Ava_All_Animations.glb", role: "worker" },
  { file: "Meshy_AI_Midnight_Scholar_All_Animations.glb", role: "director" },
  { file: "Meshy_AI_Minimal_Muse_All_Animations.glb", role: "employee" },
  { file: "Meshy_AI_Faceless_Boy_in_Coral_1012210722_texture.glb", role: "worker" },
] as const;
export type MeshyFixture = "meeting" | "design" | "code" | "test" | "operations" | "lounge" | "repair";
export type MeshyMember = {
  id: number; asset: number; station: number; position: THREE.Vector3; yaw: number;
  activity: "talk" | "sit" | "walk" | "stand" | "work"; fixture?: MeshyFixture;
  group?: number; turn?: number; listenTo?: number; trip?: { destination: THREE.Vector3; lookAt: THREE.Vector3; purpose: string; dwell: number; rest: number }; phase: number; height: number;
};
export type MeshyDiscussion = { id: number; station: number; members: number[]; delay: number[]; offset: number };

export function createMeshyPopulationLayout(sites: DistrictSite[], route: [number, number][], stationIndices: number[]) {
  const members: MeshyMember[] = [], discussions: MeshyDiscussion[] = [];
  const add = (member: Omit<MeshyMember, "id" | "height">) => {
    const id = members.length;
    members.push({ ...member, id, height: 3.2 + (id % 3) * .08 }); return id;
  };
  sites.forEach(({ x, z, heading }, station) => {
    const cs = Math.cos(heading), sn = Math.sin(heading);
    const at = (v: number, u: number) => new THREE.Vector3(x + v * cs + u * sn, 0, z - v * sn + u * cs);
    const seat = (asset: number, v: number, u: number, yaw: number, fixture: MeshyFixture) =>
      add({asset,station,position:at(v,u),yaw,activity:"sit",fixture,phase:0});
    const work = (v: number, u: number, yaw: number, fixture: MeshyFixture = "repair") =>
      add({asset:2,station,position:at(v,u),yaw,activity:"work",fixture,phase:0});
    const listen = () => {
      const group = discussions.filter(group => group.station === station).at(-1);
      if (!group) return;
      const speakers = group.members.map(id => members[id]);
      const center = speakers.reduce((sum,member)=>sum.add(member.position),new THREE.Vector3()).multiplyScalar(1/speakers.length);
      const angles = speakers.map(member=>((Math.atan2(member.position.x-center.x,member.position.z-center.z)%(Math.PI*2))+Math.PI*2)%(Math.PI*2)).sort((a,b)=>a-b);
      let gap=-Infinity,angle=0;
      angles.forEach((start,i)=>{const end=i+1<angles.length?angles[i+1]:angles[0]+Math.PI*2;if(end-start>gap){gap=end-start;angle=(start+end)/2;}});
      const radius=Math.max(...speakers.map(member=>member.position.distanceTo(center)))+.9;
      const position=center.clone().add(new THREE.Vector3(Math.sin(angle)*radius,0,Math.cos(angle)*radius));
      add({asset:5,station,position,yaw:Math.atan2(center.x-position.x,center.z-position.z),activity:"stand",listenTo:group.id,phase:0});
    };
    const discussion = (v: number, u: number, cast: {asset:number; seated?:boolean}[], radius=2.3) => {
      const center=at(v,u), group:MeshyDiscussion={id:discussions.length,station,members:[],
        delay:cast.map((_,i)=>.65+((station*3+i*7+discussions.length)%6)*.23),offset:station*2.37+discussions.length*.81};
      cast.forEach(({asset,seated},turn)=>{
        const angle=turn*Math.PI*2/cast.length+.3+station*.21;
        const position=center.clone().add(new THREE.Vector3(Math.sin(angle)*radius,0,Math.cos(angle)*radius));
        group.members.push(add({asset,station,position,yaw:Math.atan2(center.x-position.x,center.z-position.z),
          activity:seated?"sit":"talk",fixture:seated?"meeting":undefined,group:group.id,turn,phase:0}));
      });
      discussions.push(group);
    };
    const visit = (home: [number,number], destination: [number,number], look: [number,number], assets: number[], purpose: string) => {
      assets.forEach((asset,i)=>add({asset,station,position:at(home[0]+i*3,home[1]),yaw:heading,activity:"walk",phase:0,
        trip:{destination:at(destination[0],destination[1]+i*2.8),lookAt:at(...look),purpose,dwell:5+i*2+station*.7,rest:4+i*3+station*.4}}));
    };
    // Six authored compositions, each reflecting its station's actual purpose.
    if (station === 0) {
      // Concept: a small client briefing, two chairs and a shared idea table.
      discussion(-20,-9,[{asset:0,seated:true},{asset:1,seated:true},{asset:3}],3.4);
      visit([-34,-3],[-23,-12],[-26,-12],[4],"Review the concept notes");
      listen();
    } else if (station === 1) {
      // Design: two facing pairs of designers with broad drafting desks.
      seat(0,-24,-14,heading+Math.PI/2,"design");seat(1,-20.4,-14,heading-Math.PI/2,"design");
      seat(1,21,14,heading+Math.PI/2,"design");seat(0,24.6,14,heading-Math.PI/2,"design");
      discussion(-21,8,[{asset:2},{asset:4}],2.2);
      work(-26,14,heading+Math.PI/2,"design");
      visit([34,5],[25,14],[28,14],[4],"Review the design board");
    } else if (station === 2) {
      // Architecture: the busiest coding floor, six seats in two opposing banks.
      for (let i=0;i<3;i++) {
        seat(i%2,-26+i*4,-14,heading,"code");
        seat((i+1)%2,-26+i*4,14,heading+Math.PI,"code");
      }
      discussion(-21,1,[{asset:0},{asset:4}],2.2);
      work(23,10,heading+Math.PI,"repair");work(25,-7,heading+Math.PI,"repair");
      visit([34,-1],[25,-8],[25,-11],[2,4],"Inspect the server racks");
    } else if (station === 3) {
      // Runtime: an L-shaped device lab and two people reviewing a live test.
      seat(0,-24,-11,heading+Math.PI/2,"test");seat(1,-24,-6,heading+Math.PI/2,"test");
      seat(0,-19,-15,heading,"test");
      discussion(20,13,[{asset:2},{asset:4}],2.3);
      work(22,-9,heading,"test");listen();
      visit([33,-6],[25,-13],[25,-16],[4,2],"Check the test results");
    } else if (station === 4) {
      // Scale: an operations room, a rack service crew and a short lead briefing.
      seat(0,-19,16,heading+Math.PI/2,"operations");seat(1,-19,21,heading+Math.PI/2,"operations");
      seat(1,-24,16,heading+Math.PI/2,"operations");seat(0,-24,21,heading+Math.PI/2,"operations");
      work(12,-27,heading+Math.PI/2,"repair");work(12,-21,heading+Math.PI/2,"repair");
      discussion(-24,10,[{asset:3},{asset:2}],2.4);
      listen();
      visit([1,-33],[19,-27],[16,-25],[2,1,4],"Inspect the operations racks");
    } else {
      // Launch: a handover circle, a separate support conversation and a quiet lounge.
      discussion(-18,2,[{asset:3},{asset:2},{asset:0}],2.5);
      discussion(-20,20,[{asset:4},{asset:0}],2.3);
      seat(0,-5,24,heading-Math.PI/2,"lounge");seat(1,-10,24,heading+Math.PI/2,"lounge");
      listen();
      visit([0,-27],[13,-20],[10,-20],[2,4,1],"Read the launch checklist");
    }
  });
  // Short delivery/checking trips remain visible within each phase's workspace.
  const errands:[number,number,number,number,number,number][]=[
    [-33,-22,-23,-14,-26,-12], [34,22,25,11,28,14], [34,-18,25,-15,25,-11],
    [32,-25,23,-13,25,-16], [4,-37,19,-29,16,-27],
  ];
  errands.forEach(([homeV,homeU,v,u,lookV,lookU],station)=>{
    const source=sites[station],c=Math.cos(source.heading),sn=Math.sin(source.heading);
    const at=(v:number,u:number)=>new THREE.Vector3(source.x+v*c+u*sn,0,source.z-v*sn+u*c);
    add({asset:station%2?1:2,station,position:at(homeV,homeU),yaw:source.heading,activity:"walk",phase:0,
      trip:{destination:at(v,u),lookAt:at(lookV,lookU),purpose:"Deliver and check the team's work notes",dwell:8+station,rest:10+station*2}});
  });
  return {members,discussions};
}
