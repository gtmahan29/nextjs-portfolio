"use client";
import { useEffect, useRef, useState } from "react";
import { smoothScrollTo } from "@/components/smooth-scroll";
import localFont from "next/font/local";
import IsometricStory from "./isometric-story";
const heroDisplay=localFont({src:"../../public/fonts/Yorkmade.woff2",weight:"700",display:"swap"});
export default function HeroPortal() {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const copy = useRef<HTMLDivElement>(null);
  // The promise stays until the visitor starts scrolling into the journey, then gets out of the way.
  useEffect(() => {
    const el = copy.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const k = Math.min(1, Math.max(0, scrollY / (innerHeight * 0.3)));
      el.style.opacity = String(1 - k);
      el.style.transform = `translate3d(0,${(k * 16).toFixed(1)}px,0)`;
      el.style.pointerEvents = k > 0.8 ? "none" : "auto";
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    addEventListener("scroll", on, { passive: true });
    return () => { removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, []);
  useEffect(() => {
    let disposed = false;
    let release: (() => void) | undefined;
    import("./holographic-start-scene").then(async ({ mountStartScene }) => {
      if (!host.current || disposed) return;
      release = await mountStartScene(host.current, () => !disposed && setReady(true));
      if (disposed) release?.();
    }).catch(() => {});
    return () => { disposed = true; release?.(); };
  }, []);
  return <><section className="hero-portal hero-start" aria-label="Start your journey">
    <div className="hero-start-viewport">
    {!ready && <div className="hero-start-loading" role="status" aria-label="Loading the 3D button"><span /></div>}
    <div ref={host} className={`hero-start-scene ${ready ? "is-ready" : ""}`}>
      <div className="hero-start-next" aria-hidden="true">
        <IsometricStory />
      </div>
      <h1 className={`hero-start-title ${heroDisplay.className}`}><span>MAKE IT</span><strong>REAL</strong></h1>
    </div>
    <button className="hero-start-hit" aria-label="Start the journey" onClick={() => {
      const hero = host.current?.closest(".hero-start");
      if (hero && host.current) {
        hero.dispatchEvent(new Event("hero-start-activate"));
        smoothScrollTo(hero.getBoundingClientRect().top + window.scrollY + host.current.clientHeight * .18);
      }
    }} />
    <div ref={copy} className="hero-start-copy">
      <p>Websites, apps and internal platforms, designed and built by one developer from the first call to launch.</p>
      <div className="hero-start-actions">
        <a className="hero-start-cta" href="#contact">
          <span>Start a project</span>
          <span className="ic" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M4 12L12 4M5.5 4H12v6.5" /></svg></span>
        </a>
        <a className="hero-start-link" href="#project-archive">See the work</a>
      </div>
    </div>
    </div>
  </section>
  <div className="hero-cloud-bridge" aria-hidden="true">
    <div className="hero-cloud-bridge-bank" />
  </div></>;
}
