"""Refine the authored keyboard: planar rectangular shell and one global RGB wash."""
import bpy, math
from pathlib import Path
root=bpy.data.objects['Hero_Keyboard_Opal_65']
control=bpy.data.objects['RGB_Control']
collection=bpy.data.collections['KEYBOARD — export']

def outline(w,d,r,n=12):
    pts=[]
    for cx,cy,a in [(w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180),(w/2-r,-d/2+r,270)]:
        for i in range(n+1):
            t=math.radians(a+i*90/n);pts.append((cx+r*math.cos(t),cy+r*math.sin(t)))
    return pts

def replace_slab(name,w,d,height,r,z):
    obj=bpy.data.objects[name];materials=list(obj.data.materials)
    bevel=min(.035,height*.22)
    rings=[(w-2*bevel,d-2*bevel,r-bevel,0),(w,d,r,bevel),(w,d,r,height-bevel),(w-2*bevel,d-2*bevel,r-bevel,height)]
    n=len(outline(w,d,r));verts=[(x,y,h) for ww,dd,rr,h in rings for x,y in outline(ww,dd,rr)]
    faces=[tuple(reversed(range(n)))]
    for j in range(3):
        faces.extend((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for i in range(n))
    faces.append(tuple(3*n+i for i in range(n)))
    mesh=bpy.data.meshes.new(name+' — planar rectangle');mesh.from_pydata(verts,[],faces);mesh.update();obj.data=mesh;obj.location.z=z
    for mat in materials:mesh.materials.append(mat)
    # Large lids and long walls are genuinely planar. Only corner arcs blend their normals.
    for face in mesh.polygons:
        face.use_smooth=len(face.vertices)==4 and abs(face.normal.x)>.001 and abs(face.normal.y)>.001
    obj['width']=w;obj['depth']=d;obj['parallel_edges']=True
    return obj

replace_slab('White upper enclosure',16.85,5.80,.48,.30,.39)
replace_slab('Pearl lower housing',16.85,5.80,.102,.30,.09)
replace_slab('Pearl rim under the keybed',16.47,5.36,.065,.23,.865)
replace_slab('Recessed switch plate',16.29,5.19,.045,.20,.91)
# Remove the isolated per-key luminous rings. RGB now belongs to the whole keyboard.
for obj in list(collection.objects):
    if obj.name.startswith('RGB socket_'):bpy.data.objects.remove(obj,do_unlink=True)

specs=[
 ('Ceramic white — soft satin',(.86,.89,.92),.28),
 ('Opal white keycaps',(.84,.89,.94),.24),
 ('Glacier blue modifiers',(.57,.68,.79),.20),
 ('Recessed pearl switch plate',(.42,.50,.59),.44),
 ('Lower optical diffuser — unlit',(.66,.76,.88),.22),
]
for name,neutral,strength in specs:
    mat=bpy.data.materials[name];nodes=mat.node_tree.nodes;links=mat.node_tree.links
    bsdf=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    for link in list(bsdf.inputs['Base Color'].links):links.remove(link)
    tex=nodes.new('ShaderNodeTexCoord');tex.object=root
    separate=nodes.new('ShaderNodeSeparateXYZ');links.new(tex.outputs['Object'],separate.inputs['Vector'])
    remap=nodes.new('ShaderNodeMapRange');links.new(separate.outputs['X'],remap.inputs['Value']);remap.inputs['From Min'].default_value=-8.425;remap.inputs['From Max'].default_value=8.425
    ramp=nodes.new('ShaderNodeValToRGB');links.new(remap.outputs['Result'],ramp.inputs['Fac'])
    stops=[(0,(.04,.78,.96,1)),(.36,(.19,.35,.91,1)),(.66,(.53,.27,.83,1)),(1,(.96,.34,.72,1))]
    ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1])
    for i,(pos,color) in enumerate(stops):
        stop=ramp.color_ramp.elements[0] if i==0 else ramp.color_ramp.elements.new(pos);stop.position=pos;stop.color=color
    mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MIX';mix.inputs[1].default_value=(*neutral,1);links.new(ramp.outputs['Color'],mix.inputs[2]);links.new(mix.outputs['Color'],bsdf.inputs['Base Color'])
    driver=mix.inputs[0].driver_add('default_value').driver
    var=driver.variables.new();var.name='rgb';var.type='SINGLE_PROP';var.targets[0].id=control;var.targets[0].data_path='["RGB"]';driver.expression=f'rgb*{strength}'
    # Explicit web material metadata: the same global coordinates and neutral base.
    mat.diffuse_color=(*neutral,1);mat['rgb_wash']=strength;mat['neutral_color']=list(neutral)
    bsdf.inputs['Transmission Weight'].default_value=0
    bsdf.inputs['Roughness'].default_value=.29 if 'keycaps' in name else .25
    bsdf.inputs['Coat Weight'].default_value=.32
# Keep the perimeter lit but softer than the hero's glass button.
for mat in bpy.data.materials:
    if not mat.get('rgb_material'):continue
    if mat.node_tree.animation_data:
        for fc in mat.node_tree.animation_data.drivers:
            if 'Emission Strength' in fc.data_path:fc.driver.expression='rgb*1.1'
    mat['rgb_material']=True
control['RGB']=1.0;control.update_tag();bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
print('Rectangular shell rebuilt; per-key rings removed; continuous world-space RGB wash applied')
