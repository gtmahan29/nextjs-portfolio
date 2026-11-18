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
    // Phones and low-memory devices cannot hold every scene at once: iOS Safari kills and
    // reloads the tab when GPU memory runs out. They load only near the view and give the
    // memory back once the visitor is well past.
    const constrained=matchMedia("(any-pointer: coarse) and (max-width: 860px)").matches||getSceneQuality().tier==="low";
    const warmOffscreen=!constrained;
    const reviewNear=section.id==='journey'
      ? params.has("unlockReview")||params.has("journeyReview")
      : section.id==='studio' ? params.has("studioReview") : false;
    const release=()=>{
      controller?.abort();controller=undefined;cleanup?.();cleanup=undefined;
      // The drawing buffer outlives renderer.dispose(); shrink it so the memory returns now.
      if(constrained){canvas.width=1;canvas.height=1;}
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
    // Avoid filling the GPU with offscreen scenes during startup on phones.
    const warmed=()=>warmOffscreen&&(window as unknown as {__sceneWarm?:boolean}).__sceneWarm===true;
    const warm=()=>{near=true;start();};
    if(warmOffscreen)window.addEventListener('scene-warm',warm);
    const reach=['journey','studio','project-archive'].includes(section.id)?3:.8;
    const observer=new IntersectionObserver(([entry])=>{
      near=reviewNear||warmed()||entry.isIntersecting;
      // On capable devices the long journey keeps its context until route unmount,
      // avoiding mid-scroll reconstruction; offscreen it only stops rendering.
      if(near)start();
    },{rootMargin:`${innerHeight*reach}px 0px`});
    observer.observe(section);
    // Release a screen and a half beyond the load margin, so scrolling back and forth
    // near the edge never rebuilds a scene.
    const keeper=constrained&&!reviewNear?new IntersectionObserver(([entry])=>{
      if(entry.isIntersecting||failed)return;
      near=false;if(controller||cleanup)release();
    },{rootMargin:`${innerHeight*(reach+1.5)}px 0px`}):undefined;
    keeper?.observe(section);
    if(reviewNear||warmed()){near=true;start();}
    const visibility=()=>{if(!document.hidden)start();};
    const lost=(event:Event)=>{if(!controller)return;event.preventDefault();fail();};
    const restored=()=>{if(retry++<1){failed=false;section.classList.remove("jny-static");start();}};
    document.addEventListener("visibilitychange",visibility);
    canvas.addEventListener("webglcontextlost",lost);canvas.addEventListener("webglcontextrestored",restored);
    return ()=>{
      disposed=true;observer.disconnect();keeper?.disconnect();window.removeEventListener('scene-warm',warm);
      document.removeEventListener("visibilitychange",visibility);
      canvas.removeEventListener("webglcontextlost",lost);canvas.removeEventListener("webglcontextrestored",restored);
      release();
    };
  },[sectionRef,canvasRef,load]);
}
