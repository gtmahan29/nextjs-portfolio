import * as THREE from "three";

/** Runtime controls for the Blender-authored Opal 65 GLB. */
export function createOpalKeyboardRig(root: THREE.Object3D) {
  type CapState={material:THREE.MeshStandardMaterial;color:THREE.Color;emissive:THREE.Color;intensity:number;contact:{value:number}};
  const keys = new Map<string, { node: THREE.Object3D; rest: number; travel: number; caps:CapState[]; tint:THREE.Color }>();
  const keyMaterials=new Set<THREE.MeshStandardMaterial>();
  const rgb = new Map<string, { material: THREE.MeshStandardMaterial; color: THREE.Color; strength: number }>();
  root.traverse(node => {
    if (node.name.startsWith("Key_")) keys.set(node.name.slice(4), {
      node, rest: node.position.y, travel: Number(node.userData.travel ?? .105),caps:[],
      tint:new THREE.Color('#589ee9').lerp(new THREE.Color('#9a73dc'),THREE.MathUtils.clamp((node.position.x+8)/16,0,1)),
    });
    if (!(node instanceof THREE.Mesh)) return;
    const assign = (material: THREE.Material) => {
      if (!(material instanceof THREE.MeshStandardMaterial) || !material.name.startsWith("RGB_")) return material;
      const existing = rgb.get(material.uuid);
      if (existing) return existing.material;
      const copy = material.clone();
      // Read the authored on-state explicitly; GLB export can otherwise bake a dim driver value.
      const authored = material.userData.rgb_color as number[] | undefined;
      const color = authored?.length === 3 ? new THREE.Color().setRGB(authored[0],authored[1],authored[2]) : copy.emissive.clone();
      copy.emissive.copy(color);
      rgb.set(material.uuid, { material: copy, color, strength: Number(material.userData.rgb_strength ?? 1.5)*.72 });
      return copy;
    };
    node.material = Array.isArray(node.material) ? node.material.map(assign) : assign(node.material);
  });
  keys.forEach(key=>{
    key.node.traverse(object=>{
      if(!(object instanceof THREE.Mesh)||!object.name.startsWith('Cap_'))return;
      const clone=(material:THREE.Material)=>{
        if(!(material instanceof THREE.MeshStandardMaterial))return material;
        const copy=material.clone(),contact={value:0};copy.userData.rgbWashUniform=material.userData.rgbWashUniform;
        copy.onBeforeCompile=(shader,renderer)=>{
          material.onBeforeCompile(shader,renderer);
          shader.uniforms.uKeyContact=contact;shader.uniforms.uKeyTint={value:key.tint};
          shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uKeyContact;\nuniform vec3 uKeyTint;').replace('#include <alphatest_fragment>','diffuseColor.rgb=mix(diffuseColor.rgb,uKeyTint*.62,uKeyContact*.45);\n#include <alphatest_fragment>');
        };
        copy.customProgramCacheKey=()=>material.customProgramCacheKey()+'-key-contact';
        keyMaterials.add(copy);key.caps.push({material:copy,color:copy.color.clone(),emissive:copy.emissive.clone(),intensity:copy.emissiveIntensity,contact});return copy;
      };
      object.material=Array.isArray(object.material)?object.material.map(clone):clone(object.material);
    });
  });
  const washes = new Set<{ value: number }>();
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      const uniform = material.userData.rgbWashUniform as { value: number } | undefined;
      if (uniform) washes.add(uniform);
    }
  });
  const off = new THREE.Color(.60, .72, .86);
  let value = 1, target = 1;
  return {
    /** Damped illumination change; call update from the viewer's existing render loop. */
    setRGB(enabled: boolean) { target = enabled ? 1 : 0; },
    update(dt: number) {
      value += (target - value) * (1 - Math.exp(-Math.max(0, dt) / .12));
      if (Math.abs(target - value) < .0001) value = target;
      washes.forEach(uniform => { uniform.value = value; });
      rgb.forEach(({ material, color, strength }) => {
        material.color.copy(off).lerp(color, value);
        material.emissiveIntensity = strength * value;
      });
      return value !== target;
    },
    /** 0 = rest, 1 = full physical travel. Legends and sockets follow their key root. */
    press(code: string, amount: number) {
      const key = keys.get(code);
      if (!key)return;
      const press=THREE.MathUtils.clamp(amount,0,1);
      key.node.position.y=key.rest-key.travel*press;
      key.caps.forEach(cap=>{
        cap.contact.value=press;
        cap.material.color.copy(cap.color).lerp(key.tint,press*.35);
        cap.material.emissive.copy(cap.emissive).lerp(key.tint,press);
        cap.material.emissiveIntensity=cap.intensity+press*.12;
      });
    },
    resetKeys() { keys.forEach(key => { key.node.position.y = key.rest;key.caps.forEach(cap=>{cap.contact.value=0;cap.material.color.copy(cap.color);cap.material.emissive.copy(cap.emissive);cap.material.emissiveIntensity=cap.intensity;}); }); },
    dispose() { rgb.forEach(({ material }) => material.dispose());keyMaterials.forEach(material=>material.dispose()); },
  };
}
