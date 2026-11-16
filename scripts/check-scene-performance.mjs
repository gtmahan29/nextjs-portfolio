import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
async function loadModule(path){const source=await fs.readFile(path,'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));}
const {chooseSceneTier,scenePixelRatio,SCENE_QUALITY,AdaptiveSceneQuality}=await loadModule('components/journey/scene-quality.ts');
const {SceneScope,queueSceneSetup}=await loadModule('components/journey/scene-loading.ts');
globalThis.window={setTimeout};
const desktop={coarse:false,small:false,memory:8,cores:8};
assert.equal(chooseSceneTier(desktop),'high');
assert.equal(chooseSceneTier({...desktop,memory:4}),'low');
assert.equal(chooseSceneTier({...desktop,saveData:true}),'low');
assert.equal(chooseSceneTier({...desktop,coarse:true}),'balanced');
assert.ok(scenePixelRatio(SCENE_QUALITY.high,3840,2160,3)**2*3840*2160<=SCENE_QUALITY.high.maxPixels+1);
for(const quality of Object.values(SCENE_QUALITY)){
  assert.equal(quality.antialias,true,'Every tier must preserve smooth silhouette edges');
  assert.ok(scenePixelRatio(quality,390,844,3)>=1.5,'Mobile rendering must retain sharp edges');
}
assert.ok(scenePixelRatio(SCENE_QUALITY.low,1920,1080,1)>=1,'Desktop low tier must not upscale a blurry sub-native canvas');
const adaptive=new AdaptiveSceneQuality({...SCENE_QUALITY.high});
for(let i=0;i<200;i++)adaptive.sample(i*20,4,20);
assert.equal(adaptive.current.tier,'high','Healthy frame cadence must preserve quality');
adaptive.sample(5000,1000,1000);assert.equal(adaptive.current.tier,'high','Isolated stalls do not downgrade quality');
for(let i=0;i<80;i++)adaptive.sample(6000+i*40,25,40);
assert.equal(adaptive.current.tier,'balanced','Sustained pressure must reduce quality');
const controller=new AbortController(),scope=new SceneScope(controller.signal),calls=[];
scope.defer(()=>calls.push('first'));scope.defer(()=>calls.push('last'));controller.abort();scope.dispose();
assert.deepEqual(calls,['last','first'],'Cleanup is reverse order and idempotent');
let unblock;const gate=new Promise(resolve=>{unblock=resolve;});
const first=queueSceneSetup(new AbortController().signal,async()=>{await gate;return 1;});
const aborted=new AbortController();let ran=false;
const second=queueSceneSetup(aborted.signal,async()=>{ran=true;});const rejection=assert.rejects(second);
aborted.abort();unblock();assert.equal(await first,1);await rejection;assert.equal(ran,false,'Canceled queued work must not construct a scene');
assert.equal(await queueSceneSetup(new AbortController().signal,async()=>2),2,'A canceled setup must not poison later scenes');
console.log('Quality budgets, sustained adaptation, idempotent cleanup and setup cancellation passed.');
