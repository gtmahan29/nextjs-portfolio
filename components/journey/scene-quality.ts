export type SceneTier = "low" | "balanced" | "high";
export type SceneQuality = {
  tier: SceneTier; pixelRatio: number; maxPixels: number; fps: number;
  shadows: number; shadowHz: number; reflections: 0 | 1 | 2;
  reflectionSize: number; textureSize: number; antialias: boolean;
};
export const SCENE_QUALITY: Record<SceneTier,SceneQuality> = {
  low: {tier:"low",pixelRatio:1.5,maxPixels:1_200_000,fps:30,shadows:512,shadowHz:10,reflections:0,reflectionSize:256,textureSize:512,antialias:true},
  balanced: {tier:"balanced",pixelRatio:2,maxPixels:2_400_000,fps:60,shadows:1024,shadowHz:15,reflections:1,reflectionSize:512,textureSize:1024,antialias:true},
  high: {tier:"high",pixelRatio:2,maxPixels:4_000_000,fps:60,shadows:2048,shadowHz:20,reflections:1,reflectionSize:768,textureSize:1200,antialias:true},
};
export function chooseSceneTier(hints:{memory?:number;cores?:number;coarse:boolean;small:boolean;saveData?:boolean;slowNetwork?:boolean}, override?:string|null):SceneTier {
  if(override==="low"||override==="balanced"||override==="high")return override;
  if((hints.coarse&&hints.small)||hints.saveData||hints.slowNetwork||(hints.memory??8)<=4||(hints.cores??8)<=4)return "low";
  // Keep a stable interactive budget; high is an explicit review override.
  return "balanced";
}
export function getSceneQuality():SceneQuality {
  const n=navigator as Navigator&{deviceMemory?:number;connection?:{saveData?:boolean;effectiveType?:string}};
  const query=new URLSearchParams(location.search);
  const coarse=matchMedia("(any-pointer: coarse)").matches,small=innerWidth<=860;
  const tier=chooseSceneTier({memory:n.deviceMemory,cores:n.hardwareConcurrency,
    coarse,small,
    saveData:n.connection?.saveData,slowNetwork:/^(slow-)?2g$/.test(n.connection?.effectiveType??"")},query.get("sceneQuality")??query.get("journeyQuality"));
  const quality=SCENE_QUALITY[tier];
  return {...quality,antialias:quality.antialias&&!(coarse&&small&&tier==="low")};
}
export function scenePixelRatio(quality:SceneQuality,width:number,height:number,dpr:number) {
  // Preserve native CSS resolution through 1080p; trim expensive effects first.
  const pixels=quality.maxPixels;
  return Math.min(dpr||1,quality.pixelRatio,Math.sqrt(pixels/Math.max(1,width*height)));
}
/** Sustained frame pressure only: ignore startup, hidden tabs and occasional long tasks. */
export class AdaptiveSceneQuality {
  private slow=0; private started=0; private lastChange=0;
  constructor(public current:SceneQuality){}
  sample(now:number,cpuMs:number,frameMs:number):SceneQuality|null {
    if(!this.started)this.started=now;
    if(now-this.started<2500||now-this.lastChange<5000||frameMs>250)return null;
    const budget=this.current.fps===30?44:26;
    this.slow=(cpuMs>20||frameMs>budget)?this.slow+1:Math.max(0,this.slow-2);
    if(this.slow<75||this.current.tier==="low")return null;
    this.current={...SCENE_QUALITY[this.current.tier==="high"?"balanced":"low"]};
    this.slow=0;this.lastChange=now;return this.current;
  }
}
