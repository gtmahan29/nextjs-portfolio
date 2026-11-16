"use client";

import { useEffect } from "react";

/** Flips the fixed header to its light treatment while a dark section sits beneath it. */
export default function HeaderTheme() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".jny-header");
    const targets = Array.from(document.querySelectorAll<HTMLElement>(".jny-root .jny-closing, .jny-root .wp-why, .jny-root .wp-pricing, .jny-root .jny-footer, .jny-root .st-hall.jny-dark"));
    if (!header || !targets.length) return;
    let io: IntersectionObserver | undefined;
    const under = new Set<Element>();
    const connect = () => {
      io?.disconnect();
      under.clear();
      // Observe only the strip of the viewport the header occupies. Over these sections the
      // header gains a frosted bar so passing text never collides with the nav.
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => (e.isIntersecting ? under.add(e.target) : under.delete(e.target)));
          const list = Array.from(under);
          // Full-bleed scenes (.jny-bare) only switch the header to light-on-dark; they get no frosted bar.
          const dark = list.some((el) => el.classList.contains("jny-dark"));
          header.classList.toggle("jny-header-glass", list.some((el) => !el.classList.contains("jny-bare")));
          header.classList.toggle("jny-header-dark", dark);
          header.dataset.themeDark = String(dark);
        },
        { rootMargin: `0px 0px ${-(innerHeight - header.offsetHeight)}px 0px` }
      );
      targets.forEach((t) => io!.observe(t));
    };
    connect();
    window.addEventListener("resize", connect);
    return () => {
      window.removeEventListener("resize", connect);
      io?.disconnect();
    };
  }, []);
  return null;
}
