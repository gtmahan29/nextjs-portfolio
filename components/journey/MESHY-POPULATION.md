# Journey residents

The live journey uses `meshy-residents.ts` in place of `createStudioPeople`.
The old procedural character remains available in the isolated character studio.
All six files in `public/3d-models-glb` load once, sequentially, then share their
geometry and materials across independent cloned skeletons. No additional canvas
or animation loop is created. The scene's existing shader queue warms each batch.
People and set dressing are culled against the current camera; their GPU resources
and pending fetches are released on route unmount.

`meshy-population-layout.ts` authors six distinct compositions:

| Station | Composition |
| --- | --- |
| Concept | Two seated participants, a lead, a shared round briefing table and idea board |
| Design | Four designers at facing drafting desks, prototype boards and material samples |
| Architecture | Six dual-monitor coding stations, code review and hardware repair benches |
| Runtime | Three device-testing desks in an L, status boards and a test review pair |
| Scale | Four operations desks, monitoring wall, three racks and maintenance crew |
| Launch | Two independent handover/support circles, lounge chairs and a coffee table |

The full cast contains 62 residents, including handover couriers. Only
three use the director outfit. There are 21 fitted chairs and seven conversations,
each containing two or three people. Furniture varies with its activity. Fixed
furniture and decorations merge by material to limit draw calls.

Chairs fit the actual skinned clothing surface after grounding the feet. The
cushion follows a conservative lower contour under the trousers, and the backrest
clears the complete sampled upper-body dialogue envelope. The seated pelvis and
leg tracks stay anchored while the torso and hands speak. This keeps the chair
contact and planted feet stable across speech/listening transitions. Workers
without a conversation hold a quiet seated or standing pose. Speaking
uses complete exported clips, with a per-group schedule, varied pauses and short
transitions to a quiet listening pose. Seated participants use the seated speaking
clip. Groups have independent clocks; only one participant in a given group speaks.
The four unrigged coral characters occupy an open place beside a conversation,
face its participants, and gently turn toward the active speaker. They never take
a speaking turn or create an artificial pause in the group's schedule.

Walking speed is measured from the backward velocity of the supporting ankle in
the exported animation. The resulting speed is multiplied by the model's scale and
the same playback rate used by its mixer. Each walker has an authored home,
purpose, destination, viewing direction and independent dwell/rest timings.
They walk to a phase-specific board or rack, face it for 5–12.5 seconds, return
along their route, and rest before another visit. Couriers make short local trips from a delivery spot to their team's
board or rack before returning. Idle replaces the gait throughout stops.

Navigation retains individual prop bounds before decor batching, includes fitted
furniture, standing colleagues and the live scene's meshes/instances, and reserves
central display space before optional GLBs arrive. A* paths are simplified only
when the whole segment clears obstacles inflated by body clearance; straight
segments cannot cut through a thin whiteboard. Blocked routes wait and retry.
Overlapping trips reserve their complete outbound/return corridor, so another
walker waits until it clears. Trips continue outside the camera view to release
those reservations. Reduced motion freezes walking and speech.
Generated normal/bump maps are removed and surfaces use a matte finish. Color
atlases use linear filtering without mipmaps so small, adjacent UV islands cannot
bleed into one another at journey viewing distance. Clothing colors, geometry and
skin weights remain authored. Characters cast floor shadows without receiving
shadow-map acne on their clothes. A development-only original/repaired comparison
is available at `/journey/meshy`, using identical lighting and pose on both sides.

Validation: `npx tsc --noEmit` and `node scripts/check-meshy-residents.mjs`.
The CPU check uses actual mesh/skin/animation data, with image decoding omitted. It
checks all phases, staffing ratios, fitted chairs, unique compositions, independent
skeletons, real speech bone changes, non-overlapping turns, path speed, supporting
foot slip, thin-board detours, district/prop clearance, destination dwell and return, reduced motion, culling and cancellation/cleanup. Chair checks scan the
actual posed vertices against the cushion, backrest, frame and desk volumes, both
at rest and during seated speech. `/journey/meshy` also includes an interactive
chair inspection mode with orbit controls. Browser review controls
for all six stations are available only in development at `/journey?scenePerf=1`.
