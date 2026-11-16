# Haus reference: observed structure and reconstructed patterns

Reference: https://www.hipuku.dev/work/haus
Snippet reference: https://www.hipuku.dev/snippets#parallax-tilt
User recording: `C:/Users/Maahaan/Videos/Rec 0035.mp4`, 27.07 seconds; contact sheet saved alongside this folder.

## Observed in the live browser and recording

- Large, typographic opening on a subtle dark grid.
- Read action transitions the opening word into the project title in the left rail.
- Desktop article uses a sticky project rail and a wider reading column.
- Content alternates prose, executable examples, diagrams and drawn annotations.
- The recording shows the rail remaining in place while the article and diagrams scroll.
- Snippet documentation describes a shared perspective and restrained pointer rotation for parallax depth.

## Static frontend evidence

The public HTML and its referenced CSS/JavaScript were downloaded as analysis inputs only. REA inspected two selected shipped JavaScript files without executing their bootstrap code.

REA parent Evidence: `ev_83342e50c4a8c1da021b8f4f0fdd62f345d60ce15d8c982963a611b81cbbfee4`.
Summary Evidence: `ev_ae254fbb0822d1d40fda3f7c7f2ac43ff4184d29a120f411bed7459d1062e2dd`.

Selected files: `3yptc5g8y9mag.js`, `1r3l9oj08cq2m.js`. Static analysis is partial; dependencies and dynamic relationships remain unknown. No claim of complete source recovery is made.

Focused source inspection found:

- Opening state has a hero/live distinction and guards repeated transitions.
- The word transition measures source and target bounds, then uses a 720 ms Web Animations transform with a custom cubic curve.
- Article appearance uses IntersectionObserver with a negative lower root margin.
- The case-study stylesheet defines a 20rem rail, 6rem sticky offset and a single-column layout below 60rem.

## AAQ adaptation

The implementation reconstructs these general patterns with original components, AAQ-specific content, its documented colour roles and a shorter reading structure. It does not copy Haus's product data, prose, live colour-science examples or imagery.

- A measured 760 ms title transfer opens the article. A scoped Lenis instance smooths mouse-wheel input; touch stays native. The opening consumes one downward gesture; chapters have no scroll gate or pinned travel distance.
- Sticky rail, chapter tracking and section jump controls adapt to a nonsticky overview on small screens.
- Original SVG product map and notes draw their paths on entering view.
- Purchase-step controls and source-backed account/admin tabs give the article relevant interactions.
- Colour roles come from the AAQ repository.
- Capture briefs replace unavailable media. No synthetic balances, charts, metrics or fake screenshots.
- The account anatomy is an explicitly labelled structural diagram based on `OverviewClient.tsx`, with a smooth desktop/compact layout change and selectable explanations. Its outlines do not represent customer values.
- Typography uses self-hosted-through-Next/font Manrope, with named caption/body/subheading/heading roles and an 8px spacing rhythm. AAQ selectors are namespaced to prevent the generic case-study shell from resetting its theme or paragraph spacing.
- Covered hero, journey and showroom WebGL scenes pause while a case-study dialog is open, then resume on close.
- On phones, a chapter select replaces the full navigation rail. The account anatomy and media columns become a single column.

The supplied AAQ repository was read only and was not modified.
