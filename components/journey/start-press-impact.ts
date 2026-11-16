import * as THREE from "three";

/** A pressure wave follows the cap's actual surface and perspective. */
export function createPressImpact(scene: THREE.Scene) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uProgress: { value: 0 }, uAspect: { value: 1 } },
    vertexShader: `varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv;uniform float uProgress;uniform float uAspect;
      float roundedBox(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return min(max(q.x,q.y),0.)+length(max(q,0.))-r;}
      void main(){
        vec2 p=(vUv-.5)*vec2(uAspect,1.);
        float t=uProgress;
        float expansion=1.-pow(1.-t,3.);
        float d=roundedBox(p,vec2(.34*uAspect,.34)+expansion*.105,.085);
        float line=1.-smoothstep(.001,.005,abs(d));
        float halo=exp(-abs(d)*90.)*.22;
        float envelope=smoothstep(0.,.055,t)*pow(1.-t,2.);
        float sweep=exp(-pow((p.x+p.y-(t*1.7-.8))/.065,2.));
        float inside=1.-smoothstep(-.01,0.,roundedBox(p,vec2(.335*uAspect,.335),.08));
        vec3 tint=mix(vec3(.36,.91,1.),vec3(1.,.58,.94),smoothstep(-.4,.4,p.x));
        gl_FragColor=vec4(tint,((line+halo)*.78+sweep*inside*.13)*envelope);
      }`,
  });
  const wave = new THREE.Mesh(new THREE.PlaneGeometry(1,1), material);
  wave.rotation.x = -Math.PI/2;
  root.add(wave);
  return {
    bind(cap: THREE.Group) {
      cap.updateWorldMatrix(true,true);
      const bounds = new THREE.Box3().setFromObject(cap);
      bounds.applyMatrix4(cap.matrixWorld.clone().invert());
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      cap.add(root);
      root.position.set(center.x,bounds.max.y+.012,center.z);
      wave.scale.set(size.x*1.45,size.z*1.45,1);
      material.uniforms.uAspect.value=size.x/size.z;
    },
    update(progress:number,reduced:boolean){
      root.visible=!reduced&&progress>=0&&progress<1;
      material.uniforms.uProgress.value=Math.max(0,progress);
    },
    dispose(){wave.geometry.dispose();material.dispose();root.removeFromParent();},
  };
}
