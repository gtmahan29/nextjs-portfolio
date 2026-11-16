"""Blender: key and independently hinged doors from supplied geometric references."""
import bpy, math, json
from mathutils import Vector
from pathlib import Path
BASE=Path(r'C:\Users\Maahaan\Desktop\📁 Projects - Web\nextjs-portfolio')
OUT=BASE/'public'/'golden-cube';OUT.mkdir(parents=True,exist_ok=True)
scene=bpy.data.scenes.new('Golden Key and Doors');bpy.context.window.scene=scene
collection=bpy.data.collections.new('Unlock Assets');scene.collection.children.link(collection)
def move(o):
 for c in list(o.users_collection):c.objects.unlink(o)
 collection.objects.link(o)
def mat(name,color,metal,rough,emit=0):
 m=bpy.data.materials.new(name);m.use_nodes=True
 n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 for k,v in [('Base Color',(*color,1)),('Metallic',metal),('Roughness',rough),('Coat Weight',.6),('Emission Color',(*color,1)),('Emission Strength',emit)]:n.inputs[k].default_value=v
 return m
gold=mat('Unlock polished gold',(1,.53,.105),1,.16)
bronze=mat('Unlock recessed gold',(.36,.18,.045),1,.24)
ivory=mat('Unlock ivory light',(1,.85,.5),.3,.17,2)
frost=mat('Door frosted pearl',(.88,.84,.73),.2,.37)
def empty(name,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(name,None);collection.objects.link(o);o.parent=parent;o.location=loc;return o
def bevel(o,width=.018):
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 m=o.modifiers.new('Soft precision edges','BEVEL');m.width=width;m.segments=3
 bpy.ops.object.modifier_apply(modifier=m.name)
 return o
def box(name,loc,size,material,parent):
 bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;move(o);o.name=name;o.parent=parent;o.location=loc;o.scale=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material);bevel(o,min(.035,min(size)/4));return o
def tube(name,points,radius,material,parent,closed=False):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=radius;c.bevel_resolution=3
 s=c.splines.new('POLY');s.points.add(len(points)-1)
 for p,co in zip(s.points,points):p.co=(*co,1)
 s.use_cyclic_u=closed;o=bpy.data.objects.new(name,c);collection.objects.link(o);o.parent=parent;o.data.materials.append(material)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');return bpy.context.object
def ring(name,x,y,r,z,thick,material,parent):
 return tube(name,[(x+r*math.cos(i*math.tau/96),y+r*math.sin(i*math.tau/96),z) for i in range(96)],thick,material,parent,True)
def cylinder(name,loc,radius,length,material,parent,axis='Y'):
 bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=radius,depth=length);o=bpy.context.object;move(o);o.name=name;o.parent=parent;o.location=loc
 if axis=='Y':o.rotation_euler.x=math.pi/2
 o.data.materials.append(material);bevel(o,.009)
 for p in o.data.polygons:p.use_smooth=True
 return o
key=empty('GoldenKey');key['tip_socket']=[0,0,0];key['shaft_axis']=[0,1,0]
# Author in XY, convert once at export so glTF is upright Y and face-facing Z.
key.rotation_euler.x=math.pi/2
N=96;cy=1.92
verts=[]
for z,rmode in [(.055,'outer'),(.055,'inner'),(-.055,'inner'),(-.055,'outer')]:
 for i in range(N):
  a=i*math.tau/N;r=.485 if rmode=='outer' else .275-.063*math.cos(4*a)
  verts.append((r*math.cos(a),cy+r*math.sin(a),z))
faces=[]
for j in range(4):
 for i in range(N):faces.append((j*N+i,j*N+(i+1)%N,((j+1)%4)*N+(i+1)%N,((j+1)%4)*N+i))
mesh=bpy.data.meshes.new('Clover head');mesh.from_pydata(verts,[],faces);mesh.update()
o=bpy.data.objects.new('Key_CloverHead',mesh);collection.objects.link(o);o.parent=key;mesh.materials.append(gold);bevel(o,.016)
ring('Key_outer_rolled_rim',0,cy,.466,.058,.016,gold,key)
for side in [-1,1]:
 tube('Key_clover_inner_rim',[( (.275-.063*math.cos(4*i*math.tau/N))*math.cos(i*math.tau/N),cy+(.275-.063*math.cos(4*i*math.tau/N))*math.sin(i*math.tau/N),side*.058) for i in range(N)],.014,gold,key,True)
 ring('Key_light_bus',0,cy,.397,side*.073,.007,ivory,key)
 for i in range(4):
  a=i*math.pi/2;x=.398*math.cos(a);y=cy+.398*math.sin(a)
  cylinder('Key_Node_'+str(side)+'_'+str(i),(x,y,side*.076),.070,.03,gold,key,'Z')
  ring('Key_Node_glow',x,y,.044,side*.096,.009,ivory,key)
  cylinder('Key_Node_center',(x,y,side*.097),.017,.014,ivory,key,'Z')
  tube('Key_Node_spoke',[(x,y,side*.096),(.225*math.cos(a),cy+.225*math.sin(a),side*.078)],.009,gold,key)
shaft=cylinder('Key_Shaft',(0,.74,0),.049,1.48,gold,key)
for y,r,length in [(.065,.060,.12),(.145,.067,.04),(1.18,.07,.03),(1.24,.10,.12),(1.33,.082,.035),(1.40,.102,.035)]:
 cylinder('Key_Collar_'+str(y),(0,y,0),r,length,gold,key)
for z in [-.051,.051]:
 tube('Key_Shaft_light',[(0,.20,z),(0,1.13,z)],.006,ivory,key)
 tube('Key_Shaft_engraving',[(-.03,.33,z),(.03,.48,z),(.03,.75,z),(-.03,.95,z)],.004,bronze,key)
# Stepped ward, with a genuine notch like the source silhouette.
points=[(.046,.15),(.28,.15),(.28,.27),(.215,.27),(.215,.34),(.28,.34),(.28,.48),(.046,.48)]
mesh=bpy.data.meshes.new('Key ward');vs=[(x,y,z) for z in [-.025,.025] for x,y in points];n=len(points)
fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
mesh.from_pydata(vs,[],fs);mesh.update();o=bpy.data.objects.new('Key_SteppedBit',mesh);collection.objects.link(o);o.parent=key;mesh.materials.append(gold);bevel(o,.013)
for z in [-.04,.04]:tube('Key_Bit_light',[(.075,.17,z),(.075,.46,z)],.006,ivory,key)

door=empty('GoldenDoors');door.rotation_euler.x=math.pi/2
door['lock_socket']=[0,2.30,.21];door['keyhole_profile']='circular head and descending ward slot'
left=empty('DoorHinge_left',door,(-3,0,0));right=empty('DoorHinge_right',door,(3,0,0))
left['open_angle_rad']=-math.radians(105);right['open_angle_rad']=math.radians(105)
for label,pivot,cx in [('left',left,1.5),('right',right,-1.5)]:
 box('Door_'+label+'_frost',(cx,2.30,-.015),(2.65,4.25,.12),frost,pivot)
 for x in [cx-1.43,cx+1.43]:
  box('Door_'+label+'_stile',(x,2.30,0),(.14,4.60,.20),gold,pivot)
  box('Door_'+label+'_fine_rail',(x,2.30,.115),(.018,4.52,.024),bronze,pivot)
 for y in [.07,4.53]:box('Door_'+label+'_crossrail',(cx,y,0),(2.87,.14,.20),gold,pivot)
 for x in [cx-1.32,cx+1.32]:box('Door_'+label+'_inset_trim',(x,2.30,.08),(.025,4.19,.035),gold,pivot)
 for y in [.205,4.395]:box('Door_'+label+'_inset_edge',(cx,y,.08),(2.65,.025,.035),gold,pivot)
 # Quiet elongated highlights on the metal, matching the illuminated source.
 box('Door_'+label+'_warm_line',(cx+(1.415 if label=='left' else -1.415),2.30,.123),(.009,4.43,.012),ivory,pivot)
for x in [-3.10,3.10]:box('Door_fixed_jamb',(x,2.30,-.035),(.12,4.78,.26),gold,door)
for y in [-.06,4.66]:box('Door_fixed_lintel',(0,y,-.035),(6.32,.12,.26),gold,door)
# Actual circular keyhole with narrow descending ward: extruded plate plus boolean.
lock=empty('LockRotor',left,(3,2.30,.145));lock['axis_gltf']=[0,0,1]
plate=cylinder('Lock_plate',(0,0,0),.205,.065,gold,lock,'Z')
hole=cylinder('Temporary_keyhole',(0,.025,0),.058,.5,gold,lock,'Z')
bpy.context.view_layer.objects.active=plate;mod=plate.modifiers.new('Circular key opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=hole;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(hole,do_unlink=True)
hole=box('Temporary_keyslot',(0,-.07,0),(.056,.16,.5),gold,lock)
bpy.context.view_layer.objects.active=plate;mod=plate.modifiers.new('Ward opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=hole;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(hole,do_unlink=True)
ring('Lock_outer_ring',0,0,.207,.03,.012,gold,lock)
ring('Lock_inner_ring',0,0,.178,.037,.006,bronze,lock)
ring('Lock_status_light',0,0,.217,.024,.005,ivory,lock)

def export(root,name):
 bpy.ops.object.select_all(action='DESELECT')
 root.select_set(True)
 for o in root.children_recursive:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/name),export_format='GLB',use_selection=True,use_active_scene=True,export_extras=True,export_animations=False)
export(key,'golden-key.glb');export(door,'golden-doors.glb')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'unlock-assets.blend'))
print(json.dumps({'key':str(OUT/'golden-key.glb'),'doors':str(OUT/'golden-doors.glb'),'blend':str(OUT/'unlock-assets.blend')}))
