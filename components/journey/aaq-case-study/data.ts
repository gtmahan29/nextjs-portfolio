import type {CaseMedia} from "../case-device";

export type CaptureId = "storefront" | "checkout" | "calculator" | "overview" | "plans" | "reservations" | "invoices" | "mobile" | "admin" | "kyc" | "withdrawals";
export interface Capture {
  title: string;
  route: string;
  kind: "video" | "image";
  instruction: string;
  format: string;
  filename: string;
  media?: CaseMedia;
}

/** Add media here after supplying the real capture; an undefined slot stays an honest capture brief. */
export const AAQ_CAPTURES: Record<CaptureId, Capture> = {
  storefront: {title: "Record the storefront", route: "/", kind: "video", instruction: "Scroll from the opening gold scene through the depth animation, feature sections and product selection. Keep the cursor still and pause briefly at each section.", format: "1440 × 900 · 20–30 sec · MP4", filename: "aaq-storefront.mp4"},
  checkout: {title: "Record the purchase journey", route: "/buy", kind: "video", instruction: "Using a demo account, select a product and quantity, show the verification step if enabled, then open the payment and agreement review. Stop before submitting a real payment.", format: "1440 × 900 · 15–25 sec · MP4", filename: "aaq-checkout.mp4"},
  calculator: {title: "Record the calculator", route: "/calculator", kind: "video", instruction: "Move the gold-weight slider, switch off Live Price and adjust the price input. Keep the calculation summary visible while the values respond.", format: "1440 × 900 · 10–15 sec · MP4", filename: "aaq-calculator.mp4"},
  overview: {title: "Capture the account overview", route: "/dashboard", kind: "image", instruction: "Use a demo account. Include the holdings summary, portfolio panel, recent activity and plan summary. Exclude real names, balances and account identifiers.", format: "1440 × 1000 · PNG or WebP", filename: "aaq-overview.webp"},
  plans: {title: "Record the plan views", route: "/dashboard/plans", kind: "video", instruction: "Use demo plans. Switch between grid and list, then open a plan to show its payment detail. Do not make a payment.", format: "1440 × 900 · 8–12 sec · MP4", filename: "aaq-plans.mp4"},
  reservations: {title: "Capture a reservation", route: "/dashboard/reservations", kind: "image", instruction: "Show an active demo reservation with its product, expiry countdown and available actions. Keep the full card visible.", format: "1440 × 900 · PNG or WebP", filename: "aaq-reservations.webp"},
  invoices: {title: "Record invoice navigation", route: "/dashboard/invoices", kind: "video", instruction: "Use a demo purchase. Open an invoice from the list, then show the printable detail. Replace personal and billing information before recording.", format: "1440 × 900 · 8–12 sec · MP4", filename: "aaq-invoices.mp4"},
  mobile: {title: "Record the mobile account", route: "/dashboard", kind: "video", instruction: "At phone width, scroll the demo overview, open Plans and return to the account navigation. Record the interface only, without browser chrome.", format: "390 × 844 · 10–15 sec · MP4", filename: "aaq-mobile.mp4"},
  admin: {title: "Capture the operations overview", route: "/admin", kind: "image", instruction: "Use demo records. Include the overview totals, instalment tracking and recent activity. Hide actual customer information and financial figures.", format: "1440 × 1000 · PNG or WebP", filename: "aaq-admin.webp"},
  kyc: {title: "Capture verification history", route: "/admin/kyc-requests", kind: "image", instruction: "Capture the audit/history table with demo entries. Exclude identity documents, selfies, dates of birth and real applicant information. This screen is history, not a manual approval queue.", format: "1440 × 900 · PNG or WebP", filename: "aaq-kyc.webp"},
  withdrawals: {title: "Capture withdrawal operations", route: "/admin/withdrawals", kind: "image", instruction: "Capture the withdrawal list and its status controls using demo entries. Do not execute a withdrawal or display real customer records.", format: "1440 × 900 · PNG or WebP", filename: "aaq-withdrawals.webp"},
};

export const AAQ_CHAPTERS = [
  {id: "overview", label: "The product"},
  {id: "storefront", label: "The first impression"},
  {id: "purchase", label: "The purchase journey"},
  {id: "account", label: "After checkout"},
  {id: "operations", label: "Behind the platform"},
  {id: "language", label: "The visual language"},
  {id: "decisions", label: "Design decisions"},
] as const;

export const PURCHASE_STEPS = [
  {name: "Select", detail: "Choose the product and quantity. The selection sets up the purchase summary.", path: "/buy"},
  {name: "Verify", detail: "When verification is required, the journey includes the identity step before payment.", path: "/buy · conditional KYC step"},
  {name: "Review & pay", detail: "Review payment terms and the agreement before continuing to checkout.", path: "/buy · payment & agreement"},
  {name: "Confirmation", detail: "The success state follows the purchase and provides the next step into the account.", path: "/buy · success state"},
];

export const DASHBOARD_TABS: {id: CaptureId; label: string; description: string}[] = [
  {id: "overview", label: "Overview", description: "Holdings, cash balance, portfolio, recent activity and active plans are grouped in one overview."},
  {id: "plans", label: "Plans", description: "Grid and list views provide two ways to read the same instalment plans and inspect their payment details."},
  {id: "reservations", label: "Reservations", description: "Active reservations pair the selected product with its expiry countdown and available actions."},
  {id: "invoices", label: "Invoices", description: "An invoice list leads to the individual purchase record and its printable detail."},
];

export const ADMIN_TABS: {id: CaptureId; label: string; description: string}[] = [
  {id: "admin", label: "Overview", description: "The operational overview brings platform activity and instalment tracking into one place."},
  {id: "kyc", label: "Verification history", description: "The verification screen is a read-only history. The current source delegates verification decisions to Sumsub webhooks."},
  {id: "withdrawals", label: "Withdrawals", description: "The withdrawal workspace connects account requests with the records and status controls needed by operations."},
];
