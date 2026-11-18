"use client";

import { MutableRefObject, useEffect, useRef } from "react";
import { createSpring, springCurve, SPRING_PEAK } from "./motion-curve";
import "./scope-deck.css";

/*
MOTION SCORE — "What are you building?" scope deck
Trigger: click (the parent passes the picked scope: -1 before the section enters, 0 product build,
1 focused launch, 2 ongoing partner). The click only picks the card; every move below runs on the
shared spring in real time. The parent plays the one sound for the choice.

| Beat     | Element               | Pattern | Goal                                                    | Delay (s)              | Sound |
|----------|-----------------------|---------|---------------------------------------------------------|------------------------|-------|
| -1 → n   | three cards           | P3      | pop in as a deck, back card first                       | .09 each               | –     |
| n → m    | front card            | P12     | tucks out to the left and behind the deck               | 0                      | –     |
| n → m    | picked card           | P12     | comes forward to the front                              | .18 (lag)              | –     |
| any      | deck                  | P16     | floats and tilts slowly (one breath ≈ 7 s)              | loop                   | –     |
Inside each card a story plays on its own clock from the moment it comes to the front (loops):
| Product  | sketch strokes        | P4      | a phone wireframe is drawn stroke by stroke, pen tip    | .2 + ~.35 each         | –     |
|          | cursor → button       | P17, P3 | cursor taps; the sketched button becomes real           | 3.4 / 4.4 / 4.5        | –     |
|          | build                 | P4      | the image and text fill in with real UI                 | 5.3, 5.45, 5.55        | –     |
|          | live chip             | P3      | pops on the phone                                       | 6.2                    | –     |
|          | milestones            | P10, P3 | Scope, Prototype, Build, Launch tick as each lands      | 2.7, 4.7, 5.8, 6.3     | –     |
| Launch   | scope rows            | P4      | unroll from the left                                    | .2 + .09 each          | –     |
|          | ticks                 | P3      | three rows tick                                         | 1.4, 1.75, 2.1         | –     |
|          | a late request        | P4, P6  | unrolls, then travels below the "Next phase" line       | 2.3 / 3.0              | –     |
|          | go-live switch        | P17     | knob slides on, the track fills                         | 4.1                    | –     |
| Partner  | user dots             | P16     | flow down the funnel and bunch at Checkout              | continuous             | –     |
|          | drop-off badge        | P3      | pops on the stuck step; its ring breathes               | .6                     | –     |
|          | fix chip              | P6, P3  | flies in and snaps onto the step; the jam releases      | 3.4 / 4.0              | –     |
|          | this month's fixes    | P3      | fix 1 ticks                                             | 4.3                    | –     |
Reduced motion: no loops; each card shows its finished state, the deck snaps.
Phone: the deck sits under the choices and is smaller.
*/

const S = (t: number, at: number) => springCurve((t - at) / 1.3);
/** Up and back down on the spring: a press, a pulse. */
const pulse = (t: number, at: number, hold = .12) => S(t, at) - S(t, at + hold);
const popped = (v: number, k = 2.5) => (v > 1 ? 1 + (v - 1) * k : Math.max(0, v));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const f = (n: number) => n.toFixed(3);

type Scene = { loop: number; still: number; update: (t: number, dt: number) => void };

function ideaScene(root: SVGSVGElement): Scene {
  const strokes = Array.from(root.querySelectorAll<SVGPathElement>("[data-stroke]"));
  const starts = strokes.map(s => Number(s.dataset.stroke));
  const pen = root.querySelector<SVGGElement>("[data-pen]")!;
  const real = root.querySelector<SVGGElement>("[data-real]")!;
  const ripple = root.querySelector<SVGCircleElement>("[data-ripple]")!;
  const cursor = root.querySelector<SVGGElement>("[data-cursor]")!;
  const builds = Array.from(root.querySelectorAll<SVGElement>("[data-build]"));
  const live = root.querySelector<SVGGElement>("[data-live]")!;
  const steps = Array.from(root.querySelectorAll<SVGGElement>("[data-step]"));
  const links = Array.from(root.querySelectorAll<SVGRectElement>("[data-link]"));
  const lengths = strokes.map(s => s.getTotalLength());
  const REWIND = 7.6, STEP_AT = [2.7, 4.7, 5.8, 6.3], BUILD_AT = [5.3, 5.45, 5.55];
  return {
    loop: 9.4, still: 7.2,
    update(t) {
      const back = (i: number) => S(t, REWIND + (strokes.length - 1 - i) * .06);
      let tip: DOMPoint | null = null, tipOn = 0;
      strokes.forEach((s, i) => {
        const draw = clamp01(S(t, starts[i])) * (1 - clamp01(back(i)));
        s.style.strokeDashoffset = f(1 - draw);
        if (t >= starts[i] && t < starts[i] + 1.1 && draw < .995) { tip = s.getPointAtLength(lengths[i] * clamp01(draw)); tipOn = 1; }
      });
      const penOn = tipOn ? 1 : 0;
      if (tip) pen.setAttribute("transform", `translate(${f((tip as DOMPoint).x)} ${f((tip as DOMPoint).y)}) scale(${penOn})`);
      else pen.setAttribute("transform", "scale(0)");
      // The cursor glides in, taps, and leaves.
      const come = S(t, 3.4), go = S(t, 5.6);
      const cx = 330 - 172 * come + 190 * go, cy = 420 - 180 * come + 120 * go;
      const press = pulse(t, 4.4);
      cursor.setAttribute("transform", `translate(${f(cx)} ${f(cy)}) scale(${f(1 - .18 * press)})`);
      // The sketched button becomes real (the pop is in its scale), and rewinds with the sketch.
      const made = popped(S(t, 4.5)) * (1 - clamp01(S(t, REWIND)));
      real.setAttribute("transform", `translate(150 232) scale(${f(made)} ${f(Math.max(0, made * (1 - .1 * press)))}) translate(-150 -232)`);
      const r = S(t, 4.5);
      ripple.setAttribute("r", f(10 + 44 * clamp01(r)));
      ripple.style.strokeWidth = f(Math.max(0, 6 * clamp01(r * 5) * (1 - clamp01(r * 1.15))));
      // Build: the wireframe fills in with the real interface, part by part.
      builds.forEach((b, i) => {
        const v = Math.max(0, popped(S(t, BUILD_AT[i]), 1.6)) * (1 - clamp01(S(t, REWIND + .1)));
        b.setAttribute("transform", `translate(${b.dataset.ox} 0) scale(${f(v)} 1) translate(-${b.dataset.ox} 0)`);
      });
      const l = popped(S(t, 6.2)) * (1 - clamp01(S(t, REWIND + .1)));
      live.setAttribute("transform", `translate(184 74) scale(${f(Math.max(0, l * (1 + .06 * Math.sin(t * 3))))})`);
      // Milestones: each stage ticks as its work lands; the line between them fills.
      steps.forEach((st, i) => {
        const v = popped(S(t, STEP_AT[i])) * (1 - clamp01(S(t, REWIND + (3 - i) * .06)));
        st.setAttribute("transform", `scale(${f(Math.max(0, v))})`);
      });
      links.forEach((ln, i) => {
        const v = clamp01(S(t, STEP_AT[i + 1] - .5)) * (1 - clamp01(S(t, REWIND + (2 - i) * .06)));
        ln.setAttribute("transform", `translate(${ln.dataset.ox} 0) scale(${f(v)} 1) translate(-${ln.dataset.ox} 0)`);
      });
    },
  };
}

function launchScene(root: SVGSVGElement): Scene {
  const rows = Array.from(root.querySelectorAll<SVGGElement>("[data-row]"));
  const ticks = rows.map(r => r.querySelector<SVGGElement>("[data-tick]"));
  const later = root.querySelector<SVGGElement>("[data-later]")!;
  const knob = root.querySelector<SVGCircleElement>("[data-knob]")!;
  const fill = root.querySelector<SVGRectElement>("[data-fill]")!;
  const ring = root.querySelector<SVGCircleElement>("[data-ring]")!;
  const TICK = [1.4, 1.75, 2.1, -1], LATER = 3, OPEN = [.2, .29, .38, 2.3], REWIND = 6.6;
  return {
    loop: 8.2, still: 5.8,
    update(t) {
      const sort = S(t, 3.0) * (1 - clamp01(S(t, REWIND + .2)));
      rows.forEach((row, i) => {
        const open = popped(S(t, OPEN[i]), 1.6) * (1 - clamp01(S(t, REWIND + .3 + (rows.length - 1 - i) * .06)));
        // "Team chat" travels below the Later line; the row after it closes the gap.
        const dy = i === LATER ? 72 * sort : 0;
        row.setAttribute("transform", `translate(0 ${f(dy)}) translate(22 0) scale(${f(Math.max(0, open))} 1) translate(-22 0)`);
        const tk = ticks[i];
        if (tk && TICK[i] > 0) {
          const v = popped(S(t, TICK[i])) * (1 - clamp01(S(t, REWIND)));
          tk.setAttribute("transform", `scale(${f(v)})`);
        }
      });
      const l = S(t, 2.9) * (1 - clamp01(S(t, REWIND + .4)));
      later.setAttribute("transform", `translate(22 0) scale(${f(Math.max(0, l))} 1) translate(-22 0)`);
      const on = S(t, 4.1) * (1 - clamp01(S(t, REWIND - .4)));
      knob.setAttribute("cx", f(232 + 26 * on));
      fill.setAttribute("transform", `translate(218 0) scale(${f(clamp01(on) * 1)} 1) translate(-218 0)`);
      const rr = S(t, 4.1 + SPRING_PEAK * .6);
      ring.setAttribute("r", f(14 + 22 * clamp01(rr)));
      ring.style.strokeWidth = f(Math.max(0, 5 * clamp01(rr * 5) * (1 - clamp01(rr * 1.1))));
    },
  };
}

function liveScene(root: SVGSVGElement): Scene {
  const dots = Array.from(root.querySelectorAll<SVGCircleElement>("[data-dot]"));
  const pos = dots.map((_, i) => i / dots.length);
  const ring = root.querySelector<SVGCircleElement>("[data-stuck]")!;
  const drop = root.querySelector<SVGGElement>("[data-drop]")!;
  const fixChip = root.querySelector<SVGGElement>("[data-fix]")!;
  const fixed = root.querySelector<SVGGElement>("[data-fixed]")!;
  const listTick = root.querySelector<SVGGElement>("[data-list-tick]")!;
  const bars = Array.from(root.querySelectorAll<SVGRectElement>("[data-bar]"));
  const TOP = 72, BOTTOM = 296, JAM = (220 - TOP) / (BOTTOM - TOP);
  const flow = createSpring(0);
  let wall = 0;
  return {
    loop: 9.4, still: 5.4,
    update(t, dt) {
      wall += dt;
      const isFixed = t > 4.0 && t < 7.8;
      flow.step(isFixed ? 1 : 0, dt);
      const fv = clamp01(flow.value);
      // Dots slow to a crawl around Checkout until the fix; then they stream through.
      dots.forEach((d, i) => {
        const s = pos[i], near = Math.abs(s - JAM) < .07 ? 1 : 0;
        const speed = .2 * (near ? .1 + .9 * fv : 1);
        pos[i] = dt > 0 ? (s + speed * dt) % 1 : s;
        const y = TOP + (BOTTOM - TOP) * pos[i];
        const edge = Math.min(1, pos[i] / .04, (1 - pos[i]) / .04);
        d.setAttribute("transform", `translate(${f(78 + Math.sin((pos[i] + i) * 9) * 1.2)} ${f(y)}) scale(${f(Math.max(0, edge))})`);
      });
      const breathe = 1 + .12 * Math.sin(wall * 3.2);
      const stuck = popped(S(t, .6)) * (1 - clamp01(S(t, 4.0)));
      ring.setAttribute("transform", `translate(78 220) scale(${f(Math.max(0, stuck * breathe))})`);
      drop.setAttribute("transform", `translate(236 220) scale(${f(Math.max(0, stuck))}) translate(-236 -220)`);
      const fly = S(t, 3.4) * (1 - clamp01(S(t, 7.8)));
      fixChip.setAttribute("transform", `translate(${f(140 * (1 - fly))} 0) translate(236 220) scale(${f(Math.max(0, popped(fly)))}) translate(-236 -220)`);
      const ok = popped(S(t, 4.0)) * (1 - clamp01(S(t, 7.8)));
      fixed.setAttribute("transform", `translate(78 220) scale(${f(Math.max(0, ok))})`);
      listTick.setAttribute("transform", `scale(${f(Math.max(0, popped(S(t, 4.3)) * (1 - clamp01(S(t, 7.8)))))})`);
      // Conversion bars: Checkout's grows when the fix lands.
      const base = [1, .82, .44 + .3 * fv, .4 + .28 * fv];
      bars.forEach((b, i) => b.setAttribute("transform", `translate(96 0) scale(${f(base[i] * clamp01(S(t, .2 + i * .08)))} 1) translate(-96 0)`));
    },
  };
}

const W = 300, H = 380;

function Card({ k, children, label, right }: { k: number; children: React.ReactNode; label: string; right: React.ReactNode }) {
  return (
    <div className="sd-card" data-card={k}>
      <svg viewBox={`0 0 ${W} ${H}`} className="sd-svg" aria-hidden="true">
        <text x="24" y="38" className="sd-h">{label}</text>
        {right}
        {children}
      </svg>
    </div>
  );
}

export default function ScopeDeck({ beatRef }: { beatRef: MutableRefObject<number> }) {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const deck = el.querySelector<HTMLElement>(".sd-deck")!;
    const shadow = el.querySelector<HTMLElement>(".sd-shadow")!;
    const cards = Array.from(el.querySelectorAll<HTMLElement>(".sd-card"));
    const svgs = cards.map(c => c.querySelector<SVGSVGElement>("svg")!);
    const scenes = [ideaScene(svgs[0]), launchScene(svgs[1]), liveScene(svgs[2])];
    const scene = el.closest(".sp-scene");
    const pip = scene?.querySelector<HTMLElement>(".sp-pip") ?? null;
    const dots = Array.from(scene?.querySelectorAll<HTMLElement>(".sp-dots button") ?? []);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");

    // Per card: x, y (fractions of the stage), rotation (deg), scale; and its story clock.
    const springs = cards.map(() => ({ x: createSpring(0), y: createSpring(0), r: createSpring(0), s: createSpring(0) }));
    const clocks = [0, 0, 0];
    const tuckUntil = [0, 0, 0];
    const pipX = createSpring(0);
    let beat = -2, beatAt = 0, now = 0, last = 0, raf = 0, visible = false, size = 1, gap = 32;
    const deckSlot = (i: number, front: number) => (i - front + 3) % 3;

    const goal = (i: number) => {
      const b = beat;
      if (b < 0) return { x: 0, y: .04, r: 0, s: 0, z: 3 - i, delay: .09 * (2 - i) };
      if (b === 3) {
        const o = i - 1;
        return { x: o * .34, y: Math.abs(o) * .035, r: o * 7, s: .56, z: 3 - Math.abs(o), delay: .09 * i };
      }
      const k = deckSlot(i, b);
      // A card leaving the front tucks out to the left first, then slides in behind.
      if (now < tuckUntil[i]) return { x: -.62, y: .03, r: -12, s: .9, z: 4, delay: 0 };
      return { x: .055 * k, y: -.04 * k, r: 5 * k, s: 1 - .07 * k, z: 3 - k, delay: k === 0 ? .18 : 0 };
    };

    const delays = [0, 0, 0];
    const setBeat = (b: number) => {
      const prev = beat;
      if (b === prev) return;
      beat = b; beatAt = now;
      cards.forEach((_, i) => {
        // The old front card tucks when the deck turns over (either direction).
        const wasFront = prev >= 0 && prev <= 2 && i === prev;
        if (wasFront && b >= 0 && b <= 2) tuckUntil[i] = now + .3;
        if (b >= 0 && b <= 2 && i === b) clocks[i] = -.45; // its story starts after it arrives
        if (b === 3) clocks[i] = Math.max(clocks[i], 0);
        delays[i] = goal(i).delay;
      });
    };

    const measure = () => {
      size = el.clientWidth || 1;
      if (dots.length > 1) gap = dots[1].offsetLeft - dots[0].offsetLeft;
    };

    const frame = (t: number) => {
      raf = 0;
      const dt = last ? Math.min(.25, (t - last) / 1000) : 0;
      last = t; now += dt;
      const still = reduce.matches;
      setBeat(beatRef.current);

      cards.forEach((card, i) => {
        const g = goal(i), sp = springs[i];
        const go = now - beatAt >= delays[i];
        if (still) { sp.x.snap(g.x); sp.y.snap(g.y); sp.r.snap(g.r); sp.s.snap(g.s); }
        else if (go) { sp.x.step(g.x, dt); sp.y.step(g.y, dt); sp.r.step(g.r, dt); sp.s.step(g.s, dt); }
        const sc = popped(sp.s.value, 1);
        card.style.transform = `translate3d(${f(sp.x.value * size)}px, ${f(sp.y.value * size)}px, 0) rotate(${f(sp.r.value)}deg) scale(${f(Math.max(0, sc))})`;
        card.style.zIndex = String(g.z);
        // The story plays on the front card (and on all three when fanned out).
        const playing = beat === i || beat === 3;
        if (playing && !still) clocks[i] += dt;
        const sc0 = scenes[i];
        const local = still ? sc0.still : ((clocks[i] % sc0.loop) + sc0.loop) % sc0.loop;
        if (playing || still) sc0.update(clocks[i] < 0 && !still ? 0 : local, playing && !still ? dt : 0);
      });

      // The whole deck floats and tilts slowly; the shadow breathes with it.
      const sway = still ? 0 : Math.sin(now * .9), lift = still ? 0 : Math.sin(now * .9 + .6);
      deck.style.transform = `translate3d(0, ${f(lift * size * .012)}px, 0) rotateX(${f(10 + sway * 1.6)}deg) rotateY(${f(-8 + sway * 2.4)}deg)`;
      const shown = clamp01(springs.reduce((m, s) => Math.max(m, s.s.value), 0));
      shadow.style.transform = `scale(${f(shown * (beat === 3 ? 1.5 : 1) * (1 - lift * .04))}, ${f(shown)})`;

      // The stage pip travels to the beat's dot and stretches in flight.
      if (pip) {
        const target = Math.max(0, Math.min(2, beat));
        if (still) pipX.snap(target); else pipX.step(target, dt);
        const v = Math.min(1.4, Math.abs(pipX.velocity) * .9);
        pip.style.transform = `translate3d(${f(pipX.value * gap)}px,0,0) scaleX(${f(1 + v)})`;
      }
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }, { threshold: 0 });
    io.observe(el);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    document.addEventListener("visibilitychange", wake);
    return () => { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); document.removeEventListener("visibilitychange", wake); };
  }, [beatRef]);

  return (
    <div className="sd-stage" ref={stage} aria-hidden="true">
      <span className="sd-shadow" />
      <div className="sd-deck">
        {/* 1 · A product build: working software at the end of every stage */}
        <Card k={0} label="Product build" right={<text x="276" y="38" className="sd-m" textAnchor="end">4 stages</text>}>
          <g className="sd-sketch">
            <path data-stroke=".2" pathLength={1} d="M108 62 H192 Q210 62 210 80 V260 Q210 278 192 278 H108 Q90 278 90 260 V80 Q90 62 108 62 Z" />
            <path data-stroke=".85" pathLength={1} d="M104 86 Q150 83 196 86" />
            <path data-stroke="1.15" pathLength={1} d="M104 100 H196 V150 H104 Z" />
            <path data-stroke="1.5" pathLength={1} d="M106 102 L194 148 M194 102 L106 148" />
            <path data-stroke="1.85" pathLength={1} d="M104 170 Q140 168 182 170 M104 186 Q130 184 160 186" />
            <path data-stroke="2.2" pathLength={1} d="M116 222 H184 Q196 222 196 232 Q196 242 184 242 H116 Q104 242 104 232 Q104 222 116 222 Z" />
          </g>
          <rect data-build data-ox="104" x="104" y="100" width="92" height="50" rx="6" className="sd-build-img" transform="scale(0 1)" />
          <rect data-build data-ox="104" x="104" y="166" width="78" height="7" rx="3.5" className="sd-build-line" transform="scale(0 1)" />
          <rect data-build data-ox="104" x="104" y="182" width="56" height="7" rx="3.5" className="sd-build-line sd-build-soft" transform="scale(0 1)" />
          <circle data-ripple cx="150" cy="232" r="10" className="sd-ripple" />
          <g data-real transform="scale(0)">
            <rect x="104" y="222" width="92" height="20" rx="10" className="sd-btn" />
            <text x="150" y="236" className="sd-btn-t" textAnchor="middle">Try it</text>
          </g>
          <g data-live transform="scale(0)">
            <rect x="-18" y="-8" width="36" height="16" rx="8" className="sd-live-chip" />
            <circle cx="-9" cy="0" r="2.6" className="sd-live" />
            <text x="3" y="3.4" className="sd-live-t" textAnchor="middle">Live</text>
          </g>
          <g data-pen transform="scale(0)"><circle r="9" className="sd-pen-halo" /><circle r="3.6" className="sd-pen" /></g>
          <path d="M60 322 H240" className="sd-step-rail" />
          {[0, 1, 2].map(i => <rect key={i} data-link data-ox={60 + i * 60} x={60 + i * 60} y="320" width="60" height="4" rx="2" className="sd-step-fill" transform="scale(0 1)" />)}
          {["Scope", "Prototype", "Build", "Launch"].map((name, i) => (
            <g key={name}>
              <circle cx={60 + i * 60} cy="322" r="9" className="sd-box" />
              <g transform={`translate(${60 + i * 60} 322)`}>
                <g data-step transform="scale(0)"><circle r="9" className="sd-box-on" /><path d="M-3.8 0.2 l2.6 2.6 l5 -5.4" className="sd-box-tick" /></g>
              </g>
              <text x={60 + i * 60} y="350" className="sd-step-t" textAnchor="middle">{name}</text>
            </g>
          ))}
          <g data-cursor transform="scale(0)"><path d="M0 0 L0 17 L4.6 12.8 L8 20 L11 18.6 L7.7 11.6 L13.6 11.2 Z" className="sd-cursor" /></g>
        </Card>

        {/* 2 · A focused launch: a fixed scope, agreed before work begins */}
        <Card k={1} label="Launch" right={<g><rect x="196" y="24" width="80" height="20" rx="10" className="sd-tag" /><text x="236" y="38" className="sd-tag-t" textAnchor="middle">Fixed scope</text></g>}>
          {["Design & build", "Content", "Payments", "Blog · new request"].map((name, i) => (
            <g key={name} data-row={i}>
              <rect x="22" y={62 + i * 46} width="256" height="36" rx="12" className={i === 3 ? "sd-row sd-row-later" : "sd-row"} />
              <circle cx="44" cy={80 + i * 46} r="9" className="sd-box" />
              {i !== 3 ? (
                <g transform={`translate(44 ${80 + i * 46})`}>
                  <g data-tick transform="scale(0)"><circle r="9" className="sd-box-on" /><path d="M-3.8 0.2 l2.6 2.6 l5 -5.4" className="sd-box-tick" /></g>
                </g>
              ) : (
                <text x="270" y={84 + i * 46} className="sd-later-t" textAnchor="end">later</text>
              )}
              <text x="62" y={84 + i * 46} className="sd-row-t">{name}</text>
            </g>
          ))}
          <g data-later>
            <path d="M22 250 H278" className="sd-dash" />
            <text x="22" y="266" className="sd-m">Next phase</text>
          </g>
          <text x="24" y="342" className="sd-row-t sd-strong">Go live</text>
          <circle data-ring cx="258" cy="337" r="14" className="sd-ring" />
          <rect x="218" y="323" width="56" height="28" rx="14" className="sd-track" />
          <rect data-fill x="218" y="323" width="56" height="28" rx="14" className="sd-fill" />
          <circle data-knob cx="232" cy="337" r="11" className="sd-knob" />
        </Card>

        {/* 3 · An ongoing partner: monitor, find where people get stuck, fix it, month by month */}
        <Card k={2} label="Live product" right={<g><circle cx="116" cy="34" r="4" className="sd-live" /><text x="276" y="38" className="sd-m" textAnchor="end">1,284 now</text></g>}>
          <path d="M78 72 V296" className="sd-rail" />
          {["Landing", "Sign-up", "Checkout", "Done"].map((name, i) => (
            <g key={name}>
              <circle cx="78" cy={80 + i * 70} r="9" className="sd-node" />
              <text x="96" y={84 + i * 70 - 8} className="sd-row-t">{name}</text>
              <rect x="96" y={84 + i * 70 + 2} width="120" height="5" rx="2.5" className="sd-bar-bg" />
              <rect data-bar x="96" y={84 + i * 70 + 2} width="120" height="5" rx="2.5" className="sd-bar" />
            </g>
          ))}
          {Array.from({ length: 14 }, (_, i) => <circle key={i} data-dot r="3.4" className="sd-dot" />)}
          <circle data-stuck r="16" className="sd-stuck" transform="scale(0)" />
          <g data-fixed transform="scale(0)"><circle r="10" className="sd-box-on" /><path d="M-3.8 0.2 l2.6 2.6 l5 -5.4" className="sd-box-tick" /></g>
          <g data-drop transform="scale(0)">
            <rect x="224" y="208" width="58" height="24" rx="12" className="sd-drop" />
            <text x="253" y="224" className="sd-drop-t" textAnchor="middle">−38%</text>
          </g>
          <g data-fix transform="scale(0)">
            <rect x="214" y="208" width="68" height="24" rx="12" className="sd-fix" />
            <text x="248" y="224" className="sd-fix-t" textAnchor="middle">Fix #1</text>
          </g>
          <text x="24" y="338" className="sd-m">This month</text>
          {[0, 1, 2].map(i => (
            <g key={i} transform={`translate(${126 + i * 52} 334)`}>
              <circle r="11" className="sd-num" />
              <text y="4" className="sd-num-t" textAnchor="middle">{i + 1}</text>
              {i === 0 && <g data-list-tick transform="scale(0)"><circle r="11" className="sd-box-on" /><path d="M-3.8 0.2 l2.6 2.6 l5 -5.4" className="sd-box-tick" /></g>}
            </g>
          ))}
        </Card>
      </div>
    </div>
  );
}
