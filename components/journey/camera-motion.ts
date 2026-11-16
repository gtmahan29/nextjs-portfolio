/** Scroll damping with continuous velocity and no overshoot, independent of frame rate. */
export function createCameraProgress(initial: number, settleTime = 0.48) {
  let position = initial;
  let velocity = 0;
  const omega = 2 / settleTime;
  return (target: number, dt: number, immediate = false) => {
    if (immediate) {
      position = target;
      velocity = 0;
      return position;
    }
    const offset = position - target;
    const step = (velocity + omega * offset) * dt;
    const decay = Math.exp(-omega * dt);
    const next = target + (offset + step) * decay;
    velocity = (velocity - omega * step) * decay;
    // A direction reversal must settle at the new destination rather than coast past it.
    if ((target - position) * (target - next) < 0) {
      position = target;
      velocity = 0;
    } else {
      position = Math.max(0, Math.min(1, next));
    }
    return position;
  };
}

/** Quintic travel has zero speed AND acceleration where a station hold begins or ends. */
export function createTravelTrack(keys: number[][]) {
  return (progress: number) => {
    if (progress <= keys[0][0]) return keys[0][1];
    if (progress >= keys[keys.length - 1][0]) return keys[keys.length - 1][1];
    let index = 0;
    while (progress > keys[index + 1][0]) index++;
    const [start, from] = keys[index];
    const [end, to] = keys[index + 1];
    const t = (progress - start) / (end - start);
    const eased = t * t * t * (t * (t * 6 - 15) + 10);
    return from + (to - from) * eased;
  };
}

// Only travel windows change orientation. Views are already complete at arrival.
export const CAMERA_YAW = createTravelTrack([[0, 0], [0.32, 0], [0.42, -55], [0.46, -55], [0.56, 0], [.61, 0], [.70, 45], [.74, 45], [.85, 44.034086], [1, 44.034086]]);
export const CAMERA_ELEVATION = createTravelTrack([[0, 32], [.74, 32], [.85, 18.287747], [1, 18.287747]]);

// Station one is already revealed by the introduction. Keep travel continuous,
// with only brief viewing windows instead of long stretches of unchanged scenery.
const scrollKeys = [
  [.18, 0], [.28, .15], [.32, .17], [.42, .32], [.46, .34],
  [.56, .49], [.60, .51], [.70, .66], [.74, .68],
  [.85, .85], [.89, .87], [1, 1],
];
function remap(value: number, from: number, to: number) {
  let i = 0;
  while (i < scrollKeys.length - 2 && value > scrollKeys[i + 1][from]) i++;
  const a = scrollKeys[i], b = scrollKeys[i + 1];
  const t = Math.max(0, Math.min(1, (value - a[from]) / (b[from] - a[from])));
  return a[to] + (b[to] - a[to]) * t;
}
export const storyToScroll = (story: number) => remap(story, 0, 1);
export const scrollToStory = (scroll: number) => remap(scroll, 1, 0);
