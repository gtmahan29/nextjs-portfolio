"""Keep the local demo's vendored Three.js modules to their import closure."""
from pathlib import Path
import re, shutil
base=Path(__file__).resolve().parent.parent
source=base/'node_modules'/'three'
destination=base/'public'/'golden-cube'/'vendor'
entries=['controls/OrbitControls.js','loaders/GLTFLoader.js','environments/RoomEnvironment.js',
         'postprocessing/EffectComposer.js','postprocessing/RenderPass.js',
         'postprocessing/UnrealBloomPass.js','postprocessing/OutputPass.js']
needed=set()
def visit(path):
    path=path.resolve()
    if path in needed:return
    path.relative_to(source.resolve())
    needed.add(path)
    if path.suffix=='.js':
        for imp in re.findall(r"(?:from\s*|import\s*)['\"]([^'\"]+)['\"]",path.read_text(encoding='utf8')):
            if imp.startswith('.'):visit(path.parent/imp)
for entry in entries:visit(source/'examples'/'jsm'/entry)
keep=set()
for path in needed:
    rel=path.relative_to(source/'examples'/'jsm')
    dst=destination/'addons'/rel; dst.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(path,dst); keep.add(dst.resolve())
for path in (destination/'addons').rglob('*'):
    if path.is_file() and path.resolve() not in keep:
        path.resolve().relative_to((destination/'addons').resolve())
        path.unlink()
shutil.copy2(source/'build'/'three.module.js',destination/'three.module.js')
shutil.copy2(source/'LICENSE',destination/'LICENSE')
print(f'Local demo: {len(needed)} addon modules + Three.js core')
