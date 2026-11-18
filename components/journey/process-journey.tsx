"use client";
import {useRef} from "react";
import JourneyTransition from "./journey-transition";
import ProjectShowcase from "./project-showcase";
import ProjectConcierge from "./project-concierge";
import {STATIONS} from "./data";
import {STATION_SCROLL_VH, storyToScroll} from "./camera-motion";
import {LAUNCH_ENTRY} from "./launch-story";
import {useSceneRuntime} from "./use-scene-runtime";
import {Rise, Words} from "./staged-words";
const loadRuntime=()=>import("./process-journey-runtime");
export default function ProcessJourney() {
  const sectionRef=useRef<HTMLElement>(null),canvasRef=useRef<HTMLCanvasElement>(null);
  useSceneRuntime(sectionRef,canvasRef,loadRuntime);
  return (
    <section className="jny-process relative bg-[#cfdce8] select-none" id="journey" ref={sectionRef} aria-label="The production process"
      style={{"--station-span": `${STATION_SCROLL_VH}vh`} as React.CSSProperties}>
      <span id="journey-stations" className="jny-station-anchor" aria-hidden="true" />
      <span id="journey-launch" className="jny-station-anchor" aria-hidden="true"
        style={{top: `calc(var(--entry-span) + ${STATION_SCROLL_VH * storyToScroll(LAUNCH_ENTRY)}vh)`}} />
      <span id="your-next-step" className="jny-station-anchor" aria-hidden="true" />
      <span id="project-start" className="jny-station-anchor" aria-hidden="true" />
      <noscript><style>{`.jny-process{height:auto!important}.jny-stage{position:relative!important;height:auto!important}.jny-entry,.jny-canvas,.jny-scene-placeholder,.jny-finale-copy,.jny-endcta{display:none!important}.jny-static-story{display:block!important;padding:100px 24px!important}.jny-concierge{position:relative!important;opacity:1!important;visibility:visible!important;transform:none!important;pointer-events:auto!important;padding:60px 24px!important;background:#080c18}`}</style></noscript>
      <div className="jny-stage sticky top-0 h-screen overflow-hidden" data-laptop-source="unlock-chapter">
        <canvas className="jny-canvas absolute inset-0 w-full h-full block touch-pan-y" ref={canvasRef} aria-hidden="true" />
        <div className="jny-static-story"><p className="jny-entry-eyebrow">From idea to production</p><h2>Every detail. Connected.</h2><ol>{STATIONS.map(st=><li key={st.id}><span>0{st.id}</span><div><h3>{st.name}</h3><p>{st.deliverable}</p></div></li>)}</ol></div>
        <JourneyTransition />
        <div className="jny-steps" role="list" aria-label="The six stations">
          <div className="jny-steps-core">
            <span className="jny-dock-capsule" aria-hidden="true" />
            <svg className="jny-mark" viewBox="-1.3 -1.3 2.6 2.6" aria-hidden="true"><path d="M0 0Z" /></svg>
            {STATIONS.map((st,i)=>{const lead=st.worry.split(" ").length*45;return <div className="jny-step" role="listitem" key={st.id} style={{"--st-color": st.color} as React.CSSProperties}>
              <p className="jny-eye"><Rise beat={i} start={0}><span className="jny-eye-n">0{st.id}</span>{st.name}</Rise></p>
              <div className="jny-b">
                <h3><Words text={st.worry} beat={i} /></h3>
                <p className="jny-ans"><Rise beat={i} start={lead+60}>{st.answer}</Rise></p>
                <p className="jny-out"><Rise beat={i} start={lead+170}><span>You get</span>{st.deliverable}</Rise></p>
              </div>
              <div className="jny-rail">
                <button type="button" className="jny-t" style={{"--i":i} as React.CSSProperties} aria-label={`Station ${st.id}: ${st.name}`}><span className="jny-n">0{st.id}</span><span className="jny-nm">{st.name}</span></button>
              </div>
            </div>;})}
          </div>
        </div>
        <div className="jny-finale-copy" aria-label="The outcome of all six stations">
          <h2><span className="fin-line"><Words text="Your idea." beat={0} /></span> <em className="fin-line"><Words text="Fully realised." beat={0} start={130} /></em></h2>
          <p><Rise beat={0} start={330}>Six stages, one person, nothing lost between them.</Rise></p>
        </div>
        <ProjectConcierge />
        <ProjectShowcase />
        <p className="jny-unlock-cue" aria-hidden="true"><span>Keep scrolling. The next door is yours to open.</span></p>
      </div>
    </section>
  );
}
