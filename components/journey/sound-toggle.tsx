"use client";

import { useEffect, useState } from "react";
import { IconVolume, IconVolumeOff } from "@tabler/icons-react";
import { onSoundChange, play, setSound, soundOn, soundWanted, type Sfx } from "./sfx";

/** Which click sound an element earns. Primary actions get the big click; selectors and steppers get the data click. */
function soundFor(el: Element): Sfx {
  const named = el.closest<HTMLElement>("[data-sfx]")?.dataset.sfx;
  if (named === "big") return "ui_big_click";
  if (named === "data") return "ui_click_data";
  if (el.matches('.sp-pill, .svc-go, .jny-send, a[href="#contact"]')) return "ui_big_click";
  if (el.closest(".sp-dots, .jny-faq, [role='radiogroup'], [role='tablist']")) return "ui_click_data";
  return "ui_click";
}

/** Sound is opt-in, and the choice is remembered across visits. */
export default function SoundToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(soundOn());
    return onSoundChange(setOn);
  }, []);

  useEffect(() => {
    // A returning visitor who chose sound gets it back on their first gesture (audio cannot start before one).
    if (!soundWanted() || soundOn()) return;
    const stop = () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
    function start(event: Event) {
      if (event.target instanceof Element && event.target.closest(".jny-sound")) return;
      stop();
      if (soundWanted() && !soundOn()) void setSound(true);
    }
    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);
    return stop;
  }, []);

  useEffect(() => {
    const click = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest("a, button, label, summary");
      if (!target || target.closest(".jny-sound, [data-sfx='none']")) return;
      play(soundFor(target));
    };
    // Controls marked data-press answer the finger landing with the switch's actuation tick;
    // the click sound then belongs to the release, like a real key.
    const press = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if ((event.target as Element | null)?.closest("[data-press]")) play("key_down");
    };
    document.addEventListener("click", click, true);
    document.addEventListener("pointerdown", press, true);
    return () => { document.removeEventListener("click", click, true); document.removeEventListener("pointerdown", press, true); };
  }, []);

  const toggle = async () => {
    await setSound(!soundOn());
    play("ui_click");
  };

  return (
    <button type="button" className="jny-sound" aria-pressed={on} aria-label="Sound effects" title={on ? "Mute sound" : "Enable sound"} onClick={toggle}>
      {on ? <IconVolume size={19} stroke={1.6} aria-hidden="true" /> : <IconVolumeOff size={19} stroke={1.6} aria-hidden="true" />}
    </button>
  );
}
