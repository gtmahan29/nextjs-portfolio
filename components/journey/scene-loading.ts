export type SceneCleanup = () => void;
/** Yield between setup batches without adding a 32ms penalty for every texture
 * while the visitor scrolls. Input remains free to run between browser tasks. */
export async function yieldToMain(signal?:AbortSignal):Promise<void> {
  signal?.throwIfAborted();
  const scheduler=(globalThis as typeof globalThis & {scheduler?:{yield?:()=>Promise<void>}}).scheduler;
  if(scheduler?.yield)await scheduler.yield();
  else await new Promise<void>(resolve=>setTimeout(resolve,0));
  signal?.throwIfAborted();
}
/** Serialize expensive setup so two WebGL scenes never compile simultaneously. */
let setupQueue:Promise<unknown>=Promise.resolve();
export function queueSceneSetup<T>(signal:AbortSignal,setup:()=>Promise<T>):Promise<T> {
  const next=setupQueue.catch(()=>{}).then(async()=>{await yieldToMain(signal);return setup();});
  setupQueue=next.catch(()=>{});return next;
}
export class SceneScope {
  private cleanups:SceneCleanup[]=[];
  private disposed=false;
  constructor(private signal:AbortSignal){if(signal.aborted)this.dispose();else signal.addEventListener("abort",this.dispose,{once:true});}
  defer(cleanup:SceneCleanup){if(this.disposed)cleanup();else this.cleanups.push(cleanup);}
  dispose=()=>{
    if(this.disposed)return;this.disposed=true;
    this.signal.removeEventListener("abort",this.dispose);
    for(const cleanup of this.cleanups.reverse())try{cleanup();}catch(error){console.warn("Scene cleanup failed",error);}
    this.cleanups=[];
  };
}
