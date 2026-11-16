import * as THREE from 'three';

/** Matte reference irradiance with nearby foliage shadows; no unused PBR BRDF. */
export function createReferencePaint(irradiance) {
  const shadowMask=THREE.ShaderChunk.shadowmask_pars_fragment.replace(/#if NUM_DIR_LIGHT_SHADOWS > 0[\s\S]*?#endif/, '');
  return new THREE.ShaderMaterial({
    lights:true,clipping:true,
    uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.lights,{irradiance:{value:irradiance}}]),
    vertexShader:`
      #include <common>
      #ifndef USE_UV1
      attribute vec2 uv1;
      #endif
      varying vec2 vSurfaceUv;
      #include <shadowmap_pars_vertex>
      #include <clipping_planes_pars_vertex>
      void main(){
        vSurfaceUv=uv1;
        vec3 transformedNormal=normalMatrix*normal;
        vec4 worldPosition=modelMatrix*vec4(position,1.0);
        vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
        gl_Position=projectionMatrix*mvPosition;
        #include <shadowmap_vertex>
        #include <clipping_planes_vertex>
      }`,
    fragmentShader:`
      #include <common>
      #include <packing>
      uniform sampler2D irradiance;
      uniform bool receiveShadow;
      varying vec2 vSurfaceUv;
      #include <shadowmap_pars_fragment>
      #include <clipping_planes_pars_fragment>
      ${shadowMask}
      void main(){
        #include <clipping_planes_fragment>
        gl_FragColor=vec4(texture2D(irradiance,vSurfaceUv).rgb*(8.0*.96/PI)*mix(1.0,getShadowMask(),.10),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
