import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * Use Meshopt's built-in WASM decoder without its generated blob worker.
 * The worker serializes minified functions beside hard-coded identifier names,
 * which can leave glTF loading pending in production.
 */
export function sceneDecoder(){
  return MeshoptDecoder;
}
