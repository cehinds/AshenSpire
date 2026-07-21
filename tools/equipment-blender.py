# tools/equipment-blender.py — armament + armour-set sprites, rendered in Blender.
#
#   blender --background --factory-startup --python tools/equipment-blender.py -- <outDir>
#
# Reads the SAME CSVs the game reads (content/source/weapons.csv and
# outfits.csv), so the art can never drift from the data — adding a row gives
# you a rendered sprite on the next run, with no edit here.
#
# Two kinds of output, both on one shared camera/canvas so they composite:
#   weapon_<id>.png   a single armament, alone on transparency, positioned as
#                     if held — these are LAYERS stacked over a body
#   body_<class>_<set>.png   a weapon-less body in that set's palette
#
# Why layers: pre-rendering class x set x weapon x offhand explodes
# combinatorially (12 x 24 x ... ). Rendering each piece once is linear — a body
# is ~7 KB, a weapon ~1-2 KB — and every combination is then free.

import bpy
import csv
import math
import os
import sys

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = os.path.abspath(argv[0])
os.makedirs(OUT, exist_ok=True)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "content", "source")

RES_X, RES_Y = 450, 570


def rows(name):
    """Read a source CSV, skipping the '#' comment preamble."""
    path = os.path.join(SRC, name)
    with open(path, encoding="utf-8") as fh:
        lines = [l for l in fh if l.strip() and not l.lstrip().startswith("#")]
    return list(csv.DictReader(lines))


def srgb(r, g, b, a=1.0):
    def lin(c):
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b), a)


def hexrgb(h):
    h = h.strip().lstrip("#")
    return srgb(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


_mats = {}


def mat(rgba, metallic=0.0, rough=0.6, emit=0.0):
    key = (tuple(rgba), metallic, rough, emit)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new("m")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = rgba
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = rgba
        b.inputs["Emission Strength"].default_value = emit
    _mats[key] = m
    return m


parts = []
cube, cyl, cone, ico, uv, torus = (
    bpy.ops.mesh.primitive_cube_add, bpy.ops.mesh.primitive_cylinder_add,
    bpy.ops.mesh.primitive_cone_add, bpy.ops.mesh.primitive_ico_sphere_add,
    bpy.ops.mesh.primitive_uv_sphere_add, bpy.ops.mesh.primitive_torus_add,
)


def part(op, m, loc=(0, 0, 0), rot=(0, 0, 0), **kw):
    op(location=loc, rotation=tuple(math.radians(a) for a in rot), **kw)
    ob = bpy.context.object
    ob.data.materials.append(m)
    parts.append(ob)
    return ob


def clear():
    for ob in parts:
        bpy.data.objects.remove(ob, do_unlink=True)
    parts.clear()


# ---- armament archetypes -----------------------------------------------------
# Each builds at the right hand (x=+0.62) or left (x=-0.52), matching where the
# class bodies hold things in tools/sprites-blender.py.
RX, LX = 0.62, -0.52


def a_sword(M, A, s):
    part(cube, M, loc=(RX, 0, 0.86), scale=(0.040 * s, 0.014 * s, 0.34 * s))
    part(cone, M, loc=(RX, 0, 0.48), rot=(180, 0, 0), vertices=4, radius1=0.040 * s, radius2=0, depth=0.12 * s)
    part(cube, A, loc=(RX, 0, 1.22), scale=(0.13 * s, 0.026 * s, 0.024 * s))
    part(cyl, M, loc=(RX, 0, 1.33), vertices=8, radius=0.022 * s, depth=0.18 * s)
    part(ico, A, loc=(RX, 0, 1.44), subdivisions=2, radius=0.040 * s)


def a_colossal(M, A, s):
    part(cube, M, loc=(RX, 0, 0.90), scale=(0.055 * s, 0.018 * s, 0.46 * s))
    part(cone, M, loc=(RX, 0, 0.38), rot=(180, 0, 0), vertices=4, radius1=0.055 * s, radius2=0, depth=0.16 * s)
    part(cube, A, loc=(RX, 0, 1.38), scale=(0.19 * s, 0.032 * s, 0.030 * s))
    part(cyl, M, loc=(RX, 0, 1.52), vertices=8, radius=0.026 * s, depth=0.24 * s)
    part(ico, A, loc=(RX, 0, 1.67), subdivisions=2, radius=0.052 * s)


def a_dagger(M, A, s):
    part(cube, M, loc=(RX, 0, 0.74), scale=(0.030 * s, 0.012 * s, 0.17 * s))
    part(cone, M, loc=(RX, 0, 0.55), rot=(180, 0, 0), vertices=4, radius1=0.030 * s, radius2=0, depth=0.09 * s)
    part(cube, A, loc=(RX, 0, 0.93), scale=(0.075 * s, 0.022 * s, 0.020 * s))
    part(cyl, M, loc=(RX, 0, 1.02), vertices=8, radius=0.022 * s, depth=0.16 * s)
    part(ico, A, loc=(RX, 0, 1.11), subdivisions=1, radius=0.032 * s)


def a_curved(M, A, s):
    # Held point-DOWN like the other blades (the class bodies carry weapons that
    # way), curving gently forward as it descends from the guard.
    # Segments ride a real arc and are rotated to its TANGENT. Laying them out
    # on a straight line with increasing tilt (the first attempt) made a
    # sawtooth, because a tilted block only reads as a curve when its long axis
    # follows the curve.
    R, SWEEP, N = 1.4 * s, 26.0, 8
    z0 = 1.04
    for i in range(N + 1):
        a = math.radians(SWEEP * i / N)
        part(cube, M, loc=(RX + R * (1 - math.cos(a)), 0, z0 - R * math.sin(a)),
             rot=(0, -math.degrees(a), 0), scale=(0.032 * s, 0.011 * s, 0.048 * s))
    # The tip continues along the last segment's tangent, not straight down —
    # otherwise it hangs off the blade end as a visible notch.
    a = math.radians(SWEEP)
    reach = 0.103 * s
    part(cone, M,
         loc=(RX + R * (1 - math.cos(a)) + reach * math.sin(a), 0, z0 - R * math.sin(a) - reach * math.cos(a)),
         rot=(180, -SWEEP, 0), vertices=4, radius1=0.032 * s, radius2=0, depth=0.11 * s)
    part(cube, A, loc=(RX, 0, 1.14), scale=(0.10 * s, 0.024 * s, 0.020 * s))
    part(cyl, M, loc=(RX, 0, 1.28), vertices=8, radius=0.021 * s, depth=0.24 * s)
    part(ico, A, loc=(RX, 0, 1.41), subdivisions=1, radius=0.030 * s)


def a_polearm(M, A, s):
    part(cyl, mat(hexrgb("6B5D45")), loc=(RX, 0, 0.92), vertices=8, radius=0.022 * s, depth=1.44 * s)
    part(cone, M, loc=(RX, 0, 1.74), vertices=4, radius1=0.055 * s, radius2=0, depth=0.22 * s)
    part(cube, M, loc=(RX + 0.09 * s, 0, 1.60), rot=(0, 22, 0), scale=(0.075 * s, 0.012 * s, 0.055 * s))
    part(torus, A, loc=(RX, 0, 1.44), rot=(90, 0, 0), major_radius=0.045 * s, minor_radius=0.012 * s)


def a_hammer(M, A, s):
    part(cyl, mat(hexrgb("6B5D45")), loc=(RX, 0, 0.86), vertices=8, radius=0.024 * s, depth=1.06 * s)
    part(cube, M, loc=(RX, 0, 1.44), scale=(0.10 * s, 0.075 * s, 0.10 * s))
    part(cube, A, loc=(RX, 0, 1.55), scale=(0.105 * s, 0.078 * s, 0.016 * s))


def a_twin(M, A, s):
    part(cube, M, loc=(RX, 0, 1.00), scale=(0.034 * s, 0.012 * s, 0.30 * s))
    part(cube, M, loc=(RX, 0, 0.44), scale=(0.034 * s, 0.012 * s, 0.30 * s))
    part(cone, M, loc=(RX, 0, 1.36), vertices=4, radius1=0.034 * s, radius2=0, depth=0.12 * s)
    part(cone, M, loc=(RX, 0, 0.08), rot=(180, 0, 0), vertices=4, radius1=0.034 * s, radius2=0, depth=0.12 * s)
    part(cyl, A, loc=(RX, 0, 0.72), vertices=8, radius=0.030 * s, depth=0.16 * s)


def a_axe(M, A, s):
    part(cyl, mat(hexrgb("6B5D45")), loc=(RX, 0, 0.88), vertices=8, radius=0.022 * s, depth=1.10 * s)
    part(cone, M, loc=(RX + 0.10 * s, 0, 1.42), rot=(0, 90, 0), vertices=3, radius1=0.16 * s, radius2=0.02 * s, depth=0.10 * s)
    part(ico, A, loc=(RX, 0, 1.46), subdivisions=1, radius=0.034 * s)


# ---- offhand -----------------------------------------------------------------
def s_round(M, A, s):
    part(cyl, M, loc=(LX, -0.10, 1.02), rot=(90, 0, 0), vertices=16, radius=0.26 * s, depth=0.05)
    part(torus, A, loc=(LX, -0.13, 1.02), rot=(90, 0, 0), major_radius=0.225 * s, minor_radius=0.020)
    part(ico, M, loc=(LX, -0.16, 1.02), subdivisions=2, radius=0.075 * s)


def s_kite(M, A, s):
    part(cube, M, loc=(LX, -0.10, 1.10), scale=(0.20 * s, 0.025, 0.24 * s))
    part(cone, M, loc=(LX, -0.10, 0.70), rot=(180, 0, 0), vertices=3, radius1=0.20 * s, radius2=0, depth=0.24 * s)
    part(cube, A, loc=(LX, -0.13, 1.10), scale=(0.030 * s, 0.02, 0.24 * s))


def s_tower(M, A, s):
    part(cube, M, loc=(LX, -0.10, 1.02), scale=(0.22 * s, 0.03, 0.42 * s))
    part(cube, A, loc=(LX, -0.14, 1.02), scale=(0.035 * s, 0.02, 0.40 * s))
    part(torus, A, loc=(LX, -0.14, 1.02), rot=(90, 0, 0), major_radius=0.10 * s, minor_radius=0.018)


def s_spiked(M, A, s):
    s_round(M, A, s)
    for i in range(6):
        ang = i * 60
        x = LX + math.cos(math.radians(ang)) * 0.20 * s
        z = 1.02 + math.sin(math.radians(ang)) * 0.20 * s
        part(cone, A, loc=(x, -0.16, z), rot=(-90, 0, 0), vertices=4, radius1=0.026, radius2=0, depth=0.10)


def s_lantern(M, A, s):
    part(cyl, M, loc=(LX, -0.06, 1.02), vertices=6, radius=0.075 * s, depth=0.20 * s)
    part(ico, mat(hexrgb("C9A227"), emit=4.0), loc=(LX, -0.06, 1.02), subdivisions=2, radius=0.050 * s)
    part(cyl, M, loc=(LX, -0.06, 1.16), vertices=6, radius=0.020, depth=0.10)


def s_torch(M, A, s):
    part(cyl, M, loc=(LX, -0.06, 0.94), vertices=8, radius=0.020 * s, depth=0.40 * s)
    part(ico, mat(hexrgb("C9502E"), emit=5.0), loc=(LX, -0.06, 1.20), subdivisions=2, radius=0.070 * s)
    part(ico, mat(hexrgb("C9A227"), emit=3.0), loc=(LX, -0.06, 1.28), subdivisions=1, radius=0.040 * s)


def s_dagger_off(M, A, s):
    part(cube, M, loc=(LX, -0.06, 1.00), scale=(0.026 * s, 0.010 * s, 0.15 * s))
    part(cone, M, loc=(LX, -0.06, 1.20), vertices=4, radius1=0.026 * s, radius2=0, depth=0.08 * s)
    part(cube, A, loc=(LX, -0.06, 0.84), scale=(0.060 * s, 0.018 * s, 0.016 * s))


# ---- staves ------------------------------------------------------------------
def _shaft(M, s):
    part(cyl, M, loc=(RX, 0, 0.92), vertices=8, radius=0.024 * s, depth=1.56 * s)


def st_orb(M, A, s):
    _shaft(M, s)
    part(ico, A, loc=(RX, 0, 1.78), subdivisions=2, radius=0.085 * s)


def st_crystal(M, A, s):
    _shaft(M, s)
    part(cone, A, loc=(RX, 0, 1.82), vertices=6, radius1=0.075 * s, radius2=0, depth=0.22 * s)
    part(cone, A, loc=(RX, 0, 1.70), rot=(180, 0, 0), vertices=6, radius1=0.075 * s, radius2=0, depth=0.14 * s)


def st_skull(M, A, s):
    _shaft(M, s)
    part(uv, mat(hexrgb("B8AE98")), loc=(RX, 0, 1.78), segments=12, ring_count=8, radius=0.085 * s)
    part(ico, A, loc=(RX - 0.032 * s, -0.070 * s, 1.79), subdivisions=1, radius=0.020 * s)
    part(ico, A, loc=(RX + 0.032 * s, -0.070 * s, 1.79), subdivisions=1, radius=0.020 * s)


def st_flame(M, A, s):
    _shaft(M, s)
    part(cone, A, loc=(RX, 0, 1.84), vertices=8, radius1=0.080 * s, radius2=0, depth=0.26 * s)
    part(torus, A, loc=(RX, 0, 1.66), rot=(90, 0, 0), major_radius=0.070 * s, minor_radius=0.016)


def st_branch(M, A, s):
    _shaft(M, s)
    for i, ang in enumerate((-34, -12, 12, 34)):
        part(cone, M, loc=(RX + math.sin(math.radians(ang)) * 0.14 * s, 0, 1.76 + i * 0.02),
             rot=(0, ang, 0), vertices=5, radius1=0.020 * s, radius2=0.004, depth=0.28 * s)
    part(ico, A, loc=(RX, 0, 1.92), subdivisions=2, radius=0.055 * s)


def st_horn(M, A, s):
    _shaft(M, s)
    part(cone, mat(hexrgb("B8AE98")), loc=(RX, 0, 1.84), rot=(0, 26, 0), vertices=7, radius1=0.075 * s, radius2=0.010, depth=0.34 * s)
    part(torus, A, loc=(RX, 0, 1.64), rot=(90, 0, 0), major_radius=0.062 * s, minor_radius=0.014)


GEOM = {
    "sword": a_sword, "colossal": a_colossal, "dagger": a_dagger, "curved": a_curved,
    "polearm": a_polearm, "hammer": a_hammer, "twin": a_twin, "axe": a_axe,
    "round": s_round, "kite": s_kite, "tower": s_tower, "spiked": s_spiked,
    "lantern": s_lantern, "torch": s_torch,
    "staffOrb": st_orb, "staffCrystal": st_crystal, "staffSkull": st_skull,
    "staffFlame": st_flame, "staffBranch": st_branch, "staffHorn": st_horn,
}

# ---- stage -------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x, scene.render.resolution_y = RES_X, RES_Y
scene.render.film_transparent = True
# WEBP, not PNG, and for one reason: these renders SHIP INSIDE the single-file
# build as base64 data URIs (tools/bundle.mjs). PNG made that impossible — the
# art weighed 9.3 MB, which is ~12.4 MB once base64'd. Quality 88 with an alpha
# channel keeps these flat-shaded figures visually identical at a fraction of
# the weight. Matches tools/backdrops-blender.py, which already did this.
scene.render.image_settings.file_format = "WEBP"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.quality = 88
scene.view_settings.view_transform = "Standard"

bpy.ops.object.camera_add(location=(0, -8, 0.98), rotation=(math.radians(90), 0, 0))
cam = bpy.context.object
cam.data.type = "ORTHO"
cam.data.ortho_scale = 2.15
scene.camera = cam

bpy.ops.object.light_add(type="SUN", rotation=(math.radians(55), 0, math.radians(-28)))
bpy.context.object.data.energy = 3.4
bpy.context.object.data.color = (1.0, 0.94, 0.82)
bpy.ops.object.light_add(type="SUN", rotation=(math.radians(-118), 0, math.radians(146)))
bpy.context.object.data.energy = 5.0
bpy.context.object.data.color = (0.72, 0.82, 1.0)
bpy.ops.object.light_add(type="SUN", rotation=(math.radians(80), 0, math.radians(35)))
bpy.context.object.data.energy = 0.7

LAYER_CAM = (cam.location.copy(), cam.data.ortho_scale)
ICON_RES = 224


def render_icon(path):
    """The same armament again, but framed as an ITEM rather than as a layer.

    The layer render leaves the piece off at the edge of a body-sized canvas —
    correct for compositing, useless as a 7rem slot icon. Rather than author a
    second geometry, point the camera at the piece's own bounding box and pull
    in. One source of truth, two framings.
    """
    xs, zs = [], []
    for ob in parts:
        for corner in ob.bound_box:
            wc = ob.matrix_world @ __import__("mathutils").Vector(corner)
            xs.append(wc.x)
            zs.append(wc.z)
    cx, cz = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2
    span = max(max(xs) - min(xs), max(zs) - min(zs))
    cam.location = (cx, LAYER_CAM[0].y, cz)
    cam.data.ortho_scale = max(0.25, span * 1.22)
    scene.render.resolution_x = scene.render.resolution_y = ICON_RES
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    cam.location, cam.data.ortho_scale = LAYER_CAM
    scene.render.resolution_x, scene.render.resolution_y = RES_X, RES_Y


count = 0
for w in rows("weapons.csv"):
    build = GEOM.get(w["geom"])
    if not build:
        print("SKIP (no geometry):", w["id"], w["geom"])
        continue
    build(mat(hexrgb(w["metal"]), metallic=0.7, rough=0.35),
          mat(hexrgb(w["accent"]), metallic=0.5, rough=0.35, emit=0.4),
          float(w["scale"]))
    scene.render.filepath = os.path.join(OUT, f"weapon_{w['id']}.webp")
    bpy.ops.render.render(write_still=True)
    render_icon(os.path.join(OUT, f"icon_{w['id']}.webp"))
    clear()
    count += 1
    print("ARM", w["id"])

# ---- armour-set bodies -------------------------------------------------------
# The class figures live in tools/sprites-blender.py. Rather than duplicate the
# geometry, exec that file's LIBRARY portion (everything above its render loop)
# to get build_reaver / build_starseer / build_herald and the hero materials,
# then repaint per armour set. Same reason the CSVs are shared: one source.
lib_path = os.path.join(ROOT, "tools", "sprites-blender.py")
lib_src = open(lib_path, encoding="utf-8").read()
lib_src = lib_src[:lib_src.index("# ---- render every class x tint")]
lib = {"__name__": "spritelib", "sys": sys, "os": os, "math": math, "bpy": bpy}
# The library reads its own out-dir from argv; it only uses it to mkdir.
exec(compile(lib_src, lib_path, "exec"), lib)

CLASS_BUILD = {
    "reaver": lib["build_reaver"], "starseer": lib["build_starseer"], "herald": lib["build_herald"],
}


def repaint(name, hexv):
    m = lib[name]
    b = m.node_tree.nodes["Principled BSDF"]
    c = hexrgb(hexv)
    b.inputs["Base Color"].default_value = c
    return c


sets = 0
lib["scene"].render.resolution_x, lib["scene"].render.resolution_y = RES_X, RES_Y
lib["hero_rim"].data.energy = 2.6
# Bodies are LAYERS, so they come out bare-handed and the weapon PNGs above —
# built at the same hand positions on the same camera — drop straight over them.
lib["WITH_WEAPON"] = False
for o in rows("outfits.csv"):
    build = CLASS_BUILD.get(o["classId"])
    if not build:
        continue
    repaint("HERO_PLATE", o["plate"])
    repaint("HERO_PLATE_LT", o["plateLt"])
    repaint("HERO_LEATHER", o["leather"])
    repaint("HERO_UNDER", o["under"])
    acc = repaint("ACCENT", "C9A227")
    lib["ACCENT"].node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = acc
    ac2 = repaint("ACCENT_CLOTH", "C9A227")
    lib["ACCENT_CLOTH"].node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = ac2
    lib["hero_rim"].data.color = acc[:3]
    build()
    lib["scene"].render.filepath = os.path.join(OUT, f"body_{o['classId']}_{o['id']}.webp")
    bpy.ops.render.render(write_still=True)
    lib["clear_parts"]()
    sets += 1
    print("SET", o["classId"], o["id"])

print(f"EQUIPMENT OK: {count} armaments + {sets} armour sets -> {OUT}")
