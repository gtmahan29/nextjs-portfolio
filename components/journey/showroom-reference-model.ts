import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  materialMaps?: boolean;
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [clampAlbedoChannel((value >> 16) & 255), clampAlbedoChannel((value >> 8) & 255), clampAlbedoChannel(value & 255)];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampAlbedoChannel(value: number): number {
  return Math.max(30, Math.min(240, Math.round(value)));
}

function clampPbrF0(value: number): number {
  return Math.max(0.02, Math.min(1, value));
}

function clampPbrIor(value: number): number {
  return Math.max(1, Math.min(2.5, value));
}

function clampPbrMetalness(value: number): number {
  return value >= 0.5 ? 1 : 0;
}

function clampedAlbedoColor(spec: SculptMaterialSpec): THREE.Color {
  const source = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  // setStyle with an explicit SRGBColorSpace, NOT the numeric constructor.
  //
  // `new THREE.Color(r, g, b)` treats its arguments as LINEAR working-space components,
  // while an authored `baseColor` hex is sRGB. Feeding one to the other skipped the
  // transfer function and lifted every dark albedo: #2e2a28, authored as a near-black
  // vinyl, rendered at roughly sRGB 0.46 — a mid grey. The error is largest exactly where
  // it matters most, because the transfer curve is steepest near black.
  return new THREE.Color().setStyle(source, THREE.SRGBColorSpace);
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions, denseComponent = false): THREE.MeshPhysicalMaterial {
  // A material that declares -- with evidence -- that its subject carries no texture
  // detail gets NO texture set. Synthesising one anyway is not a harmless default: the
  // branch below then forces color to white and roughness to 1 and reads both from the
  // generated maps, so the authored albedo and the reference-derived roughness are both
  // discarded, and the model gains mottling the reference does not have. Measured on the
  // tuxedo cat, whose black fur rendered as speckled grey-and-white from a palette that
  // only ever described two flat regions.
  const textureless = (spec.textureless as { declared?: boolean } | undefined)?.declared === true;
  const textures = textureless || options.materialMaps === false || typeof document === 'undefined'
    ? null
    : makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ['base', 'value'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === 'dense' || spec.topologyClass === 'dense';
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(0.005, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Ivory illuminated architectural showroom
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createIvoryIlluminatedArchitecturalShowroomModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Ivory illuminated architectural showroom";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 48, "aspect": 1.7768331562167907, "orientation": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}, "positionHint": [0, 2.8, 11.5], "note": "Estimated from podium ellipse and horizontal deck edge; confirm in render, not calibrated camera recovery."}, "approximationNotes": []};
  root.userData.materialPipeline = {};
  root.userData.materialReferenceRegistry = null;

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["plaster"] = createSculptMaterial(
    "plaster",
    {"id": "plaster", "name": "plaster", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#e9e0d4", "color": "#e9e0d4", "albedo": {"dominant": "#EDD9C3", "secondary": ["#E7D3BF", "#F4DFC8", "#E0CCBA"], "samplingNotes": "Reference-derived from foreground pixels; de-lit to reduce baked shadows/highlights.", "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\plaster\\plaster_albedo.png", "url": "plaster_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}}, "colorVariation": {"palette": ["#EDD9C3", "#E7D3BF", "#F4DFC8", "#E0CCBA", "#FBE7CF"], "pattern": "reference-derived pixel palette", "amplitude": 0.08, "heightCorrelation": 0.42}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.321, "role": "reference-derived broad albedo and height breakup"}, {"id": "meso", "frequency": 14.0, "amplitude": 0.219, "role": "reference-derived cracks, ridges, pores, grain, or leaf clusters"}, {"id": "micro", "frequency": 72.0, "amplitude": 0.094, "role": "reference-derived micro highlight breakup under grazing light"}], "roughness": {"base": 0.68, "variation": 0.05, "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\plaster\\plaster_roughness.png", "url": "plaster_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "localResponse": "reference-derived roughness estimate; cavities and textured zones trend rougher, bright highlights trend smoother"}, "metalness": {"base": 0, "variation": 0.0}, "normal": {"pattern": "reference-derived height-gradient normal map", "strength": 0.175, "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\plaster\\plaster_normal.png", "url": "plaster_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "heightSource": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\plaster\\plaster_height.png", "url": "plaster_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "space": "tangent"}, "bump": {"pattern": "reference-derived height field", "amplitude": 0.01, "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\plaster\\plaster_height.png", "url": "plaster_height.png", "channel": "height", "source": "reference-pixel-extraction"}}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.38, "contactShadowBias": 0.35, "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\plaster\\plaster_ao.png", "url": "plaster_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}, "notes": "Reference-derived cavity estimate from local height minima; verify against grazing-light screenshot."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "plaster-finish", "region": "full surface", "roughness": 0.82, "description": "Independent fine grain height and roughness, no baked light", "evidenceRefs": ["full-object"]}, {"id": "reference-pbr-pixel-evidence", "type": "material-map-evidence", "evidenceRefs": ["full-object"], "channels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "notes": "Use generated maps as material evidence, then refine after browser screenshot comparison."}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there.", "Reference-derived maps are estimates from image pixels; verify with neutral, grazing, and reference-matched renders.", "Do not treat baked image shadows as final albedo; rerun extraction with a tighter material crop if highlights/shadows pollute the maps."], "notes": "Observed finish; illumination separated from albedo.", "referencePbr": {"version": "1.0", "sourceImage": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\plaster-crop.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.828, "estimatedFidelity": 0.828, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\plaster\\plaster_albedo.png", "url": "plaster_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\plaster\\plaster_roughness.png", "url": "plaster_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\plaster\\plaster_height.png", "url": "plaster_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\plaster\\plaster_normal.png", "url": "plaster_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\plaster\\plaster_ao.png", "url": "plaster_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 550, "sourceHeight": 510, "mapSize": 1024, "cropBBoxPixels": {"x": 0, "y": 0, "width": 550, "height": 506}, "mask": {"backgroundColor": "#FEF8E5", "backgroundNoise": 68.877, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.1651}, "mapStats": {"valueRange": 0.1162, "heightP90Gradient": 0.01641, "roughnessBase": 0.68, "roughnessVariation": 0.05, "normalStrength": 0.175, "blurRadius": 21}, "palette": ["#EDD9C3", "#E7D3BF", "#F4DFC8", "#E0CCBA", "#FBE7CF"]}, "warnings": ["single-image inverse rendering cannot prove true physical PBR; confidence is capped", "low value range weakens height/roughness inference"]}},
    options
  );
  materialMap["stone"] = createSculptMaterial(
    "stone",
    {"id": "stone", "name": "stone", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#ece7df", "color": "#ece7df", "albedo": {"dominant": "#E1CAB4", "secondary": ["#D4BFAC", "#ECD5BC", "#F7E2C8"], "samplingNotes": "Reference-derived from foreground pixels; de-lit to reduce baked shadows/highlights.", "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\stone\\stone_albedo.png", "url": "stone_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}}, "colorVariation": {"palette": ["#E1CAB4", "#D4BFAC", "#ECD5BC", "#F7E2C8", "#C2AE9D"], "pattern": "reference-derived pixel palette", "amplitude": 0.085, "heightCorrelation": 0.42}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.351, "role": "reference-derived broad albedo and height breakup"}, {"id": "meso", "frequency": 14.0, "amplitude": 0.341, "role": "reference-derived cracks, ridges, pores, grain, or leaf clusters"}, {"id": "micro", "frequency": 72.0, "amplitude": 0.14, "role": "reference-derived micro highlight breakup under grazing light"}], "roughness": {"base": 0.68, "variation": 0.084, "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\stone\\stone_roughness.png", "url": "stone_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "localResponse": "reference-derived roughness estimate; cavities and textured zones trend rougher, bright highlights trend smoother"}, "metalness": {"base": 0, "variation": 0.0}, "normal": {"pattern": "reference-derived height-gradient normal map", "strength": 0.21, "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\stone\\stone_normal.png", "url": "stone_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "heightSource": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\stone\\stone_height.png", "url": "stone_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "space": "tangent"}, "bump": {"pattern": "reference-derived height field", "amplitude": 0.021, "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\stone\\stone_height.png", "url": "stone_height.png", "channel": "height", "source": "reference-pixel-extraction"}}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.38, "contactShadowBias": 0.35, "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\stone\\stone_ao.png", "url": "stone_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}, "notes": "Reference-derived cavity estimate from local height minima; verify against grazing-light screenshot."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "stone-finish", "region": "full surface", "roughness": 0.28, "description": "Independent fine grain height and roughness, no baked light", "evidenceRefs": ["full-object"]}, {"id": "reference-pbr-pixel-evidence", "type": "material-map-evidence", "evidenceRefs": ["full-object"], "channels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "notes": "Use generated maps as material evidence, then refine after browser screenshot comparison."}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there.", "Reference-derived maps are estimates from image pixels; verify with neutral, grazing, and reference-matched renders.", "Do not treat baked image shadows as final albedo; rerun extraction with a tighter material crop if highlights/shadows pollute the maps."], "notes": "Observed finish; illumination separated from albedo.", "referencePbr": {"version": "1.0", "sourceImage": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\stone-crop.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.84, "estimatedFidelity": 0.84, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\stone\\stone_albedo.png", "url": "stone_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\stone\\stone_roughness.png", "url": "stone_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\stone\\stone_height.png", "url": "stone_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\stone\\stone_normal.png", "url": "stone_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\stone\\stone_ao.png", "url": "stone_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 1672, "sourceHeight": 235, "mapSize": 1024, "cropBBoxPixels": {"x": 22, "y": 0, "width": 1650, "height": 235}, "mask": {"backgroundColor": "#E7D5C3", "backgroundNoise": 71.617, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.2127}, "mapStats": {"valueRange": 0.2031, "heightP90Gradient": 0.04557, "roughnessBase": 0.68, "roughnessVariation": 0.084, "normalStrength": 0.21, "blurRadius": 21}, "palette": ["#E1CAB4", "#D4BFAC", "#ECD5BC", "#F7E2C8", "#C2AE9D"]}, "warnings": ["single-image inverse rendering cannot prove true physical PBR; confidence is capped", "low value range weakens height/roughness inference"]}},
    options
  );
  materialMap["champagne"] = createSculptMaterial(
    "champagne",
    {"id": "champagne", "name": "champagne", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#c8a979", "color": "#c8a979", "albedo": {"dominant": "#CFAF89", "secondary": ["#D7BC9E", "#D4AC7B", "#DAB282"], "samplingNotes": "Reference-derived from foreground pixels; de-lit to reduce baked shadows/highlights.", "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\champagne\\champagne_albedo.png", "url": "champagne_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}}, "colorVariation": {"palette": ["#CFAF89", "#D7BC9E", "#D4AC7B", "#DAB282", "#F8E6CA"], "pattern": "reference-derived pixel palette", "amplitude": 0.088, "heightCorrelation": 0.42}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.353, "role": "reference-derived broad albedo and height breakup"}, {"id": "meso", "frequency": 14.0, "amplitude": 0.202, "role": "reference-derived cracks, ridges, pores, grain, or leaf clusters"}, {"id": "micro", "frequency": 72.0, "amplitude": 0.085, "role": "reference-derived micro highlight breakup under grazing light"}], "roughness": {"base": 0.687, "variation": 0.05, "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\champagne\\champagne_roughness.png", "url": "champagne_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "localResponse": "reference-derived roughness estimate; cavities and textured zones trend rougher, bright highlights trend smoother"}, "metalness": {"base": 0.85, "variation": 0.0}, "normal": {"pattern": "reference-derived height-gradient normal map", "strength": 0.171, "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\champagne\\champagne_normal.png", "url": "champagne_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "heightSource": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\champagne\\champagne_height.png", "url": "champagne_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "space": "tangent"}, "bump": {"pattern": "reference-derived height field", "amplitude": 0.01, "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\champagne\\champagne_height.png", "url": "champagne_height.png", "channel": "height", "source": "reference-pixel-extraction"}}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.38, "contactShadowBias": 0.35, "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\champagne\\champagne_ao.png", "url": "champagne_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}, "notes": "Reference-derived cavity estimate from local height minima; verify against grazing-light screenshot."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "champagne-finish", "region": "full surface", "roughness": 0.3, "description": "Independent fine grain height and roughness, no baked light", "evidenceRefs": ["full-object"]}, {"id": "reference-pbr-pixel-evidence", "type": "material-map-evidence", "evidenceRefs": ["full-object"], "channels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "notes": "Use generated maps as material evidence, then refine after browser screenshot comparison."}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there.", "Reference-derived maps are estimates from image pixels; verify with neutral, grazing, and reference-matched renders.", "Do not treat baked image shadows as final albedo; rerun extraction with a tighter material crop if highlights/shadows pollute the maps."], "notes": "Observed finish; illumination separated from albedo.", "referencePbr": {"version": "1.0", "sourceImage": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\champagne-crop.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.705, "estimatedFidelity": 0.705, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\champagne\\champagne_albedo.png", "url": "champagne_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\champagne\\champagne_roughness.png", "url": "champagne_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\champagne\\champagne_height.png", "url": "champagne_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\champagne\\champagne_normal.png", "url": "champagne_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\champagne\\champagne_ao.png", "url": "champagne_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 20, "sourceHeight": 260, "mapSize": 1024, "cropBBoxPixels": {"x": 0, "y": 0, "width": 20, "height": 260}, "mask": {"backgroundColor": "#DFC2A5", "backgroundNoise": 57.991, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.95}, "mapStats": {"valueRange": 0.2094, "heightP90Gradient": 0.01246, "roughnessBase": 0.687, "roughnessVariation": 0.05, "normalStrength": 0.171, "blurRadius": 21}, "palette": ["#CFAF89", "#D7BC9E", "#D4AC7B", "#DAB282", "#F8E6CA"]}, "warnings": ["image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped", "low value range weakens height/roughness inference"]}},
    options
  );
  materialMap["diffuser"] = createSculptMaterial(
    "diffuser",
    {"id": "diffuser", "name": "diffuser", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#fff0d0", "color": "#fff0d0", "albedo": {"dominant": "#ECBC77", "secondary": ["#EEBE79", "#F4C37E", "#E9BA76"], "samplingNotes": "Reference-derived from foreground pixels; de-lit to reduce baked shadows/highlights.", "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\diffuser\\diffuser_albedo.png", "url": "diffuser_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}}, "colorVariation": {"palette": ["#ECBC77", "#EEBE79", "#F4C37E", "#E9BA76", "#F8C987"], "pattern": "reference-derived pixel palette", "amplitude": 0.08, "heightCorrelation": 0.42}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.308, "role": "reference-derived broad albedo and height breakup"}, {"id": "meso", "frequency": 14.0, "amplitude": 0.199, "role": "reference-derived cracks, ridges, pores, grain, or leaf clusters"}, {"id": "micro", "frequency": 72.0, "amplitude": 0.083, "role": "reference-derived micro highlight breakup under grazing light"}], "roughness": {"base": 0.69, "variation": 0.05, "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\diffuser\\diffuser_roughness.png", "url": "diffuser_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "localResponse": "reference-derived roughness estimate; cavities and textured zones trend rougher, bright highlights trend smoother"}, "metalness": {"base": 0, "variation": 0.0}, "normal": {"pattern": "reference-derived height-gradient normal map", "strength": 0.17, "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\diffuser\\diffuser_normal.png", "url": "diffuser_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "heightSource": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\diffuser\\diffuser_height.png", "url": "diffuser_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "space": "tangent"}, "bump": {"pattern": "reference-derived height field", "amplitude": 0.01, "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\diffuser\\diffuser_height.png", "url": "diffuser_height.png", "channel": "height", "source": "reference-pixel-extraction"}}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.38, "contactShadowBias": 0.35, "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\diffuser\\diffuser_ao.png", "url": "diffuser_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}, "notes": "Reference-derived cavity estimate from local height minima; verify against grazing-light screenshot."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "diffuser-finish", "region": "full surface", "roughness": 0.25, "description": "Independent fine grain height and roughness, no baked light", "evidenceRefs": ["full-object"]}, {"id": "reference-pbr-pixel-evidence", "type": "material-map-evidence", "evidenceRefs": ["full-object"], "channels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "notes": "Use generated maps as material evidence, then refine after browser screenshot comparison."}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there.", "Reference-derived maps are estimates from image pixels; verify with neutral, grazing, and reference-matched renders.", "Do not treat baked image shadows as final albedo; rerun extraction with a tighter material crop if highlights/shadows pollute the maps."], "notes": "Observed finish; illumination separated from albedo.", "referencePbr": {"version": "1.0", "sourceImage": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\diffuser-crop.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.768, "estimatedFidelity": 0.768, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\diffuser\\diffuser_albedo.png", "url": "diffuser_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\diffuser\\diffuser_roughness.png", "url": "diffuser_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\diffuser\\diffuser_height.png", "url": "diffuser_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\diffuser\\diffuser_normal.png", "url": "diffuser_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\diffuser\\diffuser_ao.png", "url": "diffuser_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 12, "sourceHeight": 260, "mapSize": 1024, "cropBBoxPixels": {"x": 0, "y": 0, "width": 12, "height": 135}, "mask": {"backgroundColor": "#ECBCA9", "backgroundNoise": 48.0, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.4939}, "mapStats": {"valueRange": 0.08, "heightP90Gradient": 0.01171, "roughnessBase": 0.69, "roughnessVariation": 0.05, "normalStrength": 0.17, "blurRadius": 21}, "palette": ["#ECBC77", "#EEBE79", "#F4C37E", "#E9BA76", "#F8C987"]}, "warnings": ["single-image inverse rendering cannot prove true physical PBR; confidence is capped", "low value range weakens height/roughness inference"]}},
    options
  );
  materialMap["foliage"] = createSculptMaterial(
    "foliage",
    {"id": "foliage", "name": "foliage", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#ab8050", "color": "#ab8050", "albedo": {"dominant": "#DEC19F", "secondary": ["#D9B284", "#C59560", "#F4DCB6"], "samplingNotes": "Reference-derived from foreground pixels; de-lit to reduce baked shadows/highlights.", "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\foliage\\foliage_albedo.png", "url": "foliage_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}}, "colorVariation": {"palette": ["#DEC19F", "#D9B284", "#C59560", "#F4DCB6", "#A16A32"], "pattern": "reference-derived pixel palette", "amplitude": 0.171, "heightCorrelation": 0.42}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.423, "role": "reference-derived broad albedo and height breakup"}, {"id": "meso", "frequency": 14.0, "amplitude": 0.35, "role": "reference-derived cracks, ridges, pores, grain, or leaf clusters"}, {"id": "micro", "frequency": 72.0, "amplitude": 0.14, "role": "reference-derived micro highlight breakup under grazing light"}], "roughness": {"base": 0.736, "variation": 0.204, "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\foliage\\foliage_roughness.png", "url": "foliage_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "localResponse": "reference-derived roughness estimate; cavities and textured zones trend rougher, bright highlights trend smoother"}, "metalness": {"base": 0, "variation": 0.0}, "normal": {"pattern": "reference-derived height-gradient normal map", "strength": 0.274, "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\foliage\\foliage_normal.png", "url": "foliage_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "heightSource": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\foliage\\foliage_height.png", "url": "foliage_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "space": "tangent"}, "bump": {"pattern": "reference-derived height field", "amplitude": 0.045, "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\foliage\\foliage_height.png", "url": "foliage_height.png", "channel": "height", "source": "reference-pixel-extraction"}}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.38, "contactShadowBias": 0.35, "map": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\foliage\\foliage_ao.png", "url": "foliage_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}, "notes": "Reference-derived cavity estimate from local height minima; verify against grazing-light screenshot."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "foliage-finish", "region": "full surface", "roughness": 0.8, "description": "Independent fine grain height and roughness, no baked light", "evidenceRefs": ["full-object"]}, {"id": "reference-pbr-pixel-evidence", "type": "material-map-evidence", "evidenceRefs": ["full-object"], "channels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "notes": "Use generated maps as material evidence, then refine after browser screenshot comparison."}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there.", "Reference-derived maps are estimates from image pixels; verify with neutral, grazing, and reference-matched renders.", "Do not treat baked image shadows as final albedo; rerun extraction with a tighter material crop if highlights/shadows pollute the maps."], "notes": "Observed finish; illumination separated from albedo.", "referencePbr": {"version": "1.0", "sourceImage": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\foliage-crop.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.811, "estimatedFidelity": 0.811, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\foliage\\foliage_albedo.png", "url": "foliage_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\foliage\\foliage_roughness.png", "url": "foliage_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\foliage\\foliage_height.png", "url": "foliage_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\foliage\\foliage_normal.png", "url": "foliage_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "C:\\Users\\Maahaan\\Desktop\\📁 Projects - Web\\nextjs-portfolio\\.img2threejs\\showroom\\pbr\\foliage\\foliage_ao.png", "url": "foliage_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 100, "sourceHeight": 130, "mapSize": 1024, "cropBBoxPixels": {"x": 0, "y": 0, "width": 100, "height": 130}, "mask": {"backgroundColor": "#DEC2A4", "backgroundNoise": 85.235, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.9625}, "mapStats": {"valueRange": 0.4079, "heightP90Gradient": 0.10029, "roughnessBase": 0.736, "roughnessVariation": 0.204, "normalStrength": 0.274, "blurRadius": 21}, "palette": ["#DEC19F", "#D9B284", "#C59560", "#F4DCB6", "#A16A32"]}, "warnings": ["image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const endpoint_root_0 = makeAttachmentEndpoint(null);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "root__pivot";
  node_root_0.scale.set(1, 1, 1);
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_root_0.position.set(0.0, -1.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "root", "level": "macro", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.001, "height": 0.001, "depth": 0.001, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, -1, 0], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "support-podium", "position": [0, 0.55, 0], "rotation": [0, 0, 0]}, {"id": "support-planter--7", "position": [-7, 0.5, -1.2], "rotation": [0, 0, 0]}, {"id": "support-planter-7", "position": [7, 0.5, -1.2], "rotation": [0, 0, 0]}, {"id": "support-podium-band", "position": [0, 0.52, 0], "rotation": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "plaster", "materialLayers": ["plaster"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "root-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 224, 212, 1)", "secondaryAlbedo": "rgba(233, 224, 212, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_root_0.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "support-podium", "position": [0, 0.55, 0], "rotation": [0, 0, 0]}, {"id": "support-planter--7", "position": [-7, 0.5, -1.2], "rotation": [0, 0, 0]}, {"id": "support-planter-7", "position": [7, 0.5, -1.2], "rotation": [0, 0, 0]}, {"id": "support-podium-band", "position": [0, 0.52, 0], "rotation": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_root_0) {
    mesh_root_0Geometry.scale(0.001, 0.001, 0.001);
  }
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["plaster"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "root";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "root", "level": "macro", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 0.001, "height": 0.001, "depth": 0.001, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, -1, 0], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "support-podium", "position": [0, 0.55, 0], "rotation": [0, 0, 0]}, {"id": "support-planter--7", "position": [-7, 0.5, -1.2], "rotation": [0, 0, 0]}, {"id": "support-planter-7", "position": [7, 0.5, -1.2], "rotation": [0, 0, 0]}, {"id": "support-podium-band", "position": [0, 0.52, 0], "rotation": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "plaster", "materialLayers": ["plaster"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "root-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 224, 212, 1)", "secondaryAlbedo": "rgba(233, 224, 212, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);
  const socket_root_support_podium_0 = new THREE.Object3D();
  socket_root_support_podium_0.name = "support-podium";
  socket_root_support_podium_0.position.set(0.0, 0.55, 0.0);
  socket_root_support_podium_0.rotation.set(0.0, 0.0, 0.0);
  socket_root_support_podium_0.userData.socket = {"id": "support-podium", "position": [0, 0.55, 0], "rotation": [0, 0, 0]};
  node_root_0.add(socket_root_support_podium_0);
  sockets["root:support-podium"] = socket_root_support_podium_0;
  const socket_root_support_planter__7_1 = new THREE.Object3D();
  socket_root_support_planter__7_1.name = "support-planter--7";
  socket_root_support_planter__7_1.position.set(-7.0, 0.5, -1.2);
  socket_root_support_planter__7_1.rotation.set(0.0, 0.0, 0.0);
  socket_root_support_planter__7_1.userData.socket = {"id": "support-planter--7", "position": [-7, 0.5, -1.2], "rotation": [0, 0, 0]};
  node_root_0.add(socket_root_support_planter__7_1);
  sockets["root:support-planter--7"] = socket_root_support_planter__7_1;
  const socket_root_support_planter_7_2 = new THREE.Object3D();
  socket_root_support_planter_7_2.name = "support-planter-7";
  socket_root_support_planter_7_2.position.set(7.0, 0.5, -1.2);
  socket_root_support_planter_7_2.rotation.set(0.0, 0.0, 0.0);
  socket_root_support_planter_7_2.userData.socket = {"id": "support-planter-7", "position": [7, 0.5, -1.2], "rotation": [0, 0, 0]};
  node_root_0.add(socket_root_support_planter_7_2);
  sockets["root:support-planter-7"] = socket_root_support_planter_7_2;
  const socket_root_support_podium_band_3 = new THREE.Object3D();
  socket_root_support_podium_band_3.name = "support-podium-band";
  socket_root_support_podium_band_3.position.set(0.0, 0.52, 0.0);
  socket_root_support_podium_band_3.rotation.set(0.0, 0.0, 0.0);
  socket_root_support_podium_band_3.userData.socket = {"id": "support-podium-band", "position": [0, 0.52, 0], "rotation": [0, 0, 0]};
  node_root_0.add(socket_root_support_podium_band_3);
  sockets["root:support-podium-band"] = socket_root_support_podium_band_3;

  const endpoint_floor_1 = makeAttachmentEndpoint(null);
  const node_floor_1 = new THREE.Group();
  node_floor_1.name = "floor__pivot";
  node_floor_1.scale.set(1, 1, 1);
  if (endpoint_floor_1) {
    node_floor_1.position.copy(endpoint_floor_1.start);
    node_floor_1.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_floor_1.position.set(0.0, -0.06, 0.0);
    node_floor_1.rotation.set(0.0, 0.0, 0.0);
  }
  node_floor_1.userData.sculptComponent = {"id": "floor", "name": "floor", "level": "macro", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 24, "height": 0.12, "depth": 24, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, -0.06, 0], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "floor", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "stone", "materialLayers": ["stone"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "floor-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(236, 231, 223, 1)", "secondaryAlbedo": "rgba(236, 231, 223, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_floor_1.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "floor", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_floor_1);
  nodes["floor"] = node_floor_1;
  const mesh_floor_1Geometry = endpoint_floor_1
    ? new THREE.CylinderGeometry(endpoint_floor_1.endRadius, endpoint_floor_1.baseRadius, endpoint_floor_1.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_floor_1) {
    mesh_floor_1Geometry.scale(24.0, 0.12, 24.0);
  }
  const mesh_floor_1 = new THREE.Mesh(
    mesh_floor_1Geometry,
    materialMap["stone"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_floor_1.name = "floor";
  if (endpoint_floor_1) {
    mesh_floor_1.position.copy(endpoint_floor_1.midpoint);
    mesh_floor_1.quaternion.copy(endpoint_floor_1.quaternion);
  }
  mesh_floor_1.castShadow = options.castShadow ?? true;
  mesh_floor_1.receiveShadow = options.receiveShadow ?? true;
  mesh_floor_1.userData.sculptComponent = {"id": "floor", "name": "floor", "level": "macro", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 24, "height": 0.12, "depth": 24, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, -0.06, 0], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "floor", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "stone", "materialLayers": ["stone"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "floor-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(236, 231, 223, 1)", "secondaryAlbedo": "rgba(236, 231, 223, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_floor_1.add(mesh_floor_1);
  meshes["floor"] = mesh_floor_1;
  colliders["floor"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["floor"] ??= [];
  destructionGroups["floor"].push(node_floor_1);

  const endpoint_deck_2 = makeAttachmentEndpoint(null);
  const node_deck_2 = new THREE.Group();
  node_deck_2.name = "deck__pivot";
  node_deck_2.scale.set(1, 1, 1);
  if (endpoint_deck_2) {
    node_deck_2.position.copy(endpoint_deck_2.start);
    node_deck_2.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_deck_2.position.set(0.0, 0.125, -2.8);
    node_deck_2.rotation.set(0.0, 0.0, 0.0);
  }
  node_deck_2.userData.sculptComponent = {"id": "deck", "name": "deck", "level": "macro", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 22, "height": 0.25, "depth": 9, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 0.125, -2.8], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "deck", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "stone", "materialLayers": ["stone"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "deck-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(236, 231, 223, 1)", "secondaryAlbedo": "rgba(236, 231, 223, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_deck_2.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "deck", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_deck_2);
  nodes["deck"] = node_deck_2;
  const mesh_deck_2Geometry = endpoint_deck_2
    ? new THREE.CylinderGeometry(endpoint_deck_2.endRadius, endpoint_deck_2.baseRadius, endpoint_deck_2.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_deck_2) {
    mesh_deck_2Geometry.scale(22.0, 0.25, 9.0);
  }
  const mesh_deck_2 = new THREE.Mesh(
    mesh_deck_2Geometry,
    materialMap["stone"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_deck_2.name = "deck";
  if (endpoint_deck_2) {
    mesh_deck_2.position.copy(endpoint_deck_2.midpoint);
    mesh_deck_2.quaternion.copy(endpoint_deck_2.quaternion);
  }
  mesh_deck_2.castShadow = options.castShadow ?? true;
  mesh_deck_2.receiveShadow = options.receiveShadow ?? true;
  mesh_deck_2.userData.sculptComponent = {"id": "deck", "name": "deck", "level": "macro", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 22, "height": 0.25, "depth": 9, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 0.125, -2.8], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "deck", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "stone", "materialLayers": ["stone"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "deck-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(236, 231, 223, 1)", "secondaryAlbedo": "rgba(236, 231, 223, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_deck_2.add(mesh_deck_2);
  meshes["deck"] = mesh_deck_2;
  colliders["deck"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["deck"] ??= [];
  destructionGroups["deck"].push(node_deck_2);

  const endpoint_wall_3 = makeAttachmentEndpoint(null);
  const node_wall_3 = new THREE.Group();
  node_wall_3.name = "wall__pivot";
  node_wall_3.scale.set(1, 1, 1);
  if (endpoint_wall_3) {
    node_wall_3.position.copy(endpoint_wall_3.start);
    node_wall_3.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_wall_3.position.set(0.0, 4.75, -3.6);
    node_wall_3.rotation.set(0.0, 0.0, 0.0);
  }
  node_wall_3.userData.sculptComponent = {"id": "wall", "name": "wall", "level": "macro", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 22, "height": 9, "depth": 0.2, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 4.75, -3.6], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "wall", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "plaster", "materialLayers": ["plaster"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "wall-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 224, 212, 1)", "secondaryAlbedo": "rgba(233, 224, 212, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_wall_3.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "wall", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_wall_3);
  nodes["wall"] = node_wall_3;
  const mesh_wall_3Geometry = endpoint_wall_3
    ? new THREE.CylinderGeometry(endpoint_wall_3.endRadius, endpoint_wall_3.baseRadius, endpoint_wall_3.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_wall_3) {
    mesh_wall_3Geometry.scale(22.0, 9.0, 0.2);
  }
  const mesh_wall_3 = new THREE.Mesh(
    mesh_wall_3Geometry,
    materialMap["plaster"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wall_3.name = "wall";
  if (endpoint_wall_3) {
    mesh_wall_3.position.copy(endpoint_wall_3.midpoint);
    mesh_wall_3.quaternion.copy(endpoint_wall_3.quaternion);
  }
  mesh_wall_3.castShadow = options.castShadow ?? true;
  mesh_wall_3.receiveShadow = options.receiveShadow ?? true;
  mesh_wall_3.userData.sculptComponent = {"id": "wall", "name": "wall", "level": "macro", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 22, "height": 9, "depth": 0.2, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 4.75, -3.6], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "wall", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "plaster", "materialLayers": ["plaster"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "wall-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 224, 212, 1)", "secondaryAlbedo": "rgba(233, 224, 212, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_wall_3.add(mesh_wall_3);
  meshes["wall"] = mesh_wall_3;
  colliders["wall"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["wall"] ??= [];
  destructionGroups["wall"].push(node_wall_3);

  const attachment_podium_4 = {"parentSocket": "root/support-podium", "localStart": [0, 0, 0], "localEnd": [0, 0.6, 0], "contactType": "surface-contact", "overlap": 0.02, "embedDepth": 0.02, "gapTolerance": 0.002};
  const endpoint_podium_4 = makeAttachmentEndpoint(attachment_podium_4);
  const node_podium_4 = new THREE.Group();
  node_podium_4.name = "podium__pivot";
  node_podium_4.scale.set(1, 1, 1);
  if (endpoint_podium_4) {
    node_podium_4.position.copy(endpoint_podium_4.start);
    node_podium_4.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_podium_4.position.set(0.0, 0.55, 0.0);
    node_podium_4.rotation.set(0.0, 0.0, 0.0);
  }
  node_podium_4.userData.sculptComponent = {"id": "podium", "name": "podium", "level": "meso", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentSocket": "root/support-podium", "localStart": [0, 0, 0], "localEnd": [0, 0.6, 0], "contactType": "surface-contact", "overlap": 0.02, "embedDepth": 0.02, "gapTolerance": 0.002}, "dimensions": {"width": 4.8, "height": 0.6, "depth": 4.8, "units": "relative", "confidence": 0.5, "radius": 2.4}, "transform": {"position": [0, 0.55, 0], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "podium", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "stone", "materialLayers": ["stone"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "podium-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(236, 231, 223, 1)", "secondaryAlbedo": "rgba(236, 231, 223, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_podium_4.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "podium", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_podium_4);
  nodes["podium"] = node_podium_4;
  const mesh_podium_4Geometry = endpoint_podium_4
    ? new THREE.CylinderGeometry(endpoint_podium_4.endRadius, endpoint_podium_4.baseRadius, endpoint_podium_4.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  if (!endpoint_podium_4) {
    mesh_podium_4Geometry.scale(4.8, 0.6, 4.8);
  }
  const mesh_podium_4 = new THREE.Mesh(
    mesh_podium_4Geometry,
    materialMap["stone"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_podium_4.name = "podium";
  if (endpoint_podium_4) {
    mesh_podium_4.position.copy(endpoint_podium_4.midpoint);
    mesh_podium_4.quaternion.copy(endpoint_podium_4.quaternion);
  }
  mesh_podium_4.castShadow = options.castShadow ?? true;
  mesh_podium_4.receiveShadow = options.receiveShadow ?? true;
  mesh_podium_4.userData.sculptComponent = {"id": "podium", "name": "podium", "level": "meso", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentSocket": "root/support-podium", "localStart": [0, 0, 0], "localEnd": [0, 0.6, 0], "contactType": "surface-contact", "overlap": 0.02, "embedDepth": 0.02, "gapTolerance": 0.002}, "dimensions": {"width": 4.8, "height": 0.6, "depth": 4.8, "units": "relative", "confidence": 0.5, "radius": 2.4}, "transform": {"position": [0, 0.55, 0], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "podium", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "stone", "materialLayers": ["stone"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "podium-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(236, 231, 223, 1)", "secondaryAlbedo": "rgba(236, 231, 223, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_podium_4.add(mesh_podium_4);
  meshes["podium"] = mesh_podium_4;
  colliders["podium"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["podium"] ??= [];
  destructionGroups["podium"].push(node_podium_4);

  const endpoint_arch_panel_5 = makeAttachmentEndpoint(null);
  const node_arch_panel_5 = new THREE.Group();
  node_arch_panel_5.name = "arch-panel__pivot";
  node_arch_panel_5.scale.set(1, 1, 1);
  if (endpoint_arch_panel_5) {
    node_arch_panel_5.position.copy(endpoint_arch_panel_5.start);
    node_arch_panel_5.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_arch_panel_5.position.set(0.0, 4.25, -3.43);
    node_arch_panel_5.rotation.set(0.0, 0.0, 0.0);
  }
  node_arch_panel_5.userData.sculptComponent = {"id": "arch-panel", "name": "arch-panel", "level": "meso", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 5.4, "height": 8, "depth": 0.18, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 4.25, -3.43], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "arch-panel", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "plaster", "materialLayers": ["plaster"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "arch-panel-detail", "type": "bevel", "description": "Continuous arched top profile; half-circle radius 2.7, spring height 4.8, actual extrusion in hand refinement", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 224, 212, 1)", "secondaryAlbedo": "rgba(233, 224, 212, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_arch_panel_5.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "arch-panel", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_arch_panel_5);
  nodes["arch-panel"] = node_arch_panel_5;
  const mesh_arch_panel_5Geometry = endpoint_arch_panel_5
    ? new THREE.CylinderGeometry(endpoint_arch_panel_5.endRadius, endpoint_arch_panel_5.baseRadius, endpoint_arch_panel_5.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_arch_panel_5) {
    mesh_arch_panel_5Geometry.scale(5.4, 8.0, 0.18);
  }
  const mesh_arch_panel_5 = new THREE.Mesh(
    mesh_arch_panel_5Geometry,
    materialMap["plaster"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_arch_panel_5.name = "arch-panel";
  if (endpoint_arch_panel_5) {
    mesh_arch_panel_5.position.copy(endpoint_arch_panel_5.midpoint);
    mesh_arch_panel_5.quaternion.copy(endpoint_arch_panel_5.quaternion);
  }
  mesh_arch_panel_5.castShadow = options.castShadow ?? true;
  mesh_arch_panel_5.receiveShadow = options.receiveShadow ?? true;
  mesh_arch_panel_5.userData.sculptComponent = {"id": "arch-panel", "name": "arch-panel", "level": "meso", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 5.4, "height": 8, "depth": 0.18, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 4.25, -3.43], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "arch-panel", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "plaster", "materialLayers": ["plaster"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "arch-panel-detail", "type": "bevel", "description": "Continuous arched top profile; half-circle radius 2.7, spring height 4.8, actual extrusion in hand refinement", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 224, 212, 1)", "secondaryAlbedo": "rgba(233, 224, 212, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_arch_panel_5.add(mesh_arch_panel_5);
  meshes["arch-panel"] = mesh_arch_panel_5;
  colliders["arch-panel"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["arch-panel"] ??= [];
  destructionGroups["arch-panel"].push(node_arch_panel_5);

  const endpoint_partition_left_6 = makeAttachmentEndpoint(null);
  const node_partition_left_6 = new THREE.Group();
  node_partition_left_6.name = "partition-left__pivot";
  node_partition_left_6.scale.set(1, 1, 1);
  if (endpoint_partition_left_6) {
    node_partition_left_6.position.copy(endpoint_partition_left_6.start);
    node_partition_left_6.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_partition_left_6.position.set(-5.6, 2.6, -1.9);
    node_partition_left_6.rotation.set(0.0, 0.0, 0.0);
  }
  node_partition_left_6.userData.sculptComponent = {"id": "partition-left", "name": "partition-left", "level": "meso", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 3.8, "height": 4.7, "depth": 0.18, "units": "relative", "confidence": 0.5}, "transform": {"position": [-5.6, 2.6, -1.9], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "partition-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "plaster", "materialLayers": ["plaster"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "partition-left-detail", "type": "bevel", "description": "Asymmetric broad wall, top edge slopes then rounded right corner radius .65", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 224, 212, 1)", "secondaryAlbedo": "rgba(233, 224, 212, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_partition_left_6.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "partition-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_partition_left_6);
  nodes["partition-left"] = node_partition_left_6;
  const mesh_partition_left_6Geometry = endpoint_partition_left_6
    ? new THREE.CylinderGeometry(endpoint_partition_left_6.endRadius, endpoint_partition_left_6.baseRadius, endpoint_partition_left_6.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_partition_left_6) {
    mesh_partition_left_6Geometry.scale(3.8, 4.7, 0.18);
  }
  const mesh_partition_left_6 = new THREE.Mesh(
    mesh_partition_left_6Geometry,
    materialMap["plaster"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_partition_left_6.name = "partition-left";
  if (endpoint_partition_left_6) {
    mesh_partition_left_6.position.copy(endpoint_partition_left_6.midpoint);
    mesh_partition_left_6.quaternion.copy(endpoint_partition_left_6.quaternion);
  }
  mesh_partition_left_6.castShadow = options.castShadow ?? true;
  mesh_partition_left_6.receiveShadow = options.receiveShadow ?? true;
  mesh_partition_left_6.userData.sculptComponent = {"id": "partition-left", "name": "partition-left", "level": "meso", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 3.8, "height": 4.7, "depth": 0.18, "units": "relative", "confidence": 0.5}, "transform": {"position": [-5.6, 2.6, -1.9], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "partition-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "plaster", "materialLayers": ["plaster"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "partition-left-detail", "type": "bevel", "description": "Asymmetric broad wall, top edge slopes then rounded right corner radius .65", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 224, 212, 1)", "secondaryAlbedo": "rgba(233, 224, 212, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_partition_left_6.add(mesh_partition_left_6);
  meshes["partition-left"] = mesh_partition_left_6;
  colliders["partition-left"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["partition-left"] ??= [];
  destructionGroups["partition-left"].push(node_partition_left_6);

  const endpoint_partition_right_7 = makeAttachmentEndpoint(null);
  const node_partition_right_7 = new THREE.Group();
  node_partition_right_7.name = "partition-right__pivot";
  node_partition_right_7.scale.set(1, 1, 1);
  if (endpoint_partition_right_7) {
    node_partition_right_7.position.copy(endpoint_partition_right_7.start);
    node_partition_right_7.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_partition_right_7.position.set(6.8, 2.45, -1.4);
    node_partition_right_7.rotation.set(0.0, 0.0, 0.0);
  }
  node_partition_right_7.userData.sculptComponent = {"id": "partition-right", "name": "partition-right", "level": "meso", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 2.3, "height": 4.4, "depth": 0.18, "units": "relative", "confidence": 0.5}, "transform": {"position": [6.8, 2.45, -1.4], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "partition-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "plaster", "materialLayers": ["plaster"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "partition-right-detail", "type": "bevel", "description": "Curved shoulder rising toward outside edge", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 224, 212, 1)", "secondaryAlbedo": "rgba(233, 224, 212, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_partition_right_7.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "partition-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_partition_right_7);
  nodes["partition-right"] = node_partition_right_7;
  const mesh_partition_right_7Geometry = endpoint_partition_right_7
    ? new THREE.CylinderGeometry(endpoint_partition_right_7.endRadius, endpoint_partition_right_7.baseRadius, endpoint_partition_right_7.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_partition_right_7) {
    mesh_partition_right_7Geometry.scale(2.3, 4.4, 0.18);
  }
  const mesh_partition_right_7 = new THREE.Mesh(
    mesh_partition_right_7Geometry,
    materialMap["plaster"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_partition_right_7.name = "partition-right";
  if (endpoint_partition_right_7) {
    mesh_partition_right_7.position.copy(endpoint_partition_right_7.midpoint);
    mesh_partition_right_7.quaternion.copy(endpoint_partition_right_7.quaternion);
  }
  mesh_partition_right_7.castShadow = options.castShadow ?? true;
  mesh_partition_right_7.receiveShadow = options.receiveShadow ?? true;
  mesh_partition_right_7.userData.sculptComponent = {"id": "partition-right", "name": "partition-right", "level": "meso", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 2.3, "height": 4.4, "depth": 0.18, "units": "relative", "confidence": 0.5}, "transform": {"position": [6.8, 2.45, -1.4], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "partition-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "plaster", "materialLayers": ["plaster"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "partition-right-detail", "type": "bevel", "description": "Curved shoulder rising toward outside edge", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(233, 224, 212, 1)", "secondaryAlbedo": "rgba(233, 224, 212, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_partition_right_7.add(mesh_partition_right_7);
  meshes["partition-right"] = mesh_partition_right_7;
  colliders["partition-right"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["partition-right"] ??= [];
  destructionGroups["partition-right"].push(node_partition_right_7);

  const endpoint_pilaster__7_2_8 = makeAttachmentEndpoint(null);
  const node_pilaster__7_2_8 = new THREE.Group();
  node_pilaster__7_2_8.name = "pilaster--7.2__pivot";
  node_pilaster__7_2_8.scale.set(1, 1, 1);
  if (endpoint_pilaster__7_2_8) {
    node_pilaster__7_2_8.position.copy(endpoint_pilaster__7_2_8.start);
    node_pilaster__7_2_8.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_pilaster__7_2_8.position.set(-7.2, 4.75, -3.35);
    node_pilaster__7_2_8.rotation.set(0.0, 0.0, 0.0);
  }
  node_pilaster__7_2_8.userData.sculptComponent = {"id": "pilaster--7.2", "name": "pilaster--7.2", "level": "meso", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.22, "height": 9, "depth": 0.32, "units": "relative", "confidence": 0.5}, "transform": {"position": [-7.2, 4.75, -3.35], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pilaster--7.2", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "champagne", "materialLayers": ["champagne"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pilaster--7.2-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 169, 121, 1)", "secondaryAlbedo": "rgba(200, 169, 121, 1)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_pilaster__7_2_8.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pilaster--7.2", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_pilaster__7_2_8);
  nodes["pilaster--7.2"] = node_pilaster__7_2_8;
  const mesh_pilaster__7_2_8Geometry = endpoint_pilaster__7_2_8
    ? new THREE.CylinderGeometry(endpoint_pilaster__7_2_8.endRadius, endpoint_pilaster__7_2_8.baseRadius, endpoint_pilaster__7_2_8.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_pilaster__7_2_8) {
    mesh_pilaster__7_2_8Geometry.scale(0.22, 9.0, 0.32);
  }
  const mesh_pilaster__7_2_8 = new THREE.Mesh(
    mesh_pilaster__7_2_8Geometry,
    materialMap["champagne"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pilaster__7_2_8.name = "pilaster--7.2";
  if (endpoint_pilaster__7_2_8) {
    mesh_pilaster__7_2_8.position.copy(endpoint_pilaster__7_2_8.midpoint);
    mesh_pilaster__7_2_8.quaternion.copy(endpoint_pilaster__7_2_8.quaternion);
  }
  mesh_pilaster__7_2_8.castShadow = options.castShadow ?? true;
  mesh_pilaster__7_2_8.receiveShadow = options.receiveShadow ?? true;
  mesh_pilaster__7_2_8.userData.sculptComponent = {"id": "pilaster--7.2", "name": "pilaster--7.2", "level": "meso", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.22, "height": 9, "depth": 0.32, "units": "relative", "confidence": 0.5}, "transform": {"position": [-7.2, 4.75, -3.35], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pilaster--7.2", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "champagne", "materialLayers": ["champagne"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pilaster--7.2-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 169, 121, 1)", "secondaryAlbedo": "rgba(200, 169, 121, 1)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_pilaster__7_2_8.add(mesh_pilaster__7_2_8);
  meshes["pilaster--7.2"] = mesh_pilaster__7_2_8;
  colliders["pilaster--7.2"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["pilaster--7.2"] ??= [];
  destructionGroups["pilaster--7.2"].push(node_pilaster__7_2_8);

  const endpoint_pilaster__4_5_9 = makeAttachmentEndpoint(null);
  const node_pilaster__4_5_9 = new THREE.Group();
  node_pilaster__4_5_9.name = "pilaster--4.5__pivot";
  node_pilaster__4_5_9.scale.set(1, 1, 1);
  if (endpoint_pilaster__4_5_9) {
    node_pilaster__4_5_9.position.copy(endpoint_pilaster__4_5_9.start);
    node_pilaster__4_5_9.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_pilaster__4_5_9.position.set(-4.5, 4.75, -3.35);
    node_pilaster__4_5_9.rotation.set(0.0, 0.0, 0.0);
  }
  node_pilaster__4_5_9.userData.sculptComponent = {"id": "pilaster--4.5", "name": "pilaster--4.5", "level": "meso", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.22, "height": 9, "depth": 0.32, "units": "relative", "confidence": 0.5}, "transform": {"position": [-4.5, 4.75, -3.35], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pilaster--4.5", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "champagne", "materialLayers": ["champagne"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pilaster--4.5-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 169, 121, 1)", "secondaryAlbedo": "rgba(200, 169, 121, 1)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_pilaster__4_5_9.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pilaster--4.5", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_pilaster__4_5_9);
  nodes["pilaster--4.5"] = node_pilaster__4_5_9;
  const mesh_pilaster__4_5_9Geometry = endpoint_pilaster__4_5_9
    ? new THREE.CylinderGeometry(endpoint_pilaster__4_5_9.endRadius, endpoint_pilaster__4_5_9.baseRadius, endpoint_pilaster__4_5_9.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_pilaster__4_5_9) {
    mesh_pilaster__4_5_9Geometry.scale(0.22, 9.0, 0.32);
  }
  const mesh_pilaster__4_5_9 = new THREE.Mesh(
    mesh_pilaster__4_5_9Geometry,
    materialMap["champagne"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pilaster__4_5_9.name = "pilaster--4.5";
  if (endpoint_pilaster__4_5_9) {
    mesh_pilaster__4_5_9.position.copy(endpoint_pilaster__4_5_9.midpoint);
    mesh_pilaster__4_5_9.quaternion.copy(endpoint_pilaster__4_5_9.quaternion);
  }
  mesh_pilaster__4_5_9.castShadow = options.castShadow ?? true;
  mesh_pilaster__4_5_9.receiveShadow = options.receiveShadow ?? true;
  mesh_pilaster__4_5_9.userData.sculptComponent = {"id": "pilaster--4.5", "name": "pilaster--4.5", "level": "meso", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.22, "height": 9, "depth": 0.32, "units": "relative", "confidence": 0.5}, "transform": {"position": [-4.5, 4.75, -3.35], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pilaster--4.5", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "champagne", "materialLayers": ["champagne"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pilaster--4.5-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 169, 121, 1)", "secondaryAlbedo": "rgba(200, 169, 121, 1)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_pilaster__4_5_9.add(mesh_pilaster__4_5_9);
  meshes["pilaster--4.5"] = mesh_pilaster__4_5_9;
  colliders["pilaster--4.5"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["pilaster--4.5"] ??= [];
  destructionGroups["pilaster--4.5"].push(node_pilaster__4_5_9);

  const endpoint_pilaster_4_5_10 = makeAttachmentEndpoint(null);
  const node_pilaster_4_5_10 = new THREE.Group();
  node_pilaster_4_5_10.name = "pilaster-4.5__pivot";
  node_pilaster_4_5_10.scale.set(1, 1, 1);
  if (endpoint_pilaster_4_5_10) {
    node_pilaster_4_5_10.position.copy(endpoint_pilaster_4_5_10.start);
    node_pilaster_4_5_10.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_pilaster_4_5_10.position.set(4.5, 4.75, -3.35);
    node_pilaster_4_5_10.rotation.set(0.0, 0.0, 0.0);
  }
  node_pilaster_4_5_10.userData.sculptComponent = {"id": "pilaster-4.5", "name": "pilaster-4.5", "level": "meso", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.22, "height": 9, "depth": 0.32, "units": "relative", "confidence": 0.5}, "transform": {"position": [4.5, 4.75, -3.35], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pilaster-4.5", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "champagne", "materialLayers": ["champagne"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pilaster-4.5-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 169, 121, 1)", "secondaryAlbedo": "rgba(200, 169, 121, 1)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_pilaster_4_5_10.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pilaster-4.5", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_pilaster_4_5_10);
  nodes["pilaster-4.5"] = node_pilaster_4_5_10;
  const mesh_pilaster_4_5_10Geometry = endpoint_pilaster_4_5_10
    ? new THREE.CylinderGeometry(endpoint_pilaster_4_5_10.endRadius, endpoint_pilaster_4_5_10.baseRadius, endpoint_pilaster_4_5_10.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_pilaster_4_5_10) {
    mesh_pilaster_4_5_10Geometry.scale(0.22, 9.0, 0.32);
  }
  const mesh_pilaster_4_5_10 = new THREE.Mesh(
    mesh_pilaster_4_5_10Geometry,
    materialMap["champagne"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pilaster_4_5_10.name = "pilaster-4.5";
  if (endpoint_pilaster_4_5_10) {
    mesh_pilaster_4_5_10.position.copy(endpoint_pilaster_4_5_10.midpoint);
    mesh_pilaster_4_5_10.quaternion.copy(endpoint_pilaster_4_5_10.quaternion);
  }
  mesh_pilaster_4_5_10.castShadow = options.castShadow ?? true;
  mesh_pilaster_4_5_10.receiveShadow = options.receiveShadow ?? true;
  mesh_pilaster_4_5_10.userData.sculptComponent = {"id": "pilaster-4.5", "name": "pilaster-4.5", "level": "meso", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.22, "height": 9, "depth": 0.32, "units": "relative", "confidence": 0.5}, "transform": {"position": [4.5, 4.75, -3.35], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pilaster-4.5", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "champagne", "materialLayers": ["champagne"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pilaster-4.5-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 169, 121, 1)", "secondaryAlbedo": "rgba(200, 169, 121, 1)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_pilaster_4_5_10.add(mesh_pilaster_4_5_10);
  meshes["pilaster-4.5"] = mesh_pilaster_4_5_10;
  colliders["pilaster-4.5"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["pilaster-4.5"] ??= [];
  destructionGroups["pilaster-4.5"].push(node_pilaster_4_5_10);

  const endpoint_pilaster_7_2_11 = makeAttachmentEndpoint(null);
  const node_pilaster_7_2_11 = new THREE.Group();
  node_pilaster_7_2_11.name = "pilaster-7.2__pivot";
  node_pilaster_7_2_11.scale.set(1, 1, 1);
  if (endpoint_pilaster_7_2_11) {
    node_pilaster_7_2_11.position.copy(endpoint_pilaster_7_2_11.start);
    node_pilaster_7_2_11.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_pilaster_7_2_11.position.set(7.2, 4.75, -3.35);
    node_pilaster_7_2_11.rotation.set(0.0, 0.0, 0.0);
  }
  node_pilaster_7_2_11.userData.sculptComponent = {"id": "pilaster-7.2", "name": "pilaster-7.2", "level": "meso", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.22, "height": 9, "depth": 0.32, "units": "relative", "confidence": 0.5}, "transform": {"position": [7.2, 4.75, -3.35], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pilaster-7.2", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "champagne", "materialLayers": ["champagne"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pilaster-7.2-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 169, 121, 1)", "secondaryAlbedo": "rgba(200, 169, 121, 1)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_pilaster_7_2_11.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pilaster-7.2", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_pilaster_7_2_11);
  nodes["pilaster-7.2"] = node_pilaster_7_2_11;
  const mesh_pilaster_7_2_11Geometry = endpoint_pilaster_7_2_11
    ? new THREE.CylinderGeometry(endpoint_pilaster_7_2_11.endRadius, endpoint_pilaster_7_2_11.baseRadius, endpoint_pilaster_7_2_11.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_pilaster_7_2_11) {
    mesh_pilaster_7_2_11Geometry.scale(0.22, 9.0, 0.32);
  }
  const mesh_pilaster_7_2_11 = new THREE.Mesh(
    mesh_pilaster_7_2_11Geometry,
    materialMap["champagne"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pilaster_7_2_11.name = "pilaster-7.2";
  if (endpoint_pilaster_7_2_11) {
    mesh_pilaster_7_2_11.position.copy(endpoint_pilaster_7_2_11.midpoint);
    mesh_pilaster_7_2_11.quaternion.copy(endpoint_pilaster_7_2_11.quaternion);
  }
  mesh_pilaster_7_2_11.castShadow = options.castShadow ?? true;
  mesh_pilaster_7_2_11.receiveShadow = options.receiveShadow ?? true;
  mesh_pilaster_7_2_11.userData.sculptComponent = {"id": "pilaster-7.2", "name": "pilaster-7.2", "level": "meso", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.22, "height": 9, "depth": 0.32, "units": "relative", "confidence": 0.5}, "transform": {"position": [7.2, 4.75, -3.35], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pilaster-7.2", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "champagne", "materialLayers": ["champagne"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pilaster-7.2-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 169, 121, 1)", "secondaryAlbedo": "rgba(200, 169, 121, 1)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_pilaster_7_2_11.add(mesh_pilaster_7_2_11);
  meshes["pilaster-7.2"] = mesh_pilaster_7_2_11;
  colliders["pilaster-7.2"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["pilaster-7.2"] ??= [];
  destructionGroups["pilaster-7.2"].push(node_pilaster_7_2_11);

  const attachment_planter__7_12 = {"parentSocket": "root/support-planter--7", "localStart": [0, 0, 0], "localEnd": [0, 0.5, 0], "contactType": "surface-contact", "overlap": 0.02, "embedDepth": 0.02, "gapTolerance": 0.002};
  const endpoint_planter__7_12 = makeAttachmentEndpoint(attachment_planter__7_12);
  const node_planter__7_12 = new THREE.Group();
  node_planter__7_12.name = "planter--7__pivot";
  node_planter__7_12.scale.set(1, 1, 1);
  if (endpoint_planter__7_12) {
    node_planter__7_12.position.copy(endpoint_planter__7_12.start);
    node_planter__7_12.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_planter__7_12.position.set(-7.0, 0.5, -1.2);
    node_planter__7_12.rotation.set(0.0, 0.0, 0.0);
  }
  node_planter__7_12.userData.sculptComponent = {"id": "planter--7", "name": "planter--7", "level": "meso", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentSocket": "root/support-planter--7", "localStart": [0, 0, 0], "localEnd": [0, 0.5, 0], "contactType": "surface-contact", "overlap": 0.02, "embedDepth": 0.02, "gapTolerance": 0.002}, "dimensions": {"width": 2.5, "height": 0.5, "depth": 2.5, "units": "relative", "confidence": 0.5, "radius": 1.25}, "transform": {"position": [-7, 0.5, -1.2], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "planter--7", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "stone", "materialLayers": ["stone"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "planter--7-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(236, 231, 223, 1)", "secondaryAlbedo": "rgba(236, 231, 223, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_planter__7_12.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "planter--7", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_planter__7_12);
  nodes["planter--7"] = node_planter__7_12;
  const mesh_planter__7_12Geometry = endpoint_planter__7_12
    ? new THREE.CylinderGeometry(endpoint_planter__7_12.endRadius, endpoint_planter__7_12.baseRadius, endpoint_planter__7_12.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  if (!endpoint_planter__7_12) {
    mesh_planter__7_12Geometry.scale(2.5, 0.5, 2.5);
  }
  const mesh_planter__7_12 = new THREE.Mesh(
    mesh_planter__7_12Geometry,
    materialMap["stone"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_planter__7_12.name = "planter--7";
  if (endpoint_planter__7_12) {
    mesh_planter__7_12.position.copy(endpoint_planter__7_12.midpoint);
    mesh_planter__7_12.quaternion.copy(endpoint_planter__7_12.quaternion);
  }
  mesh_planter__7_12.castShadow = options.castShadow ?? true;
  mesh_planter__7_12.receiveShadow = options.receiveShadow ?? true;
  mesh_planter__7_12.userData.sculptComponent = {"id": "planter--7", "name": "planter--7", "level": "meso", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentSocket": "root/support-planter--7", "localStart": [0, 0, 0], "localEnd": [0, 0.5, 0], "contactType": "surface-contact", "overlap": 0.02, "embedDepth": 0.02, "gapTolerance": 0.002}, "dimensions": {"width": 2.5, "height": 0.5, "depth": 2.5, "units": "relative", "confidence": 0.5, "radius": 1.25}, "transform": {"position": [-7, 0.5, -1.2], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "planter--7", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "stone", "materialLayers": ["stone"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "planter--7-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(236, 231, 223, 1)", "secondaryAlbedo": "rgba(236, 231, 223, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_planter__7_12.add(mesh_planter__7_12);
  meshes["planter--7"] = mesh_planter__7_12;
  colliders["planter--7"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["planter--7"] ??= [];
  destructionGroups["planter--7"].push(node_planter__7_12);

  const attachment_planter_7_13 = {"parentSocket": "root/support-planter-7", "localStart": [0, 0, 0], "localEnd": [0, 0.5, 0], "contactType": "surface-contact", "overlap": 0.02, "embedDepth": 0.02, "gapTolerance": 0.002};
  const endpoint_planter_7_13 = makeAttachmentEndpoint(attachment_planter_7_13);
  const node_planter_7_13 = new THREE.Group();
  node_planter_7_13.name = "planter-7__pivot";
  node_planter_7_13.scale.set(1, 1, 1);
  if (endpoint_planter_7_13) {
    node_planter_7_13.position.copy(endpoint_planter_7_13.start);
    node_planter_7_13.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_planter_7_13.position.set(7.0, 0.5, -1.2);
    node_planter_7_13.rotation.set(0.0, 0.0, 0.0);
  }
  node_planter_7_13.userData.sculptComponent = {"id": "planter-7", "name": "planter-7", "level": "meso", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentSocket": "root/support-planter-7", "localStart": [0, 0, 0], "localEnd": [0, 0.5, 0], "contactType": "surface-contact", "overlap": 0.02, "embedDepth": 0.02, "gapTolerance": 0.002}, "dimensions": {"width": 2.5, "height": 0.5, "depth": 2.5, "units": "relative", "confidence": 0.5, "radius": 1.25}, "transform": {"position": [7, 0.5, -1.2], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "planter-7", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "stone", "materialLayers": ["stone"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "planter-7-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(236, 231, 223, 1)", "secondaryAlbedo": "rgba(236, 231, 223, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_planter_7_13.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "planter-7", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_planter_7_13);
  nodes["planter-7"] = node_planter_7_13;
  const mesh_planter_7_13Geometry = endpoint_planter_7_13
    ? new THREE.CylinderGeometry(endpoint_planter_7_13.endRadius, endpoint_planter_7_13.baseRadius, endpoint_planter_7_13.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  if (!endpoint_planter_7_13) {
    mesh_planter_7_13Geometry.scale(2.5, 0.5, 2.5);
  }
  const mesh_planter_7_13 = new THREE.Mesh(
    mesh_planter_7_13Geometry,
    materialMap["stone"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_planter_7_13.name = "planter-7";
  if (endpoint_planter_7_13) {
    mesh_planter_7_13.position.copy(endpoint_planter_7_13.midpoint);
    mesh_planter_7_13.quaternion.copy(endpoint_planter_7_13.quaternion);
  }
  mesh_planter_7_13.castShadow = options.castShadow ?? true;
  mesh_planter_7_13.receiveShadow = options.receiveShadow ?? true;
  mesh_planter_7_13.userData.sculptComponent = {"id": "planter-7", "name": "planter-7", "level": "meso", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentSocket": "root/support-planter-7", "localStart": [0, 0, 0], "localEnd": [0, 0.5, 0], "contactType": "surface-contact", "overlap": 0.02, "embedDepth": 0.02, "gapTolerance": 0.002}, "dimensions": {"width": 2.5, "height": 0.5, "depth": 2.5, "units": "relative", "confidence": 0.5, "radius": 1.25}, "transform": {"position": [7, 0.5, -1.2], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "planter-7", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "stone", "materialLayers": ["stone"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "planter-7-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(236, 231, 223, 1)", "secondaryAlbedo": "rgba(236, 231, 223, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_planter_7_13.add(mesh_planter_7_13);
  meshes["planter-7"] = mesh_planter_7_13;
  colliders["planter-7"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["planter-7"] ??= [];
  destructionGroups["planter-7"].push(node_planter_7_13);

  const endpoint_arch_diffuser_14 = makeAttachmentEndpoint(null);
  const node_arch_diffuser_14 = new THREE.Group();
  node_arch_diffuser_14.name = "arch-diffuser__pivot";
  node_arch_diffuser_14.scale.set(1, 1, 1);
  if (endpoint_arch_diffuser_14) {
    node_arch_diffuser_14.position.copy(endpoint_arch_diffuser_14.start);
    node_arch_diffuser_14.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_arch_diffuser_14.position.set(0.0, 4.25, -3.3);
    node_arch_diffuser_14.rotation.set(0.0, 0.0, 0.0);
  }
  node_arch_diffuser_14.userData.sculptComponent = {"id": "arch-diffuser", "name": "arch-diffuser", "level": "micro", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.035, "height": 8, "depth": 0.035, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 4.25, -3.3], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "arch-diffuser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "diffuser", "materialLayers": ["diffuser"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "arch-diffuser-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 240, 208, 1)", "secondaryAlbedo": "rgba(255, 240, 208, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_arch_diffuser_14.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "arch-diffuser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_arch_diffuser_14);
  nodes["arch-diffuser"] = node_arch_diffuser_14;
  const mesh_arch_diffuser_14Geometry = endpoint_arch_diffuser_14
    ? new THREE.CylinderGeometry(endpoint_arch_diffuser_14.endRadius, endpoint_arch_diffuser_14.baseRadius, endpoint_arch_diffuser_14.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_arch_diffuser_14) {
    mesh_arch_diffuser_14Geometry.scale(0.035, 8.0, 0.035);
  }
  const mesh_arch_diffuser_14 = new THREE.Mesh(
    mesh_arch_diffuser_14Geometry,
    materialMap["diffuser"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_arch_diffuser_14.name = "arch-diffuser";
  if (endpoint_arch_diffuser_14) {
    mesh_arch_diffuser_14.position.copy(endpoint_arch_diffuser_14.midpoint);
    mesh_arch_diffuser_14.quaternion.copy(endpoint_arch_diffuser_14.quaternion);
  }
  mesh_arch_diffuser_14.castShadow = options.castShadow ?? true;
  mesh_arch_diffuser_14.receiveShadow = options.receiveShadow ?? true;
  mesh_arch_diffuser_14.userData.sculptComponent = {"id": "arch-diffuser", "name": "arch-diffuser", "level": "micro", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.035, "height": 8, "depth": 0.035, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 4.25, -3.3], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "arch-diffuser", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "diffuser", "materialLayers": ["diffuser"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "arch-diffuser-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 240, 208, 1)", "secondaryAlbedo": "rgba(255, 240, 208, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_arch_diffuser_14.add(mesh_arch_diffuser_14);
  meshes["arch-diffuser"] = mesh_arch_diffuser_14;
  colliders["arch-diffuser"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["arch-diffuser"] ??= [];
  destructionGroups["arch-diffuser"].push(node_arch_diffuser_14);

  const attachment_podium_band_15 = {"parentSocket": "root/support-podium-band", "localStart": [0, 0, 0], "localEnd": [0, 0.025, 0], "contactType": "surface-contact", "overlap": 0.02, "embedDepth": 0.02, "gapTolerance": 0.002};
  const endpoint_podium_band_15 = makeAttachmentEndpoint(attachment_podium_band_15);
  const node_podium_band_15 = new THREE.Group();
  node_podium_band_15.name = "podium-band__pivot";
  node_podium_band_15.scale.set(1, 1, 1);
  if (endpoint_podium_band_15) {
    node_podium_band_15.position.copy(endpoint_podium_band_15.start);
    node_podium_band_15.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_podium_band_15.position.set(0.0, 0.52, 0.0);
    node_podium_band_15.rotation.set(0.0, 0.0, 0.0);
  }
  node_podium_band_15.userData.sculptComponent = {"id": "podium-band", "name": "podium-band", "level": "micro", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentSocket": "root/support-podium-band", "localStart": [0, 0, 0], "localEnd": [0, 0.025, 0], "contactType": "surface-contact", "overlap": 0.02, "embedDepth": 0.02, "gapTolerance": 0.002}, "dimensions": {"width": 4.82, "height": 0.025, "depth": 4.82, "units": "relative", "confidence": 0.5, "radius": 2.41}, "transform": {"position": [0, 0.52, 0], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "podium-band", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "diffuser", "materialLayers": ["diffuser"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "podium-band-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 240, 208, 1)", "secondaryAlbedo": "rgba(255, 240, 208, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_podium_band_15.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "podium-band", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_podium_band_15);
  nodes["podium-band"] = node_podium_band_15;
  const mesh_podium_band_15Geometry = endpoint_podium_band_15
    ? new THREE.CylinderGeometry(endpoint_podium_band_15.endRadius, endpoint_podium_band_15.baseRadius, endpoint_podium_band_15.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  if (!endpoint_podium_band_15) {
    mesh_podium_band_15Geometry.scale(4.82, 0.025, 4.82);
  }
  const mesh_podium_band_15 = new THREE.Mesh(
    mesh_podium_band_15Geometry,
    materialMap["diffuser"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_podium_band_15.name = "podium-band";
  if (endpoint_podium_band_15) {
    mesh_podium_band_15.position.copy(endpoint_podium_band_15.midpoint);
    mesh_podium_band_15.quaternion.copy(endpoint_podium_band_15.quaternion);
  }
  mesh_podium_band_15.castShadow = options.castShadow ?? true;
  mesh_podium_band_15.receiveShadow = options.receiveShadow ?? true;
  mesh_podium_band_15.userData.sculptComponent = {"id": "podium-band", "name": "podium-band", "level": "micro", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentSocket": "root/support-podium-band", "localStart": [0, 0, 0], "localEnd": [0, 0.025, 0], "contactType": "surface-contact", "overlap": 0.02, "embedDepth": 0.02, "gapTolerance": 0.002}, "dimensions": {"width": 4.82, "height": 0.025, "depth": 4.82, "units": "relative", "confidence": 0.5, "radius": 2.41}, "transform": {"position": [0, 0.52, 0], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "podium-band", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "diffuser", "materialLayers": ["diffuser"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "podium-band-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 240, 208, 1)", "secondaryAlbedo": "rgba(255, 240, 208, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_podium_band_15.add(mesh_podium_band_15);
  meshes["podium-band"] = mesh_podium_band_15;
  colliders["podium-band"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["podium-band"] ??= [];
  destructionGroups["podium-band"].push(node_podium_band_15);

  const endpoint_floor_ring_16 = makeAttachmentEndpoint(null);
  const node_floor_ring_16 = new THREE.Group();
  node_floor_ring_16.name = "floor-ring__pivot";
  node_floor_ring_16.scale.set(1, 1, 1);
  if (endpoint_floor_ring_16) {
    node_floor_ring_16.position.copy(endpoint_floor_ring_16.start);
    node_floor_ring_16.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_floor_ring_16.position.set(0.0, 0.255, 0.0);
    node_floor_ring_16.rotation.set(0.0, 0.0, 0.0);
  }
  node_floor_ring_16.userData.sculptComponent = {"id": "floor-ring", "name": "floor-ring", "level": "micro", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 9.2, "height": 0.01, "depth": 9.2, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 0.255, 0], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "floor-ring", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "diffuser", "materialLayers": ["diffuser"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "floor-ring-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 240, 208, 1)", "secondaryAlbedo": "rgba(255, 240, 208, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_floor_ring_16.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "floor-ring", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_floor_ring_16);
  nodes["floor-ring"] = node_floor_ring_16;
  const mesh_floor_ring_16Geometry = endpoint_floor_ring_16
    ? new THREE.CylinderGeometry(endpoint_floor_ring_16.endRadius, endpoint_floor_ring_16.baseRadius, endpoint_floor_ring_16.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_floor_ring_16) {
    mesh_floor_ring_16Geometry.scale(9.2, 0.01, 9.2);
  }
  const mesh_floor_ring_16 = new THREE.Mesh(
    mesh_floor_ring_16Geometry,
    materialMap["diffuser"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_floor_ring_16.name = "floor-ring";
  if (endpoint_floor_ring_16) {
    mesh_floor_ring_16.position.copy(endpoint_floor_ring_16.midpoint);
    mesh_floor_ring_16.quaternion.copy(endpoint_floor_ring_16.quaternion);
  }
  mesh_floor_ring_16.castShadow = options.castShadow ?? true;
  mesh_floor_ring_16.receiveShadow = options.receiveShadow ?? true;
  mesh_floor_ring_16.userData.sculptComponent = {"id": "floor-ring", "name": "floor-ring", "level": "micro", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 9.2, "height": 0.01, "depth": 9.2, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 0.255, 0], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "floor-ring", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "diffuser", "materialLayers": ["diffuser"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "floor-ring-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 240, 208, 1)", "secondaryAlbedo": "rgba(255, 240, 208, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_floor_ring_16.add(mesh_floor_ring_16);
  meshes["floor-ring"] = mesh_floor_ring_16;
  colliders["floor-ring"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["floor-ring"] ??= [];
  destructionGroups["floor-ring"].push(node_floor_ring_16);

  const endpoint_deck_strip_17 = makeAttachmentEndpoint(null);
  const node_deck_strip_17 = new THREE.Group();
  node_deck_strip_17.name = "deck-strip__pivot";
  node_deck_strip_17.scale.set(1, 1, 1);
  if (endpoint_deck_strip_17) {
    node_deck_strip_17.position.copy(endpoint_deck_strip_17.start);
    node_deck_strip_17.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_deck_strip_17.position.set(0.0, 0.13, 1.71);
    node_deck_strip_17.rotation.set(0.0, 0.0, 0.0);
  }
  node_deck_strip_17.userData.sculptComponent = {"id": "deck-strip", "name": "deck-strip", "level": "micro", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 22, "height": 0.02, "depth": 0.02, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 0.13, 1.71], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "deck-strip", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "diffuser", "materialLayers": ["diffuser"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "deck-strip-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 240, 208, 1)", "secondaryAlbedo": "rgba(255, 240, 208, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_deck_strip_17.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "deck-strip", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_deck_strip_17);
  nodes["deck-strip"] = node_deck_strip_17;
  const mesh_deck_strip_17Geometry = endpoint_deck_strip_17
    ? new THREE.CylinderGeometry(endpoint_deck_strip_17.endRadius, endpoint_deck_strip_17.baseRadius, endpoint_deck_strip_17.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_deck_strip_17) {
    mesh_deck_strip_17Geometry.scale(22.0, 0.02, 0.02);
  }
  const mesh_deck_strip_17 = new THREE.Mesh(
    mesh_deck_strip_17Geometry,
    materialMap["diffuser"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_deck_strip_17.name = "deck-strip";
  if (endpoint_deck_strip_17) {
    mesh_deck_strip_17.position.copy(endpoint_deck_strip_17.midpoint);
    mesh_deck_strip_17.quaternion.copy(endpoint_deck_strip_17.quaternion);
  }
  mesh_deck_strip_17.castShadow = options.castShadow ?? true;
  mesh_deck_strip_17.receiveShadow = options.receiveShadow ?? true;
  mesh_deck_strip_17.userData.sculptComponent = {"id": "deck-strip", "name": "deck-strip", "level": "micro", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 22, "height": 0.02, "depth": 0.02, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 0.13, 1.71], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "deck-strip", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "diffuser", "materialLayers": ["diffuser"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "deck-strip-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(255, 240, 208, 1)", "secondaryAlbedo": "rgba(255, 240, 208, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_deck_strip_17.add(mesh_deck_strip_17);
  meshes["deck-strip"] = mesh_deck_strip_17;
  colliders["deck-strip"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["deck-strip"] ??= [];
  destructionGroups["deck-strip"].push(node_deck_strip_17);

  const endpoint_tile_joints_18 = makeAttachmentEndpoint(null);
  const node_tile_joints_18 = new THREE.Group();
  node_tile_joints_18.name = "tile-joints__pivot";
  node_tile_joints_18.scale.set(1, 1, 1);
  if (endpoint_tile_joints_18) {
    node_tile_joints_18.position.copy(endpoint_tile_joints_18.start);
    node_tile_joints_18.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tile_joints_18.position.set(0.0, 0.001, 0.0);
    node_tile_joints_18.rotation.set(0.0, 0.0, 0.0);
  }
  node_tile_joints_18.userData.sculptComponent = {"id": "tile-joints", "name": "tile-joints", "level": "micro", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.008, "height": 0.001, "depth": 24, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 0.001, 0], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tile-joints", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "champagne", "materialLayers": ["champagne"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "tile-joints-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 169, 121, 1)", "secondaryAlbedo": "rgba(200, 169, 121, 1)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_tile_joints_18.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tile-joints", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_tile_joints_18);
  nodes["tile-joints"] = node_tile_joints_18;
  const mesh_tile_joints_18Geometry = endpoint_tile_joints_18
    ? new THREE.CylinderGeometry(endpoint_tile_joints_18.endRadius, endpoint_tile_joints_18.baseRadius, endpoint_tile_joints_18.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_tile_joints_18) {
    mesh_tile_joints_18Geometry.scale(0.008, 0.001, 24.0);
  }
  const mesh_tile_joints_18 = new THREE.Mesh(
    mesh_tile_joints_18Geometry,
    materialMap["champagne"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tile_joints_18.name = "tile-joints";
  if (endpoint_tile_joints_18) {
    mesh_tile_joints_18.position.copy(endpoint_tile_joints_18.midpoint);
    mesh_tile_joints_18.quaternion.copy(endpoint_tile_joints_18.quaternion);
  }
  mesh_tile_joints_18.castShadow = options.castShadow ?? true;
  mesh_tile_joints_18.receiveShadow = options.receiveShadow ?? true;
  mesh_tile_joints_18.userData.sculptComponent = {"id": "tile-joints", "name": "tile-joints", "level": "micro", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.008, "height": 0.001, "depth": 24, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 0.001, 0], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tile-joints", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "champagne", "materialLayers": ["champagne"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "tile-joints-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(200, 169, 121, 1)", "secondaryAlbedo": "rgba(200, 169, 121, 1)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_tile_joints_18.add(mesh_tile_joints_18);
  meshes["tile-joints"] = mesh_tile_joints_18;
  colliders["tile-joints"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["tile-joints"] ??= [];
  destructionGroups["tile-joints"].push(node_tile_joints_18);

  const endpoint_plant_branches_19 = makeAttachmentEndpoint(null);
  const node_plant_branches_19 = new THREE.Group();
  node_plant_branches_19.name = "plant-branches__pivot";
  node_plant_branches_19.scale.set(1, 1, 1);
  if (endpoint_plant_branches_19) {
    node_plant_branches_19.position.copy(endpoint_plant_branches_19.start);
    node_plant_branches_19.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_plant_branches_19.position.set(-7.0, 1.3, -1.2);
    node_plant_branches_19.rotation.set(0.0, 0.0, 0.0);
  }
  node_plant_branches_19.userData.sculptComponent = {"id": "plant-branches", "name": "plant-branches", "level": "micro", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.01, "height": 1.3, "depth": 0.01, "units": "relative", "confidence": 0.5}, "transform": {"position": [-7, 1.3, -1.2], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "plant-branches", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "foliage", "materialLayers": ["foliage"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "plant-branches-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(171, 128, 80, 1)", "secondaryAlbedo": "rgba(171, 128, 80, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_plant_branches_19.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "plant-branches", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_plant_branches_19);
  nodes["plant-branches"] = node_plant_branches_19;
  const mesh_plant_branches_19Geometry = endpoint_plant_branches_19
    ? new THREE.CylinderGeometry(endpoint_plant_branches_19.endRadius, endpoint_plant_branches_19.baseRadius, endpoint_plant_branches_19.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_plant_branches_19) {
    mesh_plant_branches_19Geometry.scale(0.01, 1.3, 0.01);
  }
  const mesh_plant_branches_19 = new THREE.Mesh(
    mesh_plant_branches_19Geometry,
    materialMap["foliage"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_plant_branches_19.name = "plant-branches";
  if (endpoint_plant_branches_19) {
    mesh_plant_branches_19.position.copy(endpoint_plant_branches_19.midpoint);
    mesh_plant_branches_19.quaternion.copy(endpoint_plant_branches_19.quaternion);
  }
  mesh_plant_branches_19.castShadow = options.castShadow ?? true;
  mesh_plant_branches_19.receiveShadow = options.receiveShadow ?? true;
  mesh_plant_branches_19.userData.sculptComponent = {"id": "plant-branches", "name": "plant-branches", "level": "micro", "role": "architecture", "importance": 1.0, "confidence": 0.85, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rigid architectural solid with observed planar or circular cross-section.", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.012, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.01, "height": 1.3, "depth": 0.01, "units": "relative", "confidence": 0.5}, "transform": {"position": [-7, 1.3, -1.2], "rotation": [0, 0, 0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "plant-branches", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "foliage", "materialLayers": ["foliage"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "plant-branches-detail", "type": "bevel", "description": "Small physical edge bevel catches daylight", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(171, 128, 80, 1)", "secondaryAlbedo": "rgba(171, 128, 80, 1)", "materialClass": "stone", "materialClassConfidence": 0.8, "evidenceRefs": ["full-object"]}};
  node_plant_branches_19.add(mesh_plant_branches_19);
  meshes["plant-branches"] = mesh_plant_branches_19;
  colliders["plant-branches"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["plant-branches"] ??= [];
  destructionGroups["plant-branches"].push(node_plant_branches_19);

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createIvoryIlluminatedArchitecturalShowroomLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Ivory illuminated architectural showroom look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = [{"keyLight": {"type": "directional", "direction": [-5, 7, 4], "color": "#fff7ed", "intensity": 3}, "fillLight": {"type": "hemisphere", "color": "#fffaf2", "intensity": 1}, "environmentLight": {"type": "PMREM", "intensity": 0.7}, "exposure": 1, "toneMapping": "ACESFilmic", "background": "#e9e0d4", "contactShadow": "PCF soft; directional broad source; podium grounded", "localLights": "Warm recessed area lights behind arch and slots, 2700K approximation"}, "Fill light hemisphere ivory .9; environment PMREM .7", "Warm recessed rim lights; exposure 1 ACES filmic; soft contact shadow on deck"];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createIvoryIlluminatedArchitecturalShowroomEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameIvoryIlluminatedArchitecturalShowroomCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createIvoryIlluminatedArchitecturalShowroomPresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureIvoryIlluminatedArchitecturalShowroomRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createIvoryIlluminatedArchitecturalShowroomInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
