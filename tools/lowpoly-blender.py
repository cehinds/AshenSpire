# tools/lowpoly-blender.py — low-poly 3D class figures, rigged and posed.
#
#   blender --background --factory-startup --python tools/lowpoly-blender.py -- OUT_DIR [class,class] [pose,pose]
#        [--palette build/components/palette.json] [--parts] [--res 2.5]
#
# Each class is a real body: a skin-modifier mesh grown over a stick skeleton
# (so limbs join the torso as one surface, not as cones poked into a box),
# deformed by an armature with hand-computed weights, dressed in separate
# low-poly pieces parented to bones (hood, mantle, bracers, daggers, helmet,
# pauldrons, hat, halo, staff). Poses are given as WORLD directions each bone
# should point in, so a lunge is a leg that actually steps and an arm that
# actually reaches. Flat shading on purpose: this is the low-poly look.
#
# Conventions: Z up, the figure faces the camera (camera at -Y looking +Y),
# "forward" toward the enemy is screen-right (+X). Bone names end .L / .R for
# SCREEN left / right. 1 unit = 1 metre; the figure is ~1.9 tall, feet at z=0.
import bpy, math, os, sys, json
from mathutils import Vector, Matrix, Quaternion

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if not argv:
    raise SystemExit("usage: -- OUT_DIR [class,class] [pose,pose] [--palette build/components/palette.json] [--parts] [--res 2.5]")
PARTS_MODE = "--parts" in argv
# How finely everything is built. 1.0 is the first four passes' coarse figures;
# higher divides every ring and every step between rings, so a hood is a curved
# shell of small facets rather than a seven-sided tent. Faces still shade flat —
# this buys smoother silhouettes, not smooth shading.
RES = float(argv[argv.index("--res") + 1]) if "--res" in argv else 2.5
PALETTE_PATH = argv[argv.index("--palette") + 1] if "--palette" in argv else None
argv = [a for i, a in enumerate(argv) if a not in ("--parts", "--palette", "--res") and not (i > 0 and argv[i - 1] in ("--palette", "--res"))]
OUT = argv[0]
ONLY = argv[1].split(",") if len(argv) > 1 and argv[1] else None
ONLY_POSES = argv[2].split(",") if len(argv) > 2 and argv[2] else None
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
PALETTE = {}
for cand in ([PALETTE_PATH] if PALETTE_PATH else []) + [os.path.join(HERE, "..", "build", "components", "palette.json")]:
    if cand and os.path.exists(cand):
        with open(cand, encoding="utf-8") as fh: PALETTE = json.load(fh)
        break
INVENTORY = {}
with open(os.path.join(HERE, "lowpoly-components.json"), encoding="utf-8") as fh:
    INVENTORY = {k: v for k, v in json.load(fh).items() if k != "_"}

# ---- scene ---------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = 32
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "Standard"
scene.render.resolution_x, scene.render.resolution_y = 1280, 900
cam_data = bpy.data.cameras.new("cam"); cam_data.type = "ORTHO"
cam_data.sensor_fit = "VERTICAL"; cam_data.ortho_scale = 2.8
cam = bpy.data.objects.new("cam", cam_data); scene.collection.objects.link(cam)
cam.location = (0.05, -12.0, 1.30); cam.rotation_euler = (math.radians(90), 0, 0)
scene.camera = cam
CANVAS = dict(ortho=2.8, cx=0.05, cz=1.30, w=1280, h=900)   # world→pixel: see manifest
# 960 wide, not 720: a lunge with a greatsword reached past the right edge of the
# narrower frame, and the sword raised overhead reached past the top. The vertical
# span is what ortho_scale fixes, so the extra width costs no scale.

def light(name, kind, loc, energy, color=(1, 1, 1), rot=None, size=None):
    d = bpy.data.lights.new(name, kind); d.energy = energy; d.color = color
    if size and kind == "AREA": d.size = size
    o = bpy.data.objects.new(name, d); scene.collection.objects.link(o)
    o.location = loc
    if rot: o.rotation_euler = rot
    return o
# key from upper front-left, cool fill from the right, warm rim from behind
light("key", "SUN", (0, 0, 5), 0.75, (1.0, 0.93, 0.84), rot=(math.radians(50), math.radians(-30), math.radians(-22)))
light("fill", "SUN", (0, 0, 5), 0.16, (0.7, 0.8, 1.0), rot=(math.radians(70), math.radians(35), math.radians(30)))
light("rim", "SUN", (0, 0, 5), 1.0, (1.0, 0.86, 0.66), rot=(math.radians(-60), 0, math.radians(180)))
light("rim2", "SUN", (0, 0, 5), 1.5, (1.0, 0.60, 0.30), rot=(math.radians(-48), 0, math.radians(140)))
scene.eevee.use_soft_shadows = True
scene.eevee.use_gtao = True; scene.eevee.gtao_distance = 0.45; scene.eevee.gtao_factor = 1.3

# ---- materials -----------------------------------------------------------------------
def srgb(r, g, b):
    def c(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (c(r), c(g), c(b), 1.0)

# Where the sampler is fooled — the painting's warm rim light dominates a crop's
# lit quartile — the colour is pinned by eye against the painting instead.
OVERRIDE = {("rogue", "tunic"): (36, 44, 26), ("rogue", "skirt"): (32, 40, 24), ("rogue", "hood"): (44, 40, 36), ("rogue", "cowl"): (38, 35, 32), ("rogue", "mantle"): (34, 30, 26),
            ("starseer", "robe"): (28, 24, 30), ("starseer", "mantle"): (86, 70, 104), ("starseer", "hat"): (46, 48, 60), ("starseer", "cowl"): (26, 26, 32), ("starseer", "sleeve_r"): (34, 30, 40),
            ("herald", "robe"): (64, 52, 35), ("herald", "mantle"): (54, 45, 32), ("herald", "hood"): (60, 49, 33), ("herald", "sleeve_l"): (58, 47, 31),
            ("reaver", "cape"): (62, 22, 20), ("reaver", "helm"): (76, 74, 74), ("reaver", "gorget"): (66, 64, 64), ("reaver", "pauldron_r"): (72, 70, 70),
            ("reaver", "breastplate"): (70, 68, 68), ("reaver", "gauntlet_r"): (62, 60, 60), ("reaver", "gauntlet_l"): (52, 50, 50), ("reaver", "tasset"): (64, 62, 62), ("reaver", "sword"): (40, 32, 26)}
# Measured against the crops slot by slot: with the light set to the paintings'
# level, each class's cloth still sat brighter than its painting. These scale a
# part's colour in linear light so a rendered slot lands within a fifth of the
# painting's median. Gold, steel and skin are shared materials and are not scaled.
TONE = {"rogue": 0.44, "reaver": 0.86, "starseer": 0.48, "herald": 0.68}
def tone(cls, rgb):
    f = TONE.get(cls, 1.0)
    if f == 1.0: return tuple(rgb)
    def one(v):
        v /= 255.0
        l = (v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) * f
        c = 12.92 * l if l <= 0.0031308 else 1.055 * l ** (1 / 2.4) - 0.055
        return max(0, min(255, int(round(c * 255))))
    return tuple(one(v) for v in rgb)

def paint(cls, part, kind="cloth", fallback=(60, 60, 60)):
    if (cls, part) in OVERRIDE:
        rgb = tone(cls, OVERRIDE[(cls, part)])
        return mat(f"{cls}_{part}", rgb, rough=(0.48 if kind == "plate" else 0.7 if kind == "leather" else 0.9), metal=(0.65 if kind == "plate" else 0.0))
    """A material coloured from the painting's crop of this part. Cloth and leather
    take the lit side of the crop (its mean sits in shadow); plate takes the mean and
    a metallic finish. Falls back to a fixed colour when no palette was sampled."""
    P = PALETTE.get(cls, {}).get(part)
    if not P: return mat(f"{cls}_{part}", tone(cls, fallback))
    m, l = P["mean"], P["light"]
    if kind == "plate":
        rgb = tone(cls, [int(0.5 * a + 0.5 * b) for a, b in zip(m, l)])
        return mat(f"{cls}_{part}", rgb, rough=0.48, metal=0.65)
    if kind == "leather":
        rgb = tone(cls, [int(0.35 * a + 0.65 * b) for a, b in zip(m, l)])
        return mat(f"{cls}_{part}", rgb, rough=0.7)
    rgb = tone(cls, [int(0.3 * a + 0.7 * b) for a, b in zip(m, l)])
    return mat(f"{cls}_{part}", rgb, rough=0.9)

MATS = {}
def mat(name, rgb, rough=0.85, metal=0.0, glow=0.0, spec=None):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = srgb(*rgb)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if spec is not None: b.inputs["Specular IOR Level"].default_value = spec
    if glow:
        b.inputs["Emission Color"].default_value = srgb(*rgb)
        b.inputs["Emission Strength"].default_value = glow
    MATS[name] = m
    return m

# ---- mesh helpers --------------------------------------------------------------------
def new_obj(name, verts, faces, m=None, edges=()):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], list(edges), list(faces)); me.update()
    for p in me.polygons: p.use_smooth = False
    if m: me.materials.append(m)
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    return ob

def ring(c, rx, ry, n, phase=0.0):
    return [(c[0] + rx * math.cos(2 * math.pi * i / n + phase), c[1] + ry * math.sin(2 * math.pi * i / n + phase), c[2]) for i in range(n)]

def ring_folds(c, rx, ry, n, phase, fold, k):
    """A ring whose radius swings in and out around it: low-poly cloth folds. k = number of folds."""
    out = []
    for i in range(n):
        a = 2 * math.pi * i / n + phase
        f = 1.0 + fold * math.cos(k * a)
        out.append((c[0] + rx * f * math.cos(a), c[1] + ry * f * math.sin(a), c[2]))
    return out

def super_ring(c, rx, ry, n, sq=0.0, phase=-math.pi / 2, drops=None, fold=0.0, folds=0):
    """A ring with squared-off corners (sq -> 1 is a rounded rectangle) whose vertices can
    each hang down: the paintings' shoulder mantles are square yokes that come to points,
    not cones. phase puts vertex 0 at the front centre, facing the camera."""
    p = 1.0 - 0.62 * sq
    out = []
    for i in range(n):
        a = 2 * math.pi * i / n + phase
        ca, sa = math.cos(a), math.sin(a)
        f = 1.0 + fold * math.cos(folds * a) if folds else 1.0
        x = rx * f * math.copysign(abs(ca) ** p, ca)
        y = ry * f * math.copysign(abs(sa) ** p, sa)
        out.append((c[0] + x, c[1] + y, c[2] + (drops(i, a) if drops else 0.0)))
    return out

def rn(n):
    """Ring resolution at the current --res. Four-sided shapes are shapes, not
    approximations of a circle — a pyramid and a blade keep their four sides."""
    return n if n <= 4 else max(6, int(round(n * RES)))

def densify(rings, steps):
    """Extra rings between the given ones, so a taper curves instead of stepping."""
    if steps <= 1 or len(rings) < 2: return rings
    out = []
    for (ca, rxa, rya), (cb, rxb, ryb) in zip(rings, rings[1:]):
        for s in range(steps):
            t = s / steps
            out.append((tuple(ca[k] + (cb[k] - ca[k]) * t for k in range(3)), rxa + (rxb - rxa) * t, rya + (ryb - rya) * t))
    out.append(rings[-1])
    return out

def loft(name, rings, m, cap_bottom=False, cap_top=False, n=8, phase=0.0, fold=0.0, folds=5, sq=0.0, dense=True):
    """rings: list of (center, rx, ry). Faces between consecutive rings; a ring with rx=0 is a tip.
    fold > 0 pleats the rings (deeper toward the last ring), for robes, skirts, hoods and capes.
    sq > 0 squares the cross-section off, for helms and hoods built out of flat planes."""
    n = rn(n)
    if dense: rings = densify(rings, int(round(RES)))
    verts, faces = [], []
    idx = []
    for ri, (c, rx, ry) in enumerate(rings):
        if rx <= 1e-6 and ry <= 1e-6:
            idx.append([len(verts)]); verts.append(tuple(c))
        else:
            idx.append(list(range(len(verts), len(verts) + n)))
            depth = fold * (0.35 + 0.65 * ri / max(1, len(rings) - 1)) if fold else 0.0
            if sq: verts += super_ring(c, rx, ry, n, sq=sq, phase=phase, fold=depth, folds=folds if depth else 0)
            elif fold: verts += ring_folds(c, rx, ry, n, phase, depth, folds)
            else: verts += ring(c, rx, ry, n, phase)
    for a, b in zip(idx, idx[1:]):
        if len(a) == 1:
            for i in range(n): faces.append((a[0], b[(i + 1) % n], b[i]))
        elif len(b) == 1:
            for i in range(n): faces.append((a[i], a[(i + 1) % n], b[0]))
        else:
            for i in range(n): faces.append((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    if cap_bottom and len(idx[0]) > 1: faces.append(tuple(reversed(idx[0])))
    if cap_top and len(idx[-1]) > 1: faces.append(tuple(idx[-1]))
    return new_obj(name, verts, faces, m)

def plate(name, pts, y, m, thick=0.012):
    """A flat polygon standing in the screen plane (x, z) at depth y, facing the camera.
    A lofted prism shows the camera its side, not its cross-section; this shows its face."""
    n = len(pts)
    verts = [(x, y - thick, z) for x, z in pts] + [(x, y + thick, z) for x, z in pts]
    faces = [tuple(range(n))[::-1], tuple(range(n, 2 * n))]
    for i in range(n): faces.append((i, (i + 1) % n, n + (i + 1) % n, n + i))
    return new_obj(name, verts, faces, m)

def hexagon(cx, cz, rx, rz):
    """Points of a pointy-top hexagon: the shape of every hood opening in the paintings."""
    return [(cx + rx * math.cos(math.pi / 2 + i * math.pi / 3), cz + rz * math.sin(math.pi / 2 + i * math.pi / 3)) for i in range(6)]

def face_hole(prefix, cz, rx, rz, m, void, y=-0.13):
    """A hood's face: the dark hexagon, and the hood's own lip standing proud around it."""
    return [plate(f"{prefix}_facelip", hexagon(0, cz, rx * 1.20, rz * 1.16), y + 0.008, m, thick=0.010),
            plate(f"{prefix}_face", hexagon(0, cz, rx, rz), y, void, thick=0.010)]

def box(name, c, sx, sy, sz, m):
    x, y, z = c
    v = [(x - sx, y - sy, z - sz), (x + sx, y - sy, z - sz), (x + sx, y + sy, z - sz), (x - sx, y + sy, z - sz),
         (x - sx, y - sy, z + sz), (x + sx, y - sy, z + sz), (x + sx, y + sy, z + sz), (x - sx, y + sy, z + sz)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return new_obj(name, v, f, m)

def sphere(name, c, r, m, n=8, k=5):
    k = rn(k)                       # loft scales n itself; scaling it here too squares it
    rings = [((c[0], c[1], c[2] - r), 0, 0)]
    for i in range(1, k):
        a = math.pi * i / k
        rings.append(((c[0], c[1], c[2] - r * math.cos(a)), r * math.sin(a), r * math.sin(a)))
    rings.append(((c[0], c[1], c[2] + r), 0, 0))
    return loft(name, rings, m, n=n, dense=False)

def torus(name, c, R, r, m, n=14, k=6):
    n, k = rn(n), rn(k)
    verts, faces = [], []
    for i in range(n):
        a = 2 * math.pi * i / n
        for j in range(k):
            b = 2 * math.pi * j / k
            verts.append((c[0] + (R + r * math.cos(b)) * math.cos(a), c[1] + r * math.sin(b), c[2] + (R + r * math.cos(b)) * math.sin(a)))
    for i in range(n):
        for j in range(k):
            faces.append((i * k + j, ((i + 1) % n) * k + j, ((i + 1) % n) * k + (j + 1) % k, i * k + (j + 1) % k))
    return new_obj(name, verts, faces, m)

def star(name, c, r_out, r_in, t, m, points=8):
    verts, faces = [], []
    for side in (-1, 1):
        for i in range(points * 2):
            a = math.pi * i / points; r = r_out if i % 2 == 0 else r_in
            verts.append((c[0] + r * math.cos(a), c[1] + side * t, c[2] + r * math.sin(a)))
    nn = points * 2
    faces.append(tuple(range(nn)) [::-1]); faces.append(tuple(range(nn, 2 * nn)))
    for i in range(nn): faces.append((i, (i + 1) % nn, nn + (i + 1) % nn, nn + i))
    return new_obj(name, verts, faces, m)

def sheet(name, pts, w0, w1, m, thick=0.012):
    """A hanging cloth: pts are centre points top->bottom, widths interpolate w0->w1. Thin loft."""
    rings = []
    for i, p in enumerate(pts):
        f = i / max(1, len(pts) - 1)
        rings.append((p, w0 + (w1 - w0) * f, thick))
    return loft(name, rings, m, n=8, cap_bottom=True, cap_top=True)

VARIANTS = {}
def facet_variation(ob, seed=0):
    """Low-poly art reads by its facets: give each face a slightly lighter or darker
    copy of its material, chosen deterministically, so flat surfaces stop being flat."""
    slots = list(ob.data.materials)
    if not slots: return
    table = []
    for m in slots:
        if m is None: table.append([None]); continue
        if m.name not in VARIANTS:
            vs = []
            b = m.node_tree.nodes["Principled BSDF"]
            base = list(b.inputs["Base Color"].default_value)
            for f in (0.80, 0.90, 1.0, 1.06):
                v = m.copy(); v.name = f"{m.name}~{f}"
                vb = v.node_tree.nodes["Principled BSDF"]
                vb.inputs["Base Color"].default_value = (min(1, base[0] * f), min(1, base[1] * f), min(1, base[2] * f), 1.0)
                vs.append(v)
            VARIANTS[m.name] = vs
        table.append(VARIANTS[m.name])
    ob.data.materials.clear()
    flat = []
    for vs in table:
        for v in vs:
            if v not in flat: flat.append(v)
    for v in flat: ob.data.materials.append(v)
    for i, poly in enumerate(ob.data.polygons):
        vs = table[poly.material_index] if poly.material_index < len(table) else table[0]
        h = (i * 2654435761 + seed * 40503 + int(abs(poly.center.x * 997 + poly.center.z * 613))) & 0xffff
        v = vs[h % len(vs)]
        poly.material_index = flat.index(v)

def evaluated_copy(ob, name):
    """Bake an object's modifiers into a fresh mesh object (no operators needed)."""
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), depsgraph=dg)
    for p in me.polygons: p.use_smooth = False
    new = bpy.data.objects.new(name, me); scene.collection.objects.link(new)
    new.matrix_world = ob.matrix_world.copy()
    bpy.data.objects.remove(ob, do_unlink=True)
    return new

# ---- the body: a skin mesh over a stick skeleton -------------------------------------
# Each joint: name, position, (radius_x, radius_y), material region.
def skeleton(p):
    """Stick skeleton the body is grown over. Intermediate joints only shape the
    skin (biceps, forearm, thigh, calf); the armature's bones span the real
    joints. p: per-class overrides. Returns joints dict and skin edges."""
    d = dict(shoulder_w=0.29, hip_w=0.11, head_r=0.105, trap_r=(0.22, 0.13), chest_r=(0.22, 0.14), lchest_r=(0.18, 0.125),
             belly_r=(0.16, 0.12), pelvis_r=(0.17, 0.13), delt_r=0.10, bicep_r=0.075, elbow_r=0.062, fore_r=0.066, wrist_r=0.05,
             hand_r=0.055, hip_r=0.10, thigh_r=0.10, knee_r=0.072, calf_r=0.08, ankle_r=0.058, height=1.9)
    d.update(p)
    h = d["height"] / 1.9
    J = {}
    def j(name, x, y, z, r, region):
        J[name] = dict(p=Vector((x, y, z * h)), r=(r if isinstance(r, tuple) else (r, r)), region=region)
    sw, hw = d["shoulder_w"], d["hip_w"]
    j("pelvis", 0, 0, 0.98, d["pelvis_r"], "tunic")
    j("belly", 0, 0, 1.12, d["belly_r"], "tunic")
    j("lchest", 0, 0, 1.26, d["lchest_r"], "tunic")
    j("chest", 0, 0, 1.40, d["chest_r"], "tunic")
    j("trap", 0, 0.01, 1.50, d["trap_r"], "tunic")
    j("neck", 0, 0.01, 1.58, (0.055, 0.055), "cloth")
    j("head", 0, 0.01, 1.70, (d["head_r"], d["head_r"] * 1.05), "head")
    j("crown", 0, 0.0, 1.83, (d["head_r"] * 0.72, d["head_r"] * 0.72), "head")
    for s_, sx in (("L", -1), ("R", 1)):
        j(f"shoulder.{s_}", sx * sw, 0, 1.49, d["delt_r"], "sleeve")
        j(f"bicep.{s_}", sx * (sw + 0.04), 0.01, 1.36, d["bicep_r"], "sleeve")
        j(f"elbow.{s_}", sx * (sw + 0.06), 0.02, 1.24, d["elbow_r"], "sleeve")
        j(f"forearm.{s_}", sx * (sw + 0.065), -0.03, 1.12, d["fore_r"], "bracer")
        j(f"wrist.{s_}", sx * (sw + 0.07), -0.09, 1.00, d["wrist_r"], "bracer")
        j(f"hand.{s_}", sx * (sw + 0.07), -0.15, 0.92, d["hand_r"], "skin")
        j(f"hip.{s_}", sx * hw, 0, 0.96, d["hip_r"], "legs")
        j(f"thigh.{s_}", sx * (hw + 0.01), -0.01, 0.75, d["thigh_r"], "legs")
        j(f"knee.{s_}", sx * (hw + 0.015), -0.01, 0.52, d["knee_r"], "legs")
        j(f"calf.{s_}", sx * (hw + 0.02), 0.01, 0.35, d["calf_r"], "legs")
        j(f"ankle.{s_}", sx * (hw + 0.02), 0.0, 0.10, d["ankle_r"], "boot")
        j(f"toe.{s_}", sx * (hw + 0.02), -0.14, 0.03, (0.05, 0.06), "boot")
    E = [("pelvis", "belly"), ("belly", "lchest"), ("lchest", "chest"), ("chest", "trap"), ("trap", "neck"), ("neck", "head"), ("head", "crown")]
    for s_ in ("L", "R"):
        E += [("trap", f"shoulder.{s_}"), (f"shoulder.{s_}", f"bicep.{s_}"), (f"bicep.{s_}", f"elbow.{s_}"), (f"elbow.{s_}", f"forearm.{s_}"),
              (f"forearm.{s_}", f"wrist.{s_}"), (f"wrist.{s_}", f"hand.{s_}"),
              ("pelvis", f"hip.{s_}"), (f"hip.{s_}", f"thigh.{s_}"), (f"thigh.{s_}", f"knee.{s_}"), (f"knee.{s_}", f"calf.{s_}"),
              (f"calf.{s_}", f"ankle.{s_}"), (f"ankle.{s_}", f"toe.{s_}")]
    return J, E

# armature bones: name -> (head joint, tail joint, parent)
BONES = [("pelvis", "pelvis", "belly", None), ("spine", "belly", "trap", "pelvis"), ("neck", "trap", "neck", "spine"),
         ("head", "neck", "crown", "neck")]
for s in ("L", "R"):
    BONES += [(f"upper_arm.{s}", f"shoulder.{s}", f"elbow.{s}", "spine"), (f"forearm.{s}", f"elbow.{s}", f"wrist.{s}", f"upper_arm.{s}"),
              (f"hand.{s}", f"wrist.{s}", f"hand.{s}", f"forearm.{s}"),
              (f"thigh.{s}", f"hip.{s}", f"knee.{s}", "pelvis"), (f"shin.{s}", f"knee.{s}", f"ankle.{s}", f"thigh.{s}"),
              (f"foot.{s}", f"ankle.{s}", f"toe.{s}", f"shin.{s}")]

def seg_dist(p, a, b):
    ab = b - a; t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (p - (a + ab * t)).length, t

def build_body(cls, props, regions):
    J, E = skeleton(props)
    names = list(J.keys()); index = {n: i for i, n in enumerate(names)}
    verts = [J[n]["p"] for n in names]; edges = [(index[a], index[b]) for a, b in E]
    me = bpy.data.meshes.new(f"{cls}_skel"); me.from_pydata([tuple(v) for v in verts], edges, []); me.update()
    ob = bpy.data.objects.new(f"{cls}_skel", me); scene.collection.objects.link(ob)
    skin = ob.modifiers.new("skin", "SKIN"); skin.use_smooth_shade = False
    for i, n in enumerate(names):
        sv = me.skin_vertices[0].data[i]; sv.radius = J[n]["r"]; sv.use_root = (n == "pelvis")
    sub = ob.modifiers.new("sub", "SUBSURF")
    sub.levels = sub.render_levels = 1 if RES <= 1.0 else 2
    body = evaluated_copy(ob, f"{cls}_body")
    # material regions by nearest skeleton segment
    seg = [(J[a]["p"], J[b]["p"], J[b]["region"] if J[b]["region"] != "tunic" else J[a]["region"]) for a, b in E]
    # torso segments: tunic; legs: legs; feet: boot; arms: sleeve/bracer/skin
    mats_order = []
    for f in body.data.polygons:
        c = f.center
        best = min(seg, key=lambda s: seg_dist(c, s[0], s[1])[0])
        reg = best[2]
        if reg == "legs" and c.z < 0.40: reg = "boot"
        m = regions[reg]
        if m.name not in [x.name for x in body.data.materials]: body.data.materials.append(m)
        f.material_index = [x.name for x in body.data.materials].index(m.name)
    return body, J

def build_armature(cls, J):
    arm_data = bpy.data.armatures.new(f"{cls}_arm"); arm = bpy.data.objects.new(f"{cls}_arm", arm_data)
    scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = {}
    for name, h, t, parent in BONES:
        b = arm_data.edit_bones.new(name); b.head = J[h]["p"]; b.tail = J[t]["p"]; eb[name] = b
        if parent: b.parent = eb[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in arm.pose.bones: pb.rotation_mode = "QUATERNION"
    return arm

def weight_to_armature(ob, arm, J, radius_scale=2.0):
    segs = {name: (J[h]["p"], J[t]["p"], max(J[h]["r"][0], J[t]["r"][0])) for name, h, t, _ in BONES}
    groups = {name: ob.vertex_groups.new(name=name) for name in segs}
    for v in ob.data.vertices:
        p = ob.matrix_world @ v.co
        ws = []
        for name, (a, b, r) in segs.items():
            d, _ = seg_dist(p, a, b)
            w = max(0.0, 1.0 - d / (r * radius_scale)) ** 2
            if w > 0: ws.append((name, w))
        if not ws:
            name = min(segs, key=lambda n: seg_dist(p, segs[n][0], segs[n][1])[0]); ws = [(name, 1.0)]
        ws.sort(key=lambda x: -x[1]); ws = ws[:3]
        tot = sum(w for _, w in ws)
        for name, w in ws: groups[name].add([v.index], w / tot, "REPLACE")
    mod = ob.modifiers.new("arm", "ARMATURE"); mod.object = arm
    # The armature modifier cancels the armature OBJECT's own transform unless
    # the mesh is its child, so a whole-figure move, turn or lie-down would be
    # ignored. Parent it, with identity inverse: both live in world space.
    ob.parent = arm; ob.matrix_parent_inverse = Matrix.Identity(4)

SOFT = set()   # names of pieces that hang on the body and should bend with it
def attach_soft(ob, arm, J):
    """Cloth that hangs over several bones (skirt, robe, cape): weight it like the body."""
    weight_to_armature(ob, arm, J, radius_scale=2.6)

def parent_to_bone(ob, arm, bone):
    """Attach a rigid piece to one bone: every vertex weighted 1.0 to it, deformed
    by the same armature modifier as the body. This follows the armature
    object's own move and turn too, which bone-parenting did not reliably do."""
    g = ob.vertex_groups.new(name=bone)
    g.add([v.index for v in ob.data.vertices], 1.0, "REPLACE")
    mod = ob.modifiers.new("arm", "ARMATURE"); mod.object = arm
    ob.parent = arm; ob.matrix_parent_inverse = Matrix.Identity(4)

# ---- dressing ------------------------------------------------------------------------
def boots(prefix, J, m_boot, m_cuff=None, cuff_h=0.0, shaft_top=0.40, r=0.078):
    """A boot per leg: shaft over the shin, foot forward over the toe. Soft-weighted so it bends at the ankle."""
    out = []
    for s_ in ("L", "R"):
        a, t = J[f"ankle.{s_}"]["p"], J[f"toe.{s_}"]["p"]
        c = J[f"calf.{s_}"]["p"]
        shaft = loft(f"{prefix}_boot.{s_}", [((c.x, c.y, shaft_top), r * 1.05, r * 1.0), ((a.x, a.y + 0.01, 0.22), r * 0.95, r * 0.9), ((a.x, a.y + 0.01, 0.09), r * 0.9, r * 0.9),
                                            ((a.x, a.y - 0.02, 0.03), r * 0.95, r * 1.0), ((t.x, t.y - 0.02, 0.025), 0.055, 0.045), ((t.x, t.y - 0.07, 0.02), 0.02, 0.02), ((t.x, t.y - 0.08, 0.02), 0, 0)],
                     m_boot, n=8, cap_bottom=True)
        out.append((shaft, "soft"))
        if m_cuff and cuff_h:
            cuff = loft(f"{prefix}_bootcuff.{s_}", [((c.x, c.y, shaft_top + cuff_h), r * 1.15, r * 1.1), ((c.x, c.y, shaft_top - 0.01), r * 1.12, r * 1.07)], m_cuff, n=8)
            out.append((cuff, "soft"))
    return out

def fists(prefix, J, m, r=0.055):
    out = []
    for s_ in ("L", "R"):
        hnd = J[f"hand.{s_}"]["p"]
        f = loft(f"{prefix}_fist.{s_}", [((hnd.x, hnd.y, hnd.z + r * 0.9), r * 0.5, r * 0.5), ((hnd.x, hnd.y - 0.01, hnd.z + r * 0.3), r, r * 0.9),
                                        ((hnd.x, hnd.y - 0.01, hnd.z - r * 0.5), r * 0.95, r * 0.85), ((hnd.x, hnd.y, hnd.z - r), 0, 0)], m, n=7, cap_bottom=True)
        out.append((f, f"hand.{s_}"))
    return out

def tiers(prefix, base_z, tiers_spec, m, n=10, phase=0.0):
    """Layered shoulder cloth/plate: each tier is (drop, rx, ry, hem_rx, hem_ry); tiers stack outward and lower."""
    out = []
    for i, (top_z, rx, ry, hx, hy, hem_z) in enumerate(tiers_spec):
        t = loft(f"{prefix}_tier{i}", [((0, 0, top_z), rx, ry), ((0, 0, hem_z + 0.03), hx * 0.97, hy * 0.97), ((0, 0, hem_z), hx, hy)], m, n=n, phase=phase, fold=0.06, folds=n // 2)
        out.append((t, "spine"))
    return out

def pyramid(name, c, r, h, m, toward=(0, -1, 0)):
    """The paintings' signature ornament: a four-sided gold pyramid, base on the surface, tip toward the camera."""
    ob = loft(name, [((0, 0, -0.01), r, r), ((0, 0, h), 0, 0)], m, n=4, cap_bottom=True)
    ob.data.transform(Matrix.Translation(c) @ Vector(toward).to_track_quat("Z", "Y").to_matrix().to_4x4())
    return ob

def studs(prefix, m, points, r=0.018):
    return [(pyramid(f"{prefix}_stud{i}", p_, r * 1.4, r * 1.6, m), bone) for i, (p_, bone) in enumerate(points)]

def build_rogue(J, arm, M):
    parts = []
    # hood: deep cowl folds at the neck, peaked crown, drapes back
    hood = loft("rogue_hood", [((0, 0.05, 1.42), 0.31, 0.24), ((0, 0.04, 1.52), 0.26, 0.21), ((0, 0.04, 1.62), 0.22, 0.19), ((0, 0.04, 1.72), 0.20, 0.18),
                               ((0, 0.03, 1.82), 0.18, 0.165), ((0, 0.01, 1.90), 0.14, 0.13), ((0, -0.02, 1.96), 0.07, 0.07), ((0, -0.04, 1.985), 0, 0)],
                M["hood"], n=10, fold=0.05, folds=4)
    parts.append((hood, "head"))
    face = loft("rogue_face", [((0, -0.12, 1.58), 0.115, 0.02), ((0, -0.12, 1.78), 0.11, 0.02)], M["void"], cap_bottom=True, cap_top=True, n=8)
    parts.append((face, "head"))
    mask = loft("rogue_mask", [((0, -0.115, 1.60), 0.085, 0.03), ((0, -0.115, 1.66), 0.085, 0.03)], M["hood"], cap_bottom=True, cap_top=True, n=8)
    parts.append((mask, "head"))
    # mantle in two pointed tiers, gold studs at the points
    parts += tiers("rogue_mantle", 1.50, [(1.54, 0.17, 0.14, 0.44, 0.27, 1.22), (1.52, 0.16, 0.13, 0.37, 0.23, 1.31), (1.50, 0.15, 0.12, 0.29, 0.19, 1.40)], M["mantle"], n=8, phase=math.pi / 8)
    parts += studs("rogue_mantle", M["gold"], [((0.39, -0.14, 1.25), "spine"), ((-0.39, -0.14, 1.25), "spine"), ((0.0, -0.25, 1.25), "spine"), ((0.0, -0.22, 1.43), "spine")], r=0.022)
    for s_, sx in (("L", -1), ("R", 1)):   # leather shoulder plates over the mantle points
        sh = J[f"shoulder.{s_}"]["p"]
        plate = loft(f"rogue_shoulder.{s_}", [((sh.x + sx * 0.02, sh.y, sh.z + 0.08), 0.0, 0.0), ((sh.x + sx * 0.05, sh.y, sh.z + 0.03), 0.13, 0.12), ((sh.x + sx * 0.08, sh.y, sh.z - 0.10), 0.14, 0.12)], M["mantle"], n=7)
        parts.append((plate, f"upper_arm.{s_}"))
    # tunic skirt with a split front flap, belt with buckle and pouch, crossed straps
    skirt = loft("rogue_skirt", [((0, 0, 1.02), 0.185, 0.135), ((0, 0, 0.88), 0.215, 0.155), ((0, 0.01, 0.70), 0.245, 0.175), ((0, 0.02, 0.60), 0.25, 0.18)], M["tunic"], n=10, fold=0.07, folds=5)
    parts.append((skirt, "soft"))
    flap = loft("rogue_flap", [((0, -0.17, 1.02), 0.09, 0.012), ((0, -0.20, 0.72), 0.10, 0.012), ((0, -0.22, 0.48), 0.06, 0.012), ((0, -0.23, 0.42), 0, 0)], M["tunic"], n=6, cap_bottom=True)
    parts.append((flap, "soft"))
    belt = loft("rogue_belt", [((0, 0, 1.07), 0.19, 0.14), ((0, 0, 1.00), 0.195, 0.145)], M["leather"], n=10); parts.append((belt, "pelvis"))
    belt2 = loft("rogue_belt2", [((0, 0, 0.99), 0.20, 0.15), ((0, 0, 0.95), 0.205, 0.155)], M["leather"], n=10); parts.append((belt2, "pelvis"))
    buckle = box("rogue_buckle", (0.0, -0.15, 1.035), 0.04, 0.012, 0.04, M["gold"]); parts.append((buckle, "pelvis"))
    pouch = box("rogue_pouch", (0.17, -0.10, 0.93), 0.045, 0.035, 0.05, M["leather"]); parts.append((pouch, "pelvis"))
    strap = box("rogue_strap", (0, 0, 0), 0.03, 0.012, 0.21, M["leather"])
    strap.data.transform(Matrix.Translation((0.0, -0.145, 1.28)) @ Matrix.Rotation(math.radians(36), 4, "Y")); parts.append((strap, "spine"))
    parts += studs("rogue_strap", M["gold"], [((0.0, -0.165, 1.28), "spine")], r=0.024)
    # the cowl: cloth wound round the neck under the hood, in heavy folds
    wrap = loft("rogue_wrap", [((0, 0.01, 1.47), 0.17, 0.14), ((0, 0.0, 1.53), 0.185, 0.15), ((0, -0.01, 1.60), 0.16, 0.135), ((0, -0.01, 1.64), 0.12, 0.11)], M["hood"], n=10, fold=0.12, folds=5)
    parts.append((wrap, "neck"))
    for s_ in ("L", "R"):
        e, w, hnd = J[f"elbow.{s_}"]["p"], J[f"wrist.{s_}"]["p"], J[f"hand.{s_}"]["p"]
        d = (w - e); L = d.length
        br = loft(f"rogue_bracer.{s_}", [((0, 0, 0.10 * L), 0.072, 0.072), ((0, 0, 0.45 * L), 0.07, 0.07), ((0, 0, 0.95 * L), 0.062, 0.062)], M["leather"], n=8)
        br.matrix_world = Matrix.Translation(e) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4(); parts.append((br, f"forearm.{s_}"))
        for k in (0.3, 0.6):   # wrap lines
            wrap = loft(f"rogue_wrap{k}.{s_}", [((0, 0, k * L), 0.076, 0.076), ((0, 0, (k + 0.06) * L), 0.076, 0.076)], M["leather_dark"], n=8)
            wrap.matrix_world = br.matrix_world.copy(); parts.append((wrap, f"forearm.{s_}"))
        spike = loft(f"rogue_spike.{s_}", [((0, 0, 0.15 * L), 0.03, 0.03), ((0, -0.06, 0.05 * L), 0, 0)], M["gold"], n=4, cap_bottom=True)
        spike.matrix_world = br.matrix_world.copy(); parts.append((spike, f"forearm.{s_}"))
        blade = weapon_along(f"rogue_blade.{s_}", J, s_, [((0, 0, 0.03), 0.018, 0.018), ((0, 0, 0.10), 0.032, 0.010), ((0, 0, 0.30), 0.017, 0.006), ((0, 0, 0.37), 0, 0)], M["steel"])
        guard = weapon_along(f"rogue_guard.{s_}", J, s_, [((0, 0, 0.075), 0.05, 0.012), ((0, 0, 0.095), 0.05, 0.012)], M["gold"])
        pommel = weapon_along(f"rogue_pommel.{s_}", J, s_, [((0, 0, -0.06), 0.02, 0.02), ((0, 0, -0.02), 0.02, 0.02)], M["gold"])
        parts += [(blade, f"hand.{s_}"), (guard, f"hand.{s_}"), (pommel, f"hand.{s_}")]
    parts += fists("rogue", J, M["skin"])
    parts += boots("rogue", J, M["boot"], M["leather"], cuff_h=0.05)
    for ob, bone in parts:
        if bone == "soft": attach_soft(ob, arm, J)
        else: parent_to_bone(ob, arm, bone)
    return [ob for ob, _ in parts]

def weapon_along(name_prefix, J, s, rings, m, cap=True, n=6):
    """A held thing whose axis continues the forearm past the fist."""
    w, hnd = J[f"wrist.{s}"]["p"], J[f"hand.{s}"]["p"]
    fd = (hnd - w).normalized()
    ob = loft(name_prefix, rings, m, n=n, cap_bottom=cap)
    ob.matrix_world = Matrix.Translation(hnd) @ fd.to_track_quat("Z", "Y").to_matrix().to_4x4()
    return ob

def along(name, a, b, rings, m, n=8, cap_bottom=False, cap_top=False, fold=0.0, folds=4):
    """A loft whose Z axis runs from point a toward point b (rings use z in metres along it)."""
    d = Vector(b) - Vector(a)
    ob = loft(name, rings, m, n=n, cap_bottom=cap_bottom, cap_top=cap_top, fold=fold, folds=folds)
    ob.matrix_world = Matrix.Translation(Vector(a)) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    return ob

# ---- components ------------------------------------------------------------------------
# Every costume part is one function, registered with the bone it hangs on, and
# built against its crop of the painting (tools/lowpoly-components.json) with a
# material coloured from that crop. `M` carries the shared materials.
COMPONENTS = {}
def component(cls, name, bone):
    def deco(fn):
        COMPONENTS.setdefault(cls, []).append((name, bone, fn)); return fn
    return deco

def shared_materials():
    return dict(gold=mat("gold", (186, 145, 52), rough=0.36, metal=0.85, glow=0.07), steel=mat("steel", (86, 86, 92), rough=0.46, metal=0.9), brass=mat("brass", (128, 98, 44), rough=0.45, metal=0.8),
                skin=mat("skin", (104, 72, 52)), void=mat("void", (3, 3, 3), rough=1.0, spec=0.0), glow=mat("star_glow", (255, 210, 140), rough=0.2, glow=3.0),
                boot=mat("boot", (30, 26, 22)), wood=mat("wood", (44, 32, 24)))

def pointed_tiers(prefix, m, gold, tiers, n=8, fold=0.03, dip=0.07):
    n = rn(n)
    """Layered shoulder cape whose hem comes to hanging points — straight ahead and
    over each shoulder — the way the paintings' leather mantles do: every other
    hem vertex drops by `dip`. A folded-back inner ring gives the edge thickness.
    tiers: (top_z, rx, ry, hx, hy, hem_z, trim)."""
    out = []
    for i, (top_z, rx, ry, hx, hy, hem_z, trim) in enumerate(tiers):
        verts, faces = [], []
        def ring_(cz, sx, sy, dipping):
            base = len(verts)
            for k in range(n):
                a = 2 * math.pi * k / n - math.pi / 2
                d = dip if (dipping and k % 2 == 0) else 0.0
                verts.append((sx * math.cos(a), sy * math.sin(a) + 0.01, cz - d))
            return list(range(base, base + n))
        r0 = ring_(top_z, rx, ry, False)
        r1 = ring_(hem_z + 0.05, hx * 0.95, hy * 0.95, False)
        r2 = ring_(hem_z, hx, hy, True)
        r3 = ring_(hem_z + 0.025, hx * 0.93, hy * 0.93, True)
        for ra, rb in ((r0, r1), (r1, r2), (r2, r3)):
            for k in range(n): faces.append((ra[k], ra[(k + 1) % n], rb[(k + 1) % n], rb[k]))
        out.append(new_obj(f"{prefix}_tier{i}", verts, faces, m))
        if trim:
            tv, tf = [], []
            def tring(cz, sx, sy, dipping):
                base = len(tv)
                for k in range(n):
                    a = 2 * math.pi * k / n - math.pi / 2
                    d = dip if (dipping and k % 2 == 0) else 0.0
                    tv.append((sx * math.cos(a), sy * math.sin(a) + 0.01, cz - d))
                return list(range(base, base + n))
            t0 = tring(hem_z + 0.02, hx * 1.012, hy * 1.012, True); t1 = tring(hem_z - 0.004, hx * 1.012, hy * 1.012, True)
            for k in range(n): tf.append((t0[k], t0[(k + 1) % n], t1[(k + 1) % n], t1[k]))
            out.append(new_obj(f"{prefix}_trim{i}", tv, tf, gold))
    return out

def yoke(prefix, m, gold, tiers, n=12, sq=0.6):
    n = rn(n)
    """A squared shoulder yoke: flat panels across the shoulders, the hem falling to a point
    at the front centre and over each shoulder, a folded-back inner edge and a gold band.
    tiers: (top_z, rx, ry, hx, hy, hem_z, v_drop, corner_drop, trim), widest tier first."""
    out = []
    for ti, (top_z, rx, ry, hx, hy, hem_z, vdrop, cdrop, trim) in enumerate(tiers):
        def drops(k, a, vdrop=vdrop, cdrop=cdrop):
            f = math.cos(a + math.pi / 2)                 # 1 at the front centre, 0 at the sides
            v = vdrop * max(0.0, f) ** 1.3
            c = cdrop * abs(math.sin(a + math.pi / 2)) ** 4 * (1.0 if f > -0.3 else 0.35)
            return -(v + c)
        verts, faces = [], []
        def push(rs):
            base = len(verts); verts.extend(rs); return list(range(base, base + n))
        r0 = push(super_ring((0, 0.01, top_z), rx, ry, n, sq=sq * 0.7))
        r1 = push(super_ring((0, 0.01, hem_z + 0.06), hx * 0.92, hy * 0.92, n, sq=sq, drops=drops))
        r2 = push(super_ring((0, 0.01, hem_z), hx, hy, n, sq=sq, drops=drops))
        r3 = push(super_ring((0, 0.01, hem_z + 0.03), hx * 0.93, hy * 0.93, n, sq=sq, drops=drops))
        for ra, rb in ((r0, r1), (r1, r2), (r2, r3)):
            for k in range(n): faces.append((ra[k], ra[(k + 1) % n], rb[(k + 1) % n], rb[k]))
        out.append(new_obj(f"{prefix}_yoke{ti}", verts, faces, m))
        if trim:
            tv, tf = [], []
            def tpush(rs):
                base = len(tv); tv.extend(rs); return list(range(base, base + n))
            t0 = tpush(super_ring((0, 0.01, hem_z + 0.028), hx * 1.015, hy * 1.015, n, sq=sq, drops=drops))
            t1 = tpush(super_ring((0, 0.01, hem_z - 0.004), hx * 1.015, hy * 1.015, n, sq=sq, drops=drops))
            for k in range(n): tf.append((t0[k], t0[(k + 1) % n], t1[(k + 1) % n], t1[k]))
            out.append(new_obj(f"{prefix}_trim{ti}", tv, tf, gold))
    return out

def on_surface(rings, x, z, push=1.03):
    """The point on a lofted torso where a seam at (x, z) lies, pushed just proud of it."""
    rx, ry = rings[-1][1], rings[-1][2]
    for (z0, rx0, ry0), (z1, rx1, ry1) in zip(rings, rings[1:]):
        if z0 >= z >= z1 or (z0, rx0, ry0) == rings[0] and z > z0:
            t = max(0.0, min(1.0, (z0 - z) / (z0 - z1)))
            rx, ry = rx0 + (rx1 - rx0) * t, ry0 + (ry1 - ry0) * t
            break
    q = min(1.0, abs(x) / rx)
    return (x, -ry * math.sqrt(max(0.0, 1 - q * q)) * push, z)

def seam(name, rings, a, b, halfw, m, n=6):
    n = rn(n)
    """A quilting seam laid over a lofted torso, from (x, z) a to b."""
    verts, faces = [], []
    for i in range(n + 1):
        t = i / n
        x, z = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
        verts += [on_surface(rings, x - halfw, z), on_surface(rings, x + halfw, z)]
    for i in range(n): faces.append((2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2))
    return new_obj(name, verts, faces, m)

# ---------------- ROGUE ----------------
@component("rogue", "hood", "head")
def rogue_hood(J, M):
    m = paint("rogue", "hood", "leather")
    # a deep shell that drapes to the shoulders, a thick rim round the face opening, the face in shadow, a scarf across the mouth
    hood = loft("rogue_hood", [((0, 0.07, 1.38), 0.34, 0.27), ((0, 0.055, 1.56), 0.27, 0.225), ((0, 0.05, 1.74), 0.235, 0.21),
                               ((0, 0.055, 1.88), 0.185, 0.17), ((0, 0.075, 1.98), 0.10, 0.10), ((0, 0.10, 2.03), 0, 0)],
                m, n=7, sq=0.5, phase=math.pi / 2)
    face = face_hole("rogue", 1.705, 0.128, 0.155, m, M["void"], y=-0.186)
    mask = plate("rogue_mask", [(-0.105, 1.575), (0.105, 1.575), (0.118, 1.640), (0.0, 1.700), (-0.118, 1.640)], -0.202, paint("rogue", "cowl", "cloth"), thick=0.010)
    return [hood] + face + [mask]

@component("rogue", "cowl", "neck")
def rogue_cowl(J, M):
    m = paint("rogue", "cowl", "cloth")
    out = []
    for i, (z, rx, ry) in enumerate([(1.46, 0.18, 0.15), (1.52, 0.19, 0.155), (1.58, 0.165, 0.14)]):
        out.append(loft(f"rogue_cowl{i}", [((0, 0.0, z), rx, ry), ((0, 0.0, z + 0.05), rx * 1.02, ry * 1.02), ((0, 0.0, z + 0.065), rx * 0.92, ry * 0.92)], m, n=10, fold=0.10, folds=5, phase=i * 0.4))
    return out

@component("rogue", "mantle", "spine")
def rogue_mantle(J, M):
    m = paint("rogue", "mantle", "leather")
    out = yoke("rogue_mantle", m, M["gold"], [(1.55, 0.25, 0.175, 0.47, 0.275, 1.30, 0.06, 0.20, False), (1.47, 0.20, 0.145, 0.375, 0.235, 1.14, 0.05, 0.15, False)], n=12, sq=0.88)
    out += [pyramid("rogue_mstud_l", (-0.46, -0.06, 1.23), 0.028, 0.04, M["gold"], toward=(-0.6, -1, 0)), pyramid("rogue_mstud_r", (0.46, -0.06, 1.23), 0.028, 0.04, M["gold"], toward=(0.6, -1, 0)),
            pyramid("rogue_mstud_c", (0.0, -0.27, 1.23), 0.03, 0.045, M["gold"]), pyramid("rogue_mstud_c2", (0.0, -0.22, 1.42), 0.024, 0.036, M["gold"])]
    return out

@component("rogue", "tunic", "spine")
def rogue_tunic(J, M):
    mt = paint("rogue", "tunic", "cloth"); m = paint("rogue", "belt", "leather")
    rings = [(1.52, 0.22, 0.14), (1.40, 0.235, 0.15), (1.26, 0.215, 0.14), (1.10, 0.20, 0.135)]
    chest = loft("rogue_chest", [((0, 0, z), rx, ry) for z, rx, ry in rings], mt, n=10, fold=0.03, folds=5)
    out = [chest]
    # quilting: seams crossing at a diamond, the way the painting's padded chest is stitched
    mq = mat("rogue_quilt", tone("rogue", (74, 86, 58)), rough=0.95)
    for k, x0 in enumerate((-0.20, -0.09, 0.02, 0.13)):
        out.append(seam(f"rogue_quiltA{k}", rings, (x0, 1.49), (x0 + 0.20, 1.13), 0.006, mq))
        out.append(seam(f"rogue_quiltB{k}", rings, (-x0, 1.49), (-x0 - 0.20, 1.13), 0.006, mq))
    strap = seam("rogue_strap", rings, (-0.17, 1.50), (0.15, 1.11), 0.044, m, n=8)
    strap2 = seam("rogue_strap2", rings, (0.16, 1.50), (-0.06, 1.14), 0.032, m, n=8)
    buckle = plate("rogue_strapbuckle", [(-0.075, 1.235), (-0.035, 1.265), (0.005, 1.235), (-0.035, 1.205)], -0.163, M["gold"], thick=0.010)
    band = loft("rogue_chestband", [((0, 0, 1.19), 0.225, 0.145), ((0, 0, 1.15), 0.225, 0.145)], m, n=10)
    return out + [strap, strap2, buckle, band, pyramid("rogue_tstud", (0.0, -0.175, 1.30), 0.03, 0.045, M["gold"])]

@component("rogue", "belt", "pelvis")
def rogue_belt(J, M):
    m = paint("rogue", "belt", "leather")
    b1 = loft("rogue_belt1", [((0, 0, 1.08), 0.195, 0.145), ((0, 0, 1.02), 0.20, 0.15)], m, n=10)
    b2 = loft("rogue_belt2", [((0, 0, 1.00), 0.205, 0.155), ((0, 0, 0.955), 0.21, 0.16)], m, n=10)
    return [b1, b2, pyramid("rogue_buckle", (0.0, -0.155, 1.05), 0.045, 0.05, M["gold"])]

@component("rogue", "pouch", "pelvis")
def rogue_pouch(J, M):
    m = paint("rogue", "pouch", "leather")
    body = box("rogue_pouch", (0.19, -0.10, 0.90), 0.05, 0.04, 0.06, m)
    flap = box("rogue_pouchflap", (0.19, -0.12, 0.945), 0.052, 0.025, 0.02, m)
    return [body, flap, pyramid("rogue_pstud", (0.19, -0.145, 0.945), 0.014, 0.02, M["gold"])]

@component("rogue", "skirt", "soft")
def rogue_skirt(J, M):
    m = paint("rogue", "skirt", "cloth"); ml = paint("rogue", "mantle", "leather")
    out = yoke("rogue_skirt", m, M["gold"], [(1.04, 0.21, 0.155, 0.32, 0.22, 0.60, 0.16, 0.20, False), (1.02, 0.195, 0.145, 0.27, 0.19, 0.76, 0.11, 0.14, False)], n=10, sq=0.55)
    out.append(loft("rogue_skirtedge", [((0, 0.01, 0.585), 0.302, 0.212), ((0, 0.01, 0.555), 0.302, 0.212)], ml, n=8, phase=-math.pi / 2))
    out.append(pyramid("rogue_sstud", (0.0, -0.215, 0.60), 0.02, 0.03, M["gold"]))
    return out

@component("rogue", "trousers", "soft")
def rogue_trousers(J, M):
    m = paint("rogue", "cowl", "cloth"); out = []
    for s_ in ("L", "R"):
        h, k, a = J[f"hip.{s_}"]["p"], J[f"knee.{s_}"]["p"], J[f"ankle.{s_}"]["p"]
        out.append(along(f"rogue_thigh.{s_}", h, k, [((0, 0, 0.0), 0.11, 0.11), ((0, 0, (k - h).length), 0.085, 0.085)], m, n=8, fold=0.04, folds=4))
        out.append(along(f"rogue_shin.{s_}", k, a, [((0, 0, 0.0), 0.082, 0.082), ((0, 0, (a - k).length * 0.7), 0.075, 0.075)], m, n=8))
    return out

def rogue_bracer(J, M, s_):
    m = paint("rogue", "bracer_r", "leather"); md = paint("rogue", "bracer_l", "leather")
    e, w = J[f"elbow.{s_}"]["p"], J[f"wrist.{s_}"]["p"]; L = (w - e).length
    out = [along(f"rogue_bracer.{s_}", e, w, [((0, 0, 0.08 * L), 0.074, 0.074), ((0, 0, 0.5 * L), 0.072, 0.072), ((0, 0, 0.96 * L), 0.064, 0.064)], m, n=8)]
    for k in (0.2, 0.42, 0.64, 0.84):
        r_ = along(f"rogue_wrap{k}.{s_}", e, w, [((0, 0, k * L), 0.079, 0.079), ((0, 0, (k + 0.07) * L), 0.079, 0.079)], md, n=8)
        out.append(r_)
    out.append(along(f"rogue_spike.{s_}", e, w, [((0, 0, 0.14 * L), 0.035, 0.035), ((0, -0.075, 0.02 * L), 0, 0)], M["gold"], n=4, cap_bottom=True))
    return out
@component("rogue", "bracer_l", "forearm.L")
def rogue_bracer_l(J, M): return rogue_bracer(J, M, "L")
@component("rogue", "bracer_r", "forearm.R")
def rogue_bracer_r(J, M): return rogue_bracer(J, M, "R")

def rogue_fist(J, M, s_):
    m = paint("rogue", "fist_r", "leather")
    hnd = J[f"hand.{s_}"]["p"]; r = 0.058
    glove = loft(f"rogue_glove.{s_}", [((hnd.x, hnd.y, hnd.z + r * 0.9), r * 0.5, r * 0.5), ((hnd.x, hnd.y - 0.01, hnd.z + r * 0.3), r, r * 0.9), ((hnd.x, hnd.y - 0.01, hnd.z - r * 0.5), r * 0.95, r * 0.85), ((hnd.x, hnd.y, hnd.z - r), 0, 0)], m, n=7, cap_bottom=True)
    fingers = box(f"rogue_fingers.{s_}", (hnd.x, hnd.y - 0.045, hnd.z - 0.005), 0.045, 0.02, 0.028, M["skin"])
    return [glove, fingers]
@component("rogue", "fist_l", "hand.L")
def rogue_fist_l(J, M): return rogue_fist(J, M, "L")
@component("rogue", "fist_r", "hand.R")
def rogue_fist_r(J, M): return rogue_fist(J, M, "R")

def rogue_dagger(J, M, s_):
    blade = weapon_along(f"rogue_blade.{s_}", J, s_, [((0, 0, 0.06), 0.03, 0.03), ((0, 0, 0.12), 0.06, 0.014), ((0, 0, 0.32), 0.045, 0.01), ((0, 0, 0.46), 0, 0)], M["steel"], n=4)
    guard = weapon_along(f"rogue_guard.{s_}", J, s_, [((0, 0, 0.09), 0.025, 0.016), ((0, 0, 0.105), 0.075, 0.016), ((0, 0, 0.125), 0.075, 0.016), ((0, 0, 0.14), 0.025, 0.016)], M["gold"], n=6)
    grip = weapon_along(f"rogue_grip.{s_}", J, s_, [((0, 0, -0.07), 0.018, 0.018), ((0, 0, 0.09), 0.018, 0.018)], M["wood"], n=6)
    pommel = weapon_along(f"rogue_pommel.{s_}", J, s_, [((0, 0, -0.09), 0.024, 0.024), ((0, 0, -0.065), 0.024, 0.024)], M["gold"], n=6)
    return [blade, guard, grip, pommel]
@component("rogue", "dagger_l", "hand.L")
def rogue_dagger_l(J, M): return rogue_dagger(J, M, "L")
@component("rogue", "dagger_r", "hand.R")
def rogue_dagger_r(J, M): return rogue_dagger(J, M, "R")

@component("rogue", "boots", "soft")
def rogue_boots(J, M): return [ob for ob, _ in boots("rogue", J, M["boot"], paint("rogue", "belt", "leather"), cuff_h=0.05)]

def curved_plate(name, pts, y, bulge, m, thick=0.02):
    """A shaped plate standing in the screen plane, bowed toward the camera in the
    middle so it catches light like armour instead of reading as cardboard. pts are
    (x, z) corners in order; the bow is strongest at the middle of the span."""
    n = len(pts)
    xs = [p[0] for p in pts]
    lo, hi = min(xs), max(xs)
    def bow(x):
        t = 0.0 if hi == lo else (x - lo) / (hi - lo)
        return -bulge * math.sin(math.pi * t)
    verts = [(x, y + bow(x), z) for x, z in pts] + [(x, y + bow(x) + thick, z) for x, z in pts]
    faces = [tuple(range(n))[::-1], tuple(range(n, 2 * n))]
    for i in range(n): faces.append((i, (i + 1) % n, n + (i + 1) % n, n + i))
    return new_obj(name, verts, faces, m)

# ---------------- REAVER ----------------
@component("reaver", "helm", "head")
def reaver_helm(J, M):
    m = paint("reaver", "helm", "plate")
    # flat planes, a broad face, a peaked crown: the painting's helm is built out of
    # slabs, not a dome. sq squares the cross-section; the phase puts a face forward.
    ph = math.pi / 8
    helm = loft("reaver_helm", [((0, 0, 1.47), 0.215, 0.205), ((0, 0, 1.68), 0.218, 0.208), ((0, 0.0, 1.84), 0.20, 0.19),
                                ((0, 0.0, 1.98), 0.125, 0.12), ((0, 0.0, 2.07), 0, 0)],
                m, n=6, phase=ph, sq=0.75)
    ridge = loft("reaver_ridge", [((0, -0.155, 1.83), 0.018, 0.022), ((0, -0.09, 1.97), 0.016, 0.02), ((0, 0.0, 2.06), 0, 0)], m, n=4, cap_bottom=True)
    face = plate("reaver_faceplate", [(-0.175, 1.50), (0.175, 1.50), (0.19, 1.60), (0.175, 1.76), (0.0, 1.83), (-0.175, 1.76), (-0.19, 1.60)], -0.205, m, thick=0.016)
    out = [helm, ridge, face]
    for i in range(8):
        x = -0.105 + i * 0.030
        out.append(plate(f"reaver_slit{i}", [(x - 0.008, 1.605), (x + 0.008, 1.605), (x + 0.008, 1.695), (x - 0.008, 1.695)], -0.222, M["void"], thick=0.008))
    # brass edging: a band under the visor and a rail down each side of the face
    out.append(plate("reaver_visorband", [(-0.176, 1.495), (0.176, 1.495), (0.176, 1.525), (-0.176, 1.525)], -0.212, M["brass"], thick=0.012))
    out.append(plate("reaver_facerim", [(-0.192, 1.49), (0.192, 1.49), (0.208, 1.60), (0.192, 1.775), (0.0, 1.85), (-0.192, 1.775), (-0.208, 1.60)], -0.198, M["brass"], thick=0.014))
    out.append(loft("reaver_helmrim", [((0, 0, 1.462), 0.222, 0.212), ((0, 0, 1.482), 0.218, 0.208)], M["brass"], n=8, phase=ph, sq=0.62))
    return out

@component("reaver", "gorget", "neck")
def reaver_gorget(J, M):
    m = paint("reaver", "gorget", "plate")
    g1 = loft("reaver_gorget1", [((0, 0, 1.60), 0.11, 0.10), ((0, 0, 1.53), 0.21, 0.16)], m, n=10)
    g2 = loft("reaver_gorget2", [((0, 0, 1.54), 0.20, 0.15), ((0, 0, 1.47), 0.235, 0.17)], m, n=10)
    edge = loft("reaver_gorgetedge", [((0, 0, 1.475), 0.238, 0.172), ((0, 0, 1.46), 0.238, 0.172)], M["gold"], n=10)
    return [g1, g2, edge]

def reaver_pauldron(J, M, s_, sx):
    m = paint("reaver", "pauldron_r", "plate")
    sh = J[f"shoulder.{s_}"]["p"]; out = []
    X = lambda v: sx * v
    # three lames stepping down and outward from the collar, each with a pointed
    # outer corner and a brass edge showing under it — the painting's pauldron read
    # from the front, which is the only view these sprites have
    for i, (zt, zb, xo) in enumerate([(1.575, 1.475, 0.46), (1.495, 1.365, 0.515), (1.385, 1.235, 0.545)]):
        pts = [(X(0.235), zt), (X(0.345), zt + 0.022), (X(xo - 0.07), zt - 0.018), (X(xo), zt - 0.07),
               (X(xo - 0.035), zb), (X(0.32), zb + 0.022), (X(0.235), zb + 0.05)]
        y = sh.y - 0.145 - 0.014 * i
        out.append(curved_plate(f"reaver_lametrim{i}.{s_}", [(x, z - 0.024) for x, z in pts], y + 0.014, 0.055, M["brass"], thick=0.02))
        out.append(curved_plate(f"reaver_lame{i}.{s_}", pts, y, 0.055, m, thick=0.028))
    out.append(loft(f"reaver_boss.{s_}", [((X(0.30), sh.y - 0.215, 1.50), 0.055, 0.055), ((X(0.30), sh.y - 0.245, 1.50), 0.049, 0.049), ((X(0.30), sh.y - 0.27, 1.50), 0, 0)], M["gold"], n=10, cap_bottom=True))
    return out
# on the spine, not the arm bone: these plates are shaped for the camera, and an
# arm that swings through a strike would carry them out of position
@component("reaver", "pauldron_l", "spine")
def reaver_pauldron_l(J, M): return reaver_pauldron(J, M, "L", -1)
@component("reaver", "pauldron_r", "spine")
def reaver_pauldron_r(J, M): return reaver_pauldron(J, M, "R", 1)

@component("reaver", "breastplate", "spine")
def reaver_breastplate(J, M):
    m = paint("reaver", "breastplate", "plate")
    plate = loft("reaver_plate", [((0, 0, 1.50), 0.22, 0.155), ((0, 0, 1.40), 0.24, 0.165), ((0, 0, 1.26), 0.225, 0.155), ((0, 0, 1.12), 0.21, 0.15)], m, n=8, phase=math.pi / 8)
    trim = loft("reaver_trim1", [((0, 0, 1.13), 0.215, 0.155), ((0, 0, 1.11), 0.215, 0.155)], M["gold"], n=8, phase=math.pi / 8)
    return [plate, trim, pyramid("reaver_chestgem", (0, -0.175, 1.30), 0.05, 0.06, M["gold"])]

@component("reaver", "cape", "soft")
def reaver_cape(J, M):
    m = paint("reaver", "cape", "cloth")
    cape = loft("reaver_cape", [((0, 0.14, 1.58), 0.26, 0.016), ((0, 0.17, 1.34), 0.31, 0.028), ((0, 0.19, 1.02), 0.35, 0.038), ((0, 0.21, 0.70), 0.39, 0.044), ((0, 0.22, 0.40), 0.42, 0.048), ((0, 0.22, 0.30), 0.41, 0.046)], m, n=12, cap_bottom=True, cap_top=True, fold=0.16, folds=5)
    drape = loft("reaver_drape", [((0, 0.03, 1.60), 0.17, 0.15), ((0, 0.05, 1.51), 0.33, 0.25), ((0, 0.07, 1.40), 0.38, 0.28), ((0, 0.09, 1.30), 0.37, 0.27)], m, n=10, phase=math.pi / 10, fold=0.08, folds=5)
    return [cape, drape]

def reaver_gauntlet(J, M, s_):
    m = paint("reaver", "gauntlet_r", "plate")
    e, w, hnd = J[f"elbow.{s_}"]["p"], J[f"wrist.{s_}"]["p"], J[f"hand.{s_}"]["p"]; L = (w - e).length
    out = [along(f"reaver_gauntlet.{s_}", e, w, [((0, 0, 0.05 * L), 0.08, 0.08), ((0, 0, 0.55 * L), 0.085, 0.085), ((0, 0, 0.98 * L), 0.095, 0.095)], m, n=8),
           along(f"reaver_cuff.{s_}", e, w, [((0, 0, 0.94 * L), 0.10, 0.10), ((0, 0, 1.02 * L), 0.10, 0.10)], M["gold"], n=8)]
    r = 0.064
    out.append(loft(f"reaver_fist.{s_}", [((hnd.x, hnd.y, hnd.z + r * 0.9), r * 0.5, r * 0.5), ((hnd.x, hnd.y - 0.01, hnd.z + r * 0.3), r, r * 0.9), ((hnd.x, hnd.y - 0.01, hnd.z - r * 0.5), r * 0.95, r * 0.85), ((hnd.x, hnd.y, hnd.z - r), 0, 0)], m, n=7, cap_bottom=True))
    for i, dx in enumerate((-0.03, -0.01, 0.01, 0.03)):
        out.append(pyramid(f"reaver_knuckle{i}.{s_}", (hnd.x + dx, hnd.y - 0.06, hnd.z + 0.01), 0.012, 0.02, M["gold"]))
    return out
@component("reaver", "gauntlet_l", "forearm.L")
def reaver_gauntlet_l(J, M): return reaver_gauntlet(J, M, "L")
@component("reaver", "gauntlet_r", "forearm.R")
def reaver_gauntlet_r(J, M): return reaver_gauntlet(J, M, "R")

@component("reaver", "sword", "hand.R")
def reaver_sword(J, M):
    out = [weapon_along("reaver_grip", J, "R", [((0, 0, -0.12), 0.024, 0.024), ((0, 0, 0.18), 0.024, 0.024)], M["wood"])]
    for k in (-0.08, -0.02, 0.04, 0.10):
        out.append(weapon_along(f"reaver_gripring{k}", J, "R", [((0, 0, k), 0.027, 0.027), ((0, 0, k + 0.02), 0.027, 0.027)], paint("reaver", "sword", "leather")))
    out.append(weapon_along("reaver_swordguard", J, "R", [((0, 0, 0.18), 0.13, 0.03), ((0, 0, 0.24), 0.13, 0.03)], M["steel"], cap=True, n=4))
    out.append(weapon_along("reaver_guardtrim", J, "R", [((0, 0, 0.235), 0.132, 0.032), ((0, 0, 0.25), 0.132, 0.032)], M["gold"], cap=True, n=4))
    # 0.98 to the tip, not 1.14: the longer blade left the frame overhead in the
    # wind-up and past the right edge in the follow-through
    out.append(weapon_along("reaver_blade", J, "R", [((0, 0, 0.24), 0.060, 0.015), ((0, 0, 0.72), 0.050, 0.011), ((0, 0, 0.86), 0, 0)], M["steel"], n=4))
    out.append(weapon_along("reaver_pommel", J, "R", [((0, 0, -0.18), 0.042, 0.042), ((0, 0, -0.12), 0.042, 0.042)], M["gold"], cap=True, n=4))
    return out

@component("reaver", "tasset", "soft")
def reaver_tasset(J, M):
    m = paint("reaver", "tasset", "plate")
    out = [loft("reaver_belt", [((0, 0, 1.11), 0.215, 0.155), ((0, 0, 1.05), 0.215, 0.155)], paint("reaver", "sword", "leather"), n=10)]
    for row, (z0, z1, R) in enumerate([(1.06, 0.88, 0.235), (0.90, 0.72, 0.25)]):
        for i in range(8):
            a = 2 * math.pi * (i + 0.5 * row) / 8
            cx, cy = R * math.cos(a), R * 0.72 * math.sin(a)
            pl = box(f"reaver_tasset{row}_{i}", (0, 0, 0), 0.085, 0.012, (z0 - z1) / 2, m)
            ed = box(f"reaver_tedge{row}_{i}", (0, 0, -(z0 - z1) / 2 + 0.008), 0.087, 0.013, 0.008, M["gold"])
            T = Matrix.Translation((cx, cy, (z0 + z1) / 2)) @ Matrix.Rotation(-a + math.pi / 2, 4, "Z")
            pl.data.transform(T); ed.data.transform(T); out += [pl, ed]
    return out

@component("reaver", "greave", "soft")
def reaver_greave(J, M):
    """Plate legs. The painting stops at the waist, so these follow its plate — same
    colour, same gold edge — rather than inventing a different armour."""
    m = paint("reaver", "gauntlet_r", "plate"); out = []
    for s_ in ("L", "R"):
        h, k, a = J[f"hip.{s_}"]["p"], J[f"knee.{s_}"]["p"], J[f"ankle.{s_}"]["p"]
        out.append(along(f"reaver_cuisse.{s_}", h, k, [((0, 0, 0.18 * (k - h).length), 0.125, 0.125), ((0, 0, 0.92 * (k - h).length), 0.105, 0.105)], m, n=6))
        out.append(along(f"reaver_poleyn.{s_}", h, k, [((0, 0, 0.93 * (k - h).length), 0.115, 0.115), ((0, 0, 1.04 * (k - h).length), 0.10, 0.10)], M["brass"], n=6))
        out.append(along(f"reaver_shin.{s_}", k, a, [((0, 0, 0.02 * (a - k).length), 0.10, 0.10), ((0, 0, 0.80 * (a - k).length), 0.088, 0.088)], m, n=6))
    return out

@component("reaver", "boots", "soft")
def reaver_boots(J, M): return [ob for ob, _ in boots("reaver", J, M["boot"], paint("reaver", "gauntlet_r", "plate"), cuff_h=0.06, r=0.088)]

# ---------------- STARSEER ----------------
@component("starseer", "hat", "head")
def starseer_hat(J, M):
    m = paint("starseer", "hat", "cloth")
    brim = loft("star_brim", [((0, 0, 1.83), 0.14, 0.14), ((0, 0.02, 1.755), 0.46, 0.36), ((0, 0.03, 1.545), 0.86, 0.62), ((0, 0.03, 1.575), 0.86, 0.62), ((0, 0.02, 1.785), 0.46, 0.36), ((0, 0, 1.855), 0.14, 0.14)], m, n=14, cap_bottom=False, fold=0.10, folds=5)
    # the frame tops out at cz + ortho / 2 = 2.50: the crown leans over well below it
    crown = loft("star_crown", [((0, 0, 1.79), 0.21, 0.20), ((0.0, 0.0, 1.99), 0.17, 0.16), ((-0.04, 0.01, 2.19), 0.12, 0.115), ((-0.12, 0.03, 2.34), 0.078, 0.074), ((-0.26, 0.05, 2.42), 0.044, 0.042), ((-0.40, 0.06, 2.415), 0.02, 0.02), ((-0.47, 0.06, 2.37), 0, 0)], m, n=9, cap_bottom=True, sq=0.35, fold=0.04, folds=3)
    band = loft("star_band", [((0, 0, 1.815), 0.205, 0.195), ((0, 0, 1.90), 0.192, 0.182)], mat("star_hatband", tone("starseer", (86, 52, 58)), rough=0.8), n=10)
    return [brim, crown, band, pyramid("star_hatgem", (0, -0.196, 1.858), 0.05, 0.06, M["gold"])]

@component("starseer", "cowl", "head")
def starseer_cowl(J, M):
    m = paint("starseer", "cowl", "cloth")
    cowl = loft("star_cowl", [((0, 0.0, 1.46), 0.27, 0.21), ((0, 0.0, 1.58), 0.19, 0.16), ((0, 0.0, 1.70), 0.17, 0.15), ((0, 0.0, 1.80), 0.145, 0.135)], m, n=9, phase=math.pi / 2, sq=0.4, fold=0.05, folds=4)
    return [cowl] + face_hole("star", 1.675, 0.125, 0.15, m, M["void"], y=-0.172)

@component("starseer", "mantle", "spine")
def starseer_mantle(J, M):
    m = paint("starseer", "mantle", "cloth")
    out = yoke("star_mantle", m, M["brass"], [(1.56, 0.24, 0.17, 0.45, 0.285, 1.29, 0.08, 0.16, True), (1.49, 0.20, 0.15, 0.355, 0.235, 1.14, 0.17, 0.10, True)], n=12, sq=0.80)
    out += [pyramid("star_mstud_l", (-0.455, -0.09, 1.20), 0.024, 0.036, M["gold"], toward=(-0.4, -1, 0)), pyramid("star_mstud_r", (0.455, -0.09, 1.20), 0.024, 0.036, M["gold"], toward=(0.4, -1, 0)),
            pyramid("star_throat", (0, -0.20, 1.33), 0.045, 0.055, M["gold"])]
    return out

@component("starseer", "pendant", "spine")
def starseer_pendant(J, M):
    chain = loft("star_chain", [((0, -0.20, 1.36), 0.005, 0.005), ((0, -0.205, 1.12), 0.005, 0.005)], M["gold"], n=4)
    return [pyramid("star_pend_top", (0, -0.20, 1.37), 0.022, 0.03, M["gold"]), chain, pyramid("star_pend_mid", (0, -0.21, 1.24), 0.018, 0.025, M["gold"]),
            pyramid("star_pendant", (0, -0.215, 1.09), 0.035, 0.06, M["gold"], toward=(0, -0.3, -1))]

@component("starseer", "sash", "pelvis")
def starseer_sash(J, M):
    m = paint("starseer", "sash", "leather")
    return [loft("star_sash", [((0, 0, 1.12), 0.208, 0.153), ((0, 0, 1.06), 0.214, 0.159)], m, n=10),
            loft("star_sash2", [((0, 0, 1.05), 0.216, 0.161), ((0, 0, 0.99), 0.220, 0.164)], m, n=10),
            pyramid("star_sashgem", (0, -0.175, 1.055), 0.075, 0.075, M["gold"])]

@component("starseer", "robe", "soft")
def starseer_robe(J, M):
    m = paint("starseer", "robe", "cloth")
    return [loft("star_robe", [((0, 0, 1.08), 0.20, 0.145), ((0, 0, 0.80), 0.24, 0.17), ((0, 0, 0.45), 0.28, 0.20), ((0, 0, 0.10), 0.31, 0.22)], m, n=14, cap_bottom=True, fold=0.11, folds=7)]

def starseer_sleeve(J, M, s_):
    m = paint("starseer", "sleeve_r", "cloth")
    e, w = J[f"elbow.{s_}"]["p"], J[f"wrist.{s_}"]["p"]; L = (w - e).length
    return [along(f"star_sleeve.{s_}", e, w, [((0, 0, -0.05 * L), 0.082, 0.082), ((0, 0, 0.9 * L), 0.122, 0.122), ((0, 0, 1.12 * L), 0.118, 0.118)], m, n=8, fold=0.05, folds=4)]
@component("starseer", "sleeve_l", "forearm.L")
def starseer_sleeve_l(J, M): return starseer_sleeve(J, M, "L")
@component("starseer", "sleeve_r", "forearm.R")
def starseer_sleeve_r(J, M): return starseer_sleeve(J, M, "R")

@component("starseer", "fist_r", "hand.L")
def starseer_fists(J, M): return [ob for ob, _ in fists("star", J, paint("starseer", "cowl", "leather"))]

@component("starseer", "staff", "hand.R")
def starseer_staff(J, M):
    hnd = J["hand.R"]["p"]; cx, cy = hnd.x + 0.02, hnd.y - 0.03
    out = [loft("star_staff", [((cx, cy, hnd.z - 0.40), 0.022, 0.022), ((cx, cy, hnd.z + 0.95), 0.02, 0.02)], M["wood"], n=6, cap_bottom=True, cap_top=True)]
    for dz in (0.30, 0.62, 0.92):
        out.append(loft(f"star_ring{dz}", [((cx, cy, hnd.z + dz), 0.03, 0.03), ((cx, cy, hnd.z + dz + 0.025), 0.03, 0.03)], M["gold"], n=8))
    out.append(sphere("star_knob", (cx, cy, hnd.z + 0.99), 0.035, M["gold"], n=6, k=3))
    out.append(star("star_star", (cx, cy, hnd.z + 1.13), 0.15, 0.06, 0.015, M["gold"], points=8))
    out.append(sphere("star_core", (cx, cy - 0.03, hnd.z + 1.13), 0.03, M["glow"], n=6, k=3))
    return out

@component("starseer", "boots", "soft")
def starseer_boots(J, M): return [ob for ob, _ in boots("star", J, M["boot"])]

# ---------------- HERALD ----------------
@component("herald", "halo", "head")
def herald_halo(J, M):
    out = [torus("herald_halo", (0, 0.17, 1.88), 0.285, 0.010, M["brass"], n=20, k=5)]
    for i in range(4):
        a = math.pi / 2 * i
        out.append(pyramid(f"herald_spike{i}", (0.285 * math.cos(a), 0.17, 1.88 + 0.285 * math.sin(a)), 0.022, 0.045, M["brass"], toward=(math.cos(a), 0, math.sin(a))))
    return out

@component("herald", "hood", "head")
def herald_hood(J, M):
    m = paint("herald", "hood", "cloth")
    hood = loft("herald_hood", [((0, 0.04, 1.42), 0.31, 0.25), ((0, 0.035, 1.56), 0.25, 0.21), ((0, 0.03, 1.70), 0.22, 0.19), ((0, 0.02, 1.84), 0.185, 0.17), ((0, 0.0, 1.96), 0.13, 0.12), ((0, -0.015, 2.05), 0.055, 0.055), ((0, -0.025, 2.08), 0, 0)], m, n=9, phase=math.pi / 2, sq=0.45, fold=0.05, folds=3)
    return [hood] + face_hole("herald", 1.715, 0.128, 0.16, m, M["void"], y=-0.182)

@component("herald", "mantle", "spine")
def herald_mantle(J, M):
    m = paint("herald", "mantle", "cloth")
    out = yoke("herald_mantle", m, M["brass"], [(1.57, 0.24, 0.17, 0.44, 0.275, 1.30, 0.08, 0.03, True), (1.51, 0.21, 0.15, 0.365, 0.235, 1.18, 0.15, 0.03, True), (1.45, 0.18, 0.13, 0.295, 0.195, 1.06, 0.19, 0.02, True)], n=12, sq=0.86)
    out += [pyramid("herald_mstud_l", (-0.455, -0.09, 1.26), 0.026, 0.04, M["gold"], toward=(-0.4, -1, 0)), pyramid("herald_mstud_r", (0.455, -0.09, 1.26), 0.026, 0.04, M["gold"], toward=(0.4, -1, 0))]
    return out

@component("herald", "gem", "spine")
def herald_gem(J, M):
    return [pyramid("herald_gem", (0, -0.215, 1.40), 0.055, 0.05, M["gold"], toward=(0, -0.4, -1))]

@component("herald", "beads", "spine")
def herald_beads(J, M):
    m = paint("herald", "beads", "leather"); out = []
    chain = [(-0.12, 1.44), (-0.13, 1.36), (-0.13, 1.28), (-0.12, 1.20), (-0.10, 1.12), (-0.07, 1.05), (-0.03, 0.99), (0.03, 0.99), (0.07, 1.05), (0.10, 1.12), (0.12, 1.20), (0.13, 1.28), (0.13, 1.36), (0.12, 1.44)]
    for i, (x, z) in enumerate(chain):
        if i % 4 == 2: out.append(pyramid(f"herald_orn{i}", (x * 1.35, -0.215, z), 0.030, 0.042, M["gold"]))
        else: out.append(sphere(f"herald_bead{i}", (x * 1.35, -0.205, z), 0.042, m, n=8, k=4))
    out.append(pyramid("herald_pendant", (0.0, -0.22, 0.92), 0.035, 0.06, M["gold"], toward=(0, -0.3, -1)))
    return out

def herald_sleeve(J, M, s_):
    m = paint("herald", "sleeve_l", "cloth")
    e, w = J[f"elbow.{s_}"]["p"], J[f"wrist.{s_}"]["p"]; L = (w - e).length
    return [along(f"herald_sleeve.{s_}", e, w, [((0, 0, -0.05 * L), 0.086, 0.086), ((0, 0, 0.9 * L), 0.142, 0.142), ((0, 0, 1.14 * L), 0.138, 0.138)], m, n=8, fold=0.05, folds=4),
            along(f"herald_cuff.{s_}", e, w, [((0, 0, 1.08 * L), 0.146, 0.146), ((0, 0, 1.16 * L), 0.144, 0.144)], M["brass"], n=8),
            along(f"herald_stripe.{s_}", e, w, [((0, -0.08, 0.05 * L), 0.012, 0.012), ((0, -0.135, 0.98 * L), 0.012, 0.012)], M["gold"], n=4)]
@component("herald", "sleeve_l", "forearm.L")
def herald_sleeve_l(J, M): return herald_sleeve(J, M, "L")
@component("herald", "sleeve_r", "forearm.R")
def herald_sleeve_r(J, M): return herald_sleeve(J, M, "R")

@component("herald", "hands", "hand.L")
def herald_hands(J, M): return [ob for ob, _ in fists("herald", J, M["skin"])]

@component("herald", "robe", "soft")
def herald_robe(J, M):
    m = paint("herald", "robe", "cloth")
    robe = loft("herald_robe", [((0, 0, 1.10), 0.21, 0.15), ((0, 0, 0.80), 0.25, 0.18), ((0, 0, 0.45), 0.29, 0.21), ((0, 0, 0.08), 0.33, 0.24)], m, n=14, cap_bottom=True, fold=0.11, folds=7)
    # the painting's robe carries a stole: two broad bands off the shoulders that
    # meet at the waist and run to the hem
    out = [robe]
    for sx in (-1, 1):
        out.append(sheet(f"herald_stole{sx}", [(sx * 0.145, -0.135, 1.20), (sx * 0.10, -0.168, 1.00), (sx * 0.045, -0.196, 0.80)], 0.055, 0.05, M["brass"], thick=0.008))
    out.append(sheet("herald_stolefoot", [(0, -0.196, 0.82), (0, -0.222, 0.46), (0, -0.246, 0.10)], 0.058, 0.062, M["brass"], thick=0.008))
    return out

@component("herald", "boots", "soft")
def herald_boots(J, M): return [ob for ob, _ in boots("herald", J, M["boot"])]

def build_class(cls, J, arm, M):
    """Build every registered component, attach it, return {name: [objects]}."""
    built = {}
    for name, bone, fn in COMPONENTS[cls]:
        obs = fn(J, M)
        for ob in obs:
            if bone == "soft": attach_soft(ob, arm, J)
            else: parent_to_bone(ob, arm, bone)
        built[name] = obs
    return built

PROPS = {"rogue": dict(shoulder_w=0.29),
         "reaver": dict(shoulder_w=0.33, trap_r=(0.25, 0.15), chest_r=(0.25, 0.165), lchest_r=(0.21, 0.145), belly_r=(0.20, 0.145), pelvis_r=(0.20, 0.145), delt_r=0.115, bicep_r=0.085, elbow_r=0.074, fore_r=0.078, thigh_r=0.115, calf_r=0.09),
         "starseer": dict(shoulder_w=0.26, chest_r=(0.19, 0.13)),
         "herald": dict(shoulder_w=0.28, chest_r=(0.21, 0.135), belly_r=(0.18, 0.13))}
REGIONS = {
    "rogue": lambda M: dict(tunic=paint("rogue", "tunic", "cloth"), cloth=paint("rogue", "cowl", "cloth"), head=paint("rogue", "hood", "leather"), sleeve=paint("rogue", "tunic", "cloth"), bracer=paint("rogue", "bracer_r", "leather"), skin=M["skin"], legs=paint("rogue", "skirt", "cloth"), boot=M["boot"]),
    "reaver": lambda M: dict(tunic=paint("reaver", "gorget", "plate"), cloth=paint("reaver", "gorget", "plate"), head=paint("reaver", "helm", "plate"), sleeve=paint("reaver", "pauldron_r", "plate"), bracer=paint("reaver", "gauntlet_r", "plate"), skin=paint("reaver", "gauntlet_r", "plate"), legs=paint("reaver", "gauntlet_l", "plate"), boot=M["boot"]),
    "starseer": lambda M: dict(tunic=paint("starseer", "robe", "cloth"), cloth=paint("starseer", "cowl", "cloth"), head=paint("starseer", "cowl", "cloth"), sleeve=paint("starseer", "mantle", "cloth"), bracer=paint("starseer", "sleeve_r", "cloth"), skin=M["skin"], legs=paint("starseer", "robe", "cloth"), boot=M["boot"]),
    "herald": lambda M: dict(tunic=paint("herald", "robe", "cloth"), cloth=paint("herald", "hood", "cloth"), head=paint("herald", "hood", "cloth"), sleeve=paint("herald", "robe", "cloth"), bracer=paint("herald", "sleeve_l", "cloth"), skin=M["skin"], legs=paint("herald", "robe", "cloth"), boot=M["boot"]),
}
CLASSES = ["rogue", "reaver", "starseer", "herald"]

# ---- posing ---------------------------------------------------------------------------
def aim(arm, bone, target):
    """Rotate a pose bone so its world direction becomes `target` (minimal rotation, parent-relative)."""
    bpy.context.view_layer.update()
    pb = arm.pose.bones[bone]
    Mw = (arm.matrix_world @ pb.matrix).to_3x3()
    cur = (Mw @ Vector((0, 1, 0))).normalized()
    t = Vector(target).normalized()
    rot = cur.rotation_difference(t).to_matrix()
    q_local = (Mw.inverted() @ rot @ Mw).to_quaternion()
    pb.rotation_quaternion = pb.rotation_quaternion @ q_local

ORDER = [n for n, _, _, _ in BONES]   # parents before children
def apply_pose(arm, pose):
    for pb in arm.pose.bones: pb.rotation_quaternion = Quaternion((1, 0, 0, 0)); pb.location = (0, 0, 0)
    arm.location = (pose.get("dx", 0.0), 0.0, pose.get("dz", 0.0))
    arm.rotation_euler = (0, math.radians(pose.get("lie", 0.0)), math.radians(pose.get("turn", 0.0)))
    for bone in ORDER:
        if bone in pose.get("aim", {}): aim(arm, bone, pose["aim"][bone])
    bpy.context.view_layer.update()

# rest directions, for reference: spine/neck/head up (0,0,1); arms (±0.2,0.1,-1); legs (0,0,-1); feet (0,-1,-0.4)
POSES = {
    "idle":    dict(turn=18, aim={"upper_arm.L": (-0.3, -0.1, -1), "upper_arm.R": (0.3, -0.1, -1), "forearm.L": (-0.15, -0.45, -1), "forearm.R": (0.15, -0.45, -1)}),
    "guard":   dict(turn=25, dz=-0.06, aim={"thigh.L": (-0.35, 0.15, -1), "shin.L": (0.1, -0.15, -1), "thigh.R": (0.5, -0.2, -0.9), "shin.R": (-0.1, 0.1, -1),
                    "spine": (0.12, -0.15, 1), "neck": (0.05, -0.1, 1),
                    "upper_arm.L": (-0.35, -0.5, -0.8), "forearm.L": (0.7, -0.7, 0.0), "upper_arm.R": (0.45, -0.5, -0.75), "forearm.R": (-0.55, -0.75, 0.05)}),
    "attack1": dict(turn=30, dx=0.12, aim={"thigh.R": (0.85, -0.2, -0.65), "shin.R": (0.25, -0.05, -1), "thigh.L": (-0.55, 0.1, -1), "shin.L": (-0.35, 0.15, -1),
                    "spine": (0.35, -0.12, 1), "neck": (0.15, -0.1, 1), "head": (0.1, -0.15, 1),
                    "upper_arm.R": (1, -0.35, -0.05), "forearm.R": (1, -0.25, 0.05), "hand.R": (1, -0.2, 0),
                    "upper_arm.L": (-0.6, 0.25, -0.75), "forearm.L": (-0.2, -0.6, -0.75)}),
    "attack2": dict(turn=22, dx=0.06, dz=-0.02, aim={"thigh.R": (0.6, -0.2, -0.85), "shin.R": (0.1, 0, -1), "thigh.L": (-0.45, 0.15, -1), "shin.L": (-0.2, 0.1, -1),
                    "spine": (0.2, -0.2, 1), "neck": (0.1, -0.15, 1),
                    "upper_arm.L": (0.35, -0.9, 0.35), "forearm.L": (1, -0.6, -0.2), "hand.L": (1, -0.5, -0.3),
                    "upper_arm.R": (0.5, 0.2, -0.8), "forearm.R": (0.3, -0.6, -0.7)}),
    "attack3": dict(turn=32, dx=0.12, dz=-0.1, aim={"thigh.R": (1, -0.25, -0.5), "shin.R": (0.35, -0.1, -1), "thigh.L": (-0.75, 0.15, -0.7), "shin.L": (-0.7, 0.15, -0.7),
                    "spine": (0.55, -0.15, 1), "neck": (0.3, -0.1, 1), "head": (0.2, -0.2, 1),
                    "upper_arm.R": (1, -0.3, 0.05), "forearm.R": (1, -0.25, 0.12), "hand.R": (1, -0.2, 0.1),
                    "upper_arm.L": (0.9, -0.45, -0.3), "forearm.L": (1, -0.35, 0.1), "hand.L": (1, -0.3, 0.1)}),
    "hit":     dict(turn=15, dx=-0.08, aim={"thigh.L": (-0.5, 0.2, -1), "shin.L": (-0.2, 0.1, -1), "thigh.R": (0.3, 0.1, -1), "shin.R": (0.2, -0.3, -1),
                    "spine": (-0.35, 0.25, 1), "neck": (-0.4, 0.2, 1), "head": (-0.45, 0.1, 1),
                    "upper_arm.L": (-0.7, -0.4, -0.5), "forearm.L": (-0.2, -0.8, 0.5), "upper_arm.R": (0.6, -0.5, -0.5), "forearm.R": (0.1, -0.85, 0.5)}),
    "kneel":   dict(turn=20, dz=-0.44, aim={"thigh.L": (-0.2, 0.05, -1), "shin.L": (-0.05, 1, 0.0), "foot.L": (0, 1, 0.3),
                    "thigh.R": (0.45, -0.7, -0.55), "shin.R": (0.05, 0.05, -1), "foot.R": (0.1, -1, -0.2),
                    "spine": (0.1, -0.35, 1), "neck": (0.1, -0.4, 1), "head": (0.1, -0.5, 1),
                    "upper_arm.L": (-0.3, -0.5, -0.85), "forearm.L": (0.1, -0.5, -1), "upper_arm.R": (0.55, -0.55, -0.65), "forearm.R": (0.2, -0.6, -0.8)}),
    "down":    dict(turn=10, lie=80, dx=-1.02, dz=-0.04, aim={"head": (0.95, -0.3, -0.1), "neck": (1, -0.2, 0),
                    "upper_arm.L": (-0.1, -0.3, -0.95), "forearm.L": (-0.5, -0.4, -0.7), "upper_arm.R": (0.2, -0.3, 0.95), "forearm.R": (0.6, -0.3, 0.7),
                    "thigh.L": (-1, -0.1, -0.2), "shin.L": (-1, -0.1, -0.3), "thigh.R": (-1, -0.2, 0.3), "shin.R": (-1, -0.1, -0.1)}),
}
STRIP = ["idle", "guard", "attack1", "attack2", "attack3", "hit", "kneel", "down"]

# Per-class arm work: the rogue's table is the base; these replace aims by bone.
CLASS_AIMS = {
    "reaver": {  # sword in the right hand; idle = both hands on the pommel in front
        "idle": {"upper_arm.L": (-0.15, -0.55, -0.85), "forearm.L": (0.55, -0.5, -0.65), "upper_arm.R": (0.15, -0.55, -0.85), "forearm.R": (-0.55, -0.5, -0.65), "hand.R": (-0.2, -0.2, -1)},
        "guard": {"upper_arm.L": (-0.35, -0.6, -0.7), "forearm.L": (0.6, -0.6, 0.2), "upper_arm.R": (0.55, -0.4, -0.7), "forearm.R": (-0.3, -0.5, 0.8), "hand.R": (-0.3, -0.4, 0.85)},
        "attack1": {"upper_arm.R": (0.9, -0.4, 0.2), "forearm.R": (1, -0.3, 0.1), "hand.R": (1, -0.25, 0.05), "upper_arm.L": (-0.7, 0.1, -0.7), "forearm.L": (-0.3, -0.6, -0.6)},
        "attack2": {"upper_arm.R": (0.4, -0.7, 0.6), "forearm.R": (0.2, -0.5, 1), "hand.R": (0.1, -0.4, 1), "upper_arm.L": (-0.5, -0.4, -0.7), "forearm.L": (0.3, -0.7, -0.3)},
        "attack3": {"upper_arm.R": (1, -0.35, -0.15), "forearm.R": (1, -0.3, -0.05), "hand.R": (1, -0.25, -0.05), "upper_arm.L": (0.2, -0.7, -0.6), "forearm.L": (0.9, -0.5, -0.1)},
    },
    "starseer": {  # staff in the right hand, held upright; attacks thrust the star forward
        "idle": {"upper_arm.R": (0.35, -0.35, -0.85), "forearm.R": (0.0, -0.6, -0.8), "hand.R": (0, -0.5, -0.85), "upper_arm.L": (-0.3, -0.2, -0.95), "forearm.L": (0.3, -0.7, -0.6)},
        "guard": {"upper_arm.R": (0.5, -0.5, -0.7), "forearm.R": (-0.2, -0.7, -0.6), "hand.R": (-0.1, -0.6, -0.8), "upper_arm.L": (-0.4, -0.6, -0.65), "forearm.L": (0.4, -0.8, -0.3)},
        "attack1": {"upper_arm.R": (0.8, -0.5, -0.3), "forearm.R": (0.9, -0.4, 0.2), "hand.R": (0.9, -0.3, 0.3), "upper_arm.L": (-0.6, 0.1, -0.8), "forearm.L": (-0.2, -0.6, -0.75)},
        "attack2": {"upper_arm.R": (0.7, -0.6, 0.1), "forearm.R": (0.95, -0.35, -0.1), "hand.R": (0.95, -0.3, -0.1), "upper_arm.L": (-0.5, -0.4, -0.75), "forearm.L": (0.3, -0.8, -0.4)},
        "attack3": {"upper_arm.R": (1, -0.35, 0.1), "forearm.R": (1, -0.25, 0.3), "hand.R": (1, -0.2, 0.35), "upper_arm.L": (0.3, -0.7, -0.6), "forearm.L": (0.9, -0.5, 0.0)},
    },
    "herald": {  # hands clasped; attacks open the arms and raise them
        "idle": {"upper_arm.L": (-0.15, -0.45, -0.9), "forearm.L": (0.6, -0.5, -0.6), "upper_arm.R": (0.15, -0.45, -0.9), "forearm.R": (-0.6, -0.5, -0.6)},
        "guard": {"upper_arm.L": (-0.4, -0.6, -0.7), "forearm.L": (0.3, -0.8, 0.3), "upper_arm.R": (0.4, -0.6, -0.7), "forearm.R": (-0.3, -0.8, 0.3)},
        "attack1": {"upper_arm.R": (0.9, -0.4, 0.1), "forearm.R": (1, -0.3, 0.2), "upper_arm.L": (-0.6, -0.3, -0.7), "forearm.L": (-0.2, -0.8, -0.5)},
        "attack2": {"upper_arm.L": (-0.6, -0.5, 0.6), "forearm.L": (-0.3, -0.5, 1), "upper_arm.R": (0.6, -0.5, 0.6), "forearm.R": (0.3, -0.5, 1)},
        "attack3": {"upper_arm.R": (1, -0.35, 0.2), "forearm.R": (1, -0.3, 0.35), "upper_arm.L": (0.7, -0.6, 0.0), "forearm.L": (1, -0.4, 0.2)},
    },
}
def pose_for(cls, pose_id):
    base = POSES[pose_id]
    over = CLASS_AIMS.get(cls, {}).get(pose_id)
    if not over: return base
    p = dict(base); p["aim"] = dict(base.get("aim", {})); p["aim"].update(over)
    return p

# ---- render ----------------------------------------------------------------------------
manifest = []
parts_manifest = []
count = 0
def teardown(objs):
    for ob in objs: bpy.data.objects.remove(ob, do_unlink=True)
    for me in list(bpy.data.meshes):
        if me.users == 0: bpy.data.meshes.remove(me)
    for a_ in list(bpy.data.armatures):
        if a_.users == 0: bpy.data.armatures.remove(a_)

SLOT_ORDER = ["head", "shoulders", "chest", "belt", "coat", "arms", "legs", "feet", "weapon"]
def slot_of(cls, name):
    return INVENTORY.get(cls, {}).get(name, {}).get("slot", {"boots": "feet", "greave": "legs"}.get(name, "other"))

for cls in CLASSES:
    if ONLY and cls not in ONLY: continue
    M = shared_materials()
    if PARTS_MODE:
        body, J = build_body(cls, PROPS.get(cls, {}), REGIONS[cls](M))
        arm = build_armature(cls, J)
        weight_to_armature(body, arm, J)
        built = build_class(cls, J, arm, M)
        everything = [body] + [ob for obs in built.values() for ob in obs]
        for k, ob in enumerate(everything): facet_variation(ob, seed=k)
        apply_pose(arm, pose_for(cls, "idle"))
        groups = {}
        for name, obs in built.items():
            groups.setdefault(slot_of(cls, name), []).extend(obs)
        # the legs slot is the body below the belt; where a floor-length robe covers
        # them, show the robe too — bare legs are not what that slot looks like
        groups.setdefault("legs", []).append(body)
        for covering in ("robe", "trousers"):
            if covering in built: groups["legs"].extend(built[covering])
        if "robe" in built and "chest" in groups: groups["chest"].extend(built["robe"])
        for slot in SLOT_ORDER:
            obs = groups.get(slot)
            if not obs: continue
            for ob in everything: ob.hide_render = ob not in obs
            fname = f"{cls}_slot_{slot}.png"
            scene.render.filepath = os.path.join(OUT, fname)
            bpy.ops.render.render(write_still=True)
            parts_manifest.append({"class": cls, "slot": slot, "file": fname, "components": [n for n, _, _ in COMPONENTS[cls] if slot_of(cls, n) == slot]})
        for ob in everything: ob.hide_render = False
        teardown([arm] + everything)
        continue
    for pose_id in STRIP:
        if ONLY_POSES and pose_id not in ONLY_POSES: continue
        body, J = build_body(cls, PROPS.get(cls, {}), REGIONS[cls](M))
        arm = build_armature(cls, J)
        weight_to_armature(body, arm, J)
        built = build_class(cls, J, arm, M)
        pieces = [ob for obs in built.values() for ob in obs]
        for k, ob in enumerate([body] + pieces): facet_variation(ob, seed=k)
        apply_pose(arm, pose_for(cls, pose_id))
        name = f"{cls}_{pose_id}.png"
        scene.render.filepath = os.path.join(OUT, name)
        bpy.ops.render.render(write_still=True)
        bpy.context.view_layer.update()
        pelvis = arm.matrix_world @ arm.pose.bones["pelvis"].head
        px = lambda x, z: [round((x - (CANVAS["cx"] - CANVAS["ortho"] * CANVAS["w"] / CANVAS["h"] / 2)) * CANVAS["h"] / CANVAS["ortho"], 1),
                           round((CANVAS["cz"] + CANVAS["ortho"] / 2 - z) * CANVAS["h"] / CANVAS["ortho"], 1)]
        manifest.append({"class": cls, "pose": pose_id, "file": name, "root": px(pelvis.x, pelvis.z), "ground": px(0, 0)[1]})
        count += 1
        teardown([body, arm] + pieces)
if PARTS_MODE:
    with open(os.path.join(OUT, "lowpoly-parts.manifest.json"), "w", encoding="utf-8", newline="\n") as fh:
        json.dump({"schema": "ashenspire/lowpoly-parts/v1", "slots": SLOT_ORDER, "parts": parts_manifest}, fh, indent=2); fh.write("\n")
    print(f"PARTS OK: {len(parts_manifest)} slot renders -> {OUT}")
    raise SystemExit(0)
with open(os.path.join(OUT, "lowpoly-renders.manifest.json"), "w", encoding="utf-8", newline="\n") as fh:
    json.dump({"schema": "ashenspire/lowpoly-renders/v1", "canvas": CANVAS, "strip": STRIP, "renders": manifest}, fh, indent=2); fh.write("\n")
print(f"LOWPOLY OK: {len(manifest)} renders -> {OUT}")
