"""Rounded opal caps and continuous RGB diffuser, authored from the supplied references."""
import bpy, math, json
from pathlib import Path
ROOT=Path(r'C:/Users/Maahaan/Desktop/📁 Projects - Web/nextjs-portfolio')
source=(ROOT/'scripts/blender/tight-mechanical-keyboard.py').read_text(encoding='utf-8-sig')
exec(source.split('cache={}')[0])
cache={}
for key in [o for o in assets.objects if o.name.startswith('Key_')]:
 cap=next(o for o in key.children if o.name.startswith('Cap_'))
 mat=cap.data.materials[0];u=float(key['u']);w=u-.035;d=.965
 signature=(u,mat.name)
 if signature not in cache:
  rings=[(w-.08,d-.08,.17,0),(w-.025,d-.025,.19,.025),(w,d,.20,.07),
   (w-.006,d-.006,.205,.14),(w-.04,d-.04,.21,.36),
   (w-.075,d-.075,.215,.46),(w-.12,d-.12,.22,.515),
   (w-.18,d-.18,.22,.54),(w-.25,d-.25,.21,.538),
   (w-.34,d-.34,.19,.518),(max(.3,w-.48),d-.48,.17,.502)]
  rings=[(rw,rd,r,z*1.24) for rw,rd,r,z in rings]
  mesh=mesh_for('Sculpted opal cap '+str(u)+' '+mat.name,rings)
  for p in mesh.polygons:p.use_smooth=True
  # Analytic shoulder normals avoid pinching from long quads and the top ngon.
  normals=[];count=52
  horizontal=[1,1,1,.995,.98,.88,.64,.20,-.12,-.22,0]
  for vertex in mesh.vertices:
   ring=vertex.index//count;rw,rd,radius,z=rings[ring]
   x,y=vertex.co.x,vertex.co.y
   cx=max(-rw/2+radius,min(rw/2-radius,x));cy=max(-rd/2+radius,min(rd/2-radius,y))
   dx,dy=x-cx,y-cy;length=max(math.hypot(dx,dy),1e-8);h=horizontal[ring]
   normals.append((dx/length*h,dy/length*h,math.sqrt(max(0,1-h*h))))
  mesh.normals_split_custom_set_from_vertices(normals)
  mesh.materials.append(mat);cache[signature]=mesh
 cap.data=cache[signature]
 key['travel']=.24
 cap['profile']='soft rolled shoulders, concave top, close packed base'
 for label in key.children:
  if label.name.startswith(('Legend_','Fn legend_')):label.location.z=.507
for name,color in [('Opal white keycaps',(.82,.87,.94,1)),('Glacier blue modifiers',(.57,.68,.81,1))]:
 mat=bpy.data.materials[name];p=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 for link in list(p.inputs['Base Color'].links):mat.node_tree.links.remove(link)
 p.inputs['Base Color'].default_value=color
 p.inputs['Roughness'].default_value=.23
 p.inputs['Coat Weight'].default_value=.38
 p.inputs['Coat Roughness'].default_value=.18
 mat['neutral_color']=color[:3];mat['rgb_wash']=.52
# The recessed plate is a single diffuser beneath the entire key field.
plate=bpy.data.objects['Recessed switch plate']
diff=bpy.data.materials.get('RGB_keybed_diffuser') or bpy.data.materials.new('RGB_keybed_diffuser')
diff.use_nodes=True
p=next(n for n in diff.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
p.inputs['Base Color'].default_value=(.12,.5,.8,1)
p.inputs['Emission Color'].default_value=(.08,.55,1,1)
p.inputs['Emission Strength'].default_value=.7
diff['rgb_strength']=.7
plate.data.materials.clear();plate.data.materials.append(diff)
# Root-space colour gives one spectrum across the keyboard, including the native Blender render.
for mat in [bpy.data.materials['Opal white keycaps'],bpy.data.materials['Glacier blue modifiers'],diff]:
 nodes=mat.node_tree.nodes;links=mat.node_tree.links
 p=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
 tex=nodes.new('ShaderNodeTexCoord');tex.object=root
 separate=nodes.new('ShaderNodeSeparateXYZ');links.new(tex.outputs['Object'],separate.inputs[0])
 remap=nodes.new('ShaderNodeMapRange');remap.inputs['From Min'].default_value=-8.425;remap.inputs['From Max'].default_value=8.425
 links.new(separate.outputs['X'],remap.inputs['Value'])
 ramp=nodes.new('ShaderNodeValToRGB');links.new(remap.outputs['Result'],ramp.inputs[0])
 ramp.color_ramp.elements[0].color=(.015,.75,1,1);ramp.color_ramp.elements[1].color=(1,.2,.72,1)
 ramp.color_ramp.elements.new(.48).color=(.36,.19,1,1)
 links.new(ramp.outputs['Color'],p.inputs['Emission Color'])
 if mat==diff:p.inputs['Emission Strength'].default_value=1.1
 else:
  height=nodes.new('ShaderNodeMapRange');height.clamp=True
  height.inputs['From Min'].default_value=1.02;height.inputs['From Max'].default_value=1.65
  height.inputs['To Min'].default_value=.8;height.inputs['To Max'].default_value=.015
  links.new(separate.outputs['Z'],height.inputs['Value']);links.new(height.outputs['Result'],p.inputs['Emission Strength'])
bpy.data.objects['RGB_Control']['RGB']=1.0
printing=ROOT/'scripts/blender/keyboard-product-legends.py'
exec(compile(printing.read_text(encoding='utf-8-sig'),str(printing),'exec'))
root['revision']='reference-product-11'
root['travel']=.24
for manifest_path in [ROOT/'design/hero-keyboard/keyboard-manifest.json',ROOT/'public/models/hero-keyboard/keyboard-manifest.json']:
 if manifest_path.exists():
  manifest=json.loads(manifest_path.read_text(encoding='utf-8-sig'))
  entries=manifest if isinstance(manifest,list) else manifest.get('keys',[])
  for entry in entries:entry['travel']=.24
  manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
bpy.context.scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
for obj in assets.objects:obj.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/hero-keyboard/hero-keyboard-tight65.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_extras=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'design/hero-keyboard/hero-keyboard-opal65.blend'))
print('Rounded caps and RGB keybed saved.')
