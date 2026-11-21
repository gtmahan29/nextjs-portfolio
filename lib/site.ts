/** The public address of the site. Set NEXT_PUBLIC_SITE_URL in production (e.g. https://example.com). */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

export const SITE_NAME = "Codaine";
export const SITE_TITLE = "Mahan Adeli — From idea to production";
export const SITE_DESCRIPTION =
  "Websites, mobile apps and internal platforms, designed and built by one fullstack developer, from the first conversation to launch and handover.";

/** Work-in-progress and lab routes that should stay out of search results. */
export const PRIVATE_ROUTES = ["/journey/", "/component-preview", "/door-lab", "/legacy"];
