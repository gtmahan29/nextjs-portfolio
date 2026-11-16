"""Reprofile the authored keyboard to tightly packed mechanical caps, keeping its palette and rig."""
import bpy, math
from pathlib import Path
ROOT=Path(r'C:/Users/Maahaan/Desktop/📁 Projects - Web/nextjs-portfolio')
assets=bpy.data.collections['KEYBOARD — export']
root=bpy.data.objects['Hero_Keyboard_Opal_65']

def perimeter(w,d,r,n=12):
 points=[]
 for x,y,a in [(w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180),(w/2-r,-d/2+r,270)]:
  for i in range(n+1):
   t=math.radians(a+i*90/n);points.append((x+r*math.cos(t),y+r*math.sin(t)))
 return points

def mesh_for(name,rings):
 n=len(perimeter(*rings[0][:3]));verts=[(x,y,z) for w,d,r,z in rings for x,y in perimeter(w,d,r)]
 faces=[tuple(reversed(range(n)))]
 for j in range(len(rings)-1):
  faces.extend((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for i in range(n))
 faces.append(tuple((len(rings)-1)*n+i for i in range(n)))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
 for face in mesh.polygons:
  face.use_smooth=len(face.vertices)==4 and abs(face.normal.x)>.001 and abs(face.normal.y)>.001
 return mesh
cache={}
for key in [o for o in assets.objects if o.name.startswith('Key_')]:
 cap=next(o for o in key.children if o.name.startswith('Cap_'))
 u=float(key['u']);mat=cap.data.materials[0];w=u-.018;d=.982
 ck=(u,mat.name)
 if ck not in cache:
  rings=[(w-.024,d-.024,.075,0),(w,d,.085,.025),(w-.018,d-.018,.085,.09),(w-.09,d-.09,.075,.405),(w-.13,d-.13,.065,.455),(w-.17,d-.17,.05,.478),(w-.22,d-.22,.04,.465)]
  mesh=mesh_for('Precision mechanical cap '+str(u)+' '+mat.name,rings);mesh.materials.append(mat);cache[ck]=mesh
 cap.data=cache[ck];cap['profile']='tight mechanical / planar sides / shallow dish';cap['base_gap']=.018
 for legend in key.children:
  if legend.name.startswith(('Legend_','Fn legend_')):
   if legend.type=='MESH' and len(legend.data.vertices):
    from mathutils import Vector
    verts=legend.data.vertices
    center=Vector(tuple((min(v.co[i] for v in verts)+max(v.co[i] for v in verts))/2 for i in range(3)))
    for v in verts:v.co-=center
    legend.data.update()
   # Absolute desired dimensions make this refinement safe to run repeatedly.
   bpy.context.view_layer.update()
   if legend.dimensions.x>0:
    if legend.name.startswith('Fn legend_'):target=.075
    elif len(str(key.get('legend','')))==1:target=.245
    else:target=min(.72,max(.22,len(str(key.get('legend','')))*.047))
    maximum=.105 if legend.name.startswith("Fn legend_") else .265 if len(str(key.get("legend","")))==1 else .135
    if key.name in ['Key_Comma','Key_Period','Key_Quote','Key_Semicolon'] and not legend.name.startswith('Fn legend_'):maximum=.055 if key.name=='Key_Period' else .11
    factor=min(target/legend.dimensions.x,maximum/max(legend.dimensions.y,.001))
    legend.scale.x*=factor;legend.scale.y*=factor
   legend.location.z=.482
# Match the optical band's corner radius to the rectangular shell; keep long edges planar.
band=bpy.data.objects['RGB optical perimeter'];mats=list(band.data.materials)
band.data=mesh_for('Parallel-sided optical perimeter',[(16.80,5.75,.28,0),(16.85,5.80,.30,.025),(16.85,5.80,.30,.16),(16.80,5.75,.28,.20)])
for mat in mats:band.data.materials.append(mat)
# Long walls have extra samples for smooth global colour, rather than a single flat material.
# Rebuild those strips with linear interpolation along each straight span.
rings=[(16.80,5.75,.28,0),(16.85,5.80,.30,.025),(16.85,5.80,.30,.16),(16.80,5.75,.28,.20)]
def dense(w,d,r):
 points=perimeter(w,d,r);out=[]
 for i,a in enumerate(points):
  b=points[(i+1)%len(points)];count=max(1,math.ceil(math.dist(a,b)/.20))
  out.extend((a[0]+(b[0]-a[0])*k/count,a[1]+(b[1]-a[1])*k/count) for k in range(count))
 return out
# All rings must share topology, with identical samples on each straight span.
base=perimeter(16.85,5.80,.30);counts=[max(1,math.ceil(math.dist(a,base[(i+1)%len(base)])/.20)) for i,a in enumerate(base)]
verts=[]
for w,d,r,z in rings:
 pts=perimeter(w,d,r)
 for i,a in enumerate(pts):
  b=pts[(i+1)%len(pts)];verts.extend((a[0]+(b[0]-a[0])*k/counts[i],a[1]+(b[1]-a[1])*k/counts[i],z) for k in range(counts[i]))
n=sum(counts);faces=[]
for j in range(3):faces.extend((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for i in range(n))
mesh=bpy.data.meshes.new('Continuous optical strips');mesh.from_pydata(verts,[],faces);mesh.update();band.data=mesh
for mat in mats:mesh.materials.append(mat)
for poly in mesh.polygons:
 x=sum(mesh.vertices[i].co.x for i in poly.vertices)/len(poly.vertices);poly.material_index=max(0,min(31,round((x/16.85+.5)*31)))
 poly.use_smooth=abs(poly.normal.x)>.001 and abs(poly.normal.y)>.001
for mat in mats:
 p=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 c=tuple(mat.get('rgb_color',(.3,.6,1)))
 p.inputs['Emission Color'].default_value=(*c,1)
 if mat.node_tree.animation_data:
  for fc in mat.node_tree.animation_data.drivers:
   if 'Emission Strength' in fc.data_path:fc.driver.expression='rgb*1.5'
 mat['rgb_strength']=1.5
ink=bpy.data.materials['Legend — slate blue'];p=next(n for n in ink.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Base Color'].default_value=(.009,.017,.032,1)
root['keycap_profile']='mechanical, 0.018 unit seam, planar shell';root['revision']='tight65-v4'
bpy.data.objects['RGB_Control']['RGB']=1.0
scene=bpy.context.scene;scene.frame_set(1);bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for obj in assets.objects:obj.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/hero-keyboard/hero-keyboard-tight65.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_extras=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'design/hero-keyboard/hero-keyboard-opal65.blend'))
print('Saved tight mechanical keycaps, rectangular optical perimeter and 68 independent key controls.')
