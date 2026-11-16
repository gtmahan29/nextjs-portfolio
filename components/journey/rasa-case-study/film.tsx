"use client";

import {useEffect, useLayoutEffect, useRef, useState, type RefObject} from "react";
import {Player, type PlayerRef} from "@remotion/player";
import {AbsoluteFill, Easing, Html5Video, Sequence, interpolate, useCurrentFrame} from "remotion";
import {useReducedMotion} from "framer-motion";
import {gsap} from "gsap";
import {ScrollTrigger} from "gsap/ScrollTrigger";
import {RASA_CAPTURES, type RasaCaptureId} from "./data";

gsap.registerPlugin(ScrollTrigger);
const FRAMES = 360;
const scenes = [
  {id: "entrance" as RasaCaptureId, title: "An invitation.", caption: "Architecture introduces the academy before the programmes take over."},
  {id: "programs" as RasaCaptureId, title: "A way forward.", caption: "Age-based pathways turn a broad offer into something visitors can explore."},
  {id: "mobile" as RasaCaptureId, title: "Within reach.", caption: "The story adapts to a phone, with a direct route to the first conversation."},
];
function move(frame: number, start: number, end: number, from: number, to: number) {
  return interpolate(frame, [start, end], [from, to], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(.22, 1, .36, 1)});
}

function Screen({id, compact, small = false, from = 0}: {id: RasaCaptureId; compact?: boolean; small?: boolean; from?: number}) {
  const scale = small ? .7 : 1;
  const capture = RASA_CAPTURES[id];
  if (capture.media) return capture.media.type === "video" ? <Sequence from={from} layout="none"><Html5Video src={capture.media.src} muted style={{width: "100%", height: "100%", objectFit: "contain"}}/></Sequence> : <img src={capture.media.src} alt="" style={{width: "100%", height: "100%", objectFit: "contain"}}/>;
  return <div style={{width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f7f4ec", color: "#263e57", padding: compact ? 20 : 38 * scale}}>
    <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #263e5726", paddingBottom: compact ? 14 : 20 * scale, gap: 20}}><strong style={{fontSize: compact ? 20 : 30 * scale, letterSpacing: ".02em"}}>RASA</strong><code style={{fontSize: compact ? 12 : 19 * scale}}>{capture.route}</code></div>
    <div style={{flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", gap: compact ? 14 : 26 * scale}}>
      <svg width={compact ? 30 : 46 * scale} height={compact ? 30 : 46 * scale} viewBox="0 0 40 40" fill="none"><rect x="4" y="8" width="32" height="24" rx="5" stroke="#6989a2"/><path d="m17 14 9 6-9 6Z" stroke="#6989a2"/></svg>
      <strong style={{fontSize: compact ? 24 : 38 * scale, lineHeight: 1.2, letterSpacing: "-.035em", fontWeight: 500}}>{capture.title}</strong>
      <p style={{margin: 0, fontSize: compact ? 18 : 26 * scale, lineHeight: 1.5, maxWidth: 650, color: "#53697b"}}>{compact && id === "mobile" ? "Record the entrance, programmes and consultation at phone width." : capture.short}</p>
      <span style={{fontSize: compact ? 12 : 19 * scale, color: "#6d7e88"}}>Screen recording placeholder</span>
    </div>
    <code style={{fontSize: compact ? 11 : 18 * scale, textAlign: "center", color: "#6d7e88"}}>{capture.filename}</code>
  </div>;
}

function RasaComposition({portrait}: {portrait: boolean}) {
  const frame = useCurrentFrame();
  const beat = frame < 128 ? 0 : frame < 248 ? 1 : 2;
  const entrance = move(frame, 0, 72, 0, 1);
  const mobile = move(frame, 235, 307, 0, 1);
  const width = portrait ? 760 : 1200;
  const tabletWidth = portrait ? 675 : 1050;
  const tabletHeight = tabletWidth * .62;
  const typed = scenes[beat].title.slice(0, Math.floor(move(frame, beat * 120 + 12, beat * 120 + 72, 0, scenes[beat].title.length)));
  return <AbsoluteFill style={{fontFamily: "inherit", color: "#263e57", perspective: 1800, overflow: "hidden"}}>
    <div style={{position: "absolute", top: portrait ? 42 : 38, left: 0, right: 0, textAlign: "center", fontSize: portrait ? 32 : 26, color: "#59768b", letterSpacing: ".01em"}}>{typed}<span style={{color: "#bc9866", marginLeft: 6}}>▏</span></div>
    <div style={{position: "absolute", top: portrait ? 130 : 115, left: (width - tabletWidth) / 2 - mobile * (portrait ? 100 : 150), width: tabletWidth, height: tabletHeight, padding: portrait ? 17 : 21, border: "2px solid #a8b3b9", borderRadius: 35, background: "linear-gradient(135deg,#6f818a,#26333c 20%,#172530 80%,#77909f)", boxShadow: "0 30px 70px #263e5726", transformOrigin: "center", transform: `translateY(${(1 - entrance) * 110}px) rotateX(${(1 - entrance) * 24 + 3}deg) rotateY(${(1 - entrance) * -10 - mobile * 7}deg) scale(${.77 + entrance * .2 - mobile * .18})`}}>
      <div style={{position: "absolute", width: 6, height: 6, top: "50%", left: 7, borderRadius: "50%", background: "#070e15"}}/>
      <div style={{height: "100%", position: "relative", overflow: "hidden", borderRadius: 18, background: "#f7f4ec"}}>
        {["entrance", "programs"].map((id, i) => <div key={id} style={{position: "absolute", inset: 0, transform: `translateY(${i === 0 ? -move(frame, 111, 169, 0, 105) : move(frame, 111, 169, 105, 0)}%)`}}><Screen id={id as RasaCaptureId} small={portrait} from={i === 0 ? 0 : 111}/></div>)}
      </div>
    </div>
    <div style={{position: "absolute", top: portrait ? 180 : 200, right: portrait ? 30 : 75, width: portrait ? 236 : 248, height: portrait ? 500 : 525, padding: 10, border: "2px solid #a4b5bd", borderRadius: 42, background: "linear-gradient(140deg,#9bafb9,#314a58 15%,#1b2933 85%,#718b9a)", boxShadow: "0 28px 60px #263e5730", transform: `translateX(${(1 - mobile) * 680}px) rotateY(${(1 - mobile) * 14}deg) rotateZ(${(1 - mobile) * 8}deg)`}}>
      <div style={{height: "100%", borderRadius: 32, overflow: "hidden", position: "relative"}}><Screen id="mobile" compact from={235}/></div>
      <div style={{position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)", width: 64, height: 13, borderRadius: 15, background: "#172530"}}/>
      <div style={{position: "absolute", bottom: 15, left: "50%", transform: "translateX(-50%)", width: 72, height: 3, borderRadius: 3, background: "#263e5780"}}/>
    </div>
    <div style={{position: "absolute", bottom: portrait ? 45 : 35, left: portrait ? 40 : 64, right: portrait ? 40 : 64, display: "flex", alignItems: "center", gap: 24}}>{scenes.map((scene, i) => <div key={scene.id} style={{flex: 1}}><div style={{height: 2, background: "#263e5720", marginBottom: 16, overflow: "hidden"}}><div style={{height: "100%", background: "#446d8c", transformOrigin: "left", transform: `scaleX(${interpolate(frame, [i * 120, i * 120 + 110], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})})`}}/></div><span style={{fontSize: portrait ? 21 : 21, color: i === beat ? "#263e57" : "#788b98"}}>{scene.title}</span></div>)}</div>
  </AbsoluteFill>;
}

export function RasaFilm({scroller}: {scroller: RefObject<HTMLDialogElement>}) {
  const section = useRef<HTMLElement>(null), player = useRef<PlayerRef>(null), layer = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [portrait, setPortrait] = useState(false), [near, setNear] = useState(false), [beat, setBeat] = useState(0);
  const lastBeat = useRef(0);
  useEffect(() => {
    const query = matchMedia("(max-width: 600px)");
    const resize = () => setPortrait(query.matches);resize();query.addEventListener("change", resize);
    return () => query.removeEventListener("change", resize);
  }, []);
  useEffect(() => {
    if (!section.current) return;
    const observer = new IntersectionObserver(entries => {if (entries.some(entry => entry.isIntersecting)) {setNear(true);observer.disconnect();}}, {root: scroller.current, rootMargin: "500px"});
    observer.observe(section.current);return () => observer.disconnect();
  }, [scroller]);
  useEffect(() => {
    if (reduced && near) {player.current?.seekTo(80);lastBeat.current = 0;setBeat(0);}
  }, [reduced, near, portrait]);
  useLayoutEffect(() => {
    if (!near || reduced || !section.current || !scroller.current) return;
    const clock = {frame: 0};let lastFrame = -1, refreshFrame = 0;let alive = true;
    const context = gsap.context(() => {
      const renderFrame = () => {
        const frame = Math.round(clock.frame);if (frame !== lastFrame) {player.current?.seekTo(frame);lastFrame = frame;}
        const next = frame < 128 ? 0 : frame < 248 ? 1 : 2;if (next !== lastBeat.current) {lastBeat.current = next;setBeat(next);}
      };
      let timeline: gsap.core.Timeline;
      const syncToScroll = () => {
        cancelAnimationFrame(refreshFrame);
        refreshFrame = requestAnimationFrame(() => {
          const trigger = timeline?.scrollTrigger, root = scroller.current;
          if (!alive || !trigger || !root) return;
          const progress = gsap.utils.clamp(0, 1, (root.scrollTop - trigger.start) / Math.max(1, trigger.end - trigger.start));
          timeline.progress(progress);
          renderFrame();
        });
      };
      const lean = gsap.quickTo(layer.current, "rotationX", {duration: .9, ease: "power3.out"});
      timeline = gsap.timeline({scrollTrigger: {trigger: section.current, scroller: scroller.current, start: "top 80px", end: "bottom bottom-=24px", scrub: 1, invalidateOnRefresh: true, onRefresh: syncToScroll, onUpdate: self => lean(gsap.utils.clamp(-.6, .6, self.getVelocity() / 3500)), onScrubComplete: () => lean(0)}});
      timeline.addLabel("invitation", 0).addLabel("pathways", .35).addLabel("mobile", .69).to(clock, {frame: FRAMES - 1, duration: 1, ease: "none", onUpdate: renderFrame}, 0);
      timeline.scrollTrigger?.refresh();
      syncToScroll();
    }, section);
    document.fonts.ready.then(() => {if (alive) ScrollTrigger.refresh();});
    const observer = new ResizeObserver(() => ScrollTrigger.refresh());observer.observe(section.current);
    return () => {alive = false;cancelAnimationFrame(refreshFrame);observer.disconnect();context.revert();};
  }, [near, portrait, reduced, scroller]);
  return <figure className={`rasa-film ${reduced ? "is-static" : ""}`} ref={section} aria-label="Rasa across tablet and phone">
    <div className="rasa-film-sticky"><div className="rasa-film-meta"><span>From the first hello</span><span>{String(beat + 1).padStart(2, "0")} / 03</span></div><div ref={layer} className="rasa-film-viewport" aria-hidden="true">{near && <Player ref={player} component={RasaComposition} inputProps={{portrait}} durationInFrames={FRAMES} fps={60} compositionWidth={portrait ? 760 : 1200} compositionHeight={portrait ? 800 : 860} initialFrame={reduced ? 80 : 0} autoPlay={false} controls={false} clickToPlay={false} doubleClickToFullscreen={false} spaceKeyToPlayOrPause={false} style={{width: "100%", height: "100%"}}/>}</div><div className="rasa-film-caption"><p>{scenes[beat].caption}</p><span>{reduced ? "Rasa, across devices" : "Follow with scroll"}<span aria-hidden="true">↓</span></span></div></div>
    <figcaption className="rasa-sr-only">A tablet introduces the architectural entrance, slides to the programme section, then a phone joins the scene. The screens are replaceable recording placeholders; capture instructions appear in the chapters below.</figcaption>
  </figure>;
}
