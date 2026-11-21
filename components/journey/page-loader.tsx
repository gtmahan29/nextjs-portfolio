"use client";
import { useEffect, useRef, useState } from "react";
import { springLinear } from "./motion-curve";
import { createLoaderArt } from "./loader-art";
import { play } from "./sfx";

/*
MOTION SCORE — page loader (light)
Trigger: page load. The loader keeps its own calm pace: one milestone every .8 s, never sooner;
a milestone waits for the content it names (it never reaches 100 before the page is ready).
At each milestone the page only sets goals (CSS custom properties); every move below is a CSS
transform on the shared spring, so it runs on the compositor and the 3D work loading on the main
thread cannot make it stutter. The centre shape is drawn in a worker for the same reason.

| Beat (milestone k)  | Element               | Pattern | Goal                                       | Delay (s)        | Sound               |
|---------------------|-----------------------|---------|--------------------------------------------|------------------|---------------------|
| paint               | wordmark, kicker      | P1      | rise out of their masks                    | .10, .16         | –                   |
| paint               | bar segments          | P4      | draw from the left                         | .30 + .07 each   | –                   |
| own clock (1.25 s)  | shape                 | P5a     | morph to the next loading form + turn      | –                | –                   |
| k                   | counter reels         | P10     | roll to the milestone's number             | 0 / .04 / .08    | –                   |
| k                   | segment fill + head   | P10     | fill to the milestone, head rides the tip  | 0                | –                   |
| k                   | status line           | P14     | old rises out, new rises in                | lag .16          | –                   |
| k (segment full)    | that segment          | P3      | pops (squash then settle)                  | .32              | –                   |
| k                   | station tick          | P3      | pops in its colour                         | .30              | –                   |
| waiting on content  | head halo, sheen      | P16     | breathe / travel                           | loop             | –                   |
| 100                 | bar                   | P13     | gaps close into one bar; head pops out     | .05 each         | –                   |
| 100                 | counter               | P10     | recentres for three digits                 | 0                | –                   |
| 100                 | shape → app tile, C   | P5a, P3 | the logo forms; the C pops                 | own              | ui_pop at C's catch |
| leave               | stage / panel         | P2 / P4 | the stage lifts faster than the panel      | 0 / .08          | –                   |
Reduced motion: everything snaps to its milestone; the panel leaves at once when ready.
Phone: smaller shape and counter; the kicker hides.
*/

const EASE = springLinear();
type Task = "fonts" | "sky" | "key" | "frame";
const WEIGHTS: Record<Task, number> = { fonts: .25, sky: .45, key: .2, frame: .1 };
/** What has arrived so far: a module store, so nothing reported before the loader mounts is lost. */
const done: Record<Task, number> = { fonts: 0, sky: 0, key: 0, frame: 0 };
export function reportLoad(task: Task, value: number) {
  done[task] = Math.max(done[task], Math.min(1, value));
}

const WORKERS = new WeakMap<HTMLCanvasElement, Worker>();
/** The calm pace: the first milestone after .35 s, then one every .8 s at most. */
const FIRST_S = .35, STEP_S = .8, MAX_S = 14;
/** Milestones: the number shown, the status line, and how much real loading it needs. */
const MILESTONES = [
  { pct: 9, label: 0, needs: 0 },
  { pct: 23, label: 1, needs: .2 },
  { pct: 38, label: 2, needs: .3 },
  { pct: 54, label: 2, needs: .5 },
  { pct: 71, label: 3, needs: .7 },
  { pct: 87, label: 4, needs: .85 },
  { pct: 100, label: 5, needs: 1 },
];
const STATUS = [
  { text: "Waking the studio", color: "#8b5cf6" },
  { text: "Setting the type", color: "#a855f7" },
  { text: "Painting the sky", color: "#ec4899" },
  { text: "Shaping the start key", color: "#f97316" },
  { text: "Framing the first scene", color: "#0ea5e9" },
  { text: "Ready", color: "#241839" },
];
const TICKS = [0, .2, .4, .6, .8, 1];
const SEEN = "codaine-loaded";
/** Runs before first paint: on a repeat visit the loader is hidden before it can flash. */
const SEEN_SCRIPT = `try{if(sessionStorage.getItem("${SEEN}"))document.documentElement.dataset.seen="1"}catch(e){}`;

export default function PageLoader() {
  const root = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const el = root.current, canvas = canvasRef.current;
    if (!el || !canvas) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = process.env.NODE_ENV !== "production" && new URLSearchParams(location.search).has("loaderHold");
    const html = document.documentElement;
    // Seen once this session: no loader, the hero is on screen at once.
    if (!hold && html.dataset.seen) {
      const warm = () => { (window as unknown as { __sceneWarm?: boolean }).__sceneWarm = true; window.dispatchEvent(new Event("scene-warm")); };
      if ("requestIdleCallback" in window) window.requestIdleCallback(warm, { timeout: 2000 }); else setTimeout(warm, 1000);
      setGone(true);
      return;
    }
    try { sessionStorage.setItem(SEEN, "1"); } catch { /* storage unavailable */ }
    html.dataset.loading = "true";
    window.dispatchEvent(new CustomEvent("smooth-scroll-hold", { detail: true }));
    const start = performance.now();
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => { timers.push(window.setTimeout(fn, ms)); };
    let caughtC = false, leaving = false, finished = false, logoAt = 0, step = -1, lastStepAt = 0;

    // The shape: in a worker where possible, otherwise on this thread.
    const size = canvas.clientWidth || 300, dpr = Math.min(2, devicePixelRatio || 1);
    let worker: Worker | undefined, local: ReturnType<typeof createLoaderArt> | undefined, artRaf = 0;
    const onCatch = (s: number) => { if (s === 99 && !caughtC) { caughtC = true; play("ui_pop"); } };
    // A canvas can be handed to a worker only once; React's dev double-mount reuses that worker.
    worker = WORKERS.get(canvas);
    if (!worker && "transferControlToOffscreen" in canvas) {
      try {
        const w = new Worker(new URL("./loader-art.worker.ts", import.meta.url));
        const off = canvas.transferControlToOffscreen();
        w.postMessage({ type: "init", canvas: off, size, dpr, reduced }, [off]);
        WORKERS.set(canvas, w); worker = w;
      } catch { worker = undefined; }
    }
    if (worker) worker.onmessage = (e: MessageEvent<{ type: string; step: number }>) => { if (e.data.type === "catch") onCatch(e.data.step); };
    if (!worker && !WORKERS.has(canvas)) {
      canvas.width = canvas.height = Math.round(size * dpr);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        local = createLoaderArt(ctx, onCatch); local.resize(size, dpr); local.setReduced(reduced);
        let last = 0;
        const loop = (now: number) => { local!.frame(last ? (now - last) / 1000 : 0); last = now; artRaf = requestAnimationFrame(loop); };
        artRaf = requestAnimationFrame(loop);
      }
    }
    const send = (s: number) => { worker?.postMessage({ type: "step", step: s }); local?.goTo(s); };
    send(0);

    const real = () => (Object.keys(WEIGHTS) as Task[]).reduce((sum, k) => sum + WEIGHTS[k] * done[k], 0);
    const ready = () => done.fonts >= 1 && done.sky >= 1;
    const finish = () => {
      if (finished) return;
      finished = true;
      worker?.postMessage({ type: "stop" }); worker?.terminate(); cancelAnimationFrame(artRaf);
      window.dispatchEvent(new Event("journey-loader-done"));
      // Later scenes build in the background once the hero is on screen.
      const warm = () => { (window as unknown as { __sceneWarm?: boolean }).__sceneWarm = true; window.dispatchEvent(new Event("scene-warm")); };
      if ("requestIdleCallback" in window) window.requestIdleCallback(warm, { timeout: 2000 }); else setTimeout(warm, 1000);
      setGone(true);
    };
    const leave = () => {
      if (leaving) return;
      leaving = true;
      delete html.dataset.loading;
      window.dispatchEvent(new CustomEvent("smooth-scroll-hold", { detail: false }));
      window.dispatchEvent(new Event("journey-loader-leave"));
      if (reduced) { el.style.display = "none"; at(0, finish); return; }
      el.dataset.state = "leave";
      at(1500, finish);
    };

    const labels = Array.from(el.querySelectorAll<HTMLElement>(".pl-label"));
    const segs = Array.from(el.querySelectorAll<HTMLElement>(".pl-seg"));
    const ticks = Array.from(el.querySelectorAll<HTMLElement>(".pl-tick"));
    const goTo = (k: number) => {
      const m = MILESTONES[k], p = m.pct / 100;
      // Goals only: CSS moves everything on the compositor.
      el.style.setProperty("--p", String(p));
      el.style.setProperty("--o", String(m.pct));
      el.style.setProperty("--t", String(Math.floor(m.pct / 10)));
      el.style.setProperty("--h", String(m.pct >= 100 ? 1 : 0));
      el.style.setProperty("--hs", "1");
      el.style.setProperty("--glow", STATUS[m.label].color);
      labels.forEach((l, i) => { l.dataset.s = i < m.label ? "past" : i === m.label ? "now" : "next"; });
      segs.forEach((s, i) => { if (p * 5 - i >= .999) s.dataset.full = ""; });
      ticks.forEach((t, i) => { if (TICKS[i] <= p + 1e-6) t.dataset.on = ""; });
      if (m.pct >= 100) { el.dataset.done = ""; logoAt = performance.now(); send(6); at(1600, () => { caughtC = true; check(); }); }
    };

    function check() {
      if (leaving) return;
      const t = (performance.now() - start) / 1000, forced = t > MAX_S;
      const next = step + 1;
      if (next < MILESTONES.length) {
        const due = t >= (step < 0 ? FIRST_S : lastStepAt + STEP_S);
        const m = MILESTONES[next];
        const allowed = forced || (m.pct >= 100 ? ready() && real() >= .9 : real() >= m.needs || (next <= 1 && done.fonts >= 1));
        if (due && (allowed || reduced && ready())) { step = next; lastStepAt = t; goTo(step); }
      }
      // The panel leaves once the logo has formed and its C has popped.
      if (!hold && logoAt && (caughtC || reduced) && performance.now() - logoAt > 900) leave();
    }
    document.fonts?.ready.then(() => reportLoad("fonts", 1));
    const poll = window.setInterval(check, 50);
    return () => {
      window.clearInterval(poll);
      timers.forEach(window.clearTimeout);
      cancelAnimationFrame(artRaf);
      if (!leaving) { delete html.dataset.loading; window.dispatchEvent(new CustomEvent("smooth-scroll-hold", { detail: false })); }
    };
  }, []);

  if (gone) return null;
  return (
    <>
    <script dangerouslySetInnerHTML={{ __html: SEEN_SCRIPT }} />
    <div ref={root} className="pl-root" role="status" aria-label="Loading Codaine" style={{ "--pl-ease": EASE } as React.CSSProperties}>
      <div className="pl-glow" aria-hidden="true" />
      <div className="pl-top">
        <span className="pl-m"><svg className="pl-wordmark" viewBox="0 0 2316 396" aria-label="Codaine"><use href="#jny-wm" /></svg></span>
        <span className="pl-m pl-kicker"><span>From idea to launch</span></span>
      </div>
      <div className="pl-stage">
        <canvas ref={canvasRef} className="pl-art" aria-hidden="true" />
        <div className="pl-progress" aria-hidden="true">
          <div className="pl-count">
            <span className="pl-col" data-c="h"><span className="pl-reel"><span /><span>1</span></span></span>
            <span className="pl-col" data-c="t">
              <span className="pl-reel">{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, i) => <span key={i}>{d}</span>)}</span>
            </span>
            <span className="pl-col" data-c="o">
              <span className="pl-reel">{Array.from({ length: 101 }, (_, i) => <span key={i}>{i % 10}</span>)}</span>
            </span>
            <span className="pl-unit">%</span>
          </div>
          <div className="pl-labels">
            {STATUS.map((s, i) => (
              <span key={s.text} className="pl-label" data-s={i === 0 ? "now" : "next"}>
                {i < STATUS.length - 1 && <b>0{i + 1}/05</b>}{s.text}
              </span>
            ))}
          </div>
          <div className="pl-track">
            <div className="pl-bar">
              {[0, 1, 2, 3, 4].map(i => <span key={i} className="pl-seg" style={{ "--i": i } as React.CSSProperties}><i /></span>)}
            </div>
            <span className="pl-head" />
            <div className="pl-ticks">
              {TICKS.map((x, i) => (
                <span key={i} className="pl-tick" style={{ "--x": x, "--c": STATUS[Math.min(5, i)].color } as React.CSSProperties}><i /></span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
