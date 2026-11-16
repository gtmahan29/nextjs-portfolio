import fs from 'node:fs/promises';
import crypto from 'node:crypto';
export async function writeSceneAsset(name,bytes,extension,category,details={}) {
  const hash=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12);
  const folder=`public/models/${category}/optimized`,filename=`${name}.${hash}.${extension}`;
  await fs.mkdir(folder,{recursive:true});await fs.writeFile(`${folder}/${filename}`,bytes);
  const path='components/journey/imported-models/asset-manifest.json';
  let manifest={};try{manifest=JSON.parse(await fs.readFile(path,'utf8'));}catch{}
  manifest[name]={url:`/models/${category}/optimized/${filename}`,bytes:bytes.length,...details};
  await fs.writeFile(path,JSON.stringify(manifest,null,2)+'\n');
}
