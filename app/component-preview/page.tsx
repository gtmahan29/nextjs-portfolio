"use client";

import dynamic from "next/dynamic";
import { ArrowUpRight, BookOpen, Cable, Monitor } from "lucide-react";
import DeskComputer from "@/components/pinui/DeskComputer";
import LampSwitch from "@/components/pinui/LampSwitch";
import ReaderCard from "@/components/pinui/ReaderCard";
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import { CircuitBoard } from "@/components/ui/circuit-board";
import { InteractiveGridPattern } from "@/components/ui/interactive-grid-pattern";

const IsoDioramaScene = dynamic(
  () => import("@/components/iso-diorama/IsoDioramaScene"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[680px] md:h-[760px] w-full items-center justify-center rounded-2xl bg-[#F8F4EA] text-sm font-medium text-[#6B6E78]">
        Loading interactive 3D diorama...
      </div>
    ),
  }
);

function PreviewSection({
  number,
  title,
  description,
  children,
  className = "",
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`cp-section ${className}`}>
      <header className="cp-section-head">
        <span>{number}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

export default function ComponentPreviewPage() {
  return (
    <main className="cp-page">
      <style>{`
        .cp-page{min-height:100vh;background:#f3f2ef;color:#181a20;padding:36px clamp(20px,5vw,76px) 100px}
        .cp-wrap{max-width:1320px;margin:0 auto}
        .cp-top{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #181a2018;padding:4px 0 22px}
        .cp-brand{font-size:13px;font-weight:750;letter-spacing:.12em;text-transform:uppercase}
        .cp-count{font-size:11px;letter-spacing:.13em;color:#73757d;text-transform:uppercase}
        .cp-intro{padding:76px 0 64px;max-width:800px}
        .cp-kicker{font-size:11px;font-weight:650;letter-spacing:.16em;text-transform:uppercase;color:#73757d}
        .cp-intro h1{font-size:clamp(44px,7vw,86px);line-height:.98;letter-spacing:-.065em;font-weight:560;margin:18px 0 20px}
        .cp-intro p{max-width:570px;color:#696c74;line-height:1.7;font-size:16px}
        .cp-section{padding:28px 0 70px;border-top:1px solid #181a2018}
        .cp-section-head{display:grid;grid-template-columns:66px 1fr;gap:10px;margin-bottom:24px}
        .cp-section-head>span{font-size:11px;color:#868991;padding-top:9px;letter-spacing:.12em}
        .cp-section-head h2{font-size:clamp(22px,3vw,34px);letter-spacing:-.045em;margin:0 0 6px;font-weight:550}
        .cp-section-head p{margin:0;color:#777a81;font-size:14px;line-height:1.5}
        .cp-frame{position:relative;overflow:hidden;border:1px solid #191b2115;border-radius:18px;background:#fff;box-shadow:0 12px 48px #181a200a}
        .cp-desk{min-height:490px;padding:26px;background:#e7e5df;display:grid;place-items:center}
        .cp-desk .pdesk{width:min(840px,100%)}
        .cp-lamp{min-height:560px;display:grid;place-items:center;padding:30px;background:#262729}
        .cp-reader{height:700px;padding:26px;background:radial-gradient(ellipse at 50% 25%,#e5e8ee 0%,#cbd3df 40%,#aebacb 100%);display:grid;place-items:center}
        .cp-reader .prc{width:min(640px,100%)}
        .cp-grid-demo{min-height:280px;position:relative;display:grid;place-items:center;background:#fff;isolation:isolate}
        .cp-grid-demo>*:not(svg){z-index:1}
        .cp-grid-demo svg{z-index:0;pointer-events:auto}
        .cp-grid-label{border:1px solid #11182714;background:#ffffffd9;backdrop-filter:blur(12px);border-radius:16px;padding:22px 28px;text-align:center;box-shadow:0 12px 40px #14243a12}
        .cp-grid-label b{font-size:21px;letter-spacing:-.04em}.cp-grid-label p{font-size:13px;color:#737780;margin:5px 0 0}
        .cp-circuit{padding:48px 32px;background:#111318;color:#fff;overflow-x:auto}
        .cp-circuit svg{min-width:640px}
        .cp-bento{padding:22px;background:#e8e9ec}
        @media(max-width:640px){.cp-page{padding-top:20px}.cp-intro{padding:56px 0 46px}.cp-section{padding-bottom:48px}.cp-section-head{grid-template-columns:38px 1fr}.cp-desk{min-height:300px;padding:8px}.cp-lamp{min-height:490px}.cp-reader{height:640px;padding:10px}.cp-circuit{padding:25px 14px}.cp-bento{padding:12px}}
      `}</style>
      <div className="cp-wrap">
        <div className="cp-top">
          <span className="cp-brand">Component room</span>
          <span className="cp-count">Seven interactive studies</span>
        </div>
        <header className="cp-intro">
          <span className="cp-kicker">Installed components · preview</span>
          <h1>Small things,<br />with a little life.</h1>
          <p>Each component is shown in its own space. Explore the 3D isometric world, try the lamp switch, type into the computer, hover the grid, and open the reader card.</p>
        </header>

        <PreviewSection
          number="00"
          title="Interactive 3D Isometric World"
          description="Hover any quadrant to spotlight it and dim the others, click a quadrant to focus the camera, drag to orbit 360°, and click props like the CSS hoop, HTML dome, KEYWORD_ search bar, SEO train, heart drone, crane, or globe."
        >
          <div className="cp-frame bg-[#F8F4EA]">
            <IsoDioramaScene />
          </div>
        </PreviewSection>

        <PreviewSection number="01" title="Desk Computer" description="Type to search, drag the mouse, and try the disc drive. Sound is muted for this preview.">
          <div className="cp-frame cp-desk"><DeskComputer sound={false} /></div>
        </PreviewSection>

        <PreviewSection number="02" title="Lamp Switch" description="A hanging lamp settles into place. Pull the shade or toggle the liquid switch." className="cp-dark-section">
          <div className="cp-frame cp-lamp"><LampSwitch theme="light" size={460} autoOn /></div>
        </PreviewSection>

        <PreviewSection number="03" title="Reader Card" description="Open the story excerpt to expand it into a reading panel. Close it with the button, Escape, or the backdrop.">
          <div className="cp-frame cp-reader"><ReaderCard theme="light" fill /></div>
        </PreviewSection>

        <PreviewSection number="04" title="Bento Grid" description="A responsive layout for feature cards with hover treatments and links.">
          <div className="cp-frame cp-bento">
            <BentoGrid className="grid-cols-1 md:grid-cols-3 auto-rows-[18rem]">
              <BentoCard name="Interfaces" description="A clear place for the product to begin." className="md:col-span-2" href="#interfaces" cta="Explore interfaces" Icon={Monitor} background={<div className="absolute inset-0 bg-gradient-to-br from-[#e5e8f0] via-[#f8f7f4] to-[#dbe6e7] opacity-90 transition duration-500 group-hover:scale-105" />} />
              <BentoCard name="Reading" description="Stories with room to breathe." className="md:col-span-1" href="#reading" cta="Open a story" Icon={BookOpen} background={<div className="absolute inset-0 bg-gradient-to-br from-[#f2e9db] via-[#faf8f1] to-[#e8ded4] opacity-90 transition duration-500 group-hover:scale-105" />} />
              <BentoCard name="Connections" description="Systems that stay in sync." className="md:col-span-1" href="#connections" cta="See how it works" Icon={Cable} background={<div className="absolute inset-0 bg-gradient-to-br from-[#dce9e5] via-[#f8f8f3] to-[#e9e5d8] opacity-90 transition duration-500 group-hover:scale-105" />} />
              <BentoCard name="Details that matter" description="One thoughtful system, across every screen." className="md:col-span-2" href="#details" cta="View details" Icon={ArrowUpRight} background={<div className="absolute inset-0 bg-gradient-to-br from-[#e8e3f0] via-[#f9f7f4] to-[#e4e7ee] opacity-90 transition duration-500 group-hover:scale-105" />} />
            </BentoGrid>
          </div>
        </PreviewSection>

        <PreviewSection number="05" title="Circuit Board" description="A small animated circuit illustration. The pulse runs continuously across its paths.">
          <div className="cp-frame cp-circuit"><CircuitBoard /></div>
        </PreviewSection>

        <PreviewSection number="06" title="Interactive Grid Pattern" description="Move the pointer across the cells to reveal the interactive pattern.">
          <div className="cp-frame cp-grid-demo">
            <InteractiveGridPattern squares={[24, 10]} width={34} height={34} squaresClassName="stroke-slate-300/60 hover:fill-sky-200/70" />
            <div className="cp-grid-label"><b>A quiet field of pixels</b><p>Move your pointer across the grid</p></div>
          </div>
        </PreviewSection>
      </div>
    </main>
  );
}
