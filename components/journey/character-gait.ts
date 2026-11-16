export const WALK_PERIOD = 1.16;
export const WALK_SPEED = .68;
const STANCE = .62;
const STRIDE = WALK_PERIOD * WALK_SPEED;
const smooth = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t * t * t * (10 + t * (-15 + 6 * t)); };

/** Foot targets in the travelling pelvis frame; world contact is fixed in stance. */
export function sampleFoot(time: number, side: number) {
  const cycle = time / WALK_PERIOD + (side === 1 ? .5 : 0);
  const phase = ((cycle % 1) + 1) % 1;
  const swing = Math.max(0, (phase - STANCE) / (1 - STANCE));
  let pitch = 0;
  if (phase < .10) pitch = -.12 * (1 - smooth(phase / .10));
  if (phase > .42 && phase <= STANCE) pitch = .34 * smooth((phase - .42) / .20);
  if (phase > STANCE) pitch = swing < .55 ? .34 - .42 * smooth(swing / .55)
    : -.08 - .04 * smooth((swing - .55) / .45);
  const pivot = pitch > 0 ? .295 : -.18;
  const rollY = .21 * Math.cos(pitch) + pivot * Math.sin(pitch);
  const rollZ = .21 * Math.sin(pitch) + pivot * (1 - Math.cos(pitch));
  return {
    phase, planted: phase <= STANCE, pitch,
    // The knee folds early in swing; the foot then lowers for heel contact.
    y: rollY + .075 * (swing < .38 ? smooth(swing / .38) : 1 - smooth((swing - .38) / .62)),
    z: STRIDE * STANCE / 2 - phase * STRIDE + STRIDE * smooth(swing) + rollZ,
    // Ground contact before the anatomical heel/toe roll offset.
    contactZ: STRIDE * STANCE / 2 - phase * STRIDE + STRIDE * smooth(swing),
  };
}

/** Small weight transfer toward the supporting leg, with opposing torso twist. */
export function sampleWalkBody(time: number) {
  const angle = time / WALK_PERIOD * Math.PI * 2;
  const phase = ((time / WALK_PERIOD % .5) + .5) % .5;
  return {
    x: -.023 * Math.sin(angle),
    yaw: .032 * Math.cos(angle),
    roll: -.018 * Math.sin(angle),
    // Yield to heel contact, then extend through the middle of stance.
    compression: .009 * Math.sin(Math.PI * Math.min(1, phase / .21)) ** 2,
  };
}

export function solveLeg(height: number, forward: number) {
  const upper = .52, lower = .51;
  const distance = Math.min(upper + lower, Math.max(.1, Math.hypot(height, forward)));
  if (distance >= upper + lower - .000001) return { hip: -Math.atan2(forward, height), knee: 0 };
  const clamp = (n: number) => Math.max(-1, Math.min(1, n));
  const hip = -Math.atan2(forward, height) - Math.acos(clamp((upper * upper + distance * distance - lower * lower) / (2 * upper * distance)));
  const knee = Math.PI - Math.acos(clamp((upper * upper + lower * lower - distance * distance) / (2 * upper * lower)));
  return { hip, knee };
}
