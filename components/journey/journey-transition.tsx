import {Rise, Words} from "./staged-words";
import {STATIONS} from "./data";
import IdeaTicker from "./idea-ticker";

/** The introduction shares the journey's canvas and scroll conductor; its lines are staged by the runtime. */
export default function JourneyTransition() {
  return (
    <section className="jny-entry" aria-labelledby="journey-entry-title">
      <div className="jny-entry-opening">
        <h2 id="journey-entry-title"><span className="fin-line"><Words text="What should" beat={0} /></span> <span className="fin-line"><Words text="we build?" beat={0} start={110} /></span></h2>
        <p className="jny-entry-description"><Rise beat={0} start={260}>It starts with a conversation.</Rise></p>
        {/* Pops in with the opening line and leaves with it (the intro stages the wrapper; the bubble runs its own loop). */}
        <div className="jny-idea-wrap" data-beat="0" data-until="0" data-delay="420"><IdeaTicker /></div>
      </div>
      <div className="jny-entry-resolution" aria-hidden="true">
        <p className="jny-entry-statement"><span className="fin-line"><Words text="One idea." beat={1} /></span> <span className="fin-line"><Words text="Every detail." beat={1} start={110} /></span></p>
        <p className="jny-entry-description"><Rise beat={1} start={260}>Design, engineering and launch, in one place.</Rise></p>
      </div>
      <div className="jny-entry-third" aria-hidden="true">
        <p className="jny-entry-statement"><span className="fin-line"><Words text="Six stages." beat={2} /></span> <span className="fin-line"><Words text="One person." beat={2} start={110} /></span></p>
        <p className="jny-entry-description"><Rise beat={2} start={260}>Nothing lost between them. Let’s walk through it.</Rise></p>
      </div>
      {/* The six glass faces become the six stages; the runtime morphs and places each one. */}
      <div className="jny-glyphs" aria-hidden="true">
        {STATIONS.map(st => <svg className="jny-glyph" key={st.id} viewBox="-1.3 -1.3 2.6 2.6" style={{"--c": st.color} as React.CSSProperties}>
          <defs><linearGradient id={`glyph-fill-${st.id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset=".45" stopColor={st.color} /><stop offset="1" stopColor={st.color} /></linearGradient></defs>
          <path fill={`url(#glyph-fill-${st.id})`} d="M0 0Z" />
        </svg>)}
      </div>
      <span className="jny-entry-accessible">Six golden glass faces open to reveal a luminous core, then reunite as the idea moves into the studio.</span>
      <div className="jny-entry-footnote" aria-hidden="true" />
      <a className="jny-entry-skip" href="#journey-stations"><Rise beat={0} until={2} start={380}>Skip the introduction</Rise></a>
    </section>
  );
}
