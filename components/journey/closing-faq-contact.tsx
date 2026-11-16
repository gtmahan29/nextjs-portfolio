"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ContactForm from "./contact-form";
import { CONTACT_EMAIL, FAQ } from "./data";
import "./closing-faq-contact.css";

gsap.registerPlugin(ScrollTrigger);

/** A physical index: selecting a question turns the page to its answer. */
export function Questions() {
  const [selected, setSelected] = useState(0);
  const section = useRef<HTMLElement>(null);
  const answer = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => {
    const root = section.current;
    if (!root) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const panel = root.querySelector(".questions-book");
      const mark = root.querySelector(".questions-mark");
      gsap.fromTo(panel, { y: 100, rotation: -4, scale: .94 }, {
        y: 0, rotation: 0, scale: 1, ease: "none", immediateRender: false,
        scrollTrigger: { trigger: root, start: "top bottom", end: "top 18%", scrub: 1.2, invalidateOnRefresh: true },
      });
      gsap.fromTo(mark, { y: 45, rotate: -12 }, {
        y: -18, rotate: 6, ease: "none", immediateRender: false,
        scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: 1.4 },
      });
    }, root);
    return () => mm.revert();
  }, []);

  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!answer.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const element = answer.current;
    gsap.killTweensOf(element);
    gsap.fromTo(element, { y: 15, rotateX: -3 }, {
      y: 0, rotateX: 0, duration: .8, ease: "power3.out", clearProps: "transform",
    });
    return () => { gsap.killTweensOf(element); gsap.set(element, { clearProps: "transform" }); };
  }, [selected]);

  const schema = {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };

  return (
    <section ref={section} className="jny-closing questions-experience" id="faq" aria-labelledby="questions-title">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <div className="questions-wrap">
        <header className="questions-head">
          <h2 id="questions-title">Good questions.<br /><span>Clear answers.</span></h2>
          <p>Everything you might want to know before we start.</p>
        </header>
        <div className="questions-book">
          <div className="questions-index" aria-label="Choose a question">
            <p className="questions-index-title">Explore a question</p>
            {FAQ.map(({ q }, i) => (
              <button key={q} type="button" aria-pressed={selected === i} onClick={() => setSelected(i)}>
                <span>{q}</span><span className="questions-arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
          <div className="questions-page" aria-live="polite" aria-atomic="true">
            <span className="questions-mark" aria-hidden="true">?</span>
            <div ref={answer} className="questions-answer">
              <p className="questions-answer-label">The answer</p>
              <h3>{FAQ[selected].q}</h3>
              <p>{FAQ[selected].a}</p>
              <a href="#contact">Ask something else <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </div>
        <noscript>
          <div className="questions-static">
            {FAQ.map(({ q, a }) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </noscript>
      </div>
    </section>
  );
}

export function FinalCta() {
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = section.current;
    if (!root) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(root.querySelector(".contact-letter"), { y: 120, rotation: 4 }, {
        y: 0, rotation: 0, ease: "none", immediateRender: false,
        scrollTrigger: { trigger: root, start: "top bottom", end: "top 15%", scrub: 1.2, invalidateOnRefresh: true },
      });
      gsap.fromTo(root.querySelector(".contact-giant"), { xPercent: 8 }, {
        xPercent: -5, ease: "none", immediateRender: false,
        scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: 1.4 },
      });
    }, root);
    return () => mm.revert();
  }, []);

  return (
    <section ref={section} className="jny-closing contact-experience" id="contact" aria-labelledby="contact-title">
      <div className="contact-giant" aria-hidden="true">HELLO</div>
      <div className="contact-composition">
        <div className="contact-lead">
          <span className="contact-overline">Your project starts here</span>
          <h2 id="contact-title">Let’s make<br /><span>it happen.</span></h2>
          <p>Tell me what you have in mind. A few lines are enough to start the conversation.</p>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}<span aria-hidden="true"> ↗</span></a>
        </div>
        <div className="contact-letter">
          <div className="contact-letter-top"><span>To: Mahan</span><span>New project ↗</span></div>
          <h3>Tell me about it.</h3>
          <p className="contact-letter-note">Your email app will open with your message ready to send.</p>
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
