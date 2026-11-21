import { createSpring } from "./motion-curve";

/*
MOTION SCORE — hero Start key (a mechanical switch with the Codaine C on its cap)
Trigger: pointer / keyboard on the key, then the press plays the flight on its own (see
hero-portal.tsx); plain scrolling drives the same flight by hand.

The cap stands tall out of its chassis (RAISE in holographic-start-scene.ts), so the press has a
long travel; the kicks are strong enough that the whole travel still takes about 0.1 s.

| Event              | Element      | Pattern | Goal                                          | Timing                     | Sound              |
|--------------------|--------------|---------|-----------------------------------------------|----------------------------|--------------------|
| hover              | cap          | P17     | sinks 4% (a finger resting on it)             | spring                     | –                  |
| pointer-down       | cap          | P17     | a fast push (kick 16) to the tactile bump     | ~30 ms                     | key_down (tick)    |
| tactile bump       | cap          | P17     | hesitates 30 ms at 28% depth, then snaps      | at 28%                     | –                  |
|                    |              |         | through (kick 30)                             |                            |                    |
| bottom-out         | cap          | P17     | hard stop, gives back 10%, the spring catches | at contact                 | key_thock          |
| bottom-out         | surface      | P16     | outside the key: two soft rings leave its     | 0 → 1.6 s                  | – (the thock)      |
|                    | around key   |         | foot and spread over an invisible surface,    |                            |                    |
|                    |              |         | slowing and widening; a faint glow diffuses   |                            |                    |
|                    |              |         | under them (sqrt(t)) and thins into the sky   |                            |                    |
| bottom-out         | edge light   | –       | the cyan edge flashes and fades               | same clock                 | –                  |
| release            | cap          | P17     | push-lock: rises a hair, latch catches at 86% | ≥ 90 ms after the press    | key_up at the catch|
| slide off / cancel | cap          | P17     | returns to rest, nothing launches             | spring                     | key_up at top-out  |
| lift (> .12)       | key          | travel  | rises up and back into the sky, turning its   | 1.6 s ease-in-out, own     | key_whoosh         |
|                    |              |         | face (and the Codaine tile) to the camera;    | clock (scroll starts it)   |                    |
|                    |              |         | it shrinks as it goes                         |                            |                    |
| launch             | key          | P17     | stretches along its path, caught by the       | squash spring, kick −2.6   | –                  |
|                    |              |         | squash spring                                 |                            |                    |
| lift               | camera       | –       | follows at 40% of the key's travel, a beat    | time lag 0.32 s            | –                  |
|                    |              |         | behind: the key outruns it                    |                            |                    |
| hang (top)         | key          | –       | rests at the top until the scroll reaches     | until HERO.fall            | –                  |
|                    |              |         | HERO.fall                                     |                            |                    |
| fall (HERO.fall)   | key          | –       | tumbles down through the clouds under gravity | y = ½ g t², 1.24 s         | –                  |
| after the fall     | keyboard     | –       | springs up past its place and settles         | shared spring (story file) | –                  |
| back at the top    | cap          | P17     | unlatches and returns to rest                 | spring                     | key_up at top-out  |
A click that is shorter than the travel still bottoms out first, as a real key does.
Reduced motion: the cap snaps to each goal; no ripple; the camera snaps to its follow point.
Phone: same choreography; the camera starts further back (see resize()).
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
/** The key's climb: eases in without a dead start, and eases out long and soft at the top. */
const climb = bezier(.42, 0, .2, 1);
const phase = (units: number, start: number, end: number) => clamp((units - start) / (end - start));

export type CapEvent = "down" | "contact" | "top-out";
type Mode = "idle" | "held" | "launched";

const HOVER = .04;
/** A kick of v travels about v / damping on its own: 22 reaches the floor in a few frames. */
const DOWN_KICK = 16, SNAP_KICK = 30, RELEASE_KICK = -15, REBOUND = .1;
/** The tactile bump: where the switch resists, and for how long. */
const BUMP_AT = .28, BUMP_HOLD = .03;
/** Pressed for good: the latch holds the cap at this depth, catching it after a small rise. */
const LATCH = .86, LATCH_KICK = -1.2;
/** The housing stops the stem just above rest on the way back up: the top-out. */
const CEILING = -.045;
/** A release never comes before the stem has bottomed out and rested this long. */
const MIN_HOLD = .09;
/** The press light (diluting through the glass) and the edge flash run this long after the bottom-out. */
export const RIPPLE_S = 1.6;
/** The flight has its own clock: scroll starts it, time carries it, ease-in-out from end to end. */
const LIFT_S = 1.6, LIFT_AT = .12;
/**
 * Where the hero's chapters sit, in screens of scroll: the key rises (from LIFT_AT), hangs, falls
 * through the clouds (from fall), the build story follows the fall, and the clouds take it back
 * at the end. isometric-story.tsx and holographic-start-scene.ts read these too.
 */
export const HERO = { fall: 1.05, story: 1.6, storySpan: 3.02, leave: 4.93, storyEnd: 5.83 } as const;
/** The fall plays on its own clock once started: y = ½ g t². */
const FALL_S = 1.24;

/** The cap has its own clock and its own physics; the camera-space story follows scroll. */
export function createStartMotion() {
  let mode: Mode = "idle";
  let hovering = false, requested = false, launchWanted = false, contacted = false, leftTop = false;
  let sinceDown = 0, sinceContact = Infinity;
  let units = 0, initialized = false, liftClock = 0, fallStarted = false, fallElapsed = 0, armedTopOut = false, armedLatch = false;
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
          liftClock = rawUnits > LIFT_AT ? LIFT_S : 0;
          if (rawUnits > HERO.story) { fallStarted = true; fallElapsed = FALL_S; }
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
      // Past the start line the key rises on its own clock, so a surge of scroll cannot rush it;
      // back above the line it sinks home the same way.
      const rising = mode === "launched" && units > LIFT_AT;
      liftClock = reduced ? (rising ? LIFT_S : 0) : Math.max(0, Math.min(LIFT_S, liftClock + (rising ? dt : -1.3 * dt)));
      const lift = review ? travel(phase(units, LIFT_AT, HERO.fall - .1)) : climb(liftClock / LIFT_S);
      // The fall waits for the key to reach the top of its climb (it hangs there for a breath).
      if (!fallStarted && units >= HERO.fall && mode === "launched" && (review || liftClock >= LIFT_S - .05)) fallStarted = true;
      if (fallStarted) {
        if (units < HERO.fall - .08) { fallElapsed = Math.max(0, fallElapsed - dt * 1.6); if (fallElapsed === 0) fallStarted = false; }
        else fallElapsed = Math.min(FALL_S, fallElapsed + dt);
      }
      // y = 1/2 g t²: scroll starts the fall; gravity supplies its speed.
      const fallTime = review ? phase(units, HERO.fall, HERO.story) : clamp(fallElapsed / .76);
      const drop = fallTime * fallTime;
      // The clouds part with the climb, a step ahead of it, so the key rises into open sky.
      const clearing = Math.max(review ? travel(phase(units, .2, HERO.fall)) : climb(liftClock / (LIFT_S * .85)), review ? fallTime : clamp(fallElapsed / .45));
      const returning = cloudReturn(phase(units, HERO.leave, HERO.leave + 1.4));
      // The story arrives once the key has fallen through the clouds.
      const contentIn = out(review ? phase(units, HERO.story + .04, HERO.story + .48) : clamp((fallElapsed - .88) / .36));
      const contentOut = travel(phase(units, HERO.leave, HERO.leave + .67));
      const impact = sinceContact < RIPPLE_S ? sinceContact / RIPPLE_S : -1;
      return {
        units, cap: cap.value, lift, drop, fallTime, impact,
        cloudCoverage: (1 - clearing) * (1 - returning) + returning,
        cloudArrival: returning, whiteout: travel(phase(units, HERO.leave + .85, HERO.leave + 1.51)),
        contentOpacity: contentIn * (1 - contentOut), contentY: 24 * (1 - contentIn) - 18 * contentOut,
        // The bottom-out shoves the whole object down a touch, then the mount recovers.
        impulse: !reduced && sinceContact < .5 ? .085 * Math.sin(Math.min(1, sinceContact / .31) * Math.PI) * Math.exp(-5 * sinceContact) : 0,
        /** The pressed object is real: true from the release (launch) on. */
        real: mode === "launched",
        mode, interactive: mode === "idle" || mode === "held",
        stage: lift <= 0 ? mode : lift < 1 ? "lift" : !fallStarted ? "suspend" : drop < 1 ? "fall" : units < HERO.leave ? "content" : "cloud-return",
        active: capMoving || (liftClock > 0 && liftClock < LIFT_S) || (fallStarted && (fallElapsed < FALL_S || units < HERO.fall)) || mode === "held" || sinceContact < RIPPLE_S || Math.abs(destination - units) > .0001,
      };
    },
  };
}
