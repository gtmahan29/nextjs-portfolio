import * as THREE from "three";

export function createSparkHalo() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,"rgba(255,213,132,.32)");
  gradient.addColorStop(.32,"rgba(255,209,117,.15)");
  gradient.addColorStop(.65,"rgba(255,218,149,.045)");
  gradient.addColorStop(1,"rgba(255,218,149,0)");
  ctx.fillStyle = gradient; ctx.fillRect(0,0,128,128);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
  halo.scale.set(7.5,7.5,1);
  halo.renderOrder = 99;
  return halo;
}

/** Composited inside the existing canvas so the real cube stays above the paper. */
export function createEntryPaper() {
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    uniforms: { opacity: { value: 1 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.0,1.0); }",
    fragmentShader: `uniform float opacity; varying vec2 vUv;
      void main(){
        float light = exp(-2.6 * dot((vUv - vec2(.53,.58)) * vec2(1.1,1.0), (vUv - vec2(.53,.58)) * vec2(1.1,1.0)));
        gl_FragColor = vec4(mix(vec3(.77,.83,.88),vec3(.925,.95,.974),light),opacity);
        #include <colorspace_fragment>
      }`,
  });
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
  paper.renderOrder = 98;
  paper.frustumCulled = false;
  // Reflector's virtual camera keeps layer zero; never reflect the screen-space paper.
  paper.layers.set(1);
  return paper;
}
