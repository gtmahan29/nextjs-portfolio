import bpy, math, os
scene=bpy.data.scenes['Holographic Start']
bpy.context.window.scene=scene
base=os.path.join(os.getcwd(),'public','holographic-start')
cap=next(o for o in scene.objects if o.name.startswith('Glass button'))
N=768
def make_image(name, kind):
    image=bpy.data.images.new(name,N,N)
    pixels=[]
    for y in range(N):
        v=y/(N-1)
        for x in range(N):
            u=x/(N-1)
            if kind=='top':
                # Blue optical core surrounded by a spectral, softly lit perimeter.
                edge=max(abs(u-.5),abs(v-.5))*2
                spectral=max(0,min(1,.65*u+.35*v))
                stops=[(0,(.04,.74,.98)),(.35,(.08,.36,.92)),(.60,(.39,.19,.83)),(.82,(1,.27,.69)),(1,(1,.81,.38))]
                for j in range(len(stops)-1):
                    a,c=stops[j]; b,d=stops[j+1]
                    if a<=spectral<=b:
                        f=(spectral-a)/(b-a); f=f*f*(3-2*f)
                        color=[c[k]*(1-f)+d[k]*f for k in range(3)]; break
                center=math.exp(-(((u-.49)/.38)**2+((v-.49)/.38)**2))* .87
                core=(.065,.14,.56)
                color=[color[k]*(1-center)+core[k]*center for k in range(3)]
                cyan=math.exp(-((u-.5)**2/.075+(v-.09)**2/.016))*.76
                color=[color[k]*(1-cyan)+(.12,.83,.97)[k]*cyan for k in range(3)]
                rim=.26*math.exp(-((edge-.87)/.065)**2)
                highlight=.23*math.exp(-((u-.2)**2/.035+(v-.84)**2/.022))
                color=[c*(1-rim-highlight)+(rim+highlight)*.97 for c in color]
            else:
                # Depth-dependent absorption and restrained vertical light ribbons.
                hue=.5+.5*math.cos(u*math.pi*2+math.pi/2)
                cyan=(.035,.69,.92); violet=(.39,.19,.87); pink=(.95,.35,.74)
                c=cyan if hue<.5 else violet; d=violet if hue<.5 else pink
                f=hue*2 if hue<.5 else (hue-.5)*2
                color=[c[k]*(1-f)+d[k]*f for k in range(3)]
                low=.62*math.exp(-((v-.04)/.24)**2)
                color=[color[k]*(1-low)+(.07,.89,.98)[k]*low for k in range(3)]
                sheen=(.46*math.exp(-((u-.17)/.038)**2)+.27*math.exp(-((u-.69)/.045)**2))*(.45+.55*v)
                color=[c*(1-sheen)+sheen*.98 for c in color]
            pixels.extend((*color,1))
    image.pixels=pixels; image.filepath_raw=os.path.join(base,name+'.png'); image.file_format='PNG'; image.save(); image.pack()
    return image

top_image=make_image('optical-top','top')
wall_image=make_image('optical-wall','wall')
def optical_mat(name,image,transmission):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    tex=m.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=image
    m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
    m.node_tree.links.new(tex.outputs['Color'],p.inputs['Emission Color'])
    for key,value in [('Roughness',.065),('Metallic',.12),('Transmission Weight',transmission),('IOR',1.48),('Coat Weight',1),('Coat Roughness',.025),('Emission Strength',.06)]:
        p.inputs[key].default_value=value
    return m
top=optical_mat('Optical blue crown',top_image,.14)
wall=optical_mat('Optical spectral walls',wall_image,.38)

# Replace the flat top by a subtly convex optical crown.
old=cap.data
verts=[tuple(v.co) for v in old.vertices]
faces=[tuple(p.vertices) for p in old.polygons if not (p.normal.z>.99 and len(p.vertices)>4)]
top_poly=next(p for p in old.polygons if p.normal.z>.99 and len(p.vertices)>4)
boundary=list(top_poly.vertices); prev=boundary; count=len(boundary)
for j in range(1,17):
    scale=1-j/17
    ids=[]
    for i in boundary:
        x,y,z=verts[i]; ids.append(len(verts)); verts.append((x*scale,y*scale,z+.034*(1-scale*scale)))
    for i in range(count): faces.append((prev[i],prev[(i+1)%count],ids[(i+1)%count],ids[i]))
    prev=ids
center=len(verts); verts.append((0,0,1.989))
for i in range(count): faces.append((prev[i],prev[(i+1)%count],center))
mesh=bpy.data.meshes.new('Optical lens crown'); mesh.from_pydata(verts,[],faces); mesh.update()
cap.data=mesh; mesh.materials.append(top); mesh.materials.append(wall)
uv=mesh.uv_layers.new(name='Optical coating')
for p in mesh.polygons:
    p.material_index=0 if p.normal.z>.65 else 1
    p.use_smooth=True
    for li in p.loop_indices:
        co=mesh.vertices[mesh.loops[li].vertex_index].co
        if p.material_index==0: uv.data[li].uv=(co.x/3.43+.5,co.y/3.43+.5)
        else:
            t=math.atan2(co.y,co.x)/(2*math.pi)+.5
            uv.data[li].uv=(t,(co.z-1.425)/.53)

text=next(o for o in scene.objects if o.name.startswith('Start inscription'))
parent=text.parent
bpy.data.objects.remove(text,do_unlink=True)
font=bpy.data.curves.new('Start optical inscription','FONT')
font.body='Start'; font.align_x='CENTER'; font.align_y='CENTER'; font.size=.53; font.space_character=1.18; font.extrude=.001
font_path=r'C:\Windows\Fonts\consola.ttf'
if os.path.exists(font_path): font.font=bpy.data.fonts.load(font_path)
text=bpy.data.objects.new('Start inscription',font); scene.collection.objects.link(text); text.parent=parent; text.location=(0,0,1.994)
ink=bpy.data.materials.new('Optical lettering'); ink.use_nodes=True
ink_shader=next(n for n in ink.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
ink_shader.inputs['Base Color'].default_value=(1,1,1,1)
ink_shader.inputs['Emission Color'].default_value=(1,1,1,1)
ink_shader.inputs['Emission Strength'].default_value=.5
ink_shader.inputs['Roughness'].default_value=.2
font.materials.append(ink)
bpy.context.view_layer.objects.active=text; text.select_set(True); bpy.ops.object.convert(target='MESH')
# A clean, bright silver casing keeps the optical crown as the focal point.
for obj in scene.objects:
    if obj.type=='MESH':
        for mat in obj.data.materials:
            if mat and mat.name.startswith('Pearl titanium'):
                p=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
                p.inputs['Roughness'].default_value=.2
                p.inputs['Metallic'].default_value=.55
for o in scene.objects: o.select_set(True)
bpy.context.view_layer.objects.active=cap
bpy.ops.export_scene.gltf(filepath=os.path.join(base,'holographic-start.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_extras=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(base,'holographic-start.blend'))
print('Exported blue optical crown and translucent spectral walls')
