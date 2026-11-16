"use client";

import {useId, useRef, useState, type RefObject} from "react";
import {LayoutGroup, motion, useReducedMotion} from "framer-motion";
import {ArrowRight, ArrowUpRight, Check} from "lucide-react";
import {AAQ_CAPTURES, PURCHASE_STEPS, type CaptureId} from "./data";
import {CaptureSlot} from "./media";

export function AnnotatedNote({children, variant = "curve", scroller}: {children: string; variant?: "curve" | "underline"; scroller: RefObject<HTMLDialogElement>}) {
  const reduced = useReducedMotion();
  return <div className={`aaq-annotation aaq-annotation-${variant}`} aria-hidden="true"><svg viewBox="0 0 220 75" fill="none"><motion.path d={variant === "curve" ? "M204 58C172 6 78 1 34 30C15 43 16 57 26 62M26 62L14 54M26 62L30 48" : "M9 50C59 60 140 38 210 45M38 59C90 51 147 56 195 51"} stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" initial={reduced ? false : {pathLength: 0}} whileInView={{pathLength: 1}} viewport={{root: scroller, once: true, amount: .6}} transition={{duration: 1.3, ease: [.22, 1, .36, 1]}}/></svg><span>{children}</span></div>;
}

export function ProductMap({scroller}: {scroller: RefObject<HTMLDialogElement>}) {
  const reduced = useReducedMotion();
  return <figure className="aaq-product-map">
    <div className="aaq-map-top"><span>One product, connected</span><span>Public → account → operations</span></div>
    <div className="aaq-map-canvas">
      <svg viewBox="0 0 720 310" fill="none" aria-hidden="true" preserveAspectRatio="none">
        {["M130 155H225", "M335 155H410", "M520 155H600", "M466 155V55H600", "M466 155V255H600"].map((d, i) => <g key={d}><path d={d} className="aaq-map-track"/><motion.path d={d} className="aaq-map-wire" initial={reduced ? false : {pathLength: 0}} whileInView={{pathLength: 1}} viewport={{root: scroller, once: true}} transition={{duration: 1.2, delay: i * .12, ease: [.22, 1, .36, 1]}}/></g>)}
      </svg>
      <div className="aaq-map-node aaq-node-store"><small>Discover</small><strong>Storefront</strong><code>/</code></div>
      <div className="aaq-map-node aaq-node-buy"><small>Purchase</small><strong>Select · Verify · Pay</strong><code>/buy</code></div>
      <div className="aaq-map-node aaq-node-account"><small>Manage</small><strong>Account</strong><code>/dashboard</code></div>
      <div className="aaq-map-node aaq-node-plans"><strong>Plans</strong><small>Payments & schedules</small></div>
      <div className="aaq-map-node aaq-node-records"><strong>Records</strong><small>Invoices & activity</small></div>
      <div className="aaq-map-node aaq-node-ops"><strong>Operations</strong><small>Admin workspaces</small></div>
    </div><figcaption>Different surfaces, one continuous journey.</figcaption>
  </figure>;
}

export function PurchaseJourney() {
  const [step, setStep] = useState(0);
  const reduced = useReducedMotion();
  const detail = PURCHASE_STEPS[step];
  return <div className="aaq-purchase-demo">
    <div className="aaq-step-buttons" role="group" aria-label="Explore purchase steps">{PURCHASE_STEPS.map((item, i) => <button key={item.name} aria-pressed={i === step} onClick={() => setStep(i)}><span className="aaq-step-index">{i < step ? <Check size={12}/> : `0${i+1}`}</span><span>{item.name}</span>{i < 3 && <ArrowRight size={13} className="aaq-step-arrow"/>}</button>)}</div>
    <div className="aaq-step-detail" aria-live="polite"><motion.div key={step} initial={reduced ? false : {y: 12}} animate={{y: 0}} transition={{duration: .55, ease: [.22, 1, .36, 1]}}><span>{detail.path}</span><h3>{detail.name}</h3><p>{detail.detail}</p></motion.div></div>
    <CaptureSlot id="checkout"/>
  </div>;
}

export function ScreenTabs({tabs, label}: {tabs: {id: CaptureId; label: string; description: string}[]; label: string}) {
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const prefix = useId();
  const tab = tabs[index];
  return <div className="aaq-screen-tabs">
    <div className="aaq-tab-bar" role="tablist" aria-label={label}>{tabs.map((item, i) => <button key={item.id} ref={node => {buttons.current[i] = node;}} id={`${prefix}-tab-${item.id}`} role="tab" aria-selected={index === i} tabIndex={index === i ? 0 : -1} aria-controls={`${prefix}-panel`} onClick={() => setIndex(i)} onKeyDown={event => {
      let next = i;
      if (event.key === "ArrowRight") next = (i + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault();setIndex(next);buttons.current[next]?.focus();
    }}>{item.label}{index === i && <motion.span layoutId={`${prefix}-indicator`} className="aaq-tab-indicator" transition={reduced ? {duration: 0} : {type: "spring", stiffness: 250, damping: 30}}/>}</button>)}</div>
    <div role="tabpanel" id={`${prefix}-panel`} aria-labelledby={`${prefix}-tab-${tab.id}`} tabIndex={0}>
      <div className="aaq-tab-context"><p>{tab.description}</p><span><ArrowUpRight size={12}/>{AAQ_CAPTURES[tab.id].route}</span></div>
      <motion.div key={tab.id} initial={reduced ? false : {y: 16, clipPath: "inset(0 0 8% 0 round 10px)"}} animate={{y: 0, clipPath: "inset(0 0 0% 0 round 10px)"}} transition={{duration: reduced ? 0 : .65, ease: [.22, 1, .36, 1]}}><CaptureSlot id={tab.id}/></motion.div>
    </div>
  </div>;
}

const TOKENS = [
  {name: "Canvas", hex: "#E6DFCB", purpose: "The warm foundation for the public and account surfaces."},
  {name: "Ink", hex: "#1A1306", purpose: "Primary text and deep surfaces, with a warm undertone."},
  {name: "Gold", hex: "#DCAE3D", purpose: "Primary actions, emphasis and selected states."},
  {name: "Pearl", hex: "#FFFFFF", purpose: "White surfaces that separate dense interface content."},
];

export function TokenExplorer() {
  const [selected, setSelected] = useState(2);
  const item = TOKENS[selected];
  return <div className="aaq-token-explorer"><div className="aaq-token-swatches" role="group" aria-label="Explore AAQ's colour roles">{TOKENS.map((token, i) => <button key={token.name} style={{backgroundColor: token.hex, color: i === 1 ? "#E6DFCB" : "#1A1306"}} onClick={() => setSelected(i)} aria-pressed={selected === i}><span>{token.name}</span><span>{token.hex}</span>{selected === i && <Check size={15}/>}</button>)}</div><div className="aaq-token-detail" aria-live="polite"><span>Colour with a role</span><p><strong>{item.name}.</strong> {item.purpose}</p></div></div>;
}

const ACCOUNT_PANELS = [
  {id: "summary", title: "Holdings & balance", role: "The account at a glance", description: "The overview starts with total value, gold holdings and cash, followed by deposit, purchase and verification actions."},
  {id: "portfolio", title: "Portfolio", role: "The main workspace", description: "The portfolio panel sits in the wider column, with recent account activity directly below it."},
  {id: "plans", title: "Active plans", role: "Ongoing commitments", description: "The plan summary stays in the supporting column, giving ongoing instalments a visible place beside the portfolio."},
  {id: "activity", title: "Recent activity", role: "A record of what happened", description: "Recent transactions stay close to the holdings they affect, rather than being isolated from the account overview."},
  {id: "withdraw", title: "Withdrawal actions", role: "The next useful action", description: "The withdrawal summary brings the available gold and cash actions into the same account workspace."},
];

/** Source-backed anatomy, deliberately without sample balances or fabricated chart data. */
export function AccountAnatomy({scroller}: {scroller: RefObject<HTMLDialogElement>}) {
  const [selected, setSelected] = useState("portfolio");
  const [compact, setCompact] = useState(false);
  const reduced = useReducedMotion();
  const group = useId();
  const current = ACCOUNT_PANELS.find(panel => panel.id === selected)!;
  return <figure className="aaq-anatomy">
    <div className="aaq-anatomy-toolbar"><span>Account anatomy</span><div role="group" aria-label="Preview account structure"><button aria-pressed={!compact} onClick={() => setCompact(false)}>Desktop</button><button aria-pressed={compact} onClick={() => setCompact(true)}>Compact</button></div></div>
    <LayoutGroup id={group}><motion.div layout className={`aaq-anatomy-canvas ${compact ? "is-compact" : ""}`} transition={{layout: {duration: reduced ? 0 : .75, ease: [.22, 1, .36, 1]}}}>
      <div className="aaq-anatomy-nav" aria-hidden="true"><strong>AAQ Gold</strong><span>Account overview</span></div>
      <div className="aaq-anatomy-grid">{ACCOUNT_PANELS.map((panel, i) => (
        <motion.button layout layoutId={panel.id} key={panel.id}
          className={`aaq-anatomy-panel aaq-anatomy-${panel.id}`}
          onClick={() => setSelected(panel.id)} aria-pressed={selected === panel.id}
          initial={reduced ? false : {y: 16}} whileInView={{y: 0}}
          viewport={{root: scroller, once: true}}
          transition={{
            layout: {duration: reduced ? 0 : .75, ease: [.22, 1, .36, 1]},
            y: {duration: .8, delay: i * .08, ease: [.22, 1, .36, 1]},
          }}>
          <span>{panel.role}</span><strong>{panel.title}</strong>
          <div aria-hidden="true" className="aaq-anatomy-structure"><i/><i/><i/></div>
          {selected === panel.id && <motion.span layoutId="anatomy-selection" className="aaq-anatomy-selection" transition={{duration: reduced ? 0 : .6, ease: [.22, 1, .36, 1]}}/>}
        </motion.button>
      ))}</div>
    </motion.div></LayoutGroup>
    <figcaption aria-live="polite"><strong>{current.title}.</strong> {current.description}<span>Structural diagram · no customer data</span></figcaption>
  </figure>;
}
