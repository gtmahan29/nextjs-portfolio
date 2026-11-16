import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const source = path.resolve('img2threejs-showcase-main/src/demos');
const target = path.resolve('components/journey/imported-models');
const assets = path.resolve('public/models/journey');
await fs.mkdir(target, { recursive: true });
await fs.mkdir(assets, { recursive: true });
for (const [from, to] of [
  ['sora/meshCodec.ts', 'meshCodec.ts'], ['sora/exportState.ts', 'exportState.ts'],
]) {
  let text = await fs.readFile(path.join(source, from), 'utf8');
  if (to === 'meshCodec.ts') text = text
    .replace('return [...decodeParts(model, base64)];', 'return Array.from(decodeParts(model, base64));')
    .replace('for (const part of decodeParts(model, base64))', 'for (const part of Array.from(decodeParts(model, base64)))');
  await fs.writeFile(path.join(target, to), text);
}
async function readModule(file) {
  const text = await fs.readFile(path.join(source, file), 'utf8');
  const js = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}
const [{ RIG }, { SURFACE_MODEL, SURFACE_STREAM }, { SURFACE_UV }] = await Promise.all([
  readModule('sora/rigData.skin-a.ts'), readModule('sora/surfaceData.skin-a.ts'), readModule('sora/surfaceUv.skin-a.ts'),
]);
// Keep the authored rig and the idle clip needed by this one observer. The gallery's
// other 43 actions and second outfit are not needed by the journey.
const rig = { ...RIG, clips: RIG.clips.filter(clip => clip.name === 'preset:biped:idle') };
if (rig.clips.length !== 1) throw new Error('Sora idle clip is missing');
await fs.writeFile(path.join(assets, 'sora.json'), JSON.stringify({ model: SURFACE_MODEL, stream: SURFACE_STREAM, rig, uv: SURFACE_UV }));
for (const name of ['albedo', 'normal', 'orm'])
  await fs.copyFile(path.join(source, `sora/textures/skin-a-${name}.jpg`), path.join(assets, `sora-${name}.jpg`));
await fs.rm(path.join(target, 'constructors.ts'), { force: true });
await fs.rm(path.join(target, 'schema.ts'), { force: true });
await fs.rm(path.join(assets, 'snowy-house.json'), { force: true });
console.log(JSON.stringify({ soraBones: rig.bones.length, clips: rig.clips.map(c => c.name) }));
