/**
 * UI sound effects for the journey page.
 *
 * Files live in /public/sfx with the `sfx_` prefix and are mono. Sound is off
 * until the visitor turns it on (browsers only allow audio after a click), and
 * the choice is remembered. Each effect is rate-limited so fast, repeated
 * triggers never stack into a rattle of taps.
 */
export type Sfx = "ui_click" | "ui_big_click" | "ui_click_data" | "ui_pop";

const VOLUME: Record<Sfx, number> = { ui_click: 0.35, ui_big_click: 0.45, ui_click_data: 0.3, ui_pop: 0.4 };
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

async function load(name: Sfx) {
  if (!context || buffers.has(name)) return;
  const response = await fetch(`/sfx/sfx_${name}.wav`);
  buffers.set(name, await context.decodeAudioData(await response.arrayBuffer()));
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
  }
  if (context.state === "suspended") await context.resume();
  await Promise.all((Object.keys(VOLUME) as Sfx[]).map(load));
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
  source.connect(gain).connect(output);
  source.start(context.currentTime + Math.max(0, when));
}
