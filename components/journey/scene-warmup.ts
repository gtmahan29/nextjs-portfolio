import * as THREE from 'three';
import {yieldToMain} from './scene-loading';

/** compileAsync submits programs synchronously before waiting for the driver.
 * Bound each submission batch so scroll/input can run between submissions. */
export async function compileSceneInBatches(renderer:THREE.WebGLRenderer,root:THREE.Object3D,
  camera:THREE.Camera,lighting:THREE.Scene,signal:AbortSignal,compileTarget:THREE.WebGLRenderTarget|null=null){
  const groups=new Map<string,{objects:THREE.Object3D[];material:THREE.Material}>();
  const seen=new Set<string>();
  root.traverse(o=>{
    if(!(o instanceof THREE.Mesh||o instanceof THREE.Line||o instanceof THREE.Points))return;
    const material=Array.isArray(o.material)?o.material[0]:o.material;
    const signature=[(Array.isArray(o.material)?o.material:[o.material]).map(m=>m.uuid).join(','),o.type,
      o instanceof THREE.InstancedMesh,o instanceof THREE.InstancedMesh&&Boolean(o.instanceColor),o instanceof THREE.SkinnedMesh,
      Object.entries(o.geometry.attributes).map(([name,a])=>`${name}/${(a as THREE.BufferAttribute).itemSize}`).sort().join(','),Object.keys(o.geometry.morphAttributes).sort().join(',')].join(':');
    if(seen.has(signature))return;seen.add(signature);
    const key=`${material.clippingPlanes?.length??0}:${material.clipIntersection}`;
    const group=groups.get(key)??{objects:[] as THREE.Object3D[],material};group.objects.push(o);groups.set(key,group);
  });
  // This Three version's compileAsync does not initialize local clipping state.
  // Prime it with a tiny cheap draw, otherwise the first visible frame compiles
  // every expensive material again with NUM_CLIPPING_PLANES=2 instead of 0.
  const target=new THREE.WebGLRenderTarget(1,1),geometry=new THREE.PlaneGeometry(2,2);
  const primerMaterial=new THREE.MeshBasicMaterial(),primerScene=new THREE.Scene();
  primerScene.add(new THREE.Mesh(geometry,primerMaterial));
  const primerCamera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);primerCamera.position.z=1;
  const previousTarget=renderer.getRenderTarget();
  try{
    for(const {objects,material} of Array.from(groups.values())){
      await yieldToMain(signal);
      if(renderer.localClippingEnabled){
        primerMaterial.clippingPlanes=material.clippingPlanes;primerMaterial.clipIntersection=material.clipIntersection;
        const shadows=renderer.shadowMap.needsUpdate;renderer.shadowMap.needsUpdate=false;
        renderer.setRenderTarget(target);renderer.render(primerScene,primerCamera);
        renderer.setRenderTarget(previousTarget);renderer.shadowMap.needsUpdate=shadows;
      }
      for(let start=0;start<objects.length;start+=8){
        await yieldToMain(signal);
        const batch=new THREE.Scene();
        for(const object of objects.slice(start,start+8))batch.add(object.clone(false));
        // A live journey keeps drawing while later stations prepare. Never leave
        // its renderer bound to a warmup target across an asynchronous yield.
        const previous=renderer.getRenderTarget();let pending:Promise<unknown>;
        try{renderer.setRenderTarget(compileTarget);pending=renderer.compileAsync(batch,camera,lighting);}
        finally{renderer.setRenderTarget(previous);}
        await pending;
        signal.throwIfAborted();
      }
    }
  }finally{renderer.setRenderTarget(previousTarget);target.dispose();geometry.dispose();primerMaterial.dispose();}
}
