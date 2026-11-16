# Unlock chapter

The current concierge composition leads into a continuous scroll chapter in the
existing journey renderer. Retain the final cube's visual scale, reflective gold
and thin amber/ivory practical lines. Match the provided key's circular clover
head, four light nodes, collared shaft and stepped bit; match the door's symmetric
gold frame, two frosted inset panels and central circular keyhole.

Blender authors the precise mechanical parts; no new paid Meshy call is planned.
Door leaves rotate about their exterior vertical jambs. A lock socket at the
center accepts the key tip; insertion and a quarter turn precede opening.

| Scroll chapter | Action | Composition |
| --- | --- | --- |
| 0–15% | Concierge copy and surrounding orbits fade | Cube enlarges and centers |
| 15–35% | Cube completes its turn, lid lifts, opposing walls unfold from their bottom edges | Bottom stays fixed; key revealed inside |
| 35–64% | Key descends on a curved rotating path | Front-facing camera translates vertically into the next section, at constant depth |
| 62–74% | Key aligns and inserts into the socket | Door center stays readable |
| 76–83% | Only the key turns 90 degrees about its shaft | Escutcheon and keyhole stay fixed |
| 84–95% | Two door leaves open inward | Test content appears behind them |
| 94–100% | Hold readable new chapter | New chapter becomes laptop screen source |

One deterministic, reversible normalized scroll state drives all these actions.
No independent animation timers, new WebGL context, or camera teleport. Responsive
framing fits both leaves to the viewport width while keeping the lock round. Key descent stays on a constant depth plane; only the insertion phase changes its depth. Reduced motion skips spins and retains the unlocked
content. HTML copy remains semantic and is retained in WebGL fallback.

Framing reserves at least 42 world units across the screen to keep the complete
opened cube inside the view. The door is sized to that projection and remains
stationary in the next section. Door leaves are 1.85 viewport heights tall so
their upper and lower rails stay outside the view, including while opening.
The lock keeps its original screen height and circular proportions. Section
spacing accounts for the taller silhouette. It has no opacity reveal or visibility switch during the
handoff; vertical scrolling exposes it naturally. The cube finishes fading
before the doorway enters the frame. Width/depth scaling is equal so
the leaves turn rigidly inward. The keyhole plate retains its authored rotation;
the key turns independently around its aligned shaft axis. The shaft is exactly
parallel to the bore before insertion; there is no tilt in the docking pose.
Flight is composed around the key's visible center so spins cannot throw it out
of the frame or sweep its bow into the lock before docking.

Assets: golden-cube.glb (existing), golden-key.glb, golden-doors.glb. All mechanical
parts have stable names, and the key tip is its origin. The saved unlock-assets.blend is the authoritative refined asset source. The keyhole is an actual
opening in the lock plate. The door body is reconstructed to separate leaves;
gold and frost are independent material layers. Use the existing room environment
and directional lighting for the key and sculpted trim. Reference-projected textures preserve the frosted panes and polished frame tones on separate, moving 3D leaves; no additional full-frame bloom or transmission pass.
