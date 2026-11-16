import { createSpring } from "./motion-curve";
import { createStagedMotion, BEFORE } from "./staged-motion";

/**
 * One requestAnimationFrame loop for the closing chapters. Each job advances
 * its springs by real elapsed time and returns true while it still moves; the
 * loop sleeps once every job has settled.
 */
type Job = (dt: number) => boolean;
const jobs = new Set<Job>();
let raf = 0;
let last = 0;

function frame(now: number) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  let moving = false;
  jobs.forEach(job => { if (job(dt)) moving = true; });
  raf = moving ? requestAnimationFrame(frame) : 0;
}

/** Wakes the loop. A job stays registered until its disposer runs. */
export function wake() {
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
}
export function addJob(job: Job) {
  jobs.add(job);
  wake();
  return () => { jobs.delete(job); };
}

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A surface that travels to whichever item is active and takes its size.
 * Position and size are four springs on the shared curve, so on the way it
 * stretches toward the target and, past it, is squashed and caught. The
 * stretch is the overshoot itself: one motion, not a bounce added on top.
 */
export function createCapsule(capsule: HTMLElement, host: HTMLElement) {
  const x = createSpring(0), y = createSpring(0), w = createSpring(0), h = createSpring(0), s = createSpring(0);
  let target: HTMLElement | null = null, first = true;
  const job: Job = dt => {
    const hostBox = host.getBoundingClientRect();
    let gx = x.value, gy = y.value, gw = w.value, gh = h.value;
    if (target) {
      const box = target.getBoundingClientRect();
      gx = box.left - hostBox.left; gy = box.top - hostBox.top; gw = box.width; gh = box.height;
      if (first) { x.snap(gx); y.snap(gy); w.snap(gw); h.snap(gh); first = false; }
    }
    const still = reduced();
    let moving = false;
    for (const [spring, goal] of [[x, gx], [y, gy], [w, gw], [h, gh], [s, target ? 1 : 0]] as const) {
      if (still) spring.snap(goal); else moving = spring.step(goal, dt) || moving;
    }
    const scale = Math.max(0, s.value);
    // Speed stretches it along its path and thins it across; the same springs' overshoot
    // reverses the speed, so the catch squashes it the other way before it settles.
    const vx = Math.abs(x.velocity) + Math.abs(w.velocity) * 0.5, vy = Math.abs(y.velocity) + Math.abs(h.velocity) * 0.5;
    const sw = Math.max(0, w.value) * (1 + Math.min(0.28, vx / 1500) - Math.min(0.08, vy / 4000));
    const sh = Math.max(0, h.value) * (1 + Math.min(0.42, vy / 700) - Math.min(0.14, vx / 3000));
    const px = x.value - (sw - w.value) / 2, py = y.value - (sh - h.value) / 2;
    capsule.style.transform = `translate3d(${px.toFixed(2)}px,${py.toFixed(2)}px,0) scale(${scale.toFixed(4)})`;
    capsule.style.width = `${sw.toFixed(2)}px`;
    capsule.style.height = `${sh.toFixed(2)}px`;
    capsule.style.visibility = scale < 0.002 ? "hidden" : "visible";
    // A target whose own size is still changing (an answer opening) keeps the loop awake.
    return moving || !!target?.querySelector("[data-growing]");
  };
  const dispose = addJob(job);
  return {
    to(el: HTMLElement | null) { if (el && !target) first = s.value < 0.01; target = el; wake(); },
    dispose,
  };
}

/** A height that springs to the content it holds: the overshoot is the reveal's pop. */
export function createHeight(el: HTMLElement, inner: HTMLElement, initialOpen = false, varHost: HTMLElement = el) {
  const h = createSpring(initialOpen ? 1 : 0);
  let open = initialOpen;
  const job: Job = dt => {
    const full = inner.offsetHeight;
    const still = reduced();
    const moving = still ? (h.snap(open ? 1 : 0), false) : h.step(open ? 1 : 0, dt);
    el.style.height = `${Math.max(0, h.value * full).toFixed(2)}px`;
    varHost.style.setProperty("--o", h.value.toFixed(4));
    if (moving) el.dataset.growing = "1"; else delete el.dataset.growing;
    return moving;
  };
  const dispose = addJob(job);
  return { set(next: boolean) { open = next; wake(); }, dispose };
}

/**
 * Stages a section's copy as it scrolls in: every [data-beat] node springs onto
 * stage when the section's top passes `at` of the viewport, and is put back
 * below its mask only once the section is entirely below the viewport again.
 */
export function stageOnEnter(section: HTMLElement, nodes: HTMLElement[], { at = 0.74, lag = 0.16, onEnter }: { at?: number; lag?: number; onEnter?: () => void } = {}) {
  const motion = createStagedMotion(nodes, { lag });
  let stage = BEFORE;
  const job: Job = dt => {
    const top = section.getBoundingClientRect().top;
    const next = top < innerHeight * at ? 0 : top > innerHeight ? BEFORE : stage;
    if (next !== stage) { if (next === 0) onEnter?.(); stage = next; }
    return motion.update(stage, dt, reduced());
  };
  const dispose = addJob(job);
  const io = new IntersectionObserver(() => wake(), { threshold: [0, 0.1, 0.3] });
  io.observe(section);
  const onScroll = () => wake();
  addEventListener("scroll", onScroll, { passive: true });
  return () => { dispose(); io.disconnect(); removeEventListener("scroll", onScroll); motion.dispose(); };
}
