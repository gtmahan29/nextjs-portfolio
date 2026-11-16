"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { springCurve, SPRING_PEAK, SPRING_DURATION } from "./motion-curve";
import { play } from "./sfx";

gsap.registerPlugin(ScrollTrigger);

export default function ClosingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".jny-root");
    if (!root) return;
    const media = gsap.matchMedia();

    media.add("(prefers-reduced-motion: no-preference)", () => {
      const disposers: Array<() => void> = [];
      const titles = root.querySelectorAll<HTMLElement>(".jny-closing .jny-h2");
      titles.forEach(title => {
        const lines = title.querySelectorAll<HTMLElement>(".jny-title-mask > span");
        if (!lines.length) return;
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: title,
            start: "top 100%",
            end: "top 48%",
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });
        timeline.fromTo(lines, { yPercent: 180 }, {
          yPercent: 0,
          duration: 1,
          stagger: .16,
          ease: springCurve,
          immediateRender: false,
        });
        const show = () => timeline.progress(1);
        title.addEventListener("focusin", show);
        disposers.push(() => title.removeEventListener("focusin", show));
      });

      root.querySelectorAll<HTMLElement>(".jny-principle, .jny-plan, .jny-qa, .jny-cta .jny-brief").forEach(element => {
        gsap.fromTo(element,
          { y: element.classList.contains("jny-brief") ? 56 : 32 },
          {
            y: 0,
            ease: "power2.out",
            immediateRender: false,
            scrollTrigger: {
              trigger: element,
              start: "top 100%",
              end: "top 68%",
              scrub: .9,
              invalidateOnRefresh: true,
            },
          },
        );
      });

      // Secondary copy follows the main composition at a gentler distance.
      root.querySelectorAll<HTMLElement>(".jny-why-label, .jny-closing .jny-lede, .jny-assure li, .jny-price-note, .jny-direct").forEach(element => {
        gsap.fromTo(element, { y: 24 }, {
          y: 0,
          ease: "power2.out",
          immediateRender: false,
          scrollTrigger: {
            trigger: element,
            start: "top 100%",
            end: "top 72%",
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });
      });

      const mark = root.querySelector<HTMLElement>(".jny-footer-mark");
      if (mark) {
        gsap.fromTo(mark, { yPercent: 30 }, {
          yPercent: 0,
          ease: "power2.out",
          immediateRender: false,
          scrollTrigger: { trigger: mark, start: "top bottom", end: "bottom bottom", scrub: 1 },
        });
      }

      root.querySelectorAll<HTMLDetailsElement>(".jny-qa").forEach(details => {
        const summary = details.querySelector("summary");
        const icon = summary?.querySelector("svg");
        const answer = details.querySelector(".a");
        if (!summary || !icon || !answer) return;
        let animation: gsap.core.Timeline | undefined;
        let pointer = false;
        const input = (event: MouseEvent) => { pointer = event.detail > 0; };
        const toggle = () => {
          animation?.kill();
          gsap.set([icon, answer], { clearProps: "transform" });
          if (!pointer || !details.open) return;
          const duration = .72;
          animation = gsap.timeline()
            .from(icon, { scale: .8, duration, ease: springCurve, clearProps: "transform" }, 0)
            .from(answer, { y: -10, duration, ease: springCurve, clearProps: "transform" }, 0)
            .call(() => { if (details.open && !document.hidden) play("ui_pop"); }, [], duration * SPRING_PEAK / SPRING_DURATION);
        };
        summary.addEventListener("click", input);
        details.addEventListener("toggle", toggle);
        disposers.push(() => {
          summary.removeEventListener("click", input);
          details.removeEventListener("toggle", toggle);
          animation?.kill();
          gsap.set([icon, answer], { clearProps: "transform" });
        });
      });
      return () => disposers.forEach(dispose => dispose());
    }, root);

    return () => media.revert();
  }, []);
  return null;
}
