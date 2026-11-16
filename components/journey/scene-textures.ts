import * as THREE from "three";
/** Abortable decode before scene construction; no unfinished texture can flash into view. */
export async function loadSceneTexture(url:string,signal:AbortSignal) {
  const response=await fetch(url,{signal});if(!response.ok)throw new Error(`Scene texture HTTP ${response.status}`);
  const blob=await response.blob();signal.throwIfAborted();
  let image:ImageBitmap|HTMLImageElement;
  if(typeof createImageBitmap==="function"){
    image=await createImageBitmap(blob,{imageOrientation:"flipY",colorSpaceConversion:"none"});
  }else{
    const objectURL=URL.createObjectURL(blob);const element=new Image();
    try {element.src=objectURL;await element.decode();image=element;}finally{URL.revokeObjectURL(objectURL);}
  }
  if(signal.aborted){if(typeof ImageBitmap!=="undefined"&&image instanceof ImageBitmap)image.close();signal.throwIfAborted();}
  const texture=new THREE.Texture(image);texture.colorSpace=THREE.NoColorSpace;texture.needsUpdate=true;
  const dispose=texture.dispose.bind(texture);
  texture.dispose=()=>{dispose();if(typeof ImageBitmap!=="undefined"&&image instanceof ImageBitmap)image.close();};
  return texture;
}
