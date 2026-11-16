These are self-contained, vendored factories for the last two journey stations.

- Phase five loads `public/models/journey/dashboard.glb`, a losslessly compressed, indexed export of the finished network diorama. Its ten material batches preserve the refined panels, rounded platforms, amber conduits, triangle topology and bounds. Polygon clipping and geometry construction run offline, not in the browser.
- Phase six uses the cloud diorama, measured layout and procedural device/plant surfaces. Colors use modern Three.js color management. Device textures use one quarter of the original pixel count.
- Both models preload ahead of their station, warm their shaders before mounting, share scene lighting/environment, and dispose their textures, geometries and materials on unmount. The dashboard request aborts on unmount.
- The sixth-phase camera reaches the reference's 44.034 degree azimuth and 18.288 degree elevation before arrival. The camera stays farther back at arrival, using an 11 degree desktop field of view and a wider 23 degree mobile view. Desktop models sit to the right of the text.
- Sora and the snowy house are not mounted.

The application has no runtime or build dependency on the donor folders 3d-models and 3d-model-3. They can be removed. scripts/import-phase-models.mjs is a one-time migration utility and needs the donor sources only if deliberately rerun; it is not part of npm build.

To regenerate the dashboard from its vendored factory, run `node scripts/export-dashboard-asset.mjs`. Check topology/bounds and local CPU load time with `node scripts/check-dashboard-asset.mjs`. These are standalone asset operations, not a production application build.

Development-only `?journeyPerf=1` publishes rolling CPU render-work percentiles and draw/triangle counts on the journey canvas's `data-journey-perf` attribute. Counts include shadow/reflection passes; averages account for their throttled refresh. These are not GPU timings or Lighthouse scores. The profiling path and old global camera debug object are absent from normal rendering.
