import type { CSSProperties } from "react";
import { Outfit } from "next/font/google";
import { ASSURANCES, CONTACT_EMAIL, ENGAGEMENTS, FAQ, PRINCIPLES, TESTIMONIALS } from "./data";
import ContactForm from "./contact-form";
import PlanLink from "./plan-link";
import SoundToggle from "./sound-toggle";

const closingFont = Outfit({ subsets: ["latin"], display: "swap" });
const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

function ClosingTitle({ lead, accent }: { lead: string; accent: string }) {
  return (
    <h2 className="jny-h2 jny-rv" aria-label={`${lead} ${accent}`}>
      <span className="jny-title-mask" aria-hidden="true"><span>{lead}</span></span>{" "}
      <span className="jny-title-mask jny-title-accent" aria-hidden="true"><span>{accent}</span></span>
    </h2>
  );
}

type Pt = [number, number];
type Prism = {
  depth: number;
  sides: { d: number; pts: Pt[] }[];
  top: Pt[];
};

const iso = (x: number, y: number, z: number): Pt => [(x - y) * 0.866, (x + y) * 0.5 - z];

function prism(poly: Pt[], z0: number, h: number): Prism {
  let ar = 0;
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length];
    ar += p[0] * q[1] - q[0] * p[1];
  });
  const sides: { d: number; pts: Pt[] }[] = [];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length];
    let nx = q[1] - p[1];
    let ny = -(q[0] - p[0]);
    if (ar < 0) {
      nx = -nx;
      ny = -ny;
    }
    if (nx + ny > 1e-6) {
      sides.push({
        d: (p[0] + q[0] + p[1] + q[1]) / 2,
        pts: [iso(p[0], p[1], z0), iso(q[0], q[1], z0), iso(q[0], q[1], z0 + h), iso(p[0], p[1], z0 + h)],
      });
    }
  });
  sides.sort((a, b) => a.d - b.d);
  return {
    depth: poly.reduce((s, p) => s + p[0] + p[1], 0) / poly.length + z0 * 0.01,
    sides,
    top: poly.map((p) => iso(p[0], p[1], z0 + h)),
  };
}

function isoIcon(prisms: Prism[], extra?: { svg: string; pts: Pt[] }): { viewBox: string; html: string } {
  let out = "";
  const all: Pt[] = [];
  const P = (pts: Pt[]) => {
    all.push(...pts);
    return pts.map((p) => p.map((v) => v.toFixed(2)).join(",")).join(" ");
  };
  [...prisms]
    .sort((a, b) => a.depth - b.depth)
    .forEach((pr) => {
      pr.sides.forEach((s) => {
        out += `<polygon points="${P(s.pts)}" fill="#0b1020" stroke="#fff" stroke-width=".4" stroke-linejoin="round"/>`;
      });
      out += `<polygon points="${P(pr.top)}" fill="#fff" stroke="#0b1020" stroke-width=".55" stroke-linejoin="round"/>`;
    });
  if (extra) {
    out += extra.svg;
    all.push(...extra.pts);
  }
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const mnx = Math.min(...xs);
  const mxx = Math.max(...xs);
  const mny = Math.min(...ys);
  const mxy = Math.max(...ys);
  const s = Math.max(mxx - mnx, mxy - mny);
  const pad = s * 0.08;
  const viewBox = `${(mnx + mxx) / 2 - s / 2 - pad} ${(mny + mxy) / 2 - s / 2 - pad} ${s + 2 * pad} ${s + 2 * pad}`;
  return { viewBox, html: out };
}

function iconLoop() {
  return isoIcon([
    prism([[0, 8], [8, 8], [8, 3], [6.4, 3], [9, 0.3], [11.6, 3], [10, 3], [10, 10], [0, 10]], 0, 1.6),
    prism([[10, 2], [2, 2], [2, 7], [3.6, 7], [1, 9.7], [-1.6, 7], [0, 7], [0, 0], [10, 0]], 1.4, 1.6),
  ]);
}

function iconGlobe() {
  const plates = [0, 1.05, 2.1].map((z) => prism([[0, 0], [8, 0], [8, 8], [0, 8]], z, 0.55));
  const c = iso(4, 4, 2.65 + 3.7);
  const base = iso(4, 4, 2.65);
  const r = 3.7 * 1.05;
  const svg =
    `<ellipse cx="${c[0].toFixed(2)}" cy="${(base[1] - 0.3).toFixed(2)}" rx="${(r * 0.62).toFixed(2)}" ry="${(r * 0.3).toFixed(2)}" fill="#0b1020"/>` +
    `<circle cx="${c[0].toFixed(2)}" cy="${c[1].toFixed(2)}" r="${r.toFixed(2)}" fill="#fff" stroke="#0b1020" stroke-width=".6"/>` +
    [0.32, 0.7]
      .map(
        (k) =>
          `<ellipse cx="${c[0].toFixed(2)}" cy="${c[1].toFixed(2)}" rx="${(r * k).toFixed(2)}" ry="${r.toFixed(2)}" fill="none" stroke="#0b1020" stroke-width=".45"/>`
      )
      .join("") +
    `<ellipse cx="${c[0].toFixed(2)}" cy="${c[1].toFixed(2)}" rx="${r.toFixed(2)}" ry="${(r * 0.28).toFixed(2)}" fill="none" stroke="#0b1020" stroke-width=".45"/>` +
    [-0.55, 0.55]
      .map(
        (k) =>
          `<ellipse cx="${c[0].toFixed(2)}" cy="${(c[1] + k * r).toFixed(2)}" rx="${(r * 0.83).toFixed(2)}" ry="${(r * 0.2).toFixed(2)}" fill="none" stroke="#0b1020" stroke-width=".4"/>`
      )
      .join("") +
    `<line x1="${c[0].toFixed(2)}" y1="${(c[1] - r).toFixed(2)}" x2="${c[0].toFixed(2)}" y2="${(c[1] + r).toFixed(2)}" stroke="#0b1020" stroke-width=".45"/>`;
  return isoIcon(plates, { svg, pts: [[c[0] - r, c[1] - r], [c[0] + r, c[1] + r]] });
}

function iconPeople() {
  const fig = (x: number, y: number, s: number) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-15 34 V22 Q-15 8 0 8 Q15 8 15 22 V34 Z" fill="#0b1020" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/><circle cx="0" cy="-6" r="10" fill="#0b1020" stroke="#fff" stroke-width="2.2"/><path d="M-6 -12 q6 -5 12 0" stroke="#fff" stroke-width="1.6" fill="none"/></g>`;
  return { viewBox: "0 0 100 100", html: fig(30, 36, 1.15) + fig(66, 30, 1.05) + fig(52, 56, 1.05) };
}

function iconDocs() {
  const pr = [0, 2.6, 5.2, 7.8].map((x, i) =>
    prism(
      [
        [x, i * 0.8],
        [x + 1.1, i * 0.8],
        [x + 1.1, 6.5 + i * 0.8],
        [x, 6.5 + i * 0.8],
      ],
      0,
      7 - i * 0.3
    )
  );
  let lines = "";
  for (let k = 0; k < 5; k++) {
    const a = iso(8.9, 3.4, 5.2 - k * 0.9);
    const b = iso(8.9, 8.4, 5.2 - k * 0.9);
    lines += `<line x1="${a[0].toFixed(2)}" y1="${a[1].toFixed(2)}" x2="${b[0].toFixed(2)}" y2="${b[1].toFixed(2)}" stroke="#fff" stroke-width=".4"/>`;
  }
  const base = isoIcon(pr);
  return { viewBox: base.viewBox, html: base.html + lines };
}

const ICONS = [iconLoop(), iconGlobe(), iconPeople(), iconDocs()];

export function WordmarkDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <clipPath id="jny-wmclip">
          <rect x="0" y="0" width="1000" height="170" />
        </clipPath>
        <symbol id="jny-wm" viewBox="0 0 1000 170">
          <g
            clipPath="url(#jny-wmclip)"
            fill="none"
            stroke="currentColor"
            strokeWidth="40"
            strokeLinejoin="round"
          >
            <path d="M45 170 V22 L120 112 L195 22 V170" />
            <path d="M232 170 L317 22 L402 170 M262 112 H372" />
            <path d="M452 0 V170 M582 0 V170 M452 88 H582" />
            <path d="M622 170 L707 22 L792 170 M652 112 H762" />
            <path d="M842 170 V22 L962 148 V0" />
          </g>
        </symbol>
      </defs>
    </svg>
  );
}

export function JourneyHeader() {
  return (
    <header className="jny-header">
      <nav aria-label="Primary">
        <a href="#journey">Process</a>
        <a href="#project-archive">Work</a>
        <a href="#studio">Services</a>
        <a href="#pricing">Pricing</a>
      </nav>
      <a className="jny-logo" href="#top" aria-label="Mahan Adeli home">
        <svg viewBox="0 0 1000 170">
          <use href="#jny-wm" />
        </svg>
      </a>
      <div className="jny-hcta">
        <SoundToggle />
        <a className="jny-pill jny-ghost" href="#faq">
          Questions
        </a>
        <a className="jny-pill jny-solid" href="#contact">
          Start a project
        </a>
      </div>
    </header>
  );
}

export function WhyMe() {
  return (
    <section className={`jny-closing jny-why ${closingFont.className}`} id="why">
      <div className="jny-wrap jny-why-grid">
        <div className="jny-why-lead">
          <p className="jny-why-label">A little about working together</p>
          <ClosingTitle lead="One conversation." accent="From idea to launch." />
          <p className="jny-lede jny-rv">
            I’m Mahan, a fullstack developer. I design, build and launch websites, apps and internal
            platforms, so nothing gets lost between a designer, a developer and a project manager.
          </p>
        </div>
        <ul className="jny-principles">
          {PRINCIPLES.map((p, i) => (
            <li className="jny-principle jny-rv" style={delay(i * 90)} key={p.title}>
              <span className="jny-principle-index" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3>{p.title}</h3>
                <p>{p.copy}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function KindWords() {
  if (!TESTIMONIALS.length) return null;
  return (
    <section className={`jny-closing jny-words ${closingFont.className}`} id="words" aria-label="Client feedback">
      <div className="jny-wrap">
        <ul>
          {TESTIMONIALS.map((t, i) => (
            <li className="jny-rv" style={delay(i * 100)} key={t.name}>
              <blockquote>“{t.quote}”</blockquote>
              <p>
                {t.name}, {t.role} <span>{t.project}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function WorkingTogether() {
  return (
    <section className={`jny-closing jny-plans-sec ${closingFont.className}`} id="pricing">
      <div className="jny-wrap">
        <header className="jny-sec-head">
          <ClosingTitle lead="The right shape" accent="for your project." />
          <p className="jny-lede jny-rv" style={delay(120)}>
            Every project is scoped in writing before work begins. These are the shapes most work takes.
          </p>
        </header>
        <div className="jny-plans">
          {ENGAGEMENTS.map((e, i) => (
            <article className={`jny-plan jny-rv${e.featured ? " jny-plan-main" : ""}`} style={delay(i * 110)} key={e.id}>
              <div className="jny-plan-core">
                <div className="jny-plan-intro">
                  <h3>{e.name}</h3>
                  <p className="sum">{e.summary}</p>
                </div>
                <ul aria-label={`Included in ${e.name}`}>
                  {e.includes.map((item) => (
                    <li key={item}>
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M3.5 8.5l3 3 6-7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="jny-plan-action">
                  <p className="shape">{e.shape}</p>
                  <PlanLink plan={e.id}>Discuss this</PlanLink>
                </div>
              </div>
            </article>
          ))}
        </div>
        <ul className="jny-assure">
          {ASSURANCES.map((a, i) => (
            <li className="jny-rv" style={delay(i * 80)} key={a}>
              {a}
            </li>
          ))}
        </ul>
        <p className="jny-fine jny-price-note">
          Pricing follows scope. <a href="#contact">Tell me what you’re building</a> and I’ll reply with a clear range.
        </p>
      </div>
    </section>
  );
}

export function Questions() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <section className={`jny-closing jny-faq ${closingFont.className}`} id="faq">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <div className="l">
        <ClosingTitle lead="Questions worth" accent="asking first." />
        <p className="jny-lede jny-rv" style={delay(120)}>
          Can’t find yours? <a href="#contact">Ask me directly.</a>
        </p>
      </div>
      <div className="r">
        {FAQ.map((f, i) => (
          <details className="jny-qa jny-rv" style={delay(i * 50)} key={f.q}>
            <summary>
              <span>{f.q}</span>
              <span className="ic" aria-hidden="true">
                <svg viewBox="0 0 16 16">
                  <path d="M3 8h10M8 3v10" />
                </svg>
              </span>
            </summary>
            <div className="a">
              <p>{f.a}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className={`jny-closing jny-cta ${closingFont.className}`} id="contact">
      <div className="jny-wrap jny-cta-grid">
        <div className="jny-cta-lead">
          <ClosingTitle lead="Tell me what you" accent="want to build." />
          <p className="jny-lede jny-rv" style={delay(120)}>
            A few lines is enough. Your brief opens in your email app, addressed to me and ready to send. Nothing is
            sent until you press send there.
          </p>
          <a className="jny-direct jny-rv" style={delay(200)} href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </div>
        <ContactForm />
      </div>
    </section>
  );
}

export function JourneyFooter() {
  return (
    <footer className={`jny-footer jny-dark ${closingFont.className}`}>
      <div className="jny-wrap">
        <div className="jny-footer-mask">
          <svg className="jny-footer-mark" data-footer-reveal viewBox="0 0 1000 170" aria-hidden="true">
            <use href="#jny-wm" />
          </svg>
        </div>
        <div className="row">
          <nav aria-label="Footer">
            <a href="#journey">Process</a>
            <a href="#project-archive">Work</a>
            <a href="#studio">Services</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">Questions</a>
          </nav>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          <a className="top" href="#top">
            Back to top
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" />
            </svg>
          </a>
        </div>
        <p className="legal">© 2026 Mahan Adeli. Fullstack developer.</p>
      </div>
    </footer>
  );
}
