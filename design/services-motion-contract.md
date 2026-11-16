# Journey services — revision contract

Mode: Experience. Scope: service scene, its captions, and the laptop handoff only.

- Job: explain websites, mobile apps and business platforms while keeping the device change legible.
- Hierarchy: centered title; a service name; eight short lines describing actual work; device and floating platform to the right. White background, dark ink, existing Outfit/Inter families. No cards, eyebrow labels, claims about results, metrics, gradients in type, or extra controls.
- Motion: preserve the page-to-laptop connection. No turntable rotation, scale-to-zero, fading, or disappearing through the platform. Depart at full scale, clear the platform's front edge, then accelerate downward. Arrive from above with continuous deceleration and a small settling tilt. Broaden the transitions without adding section height.
- Light: camera-facing soft light field with Gaussian edges. No visible cone geometry or intersecting light cards.
- Text: eight complete English lines per service; paragraph typography and a restrained line reveal. Title is static during the three services. Text exits through its mask before the next paragraph enters.
- Responsive: text above the model on narrow viewports; title and service copy must stay clear of header and model. Short screens use smaller type, not clipped text.
- States: prewarm before entry; all service text remains available with reduced motion or WebGL failure; interruptible forward/backward scrolling; no offscreen idle loop.
- Budget: existing renderer, local assets, deterministic scroll clock with critical damping; no new dependency or video rendering workflow.
- Finish: one desktop/mobile inspection round, one batch of repairs if needed, then one confirmation round. No production build.

## Authored motion refinement
- The clock is acceleration-limited (0.85 progress/s²) and speed-limited (0.24 progress/s), then critically damped near the destination. Scroll reversal retains its velocity.
- Outgoing laptop: slight preparatory lift and partial lid close, a short forward clearance arc, then cubic gravitational descent at full scale. No rotation around the platform, shrinking or clipping through its top.
- Incoming device: a quintic Hermite height track with a continuous descent into rest, a shallow lateral arc, and 0.025rad of settling roll. Mobile follows the same path in reverse when scrolling upward.
- Captions use coherent eight-line English paragraphs, not a checklist of sales claims.
- Anti-ui-slop local context helper is absent in both skill locations; the supplied skill and local animate/craft-floor references were followed directly. No tool installation or paid reference lookup was needed.

## Finish gate
- Desktop: white background, centered title, eight-line caption and unobstructed device verified in the browser.
- Mobile: no horizontal overflow at 390×844; caption is above the model; reading type raised to 16px (14px only on short screens).
- Motion paths: fixed model scale, no platform spin, gravity departure and decelerating arrival, speed-limited clock, offscreen/visibility cleanup retained.
- Accessibility: static all-service layout with reduced motion or unavailable WebGL retained; currently visible paragraph owns the accessibility state.
- TypeScript: `npx tsc --noEmit` passes. No production build or new dependencies.


## Completion/pin correction
The earlier rate-limited clock was independent of document scroll, so the document could reach the end of the CSS sticky span while the scene was still at its opening frame. It is replaced by a labelled GSAP timeline with ScrollTrigger scrub (.85s), using exactly the sticky section's start/end. Native CSS sticky is intentionally retained: a GSAP pin wrapper/transform would break the fixed page-to-laptop projection before this section.

Lenis now budgets forward wheel, touch and PageDown/Space/arrow input against the rendered playhead (+0.12 progress maximum). Excess momentum is discarded rather than queued beyond the section. Backward input is similarly bounded. The handoff must finish before service scroll advances. The final 2px of the sticky span are retained until the last device has landed, the eight-line caption is fully revealed, and a 450ms final hold completes. The next input then releases normally. Explicit anchor navigation, reduced motion and unavailable WebGL bypass this pacing gate.


Browser verification of the completion gate (1600×960): repeated 8-viewport wheel inputs advanced through rendered progress 0.0834, 0.2054, 0.3184, 0.4428, 0.5578, 0.7000, 0.8023, 0.9218, 0.9850 while stageTop remained 0 and completion remained false. At progress 0.9990, the final paragraph/device were visible, completion became true after the hold, and the archive remained below the viewport (top 962). A subsequent 0.65-viewport scroll released the stage (top -506) and brought the archive to top 454. `npx tsc --noEmit` passed.


## Reversible arrival pacing
- Supersedes the discard-on-budget behavior above. A narrative input now records its destination; the shared ticker keeps approaching it as the rendered playhead catches up. No extra wheel gesture is required to finish the original input. A direction reversal replaces the pending destination immediately.
- Lenis autoRaf is disabled; Lenis RAF and ScrollTrigger updates share the GSAP ticker. Scene scrub is 1.2s for both services and archive; section heights and trigger positions are unchanged. Large gesture destinations are bounded to 0.85 viewport ahead to avoid a long queued flight through multiple sections.
- Reverse travel is independent of completion flags. Forward completion still retains the final scene until its text and hold finish. Anchor navigation and case studies clear pending narrative intent.
- The shared laptop display stays open through the handoff. A reversible wipe inside the projected display replaces the closed-lid plateau.
- Archive collision diagnostics now run only with `?motionDebug=1`; normal frames avoid three repeated Box3 scene traversals. Archive rendering still stops when settled/offscreen.


Verification of retained input: one 0.65-viewport service gesture began at rendered progress 0.0495 / section top -171 and, with no additional input, settled at progress 0.325 / top -624. One reverse gesture returned it to top +192 / transfer 0.8333; another continued through transfer 0.2083 / top +912, with the screen open. In the archive, one 0.60-viewport gesture advanced from rendered progress 0.308 / top -305 to progress 0.42105 / top -576 without extra input; reversal immediately moved back toward the earlier pose. Section heights/trigger bounds were not extended.


## October 17 correction: remove feedback gates
The previous render-progress input budget is superseded. Lenis exclusively owns wheel input; GSAP scrub exclusively owns narrative progress. No service/archive boundary consumes, rewrites or waits on wheel input. Touch stays native. Each of the three services has a separate platform assembly, and device, underside emission and platform translate together. Incoming assemblies decelerate from above; departing assemblies accelerate down. All assembly shaders and preview textures are warmed before interaction. Folder canvas and CSS use white.

TypeScript passed. Browser CDP failed to respond for both the existing preview and a fresh tab during this revision, so visual timing and wheel reversal still require an interactive review.


## Handoff playhead correction
Service progress previously remained visually zero until a second critically damped handoff reached .999, although the GSAP service clock advanced independently. That condition could expose the final service immediately after the first frame. The handoff now follows the already-smoothed Lenis position directly; service poses always use the service playhead, with no hidden-progress gate. Archive rendering no longer drops frames through a second quality-tier FPS limiter. Archive warmup starts three viewports ahead, and unchanged ResizeObserver dimensions no longer trigger global ScrollTrigger refreshes.
