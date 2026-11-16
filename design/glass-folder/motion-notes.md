# Glass folder / journey archive

The separate archive scene sits after the product showroom. The folder is procedural Three.js geometry, with a bevelled amber back, a hinged physical glass front, a bottom seam, and three individually printed card meshes. No remote models or lighting assets are required.

## Scroll sequence

Progress is reversible and uses GSAP ScrollTrigger with a 0.7 second scrub. The document keeps its existing Lenis owner. Scalar paths use quintic Hermite curves with matched position, velocity and acceleration at joins. The lift and descent share an apex acceleration, so the cards do not park in the air between phases.

| Progress | Action |
| --- | --- |
| 0.025–0.27 | Closed folder descends and decelerates into its resting position. |
| 0.29–0.43 | Front cover rotates open around the bottom seam. |
| 0.33–0.47 | Cards rise into a compact fan inside the pocket. |
| 0.505–0.545 | Cards compress down before release. |
| 0.545–0.658 | Upward strokes with a short stagger eject the cards through the opening. |
| 0.64–0.823 | Cleared cards descend and spread along connected curves. |
| 0.81–0.88 | Manual previous/next controls rotate the gallery. |
| 0.865–1 | The folder and cards accelerate downwards, with a short stagger. |

## Collision constraints

- Enclosed cards inherit the same pocket transform as the folder, rather than independently interpolating toward gallery positions.
- Three parallel depth lanes fit between the back cover at z = -0.55 and the front at z = 0.09. Cards only rotate in their own planes while enclosed.
- Horizontal travel starts after every vertical stroke has completed and all bottom edges have cleared the highest tab.
- Transformed bounds measure clearance without correcting the animation mid-flight. Clearance comes from the geometry and authored paths.
- Gallery cards already sit in front of the covers. Exit moves downwards without a preparatory move toward the camera.
- Reduced motion displays the settled gallery without the scroll sequence.

Project labels and local artwork are in `components/journey/glass-folder-data.ts`. The project button opens the existing case study dialog.

## Card redesign and motion review

| Before | After | Why |
| --- | --- | --- |
| Tall printed cards with large blank fields | 3.2 × 2.2 landscape panels; artwork occupies 81% of the face | Clearer project previews and a compact caption strip |
| Arial labels and repeated studio branding | Outfit labels, one title and one category | A consistent hierarchy without duplicated decoration |
| Cards exchanged left/right positions during release | Centre, left and right identities remain consistent | Spatial continuity |
| Height clamp altered the path during placement | Continuous curves with authored clearance | Removes velocity changes caused by corrections |
| Exit pushed cards toward the camera | Accelerating downward paths | Removes the sudden zoom before the fall |
| First-order carousel damping | Critically damped spring, omega 12 | Retains velocity when interrupted |

Two additive opportunities passed the frequency/purpose/speed/function gate: native button press feedback (`scale(.97)`, 160ms, `cubic-bezier(.23,1,.32,1)`) and a restrained pointer response on fine pointers only. The controls use a 280ms transform transition. Keyboard carousel activation is immediate; reduced motion keeps a settled scene.

Rejected opportunities: extra animated headline reveals would compete with the object story; looping card movement would interrupt reading; hover zoom on project artwork would add noise to the carousel. All three failed the function gate.

## Review

The original scene was reviewed at 1440 × 1000 and 390 × 844. The card redesign is reviewed separately at desktop and phone widths. TypeScript is checked with `npx tsc --noEmit`; no production build is used. Numerical checks sample 10,001 path positions and finite differences at joins. The existing Ferris-wheel hydration rounding warning is outside this scene.

The runtime renders on demand, stops outside the viewport and behind a case study, and disposes its owned geometry, textures, materials, environment, observers and scroll animation. Failed scene initialization now keeps its fallback rather than repeatedly restarting on status notifications. Deep links past the first journey scene can scroll while that earlier scene is still dormant.


## Persistent controls and shared scroll damping
- Archive controls remain visible and keyboard-accessible throughout the sticky section, including arrival and departure.
- ScrollTrigger measures raw progress only. The scene uses `createCameraProgress(.48)` with continuous velocity, matching the process key; there is no second GSAP scrub tween.
- A C2 story-clock track allocates a longer gallery hold, without increasing section height. Manual rotation uses a slower critically damped spring (omega 8).
- The preceding showroom is now a single laptop and its original-dimension two-tier platform. Original architecture, devices, captions and navigation remain commented out in their source files. The laptop transfer module is unchanged. Magnetic three-slide navigation ignores this single-laptop section.


## Service turntable revision
- Studio preloading begins three viewports before the section, ahead of the transfer window. Canvas size is changed only when dimensions change.
- The page-to-laptop window is now 1.2 viewport heights (formerly 1.6). Showcase and laptop reserves together are 45vh (formerly 160vh), removing 115vh of lead-in travel.
- Handoff progress uses the shared velocity-preserving camera damper. No threshold snaps to the final camera 12px early. The lid hides the source page before the device screen changes; the old full turn during handoff stays commented out.
- A shared turntable shifts right; three scroll windows reveal service copy. Two fast full turns retract and replace laptop/phone/laptop at their midpoint, using a world-space platform-top clipping plane. Original architectural showroom remains commented out.
- Under-platform light is an open widening frustum with a view-dependent transparent shader, plus a soft radial footprint. No bloom/postprocessing or external texture is required.
- Narrow viewports stack the text above the device. Reduced motion and unavailable WebGL render all three services as readable static content.


## Softer motion revision
Reused the key scene's createCameraProgress follower with a .38-second damping setting as the sole animation follower. ScrollTrigger supplies raw target progress; GSAP numeric scrub is removed for this scene. Removed whole-sequence quintic remapping, compression/relaunch, and -340 apex acceleration. Landing and exit use zero-velocity/zero-acceleration curves; the manual carousel spring is reduced from omega 8 to 5.5. Section scroll length is unchanged. Visual timing has not been confirmed in browser.
