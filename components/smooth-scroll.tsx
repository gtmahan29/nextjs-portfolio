"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { springCurve } from "@/components/journey/motion-curve";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

export function smoothScrollTo(top: number, immediate = false) {
  window.dispatchEvent(new CustomEvent("smooth-scroll-to", { detail: { top, immediate } }));
}

/** One leg of a played scroll: travel to `top` over `duration` s, then rest `hold` s. */
export type ScrollLeg = { top: number; duration: number; hold?: number };
/**
 * Plays the page through a few legs on its own, with the visitor's input locked until the last
 * leg lands (wheel, touch and keys). Each leg travels on the shared spring curve, so the page
 * arrives the way everything else does: a slight overshoot, then caught. Resolves when done.
 */
export function playScroll(legs: ScrollLeg[]) {
  return new Promise<void>(resolve => {
    window.dispatchEvent(new CustomEvent("smooth-scroll-play", { detail: { legs, done: resolve } }));
  });
}

/** Input has one owner. Render progress must never gate or rewrite wheel input. */
export default function SmoothScroll() {
  const pathname = usePathname();
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = matchMedia("(pointer: coarse)").matches;
    const wheelStepLimit = coarse ? 46 : 140;
    const lenis = new Lenis({
      autoRaf: false,
      smoothWheel: !reduced,
      syncTouch: false,
      allowNestedScroll: true,
      lerp: .075,
      anchors: true,
      virtualScroll: (data) => {
        const { event, deltaY } = data;
        if (event.type === "wheel") {
          data.deltaY = Math.max(-wheelStepLimit, Math.min(wheelStepLimit, deltaY));
        }
        return true;
      },
    });
    const update = () => ScrollTrigger.update();
    const frame = (time: number) => lenis.raf(time * 1000);
    lenis.on("scroll", update);
    gsap.ticker.add(frame);
    gsap.ticker.lagSmoothing(0);
    const navigate = (event: Event) => {
      const detail = (event as CustomEvent<number | { top: number; immediate: boolean }>).detail;
      const top = typeof detail === "number" ? detail : detail.top;
      const immediate = typeof detail !== "number" && detail.immediate;
      lenis.scrollTo(top, { immediate, force: immediate, duration: reduced ? 0 : 1.1,
        easing: (t: number) => 1 - Math.pow(1 - t, 3) });
    };
    window.addEventListener("smooth-scroll-to", navigate);
    // A played sequence owns the page until it lands; the visitor's input is held, not queued.
    let playing = 0;
    const play = (event: Event) => {
      const { legs, done } = (event as CustomEvent<{ legs: ScrollLeg[]; done: () => void }>).detail;
      const run = ++playing;
      lenis.stop();
      document.documentElement.dataset.scrollPlaying = "true";
      const finish = () => {
        if (run !== playing) return;
        lenis.start();
        delete document.documentElement.dataset.scrollPlaying;
        done();
      };
      const leg = (i: number) => {
        if (run !== playing) return;
        if (i >= legs.length) { finish(); return; }
        const { top, duration, hold = 0 } = legs[i];
        lenis.scrollTo(top, {
          force: true, lock: true, duration: reduced ? 0 : duration, immediate: reduced,
          easing: (t: number) => springCurve(t),
          onComplete: () => { window.setTimeout(() => leg(i + 1), reduced ? 0 : hold * 1000); },
        });
      };
      leg(0);
    };
    window.addEventListener("smooth-scroll-play", play);
    // The page loader holds the page still until the first screen is ready.
    const hold = (event: Event) => { if ((event as CustomEvent<boolean>).detail) lenis.stop(); else if (!playing || document.documentElement.dataset.scrollPlaying !== "true") lenis.start(); };
    window.addEventListener("smooth-scroll-hold", hold);
    if (document.documentElement.dataset.loading === "true") lenis.stop();
    return () => {
      playing++;
      lenis.start();
      delete document.documentElement.dataset.scrollPlaying;
      window.removeEventListener("smooth-scroll-play", play);
      window.removeEventListener("smooth-scroll-hold", hold);
      window.removeEventListener("smooth-scroll-to", navigate);
      gsap.ticker.remove(frame);
      lenis.off("scroll", update);
      lenis.destroy();
    };
  }, [pathname]);
  return null;
}
