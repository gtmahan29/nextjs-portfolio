"""Rebuild legible key printing and conform it to the sculpted caps."""
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

assets=bpy.data.collections['KEYBOARD — export']
font=bpy.data.fonts.load('C:/Windows/Fonts/segoeui.ttf',check_existing=True)
symbol_font=bpy.data.fonts.load('C:/Windows/Fonts/seguisym.ttf',check_existing=True)
ink=bpy.data.materials['Legend — slate blue']
p=next(n for n in ink.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
p.inputs['Base Color'].default_value=(.035,.052,.08,1)
p.inputs['Roughness'].default_value=.83
ink['rgb_wash']=0.0
symbols={'1':'1 !','2':'2 @','3':'3 #','4':'4 $','5':'5 %','6':'6 ^','7':'7 &','8':'8 *','9':'9 (','0':'0 )','Minus':'− _','Equal':'= +','BracketLeft':'[ {','BracketRight':'] }','Backslash':'\\ |','Semicolon':'; :','Quote':"' \"",'Comma':', <','Period':'. >','Slash':'/ ?'}
printed=0
for key in [o for o in assets.objects if o.name.startswith('Key_')]:
 code=str(key['code']);cap=next(c for c in key.children if c.name.startswith('Cap_'))
 surface=BVHTree.FromPolygons([v.co.copy() for v in cap.data.vertices],[list(p.vertices) for p in cap.data.polygons],all_triangles=False)
 for old in list(key.children):
  if old.name.startswith(('Legend_','Fn legend_')):bpy.data.objects.remove(old,do_unlink=True)
 text=symbols.get(code,str(key.get('legend','')))
 if code=='Space':continue
 lines=[('Legend_',text,.045)]
 if code in list('1234567890')+['Minus','Equal']:
  index=(list('1234567890')+['Minus','Equal']).index(code)+1
  lines.append(('Fn legend_','F'+str(index),-.23))
 for prefix,body,y in lines:
  curve=bpy.data.curves.new(prefix+code,'FONT');curve.body=body
  curve.font=symbol_font if any(ord(c)>1000 for c in body) else font
  curve.align_x='CENTER';curve.align_y='CENTER';curve.size=1;curve.resolution_u=12
  curve.space_line=.9
  label=bpy.data.objects.new(prefix+code,curve);assets.objects.link(label);label.parent=key
  bpy.ops.object.select_all(action='DESELECT');label.select_set(True);bpy.context.view_layer.objects.active=label
  bpy.ops.object.convert(target='MESH');label=bpy.context.object
  verts=label.data.vertices
  if not verts:continue
  lo=Vector(tuple(min(v.co[i] for v in verts) for i in range(3)));hi=Vector(tuple(max(v.co[i] for v in verts) for i in range(3)))
  center=(lo+hi)/2;size=hi-lo
  height=.12 if prefix.startswith('Fn') else .25 if len(body)==1 else .19
  if '\n' in body:height=.32
  width=max(.4,float(key['u'])*.70-.09)
  if code in ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown']:width=.28;height=.23
  if code in ['Quote','Semicolon','Comma','Period']:height=.105
  scale=min(height/max(size.y,.001),width/max(size.x,.001))
  for vertex in verts:
   vertex.co=(vertex.co-center)*scale;vertex.co.y+=y
   hit,normal,_,_=surface.ray_cast(Vector((vertex.co.x,vertex.co.y,2)),Vector((0,0,-1)))
   vertex.co.z=(hit.z if hit else .54)+.004
  label.data.materials.append(ink);label.data.update();label['surface_print']=True
  printed+=1
print('Conformed readable printing:',printed)
