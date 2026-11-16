import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {createGoldenGlassCubeModel} from "./golden-glass-cube";
import { createTravelTrack } from "./camera-motion";

const OPEN = createTravelTrack([[0,0],[.10,0],[.28,1],[.47,1],[.63,0],[1,0]]);
const TURN = createTravelTrack([[0,0],[.65,0],[.85,1],[1,1]]);
export const ENTRY_REVEAL = createTravelTrack([[0,0],[.84,0],[.995,1],[1,1]]);
export const ENTRY_CENTER = createTravelTrack([[0,0],[.58,0],[.76,1],[1,1]]);
export const ENTRY_SPACE = createTravelTrack([[0,0],[.1,0],[.28,1],[.59,1],[.65,0],[1,0]]);

/** Six actual panels share geometry and material; every pose is a reversible scroll state. */
export function createSparkCube() {
  const glass=createGoldenGlassCubeModel();
  const root=glass.root;
  root.rotation.y = Math.PI / 4;
  // A small asymmetric constellation, sharing one geometry and two materials.
  // Hidden by default so the other station cubes keep their existing silhouette.
  const satelliteGeometry = new RoundedBoxGeometry(1,1,1,2,.08);
  const satelliteMaterials = [
    new THREE.MeshStandardMaterial({color:"#72dcff",roughness:.32,metalness:.32,emissive:"#3378dd",emissiveIntensity:.12,transparent:true}),
    new THREE.MeshStandardMaterial({color:"#eedfff",roughness:.4,metalness:.08,transparent:true}),
  ];
  const satelliteLayout = [
    [-2.7,1.1,.1,.25], [3.2,1.1,-.4,.22], [-2.7,-1.6,.3,.18],
    [3.2,-1.4,1.1,.36], [1.5,1.7,-1.6,.16], [0,-1.6,-1.5,.25],
  ];
  const satellites = satelliteLayout.map((pose,i) => {
    const mesh = new THREE.Mesh(satelliteGeometry,satelliteMaterials[i%2]);
    mesh.scale.setScalar(pose[3]);
    mesh.position.set(pose[0],pose[1],pose[2]);
    mesh.rotation.set(.2+i*.3,.4+i*.7,.1+i*.2);
    mesh.renderOrder = 100; mesh.visible = false;
    root.add(mesh); return mesh;
  });
  const trails = [0,1,2].map(i => {
    const trail = new THREE.Mesh(new THREE.TorusGeometry(2.1+i*.16,.022,5,90,Math.PI*1.15),new THREE.MeshBasicMaterial({color: i === 0 ? "#62d9ff" : "#cf91ff",transparent:true,opacity:0,depthWrite:false,depthTest:false}));
    trail.rotation.set(.4+i*.12, .15, i*.8);
    trail.renderOrder = 102; trail.visible = false; root.add(trail); return trail;
  });
  let lastTurn = 0, trailOpacity = 0;
  return {
    root, ready: Promise.resolve(), dispose: () => {},
    /** pose: spring-driven opening/turn from the runtime; without it the scroll tracks are used. */
    faces: glass.faces,
    update(progress: number,dt: number,reduced: boolean,pose?: {opening: number; turn: number; faces?: number[]}) {
      const opening = reduced ? 0 : pose ? pose.opening : OPEN(progress);
      const turn = reduced ? 1 : pose ? pose.turn : TURN(progress);
      glass.update(opening);
      // A face that has become its stage glyph shrinks into its own centre.
      glass.faces.forEach((face,i)=>face.scale.setScalar(Math.max(.0001,pose?.faces?.[i] ?? 1)));
      root.rotation.set(Math.sin(turn*Math.PI)*.18,Math.PI/4+turn*Math.PI*2,Math.sin(turn*Math.PI*2)*.13);
      const satelliteOpacity = reduced ? 0 : (1-THREE.MathUtils.smoothstep(progress,.78,.91))*(1-opening*.7);
      satelliteMaterials.forEach(value => { value.opacity = satelliteOpacity; });
      satellites.forEach((mesh,i) => {
        const pose = satelliteLayout[i];
        mesh.visible = satelliteOpacity > .001;
        mesh.position.set(pose[0],pose[1],pose[2]).multiplyScalar(1+opening*.3);
        mesh.rotation.y = .4+i*.7+progress*Math.PI*.6;
        mesh.rotation.z = .1+i*.2+Math.sin(progress*Math.PI)*.2;
      });
      const speed = Math.abs(turn-lastTurn)/Math.max(dt,.001);
      lastTurn = turn;
      const target = reduced || (!pose && (progress < .64 || progress > .89)) || progress > .93 ? 0 : Math.min(.5,speed*.12);
      trailOpacity += (target-trailOpacity)*(1-Math.exp(-dt*12));
      trails.forEach((trail,i) => {
        trail.visible = trailOpacity > .003;
        trail.material.opacity = trailOpacity*(1-i*.24);
        trail.rotation.z = -turn*Math.PI*.8+i*.8;
      });
    },
  };
}

