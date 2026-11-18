"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createStagedMotion, BEFORE } from "@/components/journey/staged-motion";
import { addJob, createCapsule, wake } from "@/components/journey/spring-ticker";
import { Rise, Words, pop } from "@/components/journey/staged-words";
import { onSoundChange, setSound } from "@/components/journey/sfx";
import { CONTACT_EMAIL } from "@/components/journey/data";
import { LAYERS, NOTES, noteById, type Note } from "./content";
import { HUE, type StationId } from "./stack-world/kit";
import type { World } from "./stack-world/world";
import "./stack-world.css";

/*
MOTION SCORE — the hero copy beside the world (the world's own score is in stack-world/world.ts)
Trigger: click (a station or a thing in the scene, the rail, a "try it" button, or a
a "try it" button in a station's panel). Beats: 0 = overview, k + 1 = station k.

| Beat  | Element              | Pattern | Goal                      | Delay (s)          | Exit     | Sound                    |
|-------|----------------------|---------|---------------------------|--------------------|----------|--------------------------|
| 0     | name words           | P1      | rise                      | .16 + .09/word     | until 0  | –                        |
| 0     | role, lede           | P2      | rise                      | .42, .52           | until 0  | –                        |
| 0     | buttons              | P3      | pop                       | .66 + .08          | until 0  | –                        |
| k + 1 | back link            | P2      | rise                      | lag .18, 0         | until k+1| –                        |
| k + 1 | layer name           | P1      | rise                      | .06                | until k+1| ui_pop (world, @ PEAK)   |
| k + 1 | its line             | P2      | rise                      | .18                | until k+1| –                        |
| k + 1 | copy                 | P2      | rise                      | .32                | until k+1| –                        |
| k + 1 | tool chips           | P3      | pop                       | .44 + .06 each     | until k+1| –                        |
| k + 1 | "try it" buttons     | P3      | pop                       | .7 + .07 each      | until k+1| –                        |
| click | note card            | P3      | pops above the thing      | .2 (after its job) | shrinks  | the thing's own, @ catch |
| any   | rail capsule         | P6      | travels to the station    | 0                  | –        | (click sound)            |
| hover | label pill           | P3      | pops at the station       | 0                  | –        | –                        |
Exit before enter: outgoing copy rises out first, incoming waits the .18 s lag (staged-motion).
Reduced motion: copy snaps to its beat; the world holds still; notes appear without the pop.
Phone: the world sits above the copy; the rail scrolls sideways; notes sit inside the scene.
*/

const TONE: Record<StationId, string> = Object.fromEntries(Object.entries(HUE).map(([k, v]) => [k, v.accent])) as Record<StationId, string>;
const toneOf = (n: Note) => (n.layer === "you" ? "#2433e6" : TONE[n.layer]);

const Arrow = ({ d = "M5 11L11 5M6.5 5H11v4.5" }: { d?: string }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true"><path d={d} /></svg>
);

export default function StackWorld() {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const world = useRef<World | null>(null);
  const beatRef = useRef(0);
  const [selected, setSelected] = useState<StationId | null>(null);
  const [hover, setHover] = useState<{ station: StationId | null; prop: string | null }>({ station: null, prop: null });
  const [noteId, setNoteId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [sound, setSoundOn] = useState(false);

  // The world: loaded after first paint, so the copy is never waiting on Three.js.
  useEffect(() => {
    let alive = true;
    const el = root.current!;
    // The board is framed in what the copy column leaves free; the dock centres under it.
    const freeLeft = () => {
      if (el.clientWidth <= 900) return 0;
      const copy = el.querySelector<HTMLElement>(".sw-copy")!.getBoundingClientRect();
      return copy.right - el.getBoundingClientRect().left + 24;
    };
    const place = () => {
      const l = freeLeft();
      el.style.setProperty("--board-x", `${((l + el.clientWidth) / 2).toFixed(0)}px`);
      el.style.setProperty("--veil", `${((Math.max(0, l - 24) / el.clientWidth) * 100).toFixed(1)}%`);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    import("./stack-world/world").then(({ createStackWorld }) => {
      if (!alive || !canvas.current || !pill.current || !noteRef.current) return;
      world.current = createStackWorld(canvas.current, pill.current, noteRef.current, {
        onHover: setHover,
        onSelect: id => setSelected(id),
        onNote: setNoteId,
        onFail: () => setFailed(true),
      }, { freeLeft });
    }).catch(() => setFailed(true));
    return () => { alive = false; ro.disconnect(); world.current?.dispose(); world.current = null; };
  }, []);

  useEffect(() => onSoundChange(setSoundOn), []);

  // Copy beats follow the selection; the rail capsule travels to it.
  useEffect(() => {
    const el = root.current!;
    const motion = createStagedMotion(Array.from(el.querySelectorAll<HTMLElement>(".sw-copy [data-beat]")), { lag: 0.18, initial: BEFORE });
    const capsule = createCapsule(el.querySelector<HTMLElement>(".sw-capsule")!, el.querySelector<HTMLElement>(".sw-rail")!);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    let shown = -2;
    const stop = addJob(dt => {
      const beat = beatRef.current;
      if (beat !== shown) {
        shown = beat;
        capsule.to(beat > 0 ? el.querySelectorAll<HTMLElement>(".sw-tab")[beat - 1] : null);
      }
      return motion.update(beat, dt, reduce.matches);
    });
    return () => { stop(); motion.dispose(); capsule.dispose(); };
  }, []);

  useEffect(() => {
    const beat = selected ? LAYERS.findIndex(l => l.id === selected) + 1 : 0;
    beatRef.current = beat;
    // Pages that are not on stage leave the tab order and the accessibility tree.
    root.current!.querySelectorAll<HTMLElement>(".sw-page").forEach((p, i) => { p.inert = i !== beat; });
    world.current?.select(selected);
    wake();
  }, [selected]);

  // Escape closes the note first, then the station.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (noteId) world.current?.closeNote(); else setSelected(null);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [noteId]);

  const choose = useCallback((id: StationId | null) => setSelected(cur => (cur === id ? null : id)), []);
  const hovered = hover.station ? LAYERS.find(l => l.id === hover.station) : null;
  const hoverNote = hover.prop ? noteById(hover.prop) : undefined;
  const note = noteId ? noteById(noteId) : undefined;
  const pillTone = hovered ? TONE[hovered.id] : hoverNote ? toneOf(hoverNote) : "transparent";

  return (
    <section ref={root} className="sw" aria-labelledby="ab-name" data-fail={failed || undefined} data-open={selected ? "" : undefined}>
      <div className="sw-stage">
        <canvas ref={canvas} className="sw-canvas" role="img" aria-label="A small town of the full stack: a design studio, a frontend workshop, a backend server yard, a data store and a launch pad in the middle, with a person walking a request through each of them." />
        <span ref={pill} className="sw-pill" aria-hidden="true" style={{ "--c": pillTone } as CSSProperties}>
          <i />{hovered?.label ?? (hoverNote?.layer === "you" ? (hoverNote.id === "you" ? "Mahan" : "Helper") : "")}
          <em>{hoverNote?.action ?? (selected === hover.station ? "You are here" : "Open")}</em>
        </span>
        <div ref={noteRef} className="sw-note" role="dialog" aria-live="polite" aria-label={note ? note.title : "Note"} style={{ "--c": note ? toneOf(note) : "transparent" } as CSSProperties}>
          {note && (
            <>
              <p className="sw-note-kind"><i />{note.kind}</p>
              <h3>{note.title}</h3>
              <p>{note.body}</p>
              {note.link && <a href={note.link.href} target="_blank" rel="noreferrer">{note.link.label}<Arrow /></a>}
              <button type="button" className="sw-note-x" aria-label="Close note" onClick={() => world.current?.closeNote()}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="ab-wrap sw-grid">
        <div className="sw-copy">
          <div className="sw-page">
            <h1 id="ab-name" className="ab-name" aria-label="Mahan Adeli">
              <span aria-hidden="true"><Words text="Mahan" beat={0} until={0} start={160} /></span>
              <span aria-hidden="true" className="ab-dim"><Words text="Adeli." beat={0} until={0} start={250} /></span>
            </h1>
            <p className="ab-role"><Rise beat={0} until={0} start={420}>Full-stack engineer, on every layer.</Rise></p>
            <p className="ab-lede"><Rise beat={0} until={0} start={520}>I build production financial and Web3 products with React, Next.js, TypeScript and Node.js, from the first sketch to the servers that keep them running. Click anything in the town to see what I do there, or send a request through all five layers.</Rise></p>
            <div className="ab-ctas">
              <span className="ab-pop" {...pop(0, 660, 0)}><a className="ab-btn ab-btn-dark" href={`mailto:${CONTACT_EMAIL}`}>Start a project<span className="ab-btn-ic"><Arrow /></span></a></span>
              <span className="ab-pop" {...pop(0, 740, 0)}><button type="button" className="ab-btn ab-btn-light" onClick={() => world.current?.send()} disabled={failed}>Send a request<span className="ab-btn-ic"><Arrow d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" /></span></button></span>
            </div>
          </div>

          {LAYERS.map((l, i) => {
            const b = i + 1;
            const tries = NOTES.filter(n => n.layer === l.id);
            return (
              <div key={l.id} id={`sw-${l.id}`} className="sw-page sw-layer" role="tabpanel" aria-label={l.label} style={{ "--c": TONE[l.id] } as CSSProperties}>
                <p className="sw-back"><Rise beat={b} until={b}><button type="button" onClick={() => setSelected(null)}><Arrow d="M11 8H4M7.5 4.5 4 8l3.5 3.5" />Every layer</button></Rise></p>
                <h2 className="sw-label" aria-label={l.label}><span aria-hidden="true"><i className="ab-pop" {...pop(b, 60, b)} /><Words text={l.label} beat={b} until={b} start={60} /></span></h2>
                <p className="sw-title"><Rise beat={b} until={b} start={180}>{l.title}</Rise></p>
                <p className="sw-text"><Rise beat={b} until={b} start={320}>{l.copy}</Rise></p>
                <ul className="sw-tools" aria-label={`${l.label} tools`}>
                  {l.tools.map((t, k) => <li key={t} className="ab-pop" {...pop(b, 440 + k * 50, b)}>{t}</li>)}
                </ul>
                <div className="sw-try" aria-label="Try it in the scene">
                  {tries.map((n, k) => (
                    <span key={n.id} className="ab-pop" {...pop(b, 700 + k * 70, b)}>
                      <button type="button" aria-pressed={noteId === n.id} onClick={() => world.current?.show(n.id)} disabled={failed}>{n.action}</button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sw-dock">
        <div className="sw-rail" role="tablist" aria-label="Layers of the stack">
          <span className="sw-capsule" aria-hidden="true" />
          {LAYERS.map(l => (
            <button key={l.id} type="button" role="tab" className="sw-tab" aria-selected={selected === l.id} aria-controls={`sw-${l.id}`} data-sfx="data" onClick={() => choose(l.id)} style={{ "--c": TONE[l.id] } as CSSProperties}>
              <i />{l.label}
            </button>
          ))}
        </div>
        <button type="button" className="sw-icon" aria-pressed={sound} aria-label={sound ? "Turn sound off" : "Turn sound on"} onClick={() => { void setSound(!sound); }}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3.5 7.5h3l4-3.5v12l-4-3.5h-3z" />
            {sound ? <path d="M13.5 7a4 4 0 0 1 0 6M15.6 5a7 7 0 0 1 0 10" /> : <path d="M13.5 8l4 4M17.5 8l-4 4" />}
          </svg>
        </button>
      </div>
      <p className="sw-hint" aria-hidden="true">Click anything · drag to turn the board</p>
    </section>
  );
}
