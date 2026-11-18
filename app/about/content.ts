/*
  Everything the About page says, in one place. Facts come from Mahan's CV (roles, years,
  skills, education) and the site's own data (principles, case studies). Nothing is invented:
  no client counts or metrics we cannot stand behind. Notes marked "The field" explain how
  the work is done in general; notes marked "From my work" point at a real project.
*/

export type LayerId = "design" | "frontend" | "backend" | "data" | "delivery";
export type Layer = {
  id: LayerId;
  label: string;
  title: string;
  copy: string;
  tools: string[];
  gives: string[];
};

/** The product, top to bottom: what a visitor sees first sits on top. */
export const LAYERS: Layer[] = [
  {
    id: "design", label: "Design", title: "Give the idea a shape.",
    copy: "I start with the flows a visitor needs, then design the screens and a clickable prototype you can test before any code is written. The design system that comes out of it keeps every later screen consistent.",
    tools: ["Figma", "Product discovery", "UI/UX design", "Prototyping", "Design systems"],
    gives: ["A written scope", "A clickable prototype", "A design system"],
  },
  {
    id: "frontend", label: "Frontend", title: "Make it feel alive.",
    copy: "I build interfaces in React and the Next.js App Router, choosing server or client rendering page by page. A slow request, a failed payment and a scroll that reverses all get the same care as the first impression.",
    tools: ["React", "Next.js", "TypeScript", "TanStack Query", "Redux", "Tailwind CSS", "Three.js", "React Three Fiber"],
    gives: ["Fast, responsive pages", "Every state designed", "Motion with a purpose"],
  },
  {
    id: "backend", label: "Backend", title: "Build what holds it up.",
    copy: "I build stateless APIs in Node.js, Express and Next.js Route Handlers. The interface gets a clear contract for reading and changing data, with sign-in, validation and a plan for every request that fails.",
    tools: ["Node.js", "Express", "REST APIs", "Route Handlers", "Authentication", "Validation", "Viem", "Wagmi", "Ethers.js"],
    gives: ["A clear API contract", "Secure sign-in", "Errors that recover"],
  },
  {
    id: "data", label: "Data", title: "Give it a memory.",
    copy: "I model data in PostgreSQL around how the product actually works, then keep it fast as it grows: indexes, caching in the browser, on the server and at the CDN, and rate limits on the busiest paths.",
    tools: ["PostgreSQL", "Data modelling", "Indexing", "Layered caching", "Rate limiting", "Smart contracts"],
    gives: ["A schema that fits", "Safe migrations", "Queries that stay fast"],
  },
  {
    id: "delivery", label: "Delivery", title: "Get it into the world.",
    copy: "Every change runs through a pipeline: build, test, deploy. After launch I watch health checks and errors, and keep a rollback ready. At handover you get the codebase, the monitoring and the accounts, explained.",
    tools: ["CI/CD", "Docker", "Unit & integration tests", "Error tracking", "Health checks", "Vercel", "Git"],
    gives: ["Tested critical flows", "Monitoring after launch", "A documented handover"],
  },
];

export type NoteKind = "From my work" | "How I work" | "The field";
export type Note = { id: string; layer: LayerId | "you"; action: string; title: string; body: string; kind: NoteKind; link?: { href: string; label: string } };

/**
 * One note per clickable thing in the scene. `action` is the verb on its button; the same
 * notes are listed in full below the hero, so nobody has to find them by clicking around.
 */
export const NOTES: Note[] = [
  // Design
  { id: "easel", layer: "design", action: "Draw a new path", kind: "How I work", title: "Every screen starts as a path",
    body: "Before any code, I map the journey a visitor takes and draw it in Figma. A clickable prototype lets you test the flow while changes are still cheap." },
  { id: "fan", layer: "design", action: "Fan the palette", kind: "The field", title: "One palette, every layer",
    body: "These five colours run through this whole town. A design system does the same for a product: tokens for colour, type and spacing, so a new screen already belongs." },
  { id: "type", layer: "design", action: "Set the type", kind: "The field", title: "Type that holds its order",
    body: "A type scale gives every heading and label its place. Set once, the hierarchy holds on a small phone and a wide monitor alike." },
  { id: "plant", layer: "design", action: "Water the plant", kind: "How I work", title: "Designs keep growing",
    body: "A design system is never finished. I keep components in Figma and in code in step, so the two do not drift apart as the product grows." },
  // Frontend
  { id: "browser", layer: "frontend", action: "Resize the window", kind: "The field", title: "Phone first, then wider",
    body: "Click the window and watch it become a phone: every block finds a new place, the way a real responsive layout reflows at each breakpoint." },
  { id: "atom", layer: "frontend", action: "Spin the atom", kind: "From my work", title: "React and Next.js, every day",
    body: "My daily tools: React and the Next.js App Router, with Server and Client Components, SSR, ISR or client rendering chosen per page, and TanStack Query or Redux for state." },
  { id: "bricks", layer: "frontend", action: "Rebuild the components", kind: "From my work", title: "Built from reusable parts",
    body: "At AAQ Gold Reserve and Poply I built reusable components with clear loading, error and transaction states, so new pages are assembled rather than rebuilt." },
  // Backend
  { id: "racks", layer: "backend", action: "Send a burst of requests", kind: "The field", title: "APIs that hold under load",
    body: "Stateless APIs let traffic spread across servers behind a load balancer. Rate limits, logs and health checks keep a busy day from becoming an outage." },
  { id: "gateway", layer: "backend", action: "Open the gateway", kind: "How I work", title: "GET, POST, a clear contract",
    body: "REST endpoints and Next.js Route Handlers give the interface one clear contract for reading and changing data, validated on the way in." },
  { id: "lock", layer: "backend", action: "Sign in", kind: "From my work", title: "Sign-in for real money",
    body: "At AAQ Gold Reserve, a credit-based gold platform, I built authentication, validation and the account and installment flows, front to back." },
  { id: "gears", layer: "backend", action: "Turn the gears", kind: "The field", title: "Services that fit together",
    body: "Products lean on other services: payments, email, maps. I integrate them behind one API, so the interface never talks to five vendors directly." },
  // Data
  { id: "db", layer: "data", action: "Run a migration", kind: "How I work", title: "Migrations without surprises",
    body: "Schema changes ship as versioned migrations, tested before release, so the data moves forward together with the code." },
  { id: "table", layer: "data", action: "Watch the rows", kind: "From my work", title: "Market data that never sits still",
    body: "At Vandaw I built React features for tgju.org, a major financial information platform whose dense market data changes all day long.",
    link: { href: "https://www.tgju.org", label: "tgju.org" } },
  { id: "chart", layer: "data", action: "Query the data", kind: "The field", title: "Fast questions, fast answers",
    body: "Indexes keep reads quick as the data grows; caching in the browser, on the server and at the CDN keeps the busiest questions off the database." },
  { id: "chain", layer: "data", action: "Add a block", kind: "From my work", title: "On-chain, too",
    body: "At Poply, an NFT marketplace in the UAE, I connected wallets and smart contracts with Viem, Wagmi and Ethers.js: reads, writes, gas, events and clear transaction feedback.",
    link: { href: "https://poply.xyz", label: "poply.xyz" } },
  // Delivery
  { id: "rocket", layer: "delivery", action: "Ship it", kind: "How I work", title: "Shipping is a pipeline",
    body: "Every change runs through CI before it reaches you. Health checks watch the release, and a rollback is always one step away." },
  { id: "checks", layer: "delivery", action: "Run the checks", kind: "The field", title: "Checks before every launch",
    body: "Unit and integration tests, performance profiling and error tracking catch problems before your visitors do." },
  { id: "containers", layer: "delivery", action: "Pack the containers", kind: "The field", title: "Same box, every machine",
    body: "Docker packages the app with everything it needs, so it runs the same on a laptop, in CI and in production." },
  // The person and the helper
  { id: "you", layer: "you", action: "Say hello", kind: "From my work", title: "That's me, Mahan",
    body: "A full-stack engineer with a degree in electrical engineering from Guilan University and an MBA from Azad University, shipping React, Next.js and Node.js products for finance and Web3 since 2023." },
  { id: "drone", layer: "you", action: "Ask the helper", kind: "How I work", title: "An extra pair of hands",
    body: "I use AI-assisted engineering: agentic coding, MCP integrations, structured outputs and automated review and tests. It speeds up the routine; the decisions stay mine." },
];
export const noteById = (id: string) => NOTES.find(n => n.id === id);

/** The CV's skills, one chapter each (skill-chapters.tsx). `where` names CV roles only. */
export const CHAPTERS = [
  { id: "overview", label: "Overview", tone: "#ff6a4d", title: "Full-stack, end to end.",
    line: "A full-stack engineer working in React, Next.js, TypeScript and Node.js. I build production-grade financial and Web3 products, from frontend architecture and backend APIs to system design and reliable delivery.",
    skills: ["React", "Next.js", "TypeScript", "Node.js", "Web3"],
    where: "Vandaw · Poply · AAQ Gold Reserve" },
  { id: "frontend", label: "Frontend", tone: "#4a63ff", title: "Frontend engineering.",
    line: "Interfaces in React and the Next.js App Router, each page rendered the way it needs: on the server, at build time or in the browser.",
    skills: ["React", "Next.js App Router", "TypeScript", "JavaScript (ES6+)", "Server & Client Components", "SSR · ISR · CSR", "TanStack Query", "Redux", "Tailwind CSS", "Three.js", "React Three Fiber"],
    where: "Shipped at Vandaw, Poply and AAQ Gold Reserve." },
  { id: "backend", label: "Backend", tone: "#8b6dff", title: "Backend engineering.",
    line: "Services in Node.js and Express, Next.js Route Handlers and REST APIs, with authentication and validation at the door.",
    skills: ["Node.js", "Express", "Route Handlers", "REST APIs", "Authentication", "Validation", "PostgreSQL fundamentals", "Service integration"],
    where: "Node.js services and APIs at AAQ Gold Reserve." },
  { id: "scale", label: "Scale", tone: "#14c4a8", title: "System design & scale.",
    line: "Built to grow: caching in layers from the browser to the CDN, stateless APIs that scale out behind a load balancer, indexes, rate limits and monitoring.",
    skills: ["Layered caching", "Cache invalidation", "Stateless APIs", "Horizontal scaling", "Load balancing", "Database indexing", "Rate limiting", "Logging & monitoring"] },
  { id: "web3", label: "Web3", tone: "#ffb21e", title: "Web3.",
    line: "Wallets and smart contracts wired into real products: reads, writes, gas, events and a transaction lifecycle the user can follow.",
    skills: ["Viem", "Wagmi", "Ethers.js", "Wallet connectivity", "Contract reads & writes", "Transaction lifecycle", "Gas estimation", "Event handling"],
    where: "An NFT marketplace at Poply, UAE." },
  { id: "quality", label: "Quality", tone: "#36d399", title: "Production & quality.",
    line: "Every release runs a pipeline and ships in a container, then is watched once it is live, with a rollback ready.",
    skills: ["CI/CD", "Docker", "Environment config", "Unit & integration tests", "Input validation", "Security headers", "Performance profiling", "Error tracking", "Health checks", "Rollbacks"] },
  { id: "ai", label: "AI", tone: "#ff8fb1", title: "AI-assisted engineering.",
    line: "Agents and tools that take on the routine work of code, review and tests, while every decision stays with a person.",
    skills: ["Agentic coding", "MCP integrations", "Prompt & context engineering", "Structured outputs", "Code review", "Test automation"],
    where: "Everyday tools: Git, GitHub, Figma, browser devtools, API debugging." },
];

/** Work history, from the CV; the last stop is now. */
export const PATH = [
  { years: "2023 – 2024", role: "Frontend Developer", place: "Vandaw · tgju.org", copy: "React features for a major financial information platform with dense, fast-changing market data." },
  { years: "2024 – 2026", role: "Frontend Developer", place: "Poply · UAE", copy: "An NFT marketplace frontend, with wallets and smart contracts wired in through Viem, Wagmi and Ethers.js." },
  { years: "2026", role: "Full-Stack Developer", place: "AAQ Gold Reserve", copy: "Frontend and backend for an installment gold platform: customer journeys, purchasing and account flows." },
  { years: "Now", role: "Full-stack engineer & designer", place: "Codaine", copy: "Design, frontend, backend and delivery together, from the first prototype to launch." },
];
export const EDUCATION = [
  { degree: "Master of Business Administration", school: "Azad University" },
  { degree: "Bachelor of Electrical Engineering", school: "Guilan University" },
];

export const PRINCIPLES = [
  { title: "You talk to the person doing the work.", copy: "No account managers, no handoffs between a designer and a developer. Questions get answered by the one who writes the code." },
  { title: "You own what you pay for.", copy: "Code, designs and accounts are built in your name and your repositories, so you can take them anywhere, any time." },
  { title: "Built to keep working.", copy: "Fast pages, tested flows, and a structure that still makes sense when your traffic or your team grows." },
  { title: "Handed over, not handed off.", copy: "Documentation and a walkthrough, so your team or the next developer can carry on without guessing." },
];
