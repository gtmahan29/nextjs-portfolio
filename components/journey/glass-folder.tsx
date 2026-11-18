"use client";

import {useEffect, useRef, useState, type KeyboardEvent} from "react";
import {BEFORE, createStagedMotion} from "./staged-motion";
import {addJob, wake} from "./spring-ticker";
import {IconArrowLeft, IconArrowRight, IconArrowUpRight} from "@tabler/icons-react";
import {Outfit} from "next/font/google";
import {useSceneRuntime} from "./use-scene-runtime";
import {FOLDER_CARDS} from "./glass-folder-data";
import {Rise, Words} from "./staged-words";
import "./glass-folder.css";

const loadRuntime = () => import("./glass-folder-runtime");
const archiveFont = Outfit({subsets: ["latin"], display: "swap", variable: "--font-archive"});
const captions = ["Live projects and design studies", "The archive opens", "Five projects, ready to explore", "Browse the archive", ""];

export default function GlassFolder() {
  const section = useRef<HTMLElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(0), [unavailable, setUnavailable] = useState(false);
  const activeRef = useRef(0);
  activeRef.current = active;

  // The big number and the project line change on the shared spring: the old digits and
  // words leave upward, the new ones rise (an odometer roll). Own stage, separate from the scene's.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const own = Array.from(el.querySelectorAll<HTMLElement>("[data-own-stage] [data-beat]"));
    const digits = createStagedMotion(own.filter(n => n.closest(".glass-archive-number")), {lag: .18});
    const info = createStagedMotion(own.filter(n => !n.closest(".glass-archive-number")), {lag: .16, initial: 0});
    const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stop = addJob(dt => {
      const stage = Number(el.dataset.stage ?? BEFORE);
      const still = reduced();
      const a = digits.update(stage >= 2 && stage < 4 ? activeRef.current : BEFORE, dt, still);
      const b = info.update(activeRef.current, dt, still);
      return a || b;
    });
    const onScroll = () => wake();
    addEventListener("scroll", onScroll, {passive: true});
    return () => { stop(); removeEventListener("scroll", onScroll); digits.dispose(); info.dispose(); };
  }, []);
  useEffect(() => { wake(); }, [active]);
  useSceneRuntime(section, canvas, loadRuntime, {onActive: setActive, onUnavailable: () => setUnavailable(true), onReady: () => setUnavailable(false)});
  const select = (index: number) => {
    const next = (index + FOLDER_CARDS.length) % FOLDER_CARDS.length;
    setActive(next);
    section.current?.dispatchEvent(new CustomEvent("folder-slide", {detail: next}));
  };
  const open = (id: string) => window.dispatchEvent(new CustomEvent("portfolio-open-project", {detail: id}));
  function handleGalleryKeys(event: KeyboardEvent<HTMLElement>) {
    const target = ({ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: FOLDER_CARDS.length - 1})[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target);
  }
  const project = FOLDER_CARDS[active];
  return <section id="project-archive" ref={section} className={`glass-archive ${archiveFont.variable}${unavailable ? " glass-archive-fallback" : ""}`} aria-labelledby="archive-title">
    <span id="work" className="glass-archive-anchor" aria-hidden="true" />
    <span className="glass-archive-hold-measure" aria-hidden="true" />
    <div className="glass-archive-stage">
      <header className="glass-archive-heading">
        <h2 id="archive-title" aria-label="Selected work">
          <span aria-hidden="true"><Words text="Selected" beat={0} until={3} />{" "}<em><Words text="work." beat={0} until={3} start={60} /></em></span>
        </h2>
        <div className="glass-archive-captions" aria-hidden="true">
          {captions.map((caption, beat) => caption && <Rise key={caption} beat={beat} until={beat} start={340}>{caption}</Rise>)}
        </div>
      </header>
      <div className="glass-archive-number" data-own-stage="" aria-hidden="true">
        {FOLDER_CARDS.map((item, i) => (
          <p key={item.id}>{String(i + 1).padStart(2, "0").split("").map((d, k) => (
            <span className="jm-m" key={k}><span className="jm-in" data-beat={i} data-until={i} data-delay={k * 70}>{d}</span></span>
          ))}</p>
        ))}
      </div>
      <canvas ref={canvas} aria-hidden="true" />
      {unavailable && <div className="glass-archive-static"><button onClick={() => open(project.id)} data-sfx="big"><img src={project.image} alt=""/><span>{project.title}<IconArrowUpRight size={17}/></span></button></div>}
      <div className="glass-archive-controls">
        <div className="glass-archive-project" data-own-stage="">
          <span className="gap-stack gap-cat" aria-hidden="true">{FOLDER_CARDS.map((item, i) => <Rise key={item.id} beat={i} until={i} start={120}>{item.category}</Rise>)}</span>
          <button data-sfx="big" onClick={() => open(project.id)} aria-label={`Explore ${project.title}`}>
            <span className="gap-go"><IconArrowUpRight size={17} stroke={1.45}/></span>
            <span className="gap-stack" aria-hidden="true">{FOLDER_CARDS.map((item, i) => <span className="gap-title" key={item.id}><Words text={item.title} beat={i} until={i} step={45} /></span>)}</span>
          </button>
          <span className="glass-archive-live" aria-live="polite">{project.title}</span>
        </div>
        <nav aria-label="Archive projects" onKeyDown={handleGalleryKeys}>
          <button data-sfx="data" onClick={() => select(active - 1)} aria-label="Previous archive project"><IconArrowLeft size={18} stroke={1.45}/></button>
          <div className="glass-archive-index">
            <span className="glass-archive-position" aria-hidden="true" />
            {FOLDER_CARDS.map((item, index) => (
              <button key={item.id} data-sfx="data" aria-label={item.title} aria-current={active === index ? "true" : undefined} onClick={() => select(index)}>
                {String(index + 1).padStart(2,"0")}
              </button>
            ))}
          </div>
          <button data-sfx="data" onClick={() => select(active + 1)} aria-label="Next archive project"><IconArrowRight size={18} stroke={1.45}/></button>
        </nav>
      </div>
    </div>
  </section>;
}
