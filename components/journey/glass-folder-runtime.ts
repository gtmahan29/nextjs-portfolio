import * as THREE from "three";
import {RoomEnvironment} from "three/examples/jsm/environments/RoomEnvironment.js";
import {gsap} from "gsap";
import {ScrollTrigger} from "gsap/ScrollTrigger";
import type {SceneContext} from "./use-scene-runtime";
import {SceneScope} from "./scene-loading";
import {scenePixelRatio} from "./scene-quality";
import {CASE_VISIBILITY_EVENT, isCaseStudyOpen} from "./case-scene-visibility";
import {FOLDER_CARDS} from "./glass-folder-data";
import {createCameraProgress} from "./camera-motion";
import {createSpring, springCurve, SPRING_DURATION, SPRING_PEAK} from "./motion-curve";
import {play} from "./sfx";
import {CARD_WIDTH, CARD_HEIGHT, createStyleWriter, motionTrack, PUMP_TRACK, type MotionKey} from "./glass-folder-motion";


gsap.registerPlugin(ScrollTrigger);
const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
const phase = (p: number, a: number, b: number) => clamp((p - a) / (b - a), 0, 1);
const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
// Scroll → story pacing. The old piecewise-linear map changed speed abruptly at
// each join; matched velocities keep the arrival, gallery hold and exit continuous.
const PACING: readonly MotionKey[] = [
  {at: 0, value: 0, velocity: 1.15},
  {at: .66, value: .82, velocity: .23},
  {at: .86, value: .86, velocity: .24},
  {at: 1, value: 1, velocity: 1},
];

function rounded(width: number, height: number, radius: number) {
  const s = new THREE.Shape(), x = -width / 2, y = -height / 2, r = radius;
  s.moveTo(x + r, y);s.lineTo(x + width - r, y);s.quadraticCurveTo(x + width, y, x + width, y + r);
  s.lineTo(x + width, y + height - r);s.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  s.lineTo(x + r, y + height);s.quadraticCurveTo(x, y + height, x, y + height - r);
  s.lineTo(x, y + r);s.quadraticCurveTo(x, y, x + r, y);return s;
}

/** Both covers are real bevelled volumes. The hinge is at the lower seam. */
function folderCover(back = false) {
  const s = new THREE.Shape();
  s.moveTo(-2.02, 0);s.lineTo(2.02, 0);s.quadraticCurveTo(2.4, 0, 2.4, .38);
  if (back) {
    s.lineTo(2.4, 2.48);s.quadraticCurveTo(2.4, 2.83, 2.05, 2.83);
    s.lineTo(-.13, 2.83);s.bezierCurveTo(-.43, 2.83, -.34, 3.17, -.7, 3.17);
    s.lineTo(-1.99, 3.17);s.quadraticCurveTo(-2.4, 3.17, -2.4, 2.76);
  } else {
    s.lineTo(2.4, 1.91);s.quadraticCurveTo(2.4, 2.28, 2.03, 2.28);
    s.lineTo(.22, 2.28);s.bezierCurveTo(-.25, 2.28, -.16, 2.67, -.17, 2.85);
    s.quadraticCurveTo(-.18, 3.12, -.52, 3.12);s.lineTo(-1.99, 3.12);
    s.quadraticCurveTo(-2.4, 3.12, -2.4, 2.71);
  }
  s.lineTo(-2.4, .38);s.quadraticCurveTo(-2.4, 0, -2.02, 0);
  return new THREE.ExtrudeGeometry(s, {depth: .045, bevelEnabled: true, bevelSegments: 6, steps: 1, bevelSize: .035, bevelThickness: .035, curveSegments: 32});
}

function canvasTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");canvas.width = width;canvas.height = height;
  paint(canvas.getContext("2d")!);
  const texture = new THREE.CanvasTexture(canvas);texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;return texture;
}

async function cardTexture(index: number, font: string) {
  const card = FOLDER_CARDS[index];
  const image = await new Promise<HTMLImageElement | null>(resolve => {
    const img = new Image();img.onload = () => resolve(img);img.onerror = () => resolve(null);img.src = card.image;
  });
  return canvasTexture(1536, 1056, ctx => {
    ctx.fillStyle = "#fffdf7";ctx.fillRect(0, 0, 1536, 1056);
    ctx.save();ctx.beginPath();ctx.roundRect(14, 14, 1508, 860, 24);ctx.clip();
    if (image) {
      const scale = Math.max(1508 / image.width, 860 / image.height);
      ctx.drawImage(image, 14 + (1508 - image.width * scale) / 2, 14 + (860 - image.height * scale) / 2, image.width * scale, image.height * scale);
    } else {ctx.fillStyle = card.paper;ctx.fillRect(14, 14, 1508, 860);}
    ctx.restore();
    ctx.fillStyle = "#292a27";ctx.font = `500 49px ${font}`;ctx.fillText(card.title, 52, 953);
    ctx.font = `400 28px ${font}`;ctx.fillStyle = "#78796e";ctx.fillText(card.category, 54, 1009);
    ctx.textAlign = "right";ctx.font = `500 26px ${font}`;ctx.fillText(`0${index + 1}`, 1477, 1007);
    ctx.strokeStyle = "#555b4e";ctx.lineWidth = 3.5;ctx.lineCap="round";ctx.lineJoin="round";
    ctx.beginPath();ctx.moveTo(1435, 950);ctx.lineTo(1474, 911);ctx.moveTo(1445, 911);ctx.lineTo(1474, 911);ctx.lineTo(1474, 940);ctx.stroke();
  });
}

export async function mountScene({canvas, section, signal, quality, onActive}: SceneContext) {
  const scope = new SceneScope(signal);
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true, powerPreference: "high-performance"});
  scope.defer(() => renderer.dispose());
  renderer.outputColorSpace = THREE.SRGBColorSpace;renderer.toneMapping = THREE.ACESFilmicToneMapping;renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0xffffff, 0);
  const scene = new THREE.Scene();scene.background = new THREE.Color("#ffffff");
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 80);
  const environment = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(environment, .02);scene.environment = env.texture;
  scope.defer(() => {env.dispose();pmrem.dispose();environment.dispose();});
  const key = new THREE.DirectionalLight(0xfff9ec, 4);key.position.set(-4, 7, 8);scene.add(key);
  const fill = new THREE.DirectionalLight(0xf4f7ff, 2);fill.position.set(5, 3, 4);scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd6aa57, 1.6));

  const ownedGeometries: THREE.BufferGeometry[] = [], ownedMaterials: THREE.Material[] = [], ownedTextures: THREE.Texture[] = [];
  const geometry = <T extends THREE.BufferGeometry>(value: T) => {ownedGeometries.push(value);return value;};
  const material = <T extends THREE.Material>(value: T) => {ownedMaterials.push(value);return value;};
  const texture = (value: THREE.Texture) => {ownedTextures.push(value);return value;};
  scope.defer(() => {ownedGeometries.forEach(g => g.dispose());ownedMaterials.forEach(m => m.dispose());ownedTextures.forEach(t => t.dispose());});
  const world = new THREE.Group(), folder = new THREE.Group(), front = new THREE.Group();scene.add(world);world.add(folder);folder.add(front);
  const tint = texture(canvasTexture(512, 512, ctx => {
    const gradient = ctx.createLinearGradient(0, 0, 380, 512);gradient.addColorStop(0, "#fff1ce");gradient.addColorStop(.28, "#ffc732");gradient.addColorStop(.65, "#ffbb0c");gradient.addColorStop(1, "#fff0bb");ctx.fillStyle = gradient;ctx.fillRect(0, 0, 512, 512);
  }));
  // Object-space UVs keep the amber gradient continuous across both irregular covers.
  const frontGeometry = geometry(folderCover()), backGeometry = geometry(folderCover(true));
  [frontGeometry, backGeometry].forEach(g => {const p = g.attributes.position, uv = g.attributes.uv;for(let i = 0;i < p.count;i++)uv.setXY(i, (p.getX(i) + 2.45) / 4.9, p.getY(i) / 3.2);});
  const glass = material(new THREE.MeshPhysicalMaterial({color: "#fff7df", map: tint, transmission: .78, roughness: .25, thickness: .36, ior: 1.42, metalness: 0, clearcoat: 1, clearcoatRoughness: .12, attenuationColor: new THREE.Color("#f9bc39"), attenuationDistance: 2.2, envMapIntensity: 1.3, side: THREE.DoubleSide}));
  const backMaterial = material(new THREE.MeshPhysicalMaterial({color: "#ffbd16", roughness: .23, metalness: .02, clearcoat: 1, envMapIntensity: 1}));
  const frontMesh = new THREE.Mesh(frontGeometry, glass);front.add(frontMesh);
  const back = new THREE.Mesh(backGeometry, backMaterial);back.position.z = -.55;folder.add(back);
  const rim = new THREE.LineSegments(geometry(new THREE.EdgesGeometry(frontGeometry, 32)), material(new THREE.LineBasicMaterial({color: "#fff9e9", transparent: true, opacity: .42})));front.add(rim);
  const label = texture(canvasTexture(1536, 1024, ctx => {
    ctx.fillStyle = "#fff8df";ctx.font = "400 43px Arial";ctx.fillText("THE STUDIO", 120, 784);ctx.font = "600 108px Arial";ctx.fillText("Archive", 114, 900);
    ctx.strokeStyle = "#fff7d9";ctx.lineWidth = 9;ctx.lineCap = "round";ctx.lineJoin = "round";ctx.beginPath();ctx.moveTo(1260, 861);ctx.lineTo(1340, 861);ctx.moveTo(1308, 829);ctx.lineTo(1340, 861);ctx.lineTo(1308, 893);ctx.stroke();
  }));
  const labelMesh = new THREE.Mesh(geometry(new THREE.PlaneGeometry(4.8, 3.2)), material(new THREE.MeshBasicMaterial({map: label, transparent: true, depthWrite: false, toneMapped: false})));labelMesh.position.set(0, 1.6, .086);front.add(labelMesh);
  const seam = new THREE.Mesh(geometry(new THREE.ExtrudeGeometry(rounded(4.35,.12,.055),{depth:.62,bevelEnabled:true,bevelSize:.025,bevelThickness:.02,bevelSegments:4,steps:1})),material(new THREE.MeshPhysicalMaterial({color:"#ffcf4a",roughness:.3,clearcoat:1})));seam.position.set(0,.05,-.55);folder.add(seam);

  const font=getComputedStyle(section).getPropertyValue("--font-archive").trim() || "sans-serif";
  await document.fonts.load(`500 49px ${font}`);
  const textures = await Promise.all(FOLDER_CARDS.map((_, i) => cardTexture(i,font)));
  if (signal.aborted) {textures.forEach(t => t.dispose());scope.dispose();return () => {};}
  textures.forEach(texture);
  const cardGeometry = geometry(new THREE.ExtrudeGeometry(rounded(CARD_WIDTH, CARD_HEIGHT, .105), {depth: .045, bevelEnabled: true, bevelSize: .016, bevelThickness: .014, bevelSegments: 4, curveSegments: 24, steps: 1}));
  const faceGeometry = geometry(new THREE.ShapeGeometry(rounded(CARD_WIDTH, CARD_HEIGHT, .105), 24));
  // ShapeGeometry's default UVs are world coordinates, so map them to the full print.
  const facePositions = faceGeometry.attributes.position, faceUvs = faceGeometry.attributes.uv;
  for (let i = 0;i < facePositions.count;i++)faceUvs.setXY(i, facePositions.getX(i) / CARD_WIDTH + .5, facePositions.getY(i) / CARD_HEIGHT + .5);
  const cards = textures.map((map, i) => {
    const group = new THREE.Group();group.userData.index = i;
    const stock = new THREE.Mesh(cardGeometry, material(new THREE.MeshPhysicalMaterial({color: "#dedace", roughness: .3, metalness: .12, clearcoat: .65})));group.add(stock);
    const print = new THREE.Mesh(faceGeometry, material(new THREE.MeshBasicMaterial({map, toneMapped: false})));print.position.z = .06;group.add(print);world.add(group);return group;
  });
  const pocketFrame = new THREE.Object3D();world.add(pocketFrame);
  const inspectClearance=new URLSearchParams(location.search).has("motionDebug");
  const folderBounds = new THREE.Box3(), cardBounds = new THREE.Box3();
  const pocketPosition = new THREE.Vector3(), galleryPosition = new THREE.Vector3();
  const pocketRotation = new THREE.Quaternion(), localRotation = new THREE.Quaternion(), galleryRotation = new THREE.Quaternion();
  const cardEuler = new THREE.Euler();
  const shadowMap = texture(canvasTexture(256, 256, ctx => {const g=ctx.createRadialGradient(128,128,0,128,128,125);g.addColorStop(0,"#67450e48");g.addColorStop(.45,"#67450e25");g.addColorStop(1,"#67450e00");ctx.fillStyle=g;ctx.fillRect(0,0,256,256);}));
  const shadow = new THREE.Mesh(geometry(new THREE.PlaneGeometry(7, 2.5)), material(new THREE.MeshBasicMaterial({map: shadowMap, transparent: true, depthWrite: false, toneMapped: false})));shadow.position.set(0,-2.42,-.6);world.add(shadow);

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const motion = {progress: 0, selection: 0}, pointer = new THREE.Vector2(), pointerTarget = new THREE.Vector2();
  const heading=section.querySelector<HTMLElement>(".glass-archive-heading");
  const finePointer=matchMedia("(hover: hover) and (pointer: fine)");
  const selectionSpring = createSpring(0);
  let catchPending = false, previousHinge = 0;
  const writeStyle=createStyleWriter();
  let active = 0, stage = -1, frame = 0, visible = false, disposed = false, last = performance.now(), mobile = false, dirty = true, cameraDistance = 12;
  let trigger: ScrollTrigger | undefined;
  let targetProgress=0;
  const followScroll=createCameraProgress(0,.38);
  const request = () => {dirty = true;if (!frame && visible && !disposed && !document.hidden && !isCaseStudyOpen()) {last=performance.now();frame=requestAnimationFrame(tick);}};
  function layout() {
    const host = canvas.parentElement!, width = host.clientWidth, height = host.clientHeight;mobile = width < 760;
    renderer.setPixelRatio(Math.min(1.5,scenePixelRatio(quality, width, height, devicePixelRatio),Math.sqrt(2_200_000/(width*height))));renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const viewWidth = mobile ? 6.1 : width / height < 1.3 ? 13.4 : 16;
    cameraDistance = Math.max(9.8, viewWidth / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
    camera.position.set(0, 1.4, cameraDistance);camera.lookAt(0,.3,0);camera.updateProjectionMatrix();request();
  }
  const renderPose = () => {
    const raw = motion.progress;
    // Arrive by 62%, hold the gallery until 88%, then leave without a rushed fall.
    // Constant travel mapping avoids the old whole-sequence quintic speed surge.
    const p = reduced.matches ? .84 : motionTrack(raw, PACING);
    const land = smooth(phase(p,0,.29)), hinge = phase(p,.29,.48);
    const opening = springCurve(hinge), peek = smooth(phase(p,.33,.47));
    const hingePeak = SPRING_PEAK / SPRING_DURATION;
    if (!reduced.matches && visible && hinge - previousHinge < .15 && previousHinge < hingePeak && hinge >= hingePeak) play("ui_pop");
    previousHinge = hinge;
    const release = smooth(phase(p,.61,.79)), shrink=smooth(phase(p,.665,.79)), exit=phase(p,.865,.995);
    const falling=14*smooth(exit);
    const nextStage = p < .3 ? 0 : p < .81 ? 1 : p < .88 ? 2 : 3;
    if (stage !== nextStage) {stage = nextStage;section.dispatchEvent(new CustomEvent("folder-stage", {detail: stage}));}
    const sway = reduced.matches ? 0 : Math.sin(phase(p,.09,.3)*Math.PI) * .07;
    world.rotation.set(pointer.y*.008, pointer.x*.018, 0);
    const follow=smooth(phase(p,.53,.62))*(1-smooth(phase(p,.67,.81)));
    camera.position.z=cameraDistance*mix(1,mobile ? .87 : 1,release);camera.lookAt(0,.3+follow*(mobile ? .5 : .4),0);
    // The stationary pocket owns the cards until they clear the opening. Moving the folder
    // away later never pulls partly enclosed cards sideways through either cover.
    pocketFrame.position.set(0,mix(7,-1.55,land),0);
    pocketFrame.rotation.set(mix(-.5,.045,land),mix(-.3,-.08,land),mix(-.15,-.015,land)+sway);
    pocketFrame.scale.setScalar(.94);pocketFrame.updateMatrix();
    folder.position.copy(pocketFrame.position);folder.position.y-=release*(mobile ? 1.25 : 1.55)+falling;
    folder.rotation.copy(pocketFrame.rotation);folder.rotation.x+=exit*exit*.12;folder.rotation.z+=exit*exit*.035;
    folder.scale.setScalar(mix(.94,mobile ? .34 : .42,shrink));
    front.rotation.x = opening * .37;front.position.z = .09 + opening*.12;
    // Only the pocket matrix is needed for card placement. The renderer updates
    // world transforms once; do not traverse the complete scene twice per frame.
    if(inspectClearance){world.updateMatrixWorld(true);folderBounds.setFromObject(folder);}
    let minimumClearance=Infinity;
    cards.forEach((card,i) => {
      const fan=i===0 ? 0 : i===1 ? 1 : -1, time=p-i*.009;
      const spread=smooth(phase(time,.64,.805));
      const localY=motionTrack(time,PUMP_TRACK);
      pocketPosition.set(fan*.60,localY,-.09-i*.10).applyMatrix4(pocketFrame.matrix);
      cardEuler.set(0,0,-fan*.11*peek*(1-smooth(phase(time,.545,.64))));localRotation.setFromEuler(cardEuler);
      pocketRotation.copy(pocketFrame.quaternion).multiply(localRotation);
      const arc = (i - motion.selection) * Math.PI * 2 / cards.length;
      // An elliptical ring has no wrap seam: cards travel continuously behind the centre card.
      const orbitX = Math.sin(arc) * (mobile ? 2.35 : 4.45), orbitZ = 2.8+Math.cos(arc);
      const finalY=(mobile ? .6 : .55)-(1-Math.cos(arc))*.20+Math.sin(arc)*.06;
      const delayedExit=phase(p,.88+i*.009,.995), drop=13*smooth(delayedExit);
      galleryPosition.set(orbitX,finalY,orbitZ);
      card.position.copy(pocketPosition).lerp(galleryPosition,spread);
      // The apex and the descent share velocity and acceleration. No height clamp retargets
      // the card mid-flight; the folder has already lowered before horizontal travel begins.
      if(time>.64)card.position.y=motionTrack(time,[
        {at:.64,value:pocketPosition.y},
        {at:.735,value:finalY+.48,velocity:-8},
        {at:.805,value:finalY},
      ]);
      cardEuler.set(-.025,-Math.sin(arc)*.48,-Math.sin(arc)*.045);galleryRotation.setFromEuler(cardEuler);
      card.quaternion.copy(pocketRotation).slerp(galleryRotation,spread);
      const focus=.84+.16*(1+Math.cos(arc))*.5;
      card.scale.setScalar(mix(.90*.94,(mobile ? .95 : 1.02)*focus,spread));
      // Diagnostics measure clearance, but never alter the path or its velocity.
      if(inspectClearance&&spread>0&&delayedExit===0){
        card.updateMatrixWorld(true);cardBounds.setFromObject(card);
        const clearance=cardBounds.min.y-folderBounds.max.y;
        minimumClearance=Math.min(minimumClearance,clearance);
      }
      // Gallery depth is already in front of the covers. The fall has no preparatory zoom.
      card.position.y-=drop;card.position.x+=fan*drop*.025;card.position.z-=drop*.012;
      card.rotation.x+=delayedExit*delayedExit*.22;card.rotation.z+=delayedExit*delayedExit*fan*.055;
      // Initially these small cards fit physically within the closed covers.
      card.visible = p > .04 && p < 1;
    });
    shadow.scale.setScalar(mix(.5,1,land)*mix(1,.35,release)*(1-exit));shadow.position.y=mix(-2.42,mobile ? -3.35 : -3.7,release);shadow.visible=p>.025&&p<.98;
    const leave=smooth(phase(p,.86,.96));
    writeStyle(heading,`translate3d(0,${(-release*16-leave*36).toFixed(2)}px,0)`,1-leave);
    // Diagnostics only: attribute writes on the section restyle its whole subtree.
    if(inspectClearance){
      section.dataset.folderProgress=motion.progress.toFixed(5);
      section.dataset.folderClearance=Number.isFinite(minimumClearance)?minimumClearance.toFixed(3):"enclosed";
    }
    renderer.render(scene,camera);if(!section.dataset.sceneRendered)section.dataset.sceneRendered="true";
  };
  function tick(now: number) {
    frame=0;if(disposed||!visible||document.hidden||isCaseStudyOpen())return;
    const delta=Math.min((now-last)/1000,.05);last=now;
    const previous=motion.progress;
    // Same critically damped follower as the key: continuous velocity, no bounce,
    // no input lock and no second GSAP scrub layered over the renderer.
    motion.progress=followScroll(targetProgress,delta,reduced.matches);
    const scrollMoving=Math.abs(targetProgress-motion.progress)>.00001||Math.abs(previous-motion.progress)>.000001;
    const previousVelocity = selectionSpring.velocity;
    const selecting = selectionSpring.step(active, delta);
    motion.selection = selectionSpring.value;
    if (catchPending && previousVelocity * selectionSpring.velocity <= 0 && previousVelocity !== 0) {
      catchPending = false;
      if (stage === 2) play("ui_pop");
    }
    const unsettled=scrollMoving||selecting||pointer.distanceTo(pointerTarget)>.0002;
    pointer.x=THREE.MathUtils.damp(pointer.x,pointerTarget.x,9,delta);pointer.y=THREE.MathUtils.damp(pointer.y,pointerTarget.y,9,delta);
    // Scroll is already sampled at display refresh. A second FPS throttle
    // discarded intermediate poses, particularly on the lower quality tier.
    if (dirty||unsettled) {renderPose();dirty=false;}
    if(unsettled)frame=requestAnimationFrame(tick);
  }
  const changeSlide = (event: Event) => {
    const detail=(event as CustomEvent<number|{index:number;instant:boolean}>).detail;
    const i=typeof detail==="number"?detail:detail.index;
    const current=((active%cards.length)+cards.length)%cards.length;
    const half=Math.floor(cards.length/2);
    const step=((i-current+cards.length+half)%cards.length)-half;
    if (!step) return;
    active += step;
    const instant = reduced.matches || (typeof detail !== "number" && detail.instant);
    catchPending = !instant;
    if (instant) { selectionSpring.snap(active); motion.selection = active; }
    onActive?.(i);
    request();
  };
  // Expose only native DOM controls; scrolling over the canvas always scrolls the document.
  section.addEventListener("folder-slide",changeSlide);scope.defer(()=>section.removeEventListener("folder-slide",changeSlide));
  const point = (event: PointerEvent) => {if(reduced.matches||!finePointer.matches)return;const rect=canvas.getBoundingClientRect();pointerTarget.set((event.clientX-rect.left)/rect.width*2-1,(event.clientY-rect.top)/rect.height*2-1);request();};
  const resetPointer=()=>{pointerTarget.set(0,0);request();};canvas.addEventListener("pointermove",point);canvas.addEventListener("pointerleave",resetPointer);
  scope.defer(()=>{canvas.removeEventListener("pointermove",point);canvas.removeEventListener("pointerleave",resetPointer);});
  const setupScroll = () => {
    trigger?.kill();
    if (!reduced.matches) {
      trigger=ScrollTrigger.create({trigger:section,start:"top bottom",end:"bottom bottom",
        onUpdate:self=>{targetProgress=self.progress;request();},
        onRefresh:self=>{targetProgress=self.progress;request();}});
    }
    request();
  };
  const observer=new IntersectionObserver(([entry])=>{
    // Re-entering after a jump starts from the current scroll pose; never replay a stale one.
    if(entry.isIntersecting&&!visible){targetProgress=trigger?.progress??targetProgress;motion.progress=followScroll(targetProgress,0,true);}
    visible=entry.isIntersecting;if(visible)request();
  },{rootMargin:"100px"});observer.observe(section);
  let layoutWidth=canvas.parentElement!.clientWidth,layoutHeight=canvas.parentElement!.clientHeight;
  const resize=new ResizeObserver(()=>{
    const host=canvas.parentElement!;
    if(host.clientWidth===layoutWidth&&host.clientHeight===layoutHeight)return;
    layoutWidth=host.clientWidth;layoutHeight=host.clientHeight;
    layout();ScrollTrigger.refresh();
  });resize.observe(canvas.parentElement!);
  document.addEventListener("visibilitychange",request);window.addEventListener(CASE_VISIBILITY_EVENT,request);reduced.addEventListener("change",setupScroll);
  scope.defer(()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();trigger?.kill();document.removeEventListener("visibilitychange",request);window.removeEventListener(CASE_VISIBILITY_EVENT,request);reduced.removeEventListener("change",setupScroll);});
  onActive?.(0);layout();
  ownedTextures.forEach(texture=>renderer.initTexture(texture));
  await renderer.compileAsync(scene,camera);signal.throwIfAborted();
  setupScroll();renderPose();
  return scope.dispose;
}
