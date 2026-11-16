# Hero → studio

Goal: introduce the first station as the physical starting point of a product, with no cut between the introduction and the journey.

Rules: native scrolling, the existing renderer and camera, no new assets or dependencies, no production build, reversible motion, an explicit skip link. Preserve the later five station views and their existing travel windows; center the first station.

Bar: the opening belongs to the hero; the final frame centers station one continuously with the introduction. Copy never overlaps the focal object. Review desktop, mobile, reverse scroll, skip, and console errors.

## Direction

Quiet, tactile, deliberate. A luminous gold core inside six transparent amber glass panels with rounded, thick perimeter rims. Six smaller gold and ivory cubes form an asymmetric constellation, separate during opening, and fade before arrival. Use the page's existing typeface, large tight display type, muted reading text, and generous empty space. Marketing copy stays in semantic HTML beside the object; the core is the visual reveal.

Primary renderer: the existing Three.js world. HTML supplies semantic copy, with transform and opacity choreography. No video, generated imagery, or second WebGL context.

Reference: [Apple's MacBook Pro page](https://www.apple.com/macbook-pro/) for restrained copy and object-led storytelling; [Apple Design skill](C:/Users/Maahaan/.agents/skills/apple-design/SKILL.md) for reversible, interruptible motion.

## Beat ledger

| Beat | Copy | Visual action | Scroll |
| --- | --- | --- | --- |
| Question | What should we build? / It starts with a conversation. | The real illuminated cube is visible on the paper field; the station is concealed. | 0–10% |
| Open | One idea. Every detail. | Six intact glass panels move 2.65 units outward, tilting only 0.06 radians as the camera makes room. | 10–28% |
| Reveal | Design, engineering, and launch. Together. | The independent luminous core becomes clearly separated from the glass shell. | 28–47% |
| Close | — | Panels reunite; the surrounding copy fades. | 47–65% |
| Turn | — | The closed cube turns once, with a slight tilt and velocity-driven motion arcs. | 65–85% |
| Arrival | Existing station-one content | The same cube settles as the paper dissolves and the camera reaches station one. | 84–100% |

The introduction spans 3.6 viewports on desktop and 3.2 on small screens. Quintic scroll tracks make panel and rotation endpoints smooth and reversible. Camera damping carries velocity through reversals. Exponential distance interpolation avoids a fast apparent zoom near the cube. The journey route stays at its starting point throughout the introduction.

Reduced motion bypasses the camera introduction. Skip targets the start of the six-station route. Rendering still pauses off-screen and in hidden tabs. No asset-generation prompts or third-party media are needed.

The paper field is a two-triangle screen-space mesh in the existing canvas, drawn before the cube. Its opacity reveals the station while the cube remains continuously visible. It uses a separate camera layer to stay out of the floor reflection. The six panes share one continuous, watertight lens geometry and a dielectric material. Their thick rolled rims are integral geometry, with no separate metal frames. Object-space gradients keep both closed and open faces warm; a shared opening uniform controls transparency and the soft appearance of their inner surfaces. Curvature and derivative-bounded highlights supply the bright glass edges. The surrounding cubes share one geometry and two materials and stay hidden at other stations. A 128px radial sprite supplies a soft halo; eight corner glows share one 64px texture and material. Three thin golden arcs respond to angular velocity and fade when motion stops. No bloom, transmission framebuffer, extra render loop, or extra renderer is added to the journey. Scene cleanup disposes shared resources once.

The user accepted a lightweight optical approximation of the supplied img2threejs references: transparency, environment reflections and emission approximate glass; photoreal refraction and floor caustics are not reproduced. The actual model factory is `golden-glass-cube.ts`; `.img2threejs/golden-cube/generated.ts` is the staged spec generator artifact, not the live implementation. An isolated `/journey/cube` development study is never imported into the journey. It exposes four angles, three lighting presets, geometry-only diagnostics, explode/reassemble, core-only visibility and ray picking. The model alone measures 9,246 triangles and 16 draw calls; that is a model budget, not a whole-device FPS guarantee.

## Verification

- TypeScript (`npx tsc --noEmit`) and focused Next lint passed. No production build.
- The continuous-lens revision was visually reviewed at 390×844 and 1280×720: closed opening, separated core/open hold, closing, turning, arrival, desktop reverse scroll and mobile skip. Mobile puts the cube below the copy. Four isolated orbit views, three lighting presets, a same-geometry clay silhouette capture and ray selection were also checked. Captures and staged reviews live in `.img2threejs/golden-cube`.
- Independent code review checked introduction height, route offsets, camera endpoints, and lifecycle. Inactive copy is hidden from assistive technology; WebGL construction failure exposes the station descriptions in ordinary flow.
- No new media requests, libraries, renderers, or WebGL contexts. Browser console contains a root-layout theme hydration warning (`html` class/style attributes); no new journey runtime errors were observed. Reduced-motion and WebGL-failure behavior were reviewed in code, not physically emulated in this browser.

The earlier accepted metal-frame renders are superseded; their evidence is retained under `prior-review`. The latest open-face correction keeps 90% of the inner illumination during separation and reduces open center opacity to 0.18, preventing the dark, metallic appearance noted in the user screenshot. Reference likeness is approximate, not a claim of photoreal parity.

Closing/centering revision: pane emission has a warm floor during assembly, avoiding the dark band exposed in the intermediate pose. The projection offset eases to zero during intro progress 0.58–0.76 and stays zero through the first station hold. It returns to the later station framing during route progress 0.18–0.28, with projection updates keyed to the offset as well as FOV. Desktop and mobile centered handoffs were visually checked.
