import type { CSSProperties, ReactNode } from "react";
import { IconCheck, IconGitBranch, IconX, IconLock, IconServer2, IconDatabase, IconWorld, IconWallet, IconSparkles, IconFileCode } from "@tabler/icons-react";
import { pop } from "@/components/journey/staged-words";

/*
  The figures for the skill chapters: small, accurate pieces of real product interface, three
  panels per chapter. The panels themselves are shared across chapters (skill-chapters.tsx
  morphs their frames); what is here is what each panel holds in each chapter.

  Live state inside a panel is driven by three attributes the runtime writes on the active
  chapter's content (a step every STEP_S seconds):
    data-step  0..cycle-1      nodes with data-at="n" get data-on once the step reaches n
    data-hot   step % mod      used for "the one that is active now" (a row, a tab, an instance)
    data-odd   alternate runs  lets a chapter show a second outcome (a refused request)
  Wires join elements marked data-a, from the first id to the second.
*/

export type Rect = [x: number, y: number, w: number, h: number];
export type Figure = { rects: [Rect, Rect, Rect]; wires: [string, string][]; cycle: number; mod: number; panels: [ReactNode, ReactNode, ReactNode] };
export const STEP_S = 0.62;

const Ok = () => <span className="sf-ok" aria-hidden="true"><IconCheck size={12} stroke={2.6} /></span>;
const No = () => <span className="sf-no" aria-hidden="true"><IconX size={12} stroke={2.6} /></span>;
const Head = ({ icon, title, meta }: { icon?: ReactNode; title: string; meta?: ReactNode }) => (
  <div className="sf-head">{icon}<b>{title}</b>{meta && <span className="sf-meta">{meta}</span>}</div>
);
const Bar = ({ w, tone = "" }: { w: string; tone?: string }) => <i className={`sf-bar ${tone}`} style={{ width: w }} />;

/** Wraps one panel's content for chapter k: it rises into the panel and leaves upward. */
const In = ({ k, delay = 0, children, cls = "" }: { k: number; delay?: number; children: ReactNode; cls?: string }) => (
  <div className={`sf-in ${cls}`} {...pop(k, delay, k)}>{children}</div>
);

export const FIGURES: Figure[] = [
  /* 0 — Overview: the five layers, and where the work was done */
  {
    rects: [[0.02, 0.12, 0.56, 0.68], [0.54, 0.62, 0.44, 0.34], [0.64, 0.0, 0.36, 0.26]],
    wires: [], cycle: 10, mod: 5,
    panels: [
      <In k={0} key="a" cls="sf-stack">
        <Head title="Every layer" meta="one person" />
        {[["Design", "Figma · prototypes", "#ff6a4d"], ["Frontend", "React · Next.js", "#4a63ff"], ["Backend", "Node.js · REST", "#8b6dff"], ["Data", "PostgreSQL · caching", "#14b39a"], ["Delivery", "CI/CD · Docker", "#f0a500"]].map(([n, d, c], i) => (
          <div className="sf-layer" key={n} data-row={i} style={{ "--t": c } as CSSProperties}><i /><b>{n}</b><span>{d}</span></div>
        ))}
      </In>,
      <In k={0} key="b" delay={120}>
        <Head title="Experience" />
        <div className="sf-rows">
          <div className="sf-row"><b>AAQ Gold Reserve</b><span>2026</span></div>
          <div className="sf-row"><b>Poply · UAE</b><span>2024 – 2026</span></div>
          <div className="sf-row"><b>Vandaw · tgju.org</b><span>2023 – 2024</span></div>
        </div>
      </In>,
      <In k={0} key="c" delay={220}>
        <Head title="Works in" />
        <div className="sf-chips"><span>React</span><span>Next.js</span><span>TypeScript</span><span>Node.js</span></div>
      </In>,
    ],
  },

  /* 1 — Frontend: one page, rendered three ways, reflowing to a phone */
  {
    rects: [[0, 0.06, 0.7, 0.56], [0.74, 0.12, 0.26, 0.64], [0.06, 0.68, 0.6, 0.28]],
    wires: [["1-page", "1-phone"]], cycle: 6, mod: 3,
    panels: [
      <In k={1} key="a" cls="sf-browser">
        <div className="sf-chrome"><i /><i /><i /><span className="sf-url">yourproduct.com</span>
          <span className="sf-seg" aria-hidden="true"><em className="sf-seg-cap" /><span>SSR</span><span>ISR</span><span>CSR</span></span>
        </div>
        <div className="sf-page" data-a="1-page">
          <div className="sf-nav"><i className="sf-logo" /><Bar w="12%" /><Bar w="10%" /><Bar w="11%" /></div>
          <div className="sf-hero">
            <div><b className="sf-h1">Your product, live.</b><Bar w="80%" tone="soft" /><Bar w="58%" tone="soft" /><span className="sf-btn">Get started</span></div>
            <i className="sf-art" />
          </div>
          <div className="sf-cards"><i /><i /><i /></div>
        </div>
      </In>,
      <In k={1} key="b" delay={140} cls="sf-phone">
        <i className="sf-notch" data-a="1-phone" />
        <b className="sf-h1">Your product, live.</b><Bar w="86%" tone="soft" /><Bar w="62%" tone="soft" />
        <span className="sf-btn sf-btn-wide">Get started</span>
        <i className="sf-art" /><div className="sf-cards sf-cards-col"><i /><i /></div>
      </In>,
      <In k={1} key="c" delay={240} cls="sf-code">
        <Head icon={<IconFileCode size={14} stroke={1.8} />} title="app/page.tsx" meta="Server Component" />
        <pre><code>
          <span><em>1</em><span className="ck">export default async function</span> <span className="cf">Page</span>() {"{"}</span>
          <span><em>2</em>  <span className="ck">const</span> items = <span className="ck">await</span> <span className="cf">getProducts</span>()</span>
          <span><em>3</em>  <span className="ck">return</span> {"<"}<span className="ct">ProductGrid</span> items={"{"}items{"}"} {"/>"}</span>
          <span><em>4</em>{"}"}</span>
        </code></pre>
      </In>,
    ],
  },

  /* 2 — Backend: a request meets auth, validation and a rate limit; one in two is refused */
  {
    rects: [[0, 0.06, 0.46, 0.34], [0, 0.7, 0.46, 0.22], [0.56, 0.3, 0.44, 0.34]],
    wires: [["2-req", "2-checks"], ["2-checks", "2-res"]], cycle: 7, mod: 1,
    panels: [
      <In k={2} key="a" cls="sf-http">
        <div className="sf-head" data-a="2-req"><span className="sf-verb">POST</span><b className="sf-mono">/api/orders</b></div>
        <pre><code>
          <span><span className="cx">Authorization:</span> Bearer ••••••</span>
          <span>{"{"}</span>
          <span>  <span className="cs">&quot;item&quot;</span>: <span className="cv">&quot;gold-10g&quot;</span>,</span>
          <span data-good>  <span className="cs">&quot;plan&quot;</span>: <span className="cv">&quot;installments&quot;</span></span>
          <span data-bad>  <span className="cs">&quot;plan&quot;</span>: <span className="cv">null</span></span>
          <span>{"}"}</span>
        </code></pre>
      </In>,
      <In k={2} key="b" delay={140} cls="sf-http">
        <div className="sf-head" data-a="2-res">
          <span className="sf-status" data-at="4" data-good>201 Created</span>
          <span className="sf-status sf-status-bad" data-at="4" data-bad>422 Unprocessable</span>
          <span className="sf-meta sf-mono">response</span>
        </div>
        <pre className="sf-res" data-at="4"><code>
          <span data-good>{"{ "}<span className="cs">&quot;id&quot;</span>: <span className="cv">&quot;ord_8f2c&quot;</span>, <span className="cs">&quot;status&quot;</span>: <span className="cv">&quot;pending&quot;</span>{" }"}</span>
          <span data-bad>{"{ "}<span className="cs">&quot;error&quot;</span>: <span className="cv">&quot;plan is required&quot;</span>{" }"}</span>
        </code></pre>
      </In>,
      <In k={2} key="c" delay={240}>
        <Head icon={<IconLock size={14} stroke={1.8} />} title="Before the handler" />
        <div className="sf-checks" data-a="2-checks">
          <div className="sf-check" data-at="1"><i className="sf-dot" /><Ok /><span>Signed in</span><em>auth</em></div>
          <div className="sf-check" data-at="2" data-fails><i className="sf-dot" /><Ok /><No /><span>Body matches schema</span><em>validation</em></div>
          <div className="sf-check" data-at="3"><i className="sf-dot" /><Ok /><span>Within rate limit</span><em>limits</em></div>
        </div>
      </In>,
    ],
  },

  /* 3 — Scale: an edge cache, a load balancer over stateless instances, an indexed database */
  {
    rects: [[0.18, 0.42, 0.64, 0.25], [0, 0.04, 0.5, 0.3], [0.46, 0.76, 0.54, 0.24]],
    wires: [["3-edge", "3-lb"], ["3-lb", "3-db"]], cycle: 8, mod: 4,
    panels: [
      <In k={3} key="a" cls="sf-lb">
        <div className="sf-head" data-a="3-lb"><IconServer2 size={14} stroke={1.8} /><b>Load balancer</b><span className="sf-meta">stateless · round robin</span></div>
        <div className="sf-pods">
          {["api-1", "api-2", "api-3", "api-4"].map((n, i) => (
            <div className="sf-pod" key={n} data-i={i} {...(i === 3 ? { "data-at": "4" } : {})}><i /><b className="sf-mono">{n}</b><span className="sf-load"><em /></span></div>
          ))}
        </div>
      </In>,
      <In k={3} key="b" delay={140}>
        <div className="sf-head" data-a="3-edge"><IconWorld size={14} stroke={1.8} /><b>Edge cache</b><span className="sf-meta">CDN</span></div>
        <div className="sf-rows">
          <div className="sf-row"><b className="sf-mono">/</b><span className="sf-tag sf-hit">HIT</span></div>
          <div className="sf-row"><b className="sf-mono">/products</b><span className="sf-tag sf-hit">HIT</span></div>
          <div className="sf-row"><b className="sf-mono">/api/prices</b><span className="sf-tag" data-at="2">MISS → origin</span></div>
        </div>
      </In>,
      <In k={3} key="c" delay={240}>
        <div className="sf-head" data-a="3-db"><IconDatabase size={14} stroke={1.8} /><b>PostgreSQL</b><span className="sf-meta sf-mono">orders</span></div>
        <p className="sf-sql sf-mono"><span className="ck">SELECT</span> * <span className="ck">FROM</span> orders <span className="ck">WHERE</span> user_id = $1</p>
        <div className="sf-chips"><span className="sf-tag sf-hit">Index scan</span><span className="sf-tag sf-mono">idx_orders_user_id</span></div>
      </In>,
    ],
  },

  /* 4 — Web3: confirm in the wallet, follow the transaction, read the events */
  {
    rects: [[0.02, 0.06, 0.5, 0.52], [0.6, 0.02, 0.38, 0.5], [0.3, 0.68, 0.68, 0.28]],
    wires: [["4-tx", "4-nft"], ["4-tx", "4-log"]], cycle: 7, mod: 1,
    panels: [
      <In k={4} key="a" cls="sf-wallet">
        <div className="sf-head" data-a="4-tx"><IconWallet size={14} stroke={1.8} /><b>Confirm transaction</b></div>
        <div className="sf-rows">
          <div className="sf-row"><span>Contract</span><b className="sf-mono">0x7a3f…c41e</b></div>
          <div className="sf-row"><span>Function</span><b className="sf-mono">buy(tokenId)</b></div>
          <div className="sf-row"><span>Network fee</span><b>Estimated</b></div>
        </div>
        <div className="sf-stepper">
          <span data-at="0"><i />Signed</span><span data-at="1"><i />Pending</span><span data-at="3"><i />Confirmed</span>
        </div>
        <span className="sf-btn sf-btn-wide" data-at="0">Confirm</span>
      </In>,
      <In k={4} key="b" delay={140} cls="sf-nft">
        <div className="sf-artwork" data-a="4-nft" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="sf-row"><b>Token #2048</b><span className="sf-tag" data-at="3">Owned</span></div>
      </In>,
      <In k={4} key="c" delay={240}>
        <div className="sf-head" data-a="4-log"><b>Events</b><span className="sf-meta">from the contract</span></div>
        <div className="sf-log sf-mono">
          <span data-at="1"><span className="ck">Approval</span>(owner, operator)</span>
          <span data-at="2"><span className="ck">Transfer</span>(from, to, 2048)</span>
          <span data-at="3"><span className="ck">Sale</span>(2048)</span>
        </div>
      </In>,
    ],
  },

  /* 5 — Quality: a release runs the pipeline, then is watched, with a rollback ready */
  {
    rects: [[0, 0.08, 0.56, 0.58], [0.62, 0.04, 0.38, 0.38], [0.62, 0.54, 0.38, 0.3]],
    wires: [["5-deploy", "5-health"]], cycle: 9, mod: 1,
    panels: [
      <In k={5} key="a" cls="sf-ci">
        <div className="sf-head"><IconGitBranch size={14} stroke={1.8} /><b className="sf-mono">main</b><span className="sf-meta">Deploy</span></div>
        <div className="sf-steps">
          {["Install", "Lint & types", "Unit tests", "Integration tests", "Build Docker image", "Deploy"].map((s, i) => (
            <div className="sf-step" key={s} data-at={String(i + 1)} data-run={i} {...(i === 5 ? { "data-a": "5-deploy" } : {})}><i className="sf-spin" /><Ok /><span>{s}</span></div>
          ))}
        </div>
        <span className="sf-progress"><em /></span>
      </In>,
      <In k={5} key="b" delay={140}>
        <div className="sf-head" data-a="5-health"><i className="sf-live" /><b>Production</b><span className="sf-meta">healthy</span></div>
        <div className="sf-rows">
          <div className="sf-row"><b className="sf-mono">GET /health</b><span className="sf-tag sf-hit">200</span></div>
          <div className="sf-row"><b className="sf-mono">GET /ready</b><span className="sf-tag sf-hit">200</span></div>
          <div className="sf-row"><b>Error tracking</b><span>No new issues</span></div>
        </div>
      </In>,
      <In k={5} key="c" delay={240}>
        <Head title="Releases" />
        <div className="sf-rows">
          <div className="sf-row"><b>Current</b><span className="sf-tag sf-hit" data-at="7">Live</span></div>
          <div className="sf-row"><b>Previous</b><span className="sf-btn sf-btn-ghost">Roll back</span></div>
        </div>
      </In>,
    ],
  },

  /* 6 — AI: an agent does the routine through tools; a person reviews and decides */
  {
    rects: [[0, 0.04, 0.52, 0.64], [0.58, 0, 0.42, 0.42], [0.58, 0.6, 0.42, 0.26]],
    wires: [["6-agent", "6-diff"], ["6-diff", "6-review"]], cycle: 9, mod: 1,
    panels: [
      <In k={6} key="a" cls="sf-agent">
        <div className="sf-head" data-a="6-agent"><IconSparkles size={14} stroke={1.8} /><b>Agent</b><span className="sf-meta">tools over MCP</span></div>
        <p className="sf-ask">Add tests for the checkout flow.</p>
        <div className="sf-tools sf-mono">
          <span data-at="1"><span className="ck">read_file</span> checkout.ts</span>
          <span data-at="2"><span className="ck">write_file</span> checkout.test.ts</span>
          <span data-at="3"><span className="ck">run_tests</span> <em className="sf-pass">passed</em></span>
          <span data-at="4"><span className="ck">open_pr</span> Add checkout tests</span>
        </div>
      </In>,
      <In k={6} key="b" delay={140} cls="sf-diff">
        <div className="sf-head" data-a="6-diff"><b className="sf-mono">checkout.test.ts</b><span className="sf-meta">new file</span></div>
        <pre className="sf-mono"><code>
          <span data-at="2" className="sf-add">+ it(&quot;charges the saved card&quot;, …)</span>
          <span data-at="2" className="sf-add">+ it(&quot;rejects an expired card&quot;, …)</span>
          <span data-at="3" className="sf-add">+ it(&quot;keeps the cart on failure&quot;, …)</span>
        </code></pre>
      </In>,
      <In k={6} key="c" delay={240}>
        <div className="sf-head" data-a="6-review"><b>Review</b></div>
        <div className="sf-review">
          <span className="sf-tag" data-at="5">Requested</span>
          <span className="sf-approve" data-at="6"><Ok />Approved by Mahan</span>
        </div>
      </In>,
    ],
  },
];
