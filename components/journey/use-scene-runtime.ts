"use client";
import {useEffect,useRef,type RefObject} from "react";
import {getSceneQuality,type SceneQuality} from "./scene-quality";
import {queueSceneSetup,type SceneCleanup} from "./scene-loading";

export type SceneContext={canvas:HTMLCanvasElement;section:HTMLElement;signal:AbortSignal;quality:SceneQuality;onActive?:(index:number)=>void;onAudit?:(value:string)=>void};
export type SceneModule={mountScene:(context:SceneContext)=>Promise<SceneCleanup>};

/** DOM stays mounted and reserves its layout; the GPU runtime is independently owned. */
export function useSceneRuntime(sectionRef:RefObject<HTMLElement>,canvasRef:RefObject<HTMLCanvasElement>,
  load:()=>Promise<SceneModule>,callbacks:{onActive?:(index:number)=>void;onAudit?:(value:string)=>void;onUnavailable?:()=>void;onReady?:()=>void}={}) {
  const latest=useRef(callbacks);latest.current=callbacks;
  useEffect(()=>{
    const section=sectionRef.current,canvas=canvasRef.current;if(!section||!canvas)return;
    let near=false,controller:AbortController|undefined,cleanup:SceneCleanup|undefined,disposed=false;
    let retry=0,staticFailed=false,failed=false;
    const params=new URLSearchParams(location.search),staticMode=params.get("sceneQuality")==="static";
    // The hero owns startup GPU work. Later scenes warm up only on approach.
    const reviewNear=section.id==='journey'
      ? params.has("unlockReview")||params.has("journeyReview")
      : section.id==='studio' ? params.has("studioReview") : false;
    const release=()=>{
      controller?.abort();controller=undefined;cleanup?.();cleanup=undefined;
      section.dataset.sceneState="dormant";delete canvas.dataset.sceneReady;delete canvas.dataset.showroomReady;delete section.dataset.sceneRendered;
    };
    const fail=()=>{
      failed=true;
      release();section.dataset.sceneState="unavailable";section.classList.add("jny-static");
      section.querySelectorAll<HTMLElement>(".jny-concierge, .jny-starting-point").forEach(el=>{el.inert=false;el.setAttribute("aria-hidden","false");});
      latest.current.onUnavailable?.();
      window.dispatchEvent(new Event('journey-scene-status'));
    };
    const start=()=>{
      if(disposed||failed||!near||document.hidden||controller)return;
      if(staticMode){if(!staticFailed){staticFailed=true;fail();}return;}
      controller=new AbortController();const own=controller;
      section.dataset.sceneState="loading";section.classList.remove("jny-static");
      // Reserve the setup slot before the import so the archive and later background
      // work cannot overtake the showroom while the process scene is still preparing.
      void queueSceneSetup(own.signal,async()=>{
        const {mountScene}=await load();
        own.signal.throwIfAborted();
        return mountScene({canvas,section,signal:own.signal,quality:getSceneQuality(),
          onActive:i=>latest.current.onActive?.(i),onAudit:value=>latest.current.onAudit?.(value)});
      })
        .then(releaseRuntime=>{
          if(disposed||own.signal.aborted){releaseRuntime();return;}
          cleanup=releaseRuntime;section.dataset.sceneState="ready";latest.current.onReady?.();window.dispatchEvent(new Event('journey-scene-status'));
        }).catch(error=>{if(!own.signal.aborted&&!disposed){console.warn("3D scene unavailable",error);fail();}});
    };
    // After the page loader leaves, every scene builds in the background (one at a time, through
    // the setup queue), so nobody scrolls into a scene that is still loading.
    const warmed=()=>(window as unknown as {__sceneWarm?:boolean}).__sceneWarm===true;
    const warm=()=>{near=true;start();};
    window.addEventListener('scene-warm',warm);
    const observer=new IntersectionObserver(([entry])=>{
      near=reviewNear||warmed()||entry.isIntersecting;
      // The long journey is frequently revisited. Suspend its render loop offscreen
      // but retain its context until route unmount, avoiding mid-scroll reconstruction.
      if(near)start();
    },{rootMargin:`${['journey','studio','project-archive'].includes(section.id)?innerHeight*3:innerHeight*.8}px 0px`});
    observer.observe(section);
    if(reviewNear||warmed()){near=true;start();}
    const visibility=()=>{if(!document.hidden)start();};
    const lost=(event:Event)=>{if(!controller)return;event.preventDefault();fail();};
    const restored=()=>{if(retry++<1){failed=false;section.classList.remove("jny-static");start();}};
    document.addEventListener("visibilitychange",visibility);
    canvas.addEventListener("webglcontextlost",lost);canvas.addEventListener("webglcontextrestored",restored);
    return ()=>{
      disposed=true;observer.disconnect();window.removeEventListener('scene-warm',warm);
      document.removeEventListener("visibilitychange",visibility);
      canvas.removeEventListener("webglcontextlost",lost);canvas.removeEventListener("webglcontextrestored",restored);
      release();
    };
  },[sectionRef,canvasRef,load]);
}
