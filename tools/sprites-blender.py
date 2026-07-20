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


def part(op, mat, loc=(0, 0, 0), blight=(0, 0, 0), scale=(1, 1, 1), **kw):
    op(location=loc, rotation=(math.radians(blight[0]), math.radians(blight[1]), math.radians(blight[2])), **kw)
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
def build_reaver():
    # cloak + boots
    part(cone, LEATHER, loc=(0, 0, 0.6), vertices=9, radius1=0.5, radius2=0.17, depth=1.2)
    part(cube, NEAR_BLACK, loc=(-0.14, 0, 0.05), scale=(0.09, 0.13, 0.05))
    part(cube, NEAR_BLACK, loc=(0.14, 0, 0.05), scale=(0.09, 0.13, 0.05))
    # chest + pauldrons
    part(cube, ARMOR, loc=(0, 0, 1.06), scale=(0.30, 0.20, 0.22), blight=(0, 0, 0))
    part(ico, ARMOR, loc=(-0.36, 0, 1.24), subdivisions=2, radius=0.17)
    part(ico, ARMOR, loc=(0.36, 0, 1.24), subdivisions=2, radius=0.17)
    # helm + crest band + visor slit
    part(uv, ARMOR, loc=(0, 0, 1.46), segments=14, ring_count=10, radius=0.175)
    part(torus, ACCENT, loc=(0, 0, 1.50), major_radius=0.165, minor_radius=0.022)
    part(cube, NEAR_BLACK, loc=(0, -0.155, 1.44), scale=(0.10, 0.03, 0.022))
    # greatsword (blade, tip, crossguard, grip, pommel)
    part(cube, STEEL, loc=(0.60, 0, 0.86), scale=(0.045, 0.016, 0.42))
    part(cone, STEEL, loc=(0.60, 0, 0.38), blight=(180, 0, 0), vertices=4, radius1=0.045, radius2=0.0, depth=0.12)
    part(cube, ACCENT, loc=(0.60, 0, 1.30), scale=(0.15, 0.03, 0.028))
    part(cyl, NEAR_BLACK, loc=(0.60, 0, 1.42), vertices=8, radius=0.024, depth=0.20)
    part(ico, ACCENT, loc=(0.60, 0, 1.55), subdivisions=2, radius=0.045)
    # chest medallion
    part(cyl, ACCENT, loc=(0, -0.225, 1.06), blight=(90, 0, 0), vertices=12, radius=0.055, depth=0.03)


def build_starseer():
    # robe + shoulders + sash (raised so the head sits ON the body, no gap)
    part(cone, ROBE_BLUE, loc=(0, 0, 0.65), vertices=10, radius1=0.44, radius2=0.15, depth=1.3)
    part(cone, ROBE_BLUE_LT, loc=(0, -0.02, 1.16), vertices=10, radius1=0.27, radius2=0.14, depth=0.42)
    part(ico, ROBE_BLUE_LT, loc=(-0.23, 0, 1.30), subdivisions=2, radius=0.12)
    part(ico, ROBE_BLUE_LT, loc=(0.23, 0, 1.30), subdivisions=2, radius=0.12)
    # head under a wide-brim wizard hat with an accent band (tip kept in frame)
    part(uv, SKIN, loc=(0, 0, 1.44), segments=12, ring_count=8, radius=0.15)
    part(cone, ROBE_BLUE, loc=(0, 0, 1.58), vertices=12, radius1=0.50, radius2=0.30, depth=0.10)
    part(cone, ROBE_BLUE, loc=(0, 0.03, 1.80), blight=(-7, 0, 0), vertices=10, radius1=0.24, radius2=0.015, depth=0.44)
    part(torus, ACCENT, loc=(0, 0.005, 1.645), major_radius=0.245, minor_radius=0.026)
    # star-topped staff + drifting sparks
    part(cyl, WOOD, loc=(-0.54, 0, 0.88), vertices=8, radius=0.022, depth=1.62)
    part(ico, ACCENT, loc=(-0.54, 0, 1.80), subdivisions=1, radius=0.085)
    part(ico, ACCENT, loc=(-0.30, -0.08, 1.32), subdivisions=1, radius=0.030)
    part(ico, ACCENT, loc=(0.38, -0.08, 0.72), subdivisions=1, radius=0.024)
    # belt clasp
    part(cyl, ACCENT, loc=(0, -0.30, 0.92), blight=(90, 0, 0), vertices=10, radius=0.045, depth=0.03)


def build_herald():
    # robe + rope belt
    part(cone, ROBE_RED, loc=(0, 0, 0.62), vertices=9, radius1=0.46, radius2=0.19, depth=1.24)
    part(torus, CLOTH_DARK, loc=(0, 0, 0.88), major_radius=0.30, minor_radius=0.030)
    # hood with a shadowed face
    part(uv, HOOD_DARK, loc=(0, 0.02, 1.42), segments=12, ring_count=8, radius=0.21)
    part(uv, NEAR_BLACK, loc=(0, -0.075, 1.40), segments=10, ring_count=6, radius=0.135)
    part(cone, HOOD_DARK, loc=(0, 0.10, 1.60), blight=(18, 0, 0), vertices=8, radius1=0.16, radius2=0.02, depth=0.30)
    # halo behind the hood
    part(torus, ACCENT, loc=(0, 0.16, 1.55), blight=(90, 0, 0), major_radius=0.30, minor_radius=0.020)
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

# ============================================================================
# Enemy sprites — six archetypes, data-driven so every roster entry renders in
# its thematic accent (the same tints ENEMY_TINT uses in assets.js).
# ============================================================================

BONE = make_mat("bone", srgb(0xB8, 0xAE, 0x98))
_mat_cache = {}


def hexmat(hx, metallic=0.0, rough=0.85, emit=0.0):
    key = (hx, metallic, emit)
    if key not in _mat_cache:
        _mat_cache[key] = make_mat(f"m{hx:06x}", srgb((hx >> 16) & 255, (hx >> 8) & 255, hx & 255),
                                   metallic=metallic, rough=rough, emit=emit)
    return _mat_cache[key]


def beast(s, body, accent):
    B, A = hexmat(body), hexmat(accent, emit=1.6)
    part(ico, B, loc=(0.05 * s, 0, 0.52 * s), subdivisions=2, radius=0.34 * s, scale=(1.45, 0.95, 1.0))
    part(ico, B, loc=(-0.45 * s, 0, 0.66 * s), subdivisions=2, radius=0.20 * s)
    part(cone, B, loc=(-0.66 * s, 0, 0.60 * s), blight=(0, -90, 0), vertices=6, radius1=0.10 * s, radius2=0.02 * s, depth=0.24 * s)
    part(cone, B, loc=(-0.42 * s, -0.10 * s, 0.86 * s), blight=(-12, 12, 0), vertices=5, radius1=0.05 * s, radius2=0.0, depth=0.16 * s)
    part(cone, B, loc=(-0.42 * s, 0.10 * s, 0.86 * s), blight=(12, 12, 0), vertices=5, radius1=0.05 * s, radius2=0.0, depth=0.16 * s)
    for x, y in ((-0.26, -0.11), (-0.26, 0.11), (0.34, -0.11), (0.34, 0.11)):
        part(cyl, B, loc=(x * s, y * s, 0.18 * s), vertices=6, radius=0.055 * s, depth=0.36 * s)
    part(cone, B, loc=(0.58 * s, 0, 0.70 * s), blight=(0, 38, 0), vertices=5, radius1=0.06 * s, radius2=0.0, depth=0.34 * s)
    part(ico, A, loc=(-0.52 * s, -0.135 * s, 0.70 * s), subdivisions=1, radius=0.030 * s)
    part(ico, A, loc=(-0.36 * s, -0.16 * s, 0.72 * s), subdivisions=1, radius=0.026 * s)


def wisp(s, body, accent):
    B, A = hexmat(body), hexmat(accent, emit=2.2)
    part(uv, B, loc=(0, 0, 1.02 * s), segments=12, ring_count=8, radius=0.30 * s, scale=(1, 0.9, 1.12))
    part(cone, B, loc=(0, 0, 0.52 * s), blight=(180, 0, 0), vertices=8, radius1=0.24 * s, radius2=0.02 * s, depth=0.52 * s)
    part(ico, B, loc=(-0.30 * s, -0.04 * s, 0.92 * s), subdivisions=1, radius=0.085 * s)
    part(ico, B, loc=(0.30 * s, -0.04 * s, 0.92 * s), subdivisions=1, radius=0.085 * s)
    part(ico, A, loc=(-0.10 * s, -0.26 * s, 1.06 * s), subdivisions=1, radius=0.040 * s)
    part(ico, A, loc=(0.10 * s, -0.26 * s, 1.06 * s), subdivisions=1, radius=0.040 * s)


def soldier(s, body, accent, weapon="sword", shield=False, wings=False):
    B, A, ST = hexmat(body), hexmat(accent, metallic=0.5, rough=0.4, emit=0.5), hexmat(0xB8B0A0, metallic=0.7, rough=0.35)
    part(cone, B, loc=(0, 0, 0.50 * s), vertices=8, radius1=0.34 * s, radius2=0.14 * s, depth=1.0 * s)
    part(cube, B, loc=(0, 0, 1.06 * s), scale=(0.21 * s, 0.15 * s, 0.17 * s))
    part(ico, B, loc=(-0.27 * s, 0, 1.20 * s), subdivisions=2, radius=0.115 * s)
    part(ico, B, loc=(0.27 * s, 0, 1.20 * s), subdivisions=2, radius=0.115 * s)
    part(uv, B, loc=(0, 0, 1.38 * s), segments=12, ring_count=8, radius=0.135 * s)
    part(torus, A, loc=(0, 0, 1.41 * s), major_radius=0.125 * s, minor_radius=0.018 * s)
    if weapon == "spear":
        part(cyl, hexmat(0x6B5D45), loc=(0.44 * s, 0, 0.95 * s), vertices=7, radius=0.016 * s, depth=1.62 * s)
        part(cone, ST, loc=(0.44 * s, 0, 1.84 * s), vertices=4, radius1=0.05 * s, radius2=0.0, depth=0.18 * s)
    else:
        part(cube, ST, loc=(0.44 * s, 0, 0.78 * s), scale=(0.032 * s, 0.013 * s, 0.30 * s))
        part(cube, A, loc=(0.44 * s, 0, 1.10 * s), scale=(0.11 * s, 0.024 * s, 0.022 * s))
        part(cyl, hexmat(0x0E0A08), loc=(0.44 * s, 0, 1.19 * s), vertices=7, radius=0.018 * s, depth=0.14 * s)
    if shield:
        part(cube, B, loc=(-0.42 * s, -0.02 * s, 0.92 * s), scale=(0.035 * s, 0.16 * s, 0.26 * s))
        part(cyl, A, loc=(-0.455 * s, -0.02 * s, 0.92 * s), blight=(0, 90, 0), vertices=10, radius=0.07 * s, depth=0.02 * s)
    if wings:
        for side in (-1, 1):
            for i, (ang, ln) in enumerate(((28, 0.55), (10, 0.68), (-6, 0.60))):
                part(cone, BONE, loc=(side * (0.30 + 0.1 * i) * s, 0.14 * s, (1.28 + 0.1 * i) * s),
                     blight=(12, side * (90 - ang), 0), vertices=4, radius1=0.045 * s, radius2=0.0, depth=ln * s)


def brute(s, body, accent, horns=False, crown=False, extra_arms=False, cracks=False):
    B = hexmat(body)
    A = hexmat(accent, emit=1.4)
    part(cone, B, loc=(0, 0, 0.40 * s), vertices=8, radius1=0.44 * s, radius2=0.34 * s, depth=0.72 * s)
    part(ico, B, loc=(0, 0, 1.02 * s), subdivisions=2, radius=0.44 * s, scale=(1.12, 0.85, 0.95))
    part(ico, B, loc=(-0.47 * s, 0, 1.26 * s), subdivisions=2, radius=0.22 * s)
    part(ico, B, loc=(0.47 * s, 0, 1.26 * s), subdivisions=2, radius=0.22 * s)
    part(cyl, B, loc=(-0.56 * s, 0, 0.72 * s), blight=(0, 6, 0), vertices=8, radius=0.095 * s, depth=0.80 * s)
    part(cyl, B, loc=(0.56 * s, 0, 0.72 * s), blight=(0, -6, 0), vertices=8, radius=0.095 * s, depth=0.80 * s)
    part(ico, B, loc=(-0.60 * s, 0, 0.30 * s), subdivisions=2, radius=0.135 * s)
    part(ico, B, loc=(0.60 * s, 0, 0.30 * s), subdivisions=2, radius=0.135 * s)
    part(ico, B, loc=(0, 0, 1.50 * s), subdivisions=2, radius=0.145 * s)
    part(ico, A, loc=(-0.055 * s, -0.115 * s, 1.52 * s), subdivisions=1, radius=0.028 * s)
    part(ico, A, loc=(0.055 * s, -0.115 * s, 1.52 * s), subdivisions=1, radius=0.028 * s)
    if horns:
        part(cone, BONE, loc=(-0.14 * s, 0, 1.64 * s), blight=(0, -24, 0), vertices=6, radius1=0.055 * s, radius2=0.0, depth=0.34 * s)
        part(cone, BONE, loc=(0.14 * s, 0, 1.64 * s), blight=(0, 24, 0), vertices=6, radius1=0.055 * s, radius2=0.0, depth=0.34 * s)
    if crown:
        part(torus, A, loc=(0, 0, 1.62 * s), major_radius=0.13 * s, minor_radius=0.022 * s)
    if extra_arms:
        part(cyl, B, loc=(-0.50 * s, -0.10 * s, 0.52 * s), blight=(0, 24, 0), vertices=7, radius=0.06 * s, depth=0.5 * s)
        part(cyl, B, loc=(0.50 * s, -0.10 * s, 0.52 * s), blight=(0, -24, 0), vertices=7, radius=0.06 * s, depth=0.5 * s)
    if cracks:
        for x, z in ((-0.18, 1.06), (0.10, 0.92), (0.26, 1.14), (-0.05, 0.72)):
            part(ico, A, loc=(x * s, -0.33 * s, z * s), subdivisions=1, radius=0.035 * s)


def armork(s, body, accent, shield=True):
    B = hexmat(body, metallic=0.35, rough=0.5)
    A = hexmat(accent, metallic=0.6, rough=0.35, emit=0.5)
    part(cone, B, loc=(0, 0, 0.42 * s), vertices=8, radius1=0.37 * s, radius2=0.22 * s, depth=0.8 * s)
    part(cube, B, loc=(0, 0, 1.02 * s), scale=(0.25 * s, 0.18 * s, 0.22 * s))
    part(ico, B, loc=(-0.33 * s, 0, 1.24 * s), subdivisions=2, radius=0.16 * s)
    part(ico, B, loc=(0.33 * s, 0, 1.24 * s), subdivisions=2, radius=0.16 * s)
    part(cyl, B, loc=(0, 0, 1.44 * s), vertices=10, radius=0.135 * s, depth=0.26 * s)
    part(cube, hexmat(0x0E0A08), loc=(0, -0.125 * s, 1.46 * s), scale=(0.085 * s, 0.02 * s, 0.016 * s))
    part(cone, A, loc=(0, 0.02 * s, 1.64 * s), blight=(8, 0, 0), vertices=6, radius1=0.045 * s, radius2=0.0, depth=0.16 * s)
    part(cube, hexmat(0xB8B0A0, metallic=0.7, rough=0.35), loc=(0.46 * s, 0, 0.82 * s), scale=(0.036 * s, 0.014 * s, 0.34 * s))
    part(cube, A, loc=(0.46 * s, 0, 1.18 * s), scale=(0.12 * s, 0.025 * s, 0.024 * s))
    if shield:
        part(cube, B, loc=(-0.44 * s, -0.02 * s, 0.88 * s), scale=(0.04 * s, 0.17 * s, 0.30 * s))
        part(cyl, A, loc=(-0.48 * s, -0.02 * s, 0.88 * s), blight=(0, 90, 0), vertices=10, radius=0.08 * s, depth=0.022 * s)


def robed(s, body, accent, tool=True):
    B = hexmat(body)
    A = hexmat(accent, emit=1.6)
    part(cone, B, loc=(0, 0, 0.55 * s), vertices=9, radius1=0.36 * s, radius2=0.15 * s, depth=1.1 * s)
    part(uv, hexmat(0x241413), loc=(0, 0.01 * s, 1.26 * s), segments=12, ring_count=8, radius=0.17 * s)
    part(uv, hexmat(0x0E0A08), loc=(0, -0.06 * s, 1.24 * s), segments=10, ring_count=6, radius=0.115 * s)
    part(ico, A, loc=(-0.045 * s, -0.145 * s, 1.26 * s), subdivisions=1, radius=0.022 * s)
    part(ico, A, loc=(0.045 * s, -0.145 * s, 1.26 * s), subdivisions=1, radius=0.022 * s)
    if tool:
        part(cyl, hexmat(0x6B5D45), loc=(0.40 * s, 0, 0.85 * s), vertices=7, radius=0.016 * s, depth=1.3 * s)
        part(ico, A, loc=(0.40 * s, 0, 1.56 * s), subdivisions=1, radius=0.055 * s)


def marionette(s, body, accent):
    B = hexmat(body)
    A = hexmat(accent, emit=1.4)
    W = hexmat(0x6B5D45)
    part(cube, W, loc=(0, 0, 1.86 * s), blight=(0, 0, 18), scale=(0.30 * s, 0.02 * s, 0.02 * s))
    part(cube, W, loc=(0, 0, 1.86 * s), blight=(0, 0, -18), scale=(0.30 * s, 0.02 * s, 0.02 * s))
    for x, top, bot in ((-0.22, 1.86, 1.10), (0.0, 1.86, 1.44), (0.22, 1.86, 1.10)):
        mid = (top + bot) / 2
        part(cyl, hexmat(0xB8AE98), loc=(x * s, 0, mid * s), vertices=4, radius=0.006 * s, depth=(top - bot) * s)
    part(uv, B, loc=(0, 0, 1.34 * s), segments=10, ring_count=8, radius=0.12 * s)
    part(ico, A, loc=(-0.04 * s, -0.10 * s, 1.36 * s), subdivisions=1, radius=0.022 * s)
    part(ico, A, loc=(0.04 * s, -0.10 * s, 1.36 * s), subdivisions=1, radius=0.022 * s)
    part(cube, B, loc=(0, 0, 1.02 * s), scale=(0.13 * s, 0.09 * s, 0.16 * s))
    part(ico, B, loc=(0, 0, 0.80 * s), subdivisions=2, radius=0.085 * s)
    for side in (-1, 1):
        part(ico, B, loc=(side * 0.22 * s, 0, 1.10 * s), subdivisions=1, radius=0.05 * s)
        part(cyl, B, loc=(side * 0.24 * s, 0, 0.92 * s), blight=(0, side * 8, 0), vertices=6, radius=0.028 * s, depth=0.3 * s)
        part(cyl, B, loc=(side * 0.09 * s, 0, 0.42 * s), blight=(0, side * 5, 0), vertices=6, radius=0.032 * s, depth=0.62 * s)
        part(cube, B, loc=(side * 0.11 * s, -0.02 * s, 0.08 * s), scale=(0.05 * s, 0.09 * s, 0.03 * s))


# body hexes: act1 mud/iron, act2 gilt court, act3 ash. accent = ENEMY_TINT hex.
GOLD, EMBER, FROST, ROT, EMBER, BLOOD, IRON = 0xC9A227, 0xC9502E, 0x7FA8C9, 0xB5541C, 0x9FC3E8, 0x8A1A1A, 0x4A4034
# (builder, visual height) — the camera frames each enemy to its own height so
# small beasts do not drown in headroom and tall bosses do not clip.
ENEMIES = {
    # Act 1 - The Fallow Marches
    "blightHound": (lambda: beast(0.72, 0x3A3226, ROT), 1.30),  # beasts are WIDE: frame by width
    "graveWisp": (lambda: wisp(0.72, 0x2B2547, EMBER), 1.02),
    "wanderingSoldier": (lambda: soldier(0.86, IRON, IRON), 1.30),
    "huskBrute": (lambda: brute(0.86, 0x3A3226, EMBER), 1.44),
    "wyrmAspirant": (lambda: armork(1.0, IRON, GOLD), 1.74),
    "fellWarden": (lambda: brute(1.06, 0x2A2216, BLOOD, horns=True), 1.94),
    # Act 2 - The Stitched Court
    "courtMarionette": (lambda: marionette(0.80, 0x3A3358, ROT), 1.52),
    "stitchedHound": (lambda: beast(0.72, 0x2E1F1F, BLOOD), 1.30),
    "courtSurgeon": (lambda: robed(0.86, 0x2B2547, EMBER), 1.42),
    "gildedKnight": (lambda: armork(0.88, 0x4A4034, GOLD), 1.54),
    "livingArmor": (lambda: armork(0.88, 0x3B4552, FROST, shield=False), 1.54),
    "courtDuelist": (lambda: soldier(1.0, 0x2B2547, FROST, weapon="sword", shield=True), 1.50),
    "stitchedKing": (lambda: brute(1.06, 0x3A3226, GOLD, crown=True, extra_arms=True), 1.80),
    # Act 3 - The Ashen Crown
    "emberStarvedPilgrim": (lambda: robed(0.70, 0x2E1F1F, EMBER, tool=False), 1.04),
    "valkyrieShade": (lambda: soldier(0.86, 0x2A2216, BLOOD, weapon="spear"), 1.70),
    "ashRevenant": (lambda: wisp(0.88, 0x2A2216, EMBER), 1.25),
    "charredColossus": (lambda: brute(1.06, 0x241D14, EMBER, cracks=True), 1.78),
    "wyrmLord": (lambda: armork(1.06, 0x3A3226, GOLD), 1.86),
    "blightedValkyrie": (lambda: soldier(1.06, 0x2E1F1F, ROT, weapon="spear", wings=True), 2.06),
}

# ---- render every class x tint, then every enemy -----------------------------
accent_bsdf = ACCENT.node_tree.nodes["Principled BSDF"]
builders = {"reaver": build_reaver, "starseer": build_starseer, "herald": build_herald}
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

for enemy_id, (build, h) in ENEMIES.items():
    build()
    frame = h * 1.12
    cam.data.ortho_scale = frame
    cam.location.z = frame / 2 - 0.03
    scene.render.filepath = os.path.join(OUT, f"enemy_{enemy_id}.png")
    bpy.ops.render.render(write_still=True)
    count += 1
    clear_parts()

print(f"SPRITES OK: {count} renders -> {OUT}")
