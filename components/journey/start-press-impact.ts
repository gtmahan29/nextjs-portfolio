import * as THREE from "three";

/*
The press, diluting outwards around the key.

The key stands on an invisible, still surface. The bottom-out disturbs it: two soft rings leave
the foot of the key and travel outwards, slowing as they go, while a faint glow spreads under them
by diffusion (its width grows as the square root of time and it thins with the area it covers).
Each ring widens and loses strength as it travels, so nothing ends on an edge; it all dilutes into
the sky. Nothing happens on the key itself.

Distances use the foundation's rounded square: r = 1 at the key's foot, OUTER at the plane's rim.
*/
const OUTER = 3.4;
const FRAGMENT = `varying vec2 vUv;uniform float uProgress;uniform float uOuter;
  void main(){
    vec2 q=abs((vUv-.5)*2.*uOuter)+1e-4;
    float r=pow(pow(q.x,4.)+pow(q.y,4.),.25);
    if(r<1.)discard;
    float t=uProgress,d=r-1.;
    // Diffusing glow: sqrt(t) spread, thinning with area.
    float sigma=.12+1.1*sqrt(t);
    float glow=exp(-d*d/(2.*sigma*sigma))*pow(.12/sigma,.7)*pow(1.-t,1.4)*.35;
    // Two soft rings, decelerating, widening and fading as they go.
    float rings=0.;
    for(int k=0;k<2;k++){
      float tk=clamp((t-float(k)*.14)/(1.-float(k)*.14),0.,1.);
      float front=(1.-pow(1.-tk,2.2))*(uOuter-1.)*.92;
      float width=.05+.28*tk;
      rings+=exp(-pow((d-front)/width,2.))*pow(1.-tk,1.8)*smoothstep(0.,.06,tk)*(k==0?.55:.32);
    }
    float a=(glow+rings)*(1.-smoothstep(uOuter*.72,uOuter,r));
    vec3 tint=mix(vec3(1.),vec3(.78,.92,1.),smoothstep(0.,1.5,d));
    gl_FragColor=vec4(tint,a);
  }`;

export function createPressImpact() {
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { uProgress: { value: 0 }, uOuter: { value: OUTER } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: FRAGMENT,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  plane.rotation.x = -Math.PI / 2;
  plane.renderOrder = 12;
  plane.visible = false;
  return {
    /** mount: the group the key stands in; foot: the half size of the key's base; y: its floor. */
    bind(mount: THREE.Object3D, foot: number, y: number) {
      mount.add(plane);
      plane.position.set(0, y + .003, 0);
      plane.scale.set(foot * 2 * OUTER, foot * 2 * OUTER, 1);
    },
    /** progress 0..1 after the bottom-out; below 0 the surface is still. */
    update(progress: number, reduced: boolean) {
      plane.visible = !reduced && progress >= 0 && progress < 1;
      material.uniforms.uProgress.value = Math.max(0, progress);
    },
    dispose() { plane.geometry.dispose(); material.dispose(); plane.removeFromParent(); },
  };
}
