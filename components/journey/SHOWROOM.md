# Lumen showroom refinement

The supplied HTML scene is integrated into studio-hall.tsx and
lumen-showroom-scene.js, with scoped styles in app/journey/journey.css. Existing
local laptop/phone mockups and FORM previews remain. All three devices now have
the same height and rest on the same two-tier circular podium.

The camera is raised to y=7 and targets the combined device/podium center
[local x=1, y=3.286, z=-29.8]. It moves to the right by 64 world units per room;
rooms are clipped at their shared boundary so they join without overlap.
All stops use identical framing. Reduced motion omits the travel arc.

Lighting uses independent solid paint albedo and a coarse reference-derived
indirect irradiance field. Vegetation and its photographed shadows are excluded
from that field. Soft shadows are cast by the actual procedural plant meshes
through local warm spotlights. The floating moon, old painted-light rectangle,
and oversized wall-cast wedges were removed. Floor reflections remain real planar
passes. Wall paint receives only the nearby plant light shadows; the broad key
still casts device/floor shadows. Dithered irradiance encoding prevents wall banding.
This is a real-time interpretation of one reference view, not an exact
photographic reconstruction or measured recovery of the reference's lights.

The shared Lenis input handler consumes each showroom gesture once. A long
incoming wheel lands on slide one; momentum cannot move it further. Fresh gestures
advance one stop, and a separate gesture exits either boundary. Wheel timestamps
separate actual input timing from render delays. Touch and keyboard use the same
gate. Scrolling elsewhere and explicit anchor navigation retain their normal behavior.

Validation: npx tsc --noEmit; node scripts/check-showroom-scroll.cjs; live browser
fixture with ten 4000px wheel inputs per gesture. Desktop stop centers project to
NDC [0,0], equal podium diameters are 9.04, and device contact gaps are zero.
No production build was run.

Review routes: /journey?showroomReview=front (reference camera without devices),
/journey?showroomReview=devices&slide=0 (or 1/2), and
/journey?showroomScrollReview=1 (isolated wheel-test controls).
Normal experience: /journey#studio.
