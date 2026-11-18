The last two Journey stations use authored Blender models and scroll-controlled Three.js rigs.

- Phase five loads `public/models/journey/capacity-bay.glb`, the Meshopt-compressed export of `design/journey/capacity-bay.blend`. Its named rack, hatch, lamp, and tray pivots are driven by `components/journey/capacity-bay.ts`.
- Phase six loads the Meshopt desk and folio from `public/models/journey/release-desk.glb` and mounts the same MacBook and iPhone assets as the showroom. The rig in `components/journey/release-desk.ts` opens the devices, reveals production checks on the laptop screen, and opens the ownership folio as the document scrolls. The Blender source is `design/journey/release-desk.blend`.
- Both models load ahead of their station, warm their shaders before mounting, share the Journey lighting, and dispose their resources on unmount. In-flight model requests abort on unmount.
- Phase six holds the camera straight on across three scroll beats, with a 17 degree desktop lens and wider framing on narrow screens.
- Sora and the snowy house are not mounted.

The application has no runtime or build dependency on the donor folders 3d-models and 3d-model-3. They can be removed. scripts/import-phase-models.mjs is a one-time migration utility and needs the donor sources only if deliberately rerun; it is not part of npm build.

When editing either model, retain the named pivots when exporting the equipment collection from Blender. Compress the GLB with `compressSceneAsset(glb, { quantize: false })` from `scripts/scene-asset-codec.mjs` to preserve the node transforms.

Development-only `?journeyPerf=1` publishes rolling CPU render-work percentiles and draw/triangle counts on the journey canvas's `data-journey-perf` attribute. Counts include shadow/reflection passes; averages account for their throttled refresh. These are not GPU timings or Lighthouse scores. The profiling path and old global camera debug object are absent from normal rendering.
