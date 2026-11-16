import * as THREE from "three";
import {RoundedBoxGeometry} from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {createGlassLensGeometry} from "./glass-lens-geometry";
import {createSparkHalo} from "./spark-material";

/** Reconstructed from the local img2threejs sculpt spec; built in reviewed passes. */
export const GOLDEN_CUBE_PASS = "optimization-pass";
export const GOLDEN_CUBE_SPEC = {
  shellSize: 2.5, panelCenter: 1.19, panelThickness: .2,
  coreSize: 1.95, rimWidth: .13, bevelRadius: .055, openingTravel: 2.65,
} as const;

/** Object-space optical gradients follow the panels; specular reflections remain PBR. */
function addOpticalSurface(material:THREE.MeshPhysicalMaterial,kind:"core"|"glass",opening:THREE.IUniform<number>) {
  material.onBeforeCompile=shader=>{
    shader.uniforms.uOpening=opening;
    shader.vertexShader=shader.vertexShader.replace("#include <common>","#include <common>\nvarying vec3 vGlassLocal; varying vec3 vGlassNormal;")
      .replace("#include <begin_vertex>","#include <begin_vertex>\nvGlassLocal=position; vGlassNormal=normal;");
    shader.fragmentShader=shader.fragmentShader.replace("#include <common>","#include <common>\nuniform float uOpening; varying vec3 vGlassLocal; varying vec3 vGlassNormal;");
    const response=kind==="core"?`
      vec3 weights=pow(abs(normalize(vGlassNormal)),vec3(16.0));
      weights/=max(dot(weights,vec3(1.0)),.001);
      vec3 p=vGlassLocal/.975;
      float edge=dot(weights,vec3(max(abs(p.y),abs(p.z)),max(abs(p.x),abs(p.z)),max(abs(p.x),abs(p.y))));
      float center=dot(weights,vec3(exp(-1.8*dot(p.yz,p.yz)),exp(-1.8*dot(p.xz,p.xz)),exp(-1.8*dot(p.xy,p.xy))));
      float softEdge=smoothstep(.55,.96,edge);
      float seam=smoothstep(.937,.976,edge);
      diffuseColor.rgb=mix(vec3(.30,.20,.13),vec3(.66,.42,.17),softEdge);
      totalEmissiveRadiance+=(1.0-uOpening)*vec3(.20,.12,.035)+center*vec3(.42,.24,.055)+(softEdge*.25+.65)*vec3(.75,.34,.045)+seam*vec3(9.0,8.0,3.8)*mix(.08,1.0,uOpening);
    `:`
      float edge=max(abs(vGlassLocal.x),abs(vGlassLocal.y));
      float rim=smoothstep(1.04,1.13,edge);
      float rolled=exp(-pow((edge-1.19)/.055,2.0));
      float lineWidth=max(fwidth(edge)*1.25,.010);
      float outer=exp(-pow((edge-1.244)/lineWidth,2.0));
      float inner=exp(-pow((edge-1.09)/max(fwidth(edge)*1.25,.015),2.0));
      float fresnel=pow(1.0-abs(dot(normal,normalize(vViewPosition))),3.0);
      float reflection=pow(abs(normalize(vGlassNormal).z),3.0);
      float rolledHighlight=exp(-pow((abs(normalize(vGlassNormal).z)-.82)/.10,2.0));
      float curvedGlint=rolledHighlight*(.5+.5*cos(vGlassLocal.x*4.0+vGlassLocal.y*2.0));
      diffuseColor.rgb=mix(vec3(.24,.14,.075),vec3(.38,.085,.002),rim);
      diffuseColor.a=clamp(mix(.78,.18,uOpening)+rim*.45+fresnel*.10,.18,.97);
      if(!gl_FrontFacing) diffuseColor.a*=smoothstep(.02,.20,uOpening);
      float innerGlow=(mix(.55,.22,uOpening)+.78*exp(-.85*pow(vGlassLocal.y+.95,2.0))+.35*exp(-2.5*pow(abs(vGlassLocal.x)-1.0,2.0)))*mix(1.0,.9,uOpening);
      totalEmissiveRadiance+=innerGlow*vec3(.65,.38,.10)+uOpening*vec3(.20,.14,.055)+(1.0-uOpening)*vec3(.16,.10,.025)+(outer+inner*.7)*vec3(5.0,3.4,.7)
        +rolled*(.015+reflection*.09)*vec3(1.7,.65,.015)+curvedGlint*vec3(7.0,5.0,1.4);
    `;
    shader.fragmentShader=shader.fragmentShader.replace("#include <emissivemap_fragment>","#include <emissivemap_fragment>\n"+response)
      .replace("#include <lights_fragment_end>","#include <lights_fragment_end>\nreflectedLight.directDiffuse *= .38; reflectedLight.indirectDiffuse *= .38;");
  };
  material.customProgramCacheKey=()=>`golden-glass-${kind}-v2`;
}

export function createGoldenGlassCubeModel() {
  const root = new THREE.Group(); root.name = "shell";
  // A single forward pass approximates tinted glass: no transmission framebuffer.
  const paneMaterial = new THREE.MeshPhysicalMaterial({color:"#ffe8b4",roughness:.045,metalness:0,ior:1.52,clearcoat:1,clearcoatRoughness:.025,transparent:true,opacity:1,depthWrite:false,envMapIntensity:1.25,side:THREE.DoubleSide,forceSinglePass:true});
  const coreMaterial = new THREE.MeshPhysicalMaterial({color:"#d7b98e",roughness:.24,metalness:0,clearcoat:.7,clearcoatRoughness:.06,transparent:true,opacity:1,emissive:"#ffc967",emissiveIntensity:.08});
  const openingUniform={value:0};
  addOpticalSurface(coreMaterial,"core",openingUniform); addOpticalSurface(paneMaterial,"glass",openingUniform);
  const core = new THREE.Mesh(new RoundedBoxGeometry(1.95,1.95,1.95,3,.055),coreMaterial);
  core.name = "core"; root.add(core);
  const geometry = createGlassLensGeometry();
  const directions = [new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)];
  const ids = ["px","nx","py","ny","pz","nz"];
  const rotations=directions.map(direction=>new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),direction));
  const hinges=directions.map(direction=>new THREE.Vector3(-direction.z,0,direction.x).normalize());
  hinges[2].set(1,0,0); hinges[3].set(-1,0,0);
  const faces = directions.map((direction,i) => {
    const face = new THREE.Group(); face.name = `face-${ids[i]}`;
    face.quaternion.copy(rotations[i]);
    face.position.copy(direction).multiplyScalar(1.19);
    const pane = new THREE.Mesh(geometry,paneMaterial); pane.name = `pane-${ids[i]}`;
    pane.renderOrder = 101; face.add(pane);
    const rim = new THREE.Object3D(); rim.name = `rim-${ids[i]}`;
    rim.userData.integralTo = pane.name; rim.userData.explodeWithParent = true;
    face.add(rim);
    face.userData.partId=face.name;
    face.userData.collider={type:"box",size:[2.5,2.5,.2],local:true};
    face.userData.destructionGroup=face.name;
    const socket=new THREE.Object3D(); socket.name=`effect-${ids[i]}`; socket.position.z=.06; face.add(socket);
    root.add(face); return face;
  });
  core.renderOrder = 100;
  const halo=createSparkHalo(); halo.name="halo"; halo.material.opacity=.85; root.add(halo);
  // Local optical bloom: one shared 64px texture, no full-scene postprocessing.
  const glowCanvas=document.createElement("canvas"); glowCanvas.width=glowCanvas.height=64;
  const context=glowCanvas.getContext("2d")!;
  const gradient=context.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,"rgba(255,255,235,.92)");
  gradient.addColorStop(.16,"rgba(255,248,199,.48)");
  gradient.addColorStop(.42,"rgba(255,218,139,.13)");
  gradient.addColorStop(1,"rgba(255,208,116,0)");
  context.fillStyle=gradient; context.fillRect(0,0,64,64);
  const glowMap=new THREE.CanvasTexture(glowCanvas); glowMap.colorSpace=THREE.SRGBColorSpace;
  const glowMaterial=new THREE.SpriteMaterial({map:glowMap,transparent:true,depthWrite:false,depthTest:true,toneMapped:false,opacity:.65});
  const cornerSigns:THREE.Vector3[]=[];
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])cornerSigns.push(new THREE.Vector3(x,y,z));
  const cornerGlows=cornerSigns.map((_sign,index)=>{
    const glow=new THREE.Sprite(glowMaterial); glow.name=`corner-glow-${index}`;
    glow.renderOrder=102; root.add(glow); return glow;
  });
  core.userData.partId="core"; core.userData.collider={type:"box",size:[1.95,1.95,1.95],local:true};
  core.castShadow=true; core.receiveShadow=true;
  const nodes:Record<string,THREE.Object3D>={};
  root.traverse(node=>{if(node.name)nodes[node.name]=node;});
  const tilt=new THREE.Quaternion();
  function update(opening:number) {
    // Travel may overshoot a little past fully open (spring catch); the optics stay within range.
    const amount=THREE.MathUtils.clamp(opening,0,1.2); openingUniform.value=Math.min(1,amount);
    faces.forEach((face,i)=>{
      face.position.copy(directions[i]).multiplyScalar(1.19+amount*2.65);
      tilt.setFromAxisAngle(hinges[i],amount*.06);
      face.quaternion.copy(rotations[i]).premultiply(tilt);
    });
    core.scale.setScalar(1-amount*.14); core.position.y=amount*.12;
    halo.scale.setScalar(7.5+amount*1.5);
    cornerGlows.forEach((glow,index)=>{glow.position.copy(cornerSigns[index]).multiplyScalar(THREE.MathUtils.lerp(1.23,.8385,amount));glow.position.y+=core.position.y;glow.scale.setScalar(THREE.MathUtils.lerp(.64,.46,amount));});
  }
  function pick(hit:THREE.Object3D):string|null {
    let node:THREE.Object3D|null=hit;
    while(node&&node!==root){if(typeof node.userData.partId==="string")return node.userData.partId;node=node.parent;}
    return null;
  }
  root.userData.sculptRuntime = {nodes,sockets:faces.map(face=>face.children.find(child=>child.name.startsWith("effect-"))),partIds:["core",...faces.map(face=>face.name)],seams:"Six intact detachable continuous rolled-edge glass panels",opticalApproximation:true,update,pick};
  update(0);
  return {root,core,faces,update,pick};
}
