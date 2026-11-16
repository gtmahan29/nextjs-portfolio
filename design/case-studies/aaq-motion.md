# AAQ case study — motion direction

## Contract

Primary renderer: semantic HTML, SVG and typography. Remotion supplies a frame-based DOM composition inside the same visual language. GSAP ScrollTrigger is the scroll conductor; Lenis runs on its ticker. No exported video is required to view the choreography.

Mood: considered, tactile, calm. Warm deep green, canvas, pearl and gold; Manrope display and reading text. Motion grammar: assemble, glide, reveal. No bounce or continuous decorative loops. Existing source-backed content and capture requirements remain the evidence.

## Beat ledger

| Beat | Source | Motion |
|---|---|---|
| Cover → article | Project scope | Measured title move into the project rail |
| Discovery → purchase → account | `/`, `/buy`, `/dashboard` | Scroll-seeked Remotion laptop, masked kinetic headings, short typed labels, screen slides, drawn journey line |
| Storefront | Public opening and feature sequence | Perspective settles; capture frame opens; capture brief reveals in order |
| Purchase | Conditional verification, payment review | Manual step feedback, staged text; calculator pointer depth |
| Account | Overview layout, plans and records | Structural strokes unfold; Desktop/Compact layout morph; shared tab indicator; phone parallax |
| Operations and visual language | Admin routes, source design system | Screen mask transitions; drawn editorial rule; staggered palette and type specimens |
| Decisions and action | Case study's factual synthesis | Masked rows; large closing text reveal |

## Timing and ownership

- Main composition: 360 seekable frames at 60 fps. Frame 0–123 discovery; 124–243 purchase; 244–359 account. No autoplay clock; scroll controls frame position in both directions.
- Sticky film adds 85vh of travel on desktop and 75vh on phones, rather than a long multi-screen pin. CSS sticky handles the pin; ScrollTrigger maps the native dialog scroll to the frame clock with 0.85 second scrub smoothing.
- Film velocity is clamped from scroll speed to ±0.65 degrees and ±5 pixels. `quickTo` eases toward each target and returns to zero when scrub settles. Only the visual stage reacts; reading copy stays steady.
- Heading words: 1.15 seconds, 55 ms stagger, power4.out. Supporting labels: 0.9 seconds. Captures: 1.2 second frame reveal, 75 ms content stagger. Phone depth: scrub 1.15.
- GSAP owns editorial reveal transforms. Motion owns pointer tilt, interactive layout and tab changes. Remotion owns only its composition subtree. They do not animate the same element's transform.
- Contexts, tickers, resize observers and triggers are removed on closing/unmount. The Remotion player mounts when approaching the viewport and stays paused between seeks.

## Responsive and reduced motion

The composition switches from 1200 × 860 to 760 × 900 below 600 px. Its surrounding captions remain normal-sized DOM text. Reduced motion removes sticky travel and scroll choreography and displays a settled frame, while all chapter content remains available.

Device screens read the same `AAQ_CAPTURES` configuration as the chapter placeholders. Real videos use Remotion's frame-synchronised Html5Video; stills use images. Until supplied, placeholders state the actual route, requested capture and filename. The full editable capture briefs follow in their chapters.

## Local review

Preview: `/journey?caseStudy=aaq`. TypeScript: `npx tsc --noEmit`. No production build or automated tests run. Review desktop and phone, slow forward scrolling, backward scrubbing, chapter navigation, account controls and normal return to the article after the sticky scene.

### Observed in the browser

- Desktop 1440 � 1000 and phone 390 � 844 reviewed. The clean phone render has a 375 px dialog client width and 375 px scroll width (the remaining width is the scrollbar gutter).
- Chapter selection reached the account section; diagram controls and capture instructions remain readable.
- New film beats respond to forward and reverse scrolling. CSS sticky releases back into the article.
- Browser console retained the existing Ferris-wheel server/client floating-point style mismatch warning. No new case-study runtime error appeared during the clean review.
- Review stills: `review/aaq-motion-desktop.png` and `review/aaq-motion-mobile.png`. These show placeholder screens, not final AAQ footage.
