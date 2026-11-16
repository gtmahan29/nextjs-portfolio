"use client";

import {useEffect, useLayoutEffect, useRef, useState, type RefObject} from "react";
import {Player, type PlayerRef} from "@remotion/player";
import {AbsoluteFill, Easing, Html5Video, Sequence, interpolate, useCurrentFrame} from "remotion";
import {useReducedMotion} from "framer-motion";
import {gsap} from "gsap";
import {ScrollTrigger} from "gsap/ScrollTrigger";
import {AAQ_CAPTURES, type CaptureId} from "./data";

gsap.registerPlugin(ScrollTrigger);
const FRAMES = 360;
const beats: {word: string; id: CaptureId; short: string; detail: string}[] = [
  {word: "Discover.", id: "storefront", short: "The first impression", detail: "A storefront with room for the product to speak."},
  {word: "Decide.", id: "checkout", short: "The purchase", detail: "Selection, verification when required, then payment review."},
  {word: "Manage.", id: "overview", short: "The continuing account", detail: "Holdings, plans and records, brought into one account."},
];
const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"} as const;
function travel(frame: number, from: number, to: number, a: number, b: number) {
  return interpolate(frame, [from, to], [a, b], {...clamp, easing: Easing.bezier(.22, 1, .36, 1)});
}

/** Frame-based DOM composition: seekable in either direction, with no playback clock. */
function ProductFilm({compact}: {compact: boolean}) {
  const frame = useCurrentFrame();
  const width = compact ? 760 : 1200;
  const deviceWidth = compact ? 680 : 920;
  const beat = frame < 124 ? 0 : frame < 244 ? 1 : 2;
  const entrance = travel(frame, 0, 62, 0, 1);
  const push = travel(frame, 108, 156, 0, 1);
  const settle = travel(frame, 230, 285, 0, 1);
  const typed = beats[beat].short.slice(0, Math.floor(travel(frame, beat * 120 + 8, beat * 120 + 66, 0, beats[beat].short.length)));
  return <AbsoluteFill style={{fontFamily: "inherit", perspective: 1800, overflow: "hidden", color: "#e6dfcb"}}>
    <div style={{position: "absolute", left: compact ? 40 : 62, top: 35, fontSize: compact ? 23 : 20, color: "#b1ad97", letterSpacing: ".08em", display: "flex", alignItems: "center", gap: 18}}>
      <span style={{width: 7, height: 7, borderRadius: "50%", background: "#dcae3d"}}/>
      <span>{typed}<span style={{marginLeft: 5, color: "#dcae3d"}}>▎</span></span>
    </div>
    <div style={{position: "absolute", top: compact ? 100 : 85, left: 0, right: 0, height: compact ? 120 : 145, overflow: "hidden"}}>
      {beats.map((item, i) => <div key={item.id} style={{position: "absolute", inset: 0, textAlign: "center", fontSize: compact ? 104 : 130, lineHeight: 1.04, fontWeight: 650, letterSpacing: "-.065em", transform: `translateY(${travel(frame, i * 120, i * 120 + 45, 120, 0) - (i < 2 ? travel(frame, (i + 1) * 120 - 12, (i + 1) * 120 + 32, 0, 125) : 0)}%)`}}>{item.word}</div>)}
    </div>
    <div style={{position: "absolute", left: (width - deviceWidth) / 2, top: compact ? 310 : 245, width: deviceWidth, transformStyle: "preserve-3d", transform: `translateY(${(1 - entrance) * 90 - push * 16 + settle * 8}px) rotateX(${(1 - entrance) * 24 + 8 - push * 8 + settle * 4}deg) rotateY(${(1 - entrance) * -8}deg) scale(${.87 + entrance * .09 + push * .04 - settle * .025})`}}>
      <div style={{height: deviceWidth * .57, borderRadius: 23, border: "2px solid #a8a99a", padding: "17px 17px 22px", background: "linear-gradient(145deg,#72766c,#272b23 25%,#11150e 80%,#65695d)", boxShadow: "0 34px 85px #0006", position: "relative"}}>
        <div style={{position: "absolute", top: 7, left: "50%", width: 4, height: 4, borderRadius: "50%", background: "#090b06"}}/>
        <div style={{width: "100%", height: "100%", borderRadius: 8, overflow: "hidden", position: "relative", background: "#e6dfcb", color: "#1a1306"}}>
          {beats.map((item, i) => {
            const capture = AAQ_CAPTURES[item.id];
            const shift = i === 0 ? -travel(frame, 108, 151, 0, 105) : i === 1 ? travel(frame, 108, 151, 105, 0) - travel(frame, 228, 271, 0, 105) : travel(frame, 228, 271, 105, 0);
            return <div key={item.id} style={{position: "absolute", inset: 0, transform: `translateX(${shift}%)`, padding: compact ? "24px 28px" : "32px 40px", display: "flex", flexDirection: "column", background: i === 1 ? "#f0eddf" : "#e6dfcb"}}>
              <div style={{display: "flex", justifyContent: "space-between", borderBottom: "1px solid #1a130627", paddingBottom: compact ? 15 : 22, fontSize: compact ? 20 : 24}}><strong style={{letterSpacing: "-.04em"}}>AAQ Gold</strong><span style={{fontFamily: "monospace", fontSize: compact ? 18 : 21}}>{capture.route}</span></div>
              {capture.media ? capture.media.type === "video" ? <div style={{flex: 1, minHeight: 0}}><Sequence from={Math.max(0, i * 120 - 12)} durationInFrames={144} layout="none"><Html5Video src={capture.media.src} muted playsInline style={{width: "100%", height: "100%", objectFit: "contain"}}/></Sequence></div> : <img src={capture.media.src} alt="" style={{width: "100%", height: "100%", objectFit: "contain"}}/> : <div style={{flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", gap: compact ? 14 : 20}}>
                <svg width={compact ? 40 : 52} height={compact ? 40 : 52} viewBox="0 0 40 40" fill="none" style={{color: "#a17a20"}}><rect x="4" y="8" width="32" height="24" rx="5" stroke="currentColor"/><path d="m17 14 9 6-9 6Z" stroke="currentColor"/></svg>
                <span style={{fontSize: compact ? 27 : 34, fontWeight: 600, letterSpacing: "-.035em"}}>{capture.title}</span>
                <p style={{fontSize: compact ? 20 : 24, lineHeight: 1.55, maxWidth: 660, margin: 0, color: "#4a3c24"}}>{capture.instruction}</p>
                <span style={{fontFamily: "monospace", fontSize: compact ? 16 : 18, color: "#6b5d46"}}>{capture.filename}</span>
              </div>}
            </div>;
          })}
        </div>
      </div>
      <div style={{height: 18, margin: "0 -36px", background: "linear-gradient(#c8c9be,#717669)", borderRadius: "2px 2px 50% 50% / 2px 2px 100% 100%", boxShadow: "0 20px 24px #0005", position: "relative"}}><div style={{position: "absolute", width: 150, height: 5, borderRadius: "0 0 12px 12px", background: "#72786b", left: "50%", transform: "translateX(-50%)"}}/></div>
    </div>
    <svg viewBox={`0 0 ${width} 70`} style={{position: "absolute", bottom: compact ? 48 : 24, width: "100%", height: 70}} fill="none">
      <path d={`M80 35H${width - 80}`} stroke="#e6dfcb24"/>
      <path d={`M80 35H${width - 80}`} stroke="#dcae3d" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - frame / (FRAMES - 1)}/>
      {beats.map((item, i) => <g key={item.id} transform={`translate(${80 + i * (width - 160) / 2},35)`}><circle r={i === beat ? 7 : 4} fill={i <= beat ? "#dcae3d" : "#565c48"}/><text y="30" textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"} fill={i === beat ? "#e6dfcb" : "#969b88"} fontSize={compact ? 19 : 18}>{item.word.replace(".", "")}</text></g>)}
    </svg>
  </AbsoluteFill>;
}

export function ScrollFilm({scroller}: {scroller: RefObject<HTMLDialogElement>}) {
  const section = useRef<HTMLElement>(null);
  const player = useRef<PlayerRef>(null);
  const velocityLayer = useRef<HTMLDivElement>(null);
  const trigger = useRef<ScrollTrigger | null>(null);
  const reduced = useReducedMotion();
  const [compact, setCompact] = useState(false);
  const [near, setNear] = useState(false);
  const [beat, setBeat] = useState(0);
  const currentBeat = useRef(0);
  useEffect(() => {
    const query = matchMedia("(max-width: 600px)");
    const resize = () => setCompact(query.matches);
    resize();query.addEventListener("change", resize);
    return () => query.removeEventListener("change", resize);
  }, []);
  useEffect(() => {
    if (!section.current) return;
    const observer = new IntersectionObserver(entries => {if (entries.some(entry => entry.isIntersecting)) {setNear(true);observer.disconnect();}}, {root: scroller.current, rootMargin: "600px"});
    observer.observe(section.current);
    return () => observer.disconnect();
  }, [scroller]);
  useLayoutEffect(() => {
    if (!near || !section.current || !scroller.current || reduced) return;
    let lastFrame = -1;
    const clock = {frame: 0};
    const context = gsap.context(() => {
      const lean = gsap.quickTo(velocityLayer.current, "rotationX", {duration: .8, ease: "power3.out"});
      const depth = gsap.quickTo(velocityLayer.current, "y", {duration: .8, ease: "power3.out"});
      const timeline = gsap.timeline({scrollTrigger: {trigger: section.current, scroller: scroller.current, start: "top 100px", end: "bottom bottom-=20px", scrub: .85, invalidateOnRefresh: true, onUpdate: self => {
        const velocity = gsap.utils.clamp(-1, 1, self.getVelocity() / 2400);
        lean(velocity * -.65);depth(velocity * -5);
      }, onScrubComplete: () => {lean(0);depth(0);}}});
      timeline.addLabel("discover", 0).addLabel("decide", .34).addLabel("manage", .68).to(clock, {frame: FRAMES - 1, duration: 1, ease: "none", onUpdate: () => {
        const frame = Math.round(clock.frame);
        if (frame !== lastFrame) {player.current?.seekTo(frame);lastFrame = frame;}
        const next = frame < 124 ? 0 : frame < 244 ? 1 : 2;
        if (next !== currentBeat.current) {currentBeat.current = next;setBeat(next);}
      }}, 0);
      trigger.current = timeline.scrollTrigger ?? null;
    }, section);
    let alive = true;
    document.fonts.ready.then(() => {if (alive) ScrollTrigger.refresh();});
    const observer = new ResizeObserver(() => trigger.current?.refresh());
    observer.observe(section.current);
    return () => {alive = false;observer.disconnect();context.revert();trigger.current = null;};
  }, [near, compact, reduced, scroller]);

  return <figure ref={section} className={`aaq-scroll-film ${reduced ? "is-static" : ""}`} aria-label="From storefront to customer account">
    <div className="aaq-film-sticky">
      <div className="aaq-film-topline"><span>One connected experience</span><span>{String(beat + 1).padStart(2, "0")} / 03</span></div>
      <div className="aaq-film-viewport" ref={velocityLayer} aria-hidden="true">
        {near && <Player ref={player} component={ProductFilm} inputProps={{compact}} durationInFrames={FRAMES} compositionWidth={compact ? 760 : 1200} compositionHeight={compact ? 900 : 860} fps={60} initialFrame={reduced ? 75 : 0} controls={false} autoPlay={false} clickToPlay={false} doubleClickToFullscreen={false} spaceKeyToPlayOrPause={false} style={{width: "100%", height: "100%"}}/>}
      </div>
      <div className="aaq-film-caption-row"><span className="aaq-film-caption" key={beat}>{beats[beat].detail}</span><span className="aaq-film-scroll-hint">{reduced ? "Product journey" : "Scroll to follow the journey"}<span aria-hidden="true">↓</span></span></div>
    </div>
    <figcaption className="aaq-visually-hidden">The journey connects the storefront, product selection and payment review, then the customer account. Device screens are capture placeholders. Full recording instructions follow in each chapter.</figcaption>
  </figure>;
}
