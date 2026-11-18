import * as THREE from "three";

/**
 * The route you travel: a ribbon of light inlaid in the walkway, rather than a tube lying on it.
 *
 *   · behind you it is lit, in the colour of the station you are heading for: gold into violet
 *     into sky and so on, blending along each leg, so the line itself tells the story's colours
 *   · energy flows along the lit part toward you, and the last few metres burn hotter (a comet)
 *   · ahead of you the road is drawn as a quiet dotted guide that fades into the distance,
 *     so the line always has somewhere to go
 * One mesh, one draw call; everything is computed in the shader from the ribbon's UVs.
 */
const WIDTH = 3.2;

export function createRouteRibbon(curve: THREE.Curve<THREE.Vector3>, length: number, stops: number[], colors: string[], segments: number) {
  // A flat strip along the curve (arc-length parameterised, so uv.x matches getPointAt).
  const positions: number[] = [], uvs: number[] = [], index: number[] = [];
  const p = new THREE.Vector3(), t = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    curve.getPointAt(u, p); curve.getTangentAt(u, t);
    side.crossVectors(up, t).setY(0).normalize().multiplyScalar(WIDTH / 2);
    positions.push(p.x - side.x, 0, p.z - side.z, p.x + side.x, 0, p.z + side.z);
    uvs.push(u, 0, u, 1);
    if (i < segments) { const a = i * 2; index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);

  const palette = colors.map(c => new THREE.Color(c));
  const uniforms = {
    uH: { value: 0 }, uO: { value: 1 }, uTime: { value: 0 }, uLen: { value: length },
    uStops: { value: stops }, uCols: { value: palette },
  };
  const N = stops.length;
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: `
      uniform float uH,uO,uTime,uLen; uniform float uStops[${N}]; uniform vec3 uCols[${N}];
      varying vec2 vUv;
      vec3 routeColor(float u){
        vec3 c=uCols[0];
        for(int i=1;i<${N};i++) c=mix(c,uCols[i],smoothstep(uStops[i-1],uStops[i],u));
        return c;
      }
      void main(){
        float x=(vUv.y-.5)*${WIDTH.toFixed(2)}, ax=abs(x);
        float fw=fwidth(x)*1.2;
        float d=(uH-vUv.x)*uLen;            // metres behind the head; negative is still ahead
        vec3 col=routeColor(vUv.x);
        vec4 outc;
        if(d>=0.){
          float core=1.-smoothstep(.26-fw,.26+fw,ax);
          float rim=exp(-pow((ax-.5)/.07,2.))*.35;  // a fine second line either side, like an inlay
          float spill=exp(-ax*ax*1.6)*.22;
          // Light travelling toward you along the lit road.
          float flow=pow(.5+.5*sin((vUv.x*uLen-uTime*9.)*.55),8.)*core;
          float hot=exp(-d/7.);
          float tip=smoothstep(0.,.35,d);
          vec3 c=mix(col,col*.55+vec3(.5),flow*.55+hot*.45*core);
          float a=(core*.92+rim+spill+hot*.2*exp(-ax*ax))*tip;
          outc=vec4(c,a);
        } else {
          // The road ahead: dots on the centre line, fading out within a stretch or two.
          float ahead=-d;
          vec2 q=vec2(mod(vUv.x*uLen,2.2)-1.1,x);
          float pip=1.-smoothstep(.13-fw,.13+fw+.02,length(q));
          float fade=exp(-ahead/38.)*smoothstep(0.,2.5,ahead);
          outc=vec4(mix(col,vec3(.36,.45,.58),.35),pip*fade*.7);
        }
        outc.a*=uO;
        if(outc.a<.004) discard;
        gl_FragColor=outc;
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = .07;
  mesh.renderOrder = 5;
  mesh.frustumCulled = false;

  const color = new THREE.Color();
  return {
    mesh, uniforms,
    /** The route's colour at u, matching the shader (for the head and its light). */
    colorAt(u: number, out = color) {
      out.copy(palette[0]);
      for (let i = 1; i < N; i++) out.lerp(palette[i], THREE.MathUtils.smoothstep(u, stops[i - 1], stops[i]));
      return out;
    },
    dispose() { geometry.dispose(); material.dispose(); },
  };
}
