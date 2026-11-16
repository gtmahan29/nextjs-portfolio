"""Product shading refinement, after tight-mechanical-keyboard.py."""
import bpy, math
from pathlib import Path
assets=bpy.data.collections['KEYBOARD — export'];done=set()
for obj in assets.objects:
 if not obj.name.startswith('Cap_') or obj.data.name in done:continue
 mesh=obj.data;done.add(mesh.name);n=52
 # Analytic corner normals keep the long walls planar, and roll cleanly into the key's lip.
 horizontal=[1,1,.997,.94,.68,.22,0]
 normals=[]
 for v in mesh.vertices:
  ring=v.index//n;vertices=mesh.vertices[ring*n:(ring+1)*n]
  half_x=max(abs(k.co.x) for k in vertices);half_y=max(abs(k.co.y) for k in vertices)
  radius=[.075,.085,.085,.075,.065,.05,.04][ring]
  x,y=v.co.x,v.co.y;cx=max(-half_x+radius,min(half_x-radius,x));cy=max(-half_y+radius,min(half_y-radius,y))
  dx,dy=x-cx,y-cy;length=math.hypot(dx,dy);h=horizontal[ring]
  normals.append((dx/max(length,1e-8)*h,dy/max(length,1e-8)*h,math.sqrt(max(0,1-h*h))))
 for poly in mesh.polygons:poly.use_smooth=True
 mesh.normals_split_custom_set_from_vertices(normals)
# Lower the surface glare so printed legends and the profile remain visible.
for name in ['Opal white keycaps','Glacier blue modifiers','Tangerine Escape']:
 m=bpy.data.materials[name];p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 p.inputs['Roughness'].default_value=.30;p.inputs['Coat Weight'].default_value=.23;p.inputs['Coat Roughness'].default_value=.22
root=Path(r'C:/Users/Maahaan/Desktop/📁 Projects - Web/nextjs-portfolio')
bpy.context.scene.frame_set(1);bpy.ops.object.select_all(action='DESELECT')
for obj in assets.objects:obj.select_set(True)
bpy.context.view_layer.objects.active=bpy.data.objects['Hero_Keyboard_Opal_65']
bpy.ops.export_scene.gltf(filepath=str(root/'public/models/hero-keyboard/hero-keyboard-tight65.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_extras=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'design/hero-keyboard/hero-keyboard-opal65.blend'))
print('Analytic bevel normals saved.')
