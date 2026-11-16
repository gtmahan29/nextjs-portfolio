import * as THREE from "three";

/** A world-aligned dot grid activated by recent motion, with spatial and temporal falloff. */
export function createDotTrail(scene: THREE.Scene, radius: number, lifetime = 1.65) {
  const count = 48;
  const stamps = Array.from({ length: count }, () => new THREE.Vector3(0, 0, -100));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uStamps: { value: stamps },
      uNow: { value: 0 },
      uRadius: { value: radius },
      uLife: { value: lifetime },
      uSpacing: { value: 1.05 },
    },
    vertexShader: `varying vec2 vWorld;
      void main(){ vec4 world=modelMatrix*vec4(position,1.); vWorld=world.xz;
        gl_Position=projectionMatrix*viewMatrix*world; }`,
    fragmentShader: `uniform vec3 uStamps[48];
      uniform float uNow,uRadius,uLife,uSpacing; varying vec2 vWorld;
      void main(){
        vec2 cell=(floor(vWorld/uSpacing)+.5)*uSpacing;
        float strength=0.;
        for(int i=0;i<48;i++){
          float age=max(0.,uNow-uStamps[i].z);
          float fade=exp(-age*1.9)*(1.-smoothstep(uLife*.6,uLife,age));
          float distance=length(cell-uStamps[i].xy)/uRadius;
          // A broad soft gradient, with no hard footprint or uniform disk.
          float spatial=exp(-distance*distance*3.8)*(1.-smoothstep(.72,1.,distance));
          strength=max(strength,spatial*fade);
        }
        if(strength<.008) discard;
        float seed=dot(cell,vec2(12.9898,78.233));
        float phase=fract(sin(seed)*43758.5453)*6.283185;
        float rhythm=.82+.12*sin(uNow*1.9+phase)+.06*sin(uNow*.73+phase*1.7);
        float energy=clamp(strength*rhythm,0.,1.);
        float radius=uSpacing*mix(.06,.41,pow(energy,.55));
        float distance=length(vWorld-cell);
        float aa=max(fwidth(distance),.008);
        float circle=1.-smoothstep(radius-aa,radius+aa,distance);
        float alpha=circle*pow(energy,.8)*.76;
        if(alpha<.003) discard;
        vec3 color=mix(vec3(.49,.79,.86),vec3(.68,.92,.94),strength);
        gl_FragColor=vec4(color,alpha);
      }`,
  });
  const field = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  field.rotation.x = -Math.PI / 2;
  field.position.y = 0.055;
  field.renderOrder = 2;
  field.visible = false;
  scene.add(field);
  let cursor = 0;
  let lastX = 0;
  let lastZ = 0;
  let lastTime = -100;
  const stamp = (x: number, z: number, time: number) => {
    stamps[cursor].set(x, z, time);
    cursor = (cursor + 1) % count;
  };
  return {
    add(x: number, z: number, time: number) {
      const distance = Math.hypot(x - lastX, z - lastZ);
      if (time - lastTime < .035 && distance < 1) return;
      // Resample fast pointer sweeps so the wake is continuous between browser events.
      const steps = time - lastTime < .18 && distance < 60 ? Math.min(12, Math.max(1, Math.ceil(distance / 1.2))) : 1;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        stamp(THREE.MathUtils.lerp(lastX, x, t), THREE.MathUtils.lerp(lastZ, z, t), steps === 1 ? time : THREE.MathUtils.lerp(lastTime, time, t));
      }
      lastX = x;
      lastZ = z;
      lastTime = time;
    },
    update(time: number) {
      material.uniforms.uNow.value = time;
      let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
      stamps.forEach(sample => {
        if (time - sample.z >= lifetime) return;
        minX = Math.min(minX, sample.x); maxX = Math.max(maxX, sample.x);
        minZ = Math.min(minZ, sample.y); maxZ = Math.max(maxZ, sample.y);
      });
      field.visible = minX !== Infinity;
      if (!field.visible) return;
      field.position.set((minX + maxX) / 2, .055, (minZ + maxZ) / 2);
      field.scale.set(maxX - minX + radius * 2, maxZ - minZ + radius * 2, 1);
    },
  };
}
