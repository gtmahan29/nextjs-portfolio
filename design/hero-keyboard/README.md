# Opal 65 — hero keyboard

Reference: supplied white 65% keyboard, glacier-blue modifiers, orange Escape, optical cyan-to-pink RGB; hero Start button materials.

## Editable Blender model

`hero-keyboard-opal65.blend`

- Open the scene **Hero Keyboard — Opal 65**.
- Select **RGB_Control**. Under Object > Custom Properties set **RGB** to `0` (off) or `1` (on). Intermediate values dim the illumination.
- The optical perimeter, a continuous body-wide RGB wash and the studio's coloured bounce lights use that one control.
- Every key is a **Key_CODE** empty with a cap and printed legend. Move the empty on local Z to press it; full travel is `0.105` key units.
- Frame 1 is the neutral pose. Frames 38–150 contain physical key travel spelling `MAKE IT REAL.` including the spacebar.
- The original Blender scene is retained; studio lights and product camera occupy a separate render-only collection.

## Web asset

`../../public/models/hero-keyboard/hero-keyboard-opal65.glb`

68 independent key roots. Export size is approximately 0.87 MB. Geometry is expressed in key units: one key pitch is 19.05 mm; scale the model by `0.01905` when the scene uses metres. Blender Z becomes glTF Y. The key map is in `keyboard-manifest.json`.

`components/journey/opal-keyboard-rig.ts` supplies smooth RGB on/off and per-key press controls. It uses the GLB's actual materials and key roots. The actual GLB is rendered by `components/journey/opal-keyboard.tsx` in the hero, with RGB enabled.

## Renders

- `keyboard-rgb-on.png`
- `keyboard-rgb-off.png`

Both are native Blender Cycles renders with transparent backgrounds, the same camera and the same lighting. Only RGB is changed.

## Rebuild

Run `scripts/blender/build-hero-keyboard.py` inside Blender. It creates a new scene and preserves existing scene contents. Apply `scripts/blender/refine-hero-keyboard.py` after the generator for the planar rectangular shell and continuous RGB wash. The packaged GLB is the final exported asset.

## Web sharpness

The hero uses antialiased WebGL rendering with 1.75–2x pixel density (bounded to 3.5 million pixels), printed mesh legends, a level frontal orthographic camera at the close-up, and no depth-of-field or blur filter. Individual key light rings have been removed. The body-wide colour wash is continuous in model coordinates and shares the RGB control.

Latest native render: `keyboard-rgb-continuous.png`. The current model uses planar rectangular case walls and low-opacity cyan/violet/pink colour across the entire keyboard; the earlier on/off product images predate that refinement.


## Tight mechanical revision

Current website asset: `public/models/hero-keyboard/hero-keyboard-tight65.glb` (about 741 KB).

Run `scripts/blender/tight-mechanical-keyboard.py` after the two original authoring scripts. It preserves the white/blue/orange palette and independent key roots, replaces the bulbous caps with straight tapered mechanical caps, and reduces the base seam to 0.018 pitch units. Legends are fitted in both axes. The optical band and shell use matching rectangular outlines and planar long walls.

The web renderer uses a centered orthographic camera, 2.5–3x rendering capped at 6 million pixels, and authored RGB on-state colors/emission. RGB stays on; the continuous wash is shared across the whole keyboard. The previous `hero-keyboard-opal65.glb` remains available as the earlier revision.


## Product lighting and key feedback

After the tight mechanical revision, run `scripts/blender/polish-keyboard-normals.py` to give the bevels analytic corner normals while retaining planar straight sides. The website presents the keyboard closer, with one continuous physical optical diffuser shader. Each key cap owns its contact material and receives a blue/violet accent proportional to its physical travel. Repeated letters are combined by maximum contact, so a later idle instance cannot cancel an earlier active press.

## Current reference product revision

Run `scripts/blender/reference-soft-keyboard.py` after the original enclosure refinement. This supersedes the tight cap profile and invokes `keyboard-product-legends.py` automatically. The caps have rolled shoulders, a shallow dish and analytic normals. Mesh printing is regenerated at readable sizes, then every printing vertex is projected onto the cap surface with a 0.004 unit clearance. This prevents labels disappearing inside the curved tops. The native RGB keybed and continuous perimeter remain on.

The web renderer uses local studio reflection cards, a centered camera and lower-side RGB spill. The neutral cap tops retain their white or glacier blue material. The current asset URL revision is `product-print-12`; physical key travel and contact color remain independent for all 68 keys.

The `soft-travel-13` revision raises the cap profile by 24% and increases physical travel to 0.24 key units. Ten scroll contacts replace the former 30 within the same construction interval. Each contact uses a quintic press, a short seated pause and a slower quintic release, with zero endpoint speed and acceleration. Reverse scrolling retraces the same motion.
