/**
 * One motion curve for the journey page.
 *
 * Everything that moves, whether driven by scroll, a click or a CSS transition,
 * follows this one under-damped spring: a heavy start, a ~5% overshoot, then a
 * catch onto the final value. Nothing is linear.
 *
 * To swap in a hand-drawn curve, change it here only. The CSS custom property
 * --ease-spring is generated from springCurve() at runtime (see MotionSetup),
 * so stylesheets never carry their own copy.
 */
export const SPRING = { stiffness: 64, damping: 11 };

const w0 = Math.sqrt(SPRING.stiffness);
const zeta = SPRING.damping / (2 * w0);
const wd = w0 * Math.sqrt(1 - zeta * zeta);
/** Seconds the spring takes to settle within 0.3% of its target. */
export const SPRING_DURATION = 1.3;
/** Seconds from release to the top of the overshoot: the moment the element is "caught". */
export const SPRING_PEAK = Math.PI / wd;

/** The spring's step response, normalised to 0..1 input. Peaks near 1.05 before settling. */
export function springCurve(u: number) {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const t = u * SPRING_DURATION;
  return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
}

/** The same curve as a CSS linear() easing, sampled densely enough to keep the overshoot round. */
export function springLinear(samples = 48) {
  const points: string[] = [];
  for (let i = 0; i <= samples; i++) points.push(i === samples ? "1" : springCurve(i / samples).toFixed(4));
  return `linear(${points.join(", ")})`;
}

/** Integrates the shared spring toward a moving target in real time. */
export function createSpring(initial: number) {
  let x = initial, v = 0;
  return {
    get value() { return x; },
    get velocity() { return v; },
    snap(to: number) { x = to; v = 0; },
    /** Adds velocity, e.g. a squash that springs back past its rest value. */
    kick(impulse: number) { v += impulse; },
    /** Advances by dt seconds. Returns true while still moving. */
    step(target: number, dt: number) {
      const h = 1 / 240;
      for (let left = Math.min(dt, 0.25); left > 1e-6; left -= h) {
        const s = Math.min(h, left);
        v += (-SPRING.stiffness * (x - target) - SPRING.damping * v) * s;
        x += v * s;
      }
      if (Math.abs(x - target) < 0.0004 && Math.abs(v) < 0.004) { x = target; v = 0; return false; }
      return true;
    },
  };
}
