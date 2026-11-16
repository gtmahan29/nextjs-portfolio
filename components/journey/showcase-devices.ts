import * as THREE from "three";
import { createImportedMacbook } from "./imported-models/devices/macbook";
import { createImportedIphone } from "./imported-models/devices/iphone";

export type DeviceKind = "macbook" | "iphone" | "ipad";
export type DeviceScreenContent =
  | { type: "html"; mount: (element: HTMLElement) => (() => void) | void }
  | { type: "video"; src: string; poster?: string }
  | { type: "image"; src: string; alt: string };

export function mountDeviceContent(element: HTMLElement, content: DeviceScreenContent) {
  if (content.type === "html") return content.mount(element) || (() => {});
  const media = document.createElement(content.type === "video" ? "video" : "img");
  media.src = content.src;
  if (media instanceof HTMLVideoElement && content.type === "video") {
    media.controls = true; media.playsInline = true; media.preload = "none";
    if (content.poster) media.poster = content.poster;
  } else if (media instanceof HTMLImageElement && content.type === "image") media.alt = content.alt;
  media.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
  media.style.objectFit = content.type === "video" ? "contain" : "cover";
  element.replaceChildren(media);
  return () => { if (media instanceof HTMLVideoElement) { media.pause(); media.removeAttribute("src"); media.load(); } element.replaceChildren(); };
}

/** The supplied models are normalized to the existing showcase platforms. */
export function createShowcaseDevice(kind: DeviceKind, options:{loadDisplay?:boolean;hover?:boolean}={}) {
  const source = kind === "iphone" ? createImportedIphone(options.loadDisplay!==false) : createImportedMacbook(options.loadDisplay!==false);
  const group = new THREE.Group();
  const modelScale = kind === "iphone" ? .4 : .67;
  source.group.position.set(0,kind === "iphone" ? 0 : -.74,0);
  source.group.scale.setScalar(modelScale);
  group.add(source.group);
  const screen = source.screen;
  const screenWidth = kind === "iphone" ? 1.89 : 3.25;
  const screenHeight = kind === "iphone" ? 4.015 : 1.94;
  const radius = kind === "iphone" ? .25 : .027;
  // Illuminate the actual chassis, without wireframes or another silhouette.
  const hoverUniforms = { strength: { value: 0 }, time: { value: 0 } };
  const surfaceMaterials = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  if(options.hover!==false)
  source.group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const apply = (original: THREE.Material) => {
      if (!(original instanceof THREE.MeshStandardMaterial)) return original;
      let material = surfaceMaterials.get(original);
      if (material) return material;
      material = original.clone();
      material.onBeforeCompile = shader => {
        shader.uniforms.deviceHover = hoverUniforms.strength;
        shader.uniforms.deviceTime = hoverUniforms.time;
        shader.fragmentShader = "uniform float deviceHover; uniform float deviceTime;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", `
          float facing = abs(dot(normalize(normal), normalize(vViewPosition)));
          float rim = pow(1.0 - facing, 2.0);
          float sweep = exp(-pow((vViewPosition.x + .65 * vViewPosition.y - sin(deviceTime * .9) * 2.8) * 2.2, 2.0));
          outgoingLight += vec3(.06, .34, .6) * deviceHover * (.13 + .55 * rim + .7 * sweep);
          #include <opaque_fragment>
        `);
      };
      material.customProgramCacheKey = () => "device-surface-hover-v1";
      surfaceMaterials.set(original, material);
      return material;
    };
    object.material = Array.isArray(object.material) ? object.material.map(apply) : apply(object.material);
  });
  group.updateMatrixWorld(true);
  const screenLocalPosition = new THREE.Vector3();
  const screenLocalQuaternion = new THREE.Quaternion();
  screen.matrixWorld.decompose(screenLocalPosition, screenLocalQuaternion, new THREE.Vector3());
  const material = screen.material as THREE.MeshBasicMaterial;
  const displayTexture = material.map!;
  const displaySrc = `/models/showcase-devices/${kind === "iphone" ? "iphone" : "macbook"}-display.png`;
  return {group,screen,screenWidth,screenHeight,screenRadius:radius,kind,hoverUniforms,screenLocalPosition,screenLocalQuaternion,modelScale,displayTexture,displaySrc};
}

