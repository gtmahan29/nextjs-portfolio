"""Phone variants of the Meshy resident characters.

The originals ship three 2048-4096 px JPEGs each (colour, normal, metal/roughness) and every
animation Meshy exported. The journey only reads the colour map (meshy-surface.ts discards the
others) and three clips (meshy-residents.ts: Walking, one talk clip, Sitting_Answering_Questions),
while each character is a few dozen pixels tall on a phone. Decoding a 4096 px JPEG alone takes
64 MB, and six characters held ~190 MB of GPU memory: enough for iOS Safari to kill the tab.

This writes public/3d-models-glb/mobile/<same name>.glb with:
  - only the clips the scene uses,
  - no normal / metallic-roughness textures,
  - the colour map resized to at most MAX_SIZE px.
Run: python scripts/make-meshy-mobile.py
"""
import io
import json
import os
import struct
import sys

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..", "public", "3d-models-glb")
OUT = os.path.join(ROOT, "mobile")
MAX_SIZE = 512
# Same order as MESHY_ASSETS in components/journey/meshy-population-layout.ts;
# the talk clip is TALK_CLIPS[index] in components/journey/meshy-residents.ts.
ASSETS = [
    ("Meshy_AI_Blueprint_Dreamer_All_Animations.glb", "Talk_with_Hands_Open"),
    ("Meshy_AI_Shadow_Scout_All_Animations.glb", ""),
    ("Meshy_AI_3D_Female_Crafter_Ava_All_Animations.glb", "Talk_with_Hands_Open"),
    ("Meshy_AI_Midnight_Scholar_All_Animations.glb", "Talk_Passionately"),
    ("Meshy_AI_Minimal_Muse_All_Animations.glb", "Talk_with_Right_Hand_Open"),
    ("Meshy_AI_Faceless_Boy_in_Coral_1012210722_texture.glb", ""),
]
DROP_TEXTURES = ("normalTexture",)
DROP_PBR_TEXTURES = ("metallicRoughnessTexture",)


def read_glb(path):
    data = open(path, "rb").read()
    magic, _, _ = struct.unpack_from("<4sII", data, 0)
    assert magic == b"glTF", path
    offset, doc, binary = 12, None, b""
    while offset < len(data):
        length, kind = struct.unpack_from("<I4s", data, offset)
        chunk = data[offset + 8: offset + 8 + length]
        if kind == b"JSON":
            doc = json.loads(chunk)
        elif kind == b"BIN\x00":
            binary = chunk
        offset += 8 + length
    return doc, binary


def pad(blob, fill):
    return blob + fill * ((4 - len(blob) % 4) % 4)


def texture_refs(value):
    """Every {"index": n} texture reference inside a material."""
    if isinstance(value, dict):
        if "index" in value and isinstance(value["index"], int) and set(value) <= {"index", "texCoord", "scale", "strength", "extensions", "extras"}:
            yield value
        for child in value.values():
            yield from texture_refs(child)
    elif isinstance(value, list):
        for child in value:
            yield from texture_refs(child)


def convert(name, talk):
    doc, binary = read_glb(os.path.join(ROOT, name))
    assert all(b.get("uri") is None for b in doc.get("buffers", [])), "external buffers"
    assert not any("sparse" in a for a in doc.get("accessors", [])), "sparse accessors"

    keep = {"Walking", "Sitting_Answering_Questions"} | ({talk} if talk else set())
    doc["animations"] = [a for a in doc.get("animations", []) if a.get("name") in keep]

    for material in doc.get("materials", []):
        for key in DROP_TEXTURES:
            material.pop(key, None)
        pbr = material.get("pbrMetallicRoughness", {})
        for key in DROP_PBR_TEXTURES:
            pbr.pop(key, None)

    # Textures and images still referenced.
    refs = [ref for m in doc.get("materials", []) for ref in texture_refs(m)]
    used_textures = sorted({r["index"] for r in refs})
    texture_map = {old: new for new, old in enumerate(used_textures)}
    for r in refs:
        r["index"] = texture_map[r["index"]]
    textures = [doc["textures"][i] for i in used_textures]
    used_images = sorted({t["source"] for t in textures if "source" in t})
    image_map = {old: new for new, old in enumerate(used_images)}
    for t in textures:
        if "source" in t:
            t["source"] = image_map[t["source"]]
    doc["textures"] = textures
    images = [doc["images"][i] for i in used_images]

    # Accessors reachable from meshes, skins and the kept clips.
    used_acc = set()
    for mesh in doc.get("meshes", []):
        for prim in mesh["primitives"]:
            used_acc.update(prim["attributes"].values())
            if "indices" in prim:
                used_acc.add(prim["indices"])
            for target in prim.get("targets", []):
                used_acc.update(target.values())
    for skin in doc.get("skins", []):
        if "inverseBindMatrices" in skin:
            used_acc.add(skin["inverseBindMatrices"])
    for anim in doc["animations"]:
        for sampler in anim["samplers"]:
            used_acc.update((sampler["input"], sampler["output"]))
    acc_list = sorted(used_acc)
    acc_map = {old: new for new, old in enumerate(acc_list)}
    accessors = [doc["accessors"][i] for i in acc_list]
    for mesh in doc.get("meshes", []):
        for prim in mesh["primitives"]:
            prim["attributes"] = {k: acc_map[v] for k, v in prim["attributes"].items()}
            if "indices" in prim:
                prim["indices"] = acc_map[prim["indices"]]
            prim["targets"] = [{k: acc_map[v] for k, v in t.items()} for t in prim.get("targets", [])]
            if not prim["targets"]:
                prim.pop("targets")
    for skin in doc.get("skins", []):
        if "inverseBindMatrices" in skin:
            skin["inverseBindMatrices"] = acc_map[skin["inverseBindMatrices"]]
    for anim in doc["animations"]:
        for sampler in anim["samplers"]:
            sampler["input"] = acc_map[sampler["input"]]
            sampler["output"] = acc_map[sampler["output"]]

    # Resize the kept images; rebuild the binary from the views still in use.
    image_bytes = {}
    for image in images:
        view = doc["bufferViews"][image["bufferView"]]
        start = view.get("byteOffset", 0)
        source = Image.open(io.BytesIO(binary[start: start + view["byteLength"]]))
        scale = MAX_SIZE / max(source.size)
        if scale < 1:
            source = source.resize((round(source.width * scale), round(source.height * scale)), Image.LANCZOS)
        out = io.BytesIO()
        if image.get("mimeType") == "image/png":
            source.save(out, "PNG", optimize=True)
        else:
            source.convert("RGB").save(out, "JPEG", quality=88, optimize=True)
            image["mimeType"] = "image/jpeg"
        image_bytes[image["bufferView"]] = out.getvalue()

    used_views = sorted({a["bufferView"] for a in accessors if "bufferView" in a} | set(image_bytes))
    view_map = {old: new for new, old in enumerate(used_views)}
    blob, views = bytearray(), []
    for old in used_views:
        view = dict(doc["bufferViews"][old])
        start = view.get("byteOffset", 0)
        data = image_bytes.get(old, binary[start: start + view["byteLength"]])
        while len(blob) % 4:
            blob.append(0)
        view["byteOffset"], view["byteLength"], view["buffer"] = len(blob), len(data), 0
        blob.extend(data)
        views.append(view)
    for a in accessors:
        if "bufferView" in a:
            a["bufferView"] = view_map[a["bufferView"]]
    for image in images:
        image["bufferView"] = view_map[image["bufferView"]]

    doc["accessors"], doc["bufferViews"], doc["images"] = accessors, views, images
    doc["buffers"] = [{"byteLength": len(blob)}]

    json_chunk = pad(json.dumps(doc, separators=(",", ":")).encode(), b" ")
    bin_chunk = pad(bytes(blob), b"\x00")
    total = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
    os.makedirs(OUT, exist_ok=True)
    target = os.path.join(OUT, name)
    with open(target, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<I4s", len(json_chunk), b"JSON") + json_chunk)
        f.write(struct.pack("<I4s", len(bin_chunk), b"BIN\x00") + bin_chunk)
    before, after = os.path.getsize(os.path.join(ROOT, name)), os.path.getsize(target)
    print(f"{name}: {before / 1e6:.1f} MB -> {after / 1e6:.2f} MB, clips {[a['name'] for a in doc['animations']]}")


if __name__ == "__main__":
    for name, talk in ASSETS:
        convert(name, talk)
    sys.exit(0)
