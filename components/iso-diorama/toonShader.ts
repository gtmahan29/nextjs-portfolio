import * as THREE from "three";
import { ZoneUniformState } from "./types";

export interface CelMaterialOptions {
  color: string | number;
  zone: ZoneUniformState;
  emissiveColor?: string | number;
  baseEmissive?: number;
  glowBoost?: number;
  keepGlowInDim?: number;
  map?: THREE.Texture | null;
  opacity?: number;
  transparent?: boolean;
  side?: THREE.Side;
  flatShading?: boolean;
}

const CEL_VERTEX = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vViewPos;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPos = -mvPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const CEL_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uEmissive;
  uniform float uBaseEmissive;
  uniform float uGlowBoost;
  uniform float uKeepGlowInDim;
  uniform float uActive;
  uniform float uGlow;
  uniform float uOpacity;
  uniform float uHasMap;
  uniform sampler2D uMap;

  varying vec3 vWorldNormal;
  varying vec3 vViewPos;
  varying vec2 vUv;

  void main() {
    vec3 N = normalize(vWorldNormal);
    if (!gl_FrontFacing) {
      N = -N;
    }

    vec3 baseCol = uColor;
    if (uHasMap > 0.5) {
      vec4 tex = texture2D(uMap, vUv);
      baseCol *= tex.rgb;
    }

    // Isometric key sun + subtle bounce fill
    vec3 sunDir = normalize(vec3(0.56, 0.86, 0.44));
    vec3 fillDir = normalize(vec3(-0.6, 0.35, -0.5));
    float ndl = dot(N, sunDir);
    float ndf = max(dot(N, fillDir), 0.0);

    // 3 crisp cel-shaded bands matching vector-3D illustration style
    float cel = 0.66;
    if (ndl > 0.45) {
      cel = 1.04;
    } else if (ndl > 0.02) {
      cel = 0.89;
    } else if (ndl > -0.35) {
      cel = 0.76;
    }
    cel += ndf * 0.06;

    vec3 litColor = baseCol * cel;

    // Subtle rim highlight when the zone is active & glowing
    vec3 V = normalize(vViewPos);
    float fresnel = pow(1.0 - max(dot(normalize((viewMatrix * vec4(N, 0.0)).xyz), V), 0.0), 2.8);
    litColor += uEmissive * fresnel * uGlow * 0.22;

    // Desaturated dark charcoal cel palette when inactive (matches spotlight video)
    float lum = dot(litColor, vec3(0.299, 0.587, 0.114));
    vec3 dimColor = mix(vec3(0.085, 0.085, 0.095), vec3(0.26, 0.26, 0.28), clamp(lum * 0.92, 0.0, 1.0));
    vec3 finalColor = mix(dimColor, litColor, uActive);

    // Emissive accent (HTML tube, SEO waves, drone heart, server LEDs)
    float activeFactor = mix(uKeepGlowInDim, 1.0, uActive);
    float emissiveAmt = (uBaseEmissive + uGlow * uGlowBoost) * activeFactor;
    finalColor += uEmissive * emissiveAmt;

    gl_FragColor = vec4(finalColor, uOpacity);
  }
`;

export function createCelMaterial(opts: CelMaterialOptions): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(opts.color) },
      uEmissive: { value: new THREE.Color(opts.emissiveColor ?? opts.color) },
      uBaseEmissive: { value: opts.baseEmissive ?? 0 },
      uGlowBoost: { value: opts.glowBoost ?? 0 },
      uKeepGlowInDim: { value: opts.keepGlowInDim ?? 0.08 },
      uActive: opts.zone.uActive,
      uGlow: opts.zone.uGlow,
      uOpacity: { value: opts.opacity ?? 1 },
      uHasMap: { value: opts.map ? 1 : 0 },
      uMap: { value: opts.map ?? null },
    },
    vertexShader: CEL_VERTEX,
    fragmentShader: CEL_FRAGMENT,
    transparent: opts.transparent ?? (opts.opacity !== undefined && opts.opacity < 1),
    side: opts.side ?? THREE.FrontSide,
    depthWrite: opts.opacity === undefined || opts.opacity >= 1,
  });
}

export function createInkOutlineMaterial(
  zone: ZoneUniformState,
  thickness = 0.032
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uThickness: { value: thickness },
      uActive: zone.uActive,
    },
    vertexShader: /* glsl */ `
      uniform float uThickness;
      void main() {
        vec3 displaced = position + normalize(normal) * uThickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uActive;
      void main() {
        vec3 col = mix(vec3(0.05, 0.05, 0.06), vec3(0.085, 0.085, 0.1), uActive);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
  });
}

export function createEdgeLineMaterial(zone: ZoneUniformState): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uActive: zone.uActive,
    },
    vertexShader: /* glsl */ `
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uActive;
      void main() {
        vec3 col = mix(vec3(0.055, 0.055, 0.065), vec3(0.09, 0.09, 0.11), uActive);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export interface CanvasTextureOptions {
  width?: number;
  height?: number;
  bg: string;
  fg?: string;
  accent?: string;
  border?: string;
  font?: string;
  draw?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

export function createCanvasTexture(opts: CanvasTextureOptions): THREE.CanvasTexture {
  const w = opts.width ?? 512;
  const h = opts.height ?? 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = opts.bg;
    ctx.fillRect(0, 0, w, h);
    if (opts.draw) {
      opts.draw(ctx, w, h);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function createTextLabelTexture(
  text: string,
  {
    bg = "#FFFFFF",
    fg = "#151519",
    border = "#151519",
    width = 512,
    height = 256,
    fontSize = 112,
    radius = 28,
    subBadge,
  }: {
    bg?: string;
    fg?: string;
    border?: string;
    width?: number;
    height?: number;
    fontSize?: number;
    radius?: number;
    subBadge?: "search" | "dots" | "none";
  } = {}
): THREE.CanvasTexture {
  return createCanvasTexture({
    width,
    height,
    bg,
    draw: (ctx, w, h) => {
      // Rounded border frame
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = border;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.roundRect(8, 8, w - 16, h - 16, radius);
      ctx.stroke();

      if (subBadge === "dots") {
        const dotColors = [fg, fg, fg];
        dotColors.forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(38 + i * 24, 34, 6, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      if (subBadge === "search") {
        // Purple search icon pill on the right
        ctx.fillStyle = "#6F64D3";
        ctx.beginPath();
        ctx.roundRect(w - 118, 22, 92, h - 44, 18);
        ctx.fill();
        ctx.strokeStyle = border;
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(w - 76, h / 2 - 4, 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(w - 63, h / 2 + 10);
        ctx.lineTo(w - 49, h / 2 + 24);
        ctx.stroke();
      }

      ctx.fillStyle = fg;
      ctx.font = `900 ${fontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.textBaseline = "middle";
      if (subBadge === "search") {
        ctx.textAlign = "left";
        ctx.fillText(text, 34, h / 2 + 4);
      } else {
        ctx.textAlign = "center";
        ctx.fillText(text, w / 2, h / 2 + 4);
      }
    },
  });
}

export function createCardSkeletonTexture(accentHex: string): THREE.CanvasTexture {
  return createCanvasTexture({
    width: 320,
    height: 400,
    bg: "#FFFFFF",
    draw: (ctx, w, h) => {
      ctx.strokeStyle = "#17171B";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.roundRect(8, 8, w - 16, h - 16, 22);
      ctx.stroke();

      // Header bar
      ctx.fillStyle = accentHex;
      ctx.beginPath();
      ctx.roundRect(24, 24, w - 48, 34, 10);
      ctx.fill();

      // 3 dots
      [0, 1, 2].forEach((i) => {
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(44 + i * 20, 41, 5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Hero skeleton block
      ctx.fillStyle = "#ECEAF6";
      ctx.beginPath();
      ctx.roundRect(24, 76, w - 48, 96, 12);
      ctx.fill();

      // Text lines
      const lines = [
        [24, 196, w - 70],
        [24, 226, w - 110],
        [24, 266, w - 58],
        [24, 296, w - 130],
        [24, 336, w - 85],
      ];
      ctx.fillStyle = "#D4D2E4";
      for (const [x, y, lw] of lines) {
        ctx.beginPath();
        ctx.roundRect(x, y, lw, 14, 7);
        ctx.fill();
      }
    },
  });
}

export function createServerRackTexture(accentHex: string, ledHex: string): THREE.CanvasTexture {
  return createCanvasTexture({
    width: 256,
    height: 512,
    bg: accentHex,
    draw: (ctx, w, h) => {
      ctx.strokeStyle = "#17171B";
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, w - 8, h - 8);

      // Rack bay slots
      const rows = 9;
      for (let i = 0; i < rows; i++) {
        const y = 28 + i * 50;
        ctx.fillStyle = "rgba(255,255,255,0.16)";
        ctx.beginPath();
        ctx.roundRect(22, y, w - 44, 34, 6);
        ctx.fill();
        ctx.strokeStyle = "#17171B";
        ctx.lineWidth = 3;
        ctx.stroke();

        // Vent lines
        ctx.fillStyle = "#17171B";
        for (let v = 0; v < 5; v++) {
          ctx.fillRect(36 + v * 16, y + 12, 8, 10);
        }

        // Glowing LEDs
        ctx.fillStyle = i % 2 === 0 ? "#FFF4D2" : ledHex;
        ctx.beginPath();
        ctx.arc(w - 54, y + 17, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(w - 36, y + 17, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  });
}

export function createHeartBadgeTexture(bgHex: string): THREE.CanvasTexture {
  return createCanvasTexture({
    width: 256,
    height: 256,
    bg: bgHex,
    draw: (ctx, w, h) => {
      ctx.strokeStyle = "#16161A";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.roundRect(10, 10, w - 20, h - 20, 46);
      ctx.stroke();

      // White crisp heart
      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "#16161A";
      ctx.lineWidth = 6;
      ctx.beginPath();
      const cx = w / 2;
      const cy = h / 2 + 12;
      ctx.moveTo(cx, cy + 52);
      ctx.bezierCurveTo(cx - 88, cy - 4, cx - 72, cy - 78, cx, cy - 28);
      ctx.bezierCurveTo(cx + 72, cy - 78, cx + 88, cy - 4, cx, cy + 52);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    },
  });
}

export function createTileGridTexture(
  topHex: string,
  lineHex: string,
  cells = 6
): THREE.CanvasTexture {
  return createCanvasTexture({
    width: 512,
    height: 512,
    bg: topHex,
    draw: (ctx, w, h) => {
      ctx.strokeStyle = lineHex;
      ctx.lineWidth = 2.5;
      const step = w / cells;
      for (let i = 1; i < cells; i++) {
        const p = i * step;
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, h);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, p);
        ctx.lineTo(w, p);
        ctx.stroke();
      }
      ctx.strokeStyle = "#16161A";
      ctx.lineWidth = 8;
      ctx.strokeRect(3, 3, w - 6, h - 6);
    },
  });
}
