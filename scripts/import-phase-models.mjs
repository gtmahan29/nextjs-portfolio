import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const project = process.cwd();
const models = path.join(project, 'components/journey/imported-models');
await fs.mkdir(models, { recursive: true });
// One-time migration: bundle the FINISHED model's geometry helpers, never its viewer.
const require = createRequire(path.join(project, '3d-models/package.json'));
const { build } = require('esbuild');
const source = await fs.readFile(path.join(project, '3d-models/model.js'), 'utf8');
let geometry = source.slice(source.indexOf('const mat='), source.indexOf('const ground='));
geometry = geometry.replace('scene.add(root);', '').replace(/scene\.add\(l\);/g, '');
// The viewer's decorative point lights are unnecessary in the shared journey scene.
geometry = geometry.slice(0, geometry.indexOf('if(stage>=5){root.traverse')) +
  "mat.glow.emissive.set('#ffa019');";
await build({ stdin: { contents: source.split('\n').slice(0, 4).join('\n') +
  '\nexport function createDashboardPhaseModel(){const stage=5;\n' + geometry + '\nreturn root;}',
  resolveDir: path.join(project, '3d-models'), loader: 'js' },
  bundle: true, format: 'esm', external: ['three', 'three/*'],
  outfile: path.join(models, 'dashboard-model.js'), minify: true,
  banner: { js: '/* eslint-disable react/display-name -- vendored polygon geometry helpers, no React components */' } });
await fs.copyFile(path.join(project, '3d-model-3/src/layout.json'), path.join(models, 'cloud-layout.json'));
const read = relative => fs.readFile(path.join(project, relative), 'utf8');
const [devices, foliage, cloud] = await Promise.all([
  read('3d-model-3/src/deviceSurfaces.ts'), read('3d-model-3/src/foliage.ts'),
  read('3d-model-3/src/createObjectModel.ts'),
]);
const modernColors = value => value
  .replaceAll('THREE.sRGBEncoding', 'THREE.SRGBColorSpace')
  .replace(/\.encoding\s*=\s*THREE\.SRGBColorSpace/g, '.colorSpace=THREE.SRGBColorSpace')
  .replace(/\w+\.(?:color|emissive)\.convertSRGBToLinear\(\);/g, '')
  .replace('canvas.width=mobile?1024:2048;canvas.height=mobile?2048:1024;', 'canvas.width=mobile?512:1024;canvas.height=mobile?1024:512;')
  .replace("ctx.scale(2,kind==='laptop'?1.5:2);", "ctx.scale(1,kind==='laptop'?.75:1);");
const output = [
  'import * as THREE from "three";',
  'import layout from "./cloud-layout.json";',
  modernColors(devices), modernColors(foliage), modernColors(cloud),
  'export function createCloudPhaseModel() { return createObjectModel(layout, { maxAnisotropy: 8 }); }',
].join('\n');
await fs.writeFile(path.join(models, 'cloud-model.js'), output);
console.log('Imported the authored dashboard and cloud factories and measured cloud layout.');
