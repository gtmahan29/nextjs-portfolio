"use client";

import {useId, useRef, useState} from "react";
import {motion, useReducedMotion} from "framer-motion";
import {ArrowRight} from "lucide-react";
import {PROGRAMMES, ROADMAP} from "./data";

const ease = [.22, 1, .36, 1] as const;

export function ProgrammeExplorer() {
  const [selected, setSelected] = useState(0);
  const reduced = useReducedMotion();
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const programme = PROGRAMMES[selected];
  return <div className="rasa-pathway-explorer">
    <div className="rasa-explorer-label"><span>Programme structure</span><span>Explore the age groups</span></div>
    <div className="rasa-age-tabs" role="tablist" aria-label="Age-based learning pathways">{PROGRAMMES.map((item, i) => <button key={item.age} ref={node => {buttons.current[i] = node;}} id={`${id}-tab-${i}`} aria-controls={`${id}-panel`} role="tab" aria-selected={selected === i} tabIndex={selected === i ? 0 : -1} onClick={() => setSelected(i)} onKeyDown={event => {
      let next = i;if (event.key === "ArrowRight") next = (i + 1) % 5;else if (event.key === "ArrowLeft") next = (i + 4) % 5;else if (event.key === "Home") next = 0;else if (event.key === "End") next = 4;else return;
      event.preventDefault();setSelected(next);buttons.current[next]?.focus();
    }}>{selected === i && <motion.span layoutId={`${id}-age`} className="rasa-age-selected" style={{backgroundColor: item.color}} transition={{duration: reduced ? 0 : .6, ease}}/>}<span>{item.age}</span><small>years</small></button>)}</div>
    <div className="rasa-programme-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${selected}`} tabIndex={0}>
      <motion.div key={selected} initial={reduced ? false : {y: 24, clipPath: "inset(0 0 100% 0)"}} animate={{y: 0, clipPath: "inset(0 0 0% 0)"}} transition={{duration: .75, ease}}><h3>{programme.name}</h3><p>{programme.focus}</p></motion.div>
      <div className="rasa-pathway-symbol" style={{color: programme.color}} aria-hidden="true"><span>A</span><span>a</span></div>
    </div>
    <p className="rasa-diagram-note">Programme structure · age groups and learning focus.</p>
  </div>;
}

const FAMILY = ["A playful beginning", "Support alongside school", "Speaking and confidence", "Finding an age-appropriate class"];
const ADULT = ["Starting or returning to English", "Everyday conversation", "Work, travel or migration", "Academic progress"];
export function ConsultationAnatomy() {
  const [adult, setAdult] = useState(false), [step, setStep] = useState(0);
  const reduced = useReducedMotion();
  const id = useId();
  const steps = ["Who is learning?", "What matters to them?", "How can we reach them?"];
  return <div className="rasa-consultation-anatomy">
    <div className="rasa-flow-top"><span>Three short steps</span><div role="group" aria-label="Consultation audience"><button aria-pressed={!adult} onClick={() => setAdult(false)}>Child or teen</button><button aria-pressed={adult} onClick={() => setAdult(true)}>Adult</button></div></div>
    <ol className="rasa-flow-steps">{steps.map((item, i) => <li key={item}><button aria-pressed={step === i} onClick={() => setStep(i)}><span>{String(i + 1).padStart(2, "0")}</span>{item}{step === i && <motion.i layoutId={`${id}-step`} transition={{duration: reduced ? 0 : .6, ease}}/>}</button>{i < 2 && <ArrowRight size={16} strokeWidth={1} aria-hidden="true"/>}</li>)}</ol>
    <div className="rasa-flow-detail" aria-live="polite"><motion.div key={`${adult}-${step}`} initial={reduced ? false : {y: 18, clipPath: "inset(0 0 100% 0)"}} animate={{y: 0, clipPath: "inset(0 0 0% 0)"}} transition={{duration: .65, ease}}>
      <h3>{steps[step]}</h3>
      {step === 0 ? <p>{adult ? "Adults can begin or return to English with a route shaped around their own goals." : "Parents can explore a path for a child or teenager, with age and the learner's situation in mind."}</p> : step === 1 ? <ul>{(adult ? ADULT : FAMILY).map(goal => <li key={goal}>{goal}</li>)}</ul> : <p>The final screen asks for a name and phone number. The current front end then changes to a local confirmation state; no request is sent by this component.</p>}
    </motion.div></div><p className="rasa-diagram-note">Interactive diagram of the consultation flow.</p>
  </div>;
}

export function RoadmapExplorer() {
  const [selected, setSelected] = useState(0);
  const reduced = useReducedMotion();
  const id = useId();
  return <div className="rasa-roadmap-explorer"><div className="rasa-roadmap-path" aria-hidden="true"><svg viewBox="0 0 1000 150" preserveAspectRatio="none" fill="none"><path d="M30 115C180 115 160 30 300 30S460 115 530 115S700 30 790 30S910 115 970 115" stroke="#a6bac7" strokeWidth="1.5"/><path className="rasa-route-draw" d="M30 115C180 115 160 30 300 30S460 115 530 115S700 30 790 30S910 115 970 115" stroke="#365f7b" strokeWidth="2.5" pathLength="1" strokeDasharray="1"/></svg></div><div className="rasa-roadmap-buttons" role="group" aria-label="Explore the five learning-world stations">{ROADMAP.map((station, i) => <button key={station.label} aria-pressed={selected === i} onClick={() => setSelected(i)}><span>{String(i + 1).padStart(2, "0")}{selected === i && <motion.i layoutId={`${id}-station`} transition={{duration: reduced ? 0 : .7, ease}}/>}</span><strong>{station.label}</strong></button>)}</div><motion.div key={selected} className="rasa-roadmap-detail" initial={reduced ? false : {y: 16}} animate={{y: 0}} transition={{duration: .7, ease}}><h3>{ROADMAP[selected].title}</h3><p>{ROADMAP[selected].detail}</p></motion.div><p className="rasa-diagram-note">Five connected stations from the learning-world scene.</p></div>;
}
