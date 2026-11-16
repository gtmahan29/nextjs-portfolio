import * as THREE from "three";
import { buildRiggedModel, decodeFloats, type EncodedModel, type EncodedRig, type RiggedModel } from "./meshCodec";

type SoraPayload = { model: EncodedModel; stream: string; rig: EncodedRig; uv: string };
function disposeMeshes(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
  });
  geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
}

/** Render the supplied, animated Sora rig as a responsive, cursor-aware hero bust. */
export async function mountSoraHero(host: HTMLElement, signal?: AbortSignal) {
  if (signal?.aborted) return { dispose() {} };
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.domElement.className = "sora-hero-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xf5f8ff, 0x77869b, 2.05));
  const key = new THREE.DirectionalLight(0xffeddc, 3.05); key.position.set(-2.8, 5.4, 4.4); scene.add(key);
  const fill = new THREE.DirectionalLight(0xabc8ee, 1.55); fill.position.set(4.5, 2.8, 2.2); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xfafcff, 2.1); rim.position.set(-1, 3, -4); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(25, 1, .1, 60);
  camera.position.set(-.24, 1.55, 3.2); camera.lookAt(-.24, 1.55, 0);

  let rig: RiggedModel | undefined, disposed = false, raf = 0;
  const loadedTextures: THREE.Texture[] = [];
  const controller = new AbortController();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", () => controller.abort(), { once: true });
  let targetX = 0, targetY = 0, gazeX = 0, gazeY = 0, poseX = 0, poseY = 0, last = performance.now();
  let head: THREE.Bone | undefined, neck: THREE.Bone | undefined, eyes: THREE.Group | undefined;
  const headRest = new THREE.Quaternion(), neckRest = new THREE.Quaternion();
  const pointerMove = (event: PointerEvent) => {
    const bounds = host.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    targetX = THREE.MathUtils.clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1);
    targetY = THREE.MathUtils.clamp((event.clientY - bounds.top) / bounds.height * 2 - 1, -1, 1);
  };
  const pointerLeave = () => { targetX = 0; targetY = 0; };
  host.addEventListener("pointermove", pointerMove);
  host.addEventListener("pointerleave", pointerLeave);

  let data: SoraPayload;
  let maps: THREE.Texture[];
  try {
    const response = await fetch("/models/journey/sora.json", { signal: controller.signal });
    if (!response.ok) throw new Error(`Sora hero model: HTTP ${response.status}`);
    data = await response.json() as SoraPayload;
    maps = await Promise.all(["albedo", "normal", "orm"].map(async name => {
      const texture = await new THREE.TextureLoader().loadAsync(`/models/journey/sora-${name}.jpg`);
      loadedTextures.push(texture); texture.flipY = false; texture.anisotropy = 4;
      texture.colorSpace = name === "albedo" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      return texture;
    }));
  } catch (error) {
    controller.abort(); loadedTextures.forEach(texture => texture.dispose());
    host.removeEventListener("pointermove", pointerMove); host.removeEventListener("pointerleave", pointerLeave);
    renderer.dispose(); renderer.domElement.remove();
    throw error;
  }
  if (disposed) { maps.forEach(texture => texture.dispose()); renderer.dispose(); return { dispose() {} }; }

  rig = buildRiggedModel(data.model, data.stream, data.rig, { castShadow: false, receiveShadow: false });
  const uv = decodeFloats(data.uv);
  if (uv.length !== rig.mesh.geometry.getAttribute("position").count * 2) throw new Error("Sora hero UV data does not match its surface");
  rig.mesh.geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  const material = rig.mesh.material as THREE.MeshStandardMaterial;
  material.vertexColors = false; material.color.set(0xffffff);
  material.map = maps[0]; material.normalMap = maps[1]; material.normalScale.set(.32, .32);
  material.roughnessMap = maps[2]; material.metalnessMap = maps[2]; material.roughness = 1; material.metalness = 1;
  // The source mesh's skin is stored in its rig's local basis; keep the full shell
  // until its skinned world-space chest plane can be measured in that basis.
  material.clippingPlanes = [];
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <metalnessmap_fragment>",
      "#include <metalnessmap_fragment>\nroughnessFactor = max(roughnessFactor, mix(0.12, 0.52, 1.0 - smoothstep(0.05, 0.25, metalnessFactor)));");
  };
  material.customProgramCacheKey = () => "sora-hero-reference-finish"; material.needsUpdate = true;
  rig.play("preset:biped:idle", 0);
  scene.add(rig.group); rig.update(0); scene.updateMatrixWorld(true);
  rig.group.rotation.y = -Math.PI / 2;
  rig.group.scale.setScalar(1.02);

  head = rig.mesh.skeleton.bones.find(bone => bone.name === "Head");
  neck = rig.mesh.skeleton.bones.find(bone => bone.name === "NeckTwist02");
  if (head) headRest.copy(head.quaternion);
  if (neck) neckRest.copy(neck.quaternion);
  // Small, separately aimable irises sit over the source face; their positions are
  // derived from vertices actually weighted to the source head, not guessed in world space.
  if (head) {
    const positions = rig.mesh.geometry.getAttribute("position");
    const skinIndices = rig.mesh.geometry.getAttribute("skinIndex");
    const skinWeights = rig.mesh.geometry.getAttribute("skinWeight");
    const headIndex = rig.mesh.skeleton.bones.indexOf(head), inverseHead = new THREE.Matrix4();
    rig.mesh.updateWorldMatrix(true, true); head.updateWorldMatrix(true, false); inverseHead.copy(head.matrixWorld).invert();
    const headSpace: THREE.Vector3[] = [];
    const vertex = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      let influence = 0;
      for (let slot = 0; slot < 4; slot++) if (skinIndices.getComponent(i, slot) === headIndex) influence += skinWeights.getComponent(i, slot);
      if (influence < .45) continue;
      vertex.fromBufferAttribute(positions, i); rig.mesh.applyBoneTransform(i, vertex);
      vertex.applyMatrix4(rig.mesh.matrixWorld).applyMatrix4(inverseHead);
      headSpace.push(vertex.clone());
    }
    if (headSpace.length) {
      const bounds = new THREE.Box3().setFromPoints(headSpace), size = bounds.getSize(new THREE.Vector3());
      const eyeY = bounds.min.y + size.y * .59, eyeZ = bounds.max.z + size.z * .018;
      eyes = new THREE.Group(); eyes.name = "Sora cursor-following eyes"; head.add(eyes);
      const white = new THREE.MeshBasicMaterial({ color: 0xf4f5ed });
      const iris = new THREE.MeshBasicMaterial({ color: 0x526f8c });
      const pupil = new THREE.MeshBasicMaterial({ color: 0x18232f });
      const glint = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const separation = size.x * .205, radius = Math.max(.009, Math.min(size.x * .079, size.y * .047));
      for (const side of [-1, 1]) {
        const eye = new THREE.Group(); eye.position.set(side * separation, eyeY, eyeZ + .004); eyes.add(eye);
        const sclera = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.55, 16, 12), white); sclera.scale.set(1.3, .76, .34); eye.add(sclera);
        const colored = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), iris); colored.scale.set(1.08, 1.08, .42); eye.add(colored);
        const dark = new THREE.Mesh(new THREE.SphereGeometry(radius * .47, 14, 10), pupil); dark.scale.z = .43; dark.position.z = radius * .44; eye.add(dark);
        const shine = new THREE.Mesh(new THREE.SphereGeometry(radius * .17, 10, 8), glint); shine.position.set(-radius * .24, radius * .2, radius * .55); eye.add(shine);
      }
    }
  }

  const resize = () => {
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  let inView = true;
  const visibility = new IntersectionObserver(entries => { inView = entries[0]?.isIntersecting ?? false; });
  visibility.observe(host);
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (!inView || document.hidden) { last = now; return; }
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    rig?.update(dt);
    const blend = 1 - Math.exp(-dt * 5.6);
    poseX += (targetX * .28 - poseX) * blend; poseY += (-targetY * .15 - poseY) * blend;
    gazeX += (targetX * .095 - gazeX) * blend; gazeY += (-targetY * .045 - gazeY) * blend;
    if (head) head.quaternion.copy(headRest).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(poseY, poseX, 0, "YXZ")));
    if (neck) neck.quaternion.copy(neckRest).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(poseY * .27, poseX * .23, 0, "YXZ")));
    if (eyes) { eyes.position.x = gazeX; eyes.position.y = gazeY; }
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);
  return {
    dispose() {
      disposed = true; controller.abort(); cancelAnimationFrame(raf); observer.disconnect(); visibility.disconnect();
      host.removeEventListener("pointermove", pointerMove); host.removeEventListener("pointerleave", pointerLeave);
      if (rig) { rig.mixer.stopAllAction(); rig.mixer.uncacheRoot(rig.mesh); rig.mesh.skeleton.dispose(); disposeMeshes(rig.group); }
      loadedTextures.forEach(texture => texture.dispose()); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
