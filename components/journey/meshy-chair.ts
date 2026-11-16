import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { MeshyFixture } from "./meshy-population-layout";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { MeshySeatFit } from "./meshy-seat-fit";

/** Shared furniture resources; every chair is fitted to the posed character's hips. */
export function createMeshyFurniture() {
  const geometry = new RoundedBoxGeometry(1, 1, 1, 2, .07);
  const batches = new Set<THREE.BufferGeometry>();
  const materials = [
    new THREE.MeshStandardMaterial({ color: "#738a92", roughness: .9 }),
    new THREE.MeshStandardMaterial({ color: "#cbbca3", roughness: .82 }),
    new THREE.MeshStandardMaterial({ color: "#4e626f", roughness: .65, metalness: .15 }),
    new THREE.MeshStandardMaterial({ color: "#e1e9e9", roughness: .8 }),
    new THREE.MeshStandardMaterial({ color: "#b5d9de", emissive: "#8ab7c1", emissiveIntensity: .2, roughness: .7 }),
  ];
  const finish = (root: THREE.Group) => {
    for (const material of materials) {
      const meshes = root.children.filter((object): object is THREE.Mesh => object instanceof THREE.Mesh && object.material === material && object.geometry === geometry);
      if (meshes.length < 2) continue;
      const parts = meshes.map(mesh => { mesh.updateMatrix(); return mesh.geometry.clone().applyMatrix4(mesh.matrix); });
      const merged = mergeGeometries(parts); parts.forEach(part => part.dispose());
      if (!merged) continue;
      batches.add(merged); meshes.forEach(mesh => mesh.removeFromParent());
      const mesh = new THREE.Mesh(merged, material); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    }
    return root;
  };
  function build(hips: THREE.Vector3, seatY: number, scale: number, variant: MeshyFixture = "code", standing = false) {
    const root = new THREE.Group(); root.name = "meshy-office-chair-and-desk";
    const add = (x: number, y: number, z: number, w: number, h: number, d: number, material: number) => {
      const mesh = new THREE.Mesh(geometry, materials[material]);
      mesh.position.set(x, y, z); mesh.scale.set(w, h, d);
      mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
      const boxes = root.userData.collisionBoxes ??= [];
      boxes.push({x,y,z,w,h,d});
    };
    const x = hips.x, z = hips.z + .11 * scale, width = .65 * scale, depth = .55 * scale;
    if (!standing) {
    add(x, seatY - .055 * scale, z, width, .11 * scale, depth, 0);
    add(x, seatY + .31 * scale, z - depth / 2, width, .62 * scale, .075 * scale, 1);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const legX = x + sx * width * .39, legZ = z + sz * depth * .38;
      add(legX, seatY / 2 - .055 * scale, legZ, .05 * scale, Math.max(.1, seatY - .11 * scale), .05 * scale, 2);
      add(legX, .025 * scale, legZ, .095 * scale, .05 * scale, .095 * scale, 2);
    }
    }
    root.userData.seatY = seatY; root.userData.variant = variant;
    if (variant === "meeting" || variant === "lounge") return finish(root);
    const deskZ = z + .88 * scale, deskY = seatY + .42 * scale;
    add(x, deskY, deskZ, 1.16 * scale, .075 * scale, .58 * scale, 3);
    for (const side of [-1, 1]) add(x + side * .48 * scale, deskY / 2, deskZ, .06 * scale, deskY, .45 * scale, 2);
    add(x, deskY + .065 * scale, deskZ - .08 * scale, .43 * scale, .035 * scale, .15 * scale, 2);
    const monitor = (offset: number, wide = false) => {
      add(x + offset * scale, deskY + .20 * scale, deskZ + .12 * scale, .06 * scale, .34 * scale, .06 * scale, 2);
      add(x + offset * scale, deskY + .37 * scale, deskZ + .12 * scale, (wide ? .83 : .50) * scale, .38 * scale, .055 * scale, 2);
      add(x + offset * scale, deskY + .37 * scale, deskZ + .084 * scale, (wide ? .75 : .42) * scale, .30 * scale, .018 * scale, 4);
      for (let i=0;i<3;i++) add(x + offset * scale, deskY + (.29+i*.065) * scale, deskZ + .069 * scale, (.23+i*.035)*scale, .016*scale,.008*scale,3);
    };
    if (variant === "code" || variant === "operations") { monitor(-.28); monitor(.28); }
    else if (variant === "design") {
      add(x,deskY+.035*scale,deskZ,.70*scale,.035*scale,.40*scale,2);
      add(x,deskY+.058*scale,deskZ,.62*scale,.015*scale,.32*scale,4);
      for(let i=0;i<4;i++) add(x+(.36+i*.065)*scale,deskY+.063*scale,deskZ+.15*scale,.05*scale,.025*scale,.08*scale,i%2?1:0);
    } else if (variant === "test") {
      monitor(-.25);
      add(x+.35*scale,deskY+.16*scale,deskZ,.19*scale,.30*scale,.035*scale,2);
      add(x+.35*scale,deskY+.16*scale,deskZ-.025*scale,.15*scale,.24*scale,.015*scale,4);
      add(x+.23*scale,deskY+.07*scale,deskZ-.17*scale,.27*scale,.07*scale,.16*scale,1);
    } else {
      add(x,deskY+.12*scale,deskZ,.55*scale,.22*scale,.30*scale,2);
      for(let i=0;i<3;i++) add(x+(i-1)*.21*scale,deskY+.24*scale,deskZ,.12*scale,.015*scale,.18*scale,4);
      add(x+.4*scale,deskY+.065*scale,deskZ-.10*scale,.06*scale,.025*scale,.30*scale,1);
    }
    return finish(root);
  }
  function buildSeated(fit:MeshySeatFit,offset:THREE.Vector3,scale:number,variant:MeshyFixture="code") {
    const x=fit.x*scale+offset.x,rearZ=fit.rearZ*scale+offset.z,frontZ=fit.frontZ*scale+offset.z;
    const top=fit.top.map(y=>y*scale+offset.y),width=fit.width*scale,thickness=.11*scale;
    const backZ=fit.backZ*scale+offset.z,backHeight=fit.backHeight*scale;
    // The existing desk builder is reused without its old, bone-based chair.
    const root=build(new THREE.Vector3(x,0,frontZ-.35*scale),Math.max(...top),scale,variant,true);
    root.userData.seatSurface={x,rearZ,frontZ,width,top,thickness};
    root.userData.seatY=top[Math.floor(top.length/2)];
    const vertices:number[]=[],indices:number[]=[],columns=5,rows=top.length;
    for(let layer=0;layer<2;layer++)for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
      const t=col/(columns-1),edge=col===0||col===columns-1?.02*scale:0;
      vertices.push(x+(t-.5)*width,top[row]-edge-layer*thickness,rearZ+(frontZ-rearZ)*row/(rows-1));
    }
    const quad=(a:number,b:number,c:number,d:number,reverse=false)=>indices.push(...(reverse?[a,c,b,a,d,c]:[a,b,c,a,c,d]));
    const count=rows*columns;
    for(let row=0;row<rows-1;row++)for(let col=0;col<columns-1;col++){
      const a=row*columns+col,b=a+1,c=b+columns,d=a+columns;
      quad(a,d,c,b);quad(a+count,b+count,c+count,d+count);
    }
    for(let row=0;row<rows-1;row++){
      const a=row*columns,b=a+columns;quad(a,a+count,b+count,b);
      const c=a+columns-1,d=b+columns-1;quad(c,d,d+count,c+count);
    }
    for(let col=0;col<columns-1;col++){
      quad(col,col+1,col+1+count,col+count);
      const a=(rows-1)*columns+col;quad(a,a+count,a+1+count,a+1);
    }
    const cushionGeometry=new THREE.BufferGeometry();
    cushionGeometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));cushionGeometry.setIndex(indices);cushionGeometry.computeVertexNormals();
    batches.add(cushionGeometry);
    const cushion=new THREE.Mesh(cushionGeometry,materials[0]);cushion.name="fitted-seat-cushion";
    cushion.castShadow=cushion.receiveShadow=true;root.add(cushion);
    const box=(name:string,cx:number,cy:number,cz:number,w:number,h:number,d:number)=>{
      const mesh=new THREE.Mesh(geometry,materials[name==="clear-backrest"?1:2]);mesh.name=name;
      mesh.position.set(cx,cy,cz);mesh.scale.set(w,h,d);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
      (root.userData.collisionBoxes??=[]).push({name,x:cx,y:cy,z:cz,w,h,d});
    };
    box("clear-backrest",x,top[0]+backHeight/2,backZ,width,backHeight,.055*scale);
    for(const side of [-1,1]){
      const legX=x+side*(width/2-.012*scale),frontLegZ=frontZ-.035*scale;
      const rearHeight=top[0]-thickness,frontHeight=top[top.length-1]-thickness;
      box("rear-chair-leg",legX,rearHeight/2,backZ,.04*scale,rearHeight,.04*scale);
      box("front-chair-leg",legX,frontHeight/2,frontLegZ,.04*scale,frontHeight,.04*scale);
      box("chair-support-rail",legX,Math.min(...top)-thickness-.035*scale,(backZ+frontLegZ)/2,.04*scale,.07*scale,frontLegZ-backZ);
    }
    return finish(root);
  }
  return { build, buildSeated, dispose() { geometry.dispose(); batches.forEach(batch => batch.dispose()); materials.forEach(material => material.dispose()); } };
}
