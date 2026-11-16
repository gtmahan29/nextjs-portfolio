"""Re-export the refined mechanical assets from their authoritative Blender file.

Run inside Blender. The original create-unlock-assets.py creates the base design;
unlock-assets.blend also contains the later pierced lock and reference UV refinements.
"""
import bpy
from pathlib import Path

output = Path(__file__).resolve().parents[1] / 'public' / 'golden-cube'
bpy.ops.wm.open_mainfile(filepath=str(output / 'unlock-assets.blend'))
for name, filename in [('GoldenKey', 'golden-key.glb'), ('GoldenDoors', 'golden-doors.glb')]:
    root = bpy.data.objects[name]
    owning_scene = next(scene for scene in bpy.data.scenes if root.name in scene.objects)
    bpy.context.window.scene = owning_scene
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(output / filename), export_format='GLB',
        use_selection=True, use_active_scene=True, export_extras=True, export_animations=False)
