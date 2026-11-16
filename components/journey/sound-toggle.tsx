"use client";

import { useEffect, useState } from "react";
import { onSoundChange, play, setSound, soundWanted, type Sfx } from "./sfx";

/** Which click sound an element earns. Primary actions get the big click; selectors and steppers get the data click. */
function soundFor(el: Element): Sfx {
  const named = el.closest<HTMLElement>("[data-sfx]")?.dataset.sfx;
  if (named === "big") return "ui_big_click";
  if (named === "data") return "ui_click_data";
  if (el.matches('.sp-pill, .svc-go, .jny-send, a[href="#contact"]')) return "ui_big_click";
  if (el.closest(".sp-dots, .jny-faq, [role='radiogroup'], [role='tablist']")) return "ui_click_data";
  return "ui_click";
}

/** A small round toggle in the corner: sound is opt-in, and remembered. */
export default function SoundToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => onSoundChange(setOn), []);

  useEffect(() => {
    // A returning visitor who chose sound gets it back on their first gesture (audio cannot start before one).
    if (!soundWanted()) return;
    const start = () => { void setSound(true); };
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    return () => { window.removeEventListener("pointerdown", start); window.removeEventListener("keydown", start); };
  }, []);

  useEffect(() => {
    const click = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest("a, button, label, summary");
      if (!target || target.closest(".jny-sound")) return;
      play(soundFor(target));
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, []);

  const toggle = async () => {
    await setSound(!on);
    play("ui_click");
  };

  return (
    <button type="button" className="jny-sound" data-on={on || undefined} aria-pressed={on} aria-label={on ? "Turn sound off" : "Turn sound on"} onClick={toggle}>
      <span aria-hidden="true"><i /><i /><i /><i /></span>
    </button>
  );
}
