import { Fragment } from "react";

type Beat = { beat: number; until?: number; start?: number; step?: number };
const data = (beat: number, until: number | undefined, delay: number) => ({
  "data-beat": String(beat),
  ...(until === undefined ? {} : { "data-until": String(until) }),
  "data-delay": String(Math.round(delay)),
});

/** Splits a line into words, each rising out of its own mask a little after the last. */
export function Words({ text, beat, until, start = 0, step = 45 }: Beat & { text: string }) {
  const words = text.split(" ");
  return <>{words.map((word, i) => <Fragment key={i}>
    <span className="jm-m"><span className="jm-in" {...data(beat, until, start + i * step)}>{word}</span></span>
    {i < words.length - 1 ? " " : null}
  </Fragment>)}</>;
}

/** One block that rises out of a single mask. */
export function Rise({ children, beat, until, start = 0, className = "" }: Beat & { children: React.ReactNode; className?: string }) {
  return <span className={`jm-m jm-b ${className}`}><span className="jm-in" {...data(beat, until, start)}>{children}</span></span>;
}

/** Spreads the staging attributes onto any element that pops (scales) instead of rising. */
export const pop = (beat: number, start = 0, until?: number) => data(beat, until, start);
