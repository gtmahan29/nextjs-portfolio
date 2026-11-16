import * as THREE from "three";

/** In-place bone motion; world travel is handled by the arc-length path. */
export function inPlaceClip(source: THREE.AnimationClip) {
  const clip = source.clone();
  for (const track of clip.tracks) {
    if (!/(Hips|Root|Armature)\.position$/i.test(track.name)) continue;
    for (let i = 0; i < track.values.length; i += 3) {
      track.values[i] = track.values[0]; track.values[i + 2] = track.values[2];
    }
  }
  return clip;
}

export function poseClip(source: THREE.AnimationClip, time: number, name: string) {
  return new THREE.AnimationClip(name, 1, source.tracks.map(track => {
    const sampled = Array.from(track.createInterpolant().evaluate(time) as ArrayLike<number>);
    const result = track.clone();
    result.times = new Float32Array([0, 1]); result.values = new Float32Array([...sampled, ...sampled]);
    return result;
  }));
}

/** Pick a low-hand, quiet pose from the actual rig, rather than its exported T-pose. */
export function quietPoseTime(model: THREE.Group, clip: THREE.AnimationClip) {
  const hands: THREE.Bone[] = [];
  model.traverse(object => { if (object instanceof THREE.Bone && /(Left|Right)Hand$/.test(object.name)) hands.push(object); });
  if (!hands.length) return 0;
  const mixer = new THREE.AnimationMixer(model); mixer.clipAction(clip).play();
  const point = new THREE.Vector3();
  let best = Infinity, time = 0;
  for (let i = 0; i < 32; i++) {
    const sample = clip.duration * i / 32;
    mixer.setTime(sample); model.updateMatrixWorld(true);
    const score = hands.reduce((sum, hand) => sum + hand.getWorldPosition(point).y, 0);
    if (score < best) { best = score; time = sample; }
  }
  mixer.stopAllAction(); mixer.uncacheRoot(model);
  return time;
}

/** Median backward velocity of the low supporting ankle, in the model's world units. */
export function measureWalkSpeed(model: THREE.Group, clip: THREE.AnimationClip) {
  const feet: THREE.Bone[] = [];
  model.traverse(object => { if (object instanceof THREE.Bone && /(Left|Right)Foot$/.test(object.name)) feet.push(object); });
  if (!feet.length) throw new Error("Walking rig has no ankle bones");
  const mixer = new THREE.AnimationMixer(model); mixer.clipAction(clip).play();
  const count = 120, dt = clip.duration / count;
  const samples = feet.map(() => [] as THREE.Vector3[]);
  for (let i = 0; i < count; i++) {
    mixer.setTime(i * dt); model.updateMatrixWorld(true);
    feet.forEach((foot, index) => samples[index].push(foot.getWorldPosition(new THREE.Vector3())));
  }
  mixer.stopAllAction(); mixer.uncacheRoot(model);
  const speeds: number[] = [];
  for (const points of samples) {
    const minY = Math.min(...points.map(point => point.y)), maxY = Math.max(...points.map(point => point.y));
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], speed = (a.z - b.z) / dt;
      if (speed > .05 && Math.max(a.y, b.y) < minY + (maxY - minY) * .28) speeds.push(speed);
    }
  }
  speeds.sort((a, b) => a - b);
  if (!speeds.length) throw new Error("Walking clip has no measurable support phase");
  return speeds[Math.floor(speeds.length / 2)];
}

/** Each full clip finishes before the next member's independently timed pause ends. */
export function conversationTurn(time: number, durations: number[], delays: number[]) {
  const period = durations.reduce((sum, duration, i) => sum + duration + delays[i], 0);
  let local = ((time % period) + period) % period;
  for (let i = 0; i < durations.length; i++) {
    if (local < delays[i]) return { speaker: -1, time: 0, weight: 0 };
    local -= delays[i];
    if (local < durations[i]) {
      const smooth = (value: number) => { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t); };
      return { speaker: i, time: local, weight: smooth(local / .25) * smooth((durations[i] - local) / .3) };
    }
    local -= durations[i];
  }
  return { speaker: -1, time: 0, weight: 0 };
}
