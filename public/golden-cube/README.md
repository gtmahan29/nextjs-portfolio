# Golden Cube

An opaque, reflective golden cube inspired by the supplied image. All six faces
open independently about exterior hinge pivots, up to 105 degrees. The rounded,
mitered shells meet along their boundaries when closed.

## Files

- `golden-cube.glb`: final lightweight, layered, movable asset, with PBR materials.
- `golden-cube.blend`: editable Blender scene, original scene, studio, and hidden Meshy reference.
- `controller.js`: standalone Three.js hinge controller.
- `index.html` / `preview.js`: local interactive demo with sliders, clicking, and all-face controls.
- `meshy-reference.glb`: original fused Meshy 6 Lite output, retained for comparison.

Meshy 6 Lite task `01a13571-bebc-704a-9c06-760fe263a79b` used 15 credits,
including 2K textures. Meshy's result was one fused object. Blender reconstruction
provides the mechanical hierarchy; the final geometry is reconstructed, rather
than a separation of the original fused Meshy mesh. Later appearance and seam
edits were done in Blender without another Meshy generation.

## Three.js use

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GoldenCubeController } from './controller.js';

const gltf = await new GLTFLoader().loadAsync('/golden-cube/golden-cube.glb');
scene.add(gltf.scene);
const cube = new GoldenCubeController(gltf.scene);

cube.open('top');
cube.setPanel('front', 0.5); // 0 is closed, 1 is open; smooth progression
cube.close('top');
cube.openAll();
cube.closeAll();

// In your render loop:
cube.update(clock.getDelta());
```

Supported panel names: `front`, `right`, `back`, `left`, `top`, `bottom`.
The controller also supports `setPanel(name, amount, { immediate: true })` for
scroll-driven or externally interpolated states. The GLB has no baked clips;
rotation comes from the controller or your own quaternion animation.

Each `Hinge_<name>` contains a `Panel_<name>`, with distinct shell, metal,
gold, circuit, rim, and jewel objects. Names and hinge axis/angle metadata survive
export as glTF extras / Three.js userData. glTF uses Y-up; the controller handles
the converted local axis, so rotate the hinge rather than individual layer meshes.

Use environment lighting (HDRI or RoomEnvironment) for metallic reflections.
Bloom is a viewer effect, and is not stored in the GLB. All asset materials are
opaque; none use transmission. Independent opening is a visual animation, with
no collision simulation. The panels are hollow on the inside.

## Local demo

From the repository root:

```powershell
python -m http.server 8765 --bind 127.0.0.1 --directory public
```

Open `http://127.0.0.1:8765/golden-cube/index.html`.
When Next.js is running, the same demo is available at `/golden-cube/index.html`.
Three.js dependencies for this demo are local and include the Three.js MIT license.

The reproducible Blender modeling script is `scripts/create-golden-cube.py`.
The saved .blend also contains the downloaded reference; rerunning the modeling
script creates a fresh studio and final asset, without another Meshy API call.
