"use client";
import { useEffect, useRef } from "react";
import OpalKeyboard from "./opal-keyboard";
import { createStagedMotion, BEFORE } from "./staged-motion";
import { Words, pop } from "./staged-words";
import { SPRING_PEAK, springCurve } from "./motion-curve";
import { play } from "./sfx";
import "./build-story.css";

/**
 * The build. A website forms on a display from nothing while the keyboard
 * types it into being:
 *   0  the display draws itself out of a single outline
 *   1  structure: a 12-column grid rises, every block lands as a wireframe
 *   2  design: each wireframe is wiped away by its finished element, and the
 *      keyboard types the headline key by key
 *   3  complete: the chart draws, the page goes live, a cursor clicks
 * Scroll only picks the beat; every element springs on its own clock.
 *
 * Around the display, the tools of each stage come out from behind the
 * screen, are caught in place, draw a thin line to what they describe, and
 * leave upward when the stage changes (references: spring-motion-choreography).
 *
 * MOTION SCORE — the build's surroundings
 * Trigger: scroll beats (BEAT_AT), exit before enter, lag 0.16
 * | Beat | Element                 | Pattern | Goal                         | Delay (ms)        | Exit    | Sound            |
 * |------|-------------------------|---------|------------------------------|-------------------|---------|------------------|
 * | 0    | crop marks ×4           | P3      | pop from each corner         | 220 +70 each      | until 1 | ui_pop @.16+PEAK |
 * | 0    | width / height rulers   | P3      | line grows from centre       | 420, 520          | until 0 |                  |
 * | 0    | ruler labels            | P3      | pop                          | 560, 660          | until 0 |                  |
 * | 1    | grid card (right)       | P3+trav | out from behind the screen   | 300               | until 1 | ui_pop @.16+PEAK |
 * | 1    | spacing card + 5 bars   | P3, P4  | card, then bars grow         | 420; 560 +70 each | until 1 |                  |
 * | 1    | layers card + 4 rows    | P3, P2  | card, then rows rise         | 380; 520 +80 each | until 1 |                  |
 * | 1    | leader lines + dots     | P11     | draw from the element out    | 480–620           | until 1 |                  |
 * | 2    | palette card + 5 swatch | P3, P5b | squares become circles       | 260; 400 +80 each | until 2 | ui_pop @.16+PEAK |
 * | 2    | type card, "Aa"         | P3, P1  | card, then glyphs rise       | 360; 500          | until 2 |                  |
 * | 2    | spring curve card       | P3, P16 | curve draws, a dot rides it  | 420; 600          | until 2 |                  |
 * | 3    | phone                   | P3+trav | slides out from behind       | 300               | until 3 | ui_pop @.16+PEAK |
 * | 3    | live toast, signups     | P3      | after the cursor's click     | 2100, 2500        | until 3 |                  |
 * Reduced motion: every part snaps to its beat; the curve dot rests at the end.
 * Phone / narrow (≤1180px): only crop marks and rulers; the cards would crowd the screen.
 */
const STEPS = ["From nothing.", "Structure first.", "Then every detail.", "Made real."];
const BEAT_AT = [0.08, 0.27, 0.5, 0.78];
const PHRASE = "Make it real.";
const beatOf = (p: number) => { let beat = BEFORE; BEAT_AT.forEach((at, i) => { if (p >= at) beat = i; }); return beat; };

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };
const silk = (v: number) => { const x = clamp(v); return x * x * x * (x * (x * 6 - 15) + 10); };

/** A wireframe placeholder: lands at beat 1, is wiped away at beat 2. */
const Wire = ({ order, children }: { order: number; children?: React.ReactNode }) =>
  <span className="wf" aria-hidden="true" {...pop(1, 90 + order * 70, 1)}>{children}</span>;
/** The finished element: wipes in over its wireframe at beat 2. */
const Done = ({ order, className = "", children }: { order: number; className?: string; children: React.ReactNode }) =>
  <span className={`ds ${className}`} {...pop(2, 160 + order * 90)}>{children}</span>;

/* ---------------------------------------------------------------------------
   The surroundings. Everything here is placed in the display's own box, so it
   scales and travels with the screen. Cards sit behind the bezel and come out
   from under it (--fx, --fy point back toward the screen); the lead lines sit
   above it and draw from the element they describe out to their card.
   ------------------------------------------------------------------------- */
const CURVE = Array.from({ length: 49 }, (_, k) => {
  const u = k / 48;
  return `${k ? "L" : "M"}${(u * 100).toFixed(2)} ${(52 - springCurve(u) * 38).toFixed(2)}`;
}).join("");

/** Lead lines in the screen's 1000 × 625 space, authored from the element out to its card (they draw in that direction). */
const LEADS = [
  { beat: 1, delay: 480, d: "M960 46 L990 64 H1076", dot: [960, 46] },
  { beat: 1, delay: 560, d: "M975 300 H1076", dot: [975, 300] },
  { beat: 1, delay: 520, d: "M28 430 L0 452 H-76", dot: [28, 430] },
  { beat: 2, delay: 420, d: "M950 110 L990 64 H1076", dot: [950, 110] },
  { beat: 2, delay: 560, d: "M905 400 L1000 300 H1076", dot: [905, 400] },
  { beat: 2, delay: 500, d: "M50 210 H12 V452 H-76", dot: [50, 210] },
];

const sat = (beat: number, start: number, until = beat) => pop(beat, start, until);

function Orbit() {
  return (
    <div className="bs-orbit" aria-hidden="true">
      {/* From nothing: the frame is measured before anything is drawn. */}
      {(["tl", "tr", "bl", "br"] as const).map((corner, i) => <i key={corner} className={`bs-crop bs-crop-${corner}`} {...pop(0, 220 + i * 70, 1)} />)}
      <i className="bs-ruler bs-ruler-x" {...pop(0, 420, 0)} />
      <b className="bs-ruler-label bs-ruler-label-x" {...pop(0, 560, 0)}>1440</b>
      <i className="bs-ruler bs-ruler-y" {...pop(0, 520, 0)} />
      <b className="bs-ruler-label bs-ruler-label-y" {...pop(0, 660, 0)}>900</b>

      {/* Structure first: the grid, the spacing scale and the layers. */}
      <div className="bs-sat bs-right bs-slot-a" {...sat(1, 300)}>
        <span className="bs-card-k">Grid</span>
        <span className="bs-grid-ico">{Array.from({ length: 12 }, (_, i) => <i key={i} {...pop(1, 420 + i * 30, 1)} />)}</span>
        <span className="bs-card-v">12 columns · 24 gutter</span>
      </div>
      <div className="bs-sat bs-right bs-slot-b" {...sat(1, 420)}>
        <span className="bs-card-k">Spacing</span>
        <span className="bs-space">
          {[4, 8, 16, 24, 40].map((n, i) => (
            <span key={n}><i style={{ width: `${n * 2}px` }} {...pop(1, 560 + i * 70, 1)} /><em>{n}</em></span>
          ))}
        </span>
      </div>
      <div className="bs-sat bs-left bs-slot-c" {...sat(1, 380)}>
        <span className="bs-card-k">Layers</span>
        <span className="bs-layers">
          {["Navigation", "Hero", "Launch plan", "Logos"].map((row, i) => (
            <span key={row} className="jm-m jm-b"><span className="jm-in" {...pop(1, 520 + i * 80, 1)}><i />{row}</span></span>
          ))}
        </span>
      </div>

      {/* Then every detail: colour, type and motion. */}
      <div className="bs-sat bs-right bs-slot-a" {...sat(2, 260)}>
        <span className="bs-card-k">Colour</span>
        <span className="bs-swatches">
          {["#3044f5", "#8f6bff", "#ff8a6b", "#11141b", "#f8f6f2"].map((c, i) => (
            <i key={c} style={{ background: c }} {...pop(2, 400 + i * 80, 2)} />
          ))}
        </span>
      </div>
      <div className="bs-sat bs-right bs-slot-b" {...sat(2, 420)}>
        <span className="bs-card-k">Motion</span>
        <svg className="bs-curve" viewBox="-4 6 108 52" preserveAspectRatio="none">
          <line x1="0" x2="100" y1="14" y2="14" />
          <path d={CURVE} pathLength={1} {...pop(2, 600, 2)} />
          <circle className="bs-curve-dot" cx="0" cy="52" r="0" />
        </svg>
        <span className="bs-card-v">One spring · 64 / 11</span>
      </div>
      <div className="bs-sat bs-left bs-slot-c" {...sat(2, 360)}>
        <span className="bs-card-k">Type</span>
        <span className="bs-type">
          <span className="jm-m"><span className="jm-in" {...pop(2, 500, 2)}>Aa</span></span>
          <span className="bs-card-v">Outfit · 500 · −6%</span>
        </span>
      </div>

      {/* Made real: the same page on a phone, live, with its first visitors. */}
      <div className="bs-phone" {...sat(3, 300)}>
        <span className="bs-phone-screen">
          <i className="bs-phone-logo" />
          <b /><b /><b className="short" />
          <i className="bs-phone-cta" />
          <i className="bs-phone-art" />
        </span>
      </div>
      <div className="bs-sat bs-left bs-slot-d" {...sat(3, 2100)}>
        <span className="bs-live"><i />Live</span>
        <span className="bs-card-v">kiln.app</span>
      </div>
      <div className="bs-sat bs-left bs-slot-e" {...sat(3, 2500)}>
        <span className="bs-faces"><i /><i /><i /></span>
        <span className="bs-card-v">12 new sign-ups</span>
      </div>
    </div>
  );
}

function Leads() {
  return (
    <svg className="bs-leads" viewBox="0 0 1000 625" preserveAspectRatio="none" aria-hidden="true">
      {LEADS.map((lead, i) => (
        <g key={i}>
          <path d={lead.d} pathLength={1} {...pop(lead.beat, lead.delay, lead.beat)} />
          <circle cx={lead.dot[0]} cy={lead.dot[1]} r="5" {...pop(lead.beat, lead.delay - 120, lead.beat)} />
        </g>
      ))}
    </svg>
  );
}

export default function IsometricStory() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = root.current, hero = host?.closest(".hero-start");
    if (!host || !hero) return;
    const keyboard = host.querySelector<HTMLElement>(".build-keyboard")!;
    const display = host.querySelector<HTMLElement>(".bs-display")!;
    const headline = host.querySelector<HTMLElement>("[data-typed]")!;
    const opal = keyboard.querySelector<HTMLElement>("[data-opal-keyboard]");
    const curveDot = host.querySelector<SVGCircleElement>(".bs-curve-dot");
    const motion = createStagedMotion(Array.from(host.querySelectorAll<HTMLElement>("[data-beat]")), { lag: 0.16 });
    let beat = BEFORE, last = performance.now(), beatAt = 0, typed = "", demoKey = -1, hidden = true;

    // The keyboard reports every letter it has actually pressed; the page shows exactly those.
    const onTyped = (event: Event) => {
      const text = String((event as CustomEvent<string>).detail ?? "");
      const next = PHRASE.slice(0, text.length);
      // One sound, when the headline is complete: no tap-tap per letter.
      if (next.length === PHRASE.length && typed.length < PHRASE.length) play("ui_pop");
      typed = next;
      headline.textContent = typed;
      host.dataset.typing = String(typed.length > 0 && typed.length < PHRASE.length);
    };
    keyboard.addEventListener("iso-typed", onTyped);

    const update = (e: Event) => {
      const { units, reduced, visible } = (e as CustomEvent<{ units: number; reduced: boolean; visible: boolean }>).detail;
      const now = performance.now(), dt = Math.min(0.25, (now - last) / 1000); last = now;
      if (!visible) {
        // Off stage: put every element back where it waits, so the next visit starts from nothing.
        if (!hidden) { hidden = true; host.style.visibility = "hidden"; beat = BEFORE; motion.update(BEFORE, 0, true); typed = ""; headline.textContent = ""; }
        return;
      }
      if (hidden) { hidden = false; host.style.visibility = ""; }
      const p = reduced ? 1 : clamp((units - 2.12) / 3.02), entry = ease(p / 0.15);
      const next = beatOf(p);
      if (next !== beat) {
        // Beat 2 is heard through the typing itself.
        if (next > beat && next >= 0 && !reduced) play("ui_pop", 0.16 + SPRING_PEAK);
        beat = next; beatAt = now; demoKey = -1;
        host.dataset.stage = beat < 0 ? "nothing" : ["frame", "wireframe", "design", "complete"][beat];
      }
      motion.update(beat, dt, reduced);
      // The spring, demonstrated: a dot rides the curve, rests on the target, and starts again.
      if (beat === 2 && curveDot) {
        const t = reduced ? 9 : (now / 1000) % 2.4, u = Math.min(1, t / 1.6);
        curveDot.setAttribute("cx", (u * 100).toFixed(2));
        curveDot.setAttribute("cy", (52 - springCurve(u) * 38).toFixed(2));
        curveDot.setAttribute("r", (3.2 * springCurve(Math.min(1, t / 0.5))).toFixed(2));
      }

      // Keyboard and display travel together with scroll: in from below, out with the clouds.
      const arrival = reduced ? 1 : silk(p / 0.16), anticipation = reduced ? 0 : ease((units - 5.25) / 0.18), departure = reduced ? 0 : silk((units - 5.43) / 0.69);
      const clearance = window.innerHeight * 1.05 + keyboard.offsetHeight * 0.15;
      const y = (1 - arrival) * clearance - 14 * anticipation + departure * clearance;
      keyboard.style.transform = `translate(-50%,-50%) perspective(1400px) translate3d(${18 * Math.sin(Math.PI * arrival) + 12 * departure}px,${y}px,${-45 * (1 - arrival) - 65 * departure}px) rotateX(${20 * (1 - arrival) - 4 * anticipation + 22 * departure}deg) rotateZ(${-2.5 * (1 - arrival) + 2 * departure}deg) scale(${0.97 + 0.03 * arrival - 0.025 * departure})`;
      display.style.transform = `translate(-50%,-50%) perspective(1600px) translate3d(0,${-departure * window.innerHeight * 0.9}px,0) rotateX(${-10 * departure}deg)`;

      // Beat 1 taps out a short rhythm as the blocks land; beat 2 types the headline for real.
      const since = (now - beatAt) / 1000;
      const demo = beat === 1 && !reduced ? Math.min(since, 2.2) : -1;
      const time = beat >= 2 ? (reduced ? 4 : Math.min(since + (beat === 3 ? 4 : 0), 3.6)) : -1;
      if (beat < 2 && typed) { typed = ""; headline.textContent = ""; }
      opal?.dispatchEvent(new CustomEvent("iso-keyboard", { detail: { angle: 0.84 + 0.16 * entry, time, demo, presses: [], reduced } }));
    };
    hero.addEventListener("hero-story-frame", update);
    return () => { hero.removeEventListener("hero-story-frame", update); keyboard.removeEventListener("iso-typed", onTyped); motion.dispose(); };
  }, []);

  return <div className="iso-story keyboard-build" ref={root} aria-label="A website built on screen while the keyboard types it, from nothing, to a wireframe, to a finished design">
    <div className="bs-steps" aria-hidden="true">
      {STEPS.map((step, i) => <p className="bs-step" key={i}><Words text={step} beat={i} until={i} step={60} /></p>)}
    </div>

    <div className="bs-display">
      <Orbit />
      <svg className="bs-outline" viewBox="0 0 1000 625" preserveAspectRatio="none" aria-hidden="true">
        <rect x="2" y="2" width="996" height="621" rx="24" pathLength={1} vectorEffect="non-scaling-stroke" {...pop(0)} />
      </svg>
      <div className="bs-bezel" {...pop(0, 380)}>
        <div className="bs-screen">
          <div className="bs-cols" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => <i key={i} {...pop(1, i * 40, 1)} />)}
          </div>
          <div className="bs-paint" aria-hidden="true" {...pop(2)} />

          <div className="bs-site">
            <span className="bs-el el-logo">
              <Wire order={0} />
              <Done order={0} className="logo"><i />Kiln</Done>
            </span>
            <span className="bs-el el-links">
              <Wire order={1}><b /><b /><b /></Wire>
              <Done order={1} className="links"><span>Product</span><span>Pricing</span><span>Stories</span></Done>
            </span>
            <span className="bs-el el-nav-btn">
              <Wire order={2} />
              <Done order={2} className="nav-btn">Get started</Done>
            </span>
            <span className="bs-el el-h1">
              <Wire order={3}><b /><b /></Wire>
              <span className="ds h1" {...pop(2, 120)}><span data-typed="" /><i className="caret" /></span>
            </span>
            <span className="bs-el el-sub">
              <Wire order={4}><b /><b /></Wire>
              <Done order={4} className="sub">Plan, design and launch your product in one calm place.</Done>
            </span>
            <span className="bs-el el-ctas">
              <Wire order={5}><b /><b /></Wire>
              <Done order={5} className="ctas"><span className="cta-main">Start free</span><span className="cta-alt">Book a demo</span></Done>
            </span>
            <span className="bs-el el-art">
              <Wire order={6}><svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0 0L100 100M100 0L0 100" /></svg></Wire>
              <span className="ds art" {...pop(2, 520)}>
                <span className="art-bg" />
                <span className="art-panel">
                  <span className="art-row"><i /><b>Launch plan</b><em>On track</em></span>
                  <span className="art-bars">
                    {[38, 54, 46, 70, 62, 84, 92].map((h, i) => <i key={i} style={{ height: `${h}%` }} {...pop(2, 760 + i * 60)} />)}
                  </span>
                  <svg className="art-line" viewBox="0 0 100 40" preserveAspectRatio="none"><path pathLength={1} d="M0 32C14 30 18 22 30 24S48 12 60 14 82 4 100 3" {...pop(3, 200)} /></svg>
                  <span className="art-people"><i /><i /><i /><em>+12</em></span>
                </span>
                <span className="art-live" {...pop(3, 650)}><i />Live</span>
              </span>
            </span>
            <span className="bs-el el-logos">
              <Wire order={7}><b /><b /><b /><b /><b /></Wire>
              <Done order={7} className="logos"><span>Northwind</span><span>Atlas</span><span>Lumen</span><span>Orbit</span><span>Fieldwork</span></Done>
            </span>
          </div>

          <span className="bs-cursor" aria-hidden="true" {...pop(3, 900)}>
            <svg viewBox="0 0 24 24"><path d="M5 3l13 8-6 1.4L9 19z" /></svg>
          </span>
          <span className="bs-click" aria-hidden="true" {...pop(3, 1750)} />
        </div>
      </div>
      <Leads />
    </div>
    <div className="build-keyboard"><OpalKeyboard /></div>
  </div>;
}
