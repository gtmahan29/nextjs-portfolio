/** A fullscreen case study completely covers the WebGL scenes. Give its motion the frame budget. */
let caseStudyOpen = false;
export const CASE_VISIBILITY_EVENT = "portfolio-case-visibility";
export function isCaseStudyOpen() {return caseStudyOpen;}
export function setCaseStudyOpen(open: boolean) {
  if (caseStudyOpen === open) return;
  caseStudyOpen = open;
  window.dispatchEvent(new Event(CASE_VISIBILITY_EVENT));
}
