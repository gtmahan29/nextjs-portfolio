import { createSpring } from "./motion-curve";

/*
The page loader's centrepiece, drawn on a canvas. It runs inside a worker (OffscreenCanvas) so the
3D work loading on the main thread can never stall it; the same code runs on the main thread where
workers cannot draw.

While the page loads, one soft shape flows through a loop of loading forms (circle, soft triangle,
clover, blossom, scallop), each in its own colour, turning a little further with every change.
When the page is ready it morphs into the Codaine app tile, turns upright, and the white C pops in.

Every change is one value m on the shared spring: outline, colour and size all follow m, so the
overshoot (m > 1) pushes the outline past its target and the catch settles it (the pop is inside
the morph). The turn has its own spring toward an accumulating angle, so the shape never stops dead.
The outline is computed in world space, so the light and the shadow stay put while the shape turns.
*/

export const ART_STEPS = 7; // 0..5: loading; 6: the logo
const LOGO = 6;
const N = 240, TAU = Math.PI * 2, CYCLE = 1.25;
type Shape = (a: number) => number;
const LOADING: { r: Shape; color: string; turn: number }[] = [
  { r: () => .8, color: "#8b5cf6", turn: .0 },
  { r: a => .8 * (1 + .14 * Math.cos(3 * a)), color: "#ec4899", turn: TAU / 6 },
  { r: a => .8 * (1 + .17 * Math.cos(4 * a)), color: "#f97316", turn: TAU / 8 },
  { r: a => .8 * (1 + .1 * Math.cos(6 * a)), color: "#0ea5e9", turn: TAU / 12 },
  { r: a => .8 * (1 + .045 * Math.cos(10 * a)), color: "#10b981", turn: TAU / 10 },
];
const TILE: Shape = a => { const n = 4.6, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)); return .86 * Math.pow(Math.pow(c, n) + Math.pow(s, n), -1 / n); };
const TILE_COLOR = "#241839";
export const C_PATH = "M155.769 381C126 381 99.3462 374.048 75.8077 360.145C52.2692 346.242 33.75 325.214 20.25 297.06C6.75 268.558 0 233.627 0 192.265C0 153.684 6.92308 121.185 20.7692 94.7692C34.9615 68.0057 53.8269 48.0199 77.3654 34.812C100.904 21.604 127.038 15 155.769 15C181.038 15 204.058 19.5185 224.827 28.5555C245.942 37.5926 262.558 50.1054 274.673 66.094C286.788 81.735 292.846 98.9402 292.846 117.709C292.846 138.217 286.269 154.727 273.115 167.239C260.308 179.752 244.212 186.009 224.827 186.009C219.288 186.009 213.058 185.661 206.135 184.966C199.212 183.923 192.635 183.054 186.404 182.359C173.596 179.926 163.731 178.709 156.808 178.709C152.308 178.709 148.673 180.1 145.904 182.88C143.135 185.313 141.75 188.442 141.75 192.265C141.75 195.741 143.135 198.869 145.904 201.65C148.673 204.43 152.308 205.821 156.808 205.821C163.731 205.821 173.596 204.604 186.404 202.171C192.635 201.476 199.212 200.781 206.135 200.085C213.058 199.043 219.288 198.521 224.827 198.521C245.596 198.521 262.731 205.299 276.231 218.855C290.077 232.063 297 249.615 297 271.513C297 291.672 290.769 310.094 278.308 326.778C265.846 343.462 248.712 356.67 226.904 366.402C205.442 376.134 181.731 381 155.769 381Z";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
const hex = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const popped = (v: number, k: number) => (v > 1 ? 1 + (v - 1) * k : Math.max(0, v));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function createLoaderArt(ctx: Ctx, onCatch: (step: number) => void) {
  let size = 300, dpr = 1, reduced = false, started = false, final = false;
  let shape = 0, clock = 0, breath = 0;
  const fromR = new Float32Array(N), toR = new Float32Array(N), nowR = new Float32Array(N);
  let fromColor = hex(LOADING[0].color), toColor = fromColor.slice(), nowColor = fromColor.slice();
  let spinGoal = 0, peaked = true, cPeaked = false;
  const morph = createSpring(1), appear = createSpring(0), spin = createSpring(-.6), cPop = createSpring(0);
  const c = new Path2D(C_PATH);

  // Local angle k of the outline (before the turn).
  const angle = (k: number) => (k / N) * TAU - Math.PI / 2;
  const target = (r: Shape) => { for (let k = 0; k < N; k++) toR[k] = r(angle(k)); };

  const morphTo = (r: Shape, color: string) => {
    // Interruptible: the next morph starts exactly from what is on screen now.
    fromR.set(nowR); fromColor = nowColor.slice();
    target(r); toColor = hex(color);
    morph.snap(0); peaked = false;
  };

  const begin = () => {
    started = true;
    target(LOADING[0].r); fromR.set(toR); nowR.set(toR);
    morph.snap(1); clock = 0;
  };
  const next = () => {
    shape = (shape + 1) % LOADING.length;
    spinGoal += .7 + LOADING[shape].turn;
    morphTo(LOADING[shape].r, LOADING[shape].color);
  };
  const toLogo = () => {
    if (final) return;
    final = true;
    // Upright: the tile is four-fold, so the nearest quarter turn ahead.
    spinGoal = Math.ceil((spin.value + .5) / (TAU / 4)) * (TAU / 4);
    morphTo(TILE, TILE_COLOR);
  };

  const draw = () => {
    const W = size * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, W);
    const m = morph.value, mc = clamp01(m);
    for (let k = 0; k < N; k++) nowR[k] = Math.max(.05, fromR[k] + (toR[k] - fromR[k]) * m);
    for (let i = 0; i < 3; i++) nowColor[i] = fromColor[i] + (toColor[i] - fromColor[i]) * mc;
    // Size follows the same value: it draws in a touch mid-change and swells past on the overshoot.
    const pulse = 1 - .07 * Math.sin(Math.PI * mc) + (m > 1 ? (m - 1) * .9 : 0);
    const s = popped(appear.value, 2.5) * pulse * (1 + .018 * Math.sin(breath * 2.2));
    const R = W * .32 * s;
    if (R < .5) return;
    const cx = W / 2, cy = W * .46, turn = spin.value;
    ctx.beginPath();
    for (let k = 0; k <= N; k++) {
      const i = k % N, a = angle(i) + turn, r = nowR[i] * R;
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
    const col = nowColor.map(Math.round);
    const rgb = (f: number) => `rgb(${col.map(v => Math.min(255, Math.round(v + (255 - v) * f))).join(",")})`;
    // A soft coloured shadow, then a top-lit body, then a glossy highlight clipped to the shape.
    ctx.save();
    ctx.shadowColor = `rgba(${col[0]},${col[1]},${col[2]},.34)`;
    ctx.shadowBlur = 54 * dpr; ctx.shadowOffsetY = 26 * dpr;
    const g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    g.addColorStop(0, rgb(.32)); g.addColorStop(.55, rgb(0)); g.addColorStop(1, rgb(-.0));
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.clip();
    const h = ctx.createRadialGradient(cx - R * .35, cy - R * .55, 0, cx - R * .35, cy - R * .55, R * 1.1);
    h.addColorStop(0, "rgba(255,255,255,.42)"); h.addColorStop(.5, "rgba(255,255,255,.08)"); h.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = h; ctx.fillRect(0, 0, W, W);
    const d = ctx.createLinearGradient(0, cy, 0, cy + R);
    d.addColorStop(0, "rgba(0,0,0,0)"); d.addColorStop(1, "rgba(0,0,0,.14)");
    ctx.fillStyle = d; ctx.fillRect(0, 0, W, W);
    ctx.restore();
    ctx.lineWidth = 1.2 * dpr; ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.stroke();
    // The tile's C pops in once the tile has formed.
    const cv = popped(cPop.value, 2.5);
    if (cv > .002) {
      const k = R * .9 / 366 * cv;
      ctx.setTransform(k, 0, 0, k, cx - 148.5 * k, cy - 198 * k);
      ctx.fillStyle = "#ffffff"; ctx.fill(c);
    }
  };

  return {
    resize(cssSize: number, ratio: number) { size = cssSize; dpr = ratio; },
    setReduced(on: boolean) { reduced = on; },
    /** 0..5 starts (or keeps) the loading loop; 6 forms the logo. */
    goTo(step: number) {
      if (!started) begin();
      if (step >= LOGO) toLogo();
    },
    frame(dt: number) {
      if (!started) return;
      const t = Math.min(.25, dt);
      if (!final) { clock += t; if (!reduced && clock >= CYCLE) { clock -= CYCLE; next(); } }
      if (reduced) {
        appear.snap(1); morph.snap(1); spin.snap(spinGoal); cPop.snap(final ? 1 : 0);
      } else {
        appear.step(1, t);
        morph.step(1, t);
        spin.step(spinGoal, t);
        cPop.step(final && morph.value > .92 ? 1 : 0, t);
        breath += t * (final ? 0 : 1);
      }
      // The catch: the moment the overshoot turns back.
      if (!peaked && (reduced || (morph.value > 1 && morph.velocity <= 0))) { peaked = true; onCatch(final ? LOGO : shape); }
      if (final && !cPeaked && (reduced ? cPop.value >= 1 : cPop.value > 1 && cPop.velocity <= 0)) { cPeaked = true; onCatch(99); }
      draw();
    },
  };
}
