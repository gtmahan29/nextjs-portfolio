"use client";

import {useLayoutEffect, type RefObject} from "react";
import {gsap} from "gsap";
import {ScrollTrigger} from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** One conductor for editorial motion. Native dialog scrolling remains the source. */
export function useCaseChoreography(article: RefObject<HTMLDivElement>, scroller: RefObject<HTMLDialogElement>, enabled: boolean) {
  useLayoutEffect(() => {
    if (!enabled || !article.current || !scroller.current) return;
    const root = article.current;
    const surface = scroller.current;
    const context = gsap.context(() => {
      const entrance = (element: Element) => ({trigger: element, scroller: surface, start: "top 91%", toggleActions: "play none none none"});
      root.querySelectorAll<HTMLElement>(".aaq-chapter-heading").forEach(heading => {
        const timeline = gsap.timeline({scrollTrigger: entrance(heading)});
        timeline.from(heading.querySelectorAll("[data-reveal-word]"), {yPercent: 115, rotate: 2, transformOrigin: "left bottom", duration: 1.15, stagger: .055, ease: "power4.out"}, 0);
        timeline.from(heading.querySelector(":scope > span"), {x: -16, clipPath: "inset(0 100% 0 0)", duration: .9, ease: "power3.out"}, .08);
      });
      root.querySelectorAll<HTMLElement>(".aaq-subsection h3, .aaq-mobile-spread h3, .aaq-mini-editorial strong, .aaq-case-closing > p").forEach(heading => {
        gsap.from(heading, {clipPath: "inset(0 0 100% 0)", y: 24, duration: 1.15, ease: "power4.out", scrollTrigger: entrance(heading)});
      });
      root.querySelectorAll<HTMLElement>(".aaq-capture").forEach(capture => {
        gsap.from(capture, {clipPath: "inset(8% 4% 8% 4% round 14px)", duration: 1.2, ease: "power3.out", scrollTrigger: entrance(capture)});
        const blocks = capture.querySelectorAll(".aaq-capture-mark, .aaq-capture-body h3, .aaq-capture-body p, .aaq-capture-format");
        gsap.from(blocks, {y: 26, duration: 1.05, stagger: .075, ease: "power3.out", scrollTrigger: entrance(capture)});
      });
      root.querySelectorAll<HTMLElement>(".aaq-decision-list > div").forEach(row => {
        gsap.from(row, {x: 16, clipPath: "inset(0 0 0 100%)", duration: 1.1, ease: "power4.out", scrollTrigger: entrance(row)});
      });
      root.querySelectorAll<HTMLElement>(".aaq-type-contract > div").forEach((row, i) => {
        gsap.from(row, {y: 36, duration: 1.1, delay: i * .1, ease: "power4.out", scrollTrigger: entrance(row)});
      });
      root.querySelectorAll<HTMLElement>(".aaq-anatomy-structure").forEach(structure => {
        gsap.from(structure.children, {scaleX: 0, transformOrigin: "left center", stagger: .07, duration: 1.15, ease: "power3.out", scrollTrigger: entrance(structure)});
      });
      root.querySelectorAll<HTMLElement>(".aaq-token-swatches").forEach(palette => {
        gsap.from(palette.children, {clipPath: "inset(100% 0 0 0)", duration: 1.15, stagger: .1, ease: "power4.out", scrollTrigger: entrance(palette)});
      });
      root.querySelectorAll<HTMLElement>(".aaq-map-canvas").forEach(map => {
        gsap.from(map.querySelectorAll(".aaq-map-node"), {y: 20, clipPath: "inset(0 0 100% 0)", duration: 1, stagger: .1, ease: "power3.out", scrollTrigger: entrance(map)});
      });
      root.querySelectorAll<HTMLElement>(".aaq-mobile-slot").forEach(phone => {
        gsap.fromTo(phone, {y: 42, rotation: 2}, {y: -22, rotation: -1, ease: "none", scrollTrigger: {trigger: phone.parentElement, scroller: surface, start: "top bottom", end: "bottom top", scrub: 1.15}});
      });
      root.querySelectorAll<HTMLElement>(".aaq-editor-note, .aaq-mini-editorial").forEach(note => {
        gsap.from(note, {"--aaq-rule": 0, duration: 1.3, ease: "power3.out", scrollTrigger: entrance(note)});
      });
    }, root);
    let alive = true;
    let refreshFrame = 0;
    const refresh = () => {cancelAnimationFrame(refreshFrame);refreshFrame = requestAnimationFrame(() => {if (alive) ScrollTrigger.refresh();});};
    document.fonts.ready.then(refresh);
    const observer = new ResizeObserver(refresh);
    observer.observe(root);
    return () => {alive = false;cancelAnimationFrame(refreshFrame);observer.disconnect();context.revert();};
  }, [article, scroller, enabled]);
}
