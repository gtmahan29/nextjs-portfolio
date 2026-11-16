import { createSpring } from "./motion-curve";

/**
 * Scroll-triggered, time-based staging for DOM copy.
 *
 * Every node tagged with data-beat (and optionally data-until / data-delay)
 * belongs to one beat of a scene. Scroll only decides which beat is on stage;
 * each node then springs on its own clock with the shared curve, so it always
 * overshoots and is caught, however the visitor scrolls.
 *
 * Writes two custom properties on each node:
 *   --e  0 waiting below its mask → 1 on stage
 *   --x  0 → 1 once its beat has passed (leaves upward)
 * Nothing fades; CSS turns these into translate, rotate and scale.
 */
export const BEFORE = -99;
export const AFTER = 99;

export function createStagedMotion(nodes: HTMLElement[], { lag = 0.16, initial = BEFORE } = {}) {
  const first = nodes.reduce((min, node) => Math.min(min, Number(node.dataset.beat ?? 0)), Infinity);
  const parts = nodes.map(node => {
    const beat = Number(node.dataset.beat ?? 0);
    return {
      node, beat,
      until: Number(node.dataset.until ?? beat),
      delay: Number(node.dataset.delay ?? 0) / 1000,
      // Copy already on stage when the page loads starts in place, without a jump.
      e: createSpring(beat <= initial ? 1 : 0), x: createSpring(0),
      eWant: beat <= initial ? 1 : 0, xWant: 0, eGoal: beat <= initial ? 1 : 0, xGoal: 0, eAt: 0, xAt: 0, eLast: -1, xLast: -1,
    };
  });
  let clock = 0;
  return {
    /** True while any node of this beat is at least partly on stage. */
    showing(beat: number) {
      return parts.some(p => p.beat <= beat && p.until >= beat && p.e.value > 0.001 && p.x.value < 0.999);
    },
    /** Advances every node toward `stage`. Returns true while anything still moves. */
    update(stage: number, dt: number, reduced = false) {
      clock += dt;
      let moving = false;
      for (const p of parts) {
        const wantE = p.beat <= stage ? 1 : 0;
        const wantX = p.until < stage ? 1 : 0;
        // Copy that is off stage and stays off stage (a beat skipped by a fast
        // scroll) is moved straight to its place instead of flashing through.
        const stayingOff = (!wantE || wantX) && (p.e.value <= 0.001 || p.x.value >= 0.999);
        if (stayingOff && (wantE !== p.eWant || wantX !== p.xWant)) {
          p.eWant = p.eGoal = wantE; p.xWant = p.xGoal = wantX;
          p.e.snap(wantE); p.x.snap(wantX); p.eAt = p.xAt = clock;
        }
        // A later beat waits a moment, so the outgoing copy is already on its way out.
        if (wantE !== p.eWant) { p.eWant = wantE; p.eAt = clock + (wantE ? p.delay + (p.beat > first ? lag : 0) : p.delay * 0.4); }
        if (wantX !== p.xWant) { p.xWant = wantX; p.xAt = clock + p.delay * 0.5; }
        if (clock >= p.eAt) p.eGoal = p.eWant; else moving = true;
        if (clock >= p.xAt) p.xGoal = p.xWant; else moving = true;
        if (reduced) { p.e.snap(p.eWant); p.x.snap(p.xWant); }
        else {
          moving = p.e.step(p.eGoal, dt) || moving;
          moving = p.x.step(p.xGoal, dt) || moving;
        }
        const e = p.e.value, x = p.x.value;
        if (Math.abs(e - p.eLast) > 0.0005) { p.eLast = e; p.node.style.setProperty("--e", e.toFixed(4)); }
        if (Math.abs(x - p.xLast) > 0.0005) { p.xLast = x; p.node.style.setProperty("--x", x.toFixed(4)); }
      }
      return moving;
    },
    dispose() { parts.forEach(p => { p.node.style.removeProperty("--e"); p.node.style.removeProperty("--x"); }); },
  };
}
