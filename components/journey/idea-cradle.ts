import * as THREE from "three";
import { createSpring } from "./motion-curve";
import { createRipples, popped } from "./studio-kit";

/*
The idea's cradle: where the glowing cube belongs at a station.

The cube is the idea, and it travels the whole journey. At a station it should not just hang in
the air: the station receives it. A gold halo ring forms under the cube, three sparks start to
circle it, a ring in the station's own colour turns the other way, and a thread of light runs
down from the halo into a socket on the platform, which lights with a ring on the floor. The
idea is now held and powered by this phase. Releasing plays it backwards.

MOTION SCORE (seconds after the goal turns on; springs on the shared curve)
| t (s) | Element        | Pattern | Goal                                         |
| 0     | halo ring      | P3      | pops in under the cube (k=2.5)               |
| .12   | accent ring    | P3      | pops; turns against the halo                 |
| .2    | sparks ×3      | P3      | appear on the halo; orbit (P16 loop)         |
| .3    | thread         | P11     | draws down from the halo to the platform     |
| .62   | socket         | P3      | lights; a ring spreads on the floor          |
While held: light pulses climb the thread into the halo, the field under the cube breathes.
Release: the same, in reverse order, quicker. Reduced motion: final state, nothing loops.
*/

type Spring = ReturnType<typeof createSpring>;
const GOLD = "#f5b544";

export type CradleOptions = {
  /** World height of the cube's centre, and of the platform top the thread reaches. */
  y: number; floor: number;
  /** Half the cube's size, so the halo sits just below it with a gap of air. */
  half: number;
  /** The station's colour, for the accent ring. */
  accent: THREE.ColorRepresentation;
  radius?: number;
};

export function createIdeaCradle(parent: THREE.Object3D, o: CradleOptions) {
  const group = new THREE.Group();
  group.name = "Idea cradle";
  parent.add(group);
  const R = o.radius ?? o.half * 1.55;
  const haloY = o.y - o.half - .55;
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(d: T) => { disposables.push(d); return d; };

  const gold = keep(new THREE.MeshStandardMaterial({ color: GOLD, emissive: "#f59e0b", emissiveIntensity: .9, metalness: .85, roughness: .22 }));
  const halo = new THREE.Mesh(keep(new THREE.TorusGeometry(R, .09, 16, 96)), gold);
  halo.rotation.x = Math.PI / 2;
  const accentMaterial = keep(new THREE.MeshStandardMaterial({ color: o.accent, emissive: o.accent, emissiveIntensity: 1.1, roughness: .35 }));
  const accent = new THREE.Mesh(keep(new THREE.TorusGeometry(R + .32, .022, 8, 120)), accentMaterial);
  const accentPivot = new THREE.Group();
  accentPivot.rotation.set(Math.PI / 2 + .18, 0, .1);
  accentPivot.add(accent);
  const haloPivot = new THREE.Group();
  haloPivot.position.y = haloY;
  haloPivot.add(halo, accentPivot);
  group.add(haloPivot);

  // The field under the cube: a soft disc of the idea's light, brighter at its rim.
  const fieldMaterial = keep(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uOn: { value: 0 }, uTime: { value: 0 } },
    vertexShader: "varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: `uniform float uOn,uTime; varying vec2 vP; void main(){
      float r=length(vP)/${R.toFixed(3)};
      float a=(smoothstep(.2,1.,r)*.5+.08)*(1.-smoothstep(.96,1.,r))*(.8+.2*sin(uTime*1.6-r*5.));
      gl_FragColor=vec4(1.,.72,.25,a*.55*uOn); }`,
  }));
  const field = new THREE.Mesh(keep(new THREE.CircleGeometry(R, 64)), fieldMaterial);
  field.rotation.x = -Math.PI / 2;
  field.renderOrder = 4;
  haloPivot.add(field);

  const sparkMaterial = keep(new THREE.MeshBasicMaterial({ color: "#fff3c4", toneMapped: false }));
  const sparkGeometry = keep(new THREE.SphereGeometry(.12, 14, 10));
  const sparks = [0, 1, 2].map(() => { const m = new THREE.Mesh(sparkGeometry, sparkMaterial); haloPivot.add(m); return m; });

  // The thread: from the halo to the platform, with light climbing it.
  const threadLength = Math.max(.1, haloY - o.floor);
  const threadMaterial = keep(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uDraw: { value: 0 }, uTime: { value: 0 } },
    vertexShader: "varying float vY; void main(){ vY=uv.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    // vY: 0 at the platform, 1 at the halo. It is drawn from the top down.
    fragmentShader: `uniform float uDraw,uTime; varying float vY; void main(){
      if(vY<1.-uDraw) discard;
      float pulse=pow(.5+.5*sin((vY*${threadLength.toFixed(2)}-uTime*5.)*1.1),10.);
      vec3 c=mix(vec3(.96,.62,.14),vec3(1.,.93,.7),pulse);
      gl_FragColor=vec4(c,.55+.45*pulse); }`,
  }));
  const thread = new THREE.Mesh(keep(new THREE.CylinderGeometry(.045, .045, threadLength, 8, 1, true)), threadMaterial);
  thread.position.y = o.floor + threadLength / 2;
  thread.renderOrder = 4;
  group.add(thread);

  const socket = new THREE.Mesh(keep(new THREE.TorusGeometry(.42, .06, 8, 48)), gold);
  socket.rotation.x = Math.PI / 2;
  socket.position.y = o.floor + .04;
  group.add(socket);
  const ripples = createRipples(group, GOLD, 2);
  disposables.push(ripples);

  const cue = (at: number) => ({ at, s: createSpring(0) as Spring });
  const cues = { halo: cue(0), accent: cue(.12), sparks: cue(.2), thread: cue(.3), socket: cue(.62) };
  const list = Object.values(cues);
  const last = Math.max(...list.map(c => c.at));
  let want = false, since = 0, lit = false, orbit = 0;

  function apply(time: number) {
    const h = popped(cues.halo.s.value, 2.5), a = popped(cues.accent.s.value, 2.5), sp = popped(cues.sparks.s.value, 2.5);
    halo.scale.setScalar(Math.max(.001, h)); halo.visible = h > .003;
    accent.scale.setScalar(Math.max(.001, a)); accent.visible = a > .003;
    field.scale.setScalar(Math.max(.001, Math.min(1, h))); field.visible = h > .003;
    fieldMaterial.uniforms.uOn.value = Math.max(0, Math.min(1, cues.halo.s.value));
    fieldMaterial.uniforms.uTime.value = time;
    sparks.forEach((m, i) => {
      const ang = orbit + i * Math.PI * 2 / 3;
      m.position.set(Math.cos(ang) * R, 0, Math.sin(ang) * R);
      m.scale.setScalar(Math.max(.001, sp)); m.visible = sp > .003;
    });
    const t = THREE.MathUtils.clamp(cues.thread.s.value, 0, 1);
    threadMaterial.uniforms.uDraw.value = t; threadMaterial.uniforms.uTime.value = time;
    thread.visible = t > .003;
    const k = popped(cues.socket.s.value, 2.5);
    socket.scale.setScalar(Math.max(.001, k)); socket.visible = k > .003;
  }

  return {
    group,
    /** held: the station holds the idea now. */
    update(held: boolean, dt: number, reduced: boolean, time: number) {
      if (held !== want) { want = held; since = 0; }
      since += dt;
      let moving = false;
      for (const c of list) {
        // Arriving in order; releasing in reverse, a little quicker.
        const goal = want ? (reduced || since >= c.at ? 1 : 0) : (reduced || since >= (last - c.at) * .4 ? 0 : 1);
        if (reduced) c.s.snap(goal); else moving = c.s.step(goal, dt) || moving;
      }
      if (cues.socket.s.value >= .98 && !lit) { lit = true; if (!reduced) ripples.emit(socket.position, 2.6, { life: 1.1 }); }
      if (cues.socket.s.value < .3) lit = false;
      const holding = cues.halo.s.value > .01;
      if (!reduced && holding) {
        orbit += dt * 1.1;
        accentPivot.rotation.z -= dt * .35;
      }
      moving = ripples.step(dt) || moving;
      if (holding || moving) apply(reduced ? 0 : time);
      else group.visible = false;
      if (holding || moving) group.visible = true;
    },
    dispose() { group.removeFromParent(); disposables.forEach(d => d.dispose()); },
  };
}
