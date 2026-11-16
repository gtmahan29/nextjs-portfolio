import bpy, math, os
from mathutils import Vector

OUT = os.path.join(os.getcwd(), 'public', 'holographic-start')
os.makedirs(OUT, exist_ok=True)
scene = bpy.data.scenes.new('Holographic Start')
bpy.context.window.scene = scene
root = bpy.data.objects.new('HolographicStart', None)
scene.collection.objects.link(root)

def material(name, color, metal=0, rough=.25, emission=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal
    p.inputs['Roughness'].default_value=rough
    p.inputs['Coat Weight'].default_value=.7
    p.inputs['Coat Roughness'].default_value=.1
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1)
        p.inputs['Emission Strength'].default_value=emission
    return m

silver=material('Pearl titanium',(.78,.80,.86),.72,.24)
dark=material('Obsidian socket',(.018,.021,.04),.5,.27)
tray=material('Smoked titanium',(.16,.18,.26),.75,.2)
white=material('Start porcelain lettering',(1,1,1),.1,.22,.22)
amber=material('Amber status light',(1,.35,.055),.1,.16,3)

# A continuous optical gradient, baked as a texture so GLB and browser agree.
N=512
img=bpy.data.images.new('Prismatic optical coating',N,N)
pixels=[]
stops=[(0.,(.035,.68,.95)),(.24,(.09,.38,.98)),(.49,(.27,.19,.73)),(.72,(.95,.32,.76)),(1.,(1,.81,.36))]
for y in range(N):
    for x in range(N):
        u=x/(N-1); v=y/(N-1)
        t=max(0,min(1,.65*u+.45*v-.05))
        for j in range(len(stops)-1):
            a,c=stops[j]; b,d=stops[j+1]
            if a<=t<=b:
                f=(t-a)/(b-a); f=f*f*(3-2*f)
                col=[c[k]*(1-f)+d[k]*f for k in range(3)]; break
        cyan=math.exp(-((u-.5)**2/.14+(v-.03)**2/.025))*.65
        col=[col[k]*(1-cyan)+(.1,.95,1)[k]*cyan for k in range(3)]
        pixels.extend((*col,1))
img.pixels=pixels; img.filepath_raw=os.path.join(OUT,'prismatic.png'); img.file_format='PNG'; img.save(); img.pack()

def optical(name, strength):
    m=material(name,(1,1,1),.22,.12)
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    tex=m.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=img
    m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
    m.node_tree.links.new(tex.outputs['Color'],p.inputs['Emission Color'])
    p.inputs['Emission Strength'].default_value=strength
    p.inputs['Transmission Weight'].default_value=.22 if strength<1 else 0
    p.inputs['IOR'].default_value=1.46
    return m
glass=optical('Holographic glass',.12)
glass_shader=next(n for n in glass.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
for key,value in [('Roughness',.075),('Metallic',.18),('Transmission Weight',.2),('IOR',1.52),('Coat Weight',1),('Coat Roughness',.035),('Emission Strength',.035)]:
    glass_shader.inputs[key].default_value=value
glow=optical('Prismatic light piping',2.4)

def outline(w,d,r):
    pts=[]
    for cx,cy,start in [(w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180),(w/2-r,-d/2+r,270)]:
        for i in range(17):
            a=math.radians(start+i*90/16)
            pts.append((cx+r*math.cos(a),cy+r*math.sin(a)))
    return pts

def block(name,w,d,h,z,r,mat,bevel=.04):
    # Rounded footprint and rounded horizontal edges; stable smooth side normals.
    rings=[]
    for i in range(6):
        a=i*math.pi/10
        rings.append((-h/2+bevel-bevel*math.cos(a),bevel*(1-math.sin(a))))
    for i in range(6):
        a=i*math.pi/10
        rings.append((h/2-bevel+bevel*math.sin(a),bevel*(1-math.cos(a))))
    verts=[]
    for zz,inset in rings:
        verts.extend((x,y,z+zz) for x,y in outline(w-2*inset,d-2*inset,max(.01,r-inset)))
    count=len(verts)//len(rings); faces=[]
    for j in range(len(rings)-1):
        for i in range(count): faces.append((j*count+i,j*count+(i+1)%count,(j+1)*count+(i+1)%count,(j+1)*count+i))
    faces.append(tuple(reversed(range(count))))
    faces.append(tuple(range((len(rings)-1)*count,len(rings)*count)))
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    obj=bpy.data.objects.new(name,mesh); scene.collection.objects.link(obj); obj.parent=root; obj.data.materials.append(mat)
    uv=mesh.uv_layers.new(name='Optical projection')
    for poly in mesh.polygons:
        poly.use_smooth=len(poly.vertices)==4
        for li in poly.loop_indices:
            co=mesh.vertices[mesh.loops[li].vertex_index].co
            uv.data[li].uv=(co.x/4+.5,co.y/4+.5)
    return obj

block('Porcelain foundation',4.65,4.65,.27,.135,.6,silver,.065)
block('Dark recessed plinth',4.12,4.12,.10,.32,.5,tray,.025)
block('Floating underlight',3.83,3.83,.12,.46,.48,glow,.025)
chassis=block('Titanium chassis',3.80,3.80,.89,.97,.48,silver,.075)
# A real recessed socket lets the cap travel fully into the casing.
cutter=block('Temporary button socket cutter',3.49,3.49,.93,1.43,.46,dark,.015)
bpy.context.view_layer.objects.active=chassis
modifier=chassis.modifiers.new('Recessed button travel','BOOLEAN')
modifier.operation='DIFFERENCE'; modifier.object=cutter
bpy.ops.object.modifier_apply(modifier=modifier.name)
bpy.data.objects.remove(cutter,do_unlink=True)
block('Glass button',3.43,3.43,.53,1.69,.45,glass,.055)

def rim(name,w,d,z,r,mat,radius=.013):
    curve=bpy.data.curves.new(name,'CURVE'); curve.dimensions='3D'; curve.bevel_depth=radius; curve.bevel_resolution=3
    pts=outline(w,d,r); s=curve.splines.new('POLY'); s.points.add(len(pts)-1)
    for p,(x,y) in zip(s.points,pts): p.co=(x,y,z,1)
    s.use_cyclic_u=True
    obj=bpy.data.objects.new(name,curve); scene.collection.objects.link(obj); obj.parent=root; obj.data.materials.append(mat)
    bpy.context.view_layer.objects.active=obj; obj.select_set(True); bpy.ops.object.convert(target='MESH'); obj.select_set(False)
    return obj
rim('Glass upper specular edge',3.39,3.39,1.93,.44,white,.009)
rim('Cyan lower optical edge',3.43,3.43,1.45,.45,glow,.014)
rim('Foundation lip',4.54,4.54,.263,.57,white,.009)

# Front cartridge recess, trim and inset amber indicator.
trim=block('Socket satin surround',1.85,.70,.065,0,.17,silver,.025)
trim.rotation_euler.x=math.pi/2; trim.location=(0,-1.90,.99)
slot=block('Deep cartridge aperture',1.52,.39,.04,0,.07,dark,.015)
slot.rotation_euler.x=math.pi/2; slot.location=(0,-1.94,.99)
status=block('Amber cartridge indicator',.20,.25,.035,0,.03,amber,.01)
status.rotation_euler.x=math.pi/2; status.location=(.57,-1.969,.99)
for i in range(6):
    vent=block('Vent %02d'%i,.045,.30,.012,0,.01,dark,.003)
    vent.rotation_euler=(math.pi/2,0,math.pi/2); vent.location=(1.902,-.48+i*.13,1.02)
for x,y in [(-1.7,-1.7),(1.7,-1.7),(1.7,1.7)]:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.019,location=(x,y,.383))
    o=bpy.context.object; o.name='Plinth optical indicator'; o.parent=root; o.data.materials.append(glow)

font=bpy.data.curves.new('Start inscription','FONT'); font.body='Start'; font.align_x='CENTER'; font.align_y='CENTER'; font.size=.47; font.space_character=1.15; font.extrude=.001
text=bpy.data.objects.new('Start inscription',font); scene.collection.objects.link(text); text.parent=root; text.location=(0,0,1.964); text.data.materials.append(white)
bpy.context.view_layer.objects.active=text; text.select_set(True); bpy.ops.object.convert(target='MESH')
for o in scene.objects: o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'holographic-start.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_extras=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'holographic-start.blend'))
print('Exported',os.path.join(OUT,'holographic-start.glb'))
