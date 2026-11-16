"use client";

import {useEffect, useRef, useState, type CSSProperties} from "react";
import {createPortal} from "react-dom";
import {ArrowLeft, ArrowRight, ArrowUpRight, X} from "lucide-react";
import {CASE_PROJECTS} from "./project-case-data";
import {LaptopReveal, DeviceEnsemble, DetailReveal} from "./case-motion-scenes";
import AAQCaseStudy, {aaqTypeface} from "./aaq-case-study";
import RasaCaseStudy from "./rasa-case-study";
import {setCaseStudyOpen} from "./case-scene-visibility";
import "./project-case-study.css";

interface Props {
  projectId: string;
  fontClass: string;
  onClose: () => void;
  onProjectChange: (id: string) => void;
}

export default function ProjectCaseStudy({projectId, fontClass, onClose, onProjectChange}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [closing, setClosing] = useState(false);
  const [ready, setReady] = useState(false);
  const index = Math.max(0, CASE_PROJECTS.findIndex(project => project.id === projectId));
  const project = CASE_PROJECTS[index];
  const next = CASE_PROJECTS[(index + 1) % CASE_PROJECTS.length];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    setCaseStudyOpen(true);
    dialog.current?.showModal();
    setReady(true);
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      document.body.style.overflow = previousOverflow;
      setCaseStudyOpen(false);
      previousFocus?.focus({preventScroll: true});
    };
  }, []);

  useEffect(() => {
    dialog.current?.scrollTo({top: 0, behavior: "instant"});
    dialog.current?.querySelector<HTMLHeadingElement>("h1")?.focus({preventScroll: true});
  }, [projectId]);

  function close() {
    if (closing) return;
    setClosing(true);
    closeTimer.current = setTimeout(onClose, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 350);
  }

  const style = {"--case-tint": project.color, "--case-ink": project.ink} as CSSProperties;

  return createPortal(
    <dialog ref={dialog} className={`project-case ${fontClass} ${project.id === "aaq" ? `aaq-study-dialog ${aaqTypeface.variable}` : project.id === "rasa" ? "rasa-study-dialog" : ""} ${closing ? "is-closing" : ""}`}
      style={style} aria-labelledby="case-title" data-lenis-prevent
      onCancel={event => {event.preventDefault(); close();}}
      onKeyDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
      <div className="case-scroll-content">
      <nav className="case-nav" aria-label="Case study navigation">
        <button className="case-back" onClick={close}><ArrowLeft size={16}/><span>All projects</span></button>
        <span className="case-wordmark" aria-hidden="true">MAHAN</span>
        <button className="case-close" onClick={close} aria-label="Close case study"><X size={20}/></button>
      </nav>

      {project.id === "aaq" ? ready && <AAQCaseStudy key={project.id} scroller={dialog} onClose={close} onNext={() => onProjectChange(next.id)}/> : project.id === "rasa" ? ready && <RasaCaseStudy key={project.id} scroller={dialog} onClose={close} onNext={() => onProjectChange(next.id)}/> : <article key={project.id} className="case-article">
        <header className="case-intro case-container">
          <div className="case-eyebrow"><span>{project.href ? "Featured project" : "Independent design study"}</span><span>{String(index + 1).padStart(2, "0")} / 05</span></div>
          <h1 id="case-title" tabIndex={-1}>{project.title}</h1>
          <div className="case-intro-bottom">
            <p>{project.intro}</p>
            <div className="case-meta"><span>Focus</span><strong>{project.discipline}</strong></div>
            {project.href && <a className="case-live" href={project.href} target="_blank" rel="noopener noreferrer">Visit live website <ArrowUpRight size={17}/></a>}
          </div>
        </header>

        {ready && <LaptopReveal project={project} scroller={dialog}/>}

        <section className="case-brief case-container" aria-labelledby="case-direction">
          <div className="case-brief-aside"><span className="case-section-label">The brief</span><p>{project.brief}</p><span className="case-section-label">Design focus</span><div className="case-focus-list"><span>Visual direction</span><span>Interface design</span><span>Interaction & motion</span></div></div>
          <div className="case-brief-body">
            <h2 id="case-direction">{project.direction}</h2>
            <div className="case-decisions">
              {project.decisions.map((decision, i) => <div key={decision.title}><span className="case-decision-number">0{i + 1}</span><h3>{decision.title}</h3><p>{decision.text}</p></div>)}
            </div>
          </div>
        </section>

        <section className="case-language" aria-labelledby="case-language-title">
          <div className="case-type-specimen"><span className="case-section-label">Visual language</span><h2 id="case-language-title">A distinct<br/><em>point of view.</em></h2><div className="case-type-letters" aria-hidden="true">Aa<span>&</span></div><p>{project.title}</p></div>
          <div className="case-color-specimen"><div className="case-palette" aria-label="Project colour palette">{project.palette.map((color, i) => <div key={color} style={{backgroundColor: color, color: i === 0 ? "#fff" : project.palette[0]}}><span>0{i+1}</span><span>{color.toUpperCase()}</span></div>)}</div><div className="case-interface-fragment"><img src={project.src} alt={`Interface detail from ${project.title}`} loading="lazy"/></div></div>
        </section>

        {ready && <DeviceEnsemble project={project} scroller={dialog}/>}
        {ready && <DetailReveal project={project} scroller={dialog}/>}

        <section className="case-final-interface"><div className="case-container"><span className="case-section-label">The complete first impression</span><h2>{project.intro}</h2></div><div className="case-browser-frame case-container"><div className="case-browser-toolbar" aria-hidden="true"><i/><i/><i/><span>{project.href ? new URL(project.href).hostname : project.title}</span><ArrowUpRight size={13}/></div><img src={project.src} alt={project.alt} loading="lazy"/></div>{project.href && <a className="case-final-link" href={project.href} target="_blank" rel="noopener noreferrer">Experience the live project <span><ArrowUpRight size={17}/></span></a>}</section>

        <footer className="case-next case-container">
          <span className="case-section-label">Keep exploring</span>
          <button onClick={() => onProjectChange(next.id)} aria-label={`Next project: ${next.title}`}><span><small>Next project</small>{next.title}</span><ArrowRight aria-hidden="true"/></button>
          <div className="case-footer-line"><span>Design & development, by Mahan.</span><button onClick={close}>Back to selected work <ArrowUpRight size={14}/></button></div>
        </footer>
      </article>}
      </div>
    </dialog>, document.body,
  );
}
