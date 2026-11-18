export type Station = {
  id: number;
  name: string;
  role: string;
  color: string;
  colorInt: number;
  worry: string;
  answer: string;
  tools: string[];
  deliverable: string;
  building: BuildingKind;
  cardBadge: string;
  cardTitle: string;
  cardMetric: string;
};

export type BuildingKind =
  | "sparkAltar"
  | "shapeStudio"
  | "systemFoundry"
  | "runtimeTestCell"
  | "capacityBay"
  | "releaseDesk";

export const STATIONS: Station[] = [
  {
    id: 1,
    name: "The Spark",
    role: "Concept and scope",
    color: "#f59e0b",
    colorInt: 0xf59e0b,
    worry: "What if my idea is too vague to build?",
    answer: "It doesn’t need to be clear yet. We turn it into a one-page brief, a scope and a first plan, before any code is written.",
    tools: ["Product brief", "Scope", "Success measures"],
    deliverable: "A clear scope and plan",
    building: "sparkAltar",
    cardBadge: "01 · CONCEPT",
    cardTitle: "THE SPARK",
    cardMetric: "SCOPED SPECIFICATION",
  },
  {
    id: 2,
    name: "Taking Shape",
    role: "Design and prototype",
    color: "#8b5cf6",
    colorInt: 0x8b5cf6,
    worry: "What if I only see it once it’s built?",
    answer: "You click through a prototype first, with real screens and flows. Changes are cheap here, so the direction is settled before development starts.",
    tools: ["Clickable prototype", "Design system", "User flows"],
    deliverable: "A prototype you can click through",
    building: "shapeStudio",
    cardBadge: "02 · DESIGN",
    cardTitle: "TAKING SHAPE",
    cardMetric: "CLICKABLE PROTOTYPE",
  },
  {
    id: 3,
    name: "Building the System",
    role: "Engineering",
    color: "#0ea5e9",
    colorInt: 0x0ea5e9,
    worry: "Will it hold together as it grows?",
    answer: "One codebase, a clear data model and tested interfaces, so new features slot in instead of piling up.",
    tools: ["Next.js and React", "Node.js and PostgreSQL", "Typed APIs"],
    deliverable: "A solid, documented foundation",
    building: "systemFoundry",
    cardBadge: "03 · ARCHITECTURE",
    cardTitle: "BUILDING THE SYSTEM",
    cardMetric: "TYPED FULLSTACK CORE",
  },
  {
    id: 4,
    name: "Coming Alive",
    role: "Speed and quality",
    color: "#10b981",
    colorInt: 0x10b981,
    worry: "Will it feel slow or break for real users?",
    answer: "Before launch, I measure load times, check how quickly interactions respond, and test the flows your users rely on.",
    tools: ["Load times", "Interaction latency", "Automated flow tests"],
    deliverable: "A product that’s fast and tested",
    building: "runtimeTestCell",
    cardBadge: "04 · RUNTIME",
    cardTitle: "COMING ALIVE",
    cardMetric: "VERIFIED FOR RELEASE",
  },
  {
    id: 5,
    name: "Growing",
    role: "Scale and reliability",
    color: "#f97316",
    colorInt: 0xf97316,
    worry: "What happens when more people show up?",
    answer: "When traffic rises, more capacity comes online. During updates, requests move to healthy servers so the site stays available.",
    tools: ["Autoscaling", "Load balancing", "Rolling releases"],
    deliverable: "Infrastructure that grows with you",
    building: "capacityBay",
    cardBadge: "05 · SCALE",
    cardTitle: "GROWING",
    cardMetric: "ELASTIC INFRASTRUCTURE",
  },
  {
    id: 6,
    name: "Out in the World",
    role: "Launch and handover",
    color: "#ec4899",
    colorInt: 0xec4899,
    worry: "What happens after launch?",
    answer: "We launch together with monitoring in place. You get the code, the accounts and the documentation, and I stay around for what comes next.",
    tools: ["Monitoring", "Analytics", "Full handover"],
    deliverable: "A live product that’s fully yours",
    building: "releaseDesk",
    cardBadge: "06 · LAUNCH",
    cardTitle: "OUT IN THE WORLD",
    cardMetric: "FULL IP & TELEMETRY",
  },
];

export const FOCUS = [0.16, 0.3, 0.44, 0.58, 0.72, 0.87];

export const CONTACT_EMAIL = "gtmahan29@gmail.com";

export const PLANS = [
  { id: "launch", label: "A focused launch" },
  { id: "product", label: "A product build" },
  { id: "partner", label: "An ongoing partner" },
  { id: "unsure", label: "Not sure yet" },
] as const;
export type PlanId = (typeof PLANS)[number]["id"];

/** Four working principles. `icon` indexes the isometric icon set in sections.tsx. */
export const PRINCIPLES = [
  {
    icon: 2,
    title: "You talk to the person doing the work.",
    copy: "No account managers, no handoffs between a designer and a developer. Questions get answered by the one who writes the code.",
  },
  {
    icon: 3,
    title: "You own what you pay for.",
    copy: "Code, designs and accounts are built in your name and your repositories, so you can take them anywhere, any time.",
  },
  {
    icon: 1,
    title: "Built to keep working.",
    copy: "Fast pages, tested flows, and a structure that still makes sense when your traffic or your team grows.",
  },
  {
    icon: 0,
    title: "Handed over, not handed off.",
    copy: "Documentation and a walkthrough, so your team or the next developer can carry on without guessing.",
  },
];

export const ENGAGEMENTS = [
  {
    id: "product" as const,
    featured: true,
    name: "A product build",
    summary: "An app or platform that needs design and engineering done together.",
    includes: ["Discovery and a written scope", "A clickable prototype before development", "Built and shown in stages", "Launch, monitoring and handover"],
    shape: "Staged milestones. You see working software at the end of every stage.",
  },
  {
    id: "launch" as const,
    featured: false,
    name: "A focused launch",
    summary: "A new site or storefront with a clear scope.",
    includes: ["Design and build", "Content and payments set up", "Launch and handover"],
    shape: "Fixed scope, agreed before work begins.",
  },
  {
    id: "partner" as const,
    featured: false,
    name: "An ongoing partner",
    summary: "A live product that keeps changing.",
    includes: ["New features and fixes", "Performance and monitoring"],
    shape: "A monthly agreement you can adjust.",
  },
];

export const ASSURANCES = [
  "You own the code, designs and accounts.",
  "A written scope before any work begins.",
  "A documented handover, whenever you need it.",
];

/**
 * Only real quotes belong here. While the list is empty the section is not rendered.
 * Shape: { quote, name, role, project }
 */
export const TESTIMONIALS: { quote: string; name: string; role: string; project: string }[] = [];

export const FAQ = [
  {
    q: "How long does a project take?",
    a: "It depends on scope. A focused site is usually a matter of weeks, and a product build is staged over a longer stretch. After our first conversation you get a written plan with a timeline you can hold me to.",
  },
  {
    q: "What does it cost?",
    a: "Pricing follows scope, so I don't publish a rate card. Tell me what you want to build and I'll reply with a clear range and what drives it.",
  },
  {
    q: "Who owns the code and the designs?",
    a: "You do. Everything is built in your accounts and repositories, so you can take it elsewhere whenever you like.",
  },
  {
    q: "What if I only have a rough idea?",
    a: "That's the usual starting point. The first stage turns a rough idea into a brief, a scope and a prototype you can click, before anything is built.",
  },
  {
    q: "Do you work with us after launch?",
    a: "If you want me to. Monitoring, fixes and new features can continue under a monthly agreement, or you can take over with full documentation.",
  },
  {
    q: "What do you need from me?",
    a: "A clear picture of the problem, access to the people who decide, and feedback at each stage. Everything else I'll ask for as we go.",
  },
  {
    q: "Which technologies do you use?",
    a: "Mostly Next.js, React, TypeScript, Node.js and PostgreSQL, chosen to fit your project rather than out of habit.",
  },
];
