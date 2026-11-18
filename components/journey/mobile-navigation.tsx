"use client";

import { useEffect, useRef, useState } from "react";
import { IconArrowUpRight } from "@tabler/icons-react";
import { SPRING_PEAK } from "./motion-curve";
import { play } from "./sfx";
import { AFTER, BEFORE, createStagedMotion } from "./staged-motion";
import { Rise } from "./staged-words";
import { addJob, createHeight, wake } from "./spring-ticker";

/*
MOTION SCORE — mobile navigation
Trigger: press the header menu button
| Beat | Element | Pattern | Motion | Delay | Exit | Sound |
| Open | Panel and icon | P7 | Panel unfolds and bars turn into a cross on the same spring | 0 | Reverse | ui_pop at peak, if enabled |
| Open | Links | P2 | Rise through individual masks | .16 s + .08 s per row | Rise out with half the stagger | — |
| Press | Menu button | P17 | Slight compression | 0 | Spring back | — |
Reduced motion: snap panel, icon and links to their destinations.
Phone: open below the header, with a scrollable panel on short screens.
*/
export default function MobileNavigation({ links }: { links: readonly { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const items = useRef<HTMLDivElement>(null);
  const stage = useRef(BEFORE);
  const height = useRef<ReturnType<typeof createHeight> | null>(null);

  useEffect(() => {
    const host = root.current, drawer = panel.current, list = items.current;
    if (!host || !drawer || !list) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const reveal = createHeight(drawer, list, false, host);
    const rows = createStagedMotion(Array.from(list.querySelectorAll<HTMLElement>("[data-beat]")));
    const removeJob = addJob(dt => rows.update(stage.current, dt, reduced.matches));
    const resize = new ResizeObserver(wake);
    resize.observe(list);
    reduced.addEventListener("change", wake);
    height.current = reveal;

    return () => {
      height.current = null;
      reveal.dispose();
      removeJob();
      rows.dispose();
      resize.disconnect();
      reduced.removeEventListener("change", wake);
    };
  }, []);

  useEffect(() => {
    if (!open && stage.current === BEFORE) return;
    stage.current = open ? 0 : AFTER;
    height.current?.set(open);

    if (open && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const catchSound = window.setTimeout(() => play("ui_pop"), SPRING_PEAK * 1000);
      return () => window.clearTimeout(catchSound);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const mobile = matchMedia("(max-width: 860px)");
    const onResize = () => { if (!mobile.matches) setOpen(false); };
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const dismissWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      setOpen(false);
      toggle.current?.focus({ preventScroll: true });
    };

    mobile.addEventListener("change", onResize);
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissWithEscape);
    return () => {
      mobile.removeEventListener("change", onResize);
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissWithEscape);
    };
  }, [open]);

  return (
    <div className="jny-mobile-menu" ref={root} onBlur={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button type="button" className="jny-menu-toggle" ref={toggle}
        aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="journey-mobile-nav"
        data-sfx="none" onClick={() => setOpen(value => !value)}>
        <span className="jny-menu-icon" aria-hidden="true"><span /><span /></span>
      </button>
      <nav id="journey-mobile-nav" aria-label="Primary" aria-hidden={!open}
        className="jny-menu-panel" data-open={open ? "" : undefined} ref={panel}>
        <div className="jny-menu-items" ref={items} data-lenis-prevent>
          {links.map(({ href, label }, index) => (
            <a className="jny-menu-link" href={href} key={href} tabIndex={open ? undefined : -1} onClick={() => {
              toggle.current?.focus({ preventScroll: true });
              setOpen(false);
            }}>
              <Rise beat={0} start={160 + index * 80}>
                <span className="jny-menu-link-content">{label}<IconArrowUpRight size={19} stroke={1.6} aria-hidden="true" /></span>
              </Rise>
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
