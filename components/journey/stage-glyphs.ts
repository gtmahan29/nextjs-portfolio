/**
 * Six stage glyphs that the intro cube's glass faces turn into.
 *
 * Each glyph is a radial outline sampled at the same angles as a square
 * (the face it grows out of), so one value m morphs the face into the glyph.
 * m comes straight from the shared spring: when it overshoots past 1 the
 * glyph's own lobes overshoot too, then settle. The pop lives inside the
 * morph, not on top of it.
 */
const N = 120;
const TAU = Math.PI * 2;

/** Regular polygon with a vertex at angle 0. */
const polygon = (sides: number, radius: number) => (a: number) => {
  const k = TAU / sides;
  const t = ((a % k) + k) % k - k / 2;
  return radius * Math.cos(k / 2) / Math.cos(t);
};

const square = (a: number) => 0.78 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));

/** In journey order: spark, taking shape, the system, coming alive, growing, out in the world. */
const SHAPES: ((a: number) => number)[] = [
  a => { const n = 0.6, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)); return Math.pow(Math.pow(c, n) + Math.pow(s, n), -1 / n); },
  () => 0.9,
  polygon(6, 0.96),
  polygon(3, 1.02),
  a => 0.8 + 0.2 * Math.cos(8 * a),
  a => 0.72 + 0.28 * Math.cos(5 * (a + Math.PI / 2)),
];

export const GLYPH_COUNT = SHAPES.length;

/** SVG path for glyph i at morph m (0 = the square face, 1 = the glyph; >1 overshoots). */
export function glyphPath(i: number, m: number) {
  const shape = SHAPES[i % SHAPES.length];
  let d = "";
  for (let k = 0; k < N; k++) {
    const a = (k / N) * TAU - Math.PI / 2;
    const from = square(a);
    const r = Math.max(0.02, from + (shape(a) - from) * m);
    d += `${k ? "L" : "M"}${(r * Math.cos(a)).toFixed(3)} ${(r * Math.sin(a)).toFixed(3)}`;
  }
  return `${d}Z`;
}
