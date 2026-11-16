"use client";

import {useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject} from "react";
import {motion, useReducedMotion, useScroll} from "framer-motion";
import {Manrope} from "next/font/google";
import Lenis from "lenis";
import {gsap} from "gsap";
import {ScrollTrigger} from "gsap/ScrollTrigger";
import {ScrollFilm} from "./scroll-film";
import {useCaseChoreography} from "./choreography";
import {ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight} from "lucide-react";
import {AAQ_CHAPTERS, ADMIN_TABS, DASHBOARD_TABS} from "./data";
import {CaptureLink, CaptureSlot, ScrollCapture, TiltCapture} from "./media";
import {AccountAnatomy, AnnotatedNote, ProductMap, PurchaseJourney, ScreenTabs, TokenExplorer} from "./interactions";
import "./style.css";
import "./film.css";

type Props = {scroller: RefObject<HTMLDialogElement>; onClose: () => void; onNext: () => void};
export const aaqTypeface = Manrope({subsets: ["latin"], display: "swap", variable: "--font-aaq-case"});

function Chapter({id, label, title, children}: {id: string; label: string; title: string; children: ReactNode}) {
  return <section id={`aaq-${id}`} className="aaq-chapter" aria-labelledby={`aaq-heading-${id}`}><div className="aaq-chapter-heading"><span>{label}</span><h2 id={`aaq-heading-${id}`}>{title.split(" ").map((word, i) => <span className="aaq-heading-mask" key={`${word}-${i}`}><span data-reveal-word>{word}</span>{" "}</span>)}</h2></div>{children}</section>;
}

export default function AAQCaseStudy({scroller, onClose, onNext}: Props) {
  const [reading, setReading] = useState(false);
  const [active, setActive] = useState("overview");
  const heroWord = useRef<HTMLSpanElement>(null);
  const railWord = useRef<HTMLSpanElement>(null);
  const oldWordBox = useRef<DOMRect | null>(null);
  const article = useRef<HTMLDivElement>(null);
  const smoothScroll = useRef<Lenis | null>(null);
  const navigationTarget = useRef<string | null>(null);
  const reduced = useReducedMotion();
  const {scrollYProgress} = useScroll({container: scroller});

  useCaseChoreography(article, scroller, reading && !reduced);

  useEffect(() => {
    const root = scroller.current;
    if (!reading || reduced || !root) return;
    const content = root.querySelector<HTMLElement>(".case-scroll-content") ?? root;
    const lenis = new Lenis({wrapper: root, content, autoRaf: false, duration: 1.05, easing: t => 1 - Math.pow(1 - t, 4), smoothWheel: true, wheelMultiplier: .85, syncTouch: false});
    smoothScroll.current = lenis;
    const tick = (time: number) => lenis.raf(time * 1000);
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(tick);
    const interrupt = () => {navigationTarget.current = null;};
    root.addEventListener("wheel", interrupt, {passive: true});
    root.addEventListener("touchstart", interrupt, {passive: true});
    root.addEventListener("keydown", interrupt);
    return () => {smoothScroll.current = null;gsap.ticker.remove(tick);lenis.destroy();root.removeEventListener("wheel", interrupt);root.removeEventListener("touchstart", interrupt);root.removeEventListener("keydown", interrupt);};
  }, [reading, reduced, scroller]);

  function enter() {
    if (reading) return;
    oldWordBox.current = heroWord.current?.getBoundingClientRect() ?? null;
    scroller.current?.scrollTo({top: 0, behavior: "instant"});
    setReading(true);
  }

  useLayoutEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const previous = root.style.overflowY;
    root.style.overflowY = reading ? "auto" : "hidden";
    if (reading && railWord.current) {
      const before = oldWordBox.current;
      const node = railWord.current;
      const after = node.getBoundingClientRect();
      if (before && !reduced) {
        const animation = node.animate([
          {transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / after.width})`},
          {transform: "translate(0, 0) scale(1)"},
        ], {duration: 760, easing: "cubic-bezier(.22,1,.36,1)"});
        node.closest<HTMLHeadingElement>("h1")?.focus({preventScroll: true});
        return () => {animation.cancel();root.style.overflowY = previous;};
      }
      node.closest<HTMLHeadingElement>("h1")?.focus({preventScroll: true});
    }
    return () => {root.style.overflowY = previous;};
  }, [reading, reduced, scroller]);

  useEffect(() => {
    const root = scroller.current;
    if (!root || reading) return;
    let distance = 0;
    let touchY = 0;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.deltaY <= 0) return;
      event.preventDefault();distance += event.deltaY;
      if (distance > 55) enter();
    };
    const touchStart = (event: TouchEvent) => {touchY = event.touches[0]?.clientY ?? 0;};
    const touchMove = (event: TouchEvent) => {if (touchY - (event.touches[0]?.clientY ?? touchY) > 35) enter();};
    const key = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest("button,a,input,textarea,select")) return;
      if (["ArrowDown", "PageDown", " "].includes(event.key)) {event.preventDefault();enter();}
    };
    root.addEventListener("wheel", wheel, {passive: false});
    root.addEventListener("touchstart", touchStart, {passive: true});
    root.addEventListener("touchmove", touchMove, {passive: true});
    root.addEventListener("keydown", key);
    return () => {root.removeEventListener("wheel", wheel);root.removeEventListener("touchstart", touchStart);root.removeEventListener("touchmove", touchMove);root.removeEventListener("keydown", key);};
    // The listener exists only for the opening state; normal article scrolling stays native.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading, scroller]);

  useEffect(() => {
    if (!reading || !article.current || !scroller.current) return;
    const observer = new IntersectionObserver(entries => {
      if (navigationTarget.current) return;
      const entry = entries.filter(item => item.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (entry) setActive(entry.target.id.replace("aaq-", ""));
    }, {root: scroller.current, rootMargin: "-100px 0px -60% 0px", threshold: 0});
    article.current.querySelectorAll(".aaq-chapter").forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, [reading, scroller]);

  function go(id: string) {
    const root = scroller.current;
    const target = root?.querySelector<HTMLElement>(`#aaq-${id}`);
    if (!root || !target) return;
    const top = root.scrollTop + target.getBoundingClientRect().top - root.getBoundingClientRect().top - 95;
    navigationTarget.current = id;
    if (smoothScroll.current) smoothScroll.current.scrollTo(top, {duration: 1.15, onComplete: () => {navigationTarget.current = null;setActive(id);}});
    else {root.scrollTo({top, behavior: "instant"});navigationTarget.current = null;}
    setActive(id);
  }

  return <article className={`aaq-case ${aaqTypeface.variable} ${reading ? "is-reading" : "is-opening"}`}>
    {reading && <motion.div className="aaq-reading-progress" style={{scaleX: scrollYProgress}} aria-hidden="true"/>}
    {!reading ? <section className="aaq-opening">
      <div className="aaq-opening-kicker"><span>Design & development</span><span>AAQ Gold Reserve / Case study</span></div>
      <h1 id="case-title" tabIndex={-1}><span className="aaq-hero-line"><span ref={heroWord} className="aaq-hero-word">AAQ Gold</span>{" "}Reserve.</span><span className="aaq-hero-second">Every part, connected.</span></h1>
      <div className="aaq-opening-bottom"><div><p className="aaq-opening-lead">A considered storefront.<br/>A complete product behind it.</p><p className="aaq-opening-summary">From discovering physical gold to managing purchases, plans and account records. One connected platform for customers and the people running it.</p></div><div className="aaq-opening-scope"><span>Storefront</span><span>Customer account</span><span>Operations</span></div></div>
      <button className="aaq-read-button" onClick={enter}><span>Read the case study</span><span><ArrowDown size={20} strokeWidth={1.3}/></span></button>
      <div className="aaq-opening-baseline"><span>Digital commerce · Product experience</span><span>Scroll to enter</span></div>
    </section> : <div className="aaq-reading-layout" ref={article}>
      <aside className="aaq-rail" aria-label="AAQ project details">
        <h1 id="case-title" tabIndex={-1}><span ref={railWord}>AAQ Gold</span><small>Reserve.</small></h1>
        <p className="aaq-rail-role">Design & development</p><p className="aaq-rail-summary">Storefront, customer account<br/>and operational tools.</p>
        <nav className="aaq-chapter-nav" aria-label="Case study chapters">{AAQ_CHAPTERS.map((chapter, i) => <button key={chapter.id} onClick={() => go(chapter.id)} aria-current={active === chapter.id ? "location" : undefined}><span>{String(i + 1).padStart(2, "0")}</span>{chapter.label}</button>)}</nav>
        <div className="aaq-mobile-jump"><label htmlFor="aaq-chapter-select">In this case study</label><select id="aaq-chapter-select" value={active} onChange={event => go(event.target.value)}>{AAQ_CHAPTERS.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.label}</option>)}</select></div>
        <div className="aaq-rail-tech"><span>Built with</span><div>{["Next.js", "React", "TypeScript", "Supabase", "Stripe", "GSAP", "Remotion"].map(tech => <span key={tech}>{tech}</span>)}</div></div>
        <a className="aaq-live-link" href="https://aaq-gold-reserve.vercel.app/" target="_blank" rel="noopener noreferrer">Visit the live project<ArrowUpRight size={15}/></a>
        <button className="aaq-back-cover" onClick={() => {scroller.current?.scrollTo({top: 0, behavior: "instant"});setReading(false);}}>Back to cover <ArrowLeft size={12}/></button>
      </aside>

      <motion.div className="aaq-story" initial={reduced ? false : {y: 24}} animate={{y: 0}} transition={{duration: .85, delay: .1, ease: [.22, 1, .36, 1]}}>
        <Chapter id="overview" label="The product" title="More than a place to buy gold.">
          <p className="aaq-lead">The public website is only the beginning. AAQ connects product discovery, a guided purchase flow, an ongoing customer account and a separate workspace for operations.</p>
          <p>The design problem is continuity: a cinematic first impression needs to lead into a clear transaction, then into tools people can understand and use again. Each surface has its own job. The visual language holds them together.</p>
          <ScrollFilm scroller={scroller}/>
          <ProductMap scroller={scroller}/>
        </Chapter>

        <Chapter id="storefront" label="The first impression" title="Make the material feel present.">
          <p>The opening scene establishes the character of the product. Depth, gold imagery and a warm palette carry the story into the features and product-selection sections, where the emphasis shifts from atmosphere to discovery.</p>
          <div className="aaq-annotated-media"><AnnotatedNote scroller={scroller}>Atmosphere, then clarity.</AnnotatedNote><ScrollCapture scroller={scroller}/></div>
          <div className="aaq-mini-editorial"><strong>A different pace for each moment.</strong><p>The storefront can take its time. Choosing a product and understanding what happens next should feel direct.</p></div>
          <CaptureLink route="/"/>
        </Chapter>

        <Chapter id="purchase" label="The purchase journey" title="Give every step a clear purpose.">
          <p>The purchase flow separates selection, verification and payment review. Verification is conditional in the implementation, rather than an extra step every visitor must always complete.</p>
          <PurchaseJourney/>
          <div className="aaq-subsection"><h3>Let people explore before they commit.</h3><p>The separate calculator responds to gold weight and price inputs. It gives the allocation and payment summary a dedicated place, away from the visual intensity of the storefront.</p><TiltCapture id="calculator"/><CaptureLink route="/calculator"/></div>
        </Chapter>

        <Chapter id="account" label="After checkout" title="Design for the day after the purchase.">
          <p>The account experience moves from a brand story to a working tool. Holdings, plans, reservations and invoices need a consistent hierarchy, clear statuses and useful next steps.</p>
          <AccountAnatomy scroller={scroller}/>
          <ScreenTabs tabs={DASHBOARD_TABS} label="Customer account screens"/>
          <div className="aaq-mobile-spread"><div><span className="aaq-small-label">A smaller canvas</span><h3>The account,<br/>within reach.</h3><p>The mobile capture should show how the same account priorities fit a phone: overview first, then a direct route into plans and records.</p><AnnotatedNote scroller={scroller} variant="underline">Same priorities. Less space.</AnnotatedNote></div><div className="aaq-mobile-slot"><CaptureSlot id="mobile"/></div></div>
        </Chapter>

        <Chapter id="operations" label="Behind the platform" title="The other side of the experience.">
          <p>A product like this also needs tools for the people running it. The admin area covers platform activity, instalments, verification history and withdrawals, with separate workspaces for each task.</p>
          <ScreenTabs tabs={ADMIN_TABS} label="Operations screens"/>
          <div className="aaq-editor-note"><span>A deliberate distinction</span><p>Verification history is an audit view. The current implementation receives KYC decisions from Sumsub; the case study should not present this as a manual approve/reject queue.</p></div>
        </Chapter>

        <Chapter id="language" label="The visual language" title="Warmth for the brand. Structure for the product.">
          <p>The palette uses warm canvas, deep ink, gold and pearl. The source defines three type roles: Manrope for headings, Inter for interface text, and Plus Jakarta Sans for numeric emphasis.</p>
          <TokenExplorer/>
          <div className="aaq-type-contract"><div><span>Headings</span><strong>Manrope</strong><p>Presence without ornament.</p></div><div><span>Interface</span><strong>Inter</strong><p>Clarity in dense views.</p></div><div><span>Numbers</span><strong>Jakarta Sans</strong><p>Emphasis where it matters.</p></div></div>
        </Chapter>

        <Chapter id="decisions" label="Design decisions" title="Keep the experience connected.">
          <div className="aaq-decision-list"><div><span>01</span><div><h3>Separate atmosphere from task work.</h3><p>The public site introduces the product through motion and imagery. The purchase and account views organise the work into specific steps and familiar groups.</p></div></div><div><span>02</span><div><h3>Keep records close to the account.</h3><p>Plans, reservations and invoice detail each have a dedicated route. A purchase leads to a continuing account experience rather than a single confirmation page.</p></div></div><div><span>03</span><div><h3>Give operations its own space.</h3><p>Customer-facing screens and administrative workspaces use the same visual foundation while serving different tasks and levels of detail.</p></div></div></div>
          <div className="aaq-case-closing"><p>From first impression<br/>to <span>everyday use.</span></p><a href="https://aaq-gold-reserve.vercel.app/" target="_blank" rel="noopener noreferrer">Explore AAQ Gold Reserve <ArrowUpRight size={19}/></a></div>
        </Chapter>
        <footer className="aaq-story-footer"><button onClick={onClose}><ArrowLeft size={14}/>All projects</button><button onClick={onNext}>Next project<ArrowRight size={14}/></button></footer>
      </motion.div>
    </div>}
  </article>;
}

