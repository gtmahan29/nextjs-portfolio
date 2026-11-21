"use client";
import { useEffect, useRef, useState } from "react";
import { playScroll } from "@/components/smooth-scroll";
import localFont from "next/font/local";
import IsometricStory from "./isometric-story";
import { createStagedMotion } from "./staged-motion";
import { addJob, wake } from "./spring-ticker";
import { createSpring } from "./motion-curve";
import { FOLDER_CARDS } from "./glass-folder-data";
import { reportLoad } from "./page-loader";
const heroDisplay=localFont({src:"../../public/fonts/Yorkmade.woff2",weight:"700",display:"swap"});

/*
MOTION SCORE — hero
Trigger: page load (beat 0), then scroll past 12% of a screen (beat 1: everything leaves upward).

| Beat | Element             | Pattern | Goal                 | Delay (s)              | Exit      | Sound |
|------|---------------------|---------|----------------------|------------------------|-----------|-------|
| 0    | sky (scene)         | –       | inset wipe opens     | on 3D ready            | –         | –     |
| 0    | "MAKE IT" words     | P1      | rise                 | .00, +.07/word         | until 0   | –     |
| 0    | R·E·A·L letters     | P3      | pop out of mask      | .16, +.07/letter       | until 0   | –     |
| 0    | Start key (3D)      | P12     | scale pop k=3 + spin | .22 after ready        | flight    | –     |
| 0    | lede                | P2      | rise                 | .52                    | until 0   | –     |
| 0    | CTA, link           | P3      | pop                  | .64, .72               | until 0   | –     |
| 0    | hint                | P3      | pop                  | .90                    | until 0   | –     |
| any  | CTA / link          | P17     | magnetic pull, press | spring per axis        | –         | key_down on press, click on release |
| any  | Start key           | P17     | see hero-start-motion.ts                                      |

AUTOPLAY — only after a press (click, Space, Enter); plain scrolling stays in the visitor's hands.
Input is held from the press until the story has landed, then handed back.
| t (s) | What happens                                               | Page                              |
|-------|------------------------------------------------------------|-----------------------------------|
| 0     | cap bottoms out (thock)                                    | held where it is                  |
| ~.1   | release: cap tops out (clack)                              | held                              |
| .22   | the clouds part; the key climbs up and back into the sky,  | travels to .95 screens, 1.7 s     |
|       | 1.6 s ease-in-out on its own clock (whoosh)                |                                   |
| ~2.0  | it hangs at the top for a breath                           | rests .3 s                        |
| ~2.3  | it falls through the clouds; the story arrives, the        | travels to 2.0 screens, 2.0 s     |
|       | keyboard springs up past its place and settles             |                                   |
| ~4.3  | settled on "From nothing."; scrolling is the visitor's     | unlocked                          |
Each leg travels on the shared spring curve. Reduced motion: one jump to the story.
Reduced motion: every node snaps; magnetic pull is off.
Phone: title and copy shrink.
*/

const LEAD=["MAKE","IT"],WORD="REAL";

export default function HeroPortal() {
  const host = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);

  // Title, copy and controls enter on the shared spring and leave upward once the journey begins.
  useEffect(() => {
    const root = section.current;
    if (!root) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const titleNodes = Array.from(root.querySelectorAll<HTMLElement>(".hero-start-title [data-beat]"));
    const copyNodes = Array.from(root.querySelectorAll<HTMLElement>(".hero-start-copy [data-beat], .hp-corner[data-beat]"));
    const title = createStagedMotion(titleNodes, { lag: .22 });
    const copy = createStagedMotion(copyNodes, { lag: .16 });
    const mountedAt = performance.now();
    let gone = false;
    // Everything enters as the page loader lifts away (or at once if there is none).
    let revealed = document.documentElement.dataset.loading !== "true";
    const onLeave = () => { revealed = true; wake(); };
    addEventListener("journey-loader-leave", onLeave);
    const job = (dt: number) => {
      gone = scrollY > innerHeight * .12;
      // The white title waits for the sky behind it; if WebGL never arrives it still comes in.
      const titleStage = gone ? 1 : revealed && (readyRef.current || performance.now() - mountedAt > 4000) ? 0 : -1;
      const a = title.update(titleStage, dt, reduced);
      const b = copy.update(gone ? 1 : revealed ? 0 : -1, dt, reduced);
      root.dataset.copyGone = String(gone);
      return a || b || titleStage < 0 || !revealed;
    };
    const dispose = addJob(job);
    const onScroll = () => { if ((scrollY > innerHeight * .12) !== gone) wake(); };
    addEventListener("scroll", onScroll, { passive: true });
    return () => { dispose(); removeEventListener("scroll", onScroll); removeEventListener("journey-loader-leave", onLeave); title.dispose(); copy.dispose(); };
  }, []);

  // Controls lean toward the pointer a little, each axis on its own spring, and spring home on leave.
  useEffect(() => {
    const root = section.current;
    if (!root || !matchMedia("(hover: hover) and (pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-magnetic]")).map(el => ({ el, x: createSpring(0), y: createSpring(0), gx: 0, gy: 0, last: "" }));
    const pull = (event: PointerEvent) => {
      for (const item of items) {
        const box = item.el.getBoundingClientRect(), reach = 28, strength = Number(item.el.dataset.magnetic || .22);
        const inside = event.clientX > box.left - reach && event.clientX < box.right + reach && event.clientY > box.top - reach && event.clientY < box.bottom + reach;
        item.gx = inside ? (event.clientX - (box.left + box.width / 2)) * strength : 0;
        item.gy = inside ? (event.clientY - (box.top + box.height / 2)) * strength * 1.2 : 0;
      }
      wake();
    };
    const release = () => { items.forEach(item => { item.gx = item.gy = 0; }); wake(); };
    const dispose = addJob(dt => {
      let moving = false;
      for (const item of items) {
        moving = item.x.step(item.gx, dt) || moving;
        moving = item.y.step(item.gy, dt) || moving;
        const text = `${item.x.value.toFixed(2)}px ${item.y.value.toFixed(2)}px`;
        if (text !== item.last) { item.last = text; item.el.style.translate = text; }
      }
      return moving;
    });
    addEventListener("pointermove", pull, { passive: true });
    document.documentElement.addEventListener("pointerleave", release);
    return () => { dispose(); removeEventListener("pointermove", pull); document.documentElement.removeEventListener("pointerleave", release); items.forEach(item => item.el.style.removeProperty("translate")); };
  }, []);

  useEffect(() => {
    const el = host.current, hero = section.current;
    if (!el || !hero) return;
    let disposed = false, run = 0;
    let release: (() => void) | undefined;
    const mount = () => {
      if (disposed || release) return;
      const id = ++run;
      import("./holographic-start-scene").then(async ({ mountStartScene }) => {
        if (disposed || id !== run) return;
        const done = await mountStartScene(el, () => { if (disposed || id !== run) return; readyRef.current = true; setReady(true); wake(); });
        if (disposed || id !== run) done(); else release = done;
      }).catch(() => { (["sky", "key", "frame"] as const).forEach(task => reportLoad(task, 1)); });
    };
    const unmount = () => { run++; release?.(); release = undefined; };
    // Phones: the hero holds two WebGL contexts, a model and cloud textures. Once the visitor
    // is far down the page it gives them back, so the scenes below have room, and rebuilds
    // while the visitor scrolls back up.
    const constrained = matchMedia("(any-pointer: coarse) and (max-width: 860px)").matches;
    // Builds within a screen and a half, releases beyond three: no rebuilds at the edge.
    const near = constrained ? new IntersectionObserver(([entry]) => { if (entry.isIntersecting) mount(); }, { rootMargin: `${innerHeight * 1.5}px 0px` }) : undefined;
    const keeper = constrained ? new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) unmount(); }, { rootMargin: `${innerHeight * 3}px 0px` }) : undefined;
    if (near && keeper) { near.observe(hero); keeper.observe(hero); } else mount();
    return () => { disposed = true; near?.disconnect(); keeper?.disconnect(); unmount(); };
  }, []);

  return <><section ref={section} className="hero-portal hero-start" aria-label="Start your journey">
    <div className="hero-start-viewport">
    <div ref={host} className={`hero-start-scene ${ready ? "is-ready" : ""}`}>
      <div className="hero-start-next" aria-hidden="true">
        <IsometricStory />
      </div>
      <h1 className={`hero-start-title ${heroDisplay.className}`} aria-label="Make it real">
        <span className="hp-lead" aria-hidden="true">{LEAD.map((word, i) => <span key={word} className="jm-m"><span className="jm-in" data-beat="0" data-until="0" data-delay={i * 70}>{word}</span>{i < LEAD.length - 1 ? " " : null}</span>)}</span>
        <strong aria-hidden="true">{WORD.split("").map((letter, i) => <span key={i} className="hp-mask"><span className="hp-letter" data-beat="0" data-until="0" data-delay={160 + i * 70}>{letter}</span></span>)}</strong>
      </h1>
    </div>
    <button className="hero-start-hit" aria-label="Press start to begin the journey" data-sfx="none" onClick={() => {
      const hero = host.current?.closest(".hero-start");
      if (!hero || !host.current || hero.hasAttribute("data-playing")) return;
      hero.dispatchEvent(new Event("hero-start-activate"));
      // The press plays the flight on its own and lands on the story; then the page is yours.
      const top = hero.getBoundingClientRect().top + window.scrollY, screen = host.current.clientHeight;
      hero.setAttribute("data-playing", "");
      playScroll([
        { top: window.scrollY, duration: .01, hold: .22 },
        { top: top + screen * .95, duration: 1.7, hold: .3 },
        { top: top + screen * 2.0, duration: 2 },
      ]).then(() => hero.removeAttribute("data-playing"));
    }} />
    <div className="hero-start-copy">
      <p><span className="jm-m jm-b"><span className="jm-in" data-beat="0" data-until="0" data-delay="520">Websites, apps and internal platforms, designed and built by one developer from the first call to launch.</span></span></p>
      <div className="hero-start-actions">
        <a className="hero-start-cta hp-pop" href="#contact" data-press="" data-magnetic=".2" data-beat="0" data-until="0" data-delay="640">
          <span className="hp-cta-label">Start a project</span>
          <span className="ic" aria-hidden="true">
            <svg viewBox="0 0 16 16"><path d="M4 12L12 4M5.5 4H12v6.5" /></svg>
            <svg viewBox="0 0 16 16"><path d="M4 12L12 4M5.5 4H12v6.5" /></svg>
          </span>
        </a>
        <a className="hero-start-link hp-pop" href="#project-archive" data-press="" data-magnetic=".16" data-beat="0" data-until="0" data-delay="720">
          See the work<sup aria-hidden="true">{String(FOLDER_CARDS.length).padStart(2, "0")}</sup>
        </a>
      </div>
    </div>
    <p className="hp-corner hp-hint hp-pop" data-beat="0" data-until="0" data-delay="900">
      <span className="hp-fine">Press <kbd aria-label="Space">Space</kbd> or scroll to begin</span>
      <span className="hp-touch">Tap Start or scroll to begin</span>
    </p>
    </div>
  </section>
  <div className="hero-cloud-bridge" aria-hidden="true">
    <div className="hero-cloud-bridge-bank" />
  </div></>;
}
