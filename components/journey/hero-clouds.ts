import * as THREE from "three";

/** Instanced, textured billows: detailed silhouettes without per-pixel volume marching. */
export async function createHeroClouds() {
  const texture = await new THREE.TextureLoader().loadAsync("/hero-clouds/cloud-puff.png");
  texture.colorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 10);
  camera.position.z = 2;
  const uniforms = { uTime: { value: 0 }, uScroll: { value: 0 }, uAspect: { value: 1 }, uCloud: { value: texture }, uCoverage:{value:1},uArrival:{value:0},uWhiteout:{value:0} };
  const skyMaterial = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `varying vec2 vUv;void main(){gl_FragColor=vec4(mix(vec3(.43,.69,.88),vec3(.13,.36,.60),vUv.y),1.);
      #include <colorspace_fragment>
    }`,
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMaterial);
  sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky);
  const geometry = new THREE.InstancedBufferGeometry();
  const plane = new THREE.PlaneGeometry(1, 1);
  geometry.index = plane.index;
  geometry.attributes = { ...plane.attributes };
  const cloudMaterial = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: `
      attribute vec4 billow;
      attribute vec3 motion;
      varying vec2 vUv;
      varying float vOpacity;
      varying float vShade;
      varying float vPhase;
      uniform float uTime;
      uniform float uAspect;
      uniform float uScroll;
      uniform float uCoverage;
      uniform float uArrival;
      void main(){
        vUv=uv;vOpacity=motion.y*uCoverage;vShade=motion.z;vPhase=motion.x;
        float lower=billow.w*uScroll;
        float angle=motion.x+uTime*.025*(.5+fract(motion.x))+lower*.12;
        float growth=1.+sin(uTime*.22+motion.x*7.)*.055+lower*.07;
        mat2 turn=mat2(cos(angle),-sin(angle),sin(angle),cos(angle));
        float approach=mix(.65,1.40,uArrival);
        vec2 p=turn*position.xy*billow.z*growth*(uArrival>0.?approach:1.)+billow.xy;
        float clear=1.-uCoverage;
        p+=vec2(sign(billow.x)*.23,billow.w>.5?-.16:.16)*clear;
        p.y+=billow.w*uArrival*.32;
        p+=vec2(sin(uTime*.12+motion.x*3.),cos(uTime*.15+motion.x*5.))*.009;
        p+=vec2(sin(motion.x)*.045,.115)*lower;
        gl_Position=vec4(p.x/uAspect*2.,p.y*2.,0.,1.);
      }`,
    fragmentShader: `
      uniform sampler2D uCloud;
      uniform float uTime;
      varying vec2 vUv;
      varying float vOpacity;
      varying float vShade;
      varying float vPhase;
      void main(){
        vec2 flow=vec2(sin(vUv.y*15.+uTime*.18+vPhase),cos(vUv.x*13.-uTime*.15+vPhase));
        vec4 c=texture2D(uCloud,vUv+flow*.004);
        if(c.a<.015)discard;
        gl_FragColor=vec4(c.rgb*vShade,c.a*vOpacity);
        #include <colorspace_fragment>
      }`,
  });
  const billows = new THREE.Mesh(geometry, cloudMaterial);
  billows.frustumCulled = false; scene.add(billows);
  // The detailed upper silhouette settles into featureless white at the bottom.
  const mistMaterial=new THREE.ShaderMaterial({
    uniforms,
    transparent:true,depthTest:false,depthWrite:false,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float uScroll;uniform float uCoverage;uniform float uWhiteout;void main(){float mist=(1.-smoothstep(.055+uScroll*.05,.39+uScroll*.08,vUv.y))*uCoverage;gl_FragColor=vec4(1.,1.,1.,mix(mist,1.,uWhiteout));}`,
  });
  const mist=new THREE.Mesh(new THREE.PlaneGeometry(2,2),mistMaterial);
  mist.frustumCulled=false;mist.renderOrder=2;scene.add(mist);
  const foregroundScene=new THREE.Scene();
  const foregroundBillows=new THREE.Mesh(geometry,cloudMaterial);foregroundBillows.frustumCulled=false;foregroundScene.add(foregroundBillows);
  const foregroundMist=new THREE.Mesh(mist.geometry,mistMaterial);foregroundMist.frustumCulled=false;foregroundMist.renderOrder=2;foregroundScene.add(foregroundMist);
  let currentAspect = 0;
  function arrange(aspect: number) {
    if (Math.abs(currentAspect - aspect) < .001) return;
    currentAspect = aspect;
    let seed = 73;
    const random = () => { const n = Math.sin(seed++) * 10000; return n - Math.floor(n); };
    const positions: number[] = [], motion: number[] = [];
    const side = aspect * .5;
    // Upper banks leave a blue window; lower banks merge into a dense cloud bed.
    const banks = [
      [-side+.08,.43,.35,.21,30], [side-.06,.45,.34,.23,30],
      [-side+.20,-.36,.48,.16,34], [side-.18,-.37,.48,.17,34],
      [0,-.45,side,.12,58], [0,-.59,side,.12,30],
    ];
    for(const [x,y,w,h,count] of banks) for(let i=0;i<count;i++) {
      const spread=random()*2-1;
      const px=x+spread*w, py=y+(random()*2-1)*h;
      const size=.22+random()*.25;
      positions.push(px,py,size,y<0?1:0);
      motion.push(random()*Math.PI*2,.7+random()*.28,.92+random()*.08);
    }
    geometry.setAttribute("billow",new THREE.InstancedBufferAttribute(new Float32Array(positions),4));
    geometry.setAttribute("motion",new THREE.InstancedBufferAttribute(new Float32Array(motion),3));
    geometry.instanceCount=positions.length/4;
  }
  return {
    scene, camera,foregroundScene,
    useForeground(value:boolean){
      billows.visible=!value&&uniforms.uCoverage.value>.001;
      mist.visible=!value&&(uniforms.uCoverage.value>.001||uniforms.uWhiteout.value>.001);
      foregroundBillows.visible=value&&uniforms.uCoverage.value>.001;
      foregroundMist.visible=value;
    },
    resize(aspect: number) { uniforms.uAspect.value=aspect; arrange(aspect); },
    update(time: number, reduced: boolean, scroll=0, coverage=1, arrival=0, whiteout=0) {
      uniforms.uTime.value=reduced?0:time;uniforms.uScroll.value=reduced?0:scroll;
      uniforms.uCoverage.value=coverage;uniforms.uArrival.value=reduced?0:arrival;uniforms.uWhiteout.value=whiteout;
    },
    dispose() { geometry.dispose(); plane.dispose(); sky.geometry.dispose(); skyMaterial.dispose(); cloudMaterial.dispose(); mist.geometry.dispose();mistMaterial.dispose();texture.dispose(); },
  };
}
