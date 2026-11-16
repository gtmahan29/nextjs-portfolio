import { Words, pop } from "./staged-words";

/**
 * The cube chapter. The golden cube from the end of the journey sits in the
 * middle of one giant sentence, as if it were a word. Each scroll beat turns
 * the cube a quarter and swaps the words on either side of it; the last beat
 * offers the first step. The runtime (process-journey-runtime) projects the
 * cube onto the page, so the gap in the sentence always fits it.
 */
const BEATS = [
  { left: "A big idea", right: "starts small." },
  { left: "One honest call.", right: "No brief needed." },
  { left: "A written scope", right: "before any code." },
];

export default function ProjectConcierge() {
  return (
    <section className="jny-concierge" aria-labelledby="concierge-title" aria-hidden="true">
      <h2 id="concierge-title" className="sr-only">A big idea starts small: one honest call, then a written scope before any code.</h2>
      {BEATS.map((beat, i) => (
        <p className="cube-line" key={i} data-line={i} aria-hidden="true">
          <span className="cube-left"><Words text={beat.left} beat={i} /></span>
          <span className="cube-right"><Words text={beat.right} beat={i} start={140} /></span>
        </p>
      ))}
      <div className="cube-act">
        <a className="cube-go" href="#contact" data-sfx="big" {...pop(BEATS.length - 1, 420)}>
          <span>Start with a call</span>
          <span className="cube-go-ic" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M4 12L12 4M5.5 4H12v6.5" /></svg></span>
        </a>
      </div>
    </section>
  );
}
