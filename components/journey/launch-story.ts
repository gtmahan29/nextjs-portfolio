export const LAUNCH_ENTRY = .853;
const LAUNCH_BEATS = [.85, .863, .877];

export function launchBeatAt(progress: number) {
  return LAUNCH_BEATS.findLastIndex(start => progress >= start);
}
