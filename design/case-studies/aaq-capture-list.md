# AAQ Gold Reserve — capture checklist

The AAQ case study opens from **Explore project** in the showcase. Its media blocks contain the same recording instructions and a Copy brief action. No sample customer balances or fabricated product screenshots are used.

## Supply these 11 files

Save the final files in `public/work/aaq-case/`, then set each matching entry's `media` in `components/journey/aaq-case-study/data.ts`.

| Slot | Page | Capture | Filename |
|---|---|---|---|
| Storefront | `/` | 20–30 sec: opening scene, depth/features, product selection. Pause briefly at each section. | `aaq-storefront.mp4` |
| Purchase | `/buy` | 15–25 sec: product/quantity selection, verification if enabled, payment and agreement review. Stop before payment. | `aaq-checkout.mp4` |
| Calculator | `/calculator` | 10–15 sec: move gold-weight slider, disable Live Price, change price; keep summary visible. | `aaq-calculator.mp4` |
| Account overview | `/dashboard` | Holdings, portfolio panel, activity and plan summary. | `aaq-overview.webp` |
| Plans | `/dashboard/plans` | 8–12 sec: switch grid/list and inspect a plan's payment detail. | `aaq-plans.mp4` |
| Reservations | `/dashboard/reservations` | Active reservation, product, countdown and actions. | `aaq-reservations.webp` |
| Invoices | `/dashboard/invoices` | 8–12 sec: list → detail → printable record. | `aaq-invoices.mp4` |
| Mobile account | `/dashboard` | At 390 × 844: overview scroll, open Plans, return to account navigation. Interface only. | `aaq-mobile.mp4` |
| Admin overview | `/admin` | Platform summary, instalment tracking and recent activity. | `aaq-admin.webp` |
| Verification history | `/admin/kyc-requests` | Read-only verification history table. | `aaq-kyc.webp` |
| Withdrawals | `/admin/withdrawals` | Withdrawal list and status controls; do not execute a withdrawal. | `aaq-withdrawals.webp` |

Desktop video viewport: 1440 × 900. Desktop stills: 1440 × 900 or 1440 × 1000. Use demo accounts and demo records; omit actual personal, identity, billing and financial information.

## Attach a capture

```tsx
// In AAQ_CAPTURES.storefront:
media: {
  type: "video",
  src: "/work/aaq-case/aaq-storefront.mp4",
  poster: "/work/aaq-case/aaq-storefront-poster.webp", // optional
  alt: "AAQ storefront: opening scene through product selection",
},
```

For stills, use `type: "image"`. Empty media entries retain the capture brief. A video stays inside the same layout with native playback controls; replacing the asset does not require rebuilding the section.

## Content basis

Read-only source review: `C:/Users/Maahaan/Desktop/📁 Projects - Web/aaqgold`.

- Storefront: `src/app/page.tsx` and its imported hero/depth/features/selection components.
- Purchase: `src/app/buy/_components/BuyPageClient.tsx`; actual step labels Select, Verify, Pay; verification conditional; success state follows purchase.
- Calculator: `src/app/calculator/_components/CalculatorClient.tsx`.
- Account: `src/components/dashboard/OverviewClient.tsx`, `PlansClient.tsx`, `ReservationsClient.tsx`; `src/app/dashboard/invoices/_components/InvoicesListClient.tsx`.
- Operations: `src/app/admin/(panel)/page.tsx`, `kyc-requests/page.tsx`, `withdrawals/page.tsx`.
- Visual roles: `docs/design-system.md`.
- Stack names: `package.json`.

The calculator and purchase flow currently reference different instalment helpers (`splitInstalments` and `splitV2Plan`). The case study deliberately avoids presenting a single financial formula or rate as a product claim. `/shop` redirects to `/buy`. The KYC history screen is not an admin approval queue.
