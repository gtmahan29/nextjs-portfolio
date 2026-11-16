import * as THREE from 'three';
import * as vsm from 'three/src/renderers/shaders/ShaderLib/vsm.glsl.js';
import type {SceneScope} from './scene-loading';
import {yieldToMain} from './scene-loading';
import {compileSceneInBatches} from './scene-warmup';

/** compileAsync normally excludes shadow-depth and VSM blur programs. */
export async function warmShowroom(renderer:THREE.WebGLRenderer,scene:THREE.Object3D,camera:THREE.Camera,scope:SceneScope,signal:AbortSignal,lighting:THREE.Scene=scene as THREE.Scene){
  const textures=new Set<THREE.Texture>();
  scene.traverse(o=>{if(o instanceof THREE.Mesh)for(const material of Array.isArray(o.material)?o.material:[o.material]){
    for(const value of Object.values(material))if(value instanceof THREE.Texture&&!value.isRenderTargetTexture)textures.add(value);
    if(material instanceof THREE.ShaderMaterial)for(const uniform of Object.values(material.uniforms))if(uniform.value instanceof THREE.Texture&&!uniform.value.isRenderTargetTexture)textures.add(uniform.value);
  }});
  for(const texture of Array.from(textures)){signal.throwIfAborted();renderer.initTexture(texture);await yieldToMain(signal);}
  const shadows=new THREE.Scene(),depths=new Map<THREE.Material,THREE.MeshDepthMaterial>();
  scene.traverse(object=>{
    if(!(object instanceof THREE.Mesh)||!object.castShadow&&!object.receiveShadow)return;
    const source=Array.isArray(object.material)?object.material[0]:object.material;
    let depth=depths.get(source);
    if(!depth){
      const side=source.shadowSide??(renderer.shadowMap.type===THREE.VSMShadowMap?source.side:source.side===THREE.FrontSide?THREE.BackSide:source.side===THREE.BackSide?THREE.FrontSide:THREE.DoubleSide);
      depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side,toneMapped:false});
      depth.clippingPlanes=source.clippingPlanes;depth.clipShadows=source.clipShadows;
      depth.clipIntersection=source.clipIntersection;
      const mapped=source as THREE.MeshStandardMaterial;
      depth.map=mapped.map??null;depth.alphaMap=mapped.alphaMap??null;depth.alphaTest=source.alphaTest;
      depths.set(source,depth);scope.defer(()=>depth!.dispose());
    }
    object.customDepthMaterial=depth;
    const proxy=object.clone(false);proxy.material=depth;shadows.add(proxy);
  });
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,.5,3,-1,.5,-1,3,.5],3));scope.defer(()=>geometry.dispose());
  const sampleCounts=new Set<number>();if(renderer.shadowMap.type===THREE.VSMShadowMap)lighting.traverse(o=>{if(o instanceof THREE.Light&&o.shadow)sampleCounts.add(o.shadow.blurSamples);});
  for(const samples of Array.from(sampleCounts))for(const horizontal of [false,true]){
    const blur=new THREE.ShaderMaterial({vertexShader:vsm.vertex,fragmentShader:vsm.fragment,defines:{VSM_SAMPLES:samples,...(horizontal?{HORIZONTAL_PASS:1}:{})},uniforms:{shadow_pass:{value:null},resolution:{value:new THREE.Vector2()},radius:{value:4}}});
    scope.defer(()=>blur.dispose());shadows.add(new THREE.Mesh(geometry,blur));
  }
  // Shadow passes render into a linear target without display tone mapping.
  const target=new THREE.WebGLRenderTarget(1,1);scope.defer(()=>target.dispose());
    await compileSceneInBatches(renderer,shadows,camera,lighting,signal,target);
    // Reflections render every surface again into a linear target. Those
    // programs differ from the display/tone-mapped variants even with identical lights.
    let hasReflection=false;lighting.traverse(object=>{if((object as THREE.Object3D & {isReflector?:boolean}).isReflector&&object.visible)hasReflection=true;});
    if(hasReflection)
      await compileSceneInBatches(renderer,scene,camera,lighting,signal,target);
  signal.throwIfAborted();await compileSceneInBatches(renderer,scene,camera,lighting,signal);signal.throwIfAborted();
}
