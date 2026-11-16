import bpy, os
scene=bpy.data.scenes['Holographic Start']; bpy.context.window.scene=scene
cap=next(o for o in scene.objects if o.name.startswith('Glass button'))
core=cap.copy(); core.data=cap.data.copy(); core.name='Optical inner core'; scene.collection.objects.link(core)
for vertex in core.data.vertices:
    vertex.co.x*=.965; vertex.co.y*=.965
    vertex.co.z=1.79+(vertex.co.z-1.69)*.22
core.data.materials.clear()
core_mat=next(m for m in bpy.data.materials if m.name.startswith('Optical blue crown'))
core.data.materials.append(core_mat)
uv=core.data.uv_layers.active
for p in core.data.polygons:
    p.material_index=0
    for li in p.loop_indices:
        co=core.data.vertices[core.data.loops[li].vertex_index].co
        uv.data[li].uv=(co.x/3.43+.5,co.y/3.43+.5)

glass=bpy.data.materials.new('Clear dispersive crystal'); glass.use_nodes=True
p=next(n for n in glass.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
for key,value in [('Roughness',.035),('Metallic',0),('Transmission Weight',.96),('IOR',1.48),('Coat Weight',1),('Coat Roughness',.02)]:
    p.inputs[key].default_value=value
p.inputs['Base Color'].default_value=(.96,.99,1,1)
cap.data.materials.clear(); cap.data.materials.append(glass)
for face in cap.data.polygons: face.material_index=0
# Narrow physical edging; remove the painted white stroke.
for obj in scene.objects:
    if obj.name.startswith('Glass upper specular edge'):
        obj.data.materials.clear(); obj.data.materials.append(glass)
for o in scene.objects: o.select_set(True)
bpy.context.view_layer.objects.active=cap
base=os.path.join(os.getcwd(),'public','holographic-start')
bpy.ops.export_scene.gltf(filepath=os.path.join(base,'holographic-start.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_extras=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(base,'holographic-start.blend'))
print('Exported clear refractive shell around separate optical core')
