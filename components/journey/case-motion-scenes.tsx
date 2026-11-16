"use client";

import {useRef, type RefObject} from "react";
import {motion, useReducedMotion, useScroll, useSpring, useTransform} from "framer-motion";
import {ArrowDown, ArrowUpRight, Menu} from "lucide-react";
import type {CaseProject} from "./project-case-data";
import {DeviceMockup, type CaseMedia} from "./case-device";

type SceneProps = {project: CaseProject; scroller: RefObject<HTMLDialogElement>};

export function projectScreen(project: CaseProject, slot: "desktop" | "tablet" | "phone" = "desktop"): CaseMedia {
  return project.media?.[slot] ?? project.media?.desktop ?? {type: "image", src: project.src, alt: project.alt};
}

function useScene(scroller: RefObject<HTMLDialogElement>) {
  const target = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const {scrollYProgress} = useScroll({container: scroller, target, offset: ["start start", "end end"]});
  const progress = useSpring(scrollYProgress, {stiffness: 110, damping: 30, restDelta: .0001});
  return {target, progress, reduced};
}

/** A full-bleed interface retreats into a machined laptop as its lid settles open. */
export function LaptopReveal({project, scroller}: SceneProps) {
  const {target, progress, reduced} = useScene(scroller);
  const scale = useTransform(progress, [0, .75, 1], [1.48, .79, .76]);
  const rotateX = useTransform(progress, [0, .6, 1], [18, 0, -3]);
  const lidRotation = useTransform(progress, [0, .65], [-24, 0]);
  const y = useTransform(progress, [0, 1], [60, 15]);
  const titleY = useTransform(progress, [0, .65], [0, -110]);
  const titleClip = useTransform(progress, [0, .3], ["inset(0% 0% 0% 0%)", "inset(0% 0% 100% 0%)"]);
  return <section ref={target} className="case-laptop-scene case-scroll-scene" aria-label="Scroll to reveal the laptop presentation">
    <div className="case-scene-sticky">
      <div className="case-stage-orbit" aria-hidden="true"/>
      <motion.div className="case-scene-heading" style={reduced ? undefined : {y: titleY, clipPath: titleClip}}><span>The experience</span><h2>A closer<br/><em>look.</em></h2></motion.div>
      <motion.div className="case-laptop-rig" style={reduced ? {scale: .8} : {scale, rotateX, y}}>
        <DeviceMockup media={projectScreen(project)} lidRotation={reduced ? 0 : lidRotation} priority/>
      </motion.div>
      <div className="case-scene-caption"><span>{project.title}</span><span>Scroll to explore <ArrowDown size={13}/></span></div>
    </div>
  </section>;
}

function MobilePlaceholder({project}: {project: CaseProject}) {
  const words = project.title.split(" ");
  return <div className="case-mobile-preview">
    <div className="mobile-preview-nav"><strong>{words[0]}</strong><Menu size={16}/></div>
    <div className="mobile-preview-copy"><span>{project.discipline}</span><h3>{project.intro}</h3><div className="mobile-preview-action">Explore <ArrowUpRight size={13}/></div></div>
    <div className="mobile-preview-image"><img src={project.src} alt="" loading="lazy"/></div>
    <div className="mobile-preview-bottom"><span>{project.title}</span><ArrowUpRight size={18}/></div>
  </div>;
}

/** Independently replaceable tablet/phone screens in a scroll-composed hardware spread. */
export function DeviceEnsemble({project, scroller}: SceneProps) {
  const {target, progress, reduced} = useScene(scroller);
  const tabletX = useTransform(progress, [0, .8], [22, -13]);
  const tabletY = useTransform(progress, [0, 1], [110, -35]);
  const tabletRotate = useTransform(progress, [0, 1], [-12, 3]);
  const tabletScale = useTransform(progress, [0, .8], [.8, 1]);
  const phoneX = useTransform(progress, [0, 1], [90, 0]);
  const phoneY = useTransform(progress, [0, 1], [180, -65]);
  const phoneRotate = useTransform(progress, [0, 1], [16, -5]);
  const wordX = useTransform(progress, [0, 1], [80, -100]);
  return <section ref={target} className="case-ensemble-scene case-scroll-scene" aria-label="Tablet and phone presentation">
    <div className="case-scene-sticky">
      <div className="case-ensemble-heading"><span className="case-section-label">The experience, in motion</span><h2>Considered.<br/><em>At every scale.</em></h2></div>
      <motion.span className="case-ensemble-word" style={reduced ? undefined : {x: wordX}} aria-hidden="true">{project.title.split(" ")[0]}</motion.span>
      <motion.div className="case-tablet-rig" style={reduced ? undefined : {x: tabletX, y: tabletY, rotate: tabletRotate, scale: tabletScale}}><DeviceMockup kind="tablet" media={projectScreen(project, "tablet")}/></motion.div>
      <motion.div className="case-phone-rig" style={reduced ? undefined : {x: phoneX, y: phoneY, rotate: phoneRotate}}><DeviceMockup kind="phone" media={project.media?.phone}>{!project.media?.phone && <MobilePlaceholder project={project}/>}</DeviceMockup></motion.div>
      <div className="case-scene-caption"><span>Desktop / Tablet / Mobile</span><span>{project.media?.phone ? "Interface presentation" : "Mobile layout exploration"}</span></div>
    </div>
  </section>;
}

export function DetailReveal({project, scroller}: SceneProps) {
  const target = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const {scrollYProgress} = useScroll({container: scroller, target, offset: ["start end", "end start"]});
  const y = useTransform(scrollYProgress, [0, 1], [75, -65]);
  return <section ref={target} className="case-detail-spread">
    <div className="case-detail-title"><span className="case-section-label">A closer look at the interface</span><h2>Room for<br/>the <em>details.</em></h2><p>{project.decisions[1].text}</p></div>
    <div className="case-detail-crop"><motion.div style={reduced ? undefined : {y}}><img src={project.src} alt={project.alt} loading="lazy"/></motion.div></div>
  </section>;
}
