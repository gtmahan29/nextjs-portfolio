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
    // Six small compositions, one per station, each showing that station's work.
    // Nobody walks: commuters and errands were removed to keep the scene calm and light.
    if (station === 0) {
      // Concept: a small client briefing, two chairs and a shared idea table.
      discussion(-20,-9,[{asset:0,seated:true},{asset:1,seated:true},{asset:3}],3.4);
    } else if (station === 1) {
      // Design: a facing pair of designers and a short review at the board.
      seat(0,-24,-14,heading+Math.PI/2,"design");seat(1,-20.4,-14,heading-Math.PI/2,"design");
      discussion(-21,8,[{asset:2},{asset:4}],2.2);
    } else if (station === 2) {
      // Architecture: the coding floor, two seats in each opposing bank, one at the racks.
      for (let i=0;i<2;i++) {
        seat(i%2,-26+i*4,-14,heading,"code");
        seat((i+1)%2,-26+i*4,14,heading+Math.PI,"code");
      }
      work(23,10,heading+Math.PI,"repair");
    } else if (station === 3) {
      // Runtime: the device lab and two people reviewing a live test.
      seat(0,-24,-11,heading+Math.PI/2,"test");seat(1,-24,-6,heading+Math.PI/2,"test");
      discussion(20,13,[{asset:2},{asset:4}],2.3);
    } else if (station === 4) {
      // Scale: the operations desk, one person at the racks and a short lead briefing.
      seat(0,-19,16,heading+Math.PI/2,"operations");seat(1,-19,21,heading+Math.PI/2,"operations");
      work(12,-27,heading+Math.PI/2,"repair");
      discussion(-24,10,[{asset:3},{asset:2}],2.4);
    } else {
      // Launch: a handover circle and a quiet lounge.
      discussion(-18,2,[{asset:3},{asset:2},{asset:0}],2.5);
      seat(0,-5,24,heading-Math.PI/2,"lounge");seat(1,-10,24,heading+Math.PI/2,"lounge");
    }
  });
  return {members,discussions};
}
