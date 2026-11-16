"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { IconArrowLeft, IconArrowRight, IconArrowUpRight } from "@tabler/icons-react";
import { CONTACT_EMAIL, PLANS, type PlanId } from "./data";
import { createSpring, SPRING_PEAK } from "./motion-curve";
import { createStagedMotion } from "./staged-motion";
import { Words } from "./staged-words";
import { addJob, createCapsule, wake } from "./spring-ticker";
import { play } from "./sfx";

/**
 * The first message, one question at a time.
 *
 * A dot on the line between You and Mahan is the progress: each answer moves
 * it along, and sending carries it the rest of the way, where Mahan catches
 * it. The brief opens in the visitor's email app; nothing leaves the page
 * until they send it there.
 */
const STEPS = [
  { key: "brief", ask: "What are you building?" },
  { key: "name", ask: "Who am I talking to?" },
  { key: "email", ask: "Where should I reply?" },
  { key: "plan", ask: "What fits best?" },
] as const;
const SENT = STEPS.length;

type Values = { brief: string; name: string; email: string };
const check = (step: number, v: Values) => {
  if (step === 0 && v.brief.trim().length < 10) return "A line or two is enough.";
  if (step === 1 && !v.name.trim()) return "Add your name.";
  if (step === 2 && !/^\S+@\S+\.\S+$/.test(v.email.trim())) return "An address I can reply to.";
  return "";
};

export default function ContactForm() {
  const root = useRef<HTMLDivElement>(null);
  const pickRow = useRef<HTMLDivElement>(null);
  const capsule = useRef<ReturnType<typeof createCapsule>>();
  const stepRef = useRef(0);
  const nudge = useRef<() => void>();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>({ brief: "", name: "", email: "" });
  const [plan, setPlan] = useState<PlanId>("unsure");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const pick = (event: Event) => {
      const id = (event as CustomEvent<PlanId>).detail;
      if (PLANS.some((p) => p.id === id)) setPlan(id);
    };
    window.addEventListener("journey-plan", pick);
    return () => window.removeEventListener("journey-plan", pick);
  }, []);

  // Questions change on the shared spring; the dot rides the line; Mahan catches it.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const questions = createStagedMotion(Array.from(el.querySelectorAll<HTMLElement>(".jk-steps [data-beat]")), { lag: 0.2, initial: 0 });
    const track = el.querySelector<HTMLElement>(".jk-track")!, dot = el.querySelector<HTMLElement>(".jk-dot")!;
    const fill = el.querySelector<HTMLElement>(".jk-fill")!, mahan = el.querySelector<HTMLElement>(".jk-face-mahan")!;
    const row = el.querySelector<HTMLElement>(".jk-steps")!;
    const t = createSpring(0), caught = createSpring(0), shake = createSpring(0);
    let landed = false;
    const stop = addJob(dt => {
      const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const s = stepRef.current;
      let moving = questions.update(s, dt, still);
      for (const [spring, goal] of [[t, s / SENT], [caught, 0], [shake, 0]] as const) {
        if (still) spring.snap(goal); else moving = spring.step(goal, dt) || moving;
      }
      if (s === SENT && !landed && t.value > 0.985) {
        landed = true; caught.kick(7);
        if (!still && !document.hidden) play("ui_pop");
      }
      if (s < SENT) landed = false;
      const span = track.clientWidth;
      dot.style.transform = `translate3d(${(Math.min(1.04, t.value) * span).toFixed(1)}px,0,0) scale(${(1 + Math.abs(t.velocity) * 0.5).toFixed(3)},${(1 - Math.min(0.3, Math.abs(t.velocity) * 0.25)).toFixed(3)})`;
      fill.style.transform = `scaleX(${Math.max(0, Math.min(1, t.value)).toFixed(4)})`;
      mahan.style.transform = `scale(${(1 + caught.value * 0.07).toFixed(4)})`;
      row.style.transform = `translate3d(${(shake.value * 10).toFixed(2)}px,0,0)`;
      return moving;
    });
    nudge.current = () => { shake.kick(-14); wake(); };
    return stop;
  }, []);

  useEffect(() => {
    const row = pickRow.current;
    if (!row) return;
    capsule.current = createCapsule(row.querySelector<HTMLElement>(".jny-pick-capsule")!, row);
    return () => capsule.current?.dispose();
  }, []);
  useEffect(() => {
    capsule.current?.to(step === 3 ? pickRow.current?.querySelector<HTMLElement>(`label[data-plan="${plan}"]`) ?? null : null);
  }, [plan, step]);

  // Only the question on stage can be reached by keyboard or screen reader.
  useEffect(() => {
    root.current?.querySelectorAll<HTMLElement>(".jk-step").forEach((n) => n.toggleAttribute("inert", Number(n.dataset.step) !== step));
  }, [step]);

  const go = (next: number) => {
    stepRef.current = next;
    setStep(next);
    setError("");
    wake();
    if (next < SENT) {
      // Hand the keyboard to the new question once it is on stage.
      setTimeout(() => root.current?.querySelector<HTMLElement>(`[data-step="${next}"] :is(textarea, input)`)?.focus({ preventScroll: true }), 260);
    }
  };

  const brief = () => {
    const label = PLANS.find((p) => p.id === plan)!.label;
    return `Hi Mahan,\n\n${values.brief.trim()}\n\nWhat fits best: ${label}\n\n${values.name.trim()}\n${values.email.trim()}`;
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = check(step, values);
    if (problem) {
      setError(problem);
      nudge.current?.();
      return;
    }
    if (step < STEPS.length - 1) return go(step + 1);
    go(SENT);
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`New project: ${values.name.trim()}`)}&body=${encodeURIComponent(brief())}`;
  }

  // In the message box, Enter moves on; Shift+Enter starts a new line.
  const briefKeys = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  async function copy() {
    try { await navigator.clipboard.writeText(brief()); setCopied(true); } catch { setCopied(false); }
  }

  const set = (key: keyof Values) => (event: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [key]: event.target.value }));
    if (error) setError("");
  };
  const live = (i: number) => (step === i ? {} : { "aria-hidden": true as const });

  return (
    <div className="jk-shell" ref={root}>
      <div className="jk-core">
        <div className="jk-wire" aria-hidden="true">
          <span className="jk-face">You</span>
          <span className="jk-track"><i className="jk-fill" /><i className="jk-dot" /></span>
          <span className="jk-face jk-face-mahan">M</span>
        </div>

        <form className="jk-form" onSubmit={submit} noValidate>
          <div className="jk-steps">
            {STEPS.map((s, i) => (
              <div className="jk-step" key={s.key} data-step={i} data-on={step === i} {...live(i)}>
                <label className="jk-ask" htmlFor={`jk-${s.key}`} id={`jk-ask-${s.key}`}>
                  <Words text={s.ask} beat={i} until={i} step={50} />
                </label>
                <div className="jk-answer jm-m jm-b">
                  <span className="jm-in" data-beat={i} data-until={i} data-delay="160">
                    {s.key === "brief" && (
                      <textarea id="jk-brief" name="brief" rows={3} value={values.brief} onChange={set("brief")} onKeyDown={briefKeys} placeholder="A booking platform for my studio, with payments and a simple admin." aria-invalid={step === 0 && !!error} aria-describedby="jk-error" />
                    )}
                    {s.key === "name" && (
                      <input id="jk-name" name="name" autoComplete="name" value={values.name} onChange={set("name")} placeholder="Alex Morgan" aria-invalid={step === 1 && !!error} aria-describedby="jk-error" />
                    )}
                    {s.key === "email" && (
                      <input id="jk-email" name="email" type="email" inputMode="email" autoComplete="email" value={values.email} onChange={set("email")} placeholder="alex@company.com" aria-invalid={step === 2 && !!error} aria-describedby="jk-error" />
                    )}
                    {s.key === "plan" && (
                      <div className="jk-plans" ref={pickRow} role="radiogroup" aria-labelledby="jk-ask-plan">
                        <span className="jny-pick-capsule" aria-hidden="true" />
                        {PLANS.map((p) => (
                          <label key={p.id} data-plan={p.id} className={plan === p.id ? "on" : undefined}>
                            <input type="radio" name="plan" value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id)} />
                            {p.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </span>
                </div>
              </div>
            ))}

            <div className="jk-step jk-done" data-step={SENT} data-on={step === SENT} {...live(SENT)}>
              <p className="jk-ask"><Words text="On its way." beat={SENT} step={60} /></p>
              <p className="jk-note jm-m jm-b">
                <span className="jm-in" data-beat={SENT} data-delay="260" role="status">
                  Your email app should open with the brief ready to send.{" "}
                  {copied ? <>Copied. Paste it into an email to {CONTACT_EMAIL}.</> : <>If it doesn’t, <button type="button" onClick={copy}>copy the brief</button>.</>}
                </span>
              </p>
            </div>
          </div>

          <p className="jk-error" id="jk-error" role="alert">{error}</p>

          <div className="jk-actions">
            <button type="button" className="jk-back" onClick={() => go(Math.max(0, step - 1))} disabled={step === 0} aria-label="Previous question" data-sfx="data">
              <IconArrowLeft size={18} stroke={1.5} />
            </button>
            {step < SENT ? (
              <button type="submit" className="jk-next" data-last={step === STEPS.length - 1} data-sfx={step === STEPS.length - 1 ? "big" : "data"}>
                <span className="jk-next-t">
                  <span data-on={step < STEPS.length - 1}>Next</span>
                  <span data-on={step === STEPS.length - 1}>Send to Mahan</span>
                </span>
                <span className="jk-next-ic" aria-hidden="true">{step === STEPS.length - 1 ? <IconArrowUpRight size={17} stroke={1.6} /> : <IconArrowRight size={17} stroke={1.6} />}</span>
              </button>
            ) : (
              <button type="button" className="jk-next" onClick={() => go(0)} data-sfx="data">
                <span className="jk-next-t"><span data-on="true">Edit the brief</span></span>
                <span className="jk-next-ic" aria-hidden="true"><IconArrowLeft size={17} stroke={1.6} /></span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
