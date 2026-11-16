"use client";
import { useEffect, useState, useRef } from "react";
import { smoothScrollTo } from "../smooth-scroll";
import { FOCUS } from "./data";
import { storyToScroll } from "./camera-motion";

/** Local opt-in repeatable stops. This control is absent from the production UI. */
export default function PerformanceReview() {
  const [enabled,setEnabled]=useState(false);
  const diagnostic=useRef<HTMLElement>(null);
  const timing=useRef({count:0,max:0,duringScroll:0,lastInput:-Infinity});
  useEffect(()=>setEnabled(process.env.NODE_ENV!=="production" && new URLSearchParams(location.search).has("scenePerf")),[]);
  useEffect(()=>{
    if(!enabled||!PerformanceObserver.supportedEntryTypes.includes('longtask'))return;
    const input=()=>{timing.current.lastInput=performance.now();};
    window.addEventListener('scroll',input,{passive:true});window.addEventListener('wheel',input,{passive:true});
    const observer=new PerformanceObserver(list=>{
      for(const entry of list.getEntries()){
        const stats=timing.current;stats.count++;stats.max=Math.max(stats.max,entry.duration);
        if(entry.startTime+entry.duration>=stats.lastInput&&entry.startTime-stats.lastInput<200)stats.duringScroll++;
      }
      if(diagnostic.current)diagnostic.current.dataset.longTasks=JSON.stringify(timing.current);
    });observer.observe({type:'longtask'});
    return()=>{observer.disconnect();window.removeEventListener('scroll',input);window.removeEventListener('wheel',input);};
  },[enabled]);
  if(!enabled)return null;
  const journey=(phase:number)=>{
    const section=document.getElementById("journey")!;
    const reduced=matchMedia("(prefers-reduced-motion:reduce)").matches;
    const entry=reduced?0:innerHeight*2.2,conversation=innerHeight*(reduced?1.2:2.2);
    const span=section.offsetHeight-innerHeight-entry-conversation-(reduced?0:innerHeight*2.4);
    smoothScrollTo(section.getBoundingClientRect().top+scrollY+entry+span*storyToScroll(phase===7?.99:FOCUS[phase-1]));
  };
  return <nav ref={diagnostic} aria-label="Performance review" style={{position:"fixed",bottom:12,right:12,zIndex:10000,background:"#fff",color:"#111",padding:8,border:"1px solid #aaa",display:"flex",flexWrap:"wrap",maxWidth:"calc(100vw - 24px)",gap:8,fontSize:12}}>
    <button onClick={()=>smoothScrollTo(0)}>Hero</button>
    {[1,2,3,4,5,6,7].map(n=><button key={n} onClick={()=>journey(n)}>Phase {n}</button>)}
    <button onClick={()=>smoothScrollTo(document.getElementById("studio")!.getBoundingClientRect().top+scrollY)}>Showroom</button>
    {[.15,.4,.7,.94].map(p=><button key={p} onClick={()=>{
      const end=document.getElementById('studio')!.getBoundingClientRect().top+scrollY;
      smoothScrollTo(end-innerHeight*3.4*(1-p));
    }}>Laptop {Math.round(p*100)}%</button>)}
    <button onClick={()=>smoothScrollTo(document.getElementById("project-archive")!.getBoundingClientRect().top+scrollY)}>Work</button>
    <button onClick={()=>{timing.current={count:0,max:0,duringScroll:0,lastInput:-Infinity};if(diagnostic.current)diagnostic.current.dataset.longTasks=JSON.stringify(timing.current);}}>Reset timing</button>
  </nav>;
}
