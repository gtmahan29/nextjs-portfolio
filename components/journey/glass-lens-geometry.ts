import * as THREE from "three";

/** One watertight lens: the rolled rim is part of the glass, not a metal frame. */
export function createGlassLensGeometry() {
  const profile = [[1.25,.018],[1.245,.05],[1.23,.08],[1.20,.10],[1.16,.095],[1.12,.055],[1.075,.022],[1.025,.014],[.7,.016],[.35,.022]];
  const positions:number[]=[],indices:number[]=[];
  const segments=8,ringSize=4*(segments+1);
  function ring(half:number,z:number) {
    const radius=Math.min(.08,half*.18),center=half-radius;
    const corners=[[center,center],[-center,center],[-center,-center],[center,-center]];
    corners.forEach(([x,y],corner)=>{
      for(let step=0;step<=segments;step++){
        const angle=(corner+step/segments)*Math.PI/2;
        positions.push(x+Math.cos(angle)*radius,y+Math.sin(angle)*radius,z);
      }
    });
  }
  profile.forEach(([half,z])=>ring(half,z));
  profile.forEach(([half,z])=>ring(half,-z));
  const back=profile.length*ringSize;
  for(let side=0;side<2;side++){
    const offset=side*back;
    const triangle=(a:number,b:number,c:number)=>side===0?indices.push(a,b,c):indices.push(a,c,b);
    for(let level=0;level<profile.length-1;level++){
      for(let i=0;i<ringSize;i++){
        const next=(i+1)%ringSize,a=offset+level*ringSize+i,b=offset+level*ringSize+next,c=a+ringSize,d=b+ringSize;
        triangle(a,b,d); triangle(a,d,c);
      }
    }
    const center=positions.length/3;positions.push(0,0,side===0?.023:-.023);
    const last=offset+(profile.length-1)*ringSize;
    for(let i=0;i<ringSize;i++)triangle(last+i,last+(i+1)%ringSize,center);
  }
  for(let i=0;i<ringSize;i++){
    const next=(i+1)%ringSize;
    indices.push(next,i,back+i,next,back+i,back+next);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}
