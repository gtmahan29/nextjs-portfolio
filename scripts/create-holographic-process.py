"""Six original Blender panels with genuine voxel relief and optical rolled edges.
Coordinates below are Three.js XYZ; Blender conversion is (x, -z, y).
"""
import bpy, math, os, random
from mathutils import Vector

BASE=os.path.join(os.getcwd(),'public','holographic-process')
os.makedirs(BASE,exist_ok=True)
previous=bpy.data.scenes.get('Holographic product process')
if previous:
 for obj in list(previous.objects):bpy.data.objects.remove(obj,do_unlink=True)
 bpy.data.scenes.remove(previous)
scene=bpy.data.scenes.new('Holographic product process')
bpy.context.window.scene=scene

def xyz(p): return (p[0],-p[2],p[1])
def material(name,color,metal=.15,rough=.12,emission=0,trans=0):
 m=bpy.data.materials.new(name);m.use_nodes=True
 p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 p.inputs['Base Color'].default_value=(*color,1)
 p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 p.inputs['Coat Weight'].default_value=1;p.inputs['Coat Roughness'].default_value=.04
 p.inputs['Transmission Weight'].default_value=trans;p.inputs['IOR'].default_value=1.46
 p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
 return m

def optical_image(name,frame=False):
 size=512;im=bpy.data.images.new(name,width=size,height=size,alpha=False)
 pixels=[]
 for j in range(size):
  y=j/(size-1)
  for i in range(size):
   x=i/(size-1)
   cyan=math.exp(-((x-.08)**2/.15+(y-.45)**2/.65))
   pink=math.exp(-((x-.93)**2/.18+(y-.55)**2/.6))
   blue=math.exp(-((x-.35)**2/.6+(y-.1)**2/.13))
   gold=math.exp(-((x-.95)**2/.12+y*y/.13))
   if frame:
    c=(.15+.78*pink+.6*gold,.40+.60*cyan-.28*pink+.35*gold,.94-.55*gold)
   else:
    c=(.67-.27*cyan-.08*blue+.20*pink,.79-.24*pink,.94-.25*gold)
   pixels.extend((min(1,c[0]),min(1,c[1]),min(1,c[2]),1))
 im.pixels.foreach_set(pixels);im.filepath_raw=os.path.join(BASE,name+'.png');im.file_format='PNG';im.save();im.pack()
 return im

front=material('Panel pearl glass',(.9,.95,1),.06,.095,0,.14)
rim=material('Holographic rolled frame',(.6,.8,1),.22,.055,.13,.23)
for m,im in [(front,optical_image('pearl-spectrum')),(rim,optical_image('rim-spectrum',True))]:
 n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=im
 p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 m.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color'])
 if m==rim:m.node_tree.links.new(n.outputs['Color'],p.inputs['Emission Color'])
white=material('Optical white pinstripe',(.90,1,1),.05,.04,.8)
blue=material('Pixel cobalt',(.015,.10,.88),.3,.12,.12)
icy=material('Pixel ivory',(.85,.96,1),.18,.11,.05)
sun=material('Pixel sunlight',(1,.62,.05),.2,.1,.24)
palette=[]
for family,colors in [('Cyan',[(.005,.48,1),(.015,.54,1),(.004,.40,.88),(.015,.50,1)]),('Violet',[(.39,.012,.95),(.45,.025,1),(.42,.018,.96),(.36,.009,.85)]),('Rose',[(1,.20,.64),(1,.41,.78),(1,.68,.42),(1,.82,.36)])]:
 palette.extend(material('Voxel '+family+' '+str(i),c,.19,.11,.045) for i,c in enumerate(colors))

root=bpy.data.objects.new('HolographicProcess',None);scene.collection.objects.link(root)
groups=[];batch={};current=None
def mesh(name,verts,faces,mat,uv=False):
 me=bpy.data.meshes.new(name);me.from_pydata([xyz(p) for p in verts],[],faces);me.update()
 ob=bpy.data.objects.new(name,me);scene.collection.objects.link(ob);ob.parent=current;me.materials.append(mat)
 if uv:
  layer=me.uv_layers.new(name='Optical UV')
  for poly in me.polygons:
   for loop in poly.loop_indices:
    p=verts[me.loops[loop].vertex_index];layer.data[loop].uv=(p[0]/2.2+.5,p[1]/2.2+.5)
 return ob
def contour(w,r,n=10):
 pts=[]
 for cx,cy,start in [(w/2-r,w/2-r,0),(-w/2+r,w/2-r,90),(-w/2+r,-w/2+r,180),(w/2-r,-w/2+r,270)]:
  for j in range(n+1):
   a=math.radians(start+j*90/n);pts.append((cx+r*math.cos(a),cy+r*math.sin(a)))
 return pts
def lens(name,profiles,mat):
 verts=[]
 for w,r,z in profiles:verts.extend((x,y,z) for x,y in contour(w,r))
 n=len(contour(profiles[0][0],profiles[0][1]));faces=[]
 faces.append(tuple(reversed(range(n))))
 for k in range(len(profiles)-1):
  for j in range(n):faces.append((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j))
 faces.append(tuple(range((len(profiles)-1)*n,len(profiles)*n)))
 ob=mesh(name,verts,faces,mat,True)
 for p in ob.data.polygons:p.use_smooth=len(p.vertices)==4
 return ob
def rail(name,w,r,z,thickness=.009):
 out=contour(w,r);inside=contour(w-thickness*2,max(.01,r-thickness));n=len(out)
 verts=[(x,y,z) for x,y in out+inside];faces=[]
 for i in range(n):faces.append((i,(i+1)%n,n+(i+1)%n,n+i))
 mesh(name,verts,faces,white,True)

def rotate(p,angles):
 x,y,z=p;a,b,c=angles
 y,z=y*math.cos(a)-z*math.sin(a),y*math.sin(a)+z*math.cos(a)
 x,z=x*math.cos(b)+z*math.sin(b),-x*math.sin(b)+z*math.cos(b)
 x,y=x*math.cos(c)-y*math.sin(c),x*math.sin(c)+y*math.cos(c)
 return (x,y,z)
def box(center,size,mat,rotation=(0,0,0)):
 key=mat.name
 if key not in batch:batch[key]=([],[],mat)
 verts,faces,_=batch[key];start=len(verts)
 corners=[(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]
 for c in corners:
  q=rotate(tuple(c[k]*size[k]/2 for k in range(3)),rotation)
  verts.append(tuple(q[k]+center[k] for k in range(3)))
 for face in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:faces.append(tuple(start+i for i in face))
def cube_icon(x,y,size,family=0,n=4,z=.26):
 z=max(z,size*.8+.11)
 rotation=(.61,-.68,.0);unit=size/n
 for i in range(n):
  for j in range(n):
   for k in range(n):
    if i not in (0,n-1) and j not in (0,n-1) and k not in (0,n-1):continue
    p=rotate(((i+.5)*unit-size/2,(j+.5)*unit-size/2,(k+.5)*unit-size/2),rotation)
    box((x+p[0],y+p[1],z+p[2]),(unit*.995,)*3,palette[family*4+(1 if (i*17+j*7+k*3)%11==0 else 0)],rotation)
def line(a,b,unit=.043,mat=None,z=.17,dotted=False):
 mat=mat or palette[4];d=math.dist(a,b);count=max(1,round(d/unit))
 for i in range(count+1):
  if dotted and i%3==2:continue
  t=i/count;box((a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t,z),(unit,unit,.055),mat)
def plus(x,y,size=.15,mat=None,z=.2):
 mat=mat or sun;box((x,y,z),(size,.045,.075),mat);box((x,y,z),(.045,size,.075),mat)

FONT={
 'A':['01110','11011','11011','11111','11011','11011','11011'],
 'B':['11110','11011','11011','11110','11011','11011','11110'],
 'D':['11110','11011','11011','11011','11011','11011','11110'],
 'E':['11111','11000','11000','11110','11000','11000','11111'],
 'G':['01111','11000','11000','11011','11011','11011','01111'],
 'I':['11111','00100','00100','00100','00100','00100','11111'],
 'L':['11000','11000','11000','11000','11000','11000','11111'],
 'M':['11011','11111','11111','11011','11011','11011','11011'],
 'N':['11011','11111','11111','11111','11011','11011','11011'],
 'O':['01110','11011','11011','11011','11011','11011','01110'],
 'P':['11110','11011','11011','11110','11000','11000','11000'],
 'R':['11110','11011','11011','11110','11100','11010','11011'],
 'S':['01111','11000','11000','01110','00011','00011','11110'],
 'T':['11111','00100','00100','00100','00100','00100','00100'],
 'U':['11011','11011','11011','11011','11011','11011','01110'],
 'Y':['11011','11011','01110','00100','00100','00100','00100'],
 'C':['01111','11000','11000','11000','11000','11000','01111'],
}
def label(word):
 unit=min(.038,1.48/(len(word)*6-1));width=(len(word)*6-1)*unit
 for c,ch in enumerate(word):
  for row,bits in enumerate(FONT[ch]):
   for col,b in enumerate(bits):
    if b=='1':
     x=-width/2+(c*6+col+.5)*unit;y=-.79+(3-row)*unit
     box((x,y,.123),(unit*1.06,unit*1.06,.021),icy)
     box((x,y,.14),(unit*.94,unit*.94,.026),blue)

def idea():
 occupied=set()
 for x in range(-8,9):
  for y in range(-7,11):
   if (x/7.4)**2+((y-3)/7.9)**2<1 or (-3<=x<=5 and -8<=y<=-2):occupied.add((x,y))
 occupied.update([(-8,1),(-9,0),(-8,0),(-7,-1)])
 u=.061
 for x,y in occupied:
  edge=any((x+dx,y+dy) not in occupied for dx,dy in [(1,0),(-1,0),(0,1),(0,-1),(2,0),(-2,0),(0,2),(0,-2)])
  brain=(x*x+(y-3)**2<42)
  box((x*u-.04,y*u+.16,.15),(u*.995,u*.995,.075),icy if edge or not brain else palette[4])
 for dx,dy in [(0,0),(1,0),(-1,0),(0,1),(0,-1),(2,0),(-2,0),(0,2),(0,-2)]:box((dx*u-.04,dy*u+.34,.24),(u,u,.05),sun if abs(dx)+abs(dy)>1 else white)
 for side in [-1,1]:
  for y in [-.1,.18,.46]:line((side*.58,y),(side*.69,y+.07*(1 if y!=.18 else 0)),u,palette[5],.18)
def strategy():
 nodes=[(-.52,-.2),(.12,-.28),(.45,.16),(-.05,.39)]
 for a,b in zip(nodes,nodes[1:]):line(a,b,.045,palette[5])
 for x,y in nodes:
  for i,j in [(-1,-1),(0,-1),(1,-1),(-1,0),(1,0),(-1,1),(0,1),(1,1)]:box((x+i*.075,y+j*.075,.22),(.075,.075,.12),palette[(i+j)%4])
 line((.45,.16),(.45,.71),.045,palette[6],.21)
 for i in range(5):
  for j in range(3):box((.48+i*.043,.69-j*.043,.23),(.043,.043,.055),palette[8+(i+j)%4])
def design():
 cube_icon(-.04,.18,.43,0,5,.27)
 for a,b in [((-.38,-.26),(-.38,.54)),((-.38,.54),(.34,.54)),((.34,.54),(.34,-.26)),((.34,-.26),(-.38,-.26))]:line(a,b,.028,blue,.19,True)
 for x in [-.38,.34]:
  for y in [-.26,.54]:box((x,y,.22),(.105,.105,.04),blue);box((x,y,.247),(.045,.045,.018),icy)
 box((-.67,.12,.19),(.17,.60,.06),icy)
 for y,m in [(.32,palette[8]),(.12,palette[5]),(-.08,palette[1])]:box((-.67,y,.23),(.11,.14,.035),m)
 for j in range(-3,4):
  for i in range(-3,4):
   if i*i+j*j<=10:box((.62+i*.035,.39+j*.035,.21),(.035,.035,.05),palette[8+(i+j)%4])
 line((.48,.05),(.77,.05),.03,icy);line((.48,-.05),(.77,-.05),.03,icy)
 for j in range(5):
  for i in range(-j,j+1):box((.64+i*.024,-.16-j*.032,.22),(.024,.032,.05),palette[4+j%4])
 # Pixel cursor silhouette.
 for j in range(7):
  for i in range(j//2+1):box((.24+i*.043,-.05-j*.043,.35),(.043,.043,.035),icy if i>0 else blue)
 line((.30,-.26),(.40,-.40),.037,blue,.36)
def build():
 cube_icon(0,.48,.43,0,5,.31);cube_icon(-.46,-.16,.40,1,5,.29);cube_icon(.46,-.16,.40,2,5,.29)
 for dest in [(-.46,.03),(.46,.03),(0,-.26)]:
  line((dest[0]*.5,.31),(dest[0],.16),.031,blue,.25,True);line((dest[0],.16),dest,.031,blue,.25,True)
  line(dest,(dest[0]-.055,dest[1]+.075),.03,palette[1],.25);line(dest,(dest[0]+.055,dest[1]+.075),.03,palette[1],.25)
def system():
 center=(0,.11);neighbors=[(0,.58),(-.48,-.15),(.48,-.15)]
 for p in neighbors:line(center,p,.031,palette[1],.22)
 cube_icon(0,.10,.47,0,5,.33)
 for x,y in neighbors:cube_icon(x,y,.32,1,4,.28)
def product():
 for index,(y,family) in enumerate([(-.16,2),(-.025,1),(.12,0)]):
  before=set(scene.objects)
  lens('Product rounded layer '+str(index),[(.88,.10,-.04),(.89,.11,.015),(.86,.095,.055)],palette[family*4+1])
  rail('Product layer optical edge '+str(index),.86,.095,.057,.008)
  for obj in set(scene.objects)-before:
   for v in obj.data.vertices:
    p=(v.co.x,v.co.z,-v.co.y);p=rotate(rotate(p,(0,0,math.pi/4)),(.88,0,0))
    v.co=xyz((p[0],p[1]+y,p[2]+.26+index*.10))
   obj.data.update()
 # Top optical chip and central sparkle.
 before=set(scene.objects)
 lens('Product luminous crown',[(.56,.06,-.025),(.56,.06,.04)],palette[10])
 rail('Product crown white rim',.56,.06,.045,.009)
 for obj in set(scene.objects)-before:
  for v in obj.data.vertices:
   p=(v.co.x,v.co.z,-v.co.y);p=rotate(rotate(p,(0,0,math.pi/4)),(.88,0,0))
   v.co=xyz((p[0],p[1]+.24,p[2]+.78))
  obj.data.update()
 plus(0,.24,.16,white,.98)
 for x,y,m in [(-.56,.45,palette[1]),(.55,.48,palette[9]),(-.57,-.1,palette[5]),(.56,-.18,sun)]:plus(x,y,.18,m,.21)

# Reference-authored optical faces: preserve the supplied artwork on a real relief mesh.
# The spectrum, reflections and icon lighting are baked into the supplied face texture;
# the rolled perimeter and rear body remain fully modeled and respond to scene lighting.
refs=[
 ('IDEA','01_41_59 AM-1',(158,156,1097,1086)),
 ('STRATEGY','01_42_00 AM-2',(173,180,1085,1090)),
 ('DESIGN','01_42_02 AM-3',(130,146,1125,1128)),
 ('BUILD','01_42_03 AM-4',(133,165,1128,1136)),
 ('SYSTEM','01_42_04 AM-5',(171,180,1091,1093)),
 ('PRODUCT','01_42_05 AM-6',(133,152,1124,1125))]
for word,stamp,bounds in refs:
 current=bpy.data.objects.new('Face_'+word,None);scene.collection.objects.link(current);current.parent=root;groups.append(current)
 # Four mitered walls: at rest the six outer squares meet along exact cube edges.
 mesh(word+' mitered optical shell',[
  (-1.1,-1.1,0),(1.1,-1.1,0),(1.1,1.1,0),(-1.1,1.1,0),
  (-.94,-.94,-.16),(.94,-.94,-.16),(.94,.94,-.16),(-.94,.94,-.16)],
  [(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],rim,True)
 # A restrained optical trim follows the actual square perimeter.
 outer=[(-1.1,-1.1),(1.1,-1.1),(1.1,1.1),(-1.1,1.1)]
 inner=[(-1.065,-1.065),(1.065,-1.065),(1.065,1.065),(-1.065,1.065)]
 mesh(word+' precision spectral trim',[(x,y,.004) for x,y in outer+inner],[(i,(i+1)%4,(i+1)%4+4,i+4) for i in range(4)],rim,True)
 glintOuter=[(-1.066,-1.066),(1.066,-1.066),(1.066,1.066),(-1.066,1.066)]
 glintInner=[(-1.058,-1.058),(1.058,-1.058),(1.058,1.058),(-1.058,1.058)]
 mesh(word+' clean edge highlight',[(x,y,.006) for x,y in glintOuter+glintInner],[(i,(i+1)%4,(i+1)%4+4,i+4) for i in range(4)],white,True)
 image=bpy.data.images.load(os.path.join(r'C:/Users/Maahaan/Downloads','ChatGPT Image Oct 14, 2026, '+stamp+'.png'),check_existing=False)
 image.pack()
 mat=bpy.data.materials.new(word+' reference optical relief');mat.use_nodes=True
 nodes=mat.node_tree.nodes;nodes.clear()
 tex=nodes.new('ShaderNodeTexImage');tex.image=image;tex.interpolation='Linear'
 shader=nodes.new('ShaderNodeBsdfPrincipled');shader.inputs['Base Color'].default_value=(0,0,0,1)
 shader.inputs['Emission Strength'].default_value=1;shader.inputs['Roughness'].default_value=1
 output=nodes.new('ShaderNodeOutputMaterial')
 mat.node_tree.links.new(tex.outputs['Color'],shader.inputs['Emission Color'])
 mat.node_tree.links.new(tex.outputs['Alpha'],shader.inputs['Alpha'])
 mat.node_tree.links.new(shader.outputs[0],output.inputs['Surface'])
 mat.surface_render_method='DITHERED'
 # Flat artwork, as requested. The only thickness belongs to the optical body.
 outline=[(-1.065,-1.065),(1.065,-1.065),(1.065,1.065),(-1.065,1.065)]
 verts=[(0,0,.002)]+[(x,y,.002) for x,y in outline]
 faces=[(0,i+1,(i+1)%len(outline)+1) for i in range(len(outline))]
 ob=mesh(word+' flat reference face',verts,faces,mat)
 layer=ob.data.uv_layers.new(name='Reference projection');iw,ih=image.size;x0,y0,x1,y1=bounds
 for poly in ob.data.polygons:
  for loop in poly.loop_indices:
   x,y,_=verts[ob.data.loops[loop].vertex_index]
   u=.115+(x/2.13+.5)*.77;v=.115+(y/2.13+.5)*.77
   layer.data[loop].uv=((x0+u*(x1-x0))/iw,1-(y1-v*(y1-y0))/ih)

bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(BASE,'holographic-process.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True)
# Authoring contact sheet: independent panels, not flattened illustrations.
for i,o in enumerate(groups):o.location=xyz(((i%3-1)*2.55,(1-i//3)*2.55,0))
scene.world=bpy.data.worlds.new('Process studio world');scene.world.use_nodes=True
bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(.72,.83,1,1);bg.inputs['Strength'].default_value=.55
for name,loc,power,size in [('Wide white key',(-3,5,7),1500,5),('Cyan softbox',(-5,1,3),700,4),('Rose softbox',(4,3,3),950,4)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
 o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=xyz(loc);o.rotation_euler=(Vector(xyz((0,1,0)))-o.location).to_track_quat('-Z','Y').to_euler()
cd=bpy.data.cameras.new('Six panel portrait');cd.type='ORTHO';cd.ortho_scale=8.5
co=bpy.data.objects.new('Six panel portrait',cd);scene.collection.objects.link(co);co.location=xyz((0,1.2,13));co.rotation_euler=(Vector(xyz((0,1.2,0)))-co.location).to_track_quat('-Z','Y').to_euler();scene.camera=co
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=1500;scene.render.resolution_y=1050;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(BASE,'blender-panels-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE,'holographic-process.blend'))
print('Exported six voxel-relief panels: '+str(sum(len(o.data.polygons) for o in scene.objects if o.type=='MESH'))+' polygons')
def render_panels():
 bpy.ops.render.render(write_still=True)
 return None
bpy.app.timers.register(render_panels,first_interval=1)
