"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ENGAGEMENTS, PRINCIPLES } from "./data";
import PlanLink from "./plan-link";
import "./closing-why-pricing.css";

gsap.registerPlugin(ScrollTrigger);

/** A composition of four promises, brought together as one working relationship. */
export function WhyMe() {
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = section.current;
    if (!root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      gsap.fromTo(".wp-why-heading-inner", { yPercent: 180 }, {
        yPercent: 0, duration: 1.25, stagger: .12, ease: "power3.out",
        scrollTrigger: { trigger: ".wp-why-heading", start: "top 86%", toggleActions: "play none none reverse" },
      });
      const sheets = gsap.utils.toArray<HTMLElement>(".wp-promise");
      sheets.forEach((sheet, index) => {
        gsap.fromTo(sheet, { y: index % 2 ? 130 : 180, rotate: index % 2 ? 7 : -7 }, {
          y: 0, rotate: 0, ease: "none",
          scrollTrigger: { trigger: ".wp-promises", start: "top 95%", end: "top 30%", scrub: 1.15, invalidateOnRefresh: true },
        });
      });
      if (window.matchMedia("(min-width: 801px)").matches) {
        gsap.fromTo(".wp-artwork", { y: 40, scale: .96 }, {
          y: -45, scale: 1.03, ease: "none",
          scrollTrigger: { trigger: ".wp-why-intro", start: "top bottom", end: "bottom top", scrub: 1.2, invalidateOnRefresh: true },
        });
      }
    }, root);
    return () => context.revert();
  }, []);

  return (
    <section ref={section} id="why" className="wp-why" aria-labelledby="wp-why-title">
      <div className="wp-why-intro">
        <p className="wp-small-label">A more direct way to work</p>
        <h2 id="wp-why-title" className="wp-why-heading" aria-label="One person. The whole journey.">
          <span className="wp-heading-mask" aria-hidden="true"><span className="wp-why-heading-inner">One person.</span></span>
          <span className="wp-heading-mask" aria-hidden="true"><span className="wp-why-heading-inner">The whole <em>journey.</em></span></span>
        </h2>
        <p className="wp-why-subtitle">I’m Mahan, a fullstack developer. I design and build your project with you, from the first conversation to launch.</p>
        {/* Original generated visual; not a photograph of a real object. */}
        <img className="wp-artwork" src="/work/working-together-glass.webp" alt="" width="1100" height="1100" loading="lazy" decoding="async" />
      </div>
      <div className="wp-promises" aria-label="What working together means">
        {PRINCIPLES.map((principle, index) => (
          <article className={`wp-promise wp-promise-${index + 1}`} key={principle.title}>
            <span className="wp-promise-mark" aria-hidden="true">{["Direct contact", "Ownership", "Reliability", "Handover"][index]}</span>
            <h3>{principle.title}</h3>
            <p>{principle.copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/** The selection changes the actual scope and carries it into the brief form. */
export function WorkingTogether() {
  const section = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);
  const active = ENGAGEMENTS[selected];

  useEffect(() => {
    const root = section.current;
    if (!root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      gsap.fromTo(".wp-price-display", { y: 100, rotate: 2.5 }, {
        y: 0, rotate: 0, ease: "none",
        scrollTrigger: { trigger: ".wp-price-stage", start: "top 95%", end: "top 40%", scrub: 1.1, invalidateOnRefresh: true },
      });
      gsap.fromTo(".wp-price-heading-inner", { yPercent: 180 }, {
        yPercent: 0, duration: 1.15, ease: "power3.out",
        scrollTrigger: { trigger: ".wp-price-heading", start: "top 85%", toggleActions: "play none none reverse" },
      });
    }, root);
    return () => context.revert();
  }, []);

  useEffect(() => {
    if (!panel.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = gsap.fromTo(panel.current.children, { y: 14 }, { y: 0, stagger: .035, duration: .65, ease: "power3.out", overwrite: true });
    return () => { animation.kill(); };
  }, [selected]);

  return (
    <section ref={section} className="wp-pricing" id="pricing" aria-labelledby="wp-price-title">
      <div className="wp-price-intro">
        <h2 id="wp-price-title" className="wp-price-heading" aria-label="A way to work that fits.">
          <span className="wp-heading-mask" aria-hidden="true"><span className="wp-price-heading-inner">A way to work</span></span>
          <span className="wp-heading-mask" aria-hidden="true"><span className="wp-price-heading-inner">that <em>fits.</em></span></span>
        </h2>
        <p>Every project begins with a written scope. Choose the starting point that sounds most like yours.</p>
      </div>
      <div className="wp-price-stage">
        <div className="wp-price-options" aria-label="Choose a way to work">
          {ENGAGEMENTS.map((item, index) => (
            <button type="button" key={item.id} className={index === selected ? "is-selected" : ""} aria-pressed={index === selected} onClick={() => setSelected(index)}>
              <span className="wp-option-label">{item.name}</span>
              <span className="wp-option-indicator" aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
        <div className="wp-price-display">
          <div className="wp-price-edge" aria-hidden="true" />
          <div className="wp-price-inner" ref={panel} aria-live="polite">
            <p className="wp-price-overline">A starting point</p>
            <div className="wp-price-title-group"><h3>{active.name}</h3><p>{active.summary}</p></div>
            <ul>{active.includes.map(item => <li key={item}>{item}</li>)}</ul>
            <p className="wp-price-shape">{active.shape}</p>
            <PlanLink plan={active.id}>Discuss this</PlanLink>
          </div>
        </div>
      </div>
      <p className="wp-price-note">Pricing follows scope. <a href="#contact">Tell me what you’re building</a> and I’ll reply with a clear range.</p>
    </section>
  );
}
