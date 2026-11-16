import bpy, math, os, random
from mathutils import Vector
base=os.path.join(os.getcwd(),'public','hero-clouds'); os.makedirs(base,exist_ok=True)
scene=bpy.data.scenes.new('Hero volumetric clouds'); bpy.context.window.scene=scene
scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.use_denoising=True
scene.render.resolution_x=1024; scene.render.resolution_y=768; scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
scene.world=bpy.data.worlds.new('Soft blue sky'); scene.world.use_nodes=True
bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND'); bg.inputs['Color'].default_value=(.62,.76,1,1); bg.inputs['Strength'].default_value=.6
mat=bpy.data.materials.new('Cloud water droplets'); mat.use_nodes=True
nodes=mat.node_tree.nodes; nodes.clear(); links=mat.node_tree.links
out=nodes.new('ShaderNodeOutputMaterial'); vol=nodes.new('ShaderNodeVolumePrincipled')
vol.inputs['Color'].default_value=(.96,.985,1,1); vol.inputs['Anisotropy'].default_value=.15
links.new(vol.outputs['Volume'],out.inputs['Volume'])
coord=nodes.new('ShaderNodeTexCoord'); noise=nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=5; noise.inputs['Detail'].default_value=4; noise.inputs['Roughness'].default_value=.7
noise.inputs['Scale'].default_value=4; noise.inputs['Detail'].default_value=5
links.new(coord.outputs['Generated'],noise.inputs['Vector'])
subtract=nodes.new('ShaderNodeVectorMath'); subtract.operation='SUBTRACT'; subtract.inputs[1].default_value=(.5,.5,.5); links.new(coord.outputs['Generated'],subtract.inputs[0])
length=nodes.new('ShaderNodeVectorMath'); length.operation='LENGTH'; links.new(subtract.outputs['Vector'],length.inputs[0])
falloff=nodes.new('ShaderNodeMapRange'); falloff.inputs['From Min'].default_value=.22; falloff.inputs['From Max'].default_value=.49; falloff.inputs['To Min'].default_value=1; falloff.inputs['To Max'].default_value=0; falloff.clamp=True
links.new(length.outputs['Value'],falloff.inputs['Value'])
ramp=nodes.new('ShaderNodeMapRange'); ramp.inputs['From Min'].default_value=.38; ramp.inputs['From Max'].default_value=.67; ramp.inputs['To Min'].default_value=0; ramp.inputs['To Max'].default_value=1; ramp.clamp=True; links.new(noise.outputs['Fac'],ramp.inputs['Value'])
multiply=nodes.new('ShaderNodeMath'); multiply.operation='MULTIPLY'; links.new(ramp.outputs['Result'],multiply.inputs[0]); links.new(falloff.outputs['Result'],multiply.inputs[1])
density=nodes.new('ShaderNodeMath'); density.operation='MULTIPLY'; density.inputs[1].default_value=3.3; links.new(multiply.outputs[0],density.inputs[0]); links.new(density.outputs[0],vol.inputs['Density'])
random.seed(21)
for i,(x,z,r) in enumerate([(-4,-.3,2.4),(-2,-.4,2.8),(0,-.5,3),(2.5,-.5,2.7),(4,-.2,2.1),(-2,1.2,2.3),(.1,1.6,2.5),(2.6,1,2.2),(-3.8,1,1.5),(.9,3,1.6),(-.9,2.7,1.7)]):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=(x,random.uniform(-.7,.7),z))
    obj=bpy.context.object; obj.name='Volumetric cloud lobe %02d'%i; obj.scale=(r,r*.65,r*.82); obj.data.materials.append(mat)
sun_data=bpy.data.lights.new('Large soft sunlight','SUN'); sun_data.energy=3; sun_data.angle=.35
sun=bpy.data.objects.new('Large soft sunlight',sun_data); scene.collection.objects.link(sun); sun.rotation_euler=(math.radians(25),math.radians(-35),math.radians(-25))
area_data=bpy.data.lights.new('Sky fill','AREA'); area_data.energy=1800; area_data.shape='DISK'; area_data.size=10
area=bpy.data.objects.new('Sky fill',area_data); scene.collection.objects.link(area); area.location=(-3,-7,8); area.rotation_euler=(Vector((0,0,1))-area.location).to_track_quat('-Z','Y').to_euler()
camera_data=bpy.data.cameras.new('Cloud portrait'); camera_data.type='ORTHO'; camera_data.ortho_scale=16
camera=bpy.data.objects.new('Cloud portrait',camera_data); scene.collection.objects.link(camera); camera.location=(0,-20,5); camera.rotation_euler=(Vector((0,0,.8))-camera.location).to_track_quat('-Z','Y').to_euler(); scene.camera=camera
scene.render.filepath=os.path.join(base,'cloud-bank.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(base,'hero-clouds.blend'))
# Schedule the render so the MCP call stays responsive.
def render_cloud():
    bpy.ops.render.render(write_still=True)
    print('Cloud bank rendered: '+scene.render.filepath)
    return None
bpy.app.timers.register(render_cloud,first_interval=1)
print('Volumetric cloud render scheduled')
