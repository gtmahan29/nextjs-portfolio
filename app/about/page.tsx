import type { Metadata } from "next";
import localFont from "next/font/local";
import { Outfit } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { WordmarkDefs } from "@/components/journey/sections";
import { CONTACT_EMAIL } from "@/components/journey/data";
import { CASE_PROJECTS } from "@/components/journey/project-case-data";
import { Rise, Words, pop } from "@/components/journey/staged-words";
import AboutMotion from "./about-motion";
import StackWorld from "./stack-world";
import SkillChapters from "./skill-chapters";
import { EDUCATION, PATH, PRINCIPLES } from "./content";
import "./about.css";

/*
  About — "One person, every layer."
  The hero is the stack as a small town (stack-world.tsx): five stations, Design, Frontend,
  Backend, Data and Delivery, with a request riding a rail through each and one person walking
  it there. Everything clickable opens a note. Below it, the CV's skills run as seven pinned
  chapters whose shapes morph from one figure into the next (skill-chapters.tsx). Then why
  one person, the path (from the CV), the work and the invitation.

MOTION SCORE — sections that stage on entering (about-motion.tsx; the hero has its own scores)
| Section    | Element                 | Pattern | Goal                               | Delay (s)            | Sound            |
|------------|-------------------------|---------|------------------------------------|----------------------|------------------|
| Statement  | statement words         | P1      | rise                               | .08 + .04/word       | –                |
| Statement  | terms                   | P2      | rise, in order                     | .9 + .09 each        | –                |
| Path       | heading                 | P1      | rise                               | .06 + .055/word      | –                |
| Path       | the line                | P4      | draws from the left                | .2                   | –                |
| Path       | stops                   | P3      | pop, in order                      | .35 + .12 each       | –                |
| Path       | education lines         | P2      | rise                               | .9 + .09 each        | –                |
| Work       | images                  | P4      | wipe up out of a mask, settle      | .1 + .12             | –                |
| Contact    | heading, email          | P1, P3  | rise, pop                          | .06, .42             | ui_pop on arrival|
Every section stages once it is well inside the viewport and resets only when fully below it.
Reduced motion: everything shows its resting pose. Phone: one column, the same order.
*/

const display = localFont({ src: "../../public/fonts/Yorkmade.woff2", weight: "700", variable: "--about-display" });
const outfit = Outfit({ subsets: ["latin"], display: "swap", variable: "--about-text" });

export const metadata: Metadata = {
  title: "About Mahan Adeli — Fullstack Developer & Designer",
  description: "Mahan Adeli designs and builds websites, apps and internal tools: product design, React and Next.js frontends, Node.js and PostgreSQL backends, through to launch and handover.",
};

const Arrow = ({ d = "M5 11L11 5M6.5 5H11v4.5" }: { d?: string }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true"><path d={d} /></svg>
);

export default function AboutPage() {
  const work = CASE_PROJECTS.filter(p => p.id === "aaq" || p.id === "rasa");
  return (
    <AboutMotion className={`${display.variable} ${outfit.variable}`}>
      <WordmarkDefs />
      <noscript><style>{".about-page .jm-in,.about-page .ab-pop,.about-page .ab-draw{transform:none!important}.about-page .ab-reveal{clip-path:none!important}.sw-layer,.sw-dock,.sw-hint,.sw-stage{display:none!important}"}</style></noscript>

      <header className="ab-nav-wrap">
        <nav className="ab-nav" aria-label="About page">
          <Link href="/" className="ab-brand" aria-label="Codaine home"><svg viewBox="0 0 2316 396" aria-hidden="true"><use href="#jny-wm" /></svg></Link>
          <div className="ab-links">
            <a href="#skills">Skills</a>
            <a href="#manifesto">Approach</a>
            <a href="#path">Path</a>
            <a href="#work">Work</a>
            <Link href="/#journey">Process</Link>
          </div>
          <a className="ab-btn ab-btn-dark ab-btn-sm" href="#contact">Start a project<span className="ab-btn-ic"><Arrow /></span></a>
        </nav>
      </header>

      <main>
        {/* ---------------- Hero: the stack world ---------------- */}
        <StackWorld />

        {/* ---------------- What I work with: the CV's skills, one pinned chapter each ---------------- */}
        <SkillChapters />

        {/* ---------------- Statement ---------------- */}
        <section className="ab-manifesto" id="manifesto" data-stage aria-labelledby="ab-manifesto-h">
          <div className="ab-wrap">
            <h2 id="ab-manifesto-h" className="ab-statement" aria-label="Most products pass through a chain of people. Yours can be built by one, who designs the screen, writes the code behind it and stays to keep it running.">
              <span aria-hidden="true">
                <Words text="Most products pass through a chain of people." beat={0} start={80} step={40} />{" "}
                <span className="ab-dim"><Words text="Yours can be built by one, who designs the screen, writes the code behind it and stays to keep it running." beat={0} start={480} step={35} /></span>
              </span>
            </h2>
            <dl className="ab-terms">
              {PRINCIPLES.map((p, i) => (
                <div key={p.title}>
                  <dt><Rise beat={0} start={900 + i * 90}>{p.title}</Rise></dt>
                  <dd><Rise beat={0} start={960 + i * 90}>{p.copy}</Rise></dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ---------------- Path ---------------- */}
        <section className="ab-path" id="path" data-stage aria-labelledby="ab-path-h">
          <div className="ab-wrap">
            <h2 id="ab-path-h" className="ab-h2" aria-label="From interfaces to the whole product.">
              <span aria-hidden="true"><Words text="From interfaces" beat={0} start={60} step={55} /> <span className="ab-dim"><Words text="to the whole product." beat={0} start={200} step={55} /></span></span>
            </h2>
            <div className="ab-steps-wrap">
            <span className="ab-steps-line ab-draw" aria-hidden="true" {...pop(0, 200)} />
            <ol className="ab-steps">
              {PATH.map((s, i) => (
                <li key={i} className={i === PATH.length - 1 ? "ab-step ab-step-now" : "ab-step"}>
                  <span className="ab-step-dot ab-pop" aria-hidden="true" {...pop(0, 350 + i * 120)} />
                  <p className="ab-step-place"><Rise beat={0} start={400 + i * 120}><b>{s.years}</b>{s.place}</Rise></p>
                  <h3><Rise beat={0} start={440 + i * 120}>{s.role}</Rise></h3>
                  <p className="ab-step-copy"><Rise beat={0} start={500 + i * 120}>{s.copy}</Rise></p>
                </li>
              ))}
            </ol>
            </div>
            <ul className="ab-edu" aria-label="Education">
              {EDUCATION.map((e, i) => <li key={e.degree}><Rise beat={0} start={900 + i * 90}><b>{e.degree}</b>{e.school}</Rise></li>)}
            </ul>
          </div>
        </section>

        {/* ---------------- Work ---------------- */}
        <section className="ab-work" id="work" aria-labelledby="ab-work-h">
          <div className="ab-wrap">
            <div className="ab-work-head" data-stage>
              <h2 id="ab-work-h" className="ab-h2" aria-label="Built end to end."><span aria-hidden="true"><Words text="Built end to end." beat={0} start={60} step={55} /></span></h2>
            </div>
            <div className="ab-cases">
              {work.map((p, i) => (
                <a key={p.id} className="ab-case" href={p.href} target="_blank" rel="noreferrer" data-stage>
                  <div className="ab-shell">
                    <div className="ab-core ab-case-media ab-reveal" {...pop(0, 100 + i * 120)} style={{ background: p.color }}>
                      <Image src={p.src} alt={p.alt} fill sizes="(max-width: 900px) 92vw, 46vw" />
                    </div>
                  </div>
                  <div className="ab-case-meta">
                    <div>
                      <p className="ab-case-kind">{p.discipline}</p>
                      <h3>{p.title}</h3>
                      <p>{p.description}</p>
                    </div>
                    <span className="ab-btn-ic ab-case-ic"><Arrow /></span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Contact ---------------- */}
        <section className="ab-contact" id="contact" data-stage aria-labelledby="ab-contact-h">
          <div className="ab-wrap ab-contact-inner">
            <h2 id="ab-contact-h" className="ab-contact-h" aria-label="What are you building?">
              <span aria-hidden="true"><Words text="What are you" beat={0} start={60} step={60} /><br /><span className="ab-dim"><Words text="building?" beat={0} start={240} /></span></span>
            </h2>
            <span className="ab-pop" {...pop(0, 420)}><a className="ab-mail" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}<span className="ab-btn-ic"><Arrow /></span></a></span>
            <span className="ab-pop" {...pop(0, 520)}><Link className="ab-btn ab-btn-glass" href="/#journey">See how a project runs<span className="ab-btn-ic"><Arrow /></span></Link></span>
          </div>
          <footer className="ab-wrap ab-foot">
            <svg viewBox="0 0 2316 396" aria-label="Codaine"><use href="#jny-wm" /></svg>
            <span>© 2026 Codaine. Design and development, from idea to launch.</span>
          </footer>
        </section>
      </main>
    </AboutMotion>
  );
}
