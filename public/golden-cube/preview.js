import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GoldenCubeController, PANEL_NAMES } from './controller.js';

const scene = new THREE.Scene(); scene.background = new THREE.Color('#080a0f');
const renderer = new THREE.WebGLRenderer({ antialias: true });
function viewportSize() { return innerWidth <= 700 ? [innerWidth, Math.max(180,innerHeight-385)] : [Math.max(200,innerWidth-280),innerHeight]; }
const [width,height] = viewportSize();
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(width, height);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.65;
document.body.prepend(renderer.domElement);
const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
camera.position.set(3.2, 2.9, 4.35);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.08, 0); controls.enableDamping = true;
controls.minDistance = 4; controls.maxDistance = 15;
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const environment = pmrem.fromScene(room, 0.04);
scene.environment = environment.texture; room.dispose(); pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xd5e6ff, 0x453214, 1));
const key = new THREE.DirectionalLight(0xffedcd, 4); key.position.set(-3, 5, 5); scene.add(key);
const fill = new THREE.DirectionalLight(0xafd9ff, 2); fill.position.set(3, 2, -2); scene.add(fill);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),0.25,0.25,1.5));
composer.addPass(new OutputPass());
const status = document.querySelector('#status');
const loader = new GLTFLoader();
const inputs = new Map();
let cube, rig, reference, referenceMode = false, framingDistance = null;
try {
  const gltf = await loader.loadAsync('./golden-cube.glb');
  cube = gltf.scene; scene.add(cube); rig = new GoldenCubeController(cube);
  cube.traverse(o => {
    if (o.isMesh) {
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of materials) {
        if (m.name.startsWith('Glass')) { m.thickness = 0.065; m.attenuationDistance = 3; m.attenuationColor.set('#fff3d5'); m.side = THREE.DoubleSide; }
        if (m.name.startsWith('Crystal')) { m.thickness = 0.15; m.side = THREE.DoubleSide; }
      }
    }
  });
  for (const name of PANEL_NAMES) {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<label for="panel-${name}">${name}<output>0%</output></label><input id="panel-${name}" aria-label="${name} opening" type="range" min="0" max="1" step="0.01" value="0">`;
    const input = row.querySelector('input'), output = row.querySelector('output');
    input.addEventListener('input', () => { rig.setPanel(name, Number(input.value)); output.value = `${Math.round(Number(input.value)*100)}%`; frameForPanels(); });
    inputs.set(name, { input, output }); document.querySelector('#sliders').append(row);
  }
  status.remove();
} catch (error) { status.textContent = `Could not load cube: ${error.message}`; throw error; }
function sync() {
  for (const [name, p] of rig.panels) { const {input,output} = inputs.get(name); input.value = p.target; output.value = `${Math.round(p.target*100)}%`; }
}
function frameForPanels() {
  const opened = Math.max(...[...rig.panels.values()].map(p => p.target));
  framingDistance = 5.7 + opened * 6.9;
}
document.querySelector('#open').onclick = () => { rig.openAll(); sync(); frameForPanels(); };
document.querySelector('#close').onclick = () => { rig.closeAll(); sync(); frameForPanels(); };
document.querySelector('#reference').onclick = async () => {
  const button = document.querySelector('#reference'); button.disabled = true;
  try {
    if (!reference) {
      reference = (await loader.loadAsync('./meshy-reference.glb')).scene;
      const box = new THREE.Box3().setFromObject(reference), size = box.getSize(new THREE.Vector3());
      reference.scale.setScalar(2.07 / Math.max(size.x,size.y,size.z));
      const scaled = new THREE.Box3().setFromObject(reference), center = scaled.getCenter(new THREE.Vector3());
      reference.position.sub(center).y += 1.09; scene.add(reference);
    }
    referenceMode = !referenceMode; reference.visible = referenceMode; cube.visible = !referenceMode;
    button.textContent = referenceMode ? 'View articulated cube' : 'View Meshy reference';
    for (const {input} of inputs.values()) input.disabled = referenceMode;
  } catch(error) { button.textContent = 'Reference failed to load'; console.error(error); }
  finally { button.disabled = false; }
};
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
let start;
renderer.domElement.addEventListener('pointerdown', e => { start = { x:e.clientX, y:e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!start || referenceMode || Math.hypot(e.clientX-start.x,e.clientY-start.y) > 5) return;
  const r = renderer.domElement.getBoundingClientRect();
  pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
  raycaster.setFromCamera(pointer,camera);
  let o = raycaster.intersectObject(cube,true)[0]?.object;
  while(o && !o.userData.panel_id) o=o.parent;
  if(o) {rig.toggle(o.userData.panel_id);sync();frameForPanels();}
});
addEventListener('resize', () => {
  const [width,height] = viewportSize();
  camera.aspect = width/height; camera.updateProjectionMatrix();
  renderer.setSize(width,height); composer.setSize(width,height);
});
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta(); rig?.update(dt);
  if(framingDistance !== null) {
    const offset = camera.position.clone().sub(controls.target);
    const distance = THREE.MathUtils.lerp(offset.length(), framingDistance, Math.min(dt * 5,1));
    camera.position.copy(controls.target).add(offset.setLength(distance));
    if(Math.abs(distance - framingDistance) < .01) framingDistance = null;
  }
  controls.update(); composer.render();
});
window.goldenCube = { scene, camera, renderer, rig, cube };
