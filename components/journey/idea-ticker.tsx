"use client";

import { useEffect, useRef } from "react";
import { createSpring } from "./motion-curve";
import { createStagedMotion } from "./staged-motion";
import { Words } from "./staged-words";
import { addJob, wake } from "./spring-ticker";

/**
 * "It starts with a conversation." — and here is one starting.
 *
 * A message bubble from "You" cycles through ideas people bring. Each new idea:
 * the old words leave upward (P1 exit), the bubble springs to the new message's
 * width (P9: its overshoot is the bubble's pop), the new words rise. No sound:
 * it is a loop, not an event. It has its own stage, so the intro skips its nodes.
 */
const IDEAS = [
  "A booking platform for my studio",
  "A store for handmade ceramics",
  "An internal tool for our team",
  "A mobile app for my clinic",
];
const HOLD = 2.8;

export default function IdeaTicker() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const body = el.querySelector<HTMLElement>(".jny-idea-body")!;
    const pages = Array.from(el.querySelectorAll<HTMLElement>(".jny-idea-page"));
    const words = createStagedMotion(Array.from(el.querySelectorAll<HTMLElement>("[data-beat]")), { lag: 0.18, initial: 0 });
    const w = createSpring(0), h = createSpring(0);
    const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
    let idea = 0, held = 0, visible = false, first = true;

    // Page sizes are measured once per idea (and on resize), never every frame: reading layout
    // each frame after writing the bubble's size forced a whole-page layout on every frame.
    let sizes: { w: number; h: number }[] = [];
    const measure = () => { sizes = pages.map(p => ({ w: p.offsetWidth, h: p.offsetHeight })); };
    let lastW = "", lastH = "";
    const stop = addJob(dt => {
      if (!visible) return false;
      if (!sizes.length) measure();
      const still = reduced();
      held += dt;
      if (!still && held > HOLD) { held = 0; idea = (idea + 1) % IDEAS.length; }
      let moving = words.update(idea, dt, still);
      const { w: gw, h: gh } = sizes[idea];
      if (first || still) { w.snap(gw); h.snap(gh); first = false; }
      else { moving = w.step(gw, dt) || moving; moving = h.step(gh, dt) || moving; }
      const sw = `${w.value.toFixed(1)}px`, sh = `${h.value.toFixed(1)}px`;
      if (sw !== lastW) { body.style.width = sw; lastW = sw; }
      if (sh !== lastH) { body.style.height = sh; lastH = sh; }
      return moving || !still;
    });
    const onResize = () => { sizes = []; wake(); };
    addEventListener("resize", onResize);
    document.fonts?.ready.then(onResize);
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); }, { threshold: 0.01 });
    io.observe(el);
    return () => { stop(); io.disconnect(); words.dispose(); removeEventListener("resize", onResize); };
  }, []);

  return (
    <div className="jny-idea" ref={root} data-own-stage="" aria-hidden="true">
      <span className="jny-idea-face">You</span>
      <div className="jny-idea-body">
        {IDEAS.map((idea, i) => (
          <p className="jny-idea-page" key={idea}><Words text={idea} beat={i} until={i} step={40} /></p>
        ))}
      </div>
    </div>
  );
}
