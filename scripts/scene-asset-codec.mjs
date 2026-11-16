// Offline, bounded-error vertex quantization plus meshopt compression.
// No geometry is reconstructed or tessellated while visitors scroll.
import {MeshoptEncoder} from 'meshoptimizer';
export async function compressSceneAsset(glb,{quantize=true}={}) {
  await MeshoptEncoder.ready;
  const original=Buffer.from(glb),length=original.readUInt32LE(12);
  const json=JSON.parse(original.subarray(20,20+length)),binary=original.subarray(28+length);
  const roles=new Map();
  for(const mesh of json.meshes)for(const primitive of mesh.primitives)for(const [role,index] of Object.entries(primitive.attributes))roles.set(index,role);
  const positions=json.accessors.filter((a,i)=>roles.get(i)==='POSITION');
  const min=[0,1,2].map(i=>Math.min(...positions.map(a=>a.min[i]))),max=[0,1,2].map(i=>Math.max(...positions.map(a=>a.max[i])));
  const scale=Math.max(...max.map((n,i)=>n-min[i]));
  const chunks=[];let compressedLength=0,quantized=0;
  for(let i=0;i<json.bufferViews.length;i++) {
    const view=json.bufferViews[i],accessorIndex=json.accessors.findIndex(a=>a.bufferView===i),accessor=json.accessors[accessorIndex];
    let bytes=binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
    if(!accessor){view.buffer=0;view.byteOffset=compressedLength;const padded=Buffer.alloc(Math.ceil(bytes.length/4)*4);padded.set(bytes);chunks.push(padded);compressedLength+=padded.length;continue;}
    const componentBytes=({5120:1,5121:1,5122:2,5123:2,5125:4,5126:4})[accessor.componentType];
    const components=({SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16})[accessor.type];
    let stride=view.byteStride??componentBytes*components;
    const role=roles.get(accessorIndex);
    if(quantize&&accessor.componentType===5126&&(role==='POSITION'||role==='NORMAL'||role==='TEXCOORD_0')) {
      const components=role==='TEXCOORD_0'?2:3,componentBytes=role==='NORMAL'?1:2;
      const packedStride=role==='POSITION'?8:4,packed=Buffer.alloc(accessor.count*packedStride);
      const low=Array(components).fill(Infinity),high=Array(components).fill(-Infinity);
      let eligible=true;
      for(let v=0;v<accessor.count;v++)for(let c=0;c<components;c++) {
        const value=bytes.readFloatLE(v*stride+c*4);
        if(role==='TEXCOORD_0'&&(value<0||value>1))eligible=false;
        const normalized=role==='POSITION'?(value-min[c])/scale:value;
        const integer=role==='NORMAL'?Math.round(Math.max(-1,Math.min(1,normalized))*127):Math.round(Math.max(0,Math.min(1,normalized))*65535);
        low[c]=Math.min(low[c],integer);high[c]=Math.max(high[c],integer);
        if(componentBytes===1)packed.writeInt8(integer,v*packedStride+c);else packed.writeUInt16LE(integer,v*packedStride+c*2);
      }
      if(eligible){bytes=packed;stride=packedStride;view.byteLength=bytes.length;view.byteStride=stride;accessor.componentType=role==='NORMAL'?5120:5123;accessor.normalized=true;accessor.min=low;accessor.max=high;quantized++;}
    }
    const mode=view.target===34963?'TRIANGLES':'ATTRIBUTES';
    const compressed=MeshoptEncoder.encodeGltfBuffer(bytes,accessor.count,stride,mode);
    view.extensions={EXT_meshopt_compression:{buffer:0,byteOffset:compressedLength,byteLength:compressed.length,byteStride:stride,count:accessor.count,mode}};
    view.buffer=1;
    const padded=Buffer.alloc(Math.ceil(compressed.length/4)*4);padded.set(compressed);chunks.push(padded);compressedLength+=padded.length;
  }
  if(quantize){
    const root=json.nodes[json.scenes[json.scene??0].nodes[0]];root.translation=min;root.scale=[scale,scale,scale];
  }
  json.buffers=[{byteLength:compressedLength},{byteLength:binary.length,extensions:{EXT_meshopt_compression:{fallback:true}}}];
  const extensions=['EXT_meshopt_compression',...(quantized?['KHR_mesh_quantization']:[])];
  json.extensionsUsed=[...new Set([...(json.extensionsUsed??[]),...extensions])];json.extensionsRequired=[...new Set([...(json.extensionsRequired??[]),...extensions])];
  const encoded=Buffer.from(JSON.stringify(json)),jsonChunk=Buffer.alloc(Math.ceil(encoded.length/4)*4,32);jsonChunk.set(encoded);
  const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+jsonChunk.length+compressedLength,8);header.writeUInt32LE(jsonChunk.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const binaryHeader=Buffer.alloc(8);binaryHeader.writeUInt32LE(compressedLength,0);binaryHeader.writeUInt32LE(0x004e4942,4);
  return {asset:Buffer.concat([header,jsonChunk,binaryHeader,...chunks]),maxPositionError:quantize?scale/65535/2:0,quantizedAttributes:quantized};
}
