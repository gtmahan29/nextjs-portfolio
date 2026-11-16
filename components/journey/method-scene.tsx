"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { IconArrowDownRight, IconBook2, IconBrush, IconCode, IconKey, IconWorld } from "@tabler/icons-react";
import { PRINCIPLES } from "./data";
import { createSpring, SPRING_PEAK } from "./motion-curve";
import { createStagedMotion, BEFORE } from "./staged-motion";
import { Rise, Words } from "./staged-words";
import { play } from "./sfx";
import "./method-scene.css";

/* ---------------------------------------------------------------------------
   "Work directly with me." One line between you and the work.

   0  the usual chain: you, an account manager, a project manager, a
      designer, a developer, strung on one line
   1  the middle of the chain pops away, the line pulls taut, and the
      developer morphs into Mahan: one person, design and code
   2  what you pay for travels down the line and stays with you
   3  the line starts to breathe: it keeps working
   4  the handbook is handed over; Mahan steps back
   5  you and Mahan meet in the middle and become the call to action

   Scroll only picks the beat. Every part springs on its own clock with the
   shared curve, so each shape overshoots inside its own morph and is caught.
   One sound per beat, at the first catch. Nothing is linear; nothing fades.
   ------------------------------------------------------------------------- */

const ROLES = ["Account manager", "Project manager", "Designer"];
const OWNED = [
  { label: "Code", Icon: IconCode },
  { label: "Designs", Icon: IconBrush },
  { label: "Accounts", Icon: IconKey },
  { label: "Domain", Icon: IconWorld },
];
/** Scroll progress (0..1 over the pinned stage) at which beats 1..5 begin. */
const BEAT_AT = [0.1, 0.28, 0.46, 0.63, 0.8];

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Deepens only the part of a spring past its target, so the catch reads as a pop, not a drift. */
const popped = (v: number, k: number) => (v > 1 ? 1 + (v - 1) * k : v);

export default function MethodScene() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    const stage = el?.querySelector<HTMLElement>(".jw-stage");
    if (!el || !stage) return;
    const all = <T extends Element>(s: string) => Array.from(el.querySelectorAll<T>(s));
    const one = <T extends Element>(s: string) => el.querySelector<T>(s)!;

    const motion = createStagedMotion(all<HTMLElement>("[data-beat]"), { lag: 0.2 });
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const you = one<HTMLElement>(".jw-you"), dev = one<HTMLElement>(".jw-dev");
    const devBody = one<HTMLElement>(".jw-dev-body"), devLabel = one<HTMLElement>(".jw-dev-a");
    const roles = all<HTMLElement>(".jw-role"), rolePills = roles.map(r => r.querySelector<HTMLElement>(".jw-pill")!);
    const chips = all<HTMLElement>(".jw-chip"), book = one<HTMLElement>(".jw-book");
    const cta = one<HTMLAnchorElement>(".jw-cta"), ctaIn = one<HTMLElement>(".jw-cta-in");
    const line = one<SVGPathElement>(".jw-line");

    // Every moving value is a spring with a goal that changes after a delay.
    let clock = 0;
    const track = (initial: number) => {
      const s = createSpring(initial);
      let want = initial, goal = initial, at = 0;
      return {
        get v() { return s.value; },
        kick: (impulse: number) => s.kick(impulse),
        set(target: number, delay = 0) { if (target !== want) { want = target; at = clock + delay; } },
        step(dt: number, snap: boolean) {
          if (clock >= at) goal = want;
          if (snap) { s.snap(want); return false; }
          return s.step(goal, dt);
        },
      };
    };
    const youX = track(0), youS = track(0), devX = track(0), devS = track(0), devM = track(0);
    const roleR = roles.map(() => track(1));
    const chipT = chips.map(() => track(0)), chipS = chips.map(() => track(0)), chipF = chips.map(() => track(0));
    const bookT = track(0), bookS = track(0), wave = track(0), sag = track(0), ctaC = track(0);
    const springs = [youX, youS, devX, devS, devM, ...roleR, ...chipT, ...chipS, ...chipF, bookT, bookS, wave, sag, ctaC];

    let W = 1, H = 1, mobile = false, roleW: number[] = [], devW = 160, D = 84, PH = 46, ctaW = 320;
    const measure = () => {
      W = stage.clientWidth; H = stage.clientHeight; mobile = W < 760;
      const css = getComputedStyle(stage);
      D = parseFloat(css.getPropertyValue("--jw-d")) || 84;
      PH = parseFloat(css.getPropertyValue("--jw-ph")) || 46;
      rolePills.forEach(p => { p.style.width = ""; });
      roleW = rolePills.map(p => p.offsetWidth);
      devW = devLabel.offsetWidth + (mobile ? 26 : 40);
      ctaW = ctaIn.offsetWidth;
    };

    /** Where the chain sits at each beat, as x positions in px. */
    const chainX = (i: number) => {
      const f = mobile ? [0.15, 0.33, 0.5, 0.67, 0.84][i] : [0.09, 0.28, 0.47, 0.66, 0.86][i];
      return f * W;
    };
    const zig = (i: number) => (mobile ? [0, -54, 54, -54, 0][i] : 0);
    const place = (beat: number) => {
      if (beat <= 0) return { you: chainX(0), dev: chainX(4) };
      if (beat === 5) return { you: W / 2, dev: W / 2 };
      const youAt = mobile ? 0.27 : 0.3, devAt = beat === 4 ? (mobile ? 0.8 : 0.8) : mobile ? 0.75 : 0.71;
      return { you: youAt * W, dev: devAt * W };
    };
    const dock = (i: number) => {
      if (mobile) return [[-48, 62], [48, 62], [-48, 106], [48, 106]][i];
      const k = clamp(W / 1200, 0.86, 1.15);
      const [x, y] = [[-142, -54], [-72, -118], [72, -118], [142, -54]][i];
      return [x * k, y * k];
    };

    let beat = BEFORE, started = false, phase = 0, last = performance.now(), raf = 0, visible = false;
    const written = new WeakMap<Element, Record<string, string>>();
    const write = (node: HTMLElement, prop: "transform" | "width" | "height", value: string) => {
      const seen = written.get(node) ?? {};
      if (seen[prop] === value) return;
      seen[prop] = value; written.set(node, seen);
      node.style[prop] = value;
    };
    const setVar = (node: HTMLElement, name: string, value: number) => {
      const v = value.toFixed(4);
      if (node.style.getPropertyValue(name) !== v) node.style.setProperty(name, v);
    };

    const frame = (now: number) => {
      raf = visible ? requestAnimationFrame(frame) : 0;
      const dt = Math.min(0.25, (now - last) / 1000); last = now;
      clock += dt;
      const reduced = reduce.matches;
      const rect = el.getBoundingClientRect();
      const range = Math.max(1, el.offsetHeight - innerHeight);
      const p = clamp(-rect.top / range);

      let next = rect.top < innerHeight * 0.5 ? 0 : BEFORE;
      if (next === 0) BEAT_AT.forEach((at, i) => { if (p >= at) next = i + 1; });
      if (next !== beat) {
        const forward = next > beat;
        // One sound per beat, on the first catch. The line is plucked when the chain changes.
        if (forward && !reduced && !document.hidden) play("ui_pop", (next === 5 ? 0.62 : next === 0 ? 0.12 : 0.2) + SPRING_PEAK);
        if (beat !== BEFORE && next !== BEFORE) sag.kick(forward ? 190 : -150);
        beat = next;
        el.dataset.stage = String(beat);
      }
      motion.update(beat, dt, reduced);

      // ---- goals ----
      const at = place(beat);
      youX.set(at.you, beat === 5 ? 0.12 : 0);
      devX.set(at.dev, beat === 5 ? 0.12 : beat === 1 ? 0.35 : 0);
      const shown = beat >= 0 && beat < 5;
      youS.set(shown ? 1 : 0, beat === 5 ? 0.46 : 0);
      devS.set(shown ? (beat === 4 ? 0.86 : 1) : 0, beat === 5 ? 0.46 : beat === 0 ? 0.5 : 0);
      devM.set(beat >= 1 ? 1 : 0, beat === 1 ? 0.5 : 0.1);
      roleR.forEach((r, i) => r.set(beat === 0 ? 0 : 1, beat === 0 ? 0.14 + i * 0.12 : i * 0.08));
      chips.forEach((_, i) => {
        const held = beat >= 2 && beat <= 4;
        chipS[i].set(held ? 1 : 0, held ? 0.25 + i * 0.16 : beat === 5 ? 0.1 + i * 0.06 : (3 - i) * 0.05);
        chipT[i].set(held || beat === 5 ? 1 : 0, held ? 0.36 + i * 0.16 : 0);
        chipF[i].set(beat === 5 ? 1 : 0, i * 0.06);
      });
      bookS.set(beat === 4 ? 1 : 0, beat === 4 ? 0.3 : 0);
      bookT.set(beat === 4 || beat === 5 ? 1 : 0, beat === 4 ? 0.42 : 0);
      wave.set(beat === 3 || beat === 4 ? 1 : 0, beat === 3 ? 0.3 : 0);
      ctaC.set(beat === 5 ? 1 : 0, beat === 5 ? 0.62 : 0);
      sag.set(0);

      if (!started) { started = true; youX.step(0, true); devX.step(0, true); }
      springs.forEach(s => s.step(dt, reduced));
      if (!reduced) phase += dt * 1.7 * clamp(wave.v * 1.4);

      // ---- layout ----
      const lineY = H * (mobile ? 0.72 : 0.68);
      const yx = youX.v, dx = devX.v;
      write(you, "transform", `translate3d(${yx.toFixed(1)}px,${lineY.toFixed(1)}px,0) scale(${Math.max(0, popped(youS.v, 2.5)).toFixed(4)})`);

      // The developer pill becomes Mahan's disc: one value drives width, height and colour,
      // so its overshoot squashes the disc tall and thin before it settles round.
      const m = popped(devM.v, 4), mc = clamp(m);
      write(dev, "transform", `translate3d(${dx.toFixed(1)}px,${lineY.toFixed(1)}px,0) scale(${Math.max(0, popped(devS.v, 2.5)).toFixed(4)})`);
      write(devBody, "width", `${Math.max(8, lerp(devW, D, m)).toFixed(1)}px`);
      write(devBody, "height", `${Math.max(8, lerp(PH, D, m)).toFixed(1)}px`);
      setVar(dev, "--m", mc);

      // Each middle role shrinks to a bead along the line, then is gone; arriving, the bead
      // grows and stretches past its pill width before it is caught.
      roles.forEach((node, i) => {
        const r = roleR[i].v;
        const w = roleW[i] + (PH - roleW[i]) * clamp(r * 1.6, -0.3, 1);
        const s = clamp((1 - r) / 0.42);
        write(node, "transform", `translate3d(${chainX(i + 1).toFixed(1)}px,${(lineY + zig(i + 1)).toFixed(1)}px,0) scale(${s.toFixed(4)})`);
        write(rolePills[i], "width", `${Math.max(PH * 0.5, w).toFixed(1)}px`);
      });

      chips.forEach((node, i) => {
        const t = chipT[i].v, [ox, oy] = dock(i);
        let x = lerp(dx, yx + ox, t), y = lerp(lineY, lineY + oy, t) - Math.sin(Math.PI * clamp(t)) * (mobile ? 40 : 72);
        const f = clamp(chipF[i].v);
        x = lerp(x, yx, f); y = lerp(y, lineY, f);
        write(node, "transform", `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${Math.max(0, popped(chipS[i].v, 2.5)).toFixed(4)})`);
      });
      {
        const t = bookT.v, oy = mobile ? -92 : 112;
        const x = lerp(dx, mobile ? W / 2 : yx, t), y = lerp(lineY, lineY + oy, t) - Math.sin(Math.PI * clamp(t)) * 56;
        write(book, "transform", `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${Math.max(0, popped(bookS.v, 2.5)).toFixed(4)})`);
      }

      // The line: through every link still in the chain, plucked on each beat, breathing at beat 3.
      const span = dx - yx;
      if (Math.abs(span) < 0.5) line.setAttribute("d", "M0 0");
      else {
        const amp = (mobile ? 9 : 14) * wave.v, sigma = W * 0.07;
        let d = "";
        for (let k = 0; k <= 64; k++) {
          const u = k / 64, x = yx + span * u, env = Math.sin(Math.PI * u);
          let y = lineY + sag.v * env + amp * Math.sin(u * Math.PI * 2 * 4.5 - phase) * env;
          for (let i = 1; i <= 3; i++) {
            const off = zig(i);
            if (off) y += off * clamp(1 - roleR[i - 1].v) * Math.exp(-((x - chainX(i)) ** 2) / (2 * sigma * sigma));
          }
          d += `${k ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
        }
        line.setAttribute("d", d);
      }

      // The two meet and become the call to action: the disc stretches into the pill,
      // past it, and is caught.
      const c = popped(ctaC.v, 1.6);
      write(cta, "transform", `translate3d(${(W / 2).toFixed(1)}px,${lineY.toFixed(1)}px,0) scale(${clamp(c * 5).toFixed(4)})`);
      write(cta, "width", `${Math.max(8, lerp(D * 0.78, ctaW, c)).toFixed(1)}px`);
      setVar(cta, "--c", clamp(c, 0, 1.2));
      cta.dataset.shown = String(c > 0.004);
      cta.dataset.live = String(c > 0.6);
    };

    const start = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; start(); }, { rootMargin: "25% 0px" });
    io.observe(el);
    const ro = new ResizeObserver(() => { measure(); start(); });
    ro.observe(stage);
    measure();
    return () => { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); motion.dispose(); };
  }, []);

  return (
    <section id="why" ref={root} className="jny-closing jw" aria-labelledby="jw-title">
      <div className="jw-stage">
        <div className="jw-copy">
          <div className="jw-block">
            <h2 id="jw-title" className="jw-title">
              <Words text="Work directly" beat={0} until={0} step={70} />
              <br />
              <span className="jw-dim"><Words text="with me." beat={0} until={0} start={140} step={70} /></span>
            </h2>
            <p className="jw-lede">
              <Rise beat={0} until={0} start={380}>I’m Mahan. I design, build and launch your project with you, from the first conversation to handover.</Rise>
            </p>
          </div>
          {PRINCIPLES.map((item, i) => (
            <div className="jw-block" key={item.title}>
              <h3 className="jw-say"><Words text={item.title} beat={i + 1} until={i + 1} step={55} /></h3>
              <p className="jw-more"><Rise beat={i + 1} until={i + 1} start={320}>{item.copy}</Rise></p>
            </div>
          ))}
          <div className="jw-block jw-end">
            <h3 className="jw-say"><Words text="Start with a conversation." beat={5} step={55} /></h3>
            <p className="jw-more"><Rise beat={5} start={320}>A few lines are enough. I’ll reply with a scope, a plan and what it takes.</Rise></p>
          </div>
        </div>

        <div className="jw-map" aria-hidden="true">
          <svg className="jw-wire"><path className="jw-line" d="M0 0" /></svg>
          {OWNED.map(({ label, Icon }) => (
            <span className="jw-node jw-chip" key={label}><span className="jw-pill"><Icon size={16} stroke={1.7} />{label}</span></span>
          ))}
          <span className="jw-node jw-book"><span className="jw-pill"><IconBook2 size={16} stroke={1.7} />Handbook and walkthrough</span></span>
          {ROLES.map((role, i) => (
            <span className="jw-node jw-role" key={role} style={{ "--i": i } as CSSProperties}><span className="jw-pill">{role}</span></span>
          ))}
          <span className="jw-node jw-dev">
            <span className="jw-dev-body">
              <span className="jw-dev-a">Developer</span>
              <span className="jw-dev-b">Mahan</span>
            </span>
            <span className="jw-cap"><Rise beat={1} until={4} start={900}>Design and code, one person</Rise></span>
          </span>
          <span className="jw-node jw-you"><span className="jw-disc">You</span></span>
        </div>

        <a className="jw-cta" href="#contact" data-sfx="big">
          <span className="jw-cta-in">
            <span className="jw-cta-t">Tell me what you’re building</span>
            <span className="jw-cta-ic"><IconArrowDownRight size={18} stroke={1.7} /></span>
          </span>
        </a>
      </div>
    </section>
  );
}
