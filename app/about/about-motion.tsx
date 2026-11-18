"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { stageOnEnter, wake } from "@/components/journey/spring-ticker";
import { springLinear } from "@/components/journey/motion-curve";
import { play } from "@/components/journey/sfx";
import { SPRING_PEAK } from "@/components/journey/motion-curve";

/**
 * Stages every [data-stage] block of the About page when it is well inside the viewport, on the
 * journey's shared spring (staged-motion: --e / --x per node, exit before enter, real time).
 * The pinned Expertise section runs its own beats. One soft sound when the closing section
 * arrives (opt-in, as everywhere on the site).
 */
export default function AboutMotion({ children, className = "" }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = root.current!;
    host.style.setProperty("--ease-spring", springLinear());
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const dispose = Array.from(host.querySelectorAll<HTMLElement>("[data-stage]"), section =>
      stageOnEnter(section, Array.from(section.querySelectorAll<HTMLElement>("[data-beat]")).filter(n => n.closest("[data-stage]") === section), {
        at: .82,
        onEnter: section.id === "contact" ? () => { if (!media.matches && !document.hidden) play("ui_pop", .2 + SPRING_PEAK); } : undefined,
      })
    );
    media.addEventListener("change", wake);
    return () => {
      dispose.forEach(stop => stop());
      media.removeEventListener("change", wake);
    };
  }, []);
  return <div className={`about-page ${className}`} ref={root}>{children}</div>;
}
