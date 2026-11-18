import { BEFORE, AFTER } from "./staged-motion";

/**
 * Beat governor: the scroll picks a beat, the governor decides which beat is on stage.
 *
 * A touch flick can carry a pinned story through several beats in a fraction of a second.
 * Instead of snapping past them, the stage plays the skipped beats in order while the story
 * is still on screen. Scrolling itself stays native, at the finger's own speed.
 *
 * - Ordinary scrolling passes straight through: a beat that has been on stage for `dwell`
 *   seconds hands over at once.
 * - Behind by several beats, each one waits less (`budget / gap`, never under `minDwell`),
 *   so catching up stays within about `budget` seconds.
 * - Further behind than `replay` beats, the oldest snap and only the last `replay` play.
 * - Off screen, under reduced motion, or on the way out (BEFORE / AFTER), it snaps:
 *   nothing animates where it cannot be seen.
 * - Arriving from BEFORE (or from AFTER, scrolling back) it starts at the story's first
 *   (or last) beat, so the opening is played too.
 */
export type BeatGovernor = {
  /** Feeds the beat the scroll picked; returns the beat to put on stage this frame. */
  step(target: number, dt: number, live: boolean, reduced: boolean): number;
  /** True while the stage is still behind the scroll (keep the frame loop running). */
  readonly pending: boolean;
};

const SENTINEL = (b: number) => b <= BEFORE || b >= AFTER;

export function createBeatGovernor({
  first = 0,
  last,
  dwell = 0.62,
  minDwell = 0.38,
  budget = 1.9,
  replay = 3,
}: { first?: number; last: number; dwell?: number; minDwell?: number; budget?: number; replay?: number }): BeatGovernor {
  let shown = BEFORE, target = BEFORE, held = Infinity;
  const put = (beat: number) => { shown = beat; held = 0; };
  return {
    get pending() { return shown !== target; },
    step(next, dt, live, reduced) {
      target = next;
      held += dt;
      if (shown === target) return shown;
      if (reduced || !live || SENTINEL(target)) { put(target); return shown; }
      // Entering the story: start at its edge, then play inward like any other catch-up.
      if (SENTINEL(shown)) {
        const edge = shown <= BEFORE ? first : last;
        put(Math.abs(target - edge) > replay ? target - Math.sign(target - edge) * replay : edge);
        return shown;
      }
      const dir = Math.sign(target - shown);
      let gap = Math.abs(target - shown);
      if (gap > replay) { put(target - dir * replay); gap = replay; return shown; }
      const wait = gap === 1 ? dwell : Math.max(minDwell, Math.min(dwell, budget / gap));
      if (held >= wait) put(shown + dir);
      return shown;
    },
  };
}
