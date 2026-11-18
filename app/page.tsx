import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import localFont from "next/font/local";
import "./journey/journey.css";
import "@/components/journey/closing.css";
import ProcessJourney from "@/components/journey/process-journey";
import HeroPortal from "@/components/journey/hero-portal";
import StudioHall from "@/components/journey/studio-hall";
import GlassFolder from "@/components/journey/glass-folder";
import JourneyReveal from "@/components/journey/reveal";
import HeaderTheme from "@/components/journey/header-theme";
import PerformanceReview from "@/components/journey/performance-review";
import PageLoader from "@/components/journey/page-loader";
import MotionSetup from "@/components/journey/motion-setup";
import ClosingMotion from "@/components/journey/closing-motion";
import { ClosingChapters } from "@/components/journey/closing-chapters";
import {
  JourneyFooter,
  JourneyHeader,
  WordmarkDefs,
} from "@/components/journey/sections";

// One typeface for the whole journey; the hero wordmark keeps its own display face.
const pageFont = Outfit({ subsets: ["latin"], display: "swap", variable: "--font-page" });
// Every title shares the hero's display face (Yorkmade), so the page speaks with one voice.
const displayFont = localFont({ src: "../public/fonts/Yorkmade.woff2", weight: "700", display: "swap", variable: "--font-display" });

export const metadata: Metadata = {
  title: "Mahan Adeli — From idea to production",
  description:
    "Websites, mobile apps and internal platforms, designed and built by one fullstack developer, from the first conversation to launch and handover.",
};

export default function HomePage() {
  return (
    <div className={`jny-root ${pageFont.variable} ${displayFont.variable}`} id="top">
      <WordmarkDefs />
      <PageLoader />
      <JourneyHeader />
      <main>
        <HeroPortal />
        <ProcessJourney />
        <StudioHall />
        <GlassFolder />
        <ClosingChapters />
      </main>
      <JourneyFooter />
      <JourneyReveal />
      <HeaderTheme />
      <MotionSetup />
      <ClosingMotion />
      <PerformanceReview />
    </div>
  );
}
