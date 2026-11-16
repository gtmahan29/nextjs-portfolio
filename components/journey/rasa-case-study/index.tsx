"use client";

import {useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject} from "react";
import {motion, useReducedMotion, useScroll} from "framer-motion";
import {gsap} from "gsap";
import {ScrollTrigger} from "gsap/ScrollTrigger";
import Lenis from "lenis";
import {ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight} from "lucide-react";
import {RASA_CHAPTERS} from "./data";
import {RasaCapture} from "./media";
import {RasaFilm} from "./film";
import {ConsultationAnatomy, ProgrammeExplorer, RoadmapExplorer} from "./interactions";
import "./style.css";

gsap.registerPlugin(ScrollTrigger);
type Props = {scroller: RefObject<HTMLDialogElement>; onClose: () => void; onNext: () => void};
function Chapter({id, label, title, children}: {id: string; label: string; title: string; children: ReactNode}) {
  return <section id={`rasa-${id}`} className="rasa-chapter" aria-labelledby={`rasa-title-${id}`}><header className="rasa-chapter-heading"><span>{label}</span><h2 id={`rasa-title-${id}`}>{title.split(" ").map((word, i) => <span className="rasa-word-mask" key={`${word}-${i}`}><span data-rasa-word>{word}</span></span>)}</h2></header>{children}</section>;
}

export default function RasaCaseStudy({scroller, onClose, onNext}: Props) {
  const article = useRef<HTMLElement>(null), lenis = useRef<Lenis | null>(null), pending = useRef<string | null>(null);
  const reduced = useReducedMotion();
  const [active, setActive] = useState("invitation");
  const {scrollYProgress} = useScroll({container: scroller});
  useEffect(() => {article.current?.querySelector<HTMLHeadingElement>("h1")?.focus({preventScroll: true});}, []);
  useEffect(() => {
    const root = scroller.current;if (!root || reduced) return;
    const content = root.querySelector<HTMLElement>(".case-scroll-content") ?? root;
    const smooth = new Lenis({wrapper: root, content, autoRaf: false, duration: 1.12, easing: t => 1 - Math.pow(1 - t, 4), smoothWheel: true, wheelMultiplier: .85, syncTouch: false});
    lenis.current = smooth;const tick = (time: number) => smooth.raf(time * 1000);smooth.on("scroll", ScrollTrigger.update);gsap.ticker.add(tick);
    const interrupt = () => {pending.current = null;};root.addEventListener("wheel", interrupt, {passive: true});root.addEventListener("touchstart", interrupt, {passive: true});root.addEventListener("keydown", interrupt);
    return () => {gsap.ticker.remove(tick);smooth.destroy();lenis.current = null;root.removeEventListener("wheel", interrupt);root.removeEventListener("touchstart", interrupt);root.removeEventListener("keydown", interrupt);};
  }, [scroller, reduced]);
  useLayoutEffect(() => {
    if (reduced || !article.current || !scroller.current) return;
    const root = article.current, surface = scroller.current;
    const context = gsap.context(() => {
      const reveal = (element: Element) => ({trigger: element, scroller: surface, start: "top 91%", toggleActions: "play none none none"});
      gsap.from(root.querySelectorAll(".rasa-cover h1 [data-rasa-word]"), {yPercent: 115, rotate: 1.5, duration: 1.2, stagger: .075, ease: "power4.out", delay: .1});
      gsap.from(root.querySelectorAll(".rasa-cover-bottom > *"), {y: 28, clipPath: "inset(0 0 100% 0)", duration: 1.1, stagger: .1, ease: "power4.out", delay: .4});
      root.querySelectorAll(".rasa-chapter-heading").forEach(heading => gsap.from(heading.querySelectorAll("[data-rasa-word]"), {yPercent: 115, duration: 1.1, stagger: .055, ease: "power4.out", scrollTrigger: reveal(heading)}));
      root.querySelectorAll(".rasa-capture-device").forEach(device => gsap.from(device, {y: 42, rotateX: 6, scale: .94, duration: 1.35, ease: "power4.out", scrollTrigger: reveal(device)}));
      root.querySelectorAll(".rasa-capture-placeholder").forEach(screen => gsap.from(screen.querySelectorAll("h3, p, .rasa-placeholder-file"), {y: 18, clipPath: "inset(0 0 100% 0)", duration: 1, stagger: .08, ease: "power3.out", scrollTrigger: reveal(screen)}));
      root.querySelectorAll(".rasa-craft-grid > div, .rasa-editorial-note, .rasa-chapter-copy").forEach(block => gsap.from(block, {y: 24, clipPath: "inset(0 0 100% 0)", duration: 1.15, ease: "power4.out", scrollTrigger: reveal(block)}));
      root.querySelectorAll(".rasa-type-pair").forEach(type => gsap.from(type.children, {y: 35, rotation: -8, stagger: .12, duration: 1.2, ease: "power4.out", scrollTrigger: reveal(type)}));
      root.querySelectorAll(".rasa-phone-spread > .rasa-capture").forEach(phone => gsap.to(phone, {y: -35, rotation: -1.5, ease: "none", scrollTrigger: {trigger: phone.parentElement, scroller: surface, start: "top 70%", end: "bottom top", scrub: 1.2}}));
      root.querySelectorAll<SVGPathElement>(".rasa-route-draw").forEach(path => gsap.fromTo(path, {strokeDashoffset: 1}, {strokeDashoffset: 0, ease: "none", scrollTrigger: {trigger: path.closest(".rasa-roadmap-explorer"), scroller: surface, start: "top 85%", end: "center 50%", scrub: 1}}));
      gsap.from(root.querySelectorAll(".rasa-closing [data-rasa-word]"), {yPercent: 115, duration: 1.2, stagger: .1, ease: "power4.out", scrollTrigger: reveal(root.querySelector(".rasa-closing")!)});
    }, root);
    let alive = true, raf = 0;const refresh = () => {cancelAnimationFrame(raf);raf = requestAnimationFrame(() => {if (alive) ScrollTrigger.refresh();});};
    document.fonts.ready.then(refresh);const resize = new ResizeObserver(refresh);resize.observe(root);
    return () => {alive = false;cancelAnimationFrame(raf);resize.disconnect();context.revert();};
  }, [scroller, reduced]);
  useEffect(() => {
    const root = scroller.current;if (!root || !article.current) return;
    const observer = new IntersectionObserver(entries => {if (pending.current) return;const entry = entries.filter(item => item.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];if (entry) setActive(entry.target.id.replace("rasa-", ""));}, {root, rootMargin: "-130px 0px -60% 0px"});
    article.current.querySelectorAll(".rasa-chapter").forEach(chapter => observer.observe(chapter));return () => observer.disconnect();
  }, [scroller]);
  function startStory() {
    const root = scroller.current, target = root?.querySelector<HTMLElement>(".rasa-film");if (!root || !target) return;
    const top = root.scrollTop + target.getBoundingClientRect().top - root.getBoundingClientRect().top - 80;
    if (lenis.current) lenis.current.scrollTo(top, {duration: 1.2});else root.scrollTo({top, behavior: "instant"});
  }
  function go(id: string) {
    const root = scroller.current, target = root?.querySelector<HTMLElement>(`#rasa-${id}`);if (!root || !target) return;
    const top = root.scrollTop + target.getBoundingClientRect().top - root.getBoundingClientRect().top - 140;
    setActive(id);pending.current = id;
    if (lenis.current) lenis.current.scrollTo(top, {duration: 1.2, onComplete: () => {pending.current = null;}});else {root.scrollTo({top, behavior: "instant"});pending.current = null;}
  }
  return <article ref={article} className="rasa-case">
    <motion.div className="rasa-reading-progress" style={{scaleX: scrollYProgress}} aria-hidden="true"/>
    <header className="rasa-cover rasa-container"><div className="rasa-cover-meta"><span>Rasa English Academy</span><span>Web experience · Design & development</span></div><h1 id="case-title" tabIndex={-1}><span className="rasa-cover-line">{["Bigger", "worlds."].map(word => <span key={word} className="rasa-word-mask"><span data-rasa-word>{word}</span></span>)}</span><span className="rasa-cover-line">{["Smaller", "first", "steps."].map(word => <span key={word} className="rasa-word-mask"><span data-rasa-word>{word}</span></span>)}</span></h1><div className="rasa-cover-bottom"><p>A Persian-language academy website that turns a sense of possibility into a clear place to begin.</p><div><span className="rasa-brand-fa">Rasa English Academy</span><span>For children, teenagers<br/>and adult learners.</span></div><button onClick={startStory}><span>Explore the story</span><i><ArrowDown size={19} strokeWidth={1.2}/></i></button></div></header>
    <div className="rasa-container"><RasaFilm scroller={scroller}/></div>
    <nav className="rasa-chapter-nav" aria-label="Rasa case study chapters"><div className="rasa-container"><span>Inside the project</span><div>{RASA_CHAPTERS.map(chapter => <button key={chapter.id} aria-current={active === chapter.id ? "location" : undefined} onClick={() => go(chapter.id)}>{chapter.name}</button>)}</div><label className="rasa-mobile-chapters">Chapter<select aria-label="Rasa case study chapter" value={active} onChange={event => go(event.target.value)}>{RASA_CHAPTERS.map(chapter => <option value={chapter.id} key={chapter.id}>{chapter.name}</option>)}</select></label></div></nav>
    <div className="rasa-container rasa-story">
      <Chapter id="invitation" label="An open door" title="Make the first impression feel like an invitation."><div className="rasa-chapter-copy"><p className="rasa-lead">Learning a language starts with curiosity. The website gives that feeling a place: a set of architectural doors, a classroom beyond them, and a story that unfolds as you move.</p><p>The entrance is built in Three.js. Different rooms serve different learning contexts; the camera carries the visitor from arrival, across the threshold, into the teaching space. The academy establishes its character before the programme details arrive.</p></div><RasaCapture id="entrance"/><div className="rasa-editorial-note"><span>The design move</span><p>Let the opening create interest. Then give that interest a useful direction.</p></div></Chapter>
      <Chapter id="pathways" label="A place for every learner" title="One academy. Different starting points."><div className="rasa-chapter-copy"><p className="rasa-lead">A parent choosing a class and an adult returning to English arrive with different questions.</p><p>Five programme stages make the offer easier to scan, from early immersion to adult communication. Age, focus and an understandable next step sit together. The consultation provides a place to discuss the right fit.</p></div><ProgrammeExplorer/><RasaCapture id="programs"/></Chapter>
      <Chapter id="learning" label="The experience of learning" title="Show what learning can feel like."><div className="rasa-chapter-copy"><p className="rasa-lead">The middle of the story moves from individual skills to the activities that connect them.</p><p>A programmed reel brings listening, speaking, reading and writing into view. Paper notes introduce stories, conversation, literacy, projects and placement. Then an alphabet tunnel turns the transition into a spatial moment.</p></div><div className="rasa-media-pair"><RasaCapture id="reel"/><RasaCapture id="workshops"/></div><div className="rasa-tunnel-spread"><div><span className="rasa-eyebrow">A change of scale</span><h3>From letters<br/>to possibility.</h3><p>The 3D alphabet tunnel connects the expressive part of the site to the consultation. The motion has a destination.</p><span className="rasa-type-pair" aria-hidden="true">Aa</span></div><RasaCapture id="tunnel"/></div></Chapter>
      <Chapter id="conversation" label="The next useful step" title="Start with the person. Then ask for the details."><div className="rasa-chapter-copy"><p className="rasa-lead">The consultation flow asks three short questions: who is learning, what matters to them, and how to reach them.</p><p>The first choice changes the goal options. A parent sees child-focused reasons for learning; an adult sees goals such as everyday conversation, work or study. Name and phone come last, after that context has been established.</p></div><ConsultationAnatomy/><RasaCapture id="consultation"/><div className="rasa-editorial-note"><span>Implementation scope</span><p>The front-end prototype ends with an on-page confirmation. Connecting that request to an admissions service is a separate integration.</p></div></Chapter>
      <Chapter id="world" label="A spatial learning roadmap" title="Give the journey a shape people can follow."><div className="rasa-chapter-copy"><p className="rasa-lead">A learner follows a lit path through five stations: orientation, guided class, home practice, conversation and real-world use.</p><p>The roadmap exists as both a home-page section and a standalone page. A moving character, campus buildings and an illuminated route turn the learning process into a connected scene. Each station connects a place in the world to a specific learning activity.</p></div><RoadmapExplorer/><RasaCapture id="roadmap"/><a className="rasa-inline-link" href="https://language-academy-rho.vercel.app/roadmap" target="_blank" rel="noopener noreferrer">Explore the roadmap<ArrowUpRight size={15} strokeWidth={1.2}/></a></Chapter>
      <Chapter id="craft" label="The system underneath" title="Expressive in motion. Considered in the details."><div className="rasa-craft-grid"><div><span>Persian, from the start</span><h3>Reading direction shapes the experience.</h3><p>The source sets Persian language and right-to-left direction at the document root. Its type system is designed for Persian reading, with English programme names integrated into that system.</p><span className="rasa-type-sample">Right to left<br/>by design</span></div><div><span>A connected scroll story</span><h3>One budget for the whole journey.</h3><p>Shared scene settings define entry, narrative and exit beats. GSAP, Motion and Three.js coordinate the story, while deferred 3D sections and capped render resolution control the work.</p><div className="rasa-tech-list">{["Next.js", "React", "Three.js", "GSAP", "Motion", "Lenis"].map(item => <span key={item}>{item}</span>)}</div></div></div><div className="rasa-phone-spread"><div><span className="rasa-eyebrow">A smaller screen</span><h3>The same invitation.<br/>A closer view.</h3><p>Phone layouts preserve the story's priorities: understand the academy, explore a suitable pathway, and reach the consultation. The source uses separate mobile scroll budgets and rendering limits.</p></div><RasaCapture id="mobile" phone/></div></Chapter>
      <section className="rasa-closing"><p><span className="rasa-word-mask"><span data-rasa-word>A new language.</span></span><br/><span className="rasa-word-mask"><span data-rasa-word>A wider world.</span></span></p><a href="https://language-academy-rho.vercel.app/" target="_blank" rel="noopener noreferrer">Experience Rasa<i><ArrowUpRight size={20} strokeWidth={1.2}/></i></a></section>
      <footer className="rasa-footer"><button onClick={onClose}><ArrowLeft size={14}/>All projects</button><span>Design & development, by Mahan.</span><button onClick={onNext}>Next project<ArrowRight size={14}/></button></footer>
    </div>
  </article>;
}
