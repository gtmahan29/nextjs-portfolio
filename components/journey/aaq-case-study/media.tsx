"use client";

import {useState, type RefObject} from "react";
import {Camera, Video, ArrowUpRight, Copy, Check} from "lucide-react";
import {motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform} from "framer-motion";
import {useRef} from "react";
import {AAQ_CAPTURES, type CaptureId} from "./data";
import {DeviceScreen} from "../case-device";

export function CaptureSlot({id, className = ""}: {id: CaptureId; className?: string}) {
  const capture = AAQ_CAPTURES[id];
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const Icon = capture.kind === "video" ? Video : Camera;
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${capture.title}\nPage: ${capture.route}\n${capture.instruction}\n${capture.format}\nSave as: ${capture.filename}`);
      setCopied(true);
    } catch {setCopyFailed(true);}
  }
  return <div className={`aaq-capture ${capture.media ? "has-media" : ""} ${className}`}>
    {capture.media ? <DeviceScreen media={capture.media}/> : <>
      <div className="aaq-capture-top"><span><Icon size={14} strokeWidth={1.4}/>{capture.kind === "video" ? "Screen recording" : "Screenshot"} needed</span><code>{capture.route}</code></div>
      <div className="aaq-capture-body"><div className="aaq-capture-mark" aria-hidden="true"><Icon size={27} strokeWidth={1}/></div><h3>{capture.title}</h3><p>{capture.instruction}</p><span className="aaq-capture-format">{capture.format}</span></div>
      <div className="aaq-capture-bottom"><span>Save as <code>{capture.filename}</code></span><button onClick={copy} aria-label={`Copy capture brief: ${capture.title}`}>{copied ? <Check size={13}/> : <Copy size={13}/>}<span>{copied ? "Copied" : copyFailed ? "Select text above" : "Copy brief"}</span></button></div>
    </>}
  </div>;
}

/** One perspective, with restrained pointer depth. No permanent animation loop. */
export function TiltCapture({id}: {id: CaptureId}) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0), y = useMotionValue(0);
  const rotateX = useSpring(x, {stiffness: 150, damping: 28});
  const rotateY = useSpring(y, {stiffness: 150, damping: 28});
  return <div className="aaq-tilt-root" onPointerMove={event => {
    if (reduced || event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set(-((event.clientY - rect.top) / rect.height - .5) * 3);
    y.set(((event.clientX - rect.left) / rect.width - .5) * 4);
  }} onPointerLeave={() => {x.set(0);y.set(0);}}><motion.div style={reduced ? undefined : {rotateX, rotateY}}><CaptureSlot id={id}/></motion.div></div>;
}

export function ScrollCapture({scroller}: {scroller: RefObject<HTMLDialogElement>}) {
  const section = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const {scrollYProgress} = useScroll({container: scroller, target: section, offset: ["start end", "center center"]});
  const smooth = useSpring(scrollYProgress, {stiffness: 100, damping: 30});
  const scale = useTransform(smooth, [0, 1], [.91, 1]);
  const rotateX = useTransform(smooth, [0, 1], [7, 0]);
  return <figure ref={section} className="aaq-scroll-capture"><motion.div style={reduced ? undefined : {scale, rotateX}}><CaptureSlot id="storefront"/></motion.div><figcaption>The storefront in motion. <span>Opening scene → product discovery</span></figcaption></figure>;
}

export function CaptureLink({route}: {route: string}) {
  return <a className="aaq-text-link" href={`https://aaq-gold-reserve.vercel.app${route}`} target="_blank" rel="noopener noreferrer">Open {route}<ArrowUpRight size={13}/></a>;
}
