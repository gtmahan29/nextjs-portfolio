import * as THREE from "three";

/**
 * The journey's floor: one material on the tabletop the whole route sits on.
 *
 * It reads like an architect's site model rather than a flat colour:
 *   · faint topographic contour lines over the whole table
 *   · a drafted grid that exists only near the route, the way a plan is drawn around a road
 *   · an inlaid walkway along the route: a lighter band with two engraved edges and stitched joints
 *   · a plaza under every station: ripples in the station's colour that wake as you arrive
 * Everything is computed in the shader from world position, so the whole floor is one draw call.
 */
export function createJourneyFloor(base: string, route: [number, number][], stations: { x: number; z: number; color: string }[]) {
  const uniforms = {
    uTime: { value: 0 },
    uRoute: { value: route.map(([x, z]) => new THREE.Vector2(x, z)) },
    uStations: { value: stations.map(s => new THREE.Vector3(s.x, s.z, 0)) },
    uColors: { value: stations.map(s => new THREE.Color(s.color)) },
  };
  const material = new THREE.MeshStandardMaterial({ color: base, roughness: .34, metalness: .06 });
  const R = route.length, S = stations.length;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vFloor;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvFloor=(modelMatrix*vec4(transformed,1.)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec3 vFloor;
uniform float uTime;
uniform vec2 uRoute[${R}];
uniform vec3 uStations[${S}];
uniform vec3 uColors[${S}];
float fhash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float fnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(fhash(i),fhash(i+vec2(1,0)),f.x),mix(fhash(i+vec2(0,1)),fhash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*fnoise(p);p*=2.03;a*=.5;}return v;}
// A crisp, antialiased line of width w (in world units) at the zero crossings of a periodic field.
float fline(float d,float w){float fw=fwidth(d);return 1.-smoothstep(w*.5-fw,w*.5+fw,abs(d));}
`)
      .replace("#include <color_fragment>", `#include <color_fragment>
{
  vec2 p=vFloor.xz;
  // distance to the route, and how far along it we are
  float dr=1e9; float along=0.; float acc=0.;
  for(int i=0;i<${R - 1};i++){
    vec2 a=uRoute[i],b=uRoute[i+1],ab=b-a; float L=length(ab);
    float t=clamp(dot(p-a,ab)/(L*L),0.,1.); float d=length(p-a-ab*t);
    if(d<dr){dr=d;along=acc+t*L;}
    acc+=L;
  }
  vec3 col=diffuseColor.rgb;
  vec3 ink=vec3(.36,.45,.58);

  // 1. contour lines: a quiet topography over the whole table
  float h=fbm(p*.012)*14.;
  float contour=fline(fract(h)-.5,.035)*.5+fline(fract(h*.2)-.5,.02)*.35;
  col=mix(col,ink,contour*.08);

  // 2. drafted grid near the route only, fading out like a sketch
  float nearRoute=1.-smoothstep(18.,70.,dr);
  vec2 g6=abs(fract(p/6.)-.5)*6., g30=abs(fract(p/30.)-.5)*30.;
  float grid=max(fline(min(g6.x,g6.y),.07)*.45,fline(min(g30.x,g30.y),.14));
  col=mix(col,ink,grid*.07*nearRoute);

  // 3. the walkway: a lighter inlaid band with engraved edges and stitched joints
  float band=1.-smoothstep(5.6,6.2,dr);
  col=mix(col,col*1.05+.02,band);
  float edge=fline(dr-6.,.12);
  col=mix(col,ink,edge*.34);
  float inner=fline(dr-4.9,.05)*(1.-step(6.,dr));
  col=mix(col,ink,inner*.12);
  float joints=fline(fract(along/4.)-.5,.03)*band*(1.-smoothstep(3.6,4.,dr))*step(1.2,dr);
  col=mix(col,ink,joints*.1);

  // 4. station plazas: ripples in the station's colour, brighter where you are
  for(int i=0;i<${S};i++){
    float d=length(p-uStations[i].xy);
    float act=uStations[i].z;
    float reach=1.-smoothstep(16.,44.,d);
    float rings=fline(fract((d-uTime*(1.2+act*2.))/3.2)-.5,.07)*reach*step(15.5,d);
    float halo=(1.-smoothstep(13.,30.,d))*step(13.,d);
    col=mix(col,uColors[i],rings*(.10+act*.22)+halo*(.04+act*.08));
  }
  diffuseColor.rgb=col;
}
`);
  };
  material.customProgramCacheKey = () => `journey-floor-${R}-${S}`;
  return {
    material,
    /** acts: how present each station is (0 far, 1 at the station). */
    update(time: number, acts: number[]) {
      uniforms.uTime.value = time;
      acts.forEach((a, i) => { uniforms.uStations.value[i].z = a; });
    },
    dispose() { material.dispose(); },
  };
}
