"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createSpring, SPRING_PEAK } from "@/components/journey/motion-curve";
import { createStagedMotion, BEFORE } from "@/components/journey/staged-motion";
import { createCapsule } from "@/components/journey/spring-ticker";
import { Rise, Words, pop } from "@/components/journey/staged-words";
import { smoothScrollTo } from "@/components/smooth-scroll";
import { play } from "@/components/journey/sfx";
import { CHAPTERS } from "./content";
import { FIGURES, STEP_S } from "./skill-figures";
import "./skill-chapters.css";

gsap.registerPlugin(ScrollTrigger);

/*
  What I work with: the CV's skills as seven chapters on one pinned, light stage. Each chapter
  shows a few accurate pieces of real interface (skill-figures.tsx) in three panels. The panels
  are the same three surfaces all the way through: between chapters they morph from one
  layout into the next while their contents swap, and the wires between them are measured
  from the real elements every frame, so they always land exactly on their ports.

MOTION SCORE — skill chapters
Trigger: scroll-pinned beats (GSAP ScrollTrigger reads the progress; it only picks the beat).
Section height: 100svh + 6 × 80svh. Beats: chapter k from progress k / 7.

| Beat | Element             | Pattern | Goal                                          | Delay (s)            | Exit       | Sound             |
|------|---------------------|---------|-----------------------------------------------|----------------------|------------|-------------------|
| k    | chapter title words | P1      | rise                                          | lag .2, +.06/word    | until k    | ui_pop @ .22+PEAK |
| k    | chapter line        | P2      | rise                                          | .3                   | until k    | –                 |
| k    | skill chips         | P3      | pop                                           | .45 + .045 each      | until k    | –                 |
| k    | "where" line        | P2      | rise                                          | .62                  | until k    | –                 |
| k    | the three panels    | P5b     | frames morph to chapter k's layout; x, y,     | .22 + .08 per panel  | morph      | –                 |
|      |                     |         | width and height on one spring each, so the   |                      |            |                   |
|      |                     |         | overshoot stretches a frame before it settles |                      |            |                   |
| k    | panel contents      | P4      | rise into the panel out of its clip           | 0, .14, .24          | up, until k| –                 |
| k    | wires               | P11     | draw from port to port, a bead travelling     | .45 + .15 each       | retract    | –                 |
| k    | live state          | P16     | steps every .62 s (checks tick, rows light,   | from 1.0             | –          | –                 |
|      |                     |         | a pod joins) on CSS transitions of the curve  |                      |            |                   |
| k    | rail capsule        | P6      | travels to chapter k                          | 0                    | –          | –                 |
| k    | stage tint          | –       | moves toward the chapter's hue                | 0 (state colour)     | –          | –                 |
Reduced motion: frames, copy and wires snap; every chapter shows its finished state.
Phone: the figure sits above the copy; the rail scrolls sideways; same beats.
*/

const TINT = ["#eef1f6", "#edf0fb", "#f1eefa", "#ebf4f3", "#f7f3e9", "#ecf5ef", "#f6eef2"];
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const popped = (v: number, k: number) => (v > 1 ? 1 + (v - 1) * k : v);
type Box = { l: number; t: number; r: number; b: number; cx: number; cy: number };

export default function SkillChapters() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const stage = el.querySelector<HTMLElement>(".sc-stage")!;
    const fig = el.querySelector<HTMLElement>(".sc-fig")!;
    const panels = Array.from(el.querySelectorAll<HTMLElement>(".sc-panel"));
    const tabs = Array.from(el.querySelectorAll<HTMLElement>(".sc-tab"));
    const paths = Array.from(el.querySelectorAll<SVGPathElement>(".sc-wire"));
    const beads = Array.from(el.querySelectorAll<SVGCircleElement>(".sc-bead"));
    const ports = Array.from(el.querySelectorAll<SVGCircleElement>(".sc-port"));
    const motion = createStagedMotion(Array.from(el.querySelectorAll<HTMLElement>("[data-beat]")), { lag: 0.2 });
    const capsule = createCapsule(el.querySelector<HTMLElement>(".sc-capsule")!, el.querySelector<HTMLElement>(".sc-rail")!);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const K = CHAPTERS.length;

    const frames = panels.map(() => ({ x: createSpring(0), y: createSpring(0), w: createSpring(0), h: createSpring(0), s: createSpring(0), placed: false }));
    const wires = paths.map(() => ({ p: createSpring(0), ids: null as [string, string] | null }));
    let progress = 0, beat = BEFORE, changedAt = 0, clock = 0, W = 600, H = 540, lastStep = "";
    let raf = 0, last = 0, visible = false;

    // GSAP owns the scroll reading: the trigger reports where in the pinned stretch we are.
    const st = ScrollTrigger.create({
      trigger: el, start: "top top", end: "bottom bottom",
      onUpdate: self => { progress = self.progress; wakeUp(); },
      onRefresh: self => { progress = self.progress; },
    });

    const measure = () => { W = fig.clientWidth; H = fig.clientHeight; };
    /**
     * Where a wire attaches: the edges of the panel the element sits in, at the element's own
     * height (or across, at its own x), so ports sit exactly on the card's edge, level with
     * the thing they belong to.
     */
    const box = (node: Element): Box => {
      const f = fig.getBoundingClientRect(), r = node.getBoundingClientRect();
      const p = (node.closest(".sc-panel") ?? node).getBoundingClientRect();
      return { l: p.left - f.left, t: p.top - f.top, r: p.right - f.left, b: p.bottom - f.top, cx: (r.left + r.right) / 2 - f.left, cy: (r.top + r.bottom) / 2 - f.top };
    };
    /** A wire from one element's edge to another's, leaving and arriving square to the edges. */
    const route = (a: Box, b: Box) => {
      const dx = b.cx - a.cx, dy = b.cy - a.cy;
      const f = (n: number) => n.toFixed(1);
      // Leave through the sides that face each other across the larger clear gap.
      const gapX = Math.max(b.l - a.r, a.l - b.r), gapY = Math.max(b.t - a.b, a.t - b.b);
      if (gapX >= gapY) {
        const x1 = dx > 0 ? a.r : a.l, x2 = dx > 0 ? b.l : b.r, y1 = a.cy, y2 = b.cy;
        const c = Math.max(24, Math.abs(x2 - x1) * 0.5) * Math.sign(dx);
        return { d: `M${f(x1)} ${f(y1)} C${f(x1 + c)} ${f(y1)} ${f(x2 - c)} ${f(y2)} ${f(x2)} ${f(y2)}`, a: [x1, y1], b: [x2, y2] };
      }
      const y1 = dy > 0 ? a.b : a.t, y2 = dy > 0 ? b.t : b.b, x1 = a.cx, x2 = b.cx;
      const c = Math.max(24, Math.abs(y2 - y1) * 0.5) * Math.sign(dy);
      return { d: `M${f(x1)} ${f(y1)} C${f(x1)} ${f(y1 + c)} ${f(x2)} ${f(y2 - c)} ${f(x2)} ${f(y2)}`, a: [x1, y1], b: [x2, y2] };
    };

    /** Writes the live state of the active chapter's panels: step, hot item, run parity, data-on. */
    const setState = (k: number, local: number, still: boolean) => {
      const f = FIGURES[k];
      const n = Math.max(0, Math.floor(local / STEP_S));
      const step = still ? f.cycle - 1 : local < 0 ? -1 : n % f.cycle;
      const hot = still ? 0 : n % f.mod;
      const odd = !still && Math.floor(n / f.cycle) % 2 === 1;
      const key = `${k}|${step}|${hot}|${odd}`;
      if (key === lastStep) return;
      lastStep = key;
      el.querySelectorAll<HTMLElement>(`.sf-in[data-beat="${k}"]`).forEach(node => {
        node.dataset.step = String(step);
        node.dataset.hot = String(hot);
        if (odd) node.dataset.odd = ""; else delete node.dataset.odd;
        node.querySelectorAll<HTMLElement>("[data-at]").forEach(c => {
          const on = step >= Number(c.dataset.at);
          if (on !== c.hasAttribute("data-on")) { if (on) c.dataset.on = ""; else delete c.dataset.on; }
        });
      });
    };

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.25, (now - last) / 1000) : 0;
      last = now; clock += dt;
      const still = reduce.matches;
      const top = el.getBoundingClientRect().top;
      const next = top > innerHeight * 0.5 ? BEFORE : Math.min(K - 1, Math.floor(progress * K + 1e-4));
      if (next !== beat) {
        const forward = next > beat;
        beat = next; changedAt = clock; lastStep = "";
        el.dataset.chapter = String(beat);
        stage.style.backgroundColor = TINT[Math.max(0, beat)];
        capsule.to(beat === BEFORE ? null : tabs[beat]);
        tabs.forEach((t, i) => t.setAttribute("aria-current", String(i === beat)));
        if (forward && beat !== BEFORE && !still && !document.hidden) play("ui_pop", 0.22 + SPRING_PEAK);
      }
      motion.update(beat, dt, still);
      const since = clock - changedAt;

      // Frames: each panel morphs to this chapter's rectangle, a little after the one before.
      const fg = beat === BEFORE ? null : FIGURES[beat];
      frames.forEach((fr, i) => {
        const node = panels[i];
        if (fg && (still || since >= 0.22 + i * 0.08)) {
          const [x, y, w, h] = fg.rects[i];
          if (!fr.placed) { fr.x.snap(x); fr.y.snap(y); fr.w.snap(w); fr.h.snap(h); fr.placed = true; }
          const goals: [ReturnType<typeof createSpring>, number][] = [[fr.x, x], [fr.y, y], [fr.w, w], [fr.h, h], [fr.s, 1]];
          goals.forEach(([s, g]) => { if (still) s.snap(g); else s.step(g, dt); });
        } else if (!fg) { if (still) fr.s.snap(0); else fr.s.step(0, dt); }
        const pw = Math.max(0, fr.w.value) * W, ph = Math.max(0, fr.h.value) * H;
        node.style.width = `${pw.toFixed(1)}px`;
        node.style.height = `${ph.toFixed(1)}px`;
        node.style.transform = `translate3d(${(fr.x.value * W).toFixed(1)}px, ${(fr.y.value * H).toFixed(1)}px, 0) scale(${Math.max(0, popped(fr.s.value, 2.5)).toFixed(4)})`;
        node.style.visibility = fr.s.value < 0.003 ? "hidden" : "visible";
      });

      // Live state starts once the contents have risen in.
      if (beat !== BEFORE) setState(beat, since - 1.0, still);

      // Wires: retract the old chapter's, then draw this chapter's from port to port.
      const want = fg?.wires ?? [];
      wires.forEach((w, i) => {
        const ids = want[i] ?? null;
        const same = !!ids && !!w.ids && ids[0] === w.ids[0] && ids[1] === w.ids[1];
        if (!same && w.ids && w.p.value > 0.02 && !still) w.p.step(0, dt * 1.6);
        else {
          if (!same) { w.ids = ids; w.p.snap(0); }
          const goal = ids && (still || since >= 0.45 + i * 0.15) ? 1 : 0;
          if (still) w.p.snap(goal); else w.p.step(goal, dt);
        }
        const path = paths[i], bead = beads[i];
        const a = w.ids ? el.querySelector(`[data-a="${w.ids[0]}"]`) : null;
        const b = w.ids ? el.querySelector(`[data-a="${w.ids[1]}"]`) : null;
        const pv = clamp(w.p.value);
        if (!a || !b || pv < 0.002) {
          path.setAttribute("d", "M0 0"); bead.setAttribute("r", "0");
          ports[i * 2].setAttribute("r", "0"); ports[i * 2 + 1].setAttribute("r", "0");
          return;
        }
        const r = route(box(a), box(b));
        path.setAttribute("d", r.d);
        const len = path.getTotalLength();
        path.style.strokeDasharray = `${len.toFixed(1)} ${len.toFixed(1)}`;
        path.style.strokeDashoffset = (len * (1 - pv)).toFixed(1);
        ports[i * 2].setAttribute("cx", r.a[0].toFixed(1)); ports[i * 2].setAttribute("cy", r.a[1].toFixed(1));
        ports[i * 2].setAttribute("r", (3.5 * clamp(pv * 4)).toFixed(2));
        ports[i * 2 + 1].setAttribute("cx", r.b[0].toFixed(1)); ports[i * 2 + 1].setAttribute("cy", r.b[1].toFixed(1));
        ports[i * 2 + 1].setAttribute("r", (3.5 * clamp((pv - 0.9) * 10)).toFixed(2));
        // A bead rides the finished wire: the request, the data, the deploy, travelling.
        const u = still ? 0.5 : (clock * 0.42 + i * 0.5) % 1;
        const pt = path.getPointAtLength(len * u);
        bead.setAttribute("cx", pt.x.toFixed(1)); bead.setAttribute("cy", pt.y.toFixed(1));
        bead.setAttribute("r", pv > 0.98 ? "4.5" : "0");
      });

      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const wakeUp = () => { if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; wakeUp(); }, { rootMargin: "20% 0px" });
    io.observe(el);
    const ro = new ResizeObserver(() => { measure(); wakeUp(); });
    ro.observe(fig);
    measure();
    const onVis = () => wakeUp();
    document.addEventListener("visibilitychange", onVis);

    // The rail jumps to the middle of a chapter's stretch.
    const onTab = (e: Event) => {
      const i = tabs.indexOf(e.currentTarget as HTMLElement);
      smoothScrollTo(st.start + (st.end - st.start) * ((i + 0.5) / K));
    };
    tabs.forEach(t => t.addEventListener("click", onTab));

    return () => {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); st.kill();
      document.removeEventListener("visibilitychange", onVis);
      tabs.forEach(t => t.removeEventListener("click", onTab));
      motion.dispose(); capsule.dispose();
    };
  }, []);

  return (
    <section ref={root} className="sc" id="skills" aria-labelledby="sc-0" style={{ "--k": CHAPTERS.length } as CSSProperties}>
      <div className="sc-stage">
        <div className="ab-wrap sc-grid">
          <div className="sc-copy">
            {CHAPTERS.map((c, k) => {
              const Heading = k === 0 ? "h2" : "h3";
              return (
                <article key={c.id} className="sc-page" style={{ "--c": c.tone } as CSSProperties}>
                  <Heading id={`sc-${k}`} className="sc-title" aria-label={c.title}>
                    <span aria-hidden="true"><Words text={c.title} beat={k} until={k} step={60} /></span>
                  </Heading>
                  <p className="sc-line"><Rise beat={k} until={k} start={300}>{c.line}</Rise></p>
                  <ul className="sc-chips" aria-label={`${c.label} skills`}>
                    {c.skills.map((s, i) => <li key={s} className="ab-pop" {...pop(k, 450 + i * 45, k)}>{s}</li>)}
                  </ul>
                  {c.where && <p className="sc-where"><Rise beat={k} until={k} start={620}><i />{c.where}</Rise></p>}
                </article>
              );
            })}
          </div>
          <div className="sc-fig" aria-hidden="true">
            <svg className="sc-wires">
              {[0, 1].map(i => <path key={i} className="sc-wire" d="M0 0" />)}
              {[0, 1, 2, 3].map(i => <circle key={i} className="sc-port" r="0" />)}
              {[0, 1].map(i => <circle key={i} className="sc-bead" r="0" />)}
            </svg>
            {[0, 1, 2].map(slot => (
              <div key={slot} className="sc-panel" data-slot={slot}>
                {FIGURES.map((f, k) => <div key={k} className="sc-slot" data-k={k}>{f.panels[slot]}</div>)}
              </div>
            ))}
          </div>
        </div>
        <div className="sc-rail" role="tablist" aria-label="Chapters">
          <span className="sc-capsule" aria-hidden="true" />
          {CHAPTERS.map(c => (
            <button key={c.id} type="button" className="sc-tab" aria-current="false" data-sfx="data" style={{ "--c": c.tone } as CSSProperties}>
              <i />{c.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
