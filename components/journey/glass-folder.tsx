"use client";

import {useEffect, useRef, useState} from "react";
import {ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight} from "lucide-react";
import {Outfit} from "next/font/google";
import {useSceneRuntime} from "./use-scene-runtime";
import {FOLDER_CARDS} from "./glass-folder-data";
import "./glass-folder.css";

const loadRuntime = () => import("./glass-folder-runtime");
const archiveFont = Outfit({subsets: ["latin"], display: "swap", variable: "--font-archive"});

export default function GlassFolder() {
  const section = useRef<HTMLElement>(null), canvas = useRef<HTMLCanvasElement>(null), controls = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0), [unavailable, setUnavailable] = useState(false);
  const [stage, setStage] = useState(0);
  useSceneRuntime(section, canvas, loadRuntime, {onActive: setActive, onUnavailable: () => setUnavailable(true), onReady: () => setUnavailable(false)});
  useEffect(() => {
    const root = section.current!;
    const change = (event: Event) => setStage((event as CustomEvent<number>).detail);
    root.addEventListener("folder-stage", change);
    return () => root.removeEventListener("folder-stage", change);
  }, []);
  const select = (index: number, instant = false) => {
    const next = (index + FOLDER_CARDS.length) % FOLDER_CARDS.length;
    setActive(next);section.current?.dispatchEvent(new CustomEvent("folder-slide", {detail: {index: next, instant}}));
  };
  const open = (id: string) => window.dispatchEvent(new CustomEvent("portfolio-open-project", {detail: id}));
  return <section id="project-archive" ref={section} className={`glass-archive ${archiveFont.variable}${unavailable ? " glass-archive-fallback" : ""}`} data-stage={stage} aria-labelledby="archive-title">
    <span id="work" className="glass-archive-anchor" aria-hidden="true" />
    <div className="glass-archive-stage">
      <header className="glass-archive-heading"><p>Live projects and design studies</p><h2 id="archive-title">Selected <em>work.</em></h2></header>
      <canvas ref={canvas} role="img" aria-label="A frosted amber glass folder opens into a gallery of five projects"/>
      {unavailable && <div className="glass-archive-static"><button className="glass-archive-static-current" onClick={() => open(FOLDER_CARDS[active].id)}><img src={FOLDER_CARDS[active].image} alt=""/><span>{FOLDER_CARDS[active].title}<ArrowUpRight size={17}/></span></button></div>}
      <div className="glass-archive-bottom">
        <div className="glass-archive-cue"><ArrowDown size={14}/><span key={stage} className="glass-archive-swap">{["Scroll to open", "A little room for possibility", "Ideas, out in the open", "On to the next chapter"][stage]}</span></div>
        <div ref={controls} className="glass-archive-controls">
          <div className="glass-archive-project" aria-live="polite"><span key={`c${active}`} className="glass-archive-swap">{FOLDER_CARDS[active].category}</span><button key={`t${active}`} className="glass-archive-swap" onClick={() => open(FOLDER_CARDS[active].id)}>{FOLDER_CARDS[active].title}<ArrowUpRight size={16}/></button></div>
          <nav aria-label="Archive projects"><button onClick={event => select(active - 1,event.detail === 0)} aria-label="Previous archive project"><ArrowLeft size={18}/></button><span>{String(active + 1).padStart(2,"0")} <i>/ {String(FOLDER_CARDS.length).padStart(2,"0")}</i></span><button onClick={event => select(active + 1,event.detail === 0)} aria-label="Next archive project"><ArrowRight size={18}/></button></nav>
        </div>
      </div>
    </div>
  </section>;
}
