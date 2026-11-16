"""Build the reference 65% opal keyboard in a new Blender scene.
Each Key_* empty owns its cap and legends; RGB_Control['RGB'] drives all lighting.
Run in Blender's Python console: exec(compile(open(PATH, encoding='utf-8').read(), PATH, 'exec'))
"""
import bpy, math, json, os
from mathutils import Vector
from pathlib import Path
ROOT = Path(r'C:/Users/Maahaan/Desktop/📁 Projects - Web/nextjs-portfolio')
OUT = ROOT / 'public/models/hero-keyboard'
DESIGN = ROOT / 'design/hero-keyboard'
OUT.mkdir(parents=True, exist_ok=True); DESIGN.mkdir(parents=True, exist_ok=True)
scene = bpy.data.scenes.new('Hero Keyboard — Opal 65')
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = .01905
assets = bpy.data.collections.new('KEYBOARD — export'); scene.collection.children.link(assets)
studio = bpy.data.collections.new('STUDIO — render only'); scene.collection.children.link(studio)

def empty(name, parent=None):
    obj=bpy.data.objects.new(name,None); assets.objects.link(obj); obj.parent=parent; return obj
root=empty('Hero_Keyboard_Opal_65')
control=empty('RGB_Control',root);control['RGB']=1.0
control.id_properties_ui('RGB').update(min=0.0,max=1.0,description='0 = RGB off / 1 = RGB on. Controls the lower optical band and all switch lights.')
root['reference']='White opal case, ice-blue modifiers, orange Escape; cyan-to-pink RGB like the hero Start button.'
root['press_axis']='Local -Z in Blender; local -Y after glTF export';root['travel']=.105

def material(name, color, rough=.28, metal=0, coat=.35, trans=0):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    p.inputs['Coat Weight'].default_value=coat;p.inputs['Coat Roughness'].default_value=.13
    p.inputs['Transmission Weight'].default_value=trans;p.inputs['IOR'].default_value=1.46
    m.diffuse_color=(*color,1)
    return m
white=material('Ceramic white — soft satin',(.86,.89,.92),.24,.035,.48)
cap_white=material('Opal white keycaps',(.84,.89,.94),.24,0,.40,.035)
cap_blue=material('Glacier blue modifiers',(.57,.68,.79),.25,.025,.42,.025)
esc_mat=material('Tangerine Escape',(.98,.31,.11),.22,0,.55,.025)
tray=material('Recessed pearl switch plate',(.42,.50,.59),.3,.28,.32)
pearl=material('Lower optical diffuser — unlit',(.66,.76,.88),.25,.04,.5,.10)
metal=material('Polished pearl chamfer',(.72,.79,.87),.17,.6,.5)
ink=material('Legend — slate blue',(.006,.015,.026),.85,0,0)
next(n for n in ink.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Specular IOR Level'].default_value=0
white_ink=material('Escape legend',(.98,.97,.92),.3)
rubber=material('Foot silicone',(.15,.20,.25),.62)
dark=material('Inset black status window',(.018,.026,.04),.24,.15,.35)

def drive(socket, power=1):
    d=socket.driver_add('default_value').driver;d.type='SCRIPTED'
    v=d.variables.new();v.name='rgb';v.type='SINGLE_PROP';v.targets[0].id=control;v.targets[0].data_path='["RGB"]'
    d.expression=f'rgb*{power}'

def gradient(t):
    stops=[(0,(.02,.82,1)),(.30,(.10,.50,1)),(.60,(.42,.22,1)),(1,(1,.18,.72))]
    t=max(0,min(1,t))
    for (a,ca),(b,cb) in zip(stops,stops[1:]):
        if t<=b:
            f=(t-a)/(b-a);return tuple(ca[i]*(1-f)+cb[i]*f for i in range(3))
    return stops[-1][1]
light_mats=[]
for i in range(32):
    c=gradient(i/31)
    m=material(f'RGB_{i:02d} — switchable',(.60,.72,.86),.22,.02,.5,.10)
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Emission Color'].default_value=(*c,1);drive(p.inputs['Emission Strength'],1.8)
    for channel,value in enumerate(c):
        driver=p.inputs['Base Color'].driver_add('default_value',channel).driver
        var=driver.variables.new();var.name='rgb';var.type='SINGLE_PROP';var.targets[0].id=control;var.targets[0].data_path='["RGB"]'
        driver.expression=f'{[.60,.72,.86][channel]}*(1-rgb)+{value}*rgb'
    m['rgb_material']=True;m['rgb_color']=list(c);light_mats.append(m)
status=material('Warm status LED',(.98,.83,.43),.22)
sp=next(n for n in status.node_tree.nodes if n.type=='BSDF_PRINCIPLED');sp.inputs['Emission Color'].default_value=(1,.86,.48,1);sp.inputs['Emission Strength'].default_value=.7

def attach(obj,mat,parent=root):
    assets.objects.link(obj);obj.parent=parent
    if mat:obj.data.materials.append(mat)
    return obj

def rr(w,d,r,n=8):
    points=[]
    for cx,cy,a in [(w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180),(w/2-r,-d/2+r,270)]:
        for i in range(n+1):
            theta=math.radians(a+i*90/n);points.append((cx+r*math.cos(theta),cy+r*math.sin(theta)))
    return points

def optical_perimeter(w,d,r):
    points=rr(w,d,r); out=[]
    for i,a in enumerate(points):
        z=points[(i+1)%len(points)]
        steps=40 if abs(z[0]-a[0])>2 else 12 if abs(z[1]-a[1])>2 else 1
        out.extend((a[0]+(z[0]-a[0])*k/steps,a[1]+(z[1]-a[1])*k/steps) for k in range(steps))
    return out

def loft(name,rings,mat,parent=root,loc=(0,0,0),bottom=True,top=True):
    sampler=optical_perimeter if name=="RGB optical perimeter" else rr
    verts=[]
    for w,d,r,z in rings:verts.extend((x,y,z) for x,y in sampler(w,d,r))
    n=len(sampler(*rings[0][:3]));faces=[]
    if bottom:faces.append(tuple(reversed(range(n))))
    for j in range(len(rings)-1):
        for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    if top:faces.append(tuple((len(rings)-1)*n+i for i in range(n)))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);attach(obj,mat,parent);obj.location=loc
    for face in mesh.polygons:face.use_smooth=True
    return obj

def rounded(name,w,d,h,r,z,mat,loc=(0,0),parent=root):
    b=min(h*.28,.065)
    obj=loft(name,[(w-2*b,d-2*b,max(.025,r-b),0),(w,d,r,b),(w,d,r,h-b),(w-2*b,d-2*b,max(.025,r-b),h)],mat,parent,(loc[0],loc[1],z))
    return obj

W,D=16.85,5.80
rounded('Pearl lower housing',W,D,.102,.39,.09,pearl)
rounded('White upper enclosure',W,D,.48,.39,.39,white)
rounded('Pearl rim under the keybed',16.47,5.36,.07,.25,.865,metal)
rounded('Recessed switch plate',16.29,5.19,.045,.22,.91,tray)
# A continuous optical band around the bottom, with smooth spatial colour sampling.
band=loft('RGB optical perimeter',[(16.78,5.73,.36,0),(16.88,5.83,.40,.045),(16.88,5.83,.40,.15),(16.78,5.73,.36,.20)],None,root,(0,0,.185))
for m in light_mats:band.data.materials.append(m)
for poly in band.data.polygons:
    x=sum(band.data.vertices[i].co.x for i in poly.vertices)/len(poly.vertices)
    poly.material_index=max(0,min(31,round((x/W+.5)*31)))
# Faceplate and light reproduce the inset hardware detail of the hero Start button.
rounded('Front status bezel',1.60,.035,.25,.11,.48,metal,loc=(0,-D/2-.018))
rounded('Front status black inset',1.38,.046,.14,.055,.535,dark,loc=(0,-D/2-.042))
rounded('Front warm status LED',.20,.052,.075,.032,.568,status,loc=(.47,-D/2-.065))
# Low-profile silicone feet and tiny recessed screws underneath.
for x in [-6.9,6.9]:
    for y in [-2.1,2.1]:
        rounded(f'Silicone foot {x} {y}',.85,.52,.12,.22,0,rubber,(x,y))
for x in [-6.8,6.8]:
    for y in [-1.85,1.85]:rounded(f'Underside fastener {x} {y}',.11,.11,.015,.05,.084,metal,(x,y))

font=bpy.data.fonts.load('C:/Windows/Fonts/segoeui.ttf')
symbol_font=bpy.data.fonts.load('C:/Windows/Fonts/seguisym.ttf')
layout=[
 [('Escape','esc',1)]+[(str(i),str(i),1) for i in range(1,10)]+[('0','0',1),('Minus','−',1),('Equal','=',1),('Backspace','← backspace',2),('Home','home',1)],
 [('Tab','tab',1.5)]+[(c,c,1) for c in 'QWERTYUIOP']+[('BracketLeft','[',1),('BracketRight',']',1),('Backslash','\\',1.5),('PageUp','page\nup',1)],
 [('CapsLock','caps lock',1.75)]+[(c,c,1) for c in 'ASDFGHJKL']+[('Semicolon',';',1),('Quote',"'",1),('Enter','↵ enter',2.25),('PageDown','page\ndown',1)],
 [('ShiftLeft','shift',2.25)]+[(c,c,1) for c in 'ZXCVBNM']+[('Comma',',',1),('Period','.',1),('Slash','/',1),('ShiftRight','shift',1.75),('ArrowUp','↑',1),('End','end',1)],
 [('ControlLeft','control',1.25),('AltLeft','option',1.25),('MetaLeft','command',1.25),('Space','',6.25),('MetaRight','⌘',1),('Fn1','fn1',1),('Fn2','fn2',1),('ArrowLeft','←',1),('ArrowDown','↓',1),('ArrowRight','→',1)]
]
manifest=[]
key_meshes={}

def label(name,body,parent,size,y=0,z=.495,mat=ink):
    curve=bpy.data.curves.new(name,'FONT');curve.body=body;curve.font=symbol_font if '⌘' in body else font
    curve.align_x='CENTER';curve.align_y='CENTER';curve.size=size;curve.space_line=.85;curve.resolution_u=4
    obj=bpy.data.objects.new(name,curve);attach(obj,mat,parent);obj.location=(0,y,z)
    if len(body)==1:obj.scale=(1.85,1.85,1)
    return obj

for row,entries in enumerate(layout):
    assert abs(sum(v[2] for v in entries)-16)<.001,(row,sum(v[2] for v in entries))
    offset=-8
    for col,(code,legend,u) in enumerate(entries):
        x=offset+u/2;y=2-row;offset+=u
        z=.965+max(0,2-row)*.025
        key=empty('Key_'+code,root);key.location=(x,y,z)
        key['code']=code;key['legend']=legend;key['rest_z']=z;key['travel']=.105;key['row']=row;key['u']=u
        width=u-.095;depth=.905
        mat=esc_mat if code=='Escape' else cap_white if len(code)==1 or code in ['Minus','Equal','BracketLeft','BracketRight','Semicolon','Quote','Comma','Period','Slash','Backslash','Space'] else cap_blue
        cache_key=(round(width,3),mat.name)
        if cache_key in key_meshes:
            cap=bpy.data.objects.new('Cap_'+code,key_meshes[cache_key]);assets.objects.link(cap);cap.parent=key
        else:
            cap=loft('Cap_'+code,[(width,depth,.17,0),(width,depth,.17,.065),(width*.96,depth*.96,.17,.25),(width*.88,depth*.90,.15,.455),(width*.79,depth*.80,.14,.50),(width*.52,depth*.53,.10,.465),(width*.20,depth*.21,.04,.455)],mat,key)
            # Center of the key is deliberately lower than its rounded lip.
            key_meshes[cache_key]=cap.data
        glow=rounded('RGB socket_'+code,width+.015,depth+.015,.075,.15,-.035,light_mats[max(0,min(31,round((x/16+.5)*31)))],parent=key)
        if legend:
            size=.235 if len(legend)==1 else .155 if len(legend)<8 else .13
            label('Legend_'+code,legend,key,size,y=.005,mat=white_ink if code=='Escape' else ink)
        if row==0 and col>0 and col<13:
            label('Fn legend_'+code,'F'+str(col),key,.105,y=-.225,z=.48)
        manifest.append({'node':key.name,'code':code,'legend':legend,'row':row,'units':u,'rest':[x,y,z],'travel':.105})

# A clearly named root property drives both shader emission and coloured bounce light.
def area(name,pos,color,power,size,target=(0,0,.6),rgb=False):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);studio.objects.link(obj);obj.location=pos;obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    if rgb:drive(data,'energy') if False else None
    return obj
area('Large softbox',(-5,-4,12),(1,.96,.92),1650,9)
area('Cool fill',(6,2,9),(.77,.87,1),1100,7)
area('White rim',(-2,7,7),(1,1,1),1400,6)
for name,pos,c in [('RGB cyan bounce',(-5,-.5,1.8),(.18,.85,1)),('RGB pink bounce',(5,.5,1.8),(1,.28,.75))]:
    light=area(name,pos,c,0,4,target=(0,0,.5))
    d=light.data.driver_add('energy').driver;v=d.variables.new();v.name='rgb';v.type='SINGLE_PROP';v.targets[0].id=control;v.targets[0].data_path='["RGB"]';d.expression='rgb*85'
world=bpy.data.worlds.new('Soft grey studio world');world.use_nodes=True;scene.world=world
background=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');background.inputs['Color'].default_value=(.38,.44,.55,1);background.inputs['Strength'].default_value=.38
camera_data=bpy.data.cameras.new('Keyboard product camera');cam=bpy.data.objects.new('Keyboard product camera',camera_data);studio.objects.link(cam);scene.camera=cam
cam.location=(7,-12,16);cam.rotation_euler=(Vector((0,0,.7))-cam.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=20.2;camera_data.lens=52
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=False
scene.render.resolution_x=1500;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.view_settings.view_transform='AgX'
scene.render.fps=30;scene.frame_start=1;scene.frame_end=180
# Example physical typing. Each letter's root moves with its own legends and socket.
letters='MAKE IT REAL.'
lookup={o['code']:o for o in assets.objects if o.name.startswith('Key_')}
frame=38
for char in letters:
    code={' ':'Space','.':'Period'}.get(char,char);key=lookup[code];z=key['rest_z']
    for f,dz in [(frame,0),(frame+2,-.105),(frame+4,-.105),(frame+10,0)]:
        key.location.z=z+dz;key.keyframe_insert('location',index=2,frame=f,group='Physical key travel')
    frame+=7 if char!=' ' else 11
scene.frame_set(1)
# Convert only the model's font geometry for a portable GLB; all legend nodes remain separate.
for obj in list(assets.objects):
    if obj.type=='FONT':
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH')
# Keep references and the controls discoverable in the file.
notes=bpy.data.texts.new('READ ME — Hero keyboard')
notes.write('OPAL 65\n\nRGB_Control > Custom Properties > RGB: 0 off, 1 on.\nEvery key is a Key_* empty with its own cap, legend and RGB socket.\nFrame 1 = neutral product pose. Frames 38–150 = MAKE IT REAL. physical typing demo.\nBlender dimensions are in 19.05 mm key units. GLB node names and keyboard-manifest.json map keys for the website.\nThe studio camera, lighting and existing original scene are preserved separately.\n')
(DESIGN/'keyboard-manifest.json').write_text(json.dumps({'name':'Opal 65','pitchMeters':.01905,'rgbControl':'RGB_Control.RGB','keys':manifest},indent=2),encoding='utf-8')
bpy.ops.object.select_all(action='DESELECT')
root.select_set(True);bpy.context.view_layer.objects.active=root
for area_ in bpy.context.screen.areas:
    if area_.type=='VIEW_3D':
        area_.spaces.active.region_3d.view_perspective='CAMERA';area_.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(DESIGN/'hero-keyboard-opal65.blend'))
print(json.dumps({'scene':scene.name,'keys':len(manifest),'objects':len(assets.objects),'blend':str(DESIGN/'hero-keyboard-opal65.blend')}))
