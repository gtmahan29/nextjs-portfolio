import { createLoaderArt } from "./loader-art";

/*
Draws the page loader's centrepiece off the main thread. The page sends the canvas once, then only
the step to morph to; this worker runs its own frame loop, so parsing and compiling 3D on the main
thread cannot stall the morph. Catches are posted back (for the label and the one sound).
*/
type Message =
  | { type: "init"; canvas: OffscreenCanvas; size: number; dpr: number; reduced: boolean }
  | { type: "step"; step: number }
  | { type: "resize"; size: number; dpr: number }
  | { type: "stop" };

// The worker's global, typed locally (the project compiles against the DOM library).
const scope = self as unknown as {
  postMessage(message: unknown): void;
  onmessage: ((event: MessageEvent) => void) | null;
  requestAnimationFrame?: (callback: (time: number) => void) => number;
};
let art: ReturnType<typeof createLoaderArt> | undefined;
let canvas: OffscreenCanvas | undefined;
let last = 0, running = false;

const raf = (fn: (t: number) => void) =>
  scope.requestAnimationFrame ? scope.requestAnimationFrame(fn) : setTimeout(() => fn(performance.now()), 16);

const loop = (now: number) => {
  if (!running || !art) return;
  art.frame(last ? (now - last) / 1000 : 0);
  last = now;
  raf(loop);
};

scope.onmessage = (event: MessageEvent) => {
  const data = event.data as Message;
  if (data.type === "init") {
    canvas = data.canvas;
    canvas.width = canvas.height = Math.round(data.size * data.dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    art = createLoaderArt(ctx, step => scope.postMessage({ type: "catch", step }));
    art.resize(data.size, data.dpr);
    art.setReduced(data.reduced);
    running = true; raf(loop);
  } else if (data.type === "step") art?.goTo(data.step);
  else if (data.type === "resize" && canvas && art) {
    canvas.width = canvas.height = Math.round(data.size * data.dpr);
    art.resize(data.size, data.dpr);
  } else if (data.type === "stop") { running = false; }
};
