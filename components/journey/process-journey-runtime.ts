import { createUnlockChapter, UNLOCK_SCROLL_VH } from "./unlock-chapter";
import {CASE_VISIBILITY_EVENT, isCaseStudyOpen} from "./case-scene-visibility";
import * as THREE from "three";
import { FOCUS, STATIONS } from "./data";
import { buildStation, type Extras } from "./buildings";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createDotTrail } from "./dot-trail";
import { CAMERA_ELEVATION, CAMERA_YAW, createCameraProgress, createTravelTrack, scrollToStory, storyToScroll } from "./camera-motion";
import { stretchJourneyZ } from "./world-layout";
import { buildStationDistrict, buildInterstationDistricts, insideDistrict, type DistrictFootprint } from "./district-buildings";
import { mountPhaseDioramas } from "./imported-models/phase-dioramas";
import { mountMeshyResidents } from "./meshy-residents";
import {smoothScrollTo} from "@/components/smooth-scroll";
import { createStagedMotion, BEFORE, AFTER } from "./staged-motion";
import { createSpring, SPRING_PEAK } from "./motion-curve";
import { play } from "./sfx";
import { glyphPath } from "./stage-glyphs";
import { createEntryPaper } from "./spark-material";
import { ENTRY_CENTER, ENTRY_REVEAL, ENTRY_SPACE } from "./spark-cube";
import { createFinalCube } from "./final-cube";
import { createSceneProfiler } from "./scene-profiler";

import type {SceneContext} from "./use-scene-runtime";
import {SceneScope,yieldToMain,queueSceneSetup} from "./scene-loading";
import {warmShowroom as warmScene} from './showroom-warmup';
import {AdaptiveSceneQuality,scenePixelRatio} from "./scene-quality";
import {disposeSceneResources} from "./scene-resources";

const sm = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const ROUTE: [number, number][] = ([
  [0, 0],       // Station 1: The Spark; the journey begins here.
  [35, 0],
  [70, 0],
  [105, 0],
  [140, 0],     // Station 2: Taking Shape
  [158, 2],     // Turn 1 (Curved 90° corner from +X to +Z)
  [173, 11],
  [182, 26],
  [185, 45],
  [185, 75],
  [185, 110],   // Station 3: Building the System
  [185, 140],
  [188, 162],   // Turn 2 (Curved 90° smooth sweep from +Z to +X)
  [197, 180],
  [212, 196],
  [232, 206],
  [255, 210],
  [290, 210],
  [325, 210],   // Station 4: Coming Alive
  [365, 210],
  [405, 210],
  [445, 210],
  [485, 210],   // Station 5: Growing
  [525, 210],
  [565, 210],
  [605, 210],
  [645, 210],   // Station 6: Out in the World
  [685, 210],
  [725, 210],
] as [number, number][]).map(([x, z]) => [x, stretchJourneyZ(z)]);
const ST_INDEX = [0, 4, 10, 18, 22, 26];

const CAMERA_DISTANCE = 142;
const FINAL_FRAMING = createTravelTrack([[0, 0], [.74, 0], [.85, 1], [1, 1]]);
const FIFTH_FRAMING = createTravelTrack([[0, 0], [.60, 0], [.70, 1], [1, 1]]);

export async function mountScene({canvas,section,signal,quality}:SceneContext) {
  const scope=new SceneScope(signal);
  try {

    const header = document.querySelector<HTMLElement>(".jny-header");
    const showroomStage=document.querySelector('.lumen-stage');
    const journeyStage=section.querySelector<HTMLElement>('.jny-stage');
    const screenHidden=()=>section.dataset.screenOccluded==='true';
    const lowPower = quality.tier === "low";
    const adaptive = new AdaptiveSceneQuality(quality);


    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: lowPower ? "low-power" : "high-performance" });
    } catch {
      throw new Error("WebGL renderer unavailable");
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile0 = window.innerWidth < 860;
    renderer.setPixelRatio(scenePixelRatio(quality,canvas.clientWidth,canvas.clientHeight,devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    const BG = new THREE.Color("#cfdce8");
    const scene = new THREE.Scene();
    let initialized=false;
    scope.defer(()=>{if(!initialized){disposeSceneResources(scene);renderer.dispose();}});
    scene.background = BG;
    const environmentGenerator = new THREE.PMREMGenerator(renderer);
    const studio = new RoomEnvironment();
    const environment = environmentGenerator.fromScene(studio, .04);
    scene.environment = environment.texture;
    studio.dispose();
    environmentGenerator.dispose();
    scope.defer(()=>environment.dispose());
    const fog = new THREE.Fog(BG, 130, 360);
    scene.fog = fog;
    const camera = new THREE.PerspectiveCamera(20, 1, 0.5, 2600);
    camera.layers.enable(1);
    const entryPaperMesh = createEntryPaper();
    scene.add(entryPaperMesh);
    const conversationField = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false,
      uniforms: { opacity: { value: 0 }, center: { value: new THREE.Vector2(.5,.5) }, aspect: { value: 1 } },
      vertexShader: "varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",
      // The dark room is not faded in: it grows as a circle out of the cube.
      fragmentShader: `uniform float opacity; uniform vec2 center; uniform float aspect; varying vec2 vUv;
        void main(){
          vec2 d=(vUv-center)*vec2(aspect,1.);
          float radius=opacity*1.9*max(aspect,1.);
          float iris=1.-smoothstep(radius-.004,radius,length(d));
          if(iris<=0.)discard;
          vec2 p=vUv-vec2(.5,.5);
          float glow=exp(-6.*dot(p*vec2(1.2,1.),p*vec2(1.2,1.)));
          float violet=exp(-15.*dot(vUv-vec2(.2,.3),vUv-vec2(.2,.3)));
          vec3 color=vec3(.0015,.002,.006)+glow*vec3(.006,.007,.012)+violet*vec3(.005,.0015,.013);
          gl_FragColor=vec4(color,iris);
          #include <colorspace_fragment>
        }`,
    }));
    conversationField.layers.set(1);
    conversationField.renderOrder = 99;
    conversationField.frustumCulled = false;
    conversationField.visible = false;
    scene.add(conversationField);

    const ambient = new THREE.HemisphereLight("#ffffff", "#aabdd2", .65);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight("#ffffff", 2.1);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(quality.shadows);
    sun.shadow.radius = 8;
    sun.shadow.blurSamples = 16;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    const SUN_DIR = new THREE.Vector3(26, 62, -18).normalize();
    const STUDIO_KEY_DIR = new THREE.Vector3(-36, 62, 45).normalize();
    const lightDirection = new THREE.Vector3();

    const PAL = {
      w: "#e7edf5",
      w2: "#d9e2ee",
      w3: "#ccd7e5",
      dark: "#aebfd4",
      floor: "#c9d8e6",
      path: "#dfe8f2",
    };
    const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, ...extra });

    const pool = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std("#ffffff"), 2600);
    pool.castShadow = true;
    pool.receiveShadow = true;
    pool.count = 0;
    scene.add(pool);
    let pi = 0;
    const _m4 = new THREE.Matrix4();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3();
    const _p = new THREE.Vector3();
    const _e = new THREE.Euler();
    const _c = new THREE.Color();
    const B = (x: number, y: number, z: number, w: number, h: number, d: number, col: string = PAL.w, ry = 0) => {
      _p.set(x, y + h / 2, z);
      _q.setFromEuler(_e.set(0, ry, 0));
      _s.set(w, h, d);
      _m4.compose(_p, _q, _s);
      pool.setMatrixAt(pi, _m4);
      pool.setColorAt(pi, _c.set(col));
      pi++;
    };

    const GROUND_Y = -3.4;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), std(PAL.floor));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(330, GROUND_Y, 185);
    ground.receiveShadow = true;
    scene.add(ground);

    const tableTop = new THREE.Mesh(new RoundedBoxGeometry(940, 1.6, 620, 2, 0.65), std("#e6eef6", { roughness: 0.32, metalness: 0.08 }));
    tableTop.position.set(330, -0.8, 185);
    tableTop.receiveShadow = true;
    scene.add(tableTop);
    const tableBase = new THREE.Mesh(new RoundedBoxGeometry(916, 2.1, 596, 2, 2.0), std("#ccd8e6"));
    tableBase.position.set(330, -2.35, 185);
    tableBase.receiveShadow = true;
    scene.add(tableBase);

    // Low-contrast, softly filtered real reflections on the polished tabletop.
    const reflection = new Reflector(new THREE.PlaneGeometry(938, 618), {
      textureWidth: quality.reflectionSize,
      textureHeight: quality.reflectionSize,
      clipBias: 0.003,
      multisample: 0,
      shader: {
        name: "StudioFloorReflection",
        uniforms: { tDiffuse: { value: null }, color: { value: null }, textureMatrix: { value: null }, uTexel: { value: 1 / quality.reflectionSize } },
        vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; void main(){ vUv=textureMatrix*vec4(position,1.); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: `uniform sampler2D tDiffuse; uniform float uTexel; varying vec4 vUv;
          void main(){ vec2 uv=vUv.xy/vUv.w;
            vec2 edge=min(uv,1.-uv); if(min(edge.x,edge.y)<.004) discard;
            float fade=smoothstep(.004,.04,min(edge.x,edge.y));
            vec3 c=texture2D(tDiffuse,uv).rgb*.4;
            c+=texture2D(tDiffuse,uv+vec2(uTexel*2.,0.)).rgb*.15;
            c+=texture2D(tDiffuse,uv-vec2(uTexel*2.,0.)).rgb*.15;
            c+=texture2D(tDiffuse,uv+vec2(0.,uTexel*2.)).rgb*.15;
            c+=texture2D(tDiffuse,uv-vec2(0.,uTexel*2.)).rgb*.15;
            gl_FragColor=vec4(c,.16*fade);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      },
    });
    scope.defer(()=>reflection.dispose());
    reflection.rotation.x = -Math.PI / 2;
    reflection.position.set(330, 0.012, 185);
    (reflection.material as THREE.ShaderMaterial).transparent = true;
    (reflection.material as THREE.ShaderMaterial).depthWrite = false;
    reflection.renderOrder = 1;
    scene.add(reflection);
    // Small/coarse-pointer devices keep PBR highlights without a second scene render.
    let reflectionsEnabled = quality.tier === "high";
    reflection.visible = reflectionsEnabled;
    const renderReflection = reflection.onBeforeRender;
    let lastReflection = -Infinity;
    const reflectionCameraPosition = new THREE.Vector3(Infinity, Infinity, Infinity);
    reflection.onBeforeRender = (...args) => {
      const now = performance.now();
      // Reuse a reflection only at a stable view; camera travel must never smear it.
      if (now - lastReflection < 50 && camera.position.distanceToSquared(reflectionCameraPosition) < .001) return;
      lastReflection = now;
      reflectionCameraPosition.copy(camera.position);
      renderReflection.apply(reflection, args);
    };

    const underShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 760),
      new THREE.MeshBasicMaterial({ map: (() => {
        const c = document.createElement("canvas");
        c.width = c.height = 256;
        const g = c.getContext("2d")!;
        const gr = g.createRadialGradient(128, 128, 30, 128, 128, 128);
        gr.addColorStop(0, "rgba(28,42,64,.30)");
        gr.addColorStop(0.6, "rgba(28,42,64,.13)");
        gr.addColorStop(1, "rgba(28,42,64,0)");
        g.fillStyle = gr;
        g.fillRect(0, 0, 256, 256);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
      })(), transparent: true, depthWrite: false })
    );
    underShadow.rotation.x = -Math.PI / 2;
    underShadow.position.set(330, GROUND_Y + 0.02, 185);
    scene.add(underShadow);

    const curve = new THREE.CatmullRomCurve3(
      ROUTE.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false,
      "centripetal"
    );
    const L = curve.getLength();
    const sAt = (x: number, z: number) => {
      let best = 1e9;
      let bestU = 0;
      for (let i = 0; i <= 2200; i++) {
        const rp = curve.getPointAt(i / 2200);
        const d = (rp.x - x) ** 2 + (rp.z - z) ** 2;
        if (d < best) {
          best = d;
          bestU = i / 2200;
        }
      }
      return bestU * L;
    };
    const STOP = ST_INDEX.map((ri) => sAt(ROUTE[ri][0], ROUTE[ri][1]));

    const podKeys: number[][] = [
      [0.0, 0],
      [0.14, STOP[0]],
      [0.18, STOP[0]],
      [0.28, STOP[1]],
      [0.32, STOP[1]],
      [0.42, STOP[2]],
      [0.46, STOP[2]],
      [0.56, STOP[3]],
      [0.60, STOP[3]],
      [0.70, STOP[4]],
      [0.74, STOP[4]],
      [0.85, STOP[5]],
      [0.89, STOP[5]],
      [1.0, L - 4],
    ];
    const POD = createTravelTrack(podKeys);

    const radial = (inner: string, mid: string) => {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d")!;
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, inner);
      gr.addColorStop(0.35, mid);
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const glowTex = radial("rgba(255,255,255,1)", "rgba(255,255,255,.5)");
    const contactTex = (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d")!;
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, "rgba(18,30,52,.38)");
      gr.addColorStop(0.55, "rgba(18,30,52,.15)");
      gr.addColorStop(1, "rgba(18,30,52,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();

    const trailUniforms = {
      uH: { value: 0 },
      uO: { value: 1 },
      uLen: { value: L },
    };
    const coreMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: trailUniforms,
      vertexShader: `varying vec2 vUv; varying float vF; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vec3 n=normalize(normalMatrix*normal); vF=abs(dot(n,normalize(-mv.xyz))); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform float uH,uO,uLen; varying vec2 vUv; varying float vF; void main(){
        float b=(uH-vUv.x)*uLen; if(b<0.) discard;
        float tip=smoothstep(0.,.12,b); float hot=exp(-b/6.);
        vec3 col=mix(vec3(.14,.63,.87),vec3(.87,.99,1.),hot*.85+.1*vF);
        float a=tip*(.78+.22*vF)*uO;
        gl_FragColor=vec4(col,a); }`,
    });
    const haloMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: trailUniforms,
      vertexShader: coreMat.vertexShader,
      fragmentShader: `uniform float uH,uO,uLen; varying vec2 vUv; varying float vF; void main(){
        float b=(uH-vUv.x)*uLen; if(b<0.) discard;
        float a=smoothstep(0.,.8,b)*(exp(-b/9.)*.35+.035)*pow(vF,2.)*uO;
        gl_FragColor=vec4(vec3(.42,.85,1.)*a,1.); }`,
    });
    const coreGeo = new THREE.TubeGeometry(curve, lowPower ? 900 : 1800, 0.24, lowPower ? 6 : 8, false);
    coreGeo.translate(0, 0.32, 0);
    const haloGeo = new THREE.TubeGeometry(curve, lowPower ? 900 : 1800, 0.64, lowPower ? 6 : 8, false);
    haloGeo.translate(0, 0.32, 0);
    const trailCore = new THREE.Mesh(coreGeo, coreMat);
    const trailHalo = new THREE.Mesh(haloGeo, haloMat);
    trailCore.renderOrder = 5;
    trailHalo.renderOrder = 6;
    trailCore.frustumCulled = false;
    trailHalo.frustumCulled = false;
    scene.add(trailCore, trailHalo);

    // A small spherical continuation of the tube, rather than a camera-facing disc.
    const head = new THREE.Mesh(new THREE.SphereGeometry(.245,12,8), new THREE.MeshBasicMaterial({color:"#e6fbff"}));
    const headGlow = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:"#aee8ff",transparent:true,opacity:.4,depthWrite:false,blending:THREE.AdditiveBlending}));
    headGlow.scale.setScalar(.85); head.add(headGlow);
    head.renderOrder = 7;
    scene.add(head);
    const headLight = new THREE.PointLight(0xbfe6ff, 0, 36, 1.6);
    scene.add(headLight);

    const routeDots = createDotTrail(scene, 9, 1.4);
    const pointerDots = createDotTrail(scene, 12, 1.8);
    const pointerRay = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const pointerHit = new THREE.Vector3();
    const surfacePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let lastPointerX = -Infinity;
    let lastPointerY = -Infinity;
    const pointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" || (event.clientX === lastPointerX && event.clientY === lastPointerY)) return;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      const rect = canvas.getBoundingClientRect();
      pointerNdc.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
      pointerRay.setFromCamera(pointerNdc, camera);
      if (!pointerRay.ray.intersectPlane(surfacePlane, pointerHit)) return;
      if (pointerHit.x < -139 || pointerHit.x > 799 || pointerHit.z < -124 || pointerHit.z > 494) return;
      pointerDots.add(pointerHit.x, pointerHit.z, performance.now() / 1000);
    };
    const pointerLeave = () => { lastPointerX = lastPointerY = -Infinity; };
    section.addEventListener("pointermove", pointerMove);
    scope.defer(()=>{section.removeEventListener("pointermove",pointerMove);section.removeEventListener("pointerleave",pointerLeave);});
    section.addEventListener("pointerleave", pointerLeave);

    type StState = {
      idx: number;
      heading: number;
      cs: number;
      sn: number;
      px: number;
      pz: number;
      doorMat: THREE.MeshStandardMaterial;
      winMat: THREE.MeshStandardMaterial;
      ringMat: THREE.MeshStandardMaterial;
      lamp: THREE.PointLight;
      insideK: number;
      act: number;
      extras: Extras;
    };
    const stations: StState[] = [];
    const districtFootprints: DistrictFootprint[] = [];

    for (const [i,st] of Array.from(STATIONS.entries())) {
      const [px, pz] = ROUTE[ST_INDEX[i]];
      const ahead = ROUTE[ST_INDEX[i] + 1];
      const behind = ROUTE[Math.max(0, ST_INDEX[i] - 1)];
      const dir = new THREE.Vector2(ahead[0] - behind[0], ahead[1] - behind[1]).normalize();
      const heading = Math.atan2(dir.x, dir.y);
      const cs = Math.cos(heading);
      const sn = Math.sin(heading);
      const lx = (v: number, u: number): [number, number] => [px + v * cs + u * sn, pz - v * sn + u * cs];
      const accent = new THREE.Color(st.colorInt);
      const frameMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.4, roughness: 0.42 });
      const winMat = new THREE.MeshStandardMaterial({ color: "#eaf1fa", emissive: accent, emissiveIntensity: 0, roughness: 0.3 });
      const ringMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.3, roughness: 0.4 });

      const extras: Extras = i < 4 ? buildStation(st.building, {
        B, scene, heading, lx, px, pz, accent, accentHex: st.color, frameMat, winMat, stationData: st,
      }) : { cardGroup: null, cardBaseY: 0, beaconLight: null, crates: [], spins: [], sway: null,
        floats: [], inDoorGlow: null, outDoorGlow: null, pulseMeshes: [] };
      // Emissive station details provide accent color without extra global light loops.
      extras.beaconLight?.removeFromParent();
      extras.beaconLight = null;
      if (i < 4) districtFootprints.push(...buildStationDistrict({ B, scene, heading, lx, px, pz, accent, accentHex: st.color,
        frameMat, winMat, stationData: st }, i));

      const contact = new THREE.Mesh(
        new THREE.PlaneGeometry(34, 30),
        new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false })
      );
      contact.rotation.x = -Math.PI / 2;
      contact.position.set(px, 0.005, pz);
      if (i < 4) scene.add(contact);
      else { contact.geometry.dispose(); (contact.material as THREE.Material).dispose(); }

      const lamp = new THREE.PointLight(accent, 0, 42, 1.8);
      lamp.position.set(px, 3.5, pz);

      stations.push({
        idx: i,
        heading,
        cs,
        sn,
        px,
        pz,
        doorMat: frameMat,
        winMat,
        ringMat,
        lamp,
        insideK: 0,
        act: 0,
        extras,
      });
      await yieldToMain(signal);
    }

    districtFootprints.push(...buildInterstationDistricts(B, ROUTE, ST_INDEX));
    const phaseDioramas = mountPhaseDioramas(scene, [
      { idx: 4, px: stations[4].px, pz: stations[4].pz },
      { idx: 5, px: stations[5].px, pz: stations[5].pz },
    ], mobile0 ? 1.38 : 1, model => queueSceneSetup(signal,async()=>{
      await warmScene(renderer,model,camera,scope,signal,scene);
    }),{saveData:quality.tier==="low",onReady:()=>syncRendering()});

    scope.defer(()=>phaseDioramas.dispose());
    const meshyResidents = mountMeshyResidents(scene,
      stations.map(st => ({ x: st.px, z: st.pz, heading: st.heading })), ROUTE, ST_INDEX, {
      onReady: () => syncRendering(),
      anisotropy: renderer.capabilities.getMaxAnisotropy(),
      prepare: model => queueSceneSetup(signal, () => warmScene(renderer, model, camera, scope, signal, scene)),
    });
    scope.defer(()=>meshyResidents.dispose());
    await yieldToMain(signal);
    const treeSpots: [number, number, number][] = ([
      [-40, -18, 1.1],
      [-15, 18, 0.95],
      [25, -20, 1.0],
      [45, 22, 0.9],
      [75, -18, 1.05],
      [105, 20, 0.9],
      [155, 30, 1.0],
      [210, 35, 0.95],
      [155, 80, 0.9],
      [212, 85, 1.0],
      [158, 130, 1.05],
      [215, 125, 0.95],
      [160, 180, 0.9],
      [220, 175, 1.0],
      [240, 235, 0.95],
      [290, 185, 1.0],
      [300, 235, 0.95],
      [365, 185, 1.05],
      [380, 235, 0.9],
      [430, 185, 1.0],
      [445, 235, 1.05],
      [520, 185, 0.95],
      [535, 235, 0.9],
      [605, 185, 1.0],
      [615, 235, 1.05],
      [680, 185, 0.95],
      [685, 235, 0.9],
      [-20, -50, 1.2],
      [80, -45, 1.1],
      [140, -50, 1.15],
      [130, 60, 1.0],
      [270, 150, 1.1],
      [350, 150, 1.05],
      [500, 150, 1.1],
      [650, 150, 1.0],
      [350, 270, 1.05],
      [520, 270, 1.1],
    ] as [number, number, number][]).filter(([x, z]) => !insideDistrict(x, stretchJourneyZ(z), districtFootprints));
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.14, 1.2, 7), std("#cbb9a5"), treeSpots.length);
    const crown = new THREE.InstancedMesh(new THREE.SphereGeometry(0.95, 12, 9), std("#b6c9c4"), treeSpots.length);
    trunk.castShadow = crown.castShadow = true;
    crown.receiveShadow = true;
    treeSpots.forEach(([x, z, s], i) => {
      _m4.compose(_p.set(x, 0.6 * s, stretchJourneyZ(z)), _q.identity(), _s.set(s, s, s));
      trunk.setMatrixAt(i, _m4);
      _m4.compose(_p.set(x, 1.75 * s, stretchJourneyZ(z)), _q.identity(), _s.set(s, s * 1.35, s));
      crown.setMatrixAt(i, _m4);
    });
    trunk.instanceMatrix.needsUpdate = true;
    crown.instanceMatrix.needsUpdate = true;
    scene.add(trunk, crown);

    ([
      [-20, 16],
      [50, -16],
      [90, 16],
      [165, 50],
      [205, 90],
      [165, 160],
      [230, 185],
      [280, 230],
      [380, 190],
      [430, 230],
      [540, 190],
      [590, 230],
      [680, 190],
    ] as [number, number][]).forEach(([x, z]) => {
      if (insideDistrict(x, stretchJourneyZ(z), districtFootprints)) return;
      for (let m = 0; m < 3; m++) {
        B(x + (m % 2) * 1.5, m === 2 ? 1.25 : 0, stretchJourneyZ(z) + Math.floor(m / 2) * 1.5, 1.35, 1.25, 1.35, PAL.w2);
      }
    });

    const padPos = new THREE.Vector3(720, 0, stretchJourneyZ(210));
    const finale = createFinalCube(lowPower);
    scope.defer(() => finale.dispose());
    const sparkArtifact = stations[0].extras.sparkRig;
    if (sparkArtifact) scope.defer(() => sparkArtifact.dispose());
    await Promise.all([finale.ready, sparkArtifact?.ready]);
    if (signal.aborted) throw new DOMException("Scene initialization aborted", "AbortError");
    finale.root.position.copy(padPos);
    scene.add(finale.root);
    const unlockChapter = createUnlockChapter(scene, padPos.clone().setY(10), canvas);
    scope.defer(() => unlockChapter.dispose());
    const padMesh = new THREE.Mesh(new THREE.CylinderGeometry(11, 11.6, 0.6, 56), std("#e7edf5", { roughness: 0.3, metalness: .2 }));
    padMesh.position.set(padPos.x, 0.18, padPos.z);
    padMesh.castShadow = true;
    padMesh.receiveShadow = true;
    scene.add(padMesh);
    const padRingMat = new THREE.MeshStandardMaterial({ color: "#eabb63", emissive: "#ffc65a", emissiveIntensity: 0.3, roughness: 0.25, metalness: .7 });
    const padRing = new THREE.Mesh(new THREE.RingGeometry(9.8, 10.2, 72), padRingMat);
    padRing.rotation.x = -Math.PI / 2;
    padRing.position.set(padPos.x, 0.38, padPos.z);
    scene.add(padRing);

    B(-56, 0, -3.8, 0.5, 5.4, 0.5, PAL.w2);
    B(-56, 0, 3.8, 0.5, 5.4, 0.5, PAL.w2);
    B(-56, 5.2, 0, 0.56, 0.5, 8.2, PAL.w);
    const gateMat = new THREE.MeshStandardMaterial({ color: "#2433e6", emissive: "#2433e6", emissiveIntensity: 1.4, roughness: 0.4 });
    const gateBar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 7.6), gateMat);
    gateBar.position.set(-56, 4.85, 0);
    scene.add(gateBar);

    pool.count = pi;
    pool.instanceMatrix.needsUpdate = true;
    if (pool.instanceColor) pool.instanceColor.needsUpdate = true;

    await yieldToMain(signal);
    /* ---------- diorama scenery ---------- */

    const rnd = (() => {
      let s = 42;
      return () => {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s / 4294967296;
      };
    })();

    const mtnGeo = new THREE.ConeGeometry(1, 1, 5);
    const mtnTones = ["#d3dfec", "#cbd8e8", "#d9e3ef", "#c7d5e6"];
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + rnd() * 0.4;
      const r = 470 + rnd() * 300;
      const h = 52 + rnd() * 74;
      const m = new THREE.Mesh(mtnGeo, std(mtnTones[k % 4], { flatShading: true, roughness: 1 }));
      m.position.set(330 + Math.cos(a) * r, GROUND_Y, 185 + Math.sin(a) * r);
      m.scale.set(42 + rnd() * 38, h, 42 + rnd() * 38);
      m.rotation.y = rnd() * Math.PI;
      scene.add(m);
    }
    const flowerGeo = new THREE.SphereGeometry(0.5, 8, 6);
    const flowers = new THREE.InstancedMesh(flowerGeo, std("#ffffff"), STATIONS.length * 18);
    flowers.castShadow = false;
    flowers.receiveShadow = false;
    let fi = 0;
    const fCol = new THREE.Color();
    for (const [i,st] of Array.from(STATIONS.entries())) {
      const [fx, fz] = ROUTE[ST_INDEX[i]];
      const acc = new THREE.Color(st.colorInt);
      for (let k = 0; k < 18; k++) {
        const a = k * 2.4 + i * 1.7;
        const r = 16.5 + (k % 6) * 1.8 + rnd() * 0.8;
        const sc = 0.34 + rnd() * 0.3;
        _m4.compose(_p.set(fx + Math.cos(a) * r, 0.16 * sc, fz + Math.sin(a) * r), _q.identity(), _s.set(sc, sc, sc));
        flowers.setMatrixAt(fi, _m4);
        fCol.copy(acc).lerp(new THREE.Color("#ffffff"), rnd() * 0.55);
        flowers.setColorAt(fi, fCol);
        fi++;
      }
    }
    flowers.instanceMatrix.needsUpdate = true;
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    scene.add(flowers);

    const coniferGeo = new THREE.ConeGeometry(0.95, 3.4, 9);
    const coniferSpots: [number, number][] = [
      [-30, 25],
      [15, -28],
      [60, 28],
      [120, -25],
      [150, 60],
      [220, 60],
      [150, 110],
      [222, 110],
      [170, 220],
      [260, 180],
      [280, 240],
      [360, 180],
      [420, 240],
      [450, 180],
      [510, 240],
      [580, 180],
      [630, 240],
      [670, 180],
      [710, 240],
      [80, -60],
      [400, 130],
      [580, 130],
    ];
    const conifers = new THREE.InstancedMesh(coniferGeo, std("#a9c4bd"), coniferSpots.length);
    conifers.castShadow = true;
    coniferSpots.forEach(([x, z], k) => {
      const sc = 0.8 + rnd() * 0.6;
      _m4.compose(_p.set(x, 1.6 * sc, stretchJourneyZ(z)), _q.identity(), _s.set(sc, sc, sc));
      conifers.setMatrixAt(k, _m4);
    });
    conifers.instanceMatrix.needsUpdate = true;
    scene.add(conifers);

    const rockGeo = new THREE.IcosahedronGeometry(0.7, 0);
    const rocks = new THREE.InstancedMesh(rockGeo, std("#c3cfdd", { flatShading: true }), 20);
    rocks.castShadow = true;
    for (let k = 0; k < 20; k++) {
      const x = -90 + rnd() * 850;
      const z = -80 + rnd() * 370;
      const sc = 0.5 + rnd() * 1.1;
      _m4.compose(_p.set(x, 0.4 * sc, stretchJourneyZ(z)), _q.identity(), _s.set(sc, sc * 0.55, sc));
      rocks.setMatrixAt(k, _m4);
    }
    rocks.instanceMatrix.needsUpdate = true;
    scene.add(rocks);

    let visible = true;
    let syncRendering = () => {};
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      // A dark section below (tracked by HeaderTheme) keeps its light-on-dark header.
      if (!visible && header?.dataset.themeDark !== "true") header?.classList.remove("jny-header-dark");
      syncRendering();
    });
    io.observe(section);

    let mobile = window.innerWidth < 860;
    let sectionTop = section.offsetTop;
    let scrollSpan = section.offsetHeight - window.innerHeight;
    let entrySpan = 0;
    let conversationSpan = 0;
    let unlockSpan = 0;
    const entry = section.querySelector<HTMLElement>(".jny-entry");
    const opening = section.querySelector<HTMLElement>(".jny-entry-opening");
    const resolution = section.querySelector<HTMLElement>(".jny-entry-resolution");
    const entryFootnote = section.querySelector<HTMLElement>(".jny-entry-footnote");
    const entrySkip = section.querySelector<HTMLElement>(".jny-entry-skip");
    const stationAnchor = section.querySelector<HTMLElement>("#journey-stations");
    const conversationAnchor = section.querySelector<HTMLElement>("#your-next-step");
    let lastCameraEntry = -1;
    let lastViewX = Infinity, lastViewY = Infinity;
    const resize = () => {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      const ratio=scenePixelRatio(adaptive.current,w,h,devicePixelRatio);
      const size=renderer.getSize(new THREE.Vector2());
      // A ResizeObserver notification from the CSS screen handoff must not clear
      // an unchanged WebGL backbuffer between two displayed animation frames.
      if(size.x!==w||size.y!==h||renderer.getPixelRatio()!==ratio){
        renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);
      }
      camera.aspect = w / h;
      mobile = window.innerWidth < 860;
      camera.fov = mobile ? 32 : w / h < 1.05 ? 26 : 20;
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
      sectionTop = section.getBoundingClientRect().top + window.scrollY;
      entrySpan = reduce ? 0 : window.innerHeight * 2.2;
      conversationSpan = window.innerHeight * (reduce ? 1.2 : 2.2);
      unlockSpan = window.innerHeight * (reduce ? 1.4 : UNLOCK_SCROLL_VH);
      const sectionStyle=getComputedStyle(section);
      const showcaseSpan=sectionStyle.getPropertyValue('--showcase-span').trim();
      const showcasePixels=(parseFloat(showcaseSpan)||0)*(showcaseSpan.endsWith('vh')?innerHeight/100:1);
      const laptopSpan=sectionStyle.getPropertyValue('--laptop-span').trim();
      const laptopPixels=(parseFloat(laptopSpan)||0)*(laptopSpan.endsWith('vh')?innerHeight/100:1);
      scrollSpan = section.offsetHeight - window.innerHeight - entrySpan - conversationSpan - unlockSpan - showcasePixels - laptopPixels;
      lastCameraEntry = -1;
      syncRendering();
    };
    window.addEventListener("resize", resize);
    scope.defer(()=>window.removeEventListener("resize",resize));
    resize();
    const layoutObserver=new ResizeObserver(resize);layoutObserver.observe(section);layoutObserver.observe(canvas);
    scope.defer(()=>layoutObserver.disconnect());

    const stepsEl = section.querySelector<HTMLOListElement>(".jny-steps");
    const stepEls = stepsEl ? Array.from(stepsEl.querySelectorAll<HTMLLIElement>(".jny-step")) : [];
    const stepBars = stepEls.map((s) => s.querySelector<HTMLElement>(".jny-bar i"));
    const ranges = FOCUS.map((f, i) => [
      i ? (FOCUS[i - 1] + f) / 2 : 0.05,
      i < FOCUS.length - 1 ? (f + FOCUS[i + 1]) / 2 : 1.01,
    ]);
    const jump = (i: number) => (ev: Event) => {
      ev.preventDefault();
      smoothScrollTo(sectionTop + entrySpan + scrollSpan * storyToScroll(FOCUS[i]));
    };
    const jumpers = stepEls.map((_, i) => jump(i));
    stepEls.forEach((el, i) => el.addEventListener("click", jumpers[i]));

    const tagEl = section.querySelector<HTMLElement>(".jny-tag b");
    const endEl = section.querySelector<HTMLElement>(".jny-endcta");
    const finaleCopy = section.querySelector<HTMLElement>(".jny-finale-copy");
    const concierge = section.querySelector<HTMLElement>(".jny-concierge");
    if (concierge) concierge.inert = true;
    const projectShowcase = section.querySelector<HTMLElement>(".jny-project-showcase");
    if(projectShowcase)projectShowcase.inert=true;
    const unlockCue = section.querySelector<HTMLElement>(".jny-unlock-cue");
    const stepsWrap = stepsEl;
    // Copy is staged by scroll and moved by time-based springs (staged-motion.ts).
    const beats=(root:Element|null)=>root?Array.from(root.querySelectorAll<HTMLElement>("[data-beat]")):[];
    const entryMotion=createStagedMotion(beats(entry),{initial:0});
    const stepMotion=createStagedMotion(beats(stepsEl));
    const finaleMotion=createStagedMotion(beats(finaleCopy));
    const cubeMotion=createStagedMotion(beats(concierge),{lag:.22});
    const stepBodies=stepEls.map(el=>el.querySelector<HTMLElement>(".jny-b"));
    const cubeLines=concierge?Array.from(concierge.querySelectorAll<HTMLElement>(".cube-line")):[];
    const CUBE_BEATS=cubeLines.length;
    // The dark room opens on a spring; the cube turns a quarter per beat and is
    // squeezed by a kick, so it zooms out and back in as each sentence lands.
    const room=createSpring(0),cubeYaw=createSpring(0),cubePop=createSpring(0);
    let finaleRest=0,cubeBeat=BEFORE,stepBeat=BEFORE,cubeX=-1,cubeY=-1,cubeR=-1;
    const cubeCenter=new THREE.Vector3(),cubeEdge=new THREE.Vector3(),cameraRight=new THREE.Vector3();
    // Each altar's floating cube is small while the camera is away and pops when it arrives.
    const heroes=stations.map(st=>st.extras.floats[0]?.obj??null);
    const heroBase=heroes.map(h=>h?h.scale.x:1);
    const heroSprings=stations.map(()=>createSpring(.55));
    const sparkOpen=createSpring(0),sparkTurn=createSpring(0);
    // Intro beat 2: each glass face morphs into its stage glyph, one after another.
    const glyphEls=entry?Array.from(entry.querySelectorAll<SVGSVGElement>(".jny-glyph")):[];
    const glyphPaths=glyphEls.map(el=>el.querySelector("path")!);
    const glyphSprings=glyphEls.map(()=>createSpring(0)),glyphGoals=glyphEls.map(()=>0),glyphLast=glyphEls.map(()=>-1);
    let glyphWant=0,glyphSince=0;
    const faceWorld=new THREE.Vector3(),faceEdge=new THREE.Vector3(),faceRight=new THREE.Vector3(),faceScale=new THREE.Vector3();
    const faceShrink=glyphEls.map(()=>1);
    const third=section.querySelector<HTMLElement>(".jny-entry-third");

    const progress = () => {
      return scrollToStory(Math.min(1, Math.max(0, (window.scrollY - sectionTop - entrySpan) / scrollSpan)));
    };

    const tgt = new THREE.Vector3();
    let time = 0;
    let pS = progress();
    const smoothProgress = createCameraProgress(pS);
    const entryProgress = () => entrySpan ? THREE.MathUtils.clamp((window.scrollY - sectionTop) / entrySpan, 0, 1) : 1;
    const smoothEntry = createCameraProgress(entryProgress(), .32);
    const conversationProgress = () => THREE.MathUtils.clamp((window.scrollY - sectionTop - entrySpan - scrollSpan) / conversationSpan, 0, 1);
    const smoothConversation = createCameraProgress(conversationProgress(), .42);
    const unlockProgress = () => THREE.MathUtils.clamp((window.scrollY-sectionTop-entrySpan-scrollSpan-conversationSpan)/Math.max(1,unlockSpan),0,1);
    const smoothUnlock = createCameraProgress(unlockProgress(), .38);
    const isolatedWorld = new Map<THREE.Object3D, boolean>();
    let lastEntryProgress = -1;
    let last = performance.now();
    let active = -1;
    let raf = 0;
    let lastShadow = 0;
    let previousRouteDistance = POD(pS);
    const characterFrustum = new THREE.Frustum();
    const projectionView = new THREE.Matrix4();
    let lastShadowUpdate = -Infinity;
    let renderedAt=0,prepared=false,snapOnNextFrame=true,previousScrollY=scrollY;
    const routeHead=new THREE.Vector3();
    const cardMaterials=stations.map(st=>{
      const materials=new Set<THREE.MeshStandardMaterial>();
      st.extras.cardGroup?.traverse(o=>{const m=(o as THREE.Mesh).material;if(m instanceof THREE.MeshStandardMaterial)materials.add(m);});
      return Array.from(materials);
    });
    const sceneProfiler = createSceneProfiler(canvas,renderer,"journey");
    let qualityReduced = false;
    const profileEnabled = process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).has("journeyPerf");
    const profileFrames: number[] = [];
    const profileCalls: number[] = [], profileTriangles: number[] = [];
    let profilePublished = 0;
    if (profileEnabled) renderer.info.autoReset = false;

    const frame = (now: number) => {
      const frameStart = profileEnabled ? performance.now() : 0;
      raf = 0;
      if (!visible || document.hidden || screenHidden() || isCaseStudyOpen()) return;
      raf = requestAnimationFrame(frame);
      if(now-renderedAt<1000/adaptive.current.fps-1)return;
      const elapsed=renderedAt?now-renderedAt:1000/adaptive.current.fps;
      renderedAt=now;
      sceneProfiler.begin(now);
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      // Springs keep real time even when frames are slow, so copy never moves in slow motion.
      const springDt = Math.max(0, Math.min(0.25, (now - last) / 1000));
      last = now;
      time += dt;

      const p = progress();
      const immediate=reduce||snapOnNextFrame;
      previousScrollY=scrollY;
      pS = smoothProgress(p, dt, immediate);
      const conversation = smoothConversation(conversationProgress(), dt, immediate);
      const unlock = smoothUnlock(unlockProgress(), dt, immediate);
      const unlockClear = sm(0,.14,unlock);
      const unlockGrow = sm(.01,.16,unlock);
      void unlockClear;
      // A few pixels past the finale, the dark room opens out of the cube.
      const rawConversation = conversationProgress();
      // The room waits for the camera itself (smoothed progress) to finish station six
      // and rest on the finale, so a fast scroll can never cut the journey short.
      // Even on a fast scroll the finale gets a moment on stage before the room takes over.
      finaleRest = pS > .985 ? finaleRest + springDt : 0;
      const roomWanted = (conversation > .1 && (finaleRest > .9 || immediate)) || unlock > .002 ? 1 : 0;
      if (immediate) room.snap(roomWanted);
      else room.step(roomWanted, springDt);
      const roomOpen = room.value;
      const handoff = THREE.MathUtils.clamp(roomOpen, 0, 1);
      header?.classList.toggle("jny-header-dark", handoff > .55 && !(unlock > .505 && unlock < .88) && unlock<.85 && !showroomStage?.classList.contains('lumen-transferring') || header?.dataset.themeDark === "true");
      conversationField.visible = roomOpen > .001;
      conversationField.material.uniforms.opacity.value = Math.max(0, roomOpen);
      conversationField.material.uniforms.aspect.value = camera.aspect;
      // Scroll picks the sentence; springs move the words and the cube.
      const nextCubeBeat = unlock > .015 ? AFTER : handoff < .6 ? BEFORE
        : Math.min(CUBE_BEATS - 1, Math.floor(THREE.MathUtils.clamp((rawConversation - .14) / .86, 0, .999) * CUBE_BEATS));
      if (nextCubeBeat !== cubeBeat) {
        const arriving = nextCubeBeat >= 0 && nextCubeBeat < AFTER;
        cubeBeat = nextCubeBeat;
        if (arriving && !reduce) { cubePop.kick(2.2); play("ui_pop", SPRING_PEAK); }
        if (concierge) {
          concierge.dataset.beat = String(cubeBeat);
          concierge.setAttribute("aria-hidden", String(!arriving));
          concierge.inert = !arriving;
          concierge.classList.toggle("jny-on", arriving);
        }
      }
      cubeMotion.update(cubeBeat, springDt, reduce);
      cubeLines.forEach((line, i) => { const on = cubeMotion.showing(i); if (line.dataset.on !== String(on)) line.dataset.on = String(on); });
      // A quarter turn per sentence; leaving for the doors completes the turn.
      const yawGoal = cubeBeat === BEFORE ? 0 : cubeBeat === AFTER ? Math.PI * 2 : (cubeBeat + 1) * Math.PI / 2;
      if (reduce) { cubeYaw.snap(yawGoal); cubePop.snap(0); } else { cubeYaw.step(yawGoal, springDt); cubePop.step(0, springDt); }
      const rawEntry = smoothEntry(entryProgress(), dt, immediate);
      snapOnNextFrame=false;
      const entryP = rawEntry > .9999 ? 1 : rawEntry < .0001 ? 0 : rawEntry;
      const reveal = ENTRY_REVEAL(entryP);
      // Endpoints are exactly the existing station-one camera; reverse scroll uses the same path.
      if (Math.abs(entryP - lastEntryProgress) > .0001) {
        lastEntryProgress = entryP;
        const entryBeat = entryP < .2 ? 0 : entryP < .48 ? 1 : entryP < .76 ? 2 : AFTER;
        opening?.setAttribute("aria-hidden", String(entryBeat !== 0));
        resolution?.setAttribute("aria-hidden", String(entryBeat !== 1));
        third?.setAttribute("aria-hidden", String(entryBeat !== 2));
        if (entry && entry.dataset.beat !== String(entryBeat)) {
          // The cube bursts open on "every detail" and snaps shut as it spins toward the studio.
          // One pop when the cube opens; one when the first face is caught as a glyph.
          if (!reduce && entry.dataset.beat !== undefined && (entryBeat === 1 || entryBeat === 2)) play("ui_pop", (entryBeat === 2 ? .2 : 0) + SPRING_PEAK);
        }
        if (entry) entry.dataset.beat = String(entryBeat);
        if (entryFootnote) entryFootnote.hidden = true;
        if (entrySkip) entrySkip.style.visibility = entryP < .93 ? "visible" : "hidden";
        if (entry) entry.style.visibility = entryP < .995 ? "visible" : "hidden";
        if (tagEl?.parentElement) tagEl.parentElement.style.opacity = `${sm(.86, .98, entryP)}`;
      }
      const introBeat = Number(entry?.dataset.beat ?? 0);
      entryMotion.update(introBeat, springDt, reduce);
      // The cube stays open while its faces become glyphs, then closes as it spins into the studio.
      if (reduce) { sparkOpen.snap(0); sparkTurn.snap(1); }
      else { sparkOpen.step(introBeat === 1 || introBeat === 2 ? 1 : 0, springDt); sparkTurn.step(introBeat > 2 ? 1 : 0, springDt); }
      const wantGlyphs = introBeat === 2 ? 1 : 0;
      if (wantGlyphs !== glyphWant) { glyphWant = wantGlyphs; glyphSince = 0; }
      glyphSince += springDt;
      glyphSprings.forEach((spring, i) => {
        // Arriving, they turn one after another (slowly); leaving, they fold back together.
        if (glyphSince >= (glyphWant ? .2 + i * .16 : (glyphEls.length - 1 - i) * .05)) glyphGoals[i] = glyphWant;
        if (reduce) spring.snap(glyphGoals[i]); else spring.step(glyphGoals[i], springDt);
        faceShrink[i] = 1 - THREE.MathUtils.clamp(spring.value * 1.5, 0, 1);
      });
      entryPaperMesh.visible = entryP < .995;
      entryPaperMesh.material.uniforms.opacity.value = 1 - reveal;

      const s = Math.min(L - 0.01, Math.max(0.01, POD(pS)));
      const u = s / L;
      const hp = curve.getPointAt(u,routeHead);
      const routeSpeed = Math.abs(s - previousRouteDistance) / Math.max(dt, 0.001);
      previousRouteDistance = s;
      if (routeSpeed > 0.6) routeDots.add(hp.x, hp.z, now / 1000);
      routeDots.update(now / 1000);
      pointerDots.update(now / 1000);
      phaseDioramas.update(pS);
      finale.update(pS, time, reduce);
      finale.root.scale.setScalar(THREE.MathUtils.lerp(THREE.MathUtils.lerp(1, mobile ? .62 : .68, roomOpen), 1, unlockGrow) * (1 + .16 * cubePop.value));
      finale.root.rotation.y = reduce ? 0 : cubeYaw.value;
      finale.root.rotation.z = reduce ? 0 : Math.sin(handoff * Math.PI) * .1 + cubeYaw.velocity * .012;
      // Scaling is around the tabletop; compensate to keep the artifact's center fixed.
      finale.root.position.y = 10 * (1 - finale.root.scale.x);
      if (unlock > 0) finale.updateUnlock(unlock, reduce);
      padRingMat.emissiveIntensity = .3 + sm(.9, .99, pS) * 2;
      trailUniforms.uH.value = u;
      head.position.set(hp.x, .32, hp.z);
      head.visible = u > .0005;
      let inside = 0;
      stations.forEach((st, si) => {
        inside = Math.max(inside, Math.max(0, 1 - Math.abs(s - STOP[si]) / 12));
      });
      headLight.position.set(hp.x, 1.8, hp.z);

      stations.forEach((st, i) => {
        if(entryP===1&&Math.abs(s-STOP[i])>135)return;
        const actTarget = sm(0, 5, s - (STOP[i] - 12)) * (1 - sm(0, 10, s - (STOP[i] + 12)));
        st.act += (actTarget - st.act) * Math.min(1, dt * 5);
        const act = st.act;
        const inK = Math.max(0, 1 - Math.abs(s - STOP[i]) / 14);
        st.insideK = inK;
        st.doorMat.emissiveIntensity = 0.4 + act * 1.2 + inK * 0.8;
        st.winMat.emissiveIntensity = act * 0.8 + inK * 0.5;
        st.ringMat.emissiveIntensity = 0.3 + act * 1.2 + inK * 0.8;
        st.lamp.intensity = act * 4.5 + inK * 3.0;

        const ex = st.extras;
        // Animate 3D Station Card above the station
        if (ex.cardGroup) {
          ex.cardGroup.position.y = ex.cardBaseY + act * 1.8 + Math.sin(time * 1.4 + i) * 0.12;
          cardMaterials[i].forEach(material=>{material.emissiveIntensity=.7+act*.8;});
        }
        if (ex.beaconLight) {
          ex.beaconLight.intensity = 3.2 + act * 2.4;
        }
        if (ex.inDoorGlow) {
          (ex.inDoorGlow.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + inK * 1.2 + act * 0.8;
        }
        if (ex.outDoorGlow) {
          (ex.outDoorGlow.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + inK * 1.2 + act * 0.8;
        }
        ex.pulseMeshes.forEach((pm) => {
          (pm.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.1 + Math.sin(time * 2.5 + i) * 0.2 + act * 0.4;
        });
        if (ex.sway) ex.sway.rotation.z = Math.sin(time * 0.5) * 0.045 * (0.3 + act);
        ex.spins.forEach(({ obj, speed }) => {
          obj.rotation.z += dt * speed * (0.3 + act * 1.6);
          obj.rotation.y += dt * speed * (0.3 + act * 1.6);
        });
        ex.floats.forEach((f) => {
          f.obj.position.y = f.baseY + Math.sin(time * 1.15 + f.baseY) * f.amp;
          if (f.rotSpeed) f.obj.rotation.y += dt * f.rotSpeed * (0.4 + act);
        });
        ex.crates.forEach((c) => {
          const k = (time * 0.05 * (0.4 + act * 1.8) + c.ph) % 1;
          c.mesh.position.lerpVectors(c.from, c.to, k);
          c.mesh.rotation.y = st.heading;
        });
      });
      headLight.intensity = inside * 6.0;


      const finalApproach = FINAL_FRAMING(pS);
      const finaleFraming = sm(.89, .985, pS);
      const fifthApproach = FIFTH_FRAMING(pS);
      // Include the operations floor and rack crew in the growing-campus composition.
      const approachDistance = THREE.MathUtils.lerp(CAMERA_DISTANCE * (mobile ? 1.3 : 1), mobile ? 174 : 138, fifthApproach);
      const approachFov = THREE.MathUtils.lerp(mobile ? 32 : camera.aspect < 1.05 ? 26 : 20, mobile ? 25 : 18, fifthApproach);
      const journeyDistance = THREE.MathUtils.lerp(THREE.MathUtils.lerp(approachDistance, mobile ? 190 : 142, finalApproach), mobile ? 106 : 152, finaleFraming);
      const entryDistance = THREE.MathUtils.lerp(mobile ? 22 : 26,mobile ? 47 : 52,ENTRY_SPACE(entryP));
      const dist = Math.exp(THREE.MathUtils.lerp(Math.log(entryDistance), Math.log(journeyDistance), reveal));
      const desiredFov = THREE.MathUtils.lerp(mobile ? 27 : 18, THREE.MathUtils.lerp(THREE.MathUtils.lerp(approachFov, mobile ? 23 : 11, finalApproach), mobile ? 26 : 14, finaleFraming), reveal);
      // The intro makes room for its copy; every station uses the centered lens.
      const centering = ENTRY_CENTER(entryP);
      // During the stations the scene slides to the right half, leaving clear ground for the copy.
      const viewX = mobile ? 0 : -.18 * (1-centering) - .12 * centering * (1 - THREE.MathUtils.clamp(roomOpen, 0, 1));
      const viewY = (mobile ? -.2 : .08) * (1-centering);
      if (entryP !== lastCameraEntry || Math.abs(camera.fov - desiredFov) > .001 || Math.abs(viewX-lastViewX) > .00001 || Math.abs(viewY-lastViewY) > .00001) {
        lastCameraEntry = entryP; lastViewX = viewX; lastViewY = viewY;
        camera.fov = desiredFov;
        camera.setViewOffset(window.innerWidth, window.innerHeight, window.innerWidth * viewX, window.innerHeight * viewY, window.innerWidth, window.innerHeight);
        camera.updateProjectionMatrix();
      }
      tgt.set(hp.x, THREE.MathUtils.lerp(8.8, 6, reveal), hp.z);
      tgt.lerp(padPos, finaleFraming);
      tgt.y = THREE.MathUtils.lerp(tgt.y, 10, finaleFraming);
      const el = THREE.MathUtils.degToRad(CAMERA_ELEVATION(pS));
      const az = THREE.MathUtils.degToRad(CAMERA_YAW(pS));
      camera.position.set(
        tgt.x + Math.sin(az) * Math.cos(el) * dist,
        tgt.y + Math.sin(el) * dist,
        tgt.z + Math.cos(az) * Math.cos(el) * dist
      );
      camera.lookAt(tgt);
      camera.updateMatrixWorld();
      unlockChapter.update(unlock,camera,reduce,mobile);
      if (roomOpen > .001 || cubeBeat !== BEFORE) {
        finale.root.updateMatrixWorld();
        finale.root.localToWorld(cubeCenter.set(0, 10, 0));
        cameraRight.setFromMatrixColumn(camera.matrixWorld, 0);
        cubeEdge.copy(cubeCenter).addScaledVector(cameraRight, 5.4 * finale.root.scale.x / (1 + .16 * cubePop.value));
        cubeCenter.project(camera); cubeEdge.project(camera);
        conversationField.material.uniforms.center.value.set((cubeCenter.x + 1) / 2, (cubeCenter.y + 1) / 2);
        const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
        const x = Math.round((cubeCenter.x + 1) / 2 * w), y = Math.round((1 - cubeCenter.y) / 2 * h), r = Math.round(Math.abs(cubeEdge.x - cubeCenter.x) / 2 * w);
        if (concierge && (x !== cubeX || y !== cubeY || r !== cubeR)) {
          cubeX = x; cubeY = y; cubeR = r;
          concierge.style.setProperty("--cube-x", `${x}px`); concierge.style.setProperty("--cube-y", `${y}px`); concierge.style.setProperty("--cube-r", `${r}px`);
        }
      }
      // This lower set is below the old campus floor. Retire that set's depth as
      // well as its color, so no hidden floor can occlude the descending key.
      if (unlock > .001) {
        for (const child of scene.children) {
          if (child === finale.root || child === unlockChapter.root || child === conversationField || child === entryPaperMesh || child instanceof THREE.Light) continue;
          if (!isolatedWorld.has(child)){isolatedWorld.set(child, child.visible);child.visible=false;}
        }
      } else if (unlock <= .001 && isolatedWorld.size) {
        isolatedWorld.forEach((visible,child)=>{child.visible=visible;});
        isolatedWorld.clear();
      }
      if(projectShowcase){
        const shown=unlock>.84;
        projectShowcase.style.visibility=shown?'visible':'hidden';
        projectShowcase.style.setProperty('--showcase-open',String(sm(.845,.91,unlock)));
        const interactive = unlock >= .91;
        if (projectShowcase.inert === interactive) {
          projectShowcase.inert = !interactive;
          projectShowcase.setAttribute("aria-hidden", String(!interactive));
        }
      }
      unlockCue?.classList.toggle("jny-on", unlock > .02 && unlock < .86);
      section.dataset.unlockProgress=unlock.toFixed(4);
      const spark = stations[0].extras.sparkRig;
      spark?.update(entryP,dt,reduce,{opening:Math.max(0,sparkOpen.value),turn:sparkTurn.value,faces:faceShrink});
      if (spark && glyphEls.length && (glyphSprings.some(s => Math.abs(s.value) > .001) || glyphLast.some(v => v !== 0))) {
        spark.root.updateMatrixWorld(true);
        faceRight.setFromMatrixColumn(camera.matrixWorld, 0);
        const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
        glyphEls.forEach((el, i) => {
          const m = glyphSprings[i].value;
          if (Math.abs(m) < .001 && glyphLast[i] === 0) return;
          const face = spark.faces[i];
          face.getWorldPosition(faceWorld);
          spark.root.getWorldScale(faceScale);
          faceEdge.copy(faceWorld).addScaledVector(faceRight, 1.25 * faceScale.x);
          faceWorld.project(camera); faceEdge.project(camera);
          const x = (faceWorld.x + 1) / 2 * w, y = (1 - faceWorld.y) / 2 * h;
          const size = Math.max(24, Math.abs(faceEdge.x - faceWorld.x) * w * 1.15);
          // The square pops out of the face fast while its outline is still square,
          // then the same value carries it into the glyph, past it, and back.
          const grow = Math.abs(m) < .002 ? 0 : Math.pow(THREE.MathUtils.clamp(m, 0, 1.2), .35);
          el.style.width = el.style.height = `${size.toFixed(1)}px`;
          el.style.transform = `translate3d(${(x - size / 2).toFixed(1)}px,${(y - size / 2).toFixed(1)}px,0) scale(${grow.toFixed(4)}) rotate(${((1 - m) * -40).toFixed(2)}deg)`;
          glyphPaths[i].setAttribute("d", glyphPath(i, m));
          glyphLast[i] = Math.abs(m) < .001 ? 0 : m;
        });
      }

      projectionView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      characterFrustum.setFromProjectionMatrix(projectionView);
      if(unlock<=.001)meshyResidents.update(dt, reduce, camera.position, characterFrustum);

      ambient.intensity = THREE.MathUtils.lerp(.65, 2.55, finalApproach);
      sun.intensity = THREE.MathUtils.lerp(2.1, .85, finalApproach);
      ambient.intensity = THREE.MathUtils.lerp(ambient.intensity, 1.1, finaleFraming);
      sun.intensity = THREE.MathUtils.lerp(sun.intensity, 1.8, finaleFraming);
      scene.environmentIntensity = THREE.MathUtils.lerp(.25, 1, finalApproach);
      renderer.toneMappingExposure = THREE.MathUtils.lerp(.85, 1, finalApproach);
      scene.environmentIntensity = THREE.MathUtils.lerp(scene.environmentIntensity, 1.4, handoff);
      fog.near = dist * 1.45;
      fog.far = dist * 3.8;

      const ext = Math.max(80, dist * 0.65);
      if (Math.abs(ext - lastShadow) > 2) {
        const sc = sun.shadow.camera;
        sc.left = -ext;
        sc.right = ext;
        sc.top = ext;
        sc.bottom = -ext;
        sc.near = 1;
        sc.far = 640;
        sc.updateProjectionMatrix();
        lastShadow = ext;
      }
      lightDirection.copy(STUDIO_KEY_DIR).lerp(SUN_DIR, finalApproach).normalize();
      sun.position.copy(tgt).addScaledVector(lightDirection, 200);
      sun.target.position.copy(tgt);

      let idx = 0;
      let bestD = 1e9;
      FOCUS.forEach((f, i) => {
        const d = Math.abs(pS - f);
        if (d < bestD) {
          bestD = d;
          idx = i;
        }
      });
      if (idx !== active) {
        active = idx;
        stepEls.forEach((el2, k) => el2.classList.toggle("jny-active", k === idx));
        if (tagEl) tagEl.textContent = `${String(idx + 1).padStart(2,"0")} / 06`;
      }
      stepBars.forEach((b, i) => {
        if (!b) return;
        const [st, en] = ranges[i];
        b.style.height = `${Math.min(1, Math.max(0, (pS - st) / (en - st))) * 100}%`;
      });

      const hudHidden = pS > 0.945;
      // The station copy waits until the introduction has fully resolved, so the two never overlap.
      const stepsOn = entryP > 0.97 && pS > 0.03 && pS < 0.94;
      stepsWrap?.classList.toggle("jny-on", stepsOn);
      stepsWrap?.classList.toggle("jny-off", hudHidden);
      const nextStepBeat = stepsOn ? idx : pS >= .94 ? AFTER : BEFORE;
      if (nextStepBeat !== stepBeat) {
        // Arriving at a station: its question lands and its cube pops, heard at the catch.
        if (nextStepBeat >= 0 && nextStepBeat < AFTER && !reduce) play("ui_pop", .16 + SPRING_PEAK);
        stepBeat = nextStepBeat;
      }
      stepMotion.update(stepBeat, springDt, reduce);
      stepBodies.forEach((body, i) => { if (!body) return; const on = stepMotion.showing(i); if (body.dataset.on !== String(on)) body.dataset.on = String(on); });
      heroes.forEach((hero, i) => {
        if (!hero) return;
        const spring = heroSprings[i];
        const goal = stepBeat === i || (i === 0 && stepBeat === BEFORE) ? 1 : .55;
        if (reduce) spring.snap(goal); else spring.step(goal, springDt);
        hero.scale.setScalar(heroBase[i] * spring.value);
        if (i > 0) hero.rotation.y = Math.PI / 4 + (1 - spring.value) * Math.PI;
      });
      void endEl;
      const finaleBeat = roomOpen > .08 ? AFTER : pS > .965 ? 0 : BEFORE;
      finaleMotion.update(finaleBeat, springDt, reduce);
      finaleCopy?.classList.toggle("jny-on", finaleBeat === 0);

      if (now - lastShadowUpdate > 1000/adaptive.current.shadowHz) {
        renderer.shadowMap.needsUpdate = true;
        lastShadowUpdate = now;
      }
      if (profileEnabled) renderer.info.reset();
      const renderStart = performance.now();
      renderer.render(scene, camera);
      sceneProfiler.end(now,{phase:active+1,reflections:reflectionsEnabled,quality:adaptive.current.tier});
      if(adaptive.sample(now,performance.now()-renderStart,elapsed)) {
        qualityReduced=true;reflectionsEnabled=adaptive.current.tier==="high";
        reflection.visible=reflectionsEnabled;resize();
      }
      canvas.dataset.sceneReady="true";
      section.dataset.sceneRendered="true";
      canvas.dataset.quality=adaptive.current.tier;
      if (profileEnabled) {
        profileFrames.push(performance.now() - frameStart);
        profileCalls.push(renderer.info.render.calls); profileTriangles.push(renderer.info.render.triangles);
        if (profileFrames.length > 120) { profileFrames.shift(); profileCalls.shift(); profileTriangles.shift(); }
        if (now - profilePublished > 1000) {
          const samples = profileFrames.slice().sort((a, b) => a - b);
          canvas.dataset.journeyPerf = JSON.stringify({ phase: active + 1, samples: samples.length,
            cpuP50: samples[Math.floor(samples.length * .5)], cpuP95: samples[Math.floor(samples.length * .95)],
            calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
            averageCalls: Math.round(profileCalls.reduce((sum, count) => sum + count, 0) / profileCalls.length),
            averageTriangles: Math.round(profileTriangles.reduce((sum, count) => sum + count, 0) / profileTriangles.length),
            geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
            quality: qualityReduced ? "reduced" : lowPower ? "low" : "standard", reflections: reflectionsEnabled,
            pixelRatio: renderer.getPixelRatio(), shadowSize: sun.shadow.mapSize.x });
          profilePublished = now;
        }
      }
      // The showcase is DOM content. Once its reveal settles there is no reason
      // to redraw the hidden campus; scroll/pointer/visibility can wake it again.
      const settledShowcase=unlock>.9999&&unlockProgress()===1;
      if(reduce||settledShowcase){cancelAnimationFrame(raf);raf=0;}
    };
    syncRendering = () => {
      if (prepared && visible && !document.hidden && !screenHidden() && !isCaseStudyOpen()) {
        if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
      } else {
        cancelAnimationFrame(raf); raf = 0;
      }
    };
    document.addEventListener("visibilitychange", syncRendering);
    window.addEventListener(CASE_VISIBILITY_EVENT, syncRendering);
    scope.defer(() => window.removeEventListener(CASE_VISIBILITY_EVENT, syncRendering));
    window.addEventListener('journey-screen-visible',syncRendering);
    window.addEventListener("scroll",syncRendering,{passive:true});
    scope.defer(()=>{cancelAnimationFrame(raf);io.disconnect();document.removeEventListener("visibilitychange",syncRendering);window.removeEventListener("scroll",syncRendering);window.removeEventListener('journey-screen-visible',syncRendering);});

    const cleanup=() => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", syncRendering);
      header?.classList.remove("jny-header-dark");
      window.removeEventListener("resize", resize);
      section.removeEventListener("pointermove", pointerMove);
      section.removeEventListener("pointerleave", pointerLeave);
      stepEls.forEach((el, i) => el.removeEventListener("click", jumpers[i]));
      meshyResidents.dispose();
      disposeSceneResources(scene);
      pool.dispose();
      flowers.dispose();
      conifers.dispose();
      rocks.dispose();
      sun.dispose();renderer.dispose();
    };
    scope.defer(cleanup);initialized=true;
    // Warm all material variants without making a partially compiled frame visible.
    const warmCamera=new THREE.PerspectiveCamera(50,1,.1,3000);warmCamera.position.set(330,180,600);warmCamera.lookAt(330,0,180);
    await warmScene(renderer,scene,warmCamera,scope,signal);
    signal.throwIfAborted();
    // Browser restoration / anchor navigation can happen while shaders prepare.
    // Measure again, then draw the current destination before revealing the canvas.
    resize();prepared=true;snapOnNextFrame=true;
    // Loading must never navigate. Explicit links alone choose a destination.
    const wasVisible=visible;visible=true;frame(performance.now());visible=wasVisible;
    if(!visible){cancelAnimationFrame(raf);raf=0;}
    syncRendering();
    return scope.dispose;

  } catch(error) {scope.dispose();throw error;}
}
