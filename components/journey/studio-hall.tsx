"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import "./studio-hall.css";
import {Outfit} from "next/font/google";
import {useSceneRuntime} from "./use-scene-runtime";
const servicesFont=Outfit({subsets:["latin"],display:"swap",variable:"--font-services"});
const loadRuntime=()=>import("./studio-hall-runtime");

const SERVICES:{name:string;giant:string;title:string;text:string}[] = [
  {name:"Websites",giant:"Websites",title:"Websites that do their job.",
    text:"Clear pages that explain what you offer, fast to load and easy to find your way around."},
  {name:"Mobile apps",giant:"Apps",title:"Apps people come back to.",
    text:"The whole flow designed and built together, so it feels solid on any connection."},
  {name:"Platforms",giant:"Platforms",title:"Tools your team actually uses.",
    text:"Orders, records and approvals in one place, connected to the services you already run."},
];

/* Scroll decides which service is on stage; the runtime then springs each element in real time.
   data-svc ties an element to its service ("all" for the stage itself); data-delay staggers it (ms). */
const beat=(service:number|"all",order:number)=>({"data-svc":String(service),"data-delay":String(Math.round(order*80))});

export default function StudioHall() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(0);
  const [review, setReview] = useState(false);
  const [audit, setAudit] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [scrollReview, setScrollReview] = useState(false);
  const [gestureDone, setGestureDone] = useState(false);
  const timers=useRef<number[]>([]);
  const [preview,setPreview]=useState<number|null>(null);
  const closePreview=()=>{setPreview(null);sectionRef.current?.dispatchEvent(new Event('showroom-preview-close'));};
  useEffect(()=>{
    const hall=sectionRef.current!;
    const ready=(event:Event)=>setPreview((event as CustomEvent<number>).detail);
    const dismiss=()=>setPreview(null);
    const keyboard=(event:KeyboardEvent)=>{if(event.key==='Escape'){dismiss();hall.dispatchEvent(new Event('showroom-preview-close'));}};
    hall.addEventListener('showroom-preview-ready',ready);hall.addEventListener('showroom-preview-dismiss',dismiss);window.addEventListener('keydown',keyboard);
    return ()=>{hall.removeEventListener('showroom-preview-ready',ready);hall.removeEventListener('showroom-preview-dismiss',dismiss);window.removeEventListener('keydown',keyboard);};
  },[]);

  useEffect(() => {
    const params=new URLSearchParams(location.search);
    setReview(params.has("showroomReview"));setScrollReview(params.has("showroomScrollReview"));
    return ()=>timers.current.forEach(clearTimeout);
  },[]);
  useSceneRuntime(sectionRef,canvasRef,loadRuntime,{onActive:setActive,onAudit:setAudit,onUnavailable:()=>setUnavailable(true),onReady:()=>setUnavailable(false)});
  useEffect(()=>{
    if(!unavailable)return;
    const hall=sectionRef.current!;
    const update=()=>setActive(Math.round(Math.max(0,Math.min(1,(scrollY-hall.offsetTop)/Math.max(1,hall.offsetHeight-innerHeight)))*2));
    window.addEventListener("scroll",update,{passive:true});update();return ()=>window.removeEventListener("scroll",update);
  },[unavailable]);

  const testGesture = (direction: number) => {
    setGestureDone(false);
    // Review fixture exercises the same Lenis wheel listener as physical input.
    const events=Array.from({length:10},()=>new WheelEvent("wheel", { deltaY:direction*4000,bubbles:true,cancelable:true }));
    events.forEach((event,i)=>timers.current.push(window.setTimeout(()=>window.dispatchEvent(event),i*90)));
    timers.current.push(window.setTimeout(()=>setGestureDone(true),1500));
  };
  return <section ref={sectionRef} id="studio" data-single-laptop="true" data-active={active} className={`st-hall lumen-hall jny-dark jny-bare ${servicesFont.variable}${review ? " st-review" : ""}`} aria-label="Digital product showroom">
    <div className="st-stage lumen-stage">
      {/* Original room poster retained; omitted in the single-laptop scene.
      {unavailable && <div className="lumen-scene-placeholder" aria-hidden="true" style={{backgroundImage:`url(/models/showroom/poster-${active}.webp)`}} />}
      */}
      <canvas ref={canvasRef} aria-label="A laptop descends and a phone settles onto a floating illuminated platform" role="img" />
      {/* Original showroom captions, slide navigation and preview controls retained.
      <div className="lumen-caption" key={active}>
        <p className="lumen-eyebrow"><span>0{active + 1}</span>{product.label}</p>
        <h2>{product.title}</h2>
        <p className="lumen-description">{product.text}</p>
        <button className="lumen-preview-trigger" onClick={()=>sectionRef.current?.dispatchEvent(new Event('showroom-preview-open'))}>Explore the sample <span aria-hidden="true">↗</span></button>
        <a className="lumen-link" href={product.link}>{product.action}<span aria-hidden="true">↗</span></a>
      </div>
      <nav className="lumen-navigation" aria-label="Showroom slides">
        <div className="lumen-tabs">{PRODUCTS.map((p, i) => <button key={p.label} onClick={() => navigate(i)} aria-current={i === active ? "step" : undefined}><span>0{i + 1}</span>{["Websites", "Apps", "Platforms"][i]}</button>)}</div>
        <span className="lumen-scroll">Scroll to explore <span aria-hidden="true">↓</span></span>
      </nav>
      {unavailable && <p className="lumen-fallback">Explore the collection</p>}
      {scrollReview && <div className="lumen-scroll-review">
        <button onClick={()=> { setGestureDone(false); const hall=sectionRef.current!; smoothScrollTo(window.scrollY+hall.getBoundingClientRect().top-window.innerHeight*.35); timers.current.push(window.setTimeout(()=>setGestureDone(true),1500)); }}>Before showroom</button>
        <button onClick={()=>testGesture(1)}>Long wheel down</button>
        <button onClick={()=>testGesture(-1)}>Long wheel up</button>
        <output>{gestureDone ? "Gesture settled" : "Gesture ready"}</output>
      </div>}
      {preview!==null&&<button className="lumen-back-to-showcase" onClick={closePreview}>← Back to showcase</button>}
      */}
      {/* Behind the mockup: one giant word per service, sliding sideways on the spring. */}
      <div className="svc-giant" aria-hidden="true" {...beat("all",0)}>
        <div className="svc-giant-track">
          {SERVICES.map((service,k)=><span className="svc-giant-word" key={service.name} style={{"--k":k} as CSSProperties}>
            {Array.from(service.giant).map((ch,l)=><span key={l} className="svc-letter" style={{"--l":l-(service.giant.length-1)/2} as CSSProperties}>{ch}</span>)}
          </span>)}
        </div>
      </div>
      <h2 className="sr-only">What I can build for you.</h2>
      <div className="svc-count" {...beat("all",2)}>
        <span className="svc-count-num" aria-hidden="true">0<span className="svc-roll"><span className="svc-roll-col"><span>1</span><span>2</span><span>3</span></span></span></span>
        <span className="svc-count-of" aria-hidden="true">/03</span>
      </div>
      {SERVICES.map((service,i)=><article key={service.name} className="svc-panel" data-service={i} data-current={unavailable || undefined} aria-label={service.name}>
        <div className="svc-story">
          <h3 className="svc-m"><span className="svc-in svc-head" {...beat(i,0)}>{service.title}</span></h3>
          <p className="svc-m"><span className="svc-in svc-text" {...beat(i,1)}>{service.text}</span></p>
        </div>
        <a className="svc-go" href="#pricing" {...beat(i,2.4)}>
          <span>How we work together</span>
          <span className="svc-go-ic" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M4 12L12 4M5.5 4H12v6.5"/></svg></span>
        </a>
      </article>)}
      <output hidden data-showroom-audit={audit} />
    </div>

  </section>;
}
