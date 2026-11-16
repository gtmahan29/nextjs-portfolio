# Journey performance correction

- Removed the loading overlay; server-rendered introduction remains readable during GPU setup.
- Removed delayed unlockReview automatic navigation. Loading never scrolls the visitor.
- Removed large-wheel-distance snap and restart snap; preserved first-paint synchronization.
- Balanced is the default GPU budget; high remains an explicit override.
- Skip linear reflection shader warmup when no visible reflector exists.
- No eager download/compile of both later dioramas at startup.
- Warm the main journey three viewports ahead.
- Pause the campus renderer once the DOM showcase settles; scroll wakes it.
- Replace the per-batch 32ms scroll penalty with scheduler.yield (task fallback).

Browser debugger synchronization is currently timing out. These source changes are not a substitute for a full-device frame-time profile; no claim of verified full-page smoothness.


## October 25: ending render budget
- Honor maxPixels exactly (previous calculation silently raised the low-tier budget).
- Services render visibility uses the actual viewport rather than a 200% margin; loading remains early.
- Stop hidden campus/character rendering during the laptop content handoff using explicit screenOccluded state.
- Apply campus isolation once per object, preserving late-added objects and reverse restoration.
- Remove redundant full folder matrix traversal outside diagnostics.
- Cache service motion keys and avoid repeated unchanged accessibility attribute writes.
- Initialize folder ResizeObserver dimensions to avoid an unnecessary startup global refresh.
- Installed renderer does not expose transmissionResolutionScale; that attempted option was removed rather than forced through a type cast.

TypeScript passes. Dev server restarted on port 3001; browser navigation still timed out, so no measured frame-rate or verified smoothness claim.
