"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

export function smoothScrollTo(top: number, immediate = false) {
  window.dispatchEvent(new CustomEvent("smooth-scroll-to", { detail: { top, immediate } }));
}

/** Input has one owner. Render progress must never gate or rewrite wheel input. */
export default function SmoothScroll() {
  const pathname = usePathname();
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = new Lenis({
      autoRaf: false,
      smoothWheel: !reduced,
      syncTouch: false,
      allowNestedScroll: true,
      lerp: .075,
      anchors: true,
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
    return () => {
      window.removeEventListener("smooth-scroll-to", navigate);
      gsap.ticker.remove(frame);
      lenis.off("scroll", update);
      lenis.destroy();
    };
  }, [pathname]);
  return null;
}
