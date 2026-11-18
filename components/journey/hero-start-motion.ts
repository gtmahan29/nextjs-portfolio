import { createSpring } from "./motion-curve";

/*
MOTION SCORE — hero Start key (a mechanical switch)
Trigger: pointer / keyboard on the key, then the press plays the flight on its own (see
hero-autoplay.ts); plain scrolling drives the same flight by hand.

| Event              | Element | Pattern | Goal                                          | Timing                     | Sound              |
|--------------------|---------|---------|-----------------------------------------------|----------------------------|--------------------|
| hover              | cap     | P17     | sinks 4% (a finger resting on it)             | spring                     | –                  |
| pointer-down       | cap     | P17     | a lighter push (kick 10) to the tactile bump  | ~40 ms                     | key_down (tick)    |
| tactile bump       | cap     | P17     | hesitates 45 ms at 32% depth (the leaf's      | at 32%                     | –                  |
|                    |         |         | resistance), then snaps through (kick 20)     |                            |                    |
| bottom-out         | cap     | P17     | hard stop, gives back 10%, the spring catches | at contact                 | key_thock          |
| held               | cap     | –       | stays down                                    | while the finger is down   | –                  |
| release            | cap     | P17     | stays pressed: a push-lock switch. The stem   | after contact, ≥ 90 ms     | key_up at the catch|
|                    |         |         | rises a hair (kick −1.2), the latch catches  | after the press began      |                    |
|                    |         |         | it at 86% depth; the overshoot is the catch   |                            |                    |
| slide off / cancel | cap     | P17     | returns to rest, nothing launches             | spring                     | key_up at top-out  |
| scroll (no press)  | cap     | P17     | the same press: down, contact, latched        | as above                   | thock, key_up      |
| back at the top    | cap     | P17     | unlatches and returns to rest                 | spring                     | key_up at top-out  |
A click that is shorter than the travel still bottoms out first, as a real key does.
Reduced motion: the cap snaps to each goal; contact still fires once (for the flash).
*/

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** CSS cubic-bezier timing, including the x-axis inversion. Used only for scroll-scrubbed camera travel. */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const axis = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
  return (value: number) => {
    const x = clamp(value); if (x === 0 || x === 1) return x;
    let low = 0, high = 1;
    for (let i = 0; i < 16; i++) { const t = (low + high) / 2; if (axis(t, x1, x2) < x) low = t; else high = t; }
    return axis((low + high) / 2, y1, y2);
  };
}

const out = bezier(.23, 1, .32, 1);
const travel = bezier(.77, 0, .175, 1);
const cloudReturn = bezier(.42, 0, .25, 1);
const phase = (units: number, start: number, end: number) => clamp((units - start) / (end - start));

export type CapEvent = "down" | "contact" | "top-out";
type Mode = "idle" | "held" | "launched";

const HOVER = .04;
/** A kick of v travels about v / damping on its own: 22 reaches the floor in a few frames. */
const DOWN_KICK = 10, SNAP_KICK = 20, RELEASE_KICK = -15, REBOUND = .1;
/** The tactile bump: where the switch resists, and for how long. */
const BUMP_AT = .32, BUMP_HOLD = .045;
/** Pressed for good: the latch holds the cap at this depth, catching it after a small rise. */
const LATCH = .86, LATCH_KICK = -1.2;
/** The housing stops the stem just above rest on the way back up: the top-out. */
const CEILING = -.045;
/** A release never comes before the stem has bottomed out and rested this long. */
const MIN_HOLD = .09;

/** The cap has its own clock and its own physics; the camera-space story follows scroll. */
export function createStartMotion() {
  let mode: Mode = "idle";
  let hovering = false, requested = false, launchWanted = false, contacted = false, leftTop = false;
  let sinceDown = 0, sinceContact = Infinity;
  let units = 0, initialized = false, fallStarted = false, fallElapsed = 0, armedTopOut = false, armedLatch = false;
  let bump = 0, bumpAt = 0;
  const cap = createSpring(0);
  const events: CapEvent[] = [];
  const down = () => {
    mode = "held"; contacted = false; sinceDown = 0; armedTopOut = false; bump = 0;
    cap.kick(DOWN_KICK); events.push("down");
  };
  return {
    hover(on: boolean) { hovering = on; },
    /** Finger or key is down: the cap travels all the way and stays there. */
    down() { if (mode === "idle") { launchWanted = false; down(); } },
    /** Finger slid off, or the press was abandoned: the cap returns and nothing launches. */
    cancel() { if (mode === "held" && !launchWanted) { mode = "idle"; armedTopOut = contacted; cap.kick(RELEASE_KICK); } },
    /** The press counts: release the key (after it has bottomed out) and launch. */
    activate() { requested = true; },
    /** Sounds and effects that belong to the physical events of this frame. */
    drain() { return events.splice(0); },
    update(rawUnits: number, dt: number, ready: boolean, reduced: boolean, review = false) {
      if (!initialized && ready) {
        initialized = true;
        if (rawUnits > 1 || (review && rawUnits > .015)) {
          mode = "launched"; cap.snap(LATCH); sinceContact = 9; units = rawUnits; leftTop = true;
          if (rawUnits > 2.12) { fallStarted = true; fallElapsed = 1.24; }
        }
      }
      // A click, Space, Enter or the first scroll: a full press, then launch.
      if (ready && mode !== "launched" && (rawUnits > .015 || requested)) {
        requested = false; launchWanted = true;
        if (mode === "idle") down();
      }
      requested = mode === "launched" ? false : requested;
      sinceDown += dt; sinceContact += dt;
      if (mode === "held" && launchWanted && (contacted || reduced || sinceDown > .25) && sinceDown >= MIN_HOLD) {
        // The finger lifts, the stem rises a hair and the latch catches it: the key stays pressed.
        mode = "launched"; launchWanted = false; leftTop = false; armedLatch = true;
        if (!reduced) cap.kick(LATCH_KICK);
      }
      // Back at the top resets the key, but only once the page has actually left it: the pause
      // between the release and the flight must not read as a fresh press.
      if (mode === "launched" && rawUnits > .08) leftTop = true;
      if (mode === "launched" && leftTop && rawUnits < .004 && !review) { mode = "idle"; armedTopOut = true; }

      const goal = mode === "held" ? 1 : mode === "launched" ? LATCH : hovering ? HOVER : 0;
      let capMoving = false;
      if (reduced) {
        cap.snap(goal);
        if (mode === "held" && !contacted) { contacted = true; sinceContact = 0; events.push("contact"); }
      } else {
        capMoving = cap.step(goal, dt);
        // The tactile bump: the stem meets the leaf, hesitates, then snaps through to the floor.
        if (mode === "held" && bump === 0 && cap.value > BUMP_AT) { bump = 1; bumpAt = sinceDown; cap.kick(-cap.velocity * .7); }
        if (mode === "held" && bump === 1 && sinceDown - bumpAt > BUMP_HOLD) { bump = 2; cap.kick(SNAP_KICK); }
        // The switch has a floor: the cap stops hard, gives back a little energy, and the spring catches it.
        if (cap.value > 1) {
          const v = cap.velocity;
          cap.snap(1);
          if (v > .4) cap.kick(-v * REBOUND);
          if (!contacted) { contacted = true; sinceContact = 0; events.push("contact"); }
        }
        // Coming back up, the stem meets the housing: a hard stop, a little energy back, caught.
        if (cap.value < CEILING) {
          const v = cap.velocity;
          cap.snap(CEILING);
          if (v < -.4) cap.kick(-v * REBOUND * .6);
          if (armedTopOut && v < -.6) { armedTopOut = false; events.push("top-out"); }
        }
      }
      // The latch catches the rising stem: the moment its rise turns back is the click.
      if (armedLatch && (reduced || cap.velocity >= 0)) { armedLatch = false; events.push("top-out"); }
      // Coming back up, the cap passes its rest height and taps the housing: one soft top-out.
      if (armedTopOut && cap.velocity < -.6 && cap.value < .04) { armedTopOut = false; events.push("top-out"); }

      const destination = mode === "launched" ? rawUnits : Math.min(rawUnits, .20);
      units = reduced || review ? destination : units + (destination - units) * (1 - Math.exp(-dt / .12));
      const lift = travel(phase(units, .25, 1.15));
      if (!fallStarted && units >= 1.38 && mode === "launched") fallStarted = true;
      if (fallStarted) {
        if (units < 1.30) { fallElapsed = Math.max(0, fallElapsed - dt * 1.6); if (fallElapsed === 0) fallStarted = false; }
        else fallElapsed = Math.min(1.24, fallElapsed + dt);
      }
      // y = 1/2 g t²: scroll starts the fall; gravity supplies its speed.
      const fallTime = review ? phase(units, 1.38, 2.12) : clamp(fallElapsed / .76);
      const drop = fallTime * fallTime;
      const clearing = Math.max(travel(phase(units, .40, 1.70)), review ? fallTime : clamp(fallElapsed / .45));
      const returning = cloudReturn(phase(units, 5.45, 6.85));
      const contentIn = out(review ? phase(units, 2.16, 2.60) : clamp((fallElapsed - .88) / .36));
      const contentOut = travel(phase(units, 5.45, 6.12));
      const impact = sinceContact < .46 ? sinceContact / .46 : -1;
      return {
        units, cap: cap.value, lift, drop, fallTime, impact,
        cloudCoverage: (1 - clearing) * (1 - returning) + returning,
        cloudArrival: returning, whiteout: travel(phase(units, 6.3, 6.96)),
        contentOpacity: contentIn * (1 - contentOut), contentY: 24 * (1 - contentIn) - 18 * contentOut,
        // The bottom-out shoves the whole object down a touch, then the mount recovers.
        impulse: !reduced && sinceContact < .5 ? .085 * Math.sin(Math.min(1, sinceContact / .31) * Math.PI) * Math.exp(-5 * sinceContact) : 0,
        /** The pressed object is real: true from the release (launch) on. */
        real: mode === "launched",
        mode, interactive: mode === "idle" || mode === "held",
        stage: units < .25 ? mode : units < 1.15 ? "lift" : units < 1.38 ? "suspend" : drop < 1 ? "fall" : units < 5.45 ? "content" : "cloud-return",
        active: capMoving || (fallStarted && (fallElapsed < 1.24 || units < 1.30)) || mode === "held" || sinceContact < .6 || Math.abs(destination - units) > .0001,
      };
    },
  };
}
