import * as THREE from 'three';

export const LAPTOP_SCROLL_VH=.2;
export function transferEase(start:number,end:number,p:number){
  const t=Math.max(0,Math.min(1,(p-start)/(end-start)));return t*t*t*(t*(t*6-15)+10);
}
export type ScreenPoint={x:number;y:number};
/** Map the actual page rectangle onto the four projected corners of the 3D display. */
export function screenMatrix(points:ScreenPoint[],width:number,height:number){
  const [p0,p1,p2,p3]=points;
  const dx1=p1.x-p2.x,dx2=p3.x-p2.x,dx3=p0.x-p1.x+p2.x-p3.x;
  const dy1=p1.y-p2.y,dy2=p3.y-p2.y,dy3=p0.y-p1.y+p2.y-p3.y;
  const det=dx1*dy2-dx2*dy1;
  const g=Math.abs(det)>1e-8?(dx3*dy2-dx2*dy3)/det:0;
  const h=Math.abs(det)>1e-8?(dx1*dy3-dx3*dy1)/det:0;
  return [(p1.x-p0.x+g*p1.x)/width,(p1.y-p0.y+g*p1.y)/width,0,g/width,
    (p3.x-p0.x+h*p3.x)/height,(p3.y-p0.y+h*p3.y)/height,0,h/height,
    0,0,1,0,p0.x,p0.y,0,1];
}

/** One model, one hinge and one camera throughout the page-to-showroom handoff. */
export function createLaptopTransfer(hall:HTMLElement,device:THREE.Group,screen:THREE.Mesh){
  const journey=document.getElementById('journey');
  let page=journey?.querySelector<HTMLElement>('[data-laptop-source="unlock-chapter"]');
  const stage=hall.querySelector<HTMLElement>('.lumen-stage')!;
  const lid=device.getObjectByName('lid');
  if(!lid)throw new Error('Laptop transfer requires the authored lid pivot');
  const lidOpen=lid.rotation.x,yaw=device.rotation.y;
  const bounds=screen.geometry.boundingBox??(screen.geometry.computeBoundingBox(),screen.geometry.boundingBox!);
  const corners=[new THREE.Vector3(bounds.min.x,bounds.max.y,0),new THREE.Vector3(bounds.max.x,bounds.max.y,0),
    new THREE.Vector3(bounds.max.x,bounds.min.y,0),new THREE.Vector3(bounds.min.x,bounds.min.y,0)];
  const center=bounds.getCenter(new THREE.Vector3());
  const startPosition=new THREE.Vector3(),screenCenter=new THREE.Vector3(),normal=new THREE.Vector3();
  const finalPosition=new THREE.Vector3(),finalRotation=new THREE.Quaternion(),startRotation=new THREE.Quaternion();
  const viewMatrix=new THREE.Matrix4(),projection=new THREE.Vector3();
  let start=0,end=0,projected=false,previous=-1;
  const measure=()=>{
    end=hall.getBoundingClientRect().top+scrollY;
    start=end-innerHeight*(LAPTOP_SCROLL_VH+1);
  };
  const progress=()=>Math.max(0,Math.min(1,(scrollY-start)/Math.max(1,end-start)));
  const keepSourceReady=(ready:boolean)=>{
    if(!journey||ready===(journey.dataset.screenProjected==='true'))return;
    if(ready)journey.dataset.screenProjected='true';else delete journey.dataset.screenProjected;
    window.dispatchEvent(new Event('journey-screen-visible'));
  };
  const reset=()=>{
    stage.classList.remove('lumen-transferring');hall.style.removeProperty('--transfer-copy');
    if(page){page.inert=false;page.classList.remove('jny-laptop-screen');page.style.removeProperty('transform');}
    projected=false;
    keepSourceReady(false);
  };
  return {
    measure,progress,reset:()=>{if(projected)reset();},
    update(camera:THREE.PerspectiveCamera,p:number,width:number,height:number,showLandedScreen:boolean){
      if(!page?.isConnected)page=journey?.querySelector<HTMLElement>('[data-laptop-source="unlock-chapter"]');
      const changed=Math.abs(p-previous)>.00001;previous=p;
      const active=p>0&&p<1;
      if(!page||!journey||journey.classList.contains('jny-static')||!(active||p>=1&&showLandedScreen)){
        if(projected)reset();return {active:false,changed};
      }
      projected=true;
      stage.classList.toggle('lumen-transferring',active);
      page.classList.add('jny-laptop-screen');page.inert=true;
      keepSourceReady(!active);
      if(active){
        const zoom=transferEase(0,1,p);
        device.rotation.y=yaw;lid.rotation.x=lidOpen;
        screen.updateWorldMatrix(true,false);
        finalPosition.copy(camera.position);finalRotation.copy(camera.quaternion);
        screenCenter.copy(center).applyMatrix4(screen.matrixWorld);
        normal.set(0,0,1).transformDirection(screen.matrixWorld);
        const screenHeight=(bounds.max.y-bounds.min.y)*device.scale.y;
        const screenWidth=(bounds.max.x-bounds.min.x)*device.scale.x;
        const distance=Math.min(screenHeight,screenWidth/camera.aspect)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*.985;
        startPosition.copy(screenCenter).addScaledVector(normal,distance);
        viewMatrix.lookAt(startPosition,screenCenter,new THREE.Vector3(0,1,0));startRotation.setFromRotationMatrix(viewMatrix);
        camera.position.lerpVectors(startPosition,finalPosition,zoom);camera.quaternion.slerpQuaternions(startRotation,finalRotation,zoom);
      }else screen.updateWorldMatrix(true,false);
      camera.updateMatrixWorld(true);
      const fit=transferEase(0,.12,p),full=[{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}];
      // A portrait page must retain its proportions inside a landscape display.
      // Fit it within the display instead of flattening the cube and typography.
      const displayWidth=bounds.max.x-bounds.min.x,displayHeight=bounds.max.y-bounds.min.y;
      const pageAspect=width/height;
      const fittedWidth=Math.min(displayWidth,displayHeight*pageAspect);
      const fittedHeight=Math.min(displayHeight,displayWidth/pageAspect);
      const points=corners.map((corner,i)=>{
        projection.set(center.x+(i===0||i===3?-1:1)*fittedWidth/2,
          center.y+(i<2?1:-1)*fittedHeight/2,corner.z).applyMatrix4(screen.matrixWorld).project(camera);
        return {x:THREE.MathUtils.lerp(full[i].x,(projection.x*.5+.5)*width,fit),
          y:THREE.MathUtils.lerp(full[i].y,(-projection.y*.5+.5)*height,fit)};
      });
      page.style.transform=`matrix3d(${screenMatrix(points,width,height).join(',')})`;
      return {active,changed};
    },
    dispose:reset,
  };
}
