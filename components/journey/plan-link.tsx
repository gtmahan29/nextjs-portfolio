"use client";

import type { ReactNode } from "react";
import type { PlanId } from "./data";

/** Jumps to the brief form and pre-selects the option the visitor was reading. */
export default function PlanLink({ plan, children }: { plan: PlanId; children: ReactNode }) {
  return (
    <a
      className="jny-arrow-link"
      href="#contact"
      onClick={() => window.dispatchEvent(new CustomEvent("journey-plan", { detail: plan }))}
    >
      <span>{children}</span>
      <span className="ic" aria-hidden="true">
        <svg viewBox="0 0 16 16">
          <path d="M4 12L12 4M5.5 4H12v6.5" />
        </svg>
      </span>
    </a>
  );
}
