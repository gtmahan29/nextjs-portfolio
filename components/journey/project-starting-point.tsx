"use client";

import { CSSProperties, Fragment, ReactNode, useEffect, useRef } from "react";
import type { PlanId } from "./data";
import { createCameraProgress } from "./camera-motion";
import { springCurve } from "./motion-curve";
import { play } from "./sfx";
import { smoothScrollTo } from "../smooth-scroll";
import "./project-starting-point.css";

/* ---------------------------------------------------------------------------
   "Where should I start?" is a pinned scroll scene.
   One sculpture made of nine tiles carries the whole story:
     Idea   → a single glossy seed with two moons
     Launch → the seed presses into one launch tile
     Live   → the tile splits into a floating grid of working parts
   Every move is scrubbed by scroll on the shared spring, so it overshoots and
   settles. Nothing fades: things pop from a point, slide out of masks, or move.
   ------------------------------------------------------------------------- */

type Stage = { name: string; line: string; answer: string; plan: PlanId };
const STAGES: Stage[] = [
  {
    name: "Idea",
    line: "I have an idea.",
    answer: "We find the smallest version worth building. You leave with a written scope and a clickable prototype.",
    plan: "unsure",
  },
  {
    name: "Launch",
    line: "I’m preparing to launch.",
    answer: "We decide what ships on day one and what can follow. You leave with a launch plan and a fixed scope.",
    plan: "launch",
  },
  {
    name: "Live",
    line: "I’m improving a live product.",
    answer: "We find where people get stuck. You leave with a short list of fixes, in order.",
    plan: "partner",
  },
];

/* Scroll window: from late in the doors' unlock to near the end of the pinned hold. */
const OPEN_FROM = 0.15;
const SETTLE_AT = 0.9;

/* The timeline, in overall progress 0..1. */
const SEED: Seg = [0.19, 0.3];
const MOONS: Seg = [0.25, 0.34];
const MORPH: Seg[] = [[0.38, 0.5], [0.58, 0.71], [0.78, 0.9]];
const SLIDES: { in: Seg; out?: Seg }[] = [
  { in: [0.22, 0.33], out: [0.38, 0.46] },
  { in: [0.43, 0.53], out: [0.58, 0.66] },
  { in: [0.63, 0.73], out: [0.78, 0.86] },
  { in: [0.83, 0.93] },
];
/** Where each stage rests, for the stage dots. */
const HOLDS = [0.355, 0.555, 0.755];
type Seg = [number, number];

/* Tiles, row by row. Edge tiles turn white when the grid opens; corners stay blue. */
const ORDER = [0, 1, 2, 3, 5, 6, 7, 8, 4]; // the centre tile renders last, so it faces the camera while stacked
const LIFT = [22, 40, 14, 34, 62, 26, 10, 46, 18];
const LIFT_END = [30, 54, 20, 44, 82, 34, 16, 60, 24];
const WHITE = new Set([1, 3, 5, 7]);

const seg = (s: Seg, shift = 0) => `${(s[0] + shift).toFixed(3)},${Math.min(1, s[1] + shift).toFixed(3)}`;
const norm = (p: number, [a, b]: Seg) => (p - a) / (b - a);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function Glyph({ k }: { k: number }) {
  const shapes: Record<number, ReactNode> = {
    0: (
      <>
        <rect className="sp-loop sp-bar" x="9" y="16" width="8" height="24" rx="4" />
        <rect className="sp-loop sp-bar" x="20" y="8" width="8" height="32" rx="4" />
        <rect className="sp-loop sp-bar" x="31" y="20" width="8" height="20" rx="4" />
      </>
    ),
    1: (
      <>
        <rect x="5" y="14" width="38" height="20" rx="10" fill="none" stroke="currentColor" strokeWidth="3.5" />
        <circle className="sp-loop sp-knob" cx="15" cy="24" r="6" />
      </>
    ),
    2: (
      <>
        <circle className="sp-loop sp-ping" cx="24" cy="24" r="13" fill="none" stroke="currentColor" strokeWidth="3.5" />
        <circle cx="24" cy="24" r="6" />
      </>
    ),
    3: (
      <>
        <circle className="sp-loop sp-head" cx="14" cy="24" r="8" />
        <circle className="sp-loop sp-head" cx="24" cy="24" r="8" />
        <circle className="sp-loop sp-head" cx="34" cy="24" r="8" />
      </>
    ),
    5: (
      <>
        <circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" strokeWidth="3.5" />
        <path className="sp-loop sp-tick" d="M16.5 24.5l5 5 10-11" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
      </>
    ),
    6: (
      <>
        <clipPath id="sp-wave-clip"><rect x="6" y="6" width="36" height="36" rx="10" /></clipPath>
        <g clipPath="url(#sp-wave-clip)">
          <path className="sp-loop sp-wave" d="M-30 26c6 0 6-10 12-10s6 10 12 10 6-10 12-10 6 10 12 10 6-10 12-10 6 10 12 10 6-10 12-10 6 10 12 10" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </g>
      </>
    ),
    7: (
      <>
        <circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle className="sp-loop sp-arc" cx="24" cy="24" r="15" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" pathLength={1} transform="rotate(-90 24 24)" />
      </>
    ),
    8: (
      <g className="sp-loop sp-quad">
        <circle cx="16" cy="16" r="5.5" /><circle cx="32" cy="16" r="5.5" />
        <circle cx="16" cy="32" r="5.5" /><circle cx="32" cy="32" r="5.5" />
      </g>
    ),
  };
  if (k === 4) {
    return (
      <>
        <span className="sp-glyph sp-spark-g">
          <svg viewBox="0 0 48 48"><path className="sp-loop sp-spark" d="M24 6c1.6 9.4 8.6 16.4 18 18-9.4 1.6-16.4 8.6-18 18-1.6-9.4-8.6-16.4-18-18 9.4-1.6 16.4-8.6 18-18z" /></svg>
        </span>
        <span className="sp-glyph sp-arrow-g">
          <svg viewBox="0 0 48 48"><path d="M15 33L33 15M19 15h14v14" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </>
    );
  }
  return <span className="sp-glyph"><svg viewBox="0 0 48 48" fill="currentColor">{shapes[k]}</svg></span>;
}

export default function ProjectStartingPoint() {
  const root = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const rig = useRef<HTMLDivElement>(null);
  const pip = useRef<HTMLSpanElement>(null);
  const windowRef = useRef({ start: 0, end: 1 });

  const goTo = (i: number) => {
    const { start, end } = windowRef.current;
    smoothScrollTo(start + HOLDS[i] * (end - start));
  };

  useEffect(() => {
    const el = root.current, frame = frameRef.current, head = title.current, box = stage.current, body = rig.current, dot = pip.current;
    const section = el?.closest<HTMLElement>(".jny-process");
    if (!el || !frame || !head || !box || !body || !dot || !section) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const ease = (u: number) => (reduce.matches ? (u < 0.5 ? 0 : 1) : springCurve(u));

    // Every [data-e] / [data-x] / [data-d] element gets its own eased custom property.
    const tracks = (["e", "x", "d"] as const).flatMap((prop) =>
      Array.from(el.querySelectorAll<HTMLElement>(`[data-${prop}]`)).map((node) => {
        const [a, b] = (node.dataset[prop] ?? "0,1").split(",").map(Number);
        return { node, prop: `--${prop}`, seg: [a, b] as Seg, last: NaN };
      }),
    );
    const tiles = ORDER.map((k) => ({ k, node: body.querySelector<HTMLElement>(`.sp-tile[data-k="${k}"]`)!, shade: body.querySelector<HTMLElement>(`.sp-shade[data-k="${k}"]`)! }));
    const slides = Array.from(el.querySelectorAll<HTMLElement>(".sp-slide"));
    const dots = Array.from(el.querySelectorAll<HTMLButtonElement>(".sp-dots button"));

    let start = 0, end = 1, awakeFrom = 0, awakeTo = 0, statik = false, unit = 100, gap = 32;
    const span = (style: CSSStyleDeclaration, name: string) => {
      const raw = style.getPropertyValue(name).trim();
      return (parseFloat(raw) || 0) * (raw.endsWith("vh") ? innerHeight / 100 : 1);
    };
    const measure = () => {
      statik = !!el.closest(".jny-static");
      const style = getComputedStyle(section);
      const top = section.getBoundingClientRect().top + scrollY;
      const showcase = span(style, "--showcase-span"), laptop = span(style, "--laptop-span"), unlock = span(style, "--unlock-span");
      const opened = top + section.offsetHeight - innerHeight - laptop - showcase;
      start = opened - unlock * OPEN_FROM;
      end = opened + showcase * SETTLE_AT;
      awakeFrom = start - innerHeight;
      awakeTo = opened + showcase + laptop + innerHeight;
      windowRef.current = { start, end };
      // The headline opens centred and docks top-left; measure the centred offset.
      head.style.setProperty("--hx", `${Math.max(0, (frame.clientWidth - head.offsetWidth) / 2)}px`);
      head.style.setProperty("--hy", `${Math.max(0, (frame.clientHeight - head.offsetHeight) / 2)}px`);
      unit = box.clientWidth * 0.3;
      if (dots.length > 1) gap = dots[1].offsetLeft - dots[0].offsetLeft;
      run();
    };
    const scrollTarget = () => (statik ? 1 : clamp01((scrollY - start) / Math.max(1, end - start)));

    let slideOn = -1, awake = false, lastP = 0;
    const caught = [0, 0, 0, 0];
    const paint = (p: number, time: number) => {
      for (const t of tracks) {
        const v = ease(norm(p, t.seg));
        if (Math.abs(v - t.last) < 0.0005) continue;
        t.last = v;
        t.node.style.setProperty(t.prop, v.toFixed(4));
      }

      // ---- the sculpture ----
      const born = ease(norm(p, SEED));
      const M = MORPH.map((s) => ease(norm(p, s)));
      // The sculpture's pop is heard when it first passes full size on the way to its overshoot.
      [born, ...M].forEach((v, i) => {
        if (caught[i] < 1 && v >= 1 && p > lastP) play("ui_pop");
        caught[i] = v;
      });
      lastP = p;
      const B = unit;
      for (let n = 0; n < tiles.length; n++) {
        const { k, node, shade } = tiles[n];
        const col = (k % 3) - 1, row = Math.floor(k / 3) - 1;
        const delay = (Math.abs(col) + Math.abs(row)) * 0.012;
        const [m0, m1, m2] = MORPH.map(([a, b]) => ease(norm(p, [a + delay, b + delay])));
        // Idea → Launch → Live → Final, each step added on top, so overshoot carries through.
        const x = col * B * (1.22 * m1 + 0.1 * m2);
        const y = row * B * (1.22 * m1 + 0.1 * m2);
        const bob = reduce.matches ? 0 : Math.sin(time * 1.1 + k * 1.9) * 0.07 * B * clamp01(m1);
        const z = (LIFT[k] * m1 + (LIFT_END[k] - LIFT[k]) * m2) * B / 100 + bob + n * 0.3;
        const s = (1.9 + 0.35 * m0 - 1.25 * m1) * born;
        const r = 50 - 23 * m0 - 3 * m1;
        node.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) scale(${Math.max(0, s).toFixed(4)})`;
        node.style.borderRadius = `${r.toFixed(2)}%`;
        node.style.setProperty("--w", clamp01(m1).toFixed(4));
        node.style.setProperty("--g", m1.toFixed(4));
        if (k === 4) {
          node.style.setProperty("--g0", Math.max(0, born - m0).toFixed(4));
          node.style.setProperty("--g1", m0.toFixed(4));
        }
        shade.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,-1px) scale(${Math.max(0, m1).toFixed(4)})`;
      }
      const rx = 55 * M[1] + 4 * M[2], rz = 45 - 45 * M[0] - 45 * M[1] + 6 * M[2];
      body.style.transform = `rotateX(${rx.toFixed(3)}deg) rotateZ(${rz.toFixed(3)}deg) scale(${(1 - 0.27 * M[1] - 0.08 * M[2]).toFixed(4)})`;
      box.style.setProperty("--mo", Math.max(0, ease(norm(p, MOONS)) - M[0]).toFixed(4));
      box.style.setProperty("--gr", Math.max(0, born - M[1]).toFixed(4));

      // ---- the stage pip: travels between dots and stretches mid-flight ----
      const pos = M[0] + M[1];
      const f = pos <= 0 || pos >= 2 ? 0 : pos - Math.floor(pos);
      const stretch = 1 + 1.6 * 4 * f * (1 - f);
      dot.style.transform = `translate3d(${(pos * gap).toFixed(2)}px,0,0) scaleX(${stretch.toFixed(4)})`;

      const on = p < 0.44 ? 0 : p < 0.64 ? 1 : p < 0.84 ? 2 : 3;
      if (on !== slideOn) {
        slideOn = on;
        slides.forEach((s, i) => { s.inert = i !== on; });
        dots.forEach((d, i) => d.setAttribute("aria-current", String(i === on)));
      }
    };

    const follow = createCameraProgress(scrollTarget(), 0.55);
    let p = -1, frameId = 0, last = 0, first = true;
    const tick = (now: number) => {
      const dt = first ? 0 : Math.min(0.064, (now - last) / 1000);
      last = now;
      const goal = scrollTarget();
      let next = follow(goal, dt, first || reduce.matches);
      if (Math.abs(goal - next) < 0.0004) next = goal;
      const wake = scrollY > awakeFrom && scrollY < awakeTo && !document.hidden;
      if (wake !== awake) { awake = wake; el.toggleAttribute("data-awake", wake); }
      const ambient = awake && !reduce.matches && next > MORPH[1][0];
      if (next !== p || ambient) { p = next; paint(p, now / 1000); }
      first = false;
      frameId = next !== goal || ambient ? requestAnimationFrame(tick) : 0;
    };
    const run = () => { if (!frameId) { last = performance.now(); frameId = requestAnimationFrame(tick); } };
    const onScroll = () => run();

    measure();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", measure);
    document.addEventListener("visibilitychange", run);
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    observer.observe(frame);
    return () => {
      cancelAnimationFrame(frameId);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", run);
      observer.disconnect();
    };
  }, []);

  /** A line of copy that rises out of its mask on the way in and leaves upward on the way out. */
  const line = (slide: number, order: number, cls: string, children: ReactNode) => {
    const s = SLIDES[slide];
    return (
      <span className="sp-m">
        <span className={`sp-in ${cls}`} data-e={seg(s.in, order * 0.018)} data-x={s.out ? seg(s.out, order * 0.012) : undefined}>{children}</span>
      </span>
    );
  };

  return (
    <section ref={root} className="jny-project-showcase jny-start" aria-labelledby="start-title" aria-hidden="true">
      <div className="sp-frame" ref={frameRef}>
        <h2 id="start-title" ref={title} className="sp-title" aria-label="Where should I start?" data-d={seg([0.16, 0.28])}>
          {["Where", "should", "I", "start"].map((word, k) => (
            <Fragment key={word}>
              <span className="sp-mask" aria-hidden="true">
                <span className="sp-word" data-e={seg([0.01 + k * 0.016, 0.1 + k * 0.016])}>{word}</span>
              </span>
              {k === 1 && <br />}
            </Fragment>
          ))}
          <span className="sp-q" aria-hidden="true" data-e={seg([0.08, 0.17])}>?</span>
        </h2>

        <div className="sp-copy">
          {STAGES.map((st, i) => (
            <div className="sp-slide" key={st.name}>
              {line(i, 0, "sp-chip", <><b>{i + 1}</b>{st.name}</>)}
              {line(i, 1, "sp-line", st.line)}
              {line(i, 2, "sp-answer", st.answer)}
            </div>
          ))}
          <div className="sp-slide sp-final">
            {line(3, 0, "sp-line", "Wherever you are, start there.")}
            {line(3, 1, "sp-answer", "Pick your stage. The first conversation is shaped around it.")}
            <div className="sp-pills">
              {STAGES.map((st, i) => (
                <a
                  key={st.name}
                  className="sp-pill"
                  href="#contact"
                  data-e={seg([0.87 + i * 0.025, 0.96 + i * 0.025])}
                  onClick={() => window.dispatchEvent(new CustomEvent("journey-plan", { detail: st.plan }))}
                >
                  <span>{st.name}</span>
                  <span className="sp-pill-ic" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M4 12L12 4M5.5 4H12v6.5" /></svg></span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="sp-scene">
          <div className="sp-stage3d" ref={stage} aria-hidden="true">
            <span className="sp-ground"><i /></span>
            <span className="sp-moons"><span className="sp-orbit"><i /><i /></span></span>
            <div className="sp-float">
              <div className="sp-rig" ref={rig}>
                {ORDER.map((k) => <span className="sp-shade" data-k={k} key={`s${k}`} />)}
                {ORDER.map((k) => (
                  <span className={`sp-tile${WHITE.has(k) ? " sp-white" : ""}`} data-k={k} key={k} style={{ "--k": k } as CSSProperties}>
                    {WHITE.has(k) && <span className="sp-face" />}
                    <Glyph k={k} />
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="sp-dots" data-e={seg([0.26, 0.36])}>
            <span className="sp-pip" ref={pip} aria-hidden="true" />
            {STAGES.map((st, i) => (
              <button type="button" key={st.name} aria-label={`Show the ${st.name} stage`} onClick={() => goTo(i)} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
