import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { DistrictSite } from "./district-buildings";
import { disposeSceneResources } from "./scene-resources";
import { yieldToMain } from "./scene-loading";
import { MESHY_ASSETS, createMeshyPopulationLayout, type MeshyMember } from "./meshy-population-layout";
import { createMeshyFurniture } from "./meshy-chair";
import { conversationTurn, inPlaceClip, measureWalkSpeed, poseClip, quietPoseTime } from "./meshy-animation";
import { createMeshyPhaseDecor } from "./meshy-phase-decor";
import { cleanMeshySurface } from "./meshy-surface";
import { anchorSeatedClip, fitSeatedSurface, type MeshySeatFit } from "./meshy-seat-fit";

import { clearWalkSegment, freeWalkPoint, planWalk, walkObstacle, type WalkObstacle } from "./meshy-navigation";
import { getSceneQuality } from "./scene-quality";

type Profile = {
  asset: GLTF; bounds: THREE.Box3; walk?: THREE.AnimationClip; talk?: THREE.AnimationClip;
  listening?: THREE.AnimationClip; sitting?: THREE.AnimationClip; seatedTalk?: THREE.AnimationClip; seatFit?:MeshySeatFit; strideSpeed: number;
};
type Resident = {
  member: MeshyMember; root: THREE.Group; model: THREE.Group; mixer: THREE.AnimationMixer;
  idle?: THREE.AnimationAction; speech?: THREE.AnimationAction; walk?: THREE.AnimationAction;
  distance: number; speed: number; pathLength: number; path: THREE.Vector3[]; waypoint: number; state: "home"|"outbound"|"destination"|"returning"; wait: number; home: THREE.Vector3; destination?: THREE.Vector3; initialized: boolean; reservation:THREE.Vector3[];
};
const TALK_CLIPS = ["Talk_with_Hands_Open", "", "Talk_with_Hands_Open", "Talk_Passionately", "Talk_with_Right_Hand_Open", ""];
const WALK_RATE = .78;

async function createProfile(asset: GLTF, index: number, anisotropy: number, signal:AbortSignal): Promise<Profile> {
  const discarded = cleanMeshySurface(asset.scene, anisotropy);
  discarded.forEach(texture => {
    texture.dispose();
    if (typeof ImageBitmap !== "undefined" && texture.image instanceof ImageBitmap) texture.image.close();
  });
  const bounds = new THREE.Box3().setFromObject(asset.scene);
  const find = (name: string) => { const source = asset.animations.find(clip => clip.name === name); return source && inPlaceClip(source); };
  const walk = find("Walking"), talk = find(TALK_CLIPS[index]);
  const listenerSource = talk ?? walk;
  const listening = listenerSource && poseClip(listenerSource, quietPoseTime(asset.scene, listenerSource), "quiet-listening-pose");
  const seatedSource = find("Sitting_Answering_Questions");
  const seatedTime = seatedSource ? quietPoseTime(asset.scene,seatedSource) : 0;
  const seated = seatedSource && anchorSeatedClip(seatedSource,seatedTime);
  const sitting = seated && poseClip(seated,seatedTime,"seated-working-pose");
  const seatFit = seated ? await fitSeatedSurface(asset.scene,seated,seatedTime,signal) : undefined;
  const strideSpeed = walk ? measureWalkSpeed(asset.scene, walk) : 0;
  return { asset, bounds, walk, talk, listening, sitting, seatedTalk: seated, seatFit, strideSpeed };
}

/** One shared asset cache, independent skeletons and activity across the entire journey. */
export function mountMeshyResidents(scene: THREE.Scene, sites: DistrictSite[], route: [number, number][], stationIndices: number[],
  options: { onReady: () => void; prepare?: (root: THREE.Group) => Promise<unknown>; anisotropy?: number }) {
  const layout = createMeshyPopulationLayout(sites, route, stationIndices);
  const population = new THREE.Group(); population.name = "journey-meshy-population"; scene.add(population);
  const decor = createMeshyPhaseDecor(sites); population.add(decor);
  const furniture = createMeshyFurniture(), controller = new AbortController();
  const residents: Resident[] = [], profiles = new Map<number, Profile>(), sources: THREE.Group[] = [];
  const groups = layout.discussions.map(group => ({ ...group, time: group.offset }));
  const visibilitySphere = new THREE.Sphere(new THREE.Vector3(), 7);
  const tangent = new THREE.Vector3();
  let started = false, disposed = false, populationReady = false;

  function addMember(member: MeshyMember, profile: Profile, batch: THREE.Group) {
    const model = clone(profile.asset.scene) as THREE.Group, root = new THREE.Group();
    const scale = member.height / Math.max(profile.bounds.max.y - profile.bounds.min.y, .01);
    const center = profile.bounds.getCenter(new THREE.Vector3());
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -profile.bounds.min.y * scale, -center.z * scale);
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true; object.receiveShadow = false;
      if (object instanceof THREE.SkinnedMesh) object.frustumCulled = false;
    });
    root.name = `meshy-resident-${member.id}-${MESHY_ASSETS[member.asset].role}-${member.activity}`;
    root.userData = { station: member.station, role: MESHY_ASSETS[member.asset].role, activity: member.activity, speaking: false };
    root.add(model);
    const mixer = new THREE.AnimationMixer(model);
    const resident: Resident = { member, root, model, mixer, distance: 0, speed: profile.strideSpeed * scale * WALK_RATE,
      pathLength: 0, path: [], waypoint:1, state:"home", wait:2+member.id%7, home:member.position.clone(), initialized:false, reservation:[] };
    if (member.activity === "walk" && profile.walk) {
      resident.walk = mixer.clipAction(profile.walk).play();
      resident.walk.time = member.phase * profile.walk.duration;
      resident.walk.timeScale = WALK_RATE;
      if(profile.listening){resident.idle=mixer.clipAction(profile.listening).play();resident.idle.paused=true;}
      resident.walk.weight=0;
    } else {
      const idle = member.activity === "sit" ? profile.sitting : profile.listening;
      if (member.activity !== "stand" && !idle) throw new Error(`Missing ${member.activity} pose for ${MESHY_ASSETS[member.asset].file}`);
      if (idle) { resident.idle = mixer.clipAction(idle).play(); resident.idle.paused = true; }
      const speechClip = member.activity === "sit" ? profile.seatedTalk : profile.talk;
      if (member.group !== undefined && speechClip) {
        resident.speech = mixer.clipAction(speechClip).setLoop(THREE.LoopOnce, 1).play();
        resident.speech.paused = true; resident.speech.weight = 0;
      }
    }
    mixer.update(0); root.updateMatrixWorld(true);
    model.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.computeBoundingBox(); });
    model.position.y += .04 - new THREE.Box3().setFromObject(root).min.y;
    root.updateMatrixWorld(true);
    if (member.activity === "sit") {
      if (!profile.seatFit) throw new Error("Seated rig has no fitted chair surface");
      root.add(furniture.buildSeated(profile.seatFit,model.position,scale,member.fixture));
    } else if (member.activity === "work") {
      root.add(furniture.build(new THREE.Vector3(0, 0, 0), .63 * scale, scale, member.fixture, true));
    }
    root.position.copy(member.position); root.rotation.y = member.yaw;
    residents.push(resident); batch.add(root);
  }

  function obstacles():WalkObstacle[] {
    const boxes:THREE.Box3[]=[];
    scene.updateMatrixWorld(true);
    decor.children.forEach(set=>boxes.push(...(set.userData.navigationBoxes??[])));
    // Reserve central displays before the optional GLBs finish loading.
    sites.forEach(site=>boxes.push(new THREE.Box3(new THREE.Vector3(site.x-16,0,site.z-16),new THREE.Vector3(site.x+16,4,site.z+16))));
    for(const r of residents)if(r.member.activity!=="walk"){
      boxes.push(new THREE.Box3().setFromCenterAndSize(r.root.position.clone().add(new THREE.Vector3(0,1.5,0)),new THREE.Vector3(1.4,3,1.4)));
      r.root.children.filter(o=>o!==r.model).forEach(o=>boxes.push(new THREE.Box3().setFromObject(o)));
    }
    const matrix=new THREE.Matrix4(),instance=new THREE.Matrix4();
    const visit=(o:THREE.Object3D)=>{
      if(o===population)return;
      if(o instanceof THREE.Mesh){
        if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();const local=o.geometry.boundingBox;
        if(local){
          const count=o instanceof THREE.InstancedMesh?o.count:1;
          for(let i=0;i<count;i++){
            if(o instanceof THREE.InstancedMesh){o.getMatrixAt(i,instance);matrix.multiplyMatrices(o.matrixWorld,instance);}else matrix.copy(o.matrixWorld);
            const box=local.clone().applyMatrix4(matrix),size=box.getSize(new THREE.Vector3());
            if(box.max.y>.25&&box.min.y<3.5&&size.x<45&&size.z<45&&size.x>.01&&size.z>.01)boxes.push(box);
          }
        }
      }
      o.children.forEach(visit);
    };visit(scene);
    return boxes.map(box=>walkObstacle(box));
  }
  let navigation:WalkObstacle[]=[];
  let navigationClock=Infinity;
  function initializeTrip(r:Resident){
    const trip=r.member.trip!,root=r.root;
    if(!r.initialized){
      const home=freeWalkPoint(r.home,navigation),destination=freeWalkPoint(trip.destination,navigation);
      if(!home||!destination)return;
      r.home.copy(home);r.destination=destination;root.position.copy(home);r.initialized=true;
    }
  }
  function peers(r:Resident){return residents.filter(other=>other!==r&&other.member.activity==="walk"&&other.initialized&&!other.reservation.length)
    .map(other=>walkObstacle(new THREE.Box3().setFromCenterAndSize(other.root.position,new THREE.Vector3(.2,3,.2)),2.1));}
  function routeReserved(resident:Resident,path:THREE.Vector3[]){
    const otherPaths=residents.filter(r=>r!==resident&&r.reservation.length).map(r=>r.reservation);
    const line=new THREE.Line3(),closest=new THREE.Vector3();
    for(let i=1;i<path.length;i++){
      const distance=path[i-1].distanceTo(path[i]),steps=Math.ceil(distance/.5);
      for(let j=0;j<=steps;j++){
        const point=path[i-1].clone().lerp(path[i],steps?j/steps:0);
        for(const other of otherPaths)for(let k=1;k<other.length;k++){
          line.set(other[k-1],other[k]);line.closestPointToPoint(point,true,closest);
          if(point.distanceToSquared(closest)<2.8**2)return true;
        }
      }
    }
    return false;
  }
  function updateTrip(r:Resident,dt:number){
    if(!populationReady||!r.initialized)return;
    const trip=r.member.trip!, {root,walk,idle,mixer}=r;
    if(r.state==="home"||r.state==="destination"){
      walk!.weight=0;idle!.weight=1;walk!.paused=true;
      if(r.state==="destination")root.rotation.y=Math.atan2(trip.lookAt.x-root.position.x,trip.lookAt.z-root.position.z);
      mixer.update(0);r.wait-=dt;
      if(r.wait<=0){
        r.destination=freeWalkPoint(trip.destination,navigation)??r.destination;
        const destination=r.state==="home"?r.destination!:r.home;
        const path=r.state==="destination"?r.reservation.slice().reverse():planWalk(root.position,destination,[...navigation,...peers(r)]);
        r.path=path.length&&!routeReserved(r,path)?path:[];r.waypoint=1;
        if(r.path.length){if(r.state==="home")r.reservation=r.path.map(p=>p.clone());r.state=r.state==="home"?"outbound":"returning";r.pathLength=r.path.slice(1).reduce((sum,p,i)=>sum+p.distanceTo(r.path[i]),0);}
        else r.wait=3; // A blocked route stays still and retries; it never crosses a prop.
      }
    }else{
      let remaining=r.speed*dt,moved=0;
      while(remaining>1e-8&&r.waypoint<r.path.length){
        const next=r.path[r.waypoint];
        if(!clearWalkSegment(root.position,next,navigation)){
          const reroute=planWalk(root.position,r.state==="outbound"?r.destination!:r.home,[...navigation,...peers(r)]);
          if(!reroute.length||routeReserved(r,reroute)){walk!.weight=0;idle!.weight=1;walk!.paused=true;mixer.update(0);break;}
          r.path=reroute;r.waypoint=1;r.reservation=reroute.map(p=>p.clone());continue;
        }
        tangent.subVectors(next,root.position);const distance=tangent.length();
        const step=Math.min(distance,remaining);
        if(distance>1e-8){root.position.addScaledVector(tangent,step/distance);root.rotation.y=Math.atan2(tangent.x,tangent.z);}
        moved+=step;remaining-=step;if(step>=distance-1e-8)r.waypoint++;
      }
      r.distance+=moved;
      if(moved>0){walk!.weight=1;idle!.weight=0;walk!.paused=false;mixer.update(moved/r.speed);}
      if(r.waypoint>=r.path.length){r.state=r.state==="outbound"?"destination":"home";if(r.state==="home")r.reservation=[];r.wait=r.state==="destination"?trip.dwell:trip.rest;walk!.weight=0;walk!.paused=true;idle!.weight=1;mixer.update(0);}
    }
    root.userData.tripState=r.state;root.userData.destinationPurpose=trip.purpose;
  }

  async function load() {
    const loader = new GLTFLoader();
    // Common uniforms first. Each file is fetched/decoded once, and only if someone uses it.
    // Phones and low-memory devices load the light variants (scripts/make-meshy-mobile.py):
    // the three clips the scene plays and a 512 px colour map, instead of 5–25 MB files whose
    // 4096 px textures alone can push iOS Safari over its memory limit.
    const folder = getSceneQuality().tier === "low" ? "/3d-models-glb/mobile/" : "/3d-models-glb/";
    for (const index of [2, 0, 1, 4, 5, 3]) {
      if (disposed) return;
      if (!layout.members.some(member => member.asset === index)) continue;
      const filename = MESHY_ASSETS[index].file;
      try {
        const response = await fetch(`${folder}${filename}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Character download HTTP ${response.status}`);
        const buffer = await response.arrayBuffer(); await yieldToMain(controller.signal);
        const asset = await loader.parseAsync(buffer, folder);
        if (disposed) { disposeSceneResources(asset.scene); return; }
        sources.push(asset.scene);
        const profile = await createProfile(asset, index, options.anisotropy ?? 1,controller.signal);
        if (disposed) return;
        profiles.set(index, profile);
        const batch = new THREE.Group(); batch.name = `meshy-shared-${MESHY_ASSETS[index].role}`;
        for (const member of layout.members.filter(member => member.asset === index)) {
          if (disposed) return;
          addMember(member, profile, batch); await yieldToMain(controller.signal);
        }
        await options.prepare?.(batch);
        if (disposed) return;
        population.add(batch); options.onReady();
      } catch (error) {
        if (!disposed) console.error(`Meshy population failed to load: ${filename}`, error);
      }
    }
    populationReady=true;navigationClock=Infinity;
  }

  return {
    residents, layout, get navigation(){return navigation;},
    update(dt: number, reducedMotion: boolean, cameraPosition?: THREE.Vector3, frustum?: THREE.Frustum) {
      if (disposed) return;
      if (!started) { started = true; void load(); }
      decor.children.forEach(set => {
        visibilitySphere.center.copy(set.position); visibilitySphere.center.y = 2; visibilitySphere.radius = 65;
        set.visible = (!cameraPosition || set.position.distanceToSquared(cameraPosition) < 290 ** 2)
          && (!frustum || frustum.intersectsSphere(visibilitySphere));
      });
      navigationClock+=dt;
      if(navigationClock>=2){navigation=obstacles();navigationClock=0;}
      if(populationReady)residents.filter(r=>r.member.trip&&!r.initialized).forEach(initializeTrip);
      visibilitySphere.radius = 7;
      if (!reducedMotion) groups.forEach(group => { group.time += dt; });
      const turns = groups.map(group => conversationTurn(group.time, group.members.map(id => {
        const member = layout.members[id], profile = profiles.get(member.asset);
        return (member.activity === "sit" ? profile?.seatedTalk : profile?.talk)?.duration ?? 4;
      }), group.delay));
      for (const resident of residents) {
        const { member, root, mixer, idle, speech, walk } = resident;
        visibilitySphere.center.copy(root.position); visibilitySphere.center.y += 2;
        root.visible = (member.activity!=="walk"||resident.initialized) && (!cameraPosition || root.position.distanceToSquared(cameraPosition) < 260 ** 2)
          && (!frustum || frustum.intersectsSphere(visibilitySphere));
        if (!root.visible && !member.trip) continue;
        if (member.listenTo !== undefined) {
          const group = groups[member.listenTo], turn = turns[member.listenTo];
          const target = turn.speaker >= 0 ? layout.members[group.members[turn.speaker]].position
            : group.members.reduce((sum,id)=>sum.add(layout.members[id].position),new THREE.Vector3()).multiplyScalar(1/group.members.length);
          const desired = Math.atan2(target.x-root.position.x,target.z-root.position.z);
          const difference = Math.atan2(Math.sin(desired-root.rotation.y),Math.cos(desired-root.rotation.y));
          root.rotation.y += difference * (reducedMotion ? 1 : 1-Math.exp(-dt*3));
        }
        if (member.trip && walk && idle) {
          if(!reducedMotion) updateTrip(resident,dt);
        } else if (speech && idle && member.group !== undefined) {
          const turn = turns[member.group];
          const speaking = !reducedMotion && turn.speaker === member.turn;
          speech.time = speaking ? turn.time : 0;
          speech.weight = speaking ? turn.weight : 0; idle.weight = 1 - speech.weight;
          root.userData.speaking = speech.weight > .001;
          mixer.update(0);
        }
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true; controller.abort(); population.removeFromParent();
      const skeletons = new Set<THREE.Skeleton>();
      for (const { mixer, root } of residents) {
        mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot());
        root.traverse(object => { if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton); });
      }
      const resources = new THREE.Group();
      sources.forEach(source => { resources.add(source); source.traverse(object => { if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton); }); });
      skeletons.forEach(skeleton => skeleton.dispose());
      disposeSceneResources(resources); disposeSceneResources(decor); furniture.dispose(); profiles.clear();
    },
  };
}
