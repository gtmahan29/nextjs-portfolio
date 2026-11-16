import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export const PROCESS_PANEL_NAMES = ["IDEA", "STRATEGY", "DESIGN", "BUILD", "SYSTEM", "PRODUCT"] as const;
const normals = [new THREE.Vector3(0,0,1), new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,-1), new THREE.Vector3(-1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0)];
export const CLOSED_POSES = normals.map(normal => ({
  position: normal.clone().multiplyScalar(1.1),
  quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), normal),
}));
let source: Promise<THREE.Group> | undefined;
export function preloadHolographicProcessCube() {
  if (!source) source = new GLTFLoader().loadAsync("/holographic-process/holographic-process.glb?v=process-panels-6").then(gltf => {
    gltf.scene.updateMatrixWorld(true);
    PROCESS_PANEL_NAMES.forEach(name => {
      if (!gltf.scene.getObjectByName(`Face_${name}`)) throw new Error(`Missing holographic panel: ${name}`);
    });
    return gltf.scene;
  }).catch(error => { source = undefined; throw error; });
  return source;
}

/** Independent face rigs share the hero's exact assembly poses and the journey's unfold contract. */
export function createHolographicProcessCube() {
  const root = new THREE.Group(); root.name = "Holographic process cube";
  const panels = PROCESS_PANEL_NAMES.map(name => { const panel = new THREE.Group(); panel.name = `Panel_${name}`; root.add(panel); return panel; });
  // A continuous support volume closes the gaps left by the six rounded face corners.
  const core = new THREE.Mesh(new RoundedBoxGeometry(1.87,1.87,1.87,2,.015), new THREE.MeshPhysicalMaterial({
    color: "#dceeff", metalness: .26, roughness: .16, clearcoat: 1, clearcoatRoughness: .035,
    iridescence: .55, iridescenceIOR: 1.34, iridescenceThicknessRange: [140,400],
    emissive: "#73cfff", emissiveIntensity: .035, envMapIntensity: 1.2,
    transparent: true, opacity: 1,
  }));
  core.name = "Sealed pearlescent support"; root.add(core);
  let disposed = false, opening = 0;
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>([core.geometry]);
  const textures = new Set<THREE.Texture>();
  materials.add(core.material);
  function update(value: number) {
    opening = THREE.MathUtils.clamp(value,0,1);
    core.visible = true; core.scale.setScalar(1-opening*.12);
    materials.forEach(material => {material.opacity=1;});
    panels.forEach((panel,index) => {
      panel.position.copy(CLOSED_POSES[index].position).addScaledVector(normals[index],opening*2.65);
      panel.quaternion.copy(CLOSED_POSES[index].quaternion);
    });
  }
  const ready = preloadHolographicProcessCube().then(template => {
    if (disposed) return;
    const loaded = template.clone(true);
    loaded.updateMatrixWorld(true);
    const materialCopies = new Map<THREE.Material,THREE.Material>();
    const textureCopies = new Map<THREE.Texture,THREE.Texture>();
    const geometryCopies = new Map<THREE.BufferGeometry,THREE.BufferGeometry>();
    panels.forEach((panel,index) => {
      const content = loaded.getObjectByName(`Face_${PROCESS_PANEL_NAMES[index]}`)!;
      const normalized = new THREE.Group();
      // attach retains Blender's exporter basis, including the root's axis conversion.
      normalized.attach(content); panel.add(normalized);
      content.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return;
        if (!geometryCopies.has(node.geometry)) {const geometry=node.geometry.clone();geometryCopies.set(node.geometry,geometry);geometries.add(geometry);}
        node.geometry = geometryCopies.get(node.geometry)!;
        const copyMaterial = (original: THREE.Material) => {
          if (materialCopies.has(original)) return materialCopies.get(original)!;
          const reference=original.name.includes('reference_optical_relief')||original.name.includes('reference optical relief');
          const material = reference && original instanceof THREE.MeshStandardMaterial
            ? new THREE.MeshBasicMaterial({map:original.emissiveMap??original.map,alphaTest:.025,toneMapped:false})
            : original.clone();
          // The journey's screen-space paper uses the transparent queue.
          // Keep opacity solid while drawing the artifact after that backdrop.
          material.transparent=true;material.opacity=1;material.depthWrite=true;
          for (const [key,value] of Object.entries(material)) if (value instanceof THREE.Texture) {
            if (!textureCopies.has(value)) {const texture=value.clone();
              // Scene cleanup may close ImageBitmaps. Every rig owns its upload source.
              if(typeof ImageBitmap!=="undefined"&&value.image instanceof ImageBitmap){
                const canvas=document.createElement("canvas");canvas.width=value.image.width;canvas.height=value.image.height;
                canvas.getContext("2d")!.drawImage(value.image,0,0);texture.source=new THREE.Source(canvas);
              }
              texture.anisotropy=8;texture.needsUpdate=true;textureCopies.set(value,texture);textures.add(texture);}
            (material as unknown as Record<string,unknown>)[key] = textureCopies.get(value)!;
          }
          if (material instanceof THREE.MeshStandardMaterial) {
            material.envMapIntensity = .7;
            material.roughness = Math.min(material.roughness,.22);
          }
          if (material instanceof THREE.MeshPhysicalMaterial) {
            const optical=/glass|frame/i.test(material.name);
            material.clearcoat=optical?1:.18; material.clearcoatRoughness=optical?.035:.16;
            material.transmission=optical?Math.min(material.transmission,.12):0;
            material.iridescence=optical?.35:0;
            material.emissiveIntensity=optical?.08:.025;
          }
          if(material.name.includes('reference_optical_relief')||material.name.includes('reference optical relief')){
            material.toneMapped=false;material.alphaTest=.025;
            if(material instanceof THREE.MeshStandardMaterial){material.color.setHex(0x000000);material.emissive.setHex(0xffffff);material.emissiveIntensity=1;material.envMapIntensity=0;}
          }
          materialCopies.set(original,material);materials.add(material);return material;
        };
        node.material = Array.isArray(node.material) ? node.material.map(copyMaterial) : copyMaterial(node.material);
        node.castShadow = true;node.receiveShadow = true;node.renderOrder = 101;
      });
    });
    const frameMaterial=Array.from(materials).find(value=>/rolled.frame/i.test(value.name));
    if(frameMaterial instanceof THREE.MeshStandardMaterial&&frameMaterial.map){core.material.map=frameMaterial.map;core.material.color.setHex(0xffffff);core.material.needsUpdate=true;}
    root.userData.layeredAssetLoaded=true; update(opening);
  });
  function reveal(amount: number, opacity=1) {
    update(0);core.visible=false;
    const a=THREE.MathUtils.clamp(amount,0,1);
    panels[4].position.y += 1.5*THREE.MathUtils.smoothstep(a,0,.4);
    [0,2,1,3].forEach((index,order) => {
      const angle=THREE.MathUtils.smoothstep(a,order<2?.22:.35,order<2?.85:1)*Math.PI/2;
      const rest=CLOSED_POSES[index].quaternion;
      panels[index].position.add(new THREE.Vector3(0,1.1*(Math.cos(angle)-1),1.1*Math.sin(angle)).applyQuaternion(rest));
      panels[index].quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),angle));
    });
    materials.forEach(material => {material.opacity=opacity;});
  }
  update(0);
  return {root,panels,faces:panels,core,ready,update,reveal,dispose() {
    if(disposed)return;disposed=true;geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());textures.forEach(texture=>texture.dispose());
  }};
}

