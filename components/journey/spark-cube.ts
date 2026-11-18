import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {createGoldenGlassCubeModel} from "./golden-glass-cube";
import { createTravelTrack } from "./camera-motion";
import { STATIONS } from "./data";
import { createSpring } from "./motion-curve";

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
  // Six stages around one idea: a cube in each station's colour, orbiting on a tilted ring.
  // They pop in one after another (scale on the shared spring, never a fade) and fold away
  // before the glass faces become the stage glyphs.
  const satelliteGeometry = new RoundedBoxGeometry(1,1,1,3,.14);
  const satelliteMaterials = STATIONS.map(st => new THREE.MeshStandardMaterial({color:st.color,roughness:.34,metalness:.22,emissive:st.color,emissiveIntensity:.16,transparent:true}));
  // Transparent (at full opacity) so they draw after the cube's glow instead of under it.
  const satellites = STATIONS.map((_,i) => {
    const mesh = new THREE.Mesh(satelliteGeometry,satelliteMaterials[i]);
    mesh.renderOrder = 100; mesh.visible = false;
    root.add(mesh); return mesh;
  });
  const satelliteSprings = satellites.map(() => createSpring(0));
  let orbit = 0, clock = 0, showWant = false, showAt = 0;
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
      // Shown through the question and the opening; folded away for the glyphs and the spin.
      const show = !reduced && progress < .5 && !(pose?.faces?.some(f => f < .98));
      clock += dt;
      if (show !== showWant) { showWant = show; showAt = clock; }
      if (!reduced) orbit += dt * .32;
      const radius = 2.75 + opening * .55;
      satellites.forEach((mesh,i) => {
        const spring = satelliteSprings[i];
        const goal = showWant && clock - showAt >= i * .09 ? 1 : !showWant && clock - showAt >= (5 - i) * .05 ? 0 : spring.value > .5 ? 1 : 0;
        spring.step(goal, Math.min(.25, dt));
        const s = spring.value > 1 ? 1 + (spring.value - 1) * 2.5 : Math.max(0, spring.value);
        mesh.visible = s > .002;
        const a = orbit + (i * Math.PI * 2) / satellites.length;
        mesh.position.set(Math.cos(a) * radius, Math.sin(a) * radius * .3 - .15, Math.sin(a) * radius);
        mesh.scale.setScalar(.26 * s);
        mesh.rotation.set(a * 1.3 + i, a * .9, i * .5);
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

