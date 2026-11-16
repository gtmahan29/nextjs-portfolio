# Rasa English Academy — case study and capture brief

Preview: `/journey?caseStudy=rasa`. The existing Rasa showcase entry opens this dedicated case study. Source reviewed read-only at `C:/Users/Maahaan/Desktop/📁 Projects - Web/kids-center`.

## Source and scope

`lib/brand.ts` names the academy Rasa / رسا. `PRODUCT.md` still contains the older Kids Center name, so the current code's brand is used. This is an academy marketing and consultation experience, not an LMS or authenticated student dashboard.

- `app/page.tsx`: entrance, reel, five programme stages, workshop notes, alphabet tunnel, consultation, embedded roadmap and team.
- `components/modern/fluid-hero.tsx`: renders `SchoolDoorHero`; the older classroom hero is not the active entrance.
- `fluid-programs.tsx`: Starter Immersion (3–5), Phonics & Literacy (6–8), Junior Fluency (9–11), Teens Mastery (12–15), Everyday & Professional English (16+).
- `fluid-experience.tsx`: audience → goal → contact, with distinct family and adult goals. Submission checks non-empty name and phone and calls `setSubmitted(true)`. No backend submission is implemented here.
- `components/roadmap/world-config.ts`: five stations, from orientation through real-world use. `/roadmap` is the standalone route.
- `app/layout.tsx` and `lib/fonts.ts`: global Persian / RTL and Yekan Bakh.
- `lib/home-scroll.ts` and the story-scroll provider: shared entry/narrative/exit budgets with mobile variants.

No outcome figures, invented testimonials, live admissions claims or fabricated student records appear in the case study.

## Eight recordings

Place files in `public/work/rasa-case/`, then attach the matching `media` in `components/journey/rasa-case-study/data.ts`. Device screens and the Remotion composition share this configuration. Every capture block also has an expandable, copyable instruction brief.

| File | Location | What to record |
|---|---|---|
| `rasa-entrance.mp4` | `/` | Opening doors → classroom rooms. 12–18 seconds. |
| `rasa-skills.mp4` | `/`, below entrance | Listening/phonics → speaking → reading → writing; rotating dial and character changes. 12–18 seconds. |
| `rasa-programs.mp4` | `/#programs` | All five age-based cards and their scroll transition. 10–15 seconds. |
| `rasa-workshops.mp4` | `/#gallery` | The workshop paper-note stack and its exit. 10–15 seconds. |
| `rasa-alphabet.mp4` | `/#alphabet-tunnel` | The complete tunnel and its handoff to consultation. 12–18 seconds. |
| `rasa-consultation.mp4` | `/#journey` | Both audience types, a goal, then the contact step. Stop before submission. 12–18 seconds. |
| `rasa-roadmap.mp4` | `/roadmap` | All five stations, learner and illuminated path. 15–25 seconds. |
| `rasa-mobile.mp4` | `/`, phone | Entrance, programme transition and consultation audience choices. 15–20 seconds; short edited sequence is fine. |

Desktop: 1440 × 900. Phone: 390 × 844. Record the interface without browser chrome. No real personal information is required.

```tsx
// Example in RASA_CAPTURES.entrance:
media: {
  type: "video",
  src: "/work/rasa-case/rasa-entrance.mp4",
  alt: "Rasa's entrance doors open into the classroom",
  poster: "/work/rasa-case/rasa-entrance.webp", // optional
}
```

## Motion and art direction

Warm paper, muted blue and navy distinguish this case from AAQ's dark gold. Large two-line opening typography leads into a scroll-seeked Remotion tablet, vertical screen handoff and arriving phone. Persian annotations type by frame. GSAP and the dialog's Lenis instance share one ticker; captions and reading copy remain stable.

Six chapters use masked type, device reveals, drawn roadmap strokes, mobile device parallax, shared-layout age tabs and consultation step feedback. Interactive diagrams are labelled as content or interaction anatomy, rather than pretending to be the product itself. The 360-frame film uses native reversible scrolling and CSS sticky, with 95vh of desktop travel / 80vh on phones. Reduced motion removes sticky travel and uses a settled frame.

The small Yekan Bakh Regular and Bold font files were copied from the supplied project's `public/fonts/woff2` for Persian specimens. Source screens and videos remain placeholders as requested.


## Local review

- `npx tsc --noEmit` passed. No production build or automated tests were run.
- Reviewed at 1440 × 1000 and 390 × 844. Phone dialog: 375 px client width / 375 px scroll width, including its scrollbar gutter; desktop: 1425 / 1425.
- Forward and reverse film scrubbing, desktop-to-phone layout changes, chapter navigation, the adult programme and adult consultation goals were reviewed in the browser.
- The film resynchronises to the actual dialog scroll position after font/layout refresh and orientation changes. It does not restart at frame zero on a width change.
- The existing Ferris-wheel floating-point hydration warning remains outside this case study. No new Rasa runtime error appeared in the review.
- Review stills: `review/rasa-desktop.png` and `review/rasa-mobile.png`. They show media placeholders; no final project footage has been supplied.
