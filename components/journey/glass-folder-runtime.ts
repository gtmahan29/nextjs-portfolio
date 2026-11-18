import * as THREE from "three";
import {RoomEnvironment} from "three/examples/jsm/environments/RoomEnvironment.js";
import {gsap} from "gsap";
import {ScrollTrigger} from "gsap/ScrollTrigger";
import type {SceneContext} from "./use-scene-runtime";
import {SceneScope} from "./scene-loading";
import {scenePixelRatio} from "./scene-quality";
import {CASE_VISIBILITY_EVENT, isCaseStudyOpen} from "./case-scene-visibility";
import {FOLDER_CARDS} from "./glass-folder-data";
import {createSpring} from "./motion-curve";
import {BEFORE, createStagedMotion} from "./staged-motion";
import {play} from "./sfx";
import {CARD_WIDTH, CARD_HEIGHT} from "./glass-folder-motion";

/**
 * MOTION SCORE — Selected work (375svh desktop / 365svh mobile, sticky)
 * Trigger: top at 50%; beats at .26 / .44 / .62 / .94 of the base distance.
 * A further 55svh of scroll after the fan extends the gallery before beat 4.
 * Beat | Element        | Pattern | Goal                       | Delay       | Exit          | Sound
 * 0    | Folder         | P12     | descend to centre          | .14         | reverse pose  | catch
 * 0    | Heading        | P1      | word rise                  | .00 + .06   | after 3       | —
 * 0–4  | Captions       | P2      | rise in each beat          | .34 + lag   | up first      | —
 * 1    | Front cover    | P12     | open around lower hinge    | .22         | fold back     | catch
 * 2    | Prints         | P12     | lift straight out          | .20 + .09i  | after fan     | first catch
 * 3    | Folder         | P12     | drop below the frame       | after lift  | rises back       | —
 * 3    | Prints         | P12     | fan into the gallery       | clears + lag | reverse order | fan catch
 * 4    | Prints         | P12     | fall out below frame       | .00 + .05i  | reverse pose  | —
 * 4    | Controls       | P4      | slide below frame          | .00         | return        | —
 * Click| Gallery arc    | P12     | bring selected print front | .00         | retarget      | catch
 * Click| Index capsule  | P6      | stretch towards selection  | .00         | retarget      | —
 * Press| Project actions| P17     | press and return           | .00         | —             | data/big click
 * Reduced motion: open gallery pose, static copy and instant selection.
 * Phone: narrower fan, centred art and footer controls under the prints.
 */

gsap.registerPlugin(ScrollTrigger);
const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
const BEAT_AT = [.26, .44, .62, .94];
const popScale = (value: number) => value > 1 ? 1 + (value - 1) * 2.5 : value;

function rounded(width: number, height: number, radius: number) {
  const s = new THREE.Shape(), x = -width / 2, y = -height / 2, r = radius;
  s.moveTo(x + r, y);s.lineTo(x + width - r, y);s.quadraticCurveTo(x + width, y, x + width, y + r);
  s.lineTo(x + width, y + height - r);s.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  s.lineTo(x + r, y + height);s.quadraticCurveTo(x, y + height, x, y + height - r);
  s.lineTo(x, y + r);s.quadraticCurveTo(x, y, x + r, y);return s;
}

/** Both covers are real bevelled volumes. The hinge is at the lower seam.
 *  Straight edges are subdivided so the covers can morph into a round disc without facets. */
function folderCover(back = false) {
  const s = new THREE.Shape();
  let cx = 0, cy = 0;
  const move = (x: number, y: number) => { s.moveTo(x, y); cx = x; cy = y; };
  const line = (x: number, y: number) => {
    const n = Math.max(2, Math.ceil(Math.hypot(x - cx, y - cy) / .08));
    for (let i = 1; i <= n; i++) s.lineTo(cx + (x - cx) * i / n, cy + (y - cy) * i / n);
    cx = x; cy = y;
  };
  const quad = (ax: number, ay: number, x: number, y: number) => { s.quadraticCurveTo(ax, ay, x, y); cx = x; cy = y; };
  const bez = (ax: number, ay: number, bx: number, by: number, x: number, y: number) => { s.bezierCurveTo(ax, ay, bx, by, x, y); cx = x; cy = y; };
  move(-2.02, 0);line(2.02, 0);quad(2.4, 0, 2.4, .38);
  if (back) {
    line(2.4, 2.48);quad(2.4, 2.83, 2.05, 2.83);
    line(-.13, 2.83);bez(-.43, 2.83, -.34, 3.17, -.7, 3.17);
    line(-1.99, 3.17);quad(-2.4, 3.17, -2.4, 2.76);
  } else {
    line(2.4, 1.91);quad(2.4, 2.28, 2.03, 2.28);
    line(.22, 2.28);bez(-.25, 2.28, -.16, 2.67, -.17, 2.85);
    quad(-.18, 3.12, -.52, 3.12);line(-1.99, 3.12);
    quad(-2.4, 3.12, -2.4, 2.71);
  }
  line(-2.4, .38);quad(-2.4, 0, -2.02, 0);
  return new THREE.ExtrudeGeometry(s, {depth: .045, bevelEnabled: true, bevelSegments: 6, steps: 1, bevelSize: .035, bevelThickness: .035, curveSegments: 32});
}

function canvasTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");canvas.width = width;canvas.height = height;
  paint(canvas.getContext("2d")!);
  const texture = new THREE.CanvasTexture(canvas);texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;return texture;
}

async function cardTexture(index: number, font: string, palette: {paper: string; ink: string; muted: string}) {
  const card = FOLDER_CARDS[index];
  const image = await new Promise<HTMLImageElement | null>(resolve => {
    const img = new Image();img.onload = () => resolve(img);img.onerror = () => resolve(null);img.src = card.image;
  });
  return canvasTexture(1536, 1056, ctx => {
    ctx.fillStyle = palette.paper;ctx.fillRect(0, 0, 1536, 1056);
    ctx.save();ctx.beginPath();ctx.roundRect(42, 42, 1452, 815, 16);ctx.clip();
    if (image) {
      const scale = Math.max(1452 / image.width, 815 / image.height);
      ctx.drawImage(image, 42 + (1452 - image.width * scale) / 2, 42 + (815 - image.height * scale) / 2, image.width * scale, image.height * scale);
    } else {ctx.fillStyle = card.paper;ctx.fillRect(42, 42, 1452, 815);}
    ctx.restore();
    ctx.fillStyle = palette.ink;ctx.font = `500 52px ${font}`;ctx.fillText(card.title, 52, 953);
    ctx.font = `400 28px ${font}`;ctx.fillStyle = palette.muted;ctx.fillText(card.category, 54, 1009);
    ctx.textAlign = "right";ctx.font = `500 26px ${font}`;ctx.fillText(`0${index + 1}`, 1477, 1007);
    ctx.strokeStyle = palette.muted;ctx.lineWidth = 3.5;ctx.lineCap="round";ctx.lineJoin="round";
    ctx.beginPath();ctx.moveTo(1435, 950);ctx.lineTo(1474, 911);ctx.moveTo(1445, 911);ctx.lineTo(1474, 911);ctx.lineTo(1474, 940);ctx.stroke();
  });
}

export async function mountScene({canvas, section, signal, quality, onActive}: SceneContext) {
  const scope = new SceneScope(signal);
  const sectionStyle = getComputedStyle(section);
  const palette = {
    paper: sectionStyle.getPropertyValue("--jny-card").trim(),
    ink: sectionStyle.getPropertyValue("--jny-chapter-ink").trim(),
    muted: sectionStyle.getPropertyValue("--jny-chapter-muted").trim(),
    mist: sectionStyle.getPropertyValue("--jny-chapter-mist").trim(),
    sky: sectionStyle.getPropertyValue("--jny-chapter-sky").trim(),
  };
  const renderer = new THREE.WebGLRenderer({canvas, antialias: quality.antialias, alpha: true, powerPreference: quality.tier === "low" ? "low-power" : "high-performance"});
  scope.defer(() => renderer.dispose());
  renderer.outputColorSpace = THREE.SRGBColorSpace;renderer.toneMapping = THREE.ACESFilmicToneMapping;renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0xffffff, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 80);
  const environment = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(environment, .02);scene.environment = env.texture;
  scope.defer(() => {env.dispose();pmrem.dispose();environment.dispose();});
  const key = new THREE.DirectionalLight(0xffffff, 4);key.position.set(-4, 7, 8);scene.add(key);
  const fill = new THREE.DirectionalLight(0xf4f7ff, 2);fill.position.set(5, 3, 4);scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xffffff, palette.sky, 1.6));

  const ownedGeometries: THREE.BufferGeometry[] = [], ownedMaterials: THREE.Material[] = [], ownedTextures: THREE.Texture[] = [];
  const geometry = <T extends THREE.BufferGeometry>(value: T) => {ownedGeometries.push(value);return value;};
  const material = <T extends THREE.Material>(value: T) => {ownedMaterials.push(value);return value;};
  const texture = (value: THREE.Texture) => {ownedTextures.push(value);return value;};
  scope.defer(() => {ownedGeometries.forEach(g => g.dispose());ownedMaterials.forEach(m => m.dispose());ownedTextures.forEach(t => t.dispose());});
  const world = new THREE.Group(), folder = new THREE.Group(), front = new THREE.Group();scene.add(world);world.add(folder);folder.add(front);
  const tint = texture(canvasTexture(512, 512, ctx => {
    const gradient = ctx.createLinearGradient(0, 0, 380, 512);gradient.addColorStop(0, palette.paper);gradient.addColorStop(.52, palette.mist);gradient.addColorStop(1, palette.sky);ctx.fillStyle = gradient;ctx.fillRect(0, 0, 512, 512);
  }));
  // Object-space UVs keep the glass tint continuous across both irregular covers.
  const frontGeometry = geometry(folderCover()), backGeometry = geometry(folderCover(true));
  [frontGeometry, backGeometry].forEach(g => {const p = g.attributes.position, uv = g.attributes.uv;for(let i = 0;i < p.count;i++)uv.setXY(i, (p.getX(i) + 2.45) / 4.9, p.getY(i) / 3.2);});
  const glass = material(new THREE.MeshPhysicalMaterial({color: palette.paper, map: tint, transmission: quality.tier === "low" ? 0 : .67, roughness: .28, thickness: .36, ior: 1.42, metalness: 0, clearcoat: 1, clearcoatRoughness: .12, attenuationColor: new THREE.Color(palette.sky), attenuationDistance: 2.2, envMapIntensity: 1.3, side: THREE.DoubleSide}));
  const backMaterial = material(new THREE.MeshPhysicalMaterial({color: palette.sky, roughness: .29, metalness: .12, clearcoat: 1, envMapIntensity: 1}));
  /* After the prints are out, the folder becomes the stage they turn on. One value (uMorph,
     the folder-drop spring) maps every vertex of both covers from the folder's outline onto
     a disc, while the group lies down flat and grows: shape, pose and size change together,
     so the spring's overshoot swells the disc past round and lets it settle. */
  const morph = {value: 0};
  const toDisc = (m: THREE.Material) => {
    m.onBeforeCompile = shader => {
      shader.uniforms.uMorph = morph;
      shader.vertexShader = "uniform float uMorph;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        {
          vec2 q = clamp(vec2(transformed.x / 2.44, (transformed.y - 1.6) / 1.62), -1.0, 1.0);
          vec2 disc = vec2(q.x * sqrt(1.0 - q.y * q.y * .5), q.y * sqrt(1.0 - q.x * q.x * .5)) * 2.4;
          transformed.xy = mix(transformed.xy, disc, uMorph);
        }`);
    };
    m.customProgramCacheKey = () => "folder-to-disc";
  };
  const frontMesh = new THREE.Mesh(frontGeometry, glass);front.add(frontMesh);
  const back = new THREE.Mesh(backGeometry, backMaterial);back.position.z = -.55;folder.add(back);
  const rim = new THREE.LineSegments(geometry(new THREE.EdgesGeometry(frontGeometry, 32)), material(new THREE.LineBasicMaterial({color: palette.paper, transparent: true, opacity: .42})));front.add(rim);
  [glass, backMaterial, rim.material as THREE.Material].forEach(toDisc);
  // The stage's rim: a thin golden ring that springs open as the disc forms.
  const stageRing = new THREE.Mesh(geometry(new THREE.TorusGeometry(2.42, .028, 12, 120)), material(new THREE.MeshPhysicalMaterial({color: "#e9c47f", metalness: .85, roughness: .22, emissive: new THREE.Color("#a9792b"), emissiveIntensity: .35})));
  stageRing.position.z = .1;
  // One golden bead on the rim under each print; they turn with the prints.
  FOLDER_CARDS.forEach((_, i) => {
    const a = i * Math.PI * 2 / FOLDER_CARDS.length;
    const bead = new THREE.Mesh(geometry(new THREE.SphereGeometry(.07, 16, 12)), stageRing.material);
    bead.position.set(Math.sin(a) * 2.42, -Math.cos(a) * 2.42, .04); stageRing.add(bead);
  });
  const label = texture(canvasTexture(1536, 1024, ctx => {
    ctx.fillStyle = palette.ink;ctx.font = "italic 94px Georgia";ctx.fillText("Archive", 126, 870);
  }));
  const labelMesh = new THREE.Mesh(geometry(new THREE.PlaneGeometry(4.8, 3.2)), material(new THREE.MeshBasicMaterial({map: label, transparent: true, depthWrite: false, toneMapped: false})));labelMesh.position.set(0, 1.6, .086);front.add(labelMesh);
  const seam = new THREE.Mesh(geometry(new THREE.ExtrudeGeometry(rounded(4.35,.12,.055),{depth:.62,bevelEnabled:true,bevelSize:.025,bevelThickness:.02,bevelSegments:4,steps:1})),material(new THREE.MeshPhysicalMaterial({color:palette.sky,roughness:.3,clearcoat:1})));seam.position.set(0,.05,-.55);folder.add(seam);
  const font = sectionStyle.getPropertyValue("--font-archive").trim() || "sans-serif";
  await document.fonts.load(`500 49px ${font}`);
  const textures = await Promise.all(FOLDER_CARDS.map((_, i) => cardTexture(i, font, palette)));
  if (signal.aborted) {textures.forEach(t => t.dispose());scope.dispose();return () => {};}
  textures.forEach(texture);
  const cardGeometry = geometry(new THREE.ExtrudeGeometry(rounded(CARD_WIDTH, CARD_HEIGHT, .105), {depth: .045, bevelEnabled: true, bevelSize: .016, bevelThickness: .014, bevelSegments: 4, curveSegments: 24, steps: 1}));
  const faceGeometry = geometry(new THREE.ShapeGeometry(rounded(CARD_WIDTH, CARD_HEIGHT, .105), 24));
  // ShapeGeometry's default UVs are world coordinates, so map them to the full print.
  const facePositions = faceGeometry.attributes.position, faceUvs = faceGeometry.attributes.uv;
  for (let i = 0;i < facePositions.count;i++)faceUvs.setXY(i, facePositions.getX(i) / CARD_WIDTH + .5, facePositions.getY(i) / CARD_HEIGHT + .5);
  const cards = textures.map((map, i) => {
    const group = new THREE.Group();group.userData.index = i;
    const stock = new THREE.Mesh(cardGeometry, material(new THREE.MeshPhysicalMaterial({color: palette.mist, roughness: .3, metalness: .12, clearcoat: .65})));group.add(stock);
    const print = new THREE.Mesh(faceGeometry, material(new THREE.MeshBasicMaterial({map, toneMapped: false})));print.position.z = .06;group.add(print);world.add(group);return group;
  });
  const pocketFrame = new THREE.Object3D();world.add(pocketFrame);
  front.add(stageRing);
  const stageVec = new THREE.Vector3();
  const stageYShadow = () => (mobile ? -1.15 : -1.35) - .35;
  const inspectClearance=new URLSearchParams(location.search).has("motionDebug");
  const folderBounds = new THREE.Box3(), cardBounds = new THREE.Box3();
  const pocketPosition = new THREE.Vector3(), galleryPosition = new THREE.Vector3();
  const galleryRotation = new THREE.Quaternion();
  const cardEuler = new THREE.Euler();
  const shadowMap = texture(canvasTexture(256, 256, ctx => {const g=ctx.createRadialGradient(128,128,0,128,128,125);g.addColorStop(0,"rgba(19, 36, 60, .24)");g.addColorStop(.45,"rgba(19, 36, 60, .11)");g.addColorStop(1,"rgba(19, 36, 60, 0)");ctx.fillStyle=g;ctx.fillRect(0,0,256,256);}));
  const shadow = new THREE.Mesh(geometry(new THREE.PlaneGeometry(7, 2.5)), material(new THREE.MeshBasicMaterial({map: shadowMap, transparent: true, depthWrite: false, toneMapped: false})));shadow.position.set(0,-2.42,-.6);world.add(shadow);

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const land = createSpring(0);
  const hinge = createSpring(0);
  const folderDrop = createSpring(0);
  const selection = createSpring(0);
  const capsulePosition = createSpring(0);
  const capsule = section.querySelector<HTMLElement>(".glass-archive-position");
  const indexButtons = Array.from(section.querySelectorAll<HTMLButtonElement>(".glass-archive-index button"));
  const lifts = cards.map(() => createSpring(0));
  const spreads = cards.map(() => createSpring(0));
  const drops = cards.map(() => createSpring(0));
  const copy = createStagedMotion(
    Array.from(section.querySelectorAll<HTMLElement>("[data-beat]")).filter(n => !n.closest("[data-own-stage]")), {lag: .16},
  );
  const frameHost = canvas.parentElement!;
  const holdMeasure = section.querySelector<HTMLElement>(".glass-archive-hold-measure");
  let stage = BEFORE;
  let targetStage = BEFORE;
  const enteredAt = [0, 0, 0, 0, 0];
  let active = 0;
  let frame = 0;
  let visible = false;
  let disposed = false;
  let clock = 0;
  let last = 0;
  let mobile = false;
  let galleryHold = 0;
  let folderDropDistance = 10.5;
  let buttonWidth = 38;
  let trigger: ScrollTrigger | undefined;
  let pendingSound: ReturnType<typeof createSpring> | undefined;
  let soundDirection = 1;
  let gesture: {pointer: number; startX: number; startY: number; origin: number; lastX: number; lastAt: number; velocity: number; engaged: boolean} | undefined;
  let dragTarget: number | undefined;

  const request = () => {
    if (!frame && visible && !disposed && !document.hidden && !isCaseStudyOpen()) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  };

  function layout() {
    const {clientWidth: width, clientHeight: height} = frameHost;
    mobile = width < 760;
    buttonWidth = indexButtons[0]?.offsetWidth || buttonWidth;
    if (capsule) capsule.style.width = `${buttonWidth}px`;
    renderer.setPixelRatio(Math.min(1.4, scenePixelRatio(quality, width, height, devicePixelRatio), Math.sqrt(2_000_000 / Math.max(1, width * height))));
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    const viewWidth = mobile ? 5.9 : width / height < 1.3 ? 11.4 : 15.1;
    const cameraDistance = Math.max(8.8, viewWidth / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
    folderDropDistance = Math.max(10.5, viewWidth / camera.aspect * .5 + 3);
    camera.position.set(0, 1.25, cameraDistance);
    camera.lookAt(0, .22, 0);
    camera.updateProjectionMatrix();
    request();
  }

  function setStage(next: number, instant = false) {
    if (stage !== next) {
      const previous = stage;
      const forward = next > previous;
      for (let beat = 0; beat <= next && beat < enteredAt.length; beat++) {
        if (previous < beat) enteredAt[beat] = instant ? -Infinity : clock;
      }
      stage = next;
      section.dataset.stage = String(next);
      pendingSound = forward && !instant && next >= 0
        ? [land, hinge, lifts[0], spreads[0]][next]
        : undefined;
      soundDirection = 1;
    }
    if (!instant) return;
    land.snap(next >= 0 ? 1 : 0);
    hinge.snap(next >= 1 ? 1 : 0);
    folderDrop.snap(next >= 3 ? 1 : 0);
    lifts.forEach(spring => spring.snap(next >= 2 ? 1 : 0));
    spreads.forEach(spring => spring.snap(next >= 3 ? 1 : 0));
    drops.forEach(spring => spring.snap(next >= 4 ? 1 : 0));
    copy.update(next, 0, true);
  }

  function renderPose() {
    if (capsule) {
      const stretch = Math.min(.24, Math.abs(capsulePosition.velocity) * .035);
      capsule.style.transform = `translate3d(${capsulePosition.value * buttonWidth}px,0,0) scale(${1 + stretch},${1 - stretch * .46})`;
    }
    pocketFrame.position.set(0, mix(8.2, -1.65, land.value), 0);
    pocketFrame.rotation.set(mix(-.20, .05, land.value), mix(-.46, -.15, land.value), mix(-.14, -.035, land.value));
    pocketFrame.scale.setScalar(.94);
    pocketFrame.updateMatrix();

    folder.position.copy(pocketFrame.position);
    // The folder becomes the stage: it closes, lies down flat under the ring of prints, grows
    // into a disc and turns with the selection. It leaves only with the prints, at the end.
    const m = Math.max(0, folderDrop.value), mc = clamp(m, 0, 1);
    morph.value = m;
    const stageY = mobile ? -1.15 : -1.35, stageScale = mobile ? 1.05 : 1.62;
    folder.position.lerp(stageVec.set(0, stageY, 1.78), mc);
    folder.position.y -= drops[0].value * 13.8;
    folder.rotation.set(
      mix(pocketFrame.rotation.x, -Math.PI / 2 + .02, mc),
      mix(pocketFrame.rotation.y, 0, mc),
      mix(pocketFrame.rotation.z, 0, mc) - selection.value * Math.PI * 2 / cards.length * mc,
    );
    folder.scale.setScalar(mix(pocketFrame.scale.x, stageScale, m));
    folder.visible = drops[0].value < .999;
    seam.scale.setScalar(Math.max(.0001, 1 - mc));
    labelMesh.visible = mc < .5;
    back.position.z = mix(-.55, -.16, mc);
    stageRing.scale.setScalar(Math.max(.0001, popScale(clamp((m - .55) / .45, 0, 1.2))));
    stageRing.visible = m > .56;
    // The lid closes again as the folder becomes the stage.
    front.rotation.x = .43 * hinge.value * (1 - clamp(folderDrop.value, 0, 1));
    front.position.z = .09 + .14 * hinge.value * (1 - clamp(folderDrop.value, 0, 1));

    if (inspectClearance) { world.updateMatrixWorld(true); folderBounds.setFromObject(folder); }
    let minimumClearance = Infinity;
    cards.forEach((card, index) => {
      const lift = lifts[index].value;
      const spread = spreads[index].value;
      const fall = drops[index].value;
      const arc = (index - selection.value) * Math.PI * 2 / cards.length;
      const facing = (1 + Math.cos(arc)) / 2;
      const peek = clamp(hinge.value, 0, 1.05) * .76;
      pocketPosition.set(0, mix(1.10 + peek, 4.38, lift) + index * .032 * lift, -.09 - index * .095);
      pocketPosition.applyMatrix4(pocketFrame.matrix);
      galleryPosition.set(Math.sin(arc) * (mobile ? 2.27 : 3.43), .49 - (1 - facing) * .68, .46 + facing * 2.65);
      card.position.copy(pocketPosition).lerp(galleryPosition, spread);
      card.position.y -= fall * 13.8;
      card.position.z -= fall * .7;
      cardEuler.set(-.035 + fall * .29, -Math.sin(arc) * .57, -Math.sin(arc) * .085);
      galleryRotation.setFromEuler(cardEuler);
      card.quaternion.copy(pocketFrame.quaternion).slerp(galleryRotation, clamp(spread, 0, 1));
      // A crown grows and settles as part of the fan, on the same spring.
      card.scale.setScalar(mix(.80, (mobile ? 1.03 : 1.22) * (.59 + facing * .41), popScale(spread)));
      if (inspectClearance && spread > .02 && fall < .005) {
        card.updateMatrixWorld(true);
        cardBounds.setFromObject(card);
        minimumClearance = Math.min(minimumClearance, cardBounds.min.y - folderBounds.max.y);
      }
    });
    shadow.position.y = mix(-2.62, stageYShadow(), clamp(folderDrop.value, 0, 1)) - drops[0].value * 13.8;
    shadow.scale.setScalar(Math.max(.02, land.value * mix(.93, 1.45, clamp(folderDrop.value, 0, 1))));
    shadow.visible = folder.visible;
    if (inspectClearance) {
      section.dataset.folderClearance = Number.isFinite(minimumClearance) ? minimumClearance.toFixed(3) : "enclosed";
      section.dataset.folderSprings = [
        land.value, hinge.value, lifts[0].value, folderDrop.value, spreads[0].value, drops[0].value, selection.value,
      ].map(value => value.toFixed(4)).join(" ");
    }
    renderer.render(scene, camera);
    section.dataset.sceneRendered ||= "true";
  }

  function tick(now: number) {
    frame = 0;
    if (disposed || !visible || document.hidden || isCaseStudyOpen()) return;
    const dt = Math.min(.25, (now - last) / 1000);
    last = now;
    clock += dt;
    setStage(targetStage, reduced.matches);

    const beforeCatch = (pendingSound?.velocity ?? 0) * soundDirection;
    let moving = false;
    const step = (spring: ReturnType<typeof createSpring>, goal: number) => {
      if (reduced.matches) spring.snap(goal);
      else moving = spring.step(goal, dt) || moving;
    };
    const reached = (beat: number, delay: number) => {
      if (stage < beat) return false;
      const ready = clock - enteredAt[beat] >= delay;
      if (!ready) moving = true;
      return ready;
    };

    // Arrival, opening, lift and drop each keep their own start time.
    // Crossing a later beat cannot temporarily turn an already reached goal off.
    step(land, reached(0, .14) ? 1 : 0);
    const stillLifted = lifts.some(s => s.value > .025);
    step(hinge, reached(1, .22) || stillLifted ? 1 : 0);

    // On reverse, seat the gallery first, bring the pocket up, then lower the prints.
    // The lift cannot start through a closed cover, even after a multi-beat jump.
    const stillSpread = spreads.some(s => s.value > .015);
    const shouldDropFolder = (reached(3, .16) && lifts.every(s => s.value >= .985)) || stillSpread;
    step(folderDrop, shouldDropFolder ? 1 : 0);
    lifts.forEach((spring, index) => {
      const keepClear = folderDrop.value > .025 || stillSpread;
      const liftNow = reached(2, .20 + index * .09) && hinge.value > .82;
      step(spring, liftNow || keepClear ? 1 : 0);
    });
    spreads.forEach((spring, index) => {
      const fanNow = reached(3, .16 + index * .09) && folderDrop.value >= .82;
      step(spring, fanNow ? 1 : 0);
    });
    const galleryOpen = spreads.every(spring => spring.value >= .985);
    drops.forEach((spring, index) => step(spring, reached(4, index * .05) && galleryOpen ? 1 : 0));
    step(selection, dragTarget ?? active);
    step(capsulePosition, ((active % cards.length) + cards.length) % cards.length);
    const copyMoving = copy.update(stage, dt, reduced.matches);
    if (pendingSound && beforeCatch > 0 && pendingSound.velocity * soundDirection <= 0) {
      if (stage < 4) play("ui_pop");
      pendingSound = undefined;
    }
    renderPose();
    if (moving || copyMoving) frame = requestAnimationFrame(tick);
  }

  function select(index: number) {
    const current = ((active % cards.length) + cards.length) % cards.length;
    const half = Math.floor(cards.length / 2);
    const step = ((index - current + cards.length + half) % cards.length) - half;
    if (!step) return;
    active += step;
    if (reduced.matches) selection.snap(active);
    else if (stage === 3 && (!pendingSound || pendingSound === selection)) {
      pendingSound = selection;
      soundDirection = Math.sign(active - selection.value) || 1;
    }
    onActive?.(index);
    request();
  }
  const changeSlide = (event: Event) => select((event as CustomEvent<number>).detail);
  const dragPixels = () => Math.min(370, Math.max(130, frameHost.clientWidth * .27));
  function beginDrag(event: PointerEvent) {
    if (reduced.matches || stage !== 3 || event.button !== 0 || gesture) return;
    gesture = {pointer: event.pointerId, startX: event.clientX, startY: event.clientY, origin: selection.value, lastX: event.clientX, lastAt: event.timeStamp, velocity: 0, engaged: false};
  }
  function moveDrag(event: PointerEvent) {
    if (!gesture || gesture.pointer !== event.pointerId || stage !== 3) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.engaged) {
      if (Math.abs(dy) > 9 && Math.abs(dy) > Math.abs(dx)) { gesture = undefined; return; }
      if (Math.abs(dx) < 9 || Math.abs(dx) < Math.abs(dy)) return;
      gesture.engaged = true;
      canvas.setPointerCapture(event.pointerId);
      pendingSound = undefined;
    }
    const elapsed = event.timeStamp - gesture.lastAt;
    if (elapsed > 0) gesture.velocity = (event.clientX - gesture.lastX) / elapsed;
    gesture.lastX = event.clientX;
    gesture.lastAt = event.timeStamp;
    dragTarget = gesture.origin - dx / dragPixels();
    request();
  }
  function endDrag(event: PointerEvent) {
    if (!gesture || gesture.pointer !== event.pointerId) return;
    if (gesture.engaged && dragTarget !== undefined) {
      const velocity = event.type === "pointerup" && event.timeStamp - gesture.lastAt < 120 ? gesture.velocity : 0;
      const projected = dragTarget - clamp(velocity * 115 / dragPixels(), -.82, .82);
      const index = Math.round(projected);
      dragTarget = undefined;
      select(((index % cards.length) + cards.length) % cards.length);
      request();
    }
    gesture = undefined;
  }

  const updateStage = (self: ScrollTrigger) => {
    const scroll = self.scroll();
    const baseDistance = Math.max(1, self.end - self.start - galleryHold);
    targetStage = scroll < self.start ? BEFORE : BEAT_AT.filter((threshold, index) => {
      const extra = index === BEAT_AT.length - 1 ? galleryHold : 0;
      return scroll - self.start >= baseDistance * threshold + extra;
    }).length;
    request();
  };
  const refreshStage = (self: ScrollTrigger) => {
    galleryHold = holdMeasure?.offsetHeight ?? 0;
    updateStage(self);
  };
  const setupScroll = () => {
    trigger?.kill();
    trigger = undefined;
    if (reduced.matches) {
      targetStage = 3;
      section.dataset.reduced = "true";
    } else {
      delete section.dataset.reduced;
      trigger = ScrollTrigger.create({
        trigger: section, start: "top 50%", end: "bottom bottom",
        onUpdate: updateStage, onToggle: updateStage, onRefresh: refreshStage,
      });
      refreshStage(trigger);
    }
    request();
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible) { pendingSound = undefined; return; }
    if (targetStage === BEFORE || targetStage > 0) setStage(targetStage, true);
    request();
  }, {rootMargin: "30px"});
  observer.observe(section);

  let layoutWidth = frameHost.clientWidth;
  let layoutHeight = frameHost.clientHeight;
  const resize = new ResizeObserver(() => {
    const {clientWidth, clientHeight} = frameHost;
    if (clientWidth === layoutWidth && clientHeight === layoutHeight) return;
    layoutWidth = clientWidth;
    layoutHeight = clientHeight;
    layout();
    ScrollTrigger.refresh();
  });
  resize.observe(frameHost);
  section.addEventListener("folder-slide", changeSlide);
  canvas.addEventListener("pointerdown", beginDrag);
  canvas.addEventListener("pointermove", moveDrag);
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", endDrag);
  document.addEventListener("visibilitychange", request);
  window.addEventListener(CASE_VISIBILITY_EVENT, request);
  reduced.addEventListener("change", setupScroll);
  scope.defer(() => {
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    resize.disconnect();
    trigger?.kill();
    copy.dispose();
    delete section.dataset.reduced;
    section.removeEventListener("folder-slide", changeSlide);
    canvas.removeEventListener("pointerdown", beginDrag);
    canvas.removeEventListener("pointermove", moveDrag);
    canvas.removeEventListener("pointerup", endDrag);
    canvas.removeEventListener("pointercancel", endDrag);
    canvas.removeEventListener("pointerleave", endDrag);
    document.removeEventListener("visibilitychange", request);
    window.removeEventListener(CASE_VISIBILITY_EVENT, request);
    reduced.removeEventListener("change", setupScroll);
  });

  onActive?.(0);
  layout();
  ownedTextures.forEach(texture => renderer.initTexture(texture));
  await renderer.compileAsync(scene, camera);
  signal.throwIfAborted();
  setupScroll();
  if (targetStage !== 0) setStage(targetStage, true);
  renderPose();
  return scope.dispose;
}
