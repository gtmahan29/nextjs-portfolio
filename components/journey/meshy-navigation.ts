import * as THREE from "three";

export type WalkObstacle = { minX:number; maxX:number; minZ:number; maxZ:number };
export function walkObstacle(box:THREE.Box3, clearance=1.35):WalkObstacle {
  return {minX:box.min.x-clearance,maxX:box.max.x+clearance,minZ:box.min.z-clearance,maxZ:box.max.z+clearance};
}
/** Closed rectangles, including thin whiteboards. Test the entire segment, not its endpoints. */
export function clearWalkSegment(a:THREE.Vector3,b:THREE.Vector3,obstacles:WalkObstacle[]) {
  return !obstacles.some(o=>{
    let lo=0,hi=1;
    for(const [start,delta,min,max] of [[a.x,b.x-a.x,o.minX,o.maxX],[a.z,b.z-a.z,o.minZ,o.maxZ]]) {
      if(Math.abs(delta)<1e-9){if(start<min||start>max)return false;}
      else {const t1=(min-start)/delta,t2=(max-start)/delta;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false;}
    }
    return true;
  });
}
export function freeWalkPoint(point:THREE.Vector3, obstacles:WalkObstacle[], radius=8) {
  if(clearWalkSegment(point,point,obstacles))return point.clone();
  for(let r=.5;r<=radius;r+=.5)for(let i=0;i<32;i++) {
    const p=point.clone().add(new THREE.Vector3(Math.cos(i*Math.PI/16)*r,0,Math.sin(i*Math.PI/16)*r));
    if(clearWalkSegment(p,p,obstacles))return p;
  }
  return undefined;
}
/** Grid A* followed by visibility simplification; straight segments never cut through props. */
export function planWalk(start:THREE.Vector3,end:THREE.Vector3,obstacles:WalkObstacle[]):THREE.Vector3[] {
  if(!clearWalkSegment(start,start,obstacles)||!clearWalkSegment(end,end,obstacles))return [];
  if(clearWalkSegment(start,end,obstacles))return [start.clone(),end.clone()];
  const minX=Math.floor(Math.min(start.x,end.x)-45),minZ=Math.floor(Math.min(start.z,end.z)-45);
  const width=Math.ceil(Math.abs(end.x-start.x)+91),depth=Math.ceil(Math.abs(end.z-start.z)+91);
  const point=(id:number)=>new THREE.Vector3(minX+id%width,0,minZ+Math.floor(id/width));
  const idAt=(p:THREE.Vector3)=>Math.round(p.z-minZ)*width+Math.round(p.x-minX);
  obstacles=obstacles.filter(o=>o.maxX>=minX&&o.minX<=minX+width&&o.maxZ>=minZ&&o.minZ<=minZ+depth);
  const blocked=new Uint8Array(width*depth);
  for(const o of obstacles)for(let z=Math.max(0,Math.ceil(o.minZ-minZ));z<=Math.min(depth-1,Math.floor(o.maxZ-minZ));z++)
    for(let x=Math.max(0,Math.ceil(o.minX-minX));x<=Math.min(width-1,Math.floor(o.maxX-minX));x++)blocked[z*width+x]=1;
  const cells=new Map<number,WalkObstacle[]>();
  for(const o of obstacles)for(let z=Math.max(0,Math.floor(o.minZ-minZ)-1);z<=Math.min(depth-1,Math.ceil(o.maxZ-minZ)+1);z++)
    for(let x=Math.max(0,Math.floor(o.minX-minX)-1);x<=Math.min(width-1,Math.ceil(o.maxX-minX)+1);x++){const id=z*width+x;const cell=cells.get(id)??[];cell.push(o);cells.set(id,cell);}
  const nearestGrid=(p:THREE.Vector3)=>{
    const base=point(idAt(p));
    for(let r=0;r<=4;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){
      const candidate=base.clone().add(new THREE.Vector3(dx,0,dz)),id=idAt(candidate);
      if(!blocked[id]&&clearWalkSegment(p,candidate,obstacles))return candidate;
    }
    return undefined;
  };
  const from=nearestGrid(start),to=nearestGrid(end);
  if(!from||!to||!clearWalkSegment(start,from,obstacles)||!clearWalkSegment(to,end,obstacles))return [];
  const source=idAt(from),target=idAt(to),cost=new Map([[source,0]]),parents=new Map<number,number>();
  const heap:{id:number;score:number}[]=[];
  const push=(id:number,score:number)=>{heap.push({id,score});let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p].score<=score)break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}};
  const pop=()=>{const first=heap[0],last=heap.pop()!;if(heap.length){heap[0]=last;let i=0;while(true){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1].score<heap[c].score)c++;if(heap[i].score<=heap[c].score)break;[heap[i],heap[c]]=[heap[c],heap[i]];i=c;}}return first.id;};
  const heuristic=(id:number)=>point(id).distanceTo(to);push(source,heuristic(source));
  const closed=new Set<number>();
  while(heap.length&&closed.size<60000){
    const id=pop();if(closed.has(id))continue;
    if(id===target){
      const path=[end.clone(),to];let cur=id;while(parents.has(cur)){cur=parents.get(cur)!;path.push(point(cur));}path.push(start.clone());path.reverse();
      const simplified=[path[0]];let i=0;while(i<path.length-1){let next=path.length-1;while(next>i+1&&!clearWalkSegment(path[i],path[next],obstacles))next--;simplified.push(path[next]);i=next;}return simplified;
    }
    closed.add(id);const a=point(id);
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dz)continue;const x=id%width+dx,z=Math.floor(id/width)+dz;if(x<0||x>=width||z<0||z>=depth)continue;
      const next=z*width+x;if(closed.has(next)||blocked[next]||blocked[Math.floor(id/width)*width+x]||blocked[z*width+id%width]||!clearWalkSegment(a,point(next),cells.get(id)??[]))continue;
      const g=cost.get(id)!+Math.hypot(dx,dz);if(g>=(cost.get(next)??Infinity))continue;cost.set(next,g);parents.set(next,id);push(next,g+heuristic(next));
    }
  }
  return [];
}
