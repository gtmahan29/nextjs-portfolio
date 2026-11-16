"use client";

import { useEffect } from "react";
import { springLinear } from "./motion-curve";

/** Publishes the one shared spring as --ease-spring, so CSS transitions use exactly the JS curve. */
export default function MotionSetup() {
  useEffect(() => {
    if (CSS.supports("transition-timing-function", "linear(0, 1)")) {
      document.documentElement.style.setProperty("--ease-spring", springLinear());
    }
  }, []);
  return null;
}
