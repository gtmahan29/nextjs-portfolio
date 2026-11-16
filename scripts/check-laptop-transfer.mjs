import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const source=await fs.readFile('components/journey/laptop-transfer.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
  .replace("from 'three'",`from '${pathToFileURL(path.resolve('node_modules/three/build/three.module.js')).href}'`);
const {screenMatrix,transferEase,transferDisplay}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
for(const points of [
  [{x:0,y:0},{x:1440,y:0},{x:1440,y:900},{x:0,y:900}],
  [{x:320,y:160},{x:1010,y:220},{x:960,y:610},{x:360,y:640}],
  [{x:55,y:290},{x:330,y:305},{x:318,y:480},{x:61,y:491}],
]){
  const matrix=screenMatrix(points,1440,900);
  assert.ok(matrix.every(Number.isFinite));
  for(const [i,[x,y]] of [[0,0],[1440,0],[1440,900],[0,900]].entries()){
    const w=matrix[3]*x+matrix[7]*y+matrix[15];
    assert.ok(Math.abs((matrix[0]*x+matrix[4]*y+matrix[12])/w-points[i].x)<1e-7);
    assert.ok(Math.abs((matrix[1]*x+matrix[5]*y+matrix[13])/w-points[i].y)<1e-7);
  }
}
assert.equal(transferEase(.43,.72,0),0);assert.equal(transferEase(.43,.72,1),1);
assert.equal(transferEase(.81,1,.81),0);assert.equal(transferEase(.81,1,1),1);
for(const p of [.57,.65,.72,.81,.85])assert.equal(transferDisplay(p).product,0,'New image remains dark throughout closure and closed rotation');
assert.equal(transferDisplay(0).page,1);assert.equal(transferDisplay(1).product,1);
for(let i=1;i<=1000;i++){
  const a=transferDisplay((i-1)/1000),b=transferDisplay(i/1000);
  assert.ok(Math.abs(a.page-b.page)<.025&&Math.abs(a.product-b.product)<.025,'Screen changes must be continuous without a bright single-frame cut');
}
console.log('Display projection maps every corner exactly on desktop/mobile; motion endpoints are stable.');
