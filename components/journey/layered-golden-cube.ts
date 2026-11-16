import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createGoldenGlassCubeModel } from "./golden-glass-cube";

/** Adapt the Blender panels to the journey's existing reversible explode poses. */
export function createLayeredGoldenCubeModel() {
  const model = createGoldenGlassCubeModel();
  const names = ["right", "left", "top", "bottom", "front", "back"];
  const scale = 2.5 / 2.19;
  let loaded = false, disposed = false, opening = 0;
  const panelMaterials = new Set<THREE.Material>();
  const opticalSprites: THREE.Sprite[] = [];
  model.root.traverse(node => { if (node instanceof THREE.Sprite) opticalSprites.push(node); });
  const disposeObjects = (objects: THREE.Object3D[]) => {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    objects.forEach(object => object.traverse(node => {
      if (node instanceof THREE.Mesh) {
        geometries.add(node.geometry);
        (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => materials.add(material));
      }
    }));
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  };
  const update = (amount: number) => {
    panelMaterials.forEach(material => { material.opacity = 1; });
    opticalSprites.forEach(sprite => { sprite.visible = true; });
    const halo = model.root.getObjectByName("halo");
    if (halo) halo.visible = true;
    model.core.visible = true;
    model.faces.forEach(face => face.traverse(node => {
      if (node.name.startsWith("Hinge_")) node.quaternion.identity();
    }));
    opening = THREE.MathUtils.clamp(amount, 0, 1);
    model.update(opening);
    if (loaded) model.faces.forEach(face => {
      // Keep the original radial travel and tilt; match the new sealed shell's rest position.
      face.position.setLength(1.035 * scale + opening * 2.65);
    });
  };
  new GLTFLoader().load("/golden-cube/golden-cube.glb", gltf => {
    if (disposed) { disposeObjects([gltf.scene]); return; }
    const panels = names.map(name => gltf.scene.getObjectByName(`Face_${name}`));
    if (panels.some(panel => !panel)) {
      disposeObjects([gltf.scene]);
      console.error("Golden cube GLB is missing a face; keeping the fallback model.");
      return;
    }
    const oldPanels: THREE.Object3D[] = [];
    model.faces.forEach((face, i) => {
      for (const child of [...face.children]) {
        if (child instanceof THREE.Mesh || child.name.startsWith("rim-")) {
          face.remove(child); oldPanels.push(child);
        }
      }
      const content = new THREE.Group(); content.name = `layered-${names[i]}`;
      // Blender-exported face-local +Y is the original factory's face-local +Z.
      content.rotation.x = Math.PI / 2; content.scale.setScalar(scale);
      content.add(...[...panels[i]!.children]); face.add(content);
      content.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return;
        node.renderOrder = 101; node.castShadow = true; node.receiveShadow = true;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach(material => {
          panelMaterials.add(material);
          // Alpha stays one; this queue is required to render over the screen-space paper.
          material.transparent = true; material.opacity = 1; material.depthWrite = true;
          if (material instanceof THREE.MeshStandardMaterial) material.envMapIntensity = 1.15;
        });
      });
    });
    disposeObjects(oldPanels);
    loaded = true; model.root.userData.layeredAssetLoaded = true;
    update(opening);
  }, undefined, error => {
    if (!disposed) console.error("Failed to load layered golden cube", error);
  });
  const setHinges = (amount: number) => {
    update(0);
    model.core.visible = false;
    const halo = model.root.getObjectByName("halo");
    if (halo) halo.visible = amount < .02;
    model.faces.forEach(face => face.traverse(node => {
      if (node.name.startsWith("Hinge_")) {
        node.quaternion.setFromAxisAngle(new THREE.Vector3(...node.userData.open_axis_gltf), node.userData.open_angle_rad * amount);
      }
    }));
  };
  const reveal = (amount: number, opacity = 1) => {
    update(0);
    const a=THREE.MathUtils.clamp(amount,0,1);
    // Lift the lid, then unfold opposing walls around their lower edges.
    // Each face stays rigid; the bottom remains the box's supporting base.
    model.faces[2].position.y+=1.35*THREE.MathUtils.smoothstep(a,0,.40);
    for(const i of [4,5,0,1]){
      const fold=THREE.MathUtils.smoothstep(a,i<2?.35:.25,i<2?1:.85);
      const angle=fold*Math.PI/2, half=1.25;
      const face=model.faces[i], rest=face.quaternion.clone();
      const hingeTravel=new THREE.Vector3(0,half*(Math.cos(angle)-1),half*Math.sin(angle)).applyQuaternion(rest);
      face.position.add(hingeTravel);
      face.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),angle));
    }
    model.core.visible = false;
    opticalSprites.forEach(sprite => { sprite.visible = false; });
    panelMaterials.forEach(material => { material.opacity = opacity; });
    const halo = model.root.getObjectByName("halo");
    if (halo) halo.visible = false;
  };
  return { ...model, update, setHinges, reveal, dispose: () => { disposed = true; } };
}
