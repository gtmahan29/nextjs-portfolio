import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';

let initialized=false;
/** One shared, bounded worker pool for both scene runtimes. */
export function sceneDecoder(){
  if(!initialized){
    initialized=true;
    if(typeof Worker!=='undefined'){
      try{(MeshoptDecoder as typeof MeshoptDecoder&{useWorkers:(count:number)=>void}).useWorkers(Math.min(2,Math.max(1,Math.floor((navigator.hardwareConcurrency||4)/2))));}
      catch{ /* Restricted worker environments retain the decoder's JS fallback. */ }
    }
  }
  return MeshoptDecoder;
}
