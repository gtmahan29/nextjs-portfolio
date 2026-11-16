let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playTone(
  enabled: boolean,
  freq: number,
  endFreq: number,
  duration = 0.08,
  type: OscillatorType = "triangle",
  gainPeak = 0.06
): void {
  if (!enabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(gainPeak, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.01);
}

export function playHoverSound(enabled: boolean): void {
  playTone(enabled, 420, 560, 0.055, "sine", 0.032);
}

export function playClickPop(enabled: boolean): void {
  playTone(enabled, 320, 680, 0.09, "triangle", 0.055);
}

export function playScoreDing(enabled: boolean): void {
  playTone(enabled, 587, 880, 0.14, "sine", 0.065);
}
