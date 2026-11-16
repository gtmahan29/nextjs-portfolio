"""Run in Blender through MCP. Coordinates are Blender Z-up; GLB is Y-up."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector, Matrix

BASE = Path(r'C:\Users\Maahaan\Desktop\📁 Projects - Web\nextjs-portfolio')
OUT = BASE / 'public' / 'golden-cube'
OUT.mkdir(parents=True, exist_ok=True)
scene = bpy.data.scenes.new('Golden Cube Studio')
bpy.context.window.scene = scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.render.resolution_x = 1000
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('Cube Studio World')
scene.world.use_nodes = True
scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value = (0.05,0.065,0.10,1)
scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value = 0.32
scene.view_settings.view_transform = 'AgX'
scene.render.image_settings.file_format = 'PNG'
scene.frame_end = 48
scene['reference_image'] = 'codex-clipboard-0fe7ca23-6500-47a0-baec-b9710b826649.png'
scene['meshy_task_id'] = '01a13571-bebc-704a-9c06-760fe263a79b'

asset = bpy.data.collections.new('Golden Cube | Export')
scene.collection.children.link(asset)
studio = bpy.data.collections.new('Studio | Not exported')
scene.collection.children.link(studio)

def material(name, color, metal=0, rough=.2, transmission=0, emission=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    n.inputs['Base Color'].default_value=(*color,1)
    n.inputs['Metallic'].default_value=metal
    n.inputs['Roughness'].default_value=rough
    n.inputs['Transmission Weight'].default_value=transmission
    n.inputs['IOR'].default_value=1.46
    n.inputs['Coat Weight'].default_value=.35
    n.inputs['Emission Color'].default_value=(*color,1)
    n.inputs['Emission Strength'].default_value=emission
    m.diffuse_color=(*color,1)
    return m
gold=material('Gold | polished trim',(1,.58,.12),1,.16)
glass=material('Metal | reflective champagne',(.40,.235,.080),.92,.19)
lightmat=material('Light | warm circuit',(1,.53,.09),.65,.19,0,1.15)
white=material('Light | ivory edge',(1,.85,.55),.55,.18,0,.9)
diamond=material('Crystal | ice',(.70,.86,.95),.92,.12)
amber=material('Crystal | amber',(1,.58,.10),1,.15)

def move_collection(obj, col):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    col.objects.link(obj)

def empty(name,parent=None,loc=(0,0,0)):
    o=bpy.data.objects.new(name,None); asset.objects.link(o)
    o.parent=parent; o.location=loc; o.empty_display_size=.13
    return o

root=empty('GoldenCube')
root.location.z=1.09
root['asset_version']='1.0'; root['reference_generator']='meshy-6-lite'
root['panels']='front,right,back,left,top,bottom'

def box(name, center, dims, mat, parent, bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o=bpy.context.object; o.name=name; move_collection(o,asset)
    o.parent=parent; o.location=center; o.scale=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Rounded edges','BEVEL'); mod.width=bevel; mod.segments=3
        bpy.context.view_layer.objects.active=o
        bpy.ops.object.modifier_apply(modifier=mod.name)
        for p in o.data.polygons: p.use_smooth=True
        mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def path(name, points, radius, mat, parent, closed=False):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.resolution_u=1
    c.bevel_depth=radius; c.bevel_resolution=2
    s=c.splines.new('POLY'); s.points.add(len(points)-1)
    for p,co in zip(s.points,points): p.co=(*co,1)
    s.use_cyclic_u=closed
    o=bpy.data.objects.new(name,c); asset.objects.link(o); o.parent=parent
    o.data.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.context.view_layer.objects.active=o; bpy.ops.object.convert(target='MESH')
    return bpy.context.object

def rounded_square(r,z,corner=.13):
    pts=[]
    for x,y,start in [(r-corner,r-corner,0),(-r+corner,r-corner,90),(-r+corner,-r+corner,180),(r-corner,-r+corner,270)]:
        for j in range(9):
            a=math.radians(start+j*90/8)
            pts.append((x+corner*math.cos(a),y+corner*math.sin(a),z))
    return pts

def crystal(name,center,size,parent):
    x,y,z=center; s=size
    vs=[(x,y,z+.08*s),(x+s,y,z),(x,y+s,z),(x-s,y,z),(x,y-s,z),(x,y,z-.03*s)]
    fs=[(0,1,2),(0,2,3),(0,3,4),(0,4,1),(5,2,1),(5,3,2),(5,4,3),(5,1,4)]
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(vs,[],fs); mesh.update()
    obj=bpy.data.objects.new(name,mesh); asset.objects.link(obj); obj.parent=parent
    mesh.materials.append(diamond); mesh.materials.append(amber)
    for p in mesh.polygons: p.material_index=1 if p.index in (2,3,6) else 0
    path(name+' bezel',[(x+s,y,z-.013),(x,y+s,z-.013),(x-s,y,z-.013),(x,y-s,z-.013)],.014,gold,parent,True)
    return obj

def mitered_shell(name,parent):
    # All outer vertices land on the same +/-1.095 cube in the closed state.
    # The tapered rear edges meet at +/-0.98; no static cover hides an opening.
    loops=[(1.095,.060),(.875,-.020),(.875,-.055),(.980,-.055)]
    corners=[(-1,-1),(1,-1),(1,1),(-1,1)]
    perimeter=[]
    for j,(x,y) in enumerate(corners):
        nx,ny=corners[(j+1)%4]
        for k in range(12):
            t=k/12;perimeter.append((x+(nx-x)*t,y+(ny-y)*t))
    vs=[]
    for ring,(r,z) in enumerate(loops):
        for x,y in perimeter:
            point=Vector((x*r,y*r,z+1.035))
            if ring in (0,3):
                radius=.12 if ring==0 else .07
                core=r-radius
                clamped=Vector([max(-core,min(core,c)) for c in point])
                point=clamped+(point-clamped).normalized()*radius
            vs.append((point.x,point.y,point.z-1.035))
    count=len(perimeter)
    fs=[]
    for ring in range(4):
        a=ring*count; b=((ring+1)%4)*count
        for j in range(count): fs.append((a+j,a+(j+1)%count,b+(j+1)%count,b+j))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],fs);mesh.update()
    obj=bpy.data.objects.new(name,mesh);asset.objects.link(obj);obj.parent=parent
    mesh.materials.append(gold)
    return obj

circuits=[
    [(-.75,.76),(-.12,.76),(-.12,.38),(-.43,.38),(-.43,.13)],
    [(-.75,.48),(-.60,.48),(-.60,.17),(-.35,.17)],
    [(.10,.76),(.73,.76),(.73,.34),(.50,.34),(.50,.05)],
    [(.22,.48),(.48,.48)],
    [(-.75,-.13),(-.52,-.13),(-.52,-.47),(-.24,-.47),(-.24,-.76)],
    [(-.75,-.68),(-.63,-.68),(-.63,-.42)],
    [(.34,-.13),(.68,-.13),(.68,-.74),(.12,-.74),(.12,-.49)],
    [(.36,-.38),(.52,-.38),(.52,-.63)],
    [(0,.86),(0,.43)],[(0,-.43),(0,-.86)]
]
faces={'front':((0,-1,0),(0,0,1)), 'right':((1,0,0),(0,0,1)),
       'back':((0,1,0),(0,0,1)), 'left':((-1,0,0),(0,0,1)),
       'top':((0,0,1),(0,1,0)), 'bottom':((0,0,-1),(0,-1,0))}
hinges={}
for name,(normal,up) in faces.items():
    n=Vector(normal); v=Vector(up); u=v.cross(n)
    frame=empty('Face_'+name,root); frame.location=n*1.035
    frame.rotation_mode='QUATERNION'; frame.rotation_quaternion=Matrix((u,v,n)).transposed().to_quaternion()
    hinge=empty('Hinge_'+name,frame,(-1.095,0,.06)); hinges[name]=hinge
    hinge['panel_id']=name; hinge['open_axis_gltf']=[0.0,0.0,-1.0]
    hinge['open_angle_rad']=-math.radians(105)
    panel=empty('Panel_'+name,hinge,(1.095,0,-.06))
    mitered_shell('Layer_'+name+'_shell',panel)
    box(name+'_glass',(0,0,-.008),(1.86,1.86,.065),glass,panel,.085)
    path(name+'_outer_frame',rounded_square(.965,.025),.035,gold,panel,True)
    path(name+'_ivory_rim',rounded_square(.89,.048,.11),.014,white,panel,True)
    path(name+'_inner_trim',rounded_square(.845,.041,.09),.009,gold,panel,True)
    for i,pts in enumerate(circuits):
        path(name+'_circuit_'+str(i),[(x,y,.045) for x,y in pts],.005,lightmat,panel)
    crystal(name+'_center_crystal',(0,0,.065),.31,panel)
    crystal(name+'_upper_jewel',(0,.46,.055),.045,panel)
    crystal(name+'_lower_jewel',(0,-.46,.055),.045,panel)
    # Join details by material to keep draw calls modest, retaining separate layers.
    for label,mat in [('gold',gold),('metal',glass),('circuits',lightmat),('rim',white)]:
        obs=[o for o in asset.objects if o.parent==panel and o.type=='MESH' and len(o.data.materials)==1 and o.data.materials[0]==mat]
        if not obs: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs: o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join()
        obs[0].name='Layer_'+name+'_'+label

def aim(obj,target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(4.1,-6.2,4.6))
cam=bpy.context.object; cam.name='Studio Camera'; move_collection(cam,studio)
cam.data.type='ORTHO'; cam.data.ortho_scale=4.35; aim(cam,(0,0,1.1)); scene.camera=cam
for name,loc,power,size,color in [('Key',(-3,-4,6),650,4,(1,.88,.66)),('Cool Fill',(4,-1,3),450,3,(.65,.85,1)),('Rim',(0,4,5),850,3,(1,.80,.46))]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    o=bpy.context.object; o.name='Studio '+name; move_collection(o,studio)
    o.data.energy=power; o.data.shape='DISK'; o.data.size=size; o.data.color=color; aim(o,(0,0,1.1))
floor=box('Studio Floor',(0,0,-.07),(200,200,.06),material('Studio black',(.008,.011,.016),.15,.3),None,.0)
move_collection(floor,studio)
scene.use_nodes=True
tree=getattr(scene,'node_tree',None)
if tree is None:
    tree=bpy.data.node_groups.new('Golden Cube Bloom','CompositorNodeTree')
    scene.compositing_node_group=tree
    tree.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
tree.nodes.clear()
rl=tree.nodes.new('CompositorNodeRLayers')
comp=tree.nodes.new('NodeGroupOutput' if not hasattr(scene,'node_tree') else 'CompositorNodeComposite'); tree.links.new(rl.outputs['Image'],comp.inputs['Image'])

# Select only the asset; studio and future Meshy reference are excluded from GLB.
bpy.ops.object.select_all(action='DESELECT')
for o in asset.objects: o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(OUT/'golden-cube.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_extras=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'golden-cube.blend'))
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_distance=6
            area.spaces.active.region_3d.view_location=(0,0,1.1)
            area.spaces.active.region_3d.view_rotation=cam.rotation_euler.to_quaternion()
print(json.dumps({'scene':scene.name,'hinges':list(hinges),'mesh_objects':len([o for o in asset.objects if o.type=='MESH']),'glb':str(OUT/'golden-cube.glb'),'blend':str(OUT/'golden-cube.blend')}))
