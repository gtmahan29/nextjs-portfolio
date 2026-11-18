/**
 * UI sound effects for the journey page.
 *
 * Files live in /public/sfx with the `sfx_` prefix and are mono. The three
 * `key_*` voices are synthesized once, here, from the physics of a switch:
 * a light actuation tick, a deep bottom-out thock and a soft top-out. Sound is
 * off until the visitor turns it on (browsers only allow audio after a click),
 * and the choice is remembered. Each effect is rate-limited so fast, repeated
 * triggers never stack into a rattle of taps.
 */
type FileSfx = "ui_click" | "ui_big_click" | "ui_click_data" | "ui_pop";
type KeySfx = "key_down" | "key_thock" | "key_up" | "key_whoosh";
export type Sfx = FileSfx | KeySfx;

const FILES: FileSfx[] = ["ui_click", "ui_big_click", "ui_click_data", "ui_pop"];
const VOLUME: Record<Sfx, number> = {
  ui_click: 0.35, ui_big_click: 0.45, ui_click_data: 0.3, ui_pop: 0.4,
  key_down: 0.14, key_thock: 0.55, key_up: 0.26, key_whoosh: 0.32,
};
const GAP_MS = 110;
const KEY = "jny-sound";

let context: AudioContext | null = null;
let output: GainNode | null = null;
let enabled = false;
const buffers = new Map<Sfx, AudioBuffer>();
const lastPlayed = new Map<Sfx, number>();
const listeners = new Set<(on: boolean) => void>();

function readPreference() {
  try { return localStorage.getItem(KEY) === "on"; } catch { return false; }
}
function writePreference(on: boolean) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* private mode: keep it for this visit only */ }
}

async function load(name: FileSfx) {
  if (!context || buffers.has(name)) return;
  const response = await fetch(`/sfx/sfx_${name}.wav`);
  buffers.set(name, await context.decodeAudioData(await response.arrayBuffer()));
}

/** RBJ biquad, enough to shape noise into plastic and case resonances. */
function biquad(input: Float32Array, rate: number, type: "bandpass" | "highpass" | "lowpass", freq: number, q: number) {
  const w = (2 * Math.PI * freq) / rate, cos = Math.cos(w), alpha = Math.sin(w) / (2 * q);
  let b0: number, b1: number, b2: number;
  if (type === "bandpass") { b0 = alpha; b1 = 0; b2 = -alpha; }
  else if (type === "highpass") { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; }
  else { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; }
  const a0 = 1 + alpha, a1 = -2 * cos, a2 = 1 - alpha;
  const out = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y; out[i] = y;
  }
  return out;
}

/** Builds one mono voice from a few physical layers, then normalises it. */
function synth(ctx: AudioContext, name: KeySfx) {
  const rate = ctx.sampleRate, seconds = name === "key_whoosh" ? 0.95 : name === "key_thock" ? 0.22 : 0.12;
  const n = Math.floor(rate * seconds), mix = new Float32Array(n);
  let seed = name.length * 977;
  const noise = new Float32Array(n).map(() => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647) * 2 - 1; });
  const env = (t: number, attack: number, decay: number) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));
  // A tone whose pitch falls as the energy leaves, like a struck plate.
  const tone = (from: number, to: number, fall: number, decay: number, amp: number) => {
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / rate, f = to + (from - to) * Math.exp(-t / fall);
      phase += (2 * Math.PI * f) / rate;
      mix[i] += Math.sin(phase) * env(t, 0.0015, decay) * amp;
    }
  };
  const grit = (type: "bandpass" | "highpass", freq: number, q: number, decay: number, amp: number) => {
    const shaped = biquad(noise, rate, type, freq, q);
    for (let i = 0; i < n; i++) mix[i] += shaped[i] * env(i / rate, 0.0006, decay) * amp;
  };
  if (name === "key_down") {
    // Actuation: a dry, close tick of plastic on plastic.
    grit("highpass", 3200, 0.8, 0.005, 0.9);
    grit("bandpass", 1500, 2.5, 0.012, 0.6);
    tone(2100, 1800, 0.02, 0.018, 0.12);
  } else if (name === "key_thock") {
    // Bottom-out: the deep body of the case, a muted clack, and a short ring of the housing.
    tone(190, 78, 0.03, 0.075, 1);
    grit("bandpass", 900, 1.3, 0.022, 1.1);
    grit("highpass", 4200, 0.7, 0.003, 0.45);
    tone(540, 520, 0.05, 0.05, 0.12);
  } else if (name === "key_whoosh") {
    // Launch: air moving past the key as it lifts off; a soft swell, low and wide.
    const low = biquad(noise, rate, "bandpass", 420, 0.55), high = biquad(noise, rate, "bandpass", 1500, 0.9);
    for (let i = 0; i < n; i++) {
      const t = i / rate, swell = Math.sin(Math.PI * Math.min(1, t / seconds)) ** 1.6;
      mix[i] += (low[i] * 1.2 + high[i] * .35 * Math.min(1, t / .45)) * swell;
    }
  } else {
    // Top-out: the stem meets the housing on the way back, lighter and higher.
    tone(340, 250, 0.02, 0.035, 0.55);
    grit("bandpass", 2600, 1.8, 0.008, 0.6);
  }
  // A gentle low-pass keeps every voice soft rather than brittle.
  const soft = biquad(mix, rate, "lowpass", name === "key_down" ? 9000 : 7000, 0.7);
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(soft[i]));
  const buffer = ctx.createBuffer(1, n, rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (soft[i] / (peak || 1)) * 0.9 * Math.min(1, (n - i) / (rate * 0.01));
  return buffer;
}

/** Must be called from a user gesture the first time, so the audio context may start. */
export async function setSound(on: boolean) {
  enabled = on;
  writePreference(on);
  listeners.forEach((fn) => fn(on));
  if (!on) return;
  if (!context) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    context = new Ctor();
    output = context.createGain();
    output.connect(context.destination);
    for (const name of ["key_down", "key_thock", "key_up", "key_whoosh"] as KeySfx[]) buffers.set(name, synth(context, name));
  }
  if (context.state === "suspended") await context.resume();
  await Promise.all(FILES.map(load));
}

/** Whether the visitor asked for sound on an earlier visit. It still needs a gesture to start. */
export const soundWanted = readPreference;
export const soundOn = () => enabled;
export function onSoundChange(fn: (on: boolean) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function play(name: Sfx, when = 0) {
  if (!enabled || !context || !output || context.state !== "running") return;
  const buffer = buffers.get(name);
  if (!buffer) return;
  const now = performance.now() + when * 1000;
  if (now - (lastPlayed.get(name) ?? -Infinity) < GAP_MS) return;
  lastPlayed.set(name, now);
  const source = context.createBufferSource();
  const gain = context.createGain();
  gain.gain.value = VOLUME[name];
  source.buffer = buffer;
  // No two presses of a real switch sound identical.
  if (name.startsWith("key_")) source.playbackRate.value = 1 + (Math.random() - 0.5) * 0.07;
  source.connect(gain).connect(output);
  source.start(context.currentTime + Math.max(0, when));
}
