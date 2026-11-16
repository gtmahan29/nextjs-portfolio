import type {FerrisWheelItem} from "@/components/ui/ferris-wheel-gallery";
import type {CaseMedia} from "./case-device";

export interface CaseProject extends FerrisWheelItem {
  id: string;
  intro: string;
  brief: string;
  direction: string;
  decisions: {title: string; text: string}[];
  color: string;
  ink: string;
  palette: string[];
  mockupAlt: string;
  /** Omit a slot to use the project screenshot. Video slots also accept a poster image. */
  media?: Partial<Record<"desktop" | "tablet" | "phone", CaseMedia>>;
}

export const CASE_PROJECTS: CaseProject[] = [
  {
    id: "aaq", title: "AAQ Gold Reserve", discipline: "Digital commerce",
    description: "A modern storefront for a timeless investment.",
    src: "/work/aaq-gold.png", alt: "AAQ Gold Reserve website",
    href: "https://aaq-gold-reserve.vercel.app/",
    intro: "A timeless asset. A contemporary digital experience.",
    brief: "Give a gold reserve storefront the clarity of a modern product and the presence of a considered luxury brand.",
    direction: "Quiet confidence, down to the details.",
    decisions: [
      {title: "Let the product lead.", text: "Architectural imagery and a generous product stage give the gold room to speak. Warm stone and deep bronze carry that atmosphere through the interface."},
      {title: "Make the next step clear.", text: "A direct headline, a compact navigation and a distinct primary action keep the first screen focused on understanding the offer and exploring it."},
    ], color: "#f0e9dd", ink: "#514126", palette: ["#25251c", "#b08a36", "#e9dfcc"],
    mockupAlt: "AAQ Gold Reserve interface on a graphite laptop beside a gold bar on a sunlit stone desk",
  },
  {
    id: "rasa", title: "Rasa Language Academy", discipline: "Education & experience",
    description: "A welcoming digital home for learning a new language.",
    src: "/work/rasa-academy.png", alt: "Rasa Language Academy website",
    href: "https://language-academy-rho.vercel.app/",
    intro: "A new language starts with an open door.",
    brief: "Create a welcoming first impression for a language academy, with a clear path from curiosity to finding a suitable class.",
    direction: "A little wonder. A clear way forward.",
    decisions: [
      {title: "Build around an invitation.", text: "The blue doorway anchors the page, turning the idea of entering a new world into a recognizable visual centrepiece."},
      {title: "Respect the reading direction.", text: "Persian typography, right-to-left composition and clearly grouped course messages shape the experience around its audience."},
    ], color: "#eeeae0", ink: "#273e60", palette: ["#263d62", "#d4bc8b", "#f5f1e8"],
    mockupAlt: "Rasa's Persian language academy interface on a tablet with an ivory plinth and blue architectural arch",
  },
  {
    id: "portfolio", title: "Web Developer Portfolio", discipline: "Portfolio design study",
    src: "/work/project-study-1.webp", alt: "Web developer portfolio design",
    intro: "A personal introduction, with a purposeful point of view.",
    brief: "Explore a portfolio that introduces a developer with personality while giving their work a clear place in the story.",
    direction: "Personal, approachable, and easy to explore.",
    decisions: [
      {title: "Give the introduction a face.", text: "An illustrated character and a warm orange accent make the opening feel personal without overwhelming the message."},
      {title: "Keep the canvas light.", text: "A quiet background and a straightforward hierarchy leave space for the introduction, navigation and project content."},
    ], color: "#f0ebe5", ink: "#7b452b", palette: ["#e79150", "#29313b", "#f5f4f0"],
    mockupAlt: "Developer portfolio study displayed on a silver desktop monitor in a bright studio with an orange notebook",
  },
  {
    id: "marketplace", title: "AI Prompt Marketplace", discipline: "Marketplace design study",
    src: "/work/project-study-2.webp", alt: "AI prompt marketplace design",
    intro: "An expressive home for imaginative tools.",
    brief: "Explore a marketplace direction where AI artwork attracts attention and a clear interface helps people discover what to create next.",
    direction: "Vivid work. A focused frame.",
    decisions: [
      {title: "Put the imagination on show.", text: "Large artwork and a dark canvas give the imagery depth. Violet and green accents establish an energetic creative tone."},
      {title: "Create a readable rhythm.", text: "Bold headings and grouped content separate the introduction from the artwork, giving each part of the page its own moment."},
    ], color: "#eae4f3", ink: "#50357b", palette: ["#171322", "#702bc1", "#a1f45c"],
    mockupAlt: "AI marketplace interface on a graphite laptop in a violet studio with a frosted artwork panel",
  },
  {
    id: "dashboard", title: "Admin Dashboard", discipline: "Dashboard design study",
    src: "/work/project-study-3.webp", alt: "Admin dashboard design",
    intro: "Complex information, given a little breathing room.",
    brief: "Explore a dashboard direction that brings navigation, summaries and charts into one calm, scannable workspace.",
    direction: "Clarity is the visual language.",
    decisions: [
      {title: "Give information a place.", text: "A persistent sidebar separates navigation from the workspace. Consistent panels group related information and establish an orderly reading path."},
      {title: "Use colour with purpose.", text: "A pale canvas and restrained chart accents help the interface feel approachable while keeping its data in focus."},
    ], color: "#e8eef3", ink: "#3e5d78", palette: ["#446b9e", "#b2c7df", "#f4f6f9"],
    mockupAlt: "Analytics dashboard study on a black laptop and tablet in a powder-blue studio",
  },
];
