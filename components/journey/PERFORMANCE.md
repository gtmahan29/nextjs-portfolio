# Journey rendering and performance

The React shells own layout and accessible content. Three.js lives in dynamically
imported runtimes. `use-scene-runtime.ts` starts preparation before a section enters
view. The showroom prepares through the shared queue after initial page paint,
including its first real frame. Both runtimes remain prepared until route unmount,
so returning cannot flash a loading substitute. Offscreen rendering stops immediately.
Route unmount releases GPU resources. Posters are reserved for WebGL failure;
normal loading never swaps a differently framed poster for the live camera.

## Scroll responsiveness

- `scene-loading.ts` serializes scene setup and yields between expensive stages.
  Pending stages prefer a 160 ms input/scroll quiet window, with a bounded wait so
  continuous scrolling cannot starve loading. Fetches can continue
  while scrolling; rendering an already prepared scene never uses this queue.
- `scene-decoder.ts` shares at most two Meshopt workers. Restrictive environments
  retain the decoder fallback.
- `scene-warmup.ts` submits shaders in batches of eight objects. Three's installed
  version does not set local clipping state in `compileAsync`; a 1-pixel primer
  establishes the matching clipping variant before compilation.
- Showroom warmup includes linear reflection, depth and VSM blur programs. Textures
  upload individually with yields. The showroom does no RAF/render work at rest.
- A shared light rig, static geometry batches and foliage instancing reduce draw
  calls. Only the current/adjacent rooms render during travel. Shadow refreshes are
  limited independently of display refreshes.
- Showroom gesture bounds are measured on layout changes, not every wheel event.
  Entry, each horizontal slide and exit remain separate gestures.

## Laptop screen transfer

The final 240vh of the journey plus its last viewport form a reversible screen-to-
showroom bridge. `laptop-transfer.ts` projects the existing live journey stage onto
the four corners of the first showroom laptop's display with a CSS homography.
The actual baked laptop owns the hinge, camera pullback and rotation. There is no
second model, screenshot capture or canvas-to-texture upload during scrolling.
The page fits within the landscape display without stretching portrait content.
Closing/opening is deterministic from scroll position; the camera finishes at the
existing showroom pose. Reduced motion and unavailable WebGL bypass the bridge.
Device export batches the base and lid separately to preserve the hinge. Verify
projection with `node scripts/check-laptop-transfer.mjs` and hinge closure with the
showroom asset check. The marquee follows the showroom so it cannot split the handoff.
The journey renderer suspends once its screen is hidden by the closing lid and wakes
on reverse scroll; a settled handoff performs no continuing render work.

## Quality

All tiers use antialiasing. Mobile DPR caps are 1.5 (low) and 2 (balanced/high).
Pixel budgets are 1.2 / 2.4 / 4 million, with at least native CSS resolution through
1080p. Low tier removes planar reflections, reduces shadows and uses lighter geometry
before sacrificing edge clarity. Sustained pressure can lower a tier; isolated
startup stalls do not. These are budgets, not guarantees for every GPU.

The baked showroom GLBs total about 3.72 MB on high and 2.15 MB on mobile (42% less).
Mobile rendered geometry is about 44% smaller while preserving device bounds and
room silhouettes. Assets use content hashes and immutable caching. Source factories
remain offline authoring tools, not visitor-time tessellation.

## Asset regeneration

These commands export assets; they do not run a Next.js production build:

```sh
node scripts/export-showroom-assets.mjs
node scripts/export-cloud-asset.mjs
node scripts/export-dashboard-asset.mjs
```

The native canvas library exposes a `data()` method that browsers do not. Exporters
hide this method so GLTFExporter does not mistake a canvas for a DataTexture and
export empty black textures. Texture-content regression assertions cover this case.

## Verification

```sh
npx tsc --noEmit
node scripts/check-scene-performance.mjs
node scripts/check-showroom-scroll.cjs
node scripts/check-showroom-assets.mjs
node scripts/check-dashboard-asset.mjs
```

In development only, `?scenePerf=1` exposes repeatable scene stops and per-canvas
`data-scene-perf` measurements. Reset timing before a transition to inspect the
review navigation's `data-long-tasks` (tasks longer than 50 ms). Measures are CPU
submission times, not GPU timers. First-run shader/driver caches affect comparisons.
Use `sceneQuality=low|balanced|high` only for explicit tier testing, and remove the
override afterwards. `sceneQuality=static` checks the WebGL-independent fallback.
Test real mobile hardware separately; a narrow desktop viewport is not a mobile GPU.

Earlier local baseline: showroom 381 draw calls and continuous rendering at rest.
Current settled frames vary by room/shadow refresh (roughly 125–214 calls), followed
by zero rendering until invalidated. Retain representative screenshots and raw
measurements in `.performance/` when comparing further changes.
