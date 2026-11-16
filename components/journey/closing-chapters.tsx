"use client";

import { useEffect, useRef, useState } from "react";
import { IconArrowUpRight } from "@tabler/icons-react";
import { CONTACT_EMAIL, ENGAGEMENTS, FAQ } from "./data";
import ContactForm from "./contact-form";
import MethodScene from "./method-scene";
import PlanLink from "./plan-link";
import { createSpring, SPRING_PEAK } from "./motion-curve";
import { createStagedMotion, BEFORE } from "./staged-motion";
import { addJob, createCapsule, stageOnEnter, wake } from "./spring-ticker";
import { Rise, Words, pop } from "./staged-words";
import { play } from "./sfx";
import "./closing-chapters.css";

/* ---------------------------------------------------------------------------
   The closing chapters carry on the line between you and Mahan.

   What are you building?  one glass object becomes the scope you pick:
                           a stack of screens, a single page, or an orbit.
   Before we start.        a conversation: your question, Mahan typing,
                           and the answer swelling out of the bubble.
   Contact                 you write the first message; it travels down
                           the line to Mahan.

   Every shape change is one set of springs on the shared curve, so the
   overshoot is inside the morph. One sound at each catch. Nothing fades.
   ------------------------------------------------------------------------- */

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
/** Deepens only the part of a spring past its target, so the catch reads as a pop. */
const popped = (v: number, k: number) => (v > 1 ? 1 + (v - 1) * k : v);
const stagedIn = (root: HTMLElement, exclude?: string) =>
  Array.from(root.querySelectorAll<HTMLElement>("[data-beat]")).filter(n => !exclude || !n.closest(exclude));
const entrySound = () => { if (!document.hidden) play("ui_pop", 0.2 + SPRING_PEAK); };
/** True once the section's top passes `at` of the viewport; false again only when it is fully below. */
const entering = (el: HTMLElement, was: boolean, at = 0.7) => {
  const top = el.getBoundingClientRect().top;
  return top < innerHeight * at ? true : top > innerHeight ? false : was;
};

/* ======================================================================
   What are you building? One sculpted object, three forms.
   ====================================================================== */
const SLABS = 4;
type Pose = { x: number; y: number; z: number; ry: number; s: number; sy: number };

function Pricing() {
  const root = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState(0);
  const api = useRef<(i: number) => void>();

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const world = el.querySelector<HTMLElement>(".jp-world")!;
    const slabs = Array.from(el.querySelectorAll<HTMLElement>(".jp-slab"));
    const options = Array.from(el.querySelectorAll<HTMLElement>(".jp-option"));
    const capsule = createCapsule(el.querySelector<HTMLElement>(".jp-capsule")!, el.querySelector<HTMLElement>(".jp-options")!);
    const leave = stageOnEnter(el, stagedIn(el, ".jp-lines"), { onEnter: entrySound });
    const lines = createStagedMotion(stagedIn(el.querySelector<HTMLElement>(".jp-lines")!), { lag: 0.18 });
    const springs = slabs.map(() => ({ x: createSpring(0), y: createSpring(0), z: createSpring(0), ry: createSpring(0), s: createSpring(0), sy: createSpring(1) }));
    const slabScope: string[] = slabs.map(() => ENGAGEMENTS[0].id);
    let picked = 0, entered = false, changedAt = 0, clock = 0, orbit = 0;

    /** Slab 0 is the base of the tower, slab 3 its navy crown. */
    const pose = (scope: string, i: number, w: number): Pose => {
      const h = w * 0.13, step = h + w * 0.07;
      if (scope === "product") return { x: 0, y: (1.5 - i) * step, z: 0, ry: (i - 1.5) * 9, s: 1, sy: 1 };
      // One solid block: the crown grows tall and the lower slabs fold up inside it.
      if (scope === "launch") return { x: 0, y: 0, z: 0, ry: 0, s: i === SLABS - 1 ? 1.12 : 0.4, sy: i === SLABS - 1 ? 3.6 : 1 };
      const a = orbit + (i * Math.PI * 2) / SLABS;
      return { x: Math.sin(a) * w * 0.84, y: 0, z: Math.cos(a) * w * 0.84, ry: (a * 180) / Math.PI, s: 0.66, sy: 1 };
    };

    const stop = addJob(dt => {
      clock += dt;
      const now = entering(el, entered);
      if (now !== entered) { entered = now; capsule.to(entered ? options[picked] : null); changedAt = clock; }
      const still = reduced();
      let moving = lines.update(entered ? picked : BEFORE, dt, still);
      const scope = ENGAGEMENTS[picked].id;
      if (scope === "partner" && !still) { orbit += dt * 0.38; moving = true; }
      const w = parseFloat(getComputedStyle(world).getPropertyValue("--sw")) || 220;
      slabs.forEach((slab, i) => {
        const sp = springs[i];
        // The crown moves first and the base last, so every change reads as a cascade.
        if (clock - changedAt >= (SLABS - 1 - i) * 0.07) slabScope[i] = scope;
        const goal = entered ? pose(slabScope[i], i, w) : { x: 0, y: w * 0.3, z: 0, ry: -30, s: 0, sy: 1 };
        for (const key of ["x", "y", "z", "ry", "s", "sy"] as const) {
          if (still) sp[key].snap(goal[key]); else moving = sp[key].step(goal[key], dt) || moving;
        }
        // Folded slabs sit inside the crown: hide them once they are small enough to be enclosed.
        const hidden = slabScope[i] === "launch" && i !== SLABS - 1 && Math.abs(sp.y.value) < 1 && sp.s.value < 0.42;
        const s = goal.s > 0 ? Math.max(0, popped(sp.s.value / goal.s, 3) * goal.s) : Math.max(0, sp.s.value);
        slab.style.transform = `translate3d(${sp.x.value.toFixed(2)}px,${sp.y.value.toFixed(2)}px,${sp.z.value.toFixed(2)}px) rotateY(${sp.ry.value.toFixed(3)}deg) scale3d(${s.toFixed(4)},${(s * Math.max(0.05, sp.sy.value)).toFixed(4)},${s.toFixed(4)})`;
        slab.style.visibility = hidden || s < 0.002 ? "hidden" : "visible";
      });
      world.dataset.scope = scope;
      return moving;
    });

    api.current = (i: number) => {
      if (i === picked) return;
      picked = i; changedAt = clock;
      capsule.to(options[i]);
      if (!reduced() && !document.hidden) play("ui_pop", 0.1 + SPRING_PEAK);
      wake();
    };
    return () => { leave(); stop(); capsule.dispose(); lines.dispose(); };
  }, []);

  const choose = (i: number) => { setSelected(i); api.current?.(i); };

  return (
    <section id="pricing" ref={root} className="jny-closing jc-pricing" aria-labelledby="jc-pricing-title">
      <div className="jc-wrap jp-layout">
        <div className="jp-side">
          <h2 id="jc-pricing-title" className="jc-h2"><Words text="What are you" beat={0} step={60} /><br /><span className="jc-dim"><Words text="building?" beat={0} start={180} /></span></h2>
          <div className="jp-options" role="group" aria-label="Project scope">
            <span className="jp-capsule" aria-hidden="true" />
            {ENGAGEMENTS.map((item, i) => (
              <span className="jc-pop jp-pop" key={item.id} {...pop(0, 420 + i * 100)}>
                <button type="button" className="jp-option" data-sfx="data" aria-pressed={i === selected} onClick={() => choose(i)}>
                  <span>{item.name}</span>
                  <span className="jp-option-dot" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
          <div className="jp-lines" aria-live="polite">
            {ENGAGEMENTS.map((item, i) => (
              <div className="jp-line" key={item.id} aria-hidden={i !== selected}>
                <p><Rise beat={i} until={i}>{item.shape}</Rise></p>
                <span className="jc-pop jp-go" {...pop(i, 260, i)}><PlanLink plan={item.id}>Discuss this project</PlanLink></span>
              </div>
            ))}
          </div>
        </div>

        <div className="jp-scene" aria-hidden="true">
          <span className="jp-floor" />
          <div className="jp-world">
            <span className="jp-orbit" />
            {Array.from({ length: SLABS }, (_, i) => (
              <span className="jp-slab" key={i} data-i={i}>
                <i className="jp-f jp-top" /><i className="jp-f jp-front" /><i className="jp-f jp-back" /><i className="jp-f jp-right" /><i className="jp-f jp-left" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ======================================================================
   Before we start: ask, Mahan types, the answer swells open
   ====================================================================== */
const TYPING = 0.85;

function Questions() {
  const root = useRef<HTMLElement>(null);
  const [asked, setAsked] = useState<number[]>([]);
  const [current, setCurrent] = useState(0);
  const api = useRef<(i: number) => void>();

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const you = el.querySelector<HTMLElement>(".jq-you")!, youBody = el.querySelector<HTMLElement>(".jq-you-body")!;
    const reply = el.querySelector<HTMLElement>(".jq-reply")!, replyBody = el.querySelector<HTMLElement>(".jq-reply-body")!;
    const qPages = Array.from(el.querySelectorAll<HTMLElement>(".jq-you-page"));
    const aPages = Array.from(el.querySelectorAll<HTMLElement>(".jq-reply-page"));
    const leave = stageOnEnter(el, stagedIn(el, ".jq-thread"), { onEnter: entrySound });
    const qMotion = createStagedMotion(stagedIn(you), { lag: 0.1 });
    const aMotion = createStagedMotion(stagedIn(reply), { lag: 0.1 });
    const yw = createSpring(0), yh = createSpring(0), ys = createSpring(0);
    const rw = createSpring(0), rh = createSpring(0), rs = createSpring(0), dots = createSpring(0);
    let now = 0, entered = false, since = 0, caught = false;

    const stop = addJob(dt => {
      const was = entered;
      entered = entering(el, entered, 0.62);
      if (entered && !was) { since = 0; caught = false; }
      since += dt;
      const still = reduced();
      const typing = entered && since < (still ? 0 : TYPING);
      if (entered && !typing && !caught) { caught = true; if (!still && !document.hidden) play("ui_pop", SPRING_PEAK); }

      let moving = qMotion.update(entered ? now : BEFORE, dt, still);
      moving = aMotion.update(entered && !typing ? now : BEFORE, dt, still) || moving;

      // Your bubble takes the width and height of the question it carries.
      const q = qPages[now], a = aPages[now];
      const full = reply.clientWidth;
      aPages.forEach(page => { if (page.style.width !== `${full}px`) page.style.width = `${full}px`; });
      const goals: [ReturnType<typeof createSpring>, number][] = [
        [yw, q.offsetWidth], [yh, q.offsetHeight], [ys, entered ? 1 : 0],
        // Mahan's bubble is a small capsule of dots while typing, then swells to the answer.
        [rw, typing ? 74 : reply.clientWidth], [rh, typing ? 46 : a.offsetHeight], [rs, entered ? 1 : 0], [dots, typing ? 1 : 0],
      ];
      for (const [spring, goal] of goals) { if (still) spring.snap(goal); else moving = spring.step(goal, dt) || moving; }
      youBody.style.width = `${Math.max(0, yw.value).toFixed(1)}px`;
      youBody.style.height = `${Math.max(0, yh.value).toFixed(1)}px`;
      youBody.style.transform = `scale(${Math.max(0, popped(ys.value, 2.5)).toFixed(4)})`;
      replyBody.style.width = `${Math.max(0, rw.value).toFixed(1)}px`;
      replyBody.style.height = `${Math.max(0, rh.value).toFixed(1)}px`;
      replyBody.style.transform = `scale(${Math.max(0, popped(rs.value, 2.5)).toFixed(4)})`;
      replyBody.style.setProperty("--t", clamp(dots.value, 0, 1.2).toFixed(4));
      return moving || typing;
    });

    api.current = (i: number) => {
      if (i === now && since > TYPING) return;
      now = i; since = 0; caught = false;
      wake();
    };
    return () => { leave(); stop(); qMotion.dispose(); aMotion.dispose(); };
  }, []);

  const ask = (i: number) => {
    setCurrent(i);
    setAsked(list => (list.includes(i) ? list : [...list, i]));
    api.current?.(i);
  };

  return (
    <section id="faq" ref={root} className="jny-closing jc-faq" aria-labelledby="jc-faq-title">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      }) }} />
      <div className="jc-wrap jq-layout">
        <div className="jq-side">
          <h2 id="jc-faq-title" className="jc-h2"><Words text="Before" beat={0} /><br /><span className="jc-dim"><Words text="we start." beat={0} start={120} /></span></h2>
          <div className="jq-asks" role="group" aria-label="Questions">
            {FAQ.map(({ q }, i) => (
              <span className="jc-pop" key={q} {...pop(0, 360 + i * 70)}>
                <button type="button" className="jq-ask" data-sfx="data" aria-pressed={i === current} data-asked={asked.includes(i)} aria-controls="jq-thread" onClick={() => ask(i)}>{q}</button>
              </span>
            ))}
          </div>
        </div>

        <div className="jq-thread" id="jq-thread" aria-live="polite">
          <div className="jq-row jq-row-you">
            <div className="jq-you">
              <div className="jq-you-body">
                {FAQ.map(({ q }, i) => (
                  <p className="jq-you-page" key={q} aria-hidden={i !== current}><Words text={q} beat={i} until={i} step={30} /></p>
                ))}
              </div>
            </div>
            <span className="jq-face jq-face-you" aria-hidden="true">You</span>
          </div>
          <div className="jq-row jq-row-mahan">
            <span className="jq-face jq-face-mahan" aria-hidden="true">M</span>
            <div className="jq-reply">
              <div className="jq-reply-body">
                <span className="jq-dots" aria-hidden="true"><i /><i /><i /></span>
                {FAQ.map(({ a }, i) => (
                  <p className="jq-reply-page" key={i} aria-hidden={i !== current}><Rise beat={i} until={i}>{a}</Rise></p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ======================================================================
   Contact: night, and the first message
   ====================================================================== */
function Contact() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    return stageOnEnter(el, stagedIn(el, ".jk-shell"), { at: 0.62, onEnter: entrySound });
  }, []);
  return (
    <section id="contact" ref={root} className="jny-closing jny-dark jc-contact" aria-labelledby="jc-contact-title">
      <div className="jc-wrap jk-layout">
        <div className="jk-head">
          <h2 id="jc-contact-title" className="jc-h2"><Words text="Say" beat={0} /><br /><span className="jc-dim"><Words text="hello." beat={0} start={120} /></span></h2>
          <span className="jc-pop jk-mail" {...pop(0, 420)}>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}<IconArrowUpRight size={17} stroke={1.6} aria-hidden /></a>
          </span>
        </div>
        <div className="jk-form" data-beat="0" data-delay="380"><ContactForm /></div>
      </div>
    </section>
  );
}

export function ClosingChapters() {
  return (
    <div className="jny-chapters">
      <MethodScene />
      <Pricing />
      <Questions />
      <Contact />
    </div>
  );
}
