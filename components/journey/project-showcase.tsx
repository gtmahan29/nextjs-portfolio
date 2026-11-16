"use client";
import {useEffect, useState} from "react";
import dynamic from "next/dynamic";
import {CASE_PROJECTS} from "./project-case-data";
import {Outfit} from "next/font/google";
import ProjectStartingPoint from "./project-starting-point";
const showcaseFont=Outfit({subsets:["latin"],display:"swap",variable:"--font-showcase"});
const ProjectCaseStudy=dynamic(()=>import("./project-case-study"),{ssr:false});
export default function ProjectShowcase() {
  const [opened, setOpened] = useState<string | null>(null);
  useEffect(() => {
    const requested = new URL(window.location.href).searchParams.get("caseStudy");
    if (requested && CASE_PROJECTS.some(project => project.id === requested)) setOpened(requested);
  }, []);
  useEffect(() => {
    const open = (event: Event) => {
      const id = (event as CustomEvent<unknown>).detail;
      if (typeof id === "string" && CASE_PROJECTS.some(project => project.id === id)) setOpened(id);
    };
    window.addEventListener("portfolio-open-project", open);
    return () => window.removeEventListener("portfolio-open-project", open);
  }, []);
  return <>
    <ProjectStartingPoint />
    {opened && <ProjectCaseStudy projectId={opened} fontClass={showcaseFont.variable} onClose={() => setOpened(null)} onProjectChange={setOpened}/>}
  </>;
}
