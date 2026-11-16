export type MotionKey = {at: number; value: number; velocity?: number; acceleration?: number};

/** Quintic Hermite interpolation preserves position, velocity and acceleration at every join. */
export function motionTrack(progress: number, keys: readonly MotionKey[]) {
  if (progress <= keys[0].at) return keys[0].value;
  if (progress >= keys[keys.length - 1].at) return keys[keys.length - 1].value;
  const index = keys.findIndex((key, i) => i < keys.length - 1 && progress >= key.at && progress < keys[i + 1].at);
  const a = keys[index], b = keys[index + 1], span = b.at - a.at;
  const t = (progress - a.at) / span, t2 = t*t, t3 = t2*t, t4 = t3*t, t5 = t4*t;
  return a.value*(1-10*t3+15*t4-6*t5) + b.value*(10*t3-15*t4+6*t5)
    + (a.velocity ?? 0)*span*(t-6*t3+8*t4-3*t5)
    + (b.velocity ?? 0)*span*(-4*t3+7*t4-3*t5)
    + (a.acceleration ?? 0)*span*span*.5*(t2-3*t3+3*t4-t5)
    + (b.acceleration ?? 0)*span*span*.5*(t3-2*t4+t5);
}

const window01 = (start: number, end: number, p: number) => Math.max(0, Math.min(1, (p - start) / (end - start)));
/** Entrances decelerate into rest (quartic out); departures gather speed (cubic in). */
export const easeOut = (start: number, end: number, p: number) => 1 - Math.pow(1 - window01(start, end, p), 4);
export const easeIn = (start: number, end: number, p: number) => Math.pow(window01(start, end, p), 3);

/** Writes a style only when its value changes, so settled frames cause no style recalculation. */
export function createStyleWriter() {
  const cache = new WeakMap<HTMLElement, string>();
  return (element: HTMLElement | null | undefined, transform: string, opacity = 1) => {
    if (!element) return;
    const value = transform + "|" + opacity.toFixed(3);
    if (cache.get(element) === value) return;
    cache.set(element, value);element.style.transform = transform;element.style.opacity = opacity.toFixed(3);
  };
}

export const CARD_WIDTH = 3.2;
export const CARD_HEIGHT = 2.2;
// One unbroken lift. No compression kick, apex acceleration or launch impulse.
export const PUMP_TRACK: readonly MotionKey[] = [
  {at: 0, value: 1.08},
  {at: .31, value: 1.08},
  {at: .46, value: 2.75, velocity: 6},
  {at: .64, value: 4.56},
];
