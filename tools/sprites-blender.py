# tools/sprites-blender.py — procedural class sprites, rendered in Blender.
#
# Builds the three classes as stylized low-poly figures (flat-shaded primitives,
# dark-fantasy palette, warm key + cool rim light) and renders one transparent
# PNG per class x accent tint, so the co-op accent system keeps working with
# real art. Deterministic: re-running regenerates identical sprites.
#
#   blender --background --factory-startup --python tools/sprites-blender.py -- <outDir>
#
# Output: <outDir>/<classId>_<tintId>.png at 300x380 (2x the in-game 150x190).

import bpy
import math
import os
import sys

OUT = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
os.makedirs(OUT, exist_ok=True)

# The game's accent palette (styles/base.css).
TINTS = {
    "gold": (0xC9, 0xA2, 0x27),
    "ember": (0xC9, 0x50, 0x2E),
    "frost": (0x7F, 0xA8, 0xC9),
    "rot": (0xB5, 0x54, 0x1C),
    "grace": (0x9F, 0xC3, 0xE8),
}


def srgb(r, g, b, a=1.0):
    def lin(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b), a)


def make_mat(name, rgba, metallic=0.0, rough=0.85, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = rgba
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = rgba
        b.inputs["Emission Strength"].default_value = emit
    return m


# Shared materials (accent's color is swapped per tint before each render).
ACCENT = make_mat("accent", srgb(*TINTS["gold"]), metallic=0.55, rough=0.35, emit=0.55)
CLOTH_DARK = make_mat("clothDark", srgb(0x2A, 0x22, 0x16))
LEATHER = make_mat("leather", srgb(0x3A, 0x32, 0x26))
ARMOR = make_mat("armor", srgb(0x4A, 0x40, 0x34), metallic=0.35, rough=0.55)
STEEL = make_mat("steel", srgb(0xB8, 0xB0, 0xA0), metallic=0.75, rough=0.35)
ROBE_BLUE = make_mat("robeBlue", srgb(0x2B, 0x25, 0x47))
ROBE_BLUE_LT = make_mat("robeBlueLt", srgb(0x3A, 0x33, 0x58))
ROBE_RED = make_mat("robeRed", srgb(0x2E, 0x1F, 0x1F))
HOOD_DARK = make_mat("hoodDark", srgb(0x24, 0x14, 0x13))
NEAR_BLACK = make_mat("nearBlack", srgb(0x0E, 0x0A, 0x08))
WOOD = make_mat("wood", srgb(0x6B, 0x5D, 0x45))
SKIN = make_mat("skin", srgb(0x46, 0x3C, 0x2E))

_parts = []


def part(op, mat, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), **kw):
    op(location=loc, rotation=(math.radians(rot[0]), math.radians(rot[1]), math.radians(rot[2])), **kw)
    ob = bpy.context.active_object
    ob.scale = scale
    ob.data.materials.append(mat)
    for poly in ob.data.polygons:
        poly.use_smooth = False
    _parts.append(ob)
    return ob


def clear_parts():
    global _parts
    for ob in _parts:
        bpy.data.objects.remove(ob, do_unlink=True)
    _parts = []


cone = bpy.ops.mesh.primitive_cone_add
uv = bpy.ops.mesh.primitive_uv_sphere_add
ico = bpy.ops.mesh.primitive_ico_sphere_add
cyl = bpy.ops.mesh.primitive_cylinder_add
cube = bpy.ops.mesh.primitive_cube_add
torus = bpy.ops.mesh.primitive_torus_add


# ---- the three classes (camera looks from -Y; "front" is -Y) ----------------
def build_vagabond():
    # cloak + boots
    part(cone, LEATHER, loc=(0, 0, 0.6), vertices=9, radius1=0.5, radius2=0.17, depth=1.2)
    part(cube, NEAR_BLACK, loc=(-0.14, 0, 0.05), scale=(0.09, 0.13, 0.05))
    part(cube, NEAR_BLACK, loc=(0.14, 0, 0.05), scale=(0.09, 0.13, 0.05))
    # chest + pauldrons
    part(cube, ARMOR, loc=(0, 0, 1.06), scale=(0.30, 0.20, 0.22), rot=(0, 0, 0))
    part(ico, ARMOR, loc=(-0.36, 0, 1.24), subdivisions=2, radius=0.17)
    part(ico, ARMOR, loc=(0.36, 0, 1.24), subdivisions=2, radius=0.17)
    # helm + crest band + visor slit
    part(uv, ARMOR, loc=(0, 0, 1.46), segments=14, ring_count=10, radius=0.175)
    part(torus, ACCENT, loc=(0, 0, 1.50), major_radius=0.165, minor_radius=0.022)
    part(cube, NEAR_BLACK, loc=(0, -0.155, 1.44), scale=(0.10, 0.03, 0.022))
    # greatsword (blade, tip, crossguard, grip, pommel)
    part(cube, STEEL, loc=(0.60, 0, 0.86), scale=(0.045, 0.016, 0.42))
    part(cone, STEEL, loc=(0.60, 0, 0.38), rot=(180, 0, 0), vertices=4, radius1=0.045, radius2=0.0, depth=0.12)
    part(cube, ACCENT, loc=(0.60, 0, 1.30), scale=(0.15, 0.03, 0.028))
    part(cyl, NEAR_BLACK, loc=(0.60, 0, 1.42), vertices=8, radius=0.024, depth=0.20)
    part(ico, ACCENT, loc=(0.60, 0, 1.55), subdivisions=2, radius=0.045)
    # chest medallion
    part(cyl, ACCENT, loc=(0, -0.225, 1.06), rot=(90, 0, 0), vertices=12, radius=0.055, depth=0.03)


def build_astrologer():
    # robe + shoulders + sash (raised so the head sits ON the body, no gap)
    part(cone, ROBE_BLUE, loc=(0, 0, 0.65), vertices=10, radius1=0.44, radius2=0.15, depth=1.3)
    part(cone, ROBE_BLUE_LT, loc=(0, -0.02, 1.16), vertices=10, radius1=0.27, radius2=0.14, depth=0.42)
    part(ico, ROBE_BLUE_LT, loc=(-0.23, 0, 1.30), subdivisions=2, radius=0.12)
    part(ico, ROBE_BLUE_LT, loc=(0.23, 0, 1.30), subdivisions=2, radius=0.12)
    # head under a wide-brim wizard hat with an accent band (tip kept in frame)
    part(uv, SKIN, loc=(0, 0, 1.44), segments=12, ring_count=8, radius=0.15)
    part(cone, ROBE_BLUE, loc=(0, 0, 1.58), vertices=12, radius1=0.50, radius2=0.30, depth=0.10)
    part(cone, ROBE_BLUE, loc=(0, 0.03, 1.80), rot=(-7, 0, 0), vertices=10, radius1=0.24, radius2=0.015, depth=0.44)
    part(torus, ACCENT, loc=(0, 0.005, 1.645), major_radius=0.245, minor_radius=0.026)
    # star-topped staff + drifting sparks
    part(cyl, WOOD, loc=(-0.54, 0, 0.88), vertices=8, radius=0.022, depth=1.62)
    part(ico, ACCENT, loc=(-0.54, 0, 1.80), subdivisions=1, radius=0.085)
    part(ico, ACCENT, loc=(-0.30, -0.08, 1.32), subdivisions=1, radius=0.030)
    part(ico, ACCENT, loc=(0.38, -0.08, 0.72), subdivisions=1, radius=0.024)
    # belt clasp
    part(cyl, ACCENT, loc=(0, -0.30, 0.92), rot=(90, 0, 0), vertices=10, radius=0.045, depth=0.03)


def build_prophet():
    # robe + rope belt
    part(cone, ROBE_RED, loc=(0, 0, 0.62), vertices=9, radius1=0.46, radius2=0.19, depth=1.24)
    part(torus, CLOTH_DARK, loc=(0, 0, 0.88), major_radius=0.30, minor_radius=0.030)
    # hood with a shadowed face
    part(uv, HOOD_DARK, loc=(0, 0.02, 1.42), segments=12, ring_count=8, radius=0.21)
    part(uv, NEAR_BLACK, loc=(0, -0.075, 1.40), segments=10, ring_count=6, radius=0.135)
    part(cone, HOOD_DARK, loc=(0, 0.10, 1.60), rot=(18, 0, 0), vertices=8, radius1=0.16, radius2=0.02, depth=0.30)
    # halo behind the hood
    part(torus, ACCENT, loc=(0, 0.16, 1.55), rot=(90, 0, 0), major_radius=0.30, minor_radius=0.020)
    # prayer beads arced across the waist
    for i, x in enumerate((-0.20, -0.10, 0.0, 0.10, 0.20)):
        dz = 0.035 * (1 - abs(x) / 0.22)
        part(ico, ACCENT, loc=(x, -0.315, 0.80 - dz), subdivisions=1, radius=0.032)


# ---- stage: camera, lights, film -------------------------------------------
scene = bpy.context.scene
for ob in list(scene.objects):
    bpy.data.objects.remove(ob, do_unlink=True)

bpy.ops.object.camera_add(location=(0, -8, 0.98), rotation=(math.radians(90), 0, 0))
cam = bpy.context.active_object
cam.data.type = "ORTHO"
cam.data.ortho_scale = 2.15
scene.camera = cam

bpy.ops.object.light_add(type="SUN", rotation=(math.radians(55), 0, math.radians(-28)))
key = bpy.context.active_object
key.data.energy = 3.4
key.data.color = (1.0, 0.94, 0.82)

bpy.ops.object.light_add(type="SUN", rotation=(math.radians(-118), 0, math.radians(146)))
rim = bpy.context.active_object
rim.data.energy = 5.0
rim.data.color = (0.72, 0.82, 1.0)

bpy.ops.object.light_add(type="SUN", rotation=(math.radians(80), 0, math.radians(35)))
fill = bpy.context.active_object
fill.data.energy = 0.7
fill.data.color = (0.9, 0.85, 1.0)

scene.render.film_transparent = True
scene.render.resolution_x = 300
scene.render.resolution_y = 380
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "Standard"  # punchy flat colors, no AgX
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except Exception:
    scene.render.engine = "BLENDER_EEVEE"

# ---- render every class x tint ----------------------------------------------
accent_bsdf = ACCENT.node_tree.nodes["Principled BSDF"]
builders = {"vagabond": build_vagabond, "astrologer": build_astrologer, "prophet": build_prophet}
count = 0
for class_id, build in builders.items():
    build()
    for tint_id, rgb in TINTS.items():
        rgba = srgb(*rgb)
        accent_bsdf.inputs["Base Color"].default_value = rgba
        accent_bsdf.inputs["Emission Color"].default_value = rgba
        scene.render.filepath = os.path.join(OUT, f"{class_id}_{tint_id}.png")
        bpy.ops.render.render(write_still=True)
        count += 1
    clear_parts()

print(f"SPRITES OK: {count} renders -> {OUT}")
