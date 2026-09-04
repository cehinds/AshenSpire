# tools/lowpoly-blender.py — low-poly 3D class figures, rigged and posed.
#
#   blender --background --factory-startup --python tools/lowpoly-blender.py -- OUT_DIR [class,class] [pose,pose]
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
    raise SystemExit("usage: -- OUT_DIR [class,class] [pose,pose]")
OUT = argv[0]
ONLY = argv[1].split(",") if len(argv) > 1 and argv[1] else None
ONLY_POSES = argv[2].split(",") if len(argv) > 2 and argv[2] else None
os.makedirs(OUT, exist_ok=True)

# ---- scene ---------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = 32
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "Standard"
scene.render.resolution_x, scene.render.resolution_y = 720, 900
cam_data = bpy.data.cameras.new("cam"); cam_data.type = "ORTHO"
cam_data.sensor_fit = "VERTICAL"; cam_data.ortho_scale = 2.5
cam = bpy.data.objects.new("cam", cam_data); scene.collection.objects.link(cam)
cam.location = (0.05, -12.0, 0.98); cam.rotation_euler = (math.radians(90), 0, 0)
scene.camera = cam
CANVAS = dict(ortho=2.5, cx=0.05, cz=0.98, w=720, h=900)   # world→pixel: see manifest

def light(name, kind, loc, energy, color=(1, 1, 1), rot=None, size=None):
    d = bpy.data.lights.new(name, kind); d.energy = energy; d.color = color
    if size and kind == "AREA": d.size = size
    o = bpy.data.objects.new(name, d); scene.collection.objects.link(o)
    o.location = loc
    if rot: o.rotation_euler = rot
    return o
# key from upper front-left, cool fill from the right, warm rim from behind
light("key", "SUN", (0, 0, 5), 3.8, (1.0, 0.95, 0.88), rot=(math.radians(52), math.radians(-28), math.radians(-22)))
light("fill", "SUN", (0, 0, 5), 0.7, (0.75, 0.85, 1.0), rot=(math.radians(70), math.radians(35), math.radians(30)))
light("rim", "SUN", (0, 0, 5), 2.0, (1.0, 0.85, 0.6), rot=(math.radians(-60), 0, math.radians(180)))
scene.eevee.use_soft_shadows = True
scene.eevee.use_gtao = True; scene.eevee.gtao_distance = 0.35; scene.eevee.gtao_factor = 1.0

# ---- materials -----------------------------------------------------------------------
def srgb(r, g, b):
    def c(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (c(r), c(g), c(b), 1.0)

MATS = {}
def mat(name, rgb, rough=0.85, metal=0.0, glow=0.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = srgb(*rgb)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
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

def loft(name, rings, m, cap_bottom=False, cap_top=False, n=8, phase=0.0, fold=0.0, folds=5):
    """rings: list of (center, rx, ry). Faces between consecutive rings; a ring with rx=0 is a tip.
    fold > 0 pleats the rings (deeper toward the last ring), for robes, skirts, hoods and capes."""
    verts, faces = [], []
    idx = []
    for ri, (c, rx, ry) in enumerate(rings):
        if rx <= 1e-6 and ry <= 1e-6:
            idx.append([len(verts)]); verts.append(tuple(c))
        else:
            idx.append(list(range(len(verts), len(verts) + n)))
            depth = fold * (0.35 + 0.65 * ri / max(1, len(rings) - 1)) if fold else 0.0
            verts += ring_folds(c, rx, ry, n, phase, depth, folds) if fold else ring(c, rx, ry, n, phase)
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

def box(name, c, sx, sy, sz, m):
    x, y, z = c
    v = [(x - sx, y - sy, z - sz), (x + sx, y - sy, z - sz), (x + sx, y + sy, z - sz), (x - sx, y + sy, z - sz),
         (x - sx, y - sy, z + sz), (x + sx, y - sy, z + sz), (x + sx, y + sy, z + sz), (x - sx, y + sy, z + sz)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return new_obj(name, v, f, m)

def sphere(name, c, r, m, n=8, k=5):
    rings = [((c[0], c[1], c[2] - r), 0, 0)]
    for i in range(1, k):
        a = math.pi * i / k
        rings.append(((c[0], c[1], c[2] - r * math.cos(a)), r * math.sin(a), r * math.sin(a)))
    rings.append(((c[0], c[1], c[2] + r), 0, 0))
    return loft(name, rings, m, n=n)

def torus(name, c, R, r, m, n=14, k=6):
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
            for f in (0.86, 0.94, 1.0, 1.08):
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
    d = dict(shoulder_w=0.25, hip_w=0.11, head_r=0.11, trap_r=(0.19, 0.12), chest_r=(0.20, 0.13), lchest_r=(0.17, 0.12),
             belly_r=(0.15, 0.12), pelvis_r=(0.17, 0.13), delt_r=0.085, bicep_r=0.065, elbow_r=0.055, fore_r=0.058, wrist_r=0.045,
             hand_r=0.05, hip_r=0.10, thigh_r=0.095, knee_r=0.07, calf_r=0.075, ankle_r=0.055, height=1.9)
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
    sub = ob.modifiers.new("sub", "SUBSURF"); sub.levels = 1; sub.render_levels = 1
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

def studs(prefix, m, points, r=0.018):
    return [(sphere(f"{prefix}_stud{i}", p_, r, m, n=4, k=2), bone) for i, (p_, bone) in enumerate(points)]

def build_rogue(J, arm, M):
    parts = []
    # hood: deep cowl folds at the neck, peaked crown, drapes back
    hood = loft("rogue_hood", [((0, 0.04, 1.44), 0.28, 0.22), ((0, 0.03, 1.52), 0.24, 0.19), ((0, 0.03, 1.60), 0.20, 0.17), ((0, 0.03, 1.68), 0.175, 0.16),
                               ((0, 0.02, 1.78), 0.165, 0.15), ((0, 0.0, 1.86), 0.13, 0.12), ((0, -0.02, 1.92), 0.06, 0.06), ((0, -0.04, 1.94), 0, 0)],
                M["hood"], n=10, fold=0.05, folds=4)
    parts.append((hood, "head"))
    face = loft("rogue_face", [((0, -0.105, 1.60), 0.10, 0.02), ((0, -0.105, 1.76), 0.095, 0.02)], M["void"], cap_bottom=True, cap_top=True, n=8)
    parts.append((face, "head"))
    mask = loft("rogue_mask", [((0, -0.115, 1.60), 0.085, 0.03), ((0, -0.115, 1.66), 0.085, 0.03)], M["hood"], cap_bottom=True, cap_top=True, n=8)
    parts.append((mask, "head"))
    # mantle in two pointed tiers, gold studs at the points
    parts += tiers("rogue_mantle", 1.50, [(1.53, 0.16, 0.13, 0.38, 0.24, 1.28), (1.51, 0.15, 0.12, 0.32, 0.21, 1.35), (1.50, 0.14, 0.11, 0.25, 0.17, 1.42)], M["hood"], n=8, phase=math.pi / 8)
    parts += studs("rogue_mantle", M["gold"], [((0.33, -0.13, 1.31), "spine"), ((-0.33, -0.13, 1.31), "spine"), ((0.0, -0.225, 1.31), "spine"), ((0.0, -0.20, 1.45), "spine")], r=0.02)
    for s_, sx in (("L", -1), ("R", 1)):   # leather shoulder plates over the mantle points
        sh = J[f"shoulder.{s_}"]["p"]
        plate = loft(f"rogue_shoulder.{s_}", [((sh.x + sx * 0.02, sh.y, sh.z + 0.06), 0.0, 0.0), ((sh.x + sx * 0.04, sh.y, sh.z + 0.02), 0.11, 0.10), ((sh.x + sx * 0.06, sh.y, sh.z - 0.08), 0.12, 0.10)], M["leather"], n=7)
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
    for sign in (1, -1):
        strap = box(f"rogue_strap{sign}", (0, 0, 0), 0.028, 0.012, 0.19, M["leather"])
        strap.data.transform(Matrix.Translation((0.0, -0.145, 1.30)) @ Matrix.Rotation(math.radians(38 * sign), 4, "Y")); parts.append((strap, "spine"))
    parts += studs("rogue_strap", M["gold"], [((0.0, -0.16, 1.30), "spine")], r=0.022)
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

def weapon_along(name_prefix, J, s, rings, m, cap=True):
    """A held thing whose axis continues the forearm past the fist."""
    w, hnd = J[f"wrist.{s}"]["p"], J[f"hand.{s}"]["p"]
    fd = (hnd - w).normalized()
    ob = loft(name_prefix, rings, m, n=6, cap_bottom=cap)
    ob.matrix_world = Matrix.Translation(hnd) @ fd.to_track_quat("Z", "Y").to_matrix().to_4x4()
    return ob

def build_reaver(J, arm, M):
    parts = []
    helm = loft("reaver_helm", [((0, 0, 1.50), 0.165, 0.155), ((0, 0, 1.60), 0.175, 0.16), ((0, 0, 1.74), 0.17, 0.155), ((0, 0, 1.85), 0.14, 0.13), ((0, 0, 1.94), 0.08, 0.08), ((0, 0, 1.99), 0, 0)],
                M["plate"], n=10, phase=math.pi / 10)
    parts.append((helm, "head"))
    visor = box("reaver_visor", (0, -0.16, 1.70), 0.085, 0.012, 0.02, M["void"]); parts.append((visor, "head"))
    for x in (-0.05, 0.0, 0.05):
        slit = box(f"reaver_slit{x}", (x, -0.165, 1.62), 0.008, 0.01, 0.045, M["void"]); parts.append((slit, "head"))
    crest = loft("reaver_crest", [((0, -0.17, 1.76), 0.02, 0.01), ((0, -0.10, 1.96), 0.02, 0.01), ((0, 0.05, 1.99), 0.018, 0.01), ((0, 0.15, 1.90), 0.012, 0.01), ((0, 0.16, 1.86), 0, 0)], M["gold"], n=4, cap_bottom=True)
    parts.append((crest, "head"))
    gorget = loft("reaver_gorget", [((0, 0, 1.60), 0.10, 0.09), ((0, 0, 1.52), 0.20, 0.15), ((0, 0, 1.46), 0.22, 0.16)], M["plate"], n=10); parts.append((gorget, "neck"))
    trim0 = loft("reaver_trim0", [((0, 0, 1.465), 0.225, 0.165), ((0, 0, 1.45), 0.225, 0.165)], M["gold"], n=10); parts.append((trim0, "neck"))
    plate = loft("reaver_plate", [((0, 0, 1.50), 0.215, 0.15), ((0, 0, 1.40), 0.235, 0.16), ((0, 0, 1.26), 0.22, 0.15), ((0, 0, 1.12), 0.205, 0.145)], M["plate"], n=10); parts.append((plate, "spine"))
    trim1 = loft("reaver_trim1", [((0, 0, 1.13), 0.21, 0.15), ((0, 0, 1.11), 0.21, 0.15)], M["gold"], n=10); parts.append((trim1, "spine"))
    gem = loft("reaver_gem", [((0, -0.17, 1.30), 0.045, 0.012), ((0, -0.19, 1.34), 0, 0)], M["gold"], n=4, cap_bottom=True); parts.append((gem, "spine"))
    gem2 = loft("reaver_gem2", [((0, -0.17, 1.30), 0.045, 0.012), ((0, -0.19, 1.26), 0, 0)], M["gold"], n=4, cap_bottom=True); parts.append((gem2, "spine"))
    for s_, sx in (("L", -1), ("R", 1)):
        sh = J[f"shoulder.{s_}"]["p"]
        for i, (dz, r0, r1, drop) in enumerate([(0.10, 0.0, 0.16, 0.10), (0.0, 0.12, 0.17, 0.10), (-0.10, 0.13, 0.15, 0.09)]):
            p_ = loft(f"reaver_pauldron{i}.{s_}", [((sh.x + sx * 0.03, sh.y, sh.z + dz + 0.02), r0, r0 * 0.9), ((sh.x + sx * 0.05, sh.y, sh.z + dz - 0.03), r1, r1 * 0.9), ((sh.x + sx * 0.06, sh.y, sh.z + dz - drop), r1 * 0.95, r1 * 0.85)],
                      M["plate"], n=8, phase=math.pi / 8)
            parts.append((p_, f"upper_arm.{s_}"))
            edge = loft(f"reaver_pedge{i}.{s_}", [((sh.x + sx * 0.06, sh.y, sh.z + dz - drop + 0.012), r1 * 0.96, r1 * 0.86), ((sh.x + sx * 0.06, sh.y, sh.z + dz - drop - 0.002), r1 * 0.96, r1 * 0.86)], M["gold"], n=8, phase=math.pi / 8)
            parts.append((edge, f"upper_arm.{s_}"))
        disc = sphere(f"reaver_disc.{s_}", (sh.x + sx * 0.0, sh.y - 0.15, sh.z - 0.0), 0.04, M["gold"], n=6, k=3); parts.append((disc, "spine"))
        e, w = J[f"elbow.{s_}"]["p"], J[f"wrist.{s_}"]["p"]; d = (w - e); L = d.length
        gaunt = loft(f"reaver_gauntlet.{s_}", [((0, 0, 0.05 * L), 0.075, 0.075), ((0, 0, 0.55 * L), 0.08, 0.08), ((0, 0, 0.98 * L), 0.09, 0.09)], M["plate"], n=8)
        gaunt.matrix_world = Matrix.Translation(e) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4(); parts.append((gaunt, f"forearm.{s_}"))
        cuff = loft(f"reaver_cuff.{s_}", [((0, 0, 0.95 * L), 0.095, 0.095), ((0, 0, 1.02 * L), 0.095, 0.095)], M["gold"], n=8)
        cuff.matrix_world = gaunt.matrix_world.copy(); parts.append((cuff, f"forearm.{s_}"))
    parts += fists("reaver", J, M["plate"], r=0.062)
    cape = loft("reaver_cape", [((0, 0.17, 1.52), 0.40, 0.012), ((0, 0.20, 1.30), 0.39, 0.02), ((0, 0.22, 1.00), 0.37, 0.03), ((0, 0.23, 0.70), 0.35, 0.03), ((0, 0.24, 0.42), 0.34, 0.03)], M["cape"], n=8, cap_bottom=True, cap_top=True, fold=0.10, folds=3)
    parts.append((cape, "soft"))
    belt = loft("reaver_belt", [((0, 0, 1.11), 0.21, 0.15), ((0, 0, 1.05), 0.21, 0.15)], M["leather"], n=10); parts.append((belt, "pelvis"))
    for i, (z0, z1, r) in enumerate([(1.06, 0.92, 0.22), (0.94, 0.80, 0.235), (0.82, 0.70, 0.245)]):
        tas = loft(f"reaver_tasset{i}", [((0, 0, z0), r - 0.02, (r - 0.02) * 0.72), ((0, 0, z1), r, r * 0.72)], M["plate"], n=10, phase=math.pi / 10); parts.append((tas, "soft"))
        tedge = loft(f"reaver_tedge{i}", [((0, 0, z1 + 0.012), r * 1.005, r * 0.725), ((0, 0, z1 - 0.002), r * 1.005, r * 0.725)], M["gold"], n=10, phase=math.pi / 10); parts.append((tedge, "soft"))
    sword = weapon_along("reaver_sword", J, "R", [((0, 0, 0.0), 0.02, 0.02), ((0, 0, 0.17), 0.02, 0.02), ((0, 0, 0.18), 0.10, 0.02), ((0, 0, 0.21), 0.10, 0.02),
                                                  ((0, 0, 0.22), 0.05, 0.012), ((0, 0, 0.95), 0.04, 0.008), ((0, 0, 1.10), 0, 0)], M["steel"])
    parts.append((sword, "hand.R"))
    pommel = weapon_along("reaver_pommel", J, "R", [((0, 0, -0.07), 0.035, 0.035), ((0, 0, 0.0), 0.035, 0.035)], M["gold"]); parts.append((pommel, "hand.R"))
    parts += boots("reaver", J, M["boot"], M["plate"], cuff_h=0.06, r=0.085)
    for ob, bone in parts:
        if bone == "soft": attach_soft(ob, arm, J)
        else: parent_to_bone(ob, arm, bone)
    return [ob for ob, _ in parts]

def build_starseer(J, arm, M):
    parts = []
    # hat: wide brim, tall crown bending back at the tip
    brim = loft("star_brim", [((0, 0, 1.79), 0.12, 0.12), ((0, 0.02, 1.775), 0.30, 0.25), ((0, 0.03, 1.755), 0.44, 0.35), ((0, 0.03, 1.775), 0.44, 0.35), ((0, 0.02, 1.795), 0.30, 0.25), ((0, 0, 1.81), 0.12, 0.12)], M["hat"], n=14, cap_bottom=False)
    parts.append((brim, "head"))
    crown = loft("star_crown", [((0, 0, 1.78), 0.17, 0.16), ((0, 0.0, 1.92), 0.15, 0.14), ((0, 0.02, 2.08), 0.11, 0.10), ((0, 0.06, 2.22), 0.07, 0.065), ((0, 0.14, 2.32), 0.035, 0.03), ((0, 0.24, 2.36), 0, 0)],
                 M["hat"], n=10, cap_bottom=True)
    parts.append((crown, "head"))
    band = loft("star_band", [((0, 0, 1.80), 0.175, 0.165), ((0, 0, 1.86), 0.165, 0.155)], M["band"], n=10); parts.append((band, "head"))
    hatgem = box("star_hatgem", (0, -0.165, 1.84), 0.025, 0.012, 0.04, M["gold"]); parts.append((hatgem, "head"))
    # hood/cowl under the hat, dark; face void
    cowl = loft("star_cowl", [((0, 0.0, 1.50), 0.24, 0.19), ((0, 0.0, 1.62), 0.16, 0.14), ((0, 0.0, 1.76), 0.15, 0.14)], M["cloak"], n=10, phase=math.pi / 10)
    parts.append((cowl, "head"))
    face = loft("star_face", [((0, -0.10, 1.60), 0.09, 0.02), ((0, -0.10, 1.74), 0.085, 0.02)], M["void"], cap_bottom=True, cap_top=True, n=8); parts.append((face, "head"))
    # shoulder cape with gold edge, and the long cloak
    parts += tiers("star_mantle", 1.5, [(1.54, 0.17, 0.13, 0.37, 0.24, 1.26), (1.52, 0.16, 0.12, 0.30, 0.20, 1.36)], M["cloak"], n=10, phase=math.pi / 10)
    for hz, hx, hy in ((1.26, 0.37, 0.24), (1.36, 0.30, 0.20)):
        trim = loft(f"star_trim{hz}", [((0, 0, hz + 0.015), hx * 1.01, hy * 1.01), ((0, 0, hz - 0.005), hx * 1.01, hy * 1.01)], M["gold"], n=10, phase=math.pi / 10); parts.append((trim, "spine"))
    parts += studs("star_mantle", M["gold"], [((0.33, -0.12, 1.29), "spine"), ((-0.33, -0.12, 1.29), "spine")], r=0.02)
    parts += fists("star", J, M["skin"])
    parts += boots("star", J, M["boot"])
    robe = loft("star_robe", [((0, 0, 1.08), 0.20, 0.145), ((0, 0, 0.80), 0.24, 0.17), ((0, 0, 0.45), 0.28, 0.20), ((0, 0, 0.10), 0.31, 0.22)], M["robe"], n=12, cap_bottom=True, fold=0.08, folds=6)
    parts.append((robe, "soft"))
    sash = loft("star_sash", [((0, 0, 1.10), 0.205, 0.15), ((0, 0, 1.03), 0.205, 0.15)], M["band"], n=10); parts.append((sash, "pelvis"))
    sashgem = box("star_sashgem", (0, -0.155, 1.065), 0.04, 0.012, 0.04, M["gold"]); parts.append((sashgem, "pelvis"))
    for s in ("L", "R"):
        e, w = J[f"elbow.{s}"]["p"], J[f"wrist.{s}"]["p"]; d = (w - e); L = d.length
        sleeve = loft(f"star_sleeve.{s}", [((0, 0, 0.0), 0.075, 0.075), ((0, 0, 0.9 * L), 0.11, 0.11), ((0, 0, 1.0 * L), 0.11, 0.11)], M["cloak"], n=8)
        sleeve.matrix_world = Matrix.Translation(e) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4(); parts.append((sleeve, f"forearm.{s}"))
    # staff in the right hand, star on top; the shaft runs up from the fist (against the forearm) and a little below it
    hnd = J["hand.R"]["p"]
    staff = loft("star_staff", [((hnd.x + 0.02, hnd.y - 0.03, hnd.z - 0.35), 0.02, 0.02), ((hnd.x + 0.02, hnd.y - 0.03, hnd.z + 0.95), 0.02, 0.02)], M["wood"], n=6, cap_bottom=True, cap_top=True)
    parts.append((staff, "hand.R"))
    knob = sphere("star_knob", (hnd.x + 0.02, hnd.y - 0.03, hnd.z + 0.98), 0.035, M["gold"], n=6, k=3); parts.append((knob, "hand.R"))
    st = star("star_star", (hnd.x + 0.02, hnd.y - 0.03, hnd.z + 1.12), 0.15, 0.06, 0.015, M["gold"], points=8); parts.append((st, "hand.R"))
    core = sphere("star_core", (hnd.x + 0.02, hnd.y - 0.06, hnd.z + 1.12), 0.03, M["glow"], n=6, k=3); parts.append((core, "hand.R"))
    for ob, bone in parts:
        if bone == "soft": attach_soft(ob, arm, J)
        else: parent_to_bone(ob, arm, bone)
    return [ob for ob, _ in parts]

def build_herald(J, arm, M):
    parts = []
    hood = loft("herald_hood", [((0, 0.02, 1.46), 0.25, 0.20), ((0, 0.02, 1.58), 0.20, 0.17), ((0, 0.03, 1.70), 0.17, 0.15), ((0, 0.02, 1.84), 0.15, 0.14), ((0, 0.0, 1.95), 0.10, 0.09), ((0, -0.01, 2.02), 0.04, 0.04), ((0, -0.02, 2.05), 0, 0)],
                M["robe"], n=10, fold=0.05, folds=4)
    parts.append((hood, "head"))
    face = loft("herald_face", [((0, -0.10, 1.62), 0.09, 0.02), ((0, -0.10, 1.78), 0.085, 0.02)], M["void"], cap_bottom=True, cap_top=True, n=8); parts.append((face, "head"))
    halo = torus("herald_halo", (0, 0.10, 1.86), 0.30, 0.018, M["gold"], n=16, k=5); parts.append((halo, "head"))
    for i in range(4):
        a = math.pi / 2 * i
        spike = star(f"herald_spike{i}", (0.30 * math.cos(a), 0.10, 1.86 + 0.30 * math.sin(a)), 0.06, 0.02, 0.012, M["gold"], points=4); parts.append((spike, "head"))
    parts += tiers("herald_mantle", 1.5, [(1.54, 0.17, 0.13, 0.38, 0.25, 1.24), (1.52, 0.16, 0.12, 0.31, 0.21, 1.35)], M["robe_dark"], n=10, phase=math.pi / 10)
    for hz, hx, hy in ((1.24, 0.38, 0.25), (1.35, 0.31, 0.21)):
        trim = loft(f"herald_trim{hz}", [((0, 0, hz + 0.015), hx * 1.01, hy * 1.01), ((0, 0, hz - 0.005), hx * 1.01, hy * 1.01)], M["gold"], n=10, phase=math.pi / 10); parts.append((trim, "spine"))
    parts += studs("herald_mantle", M["gold"], [((0.34, -0.12, 1.27), "spine"), ((-0.34, -0.12, 1.27), "spine")], r=0.022)
    parts += fists("herald", J, M["skin"])
    parts += boots("herald", J, M["boot"])
    gem = star("herald_gem", (0, -0.20, 1.40), 0.05, 0.02, 0.012, M["gold"], points=3); parts.append((gem, "spine"))
    robe = loft("herald_robe", [((0, 0, 1.10), 0.21, 0.15), ((0, 0, 0.80), 0.25, 0.18), ((0, 0, 0.45), 0.29, 0.21), ((0, 0, 0.08), 0.33, 0.24)], M["robe"], n=12, cap_bottom=True, fold=0.08, folds=6)
    parts.append((robe, "soft"))
    # bead chain: small dark spheres in a V down the chest
    for i, (x, z) in enumerate([(-0.10, 1.40), (-0.11, 1.32), (-0.10, 1.24), (-0.08, 1.16), (-0.05, 1.08), (0.0, 1.02), (0.05, 1.08), (0.08, 1.16), (0.10, 1.24), (0.11, 1.32), (0.10, 1.40)]):
        bead = sphere(f"herald_bead{i}", (x * 1.3, -0.19, z), 0.028, M["bead"], n=6, k=3); parts.append((bead, "spine"))
    for s in ("L", "R"):
        e, w = J[f"elbow.{s}"]["p"], J[f"wrist.{s}"]["p"]; d = (w - e); L = d.length
        sleeve = loft(f"herald_sleeve.{s}", [((0, 0, 0.0), 0.08, 0.08), ((0, 0, 0.85 * L), 0.13, 0.13), ((0, 0, 1.0 * L), 0.13, 0.13)], M["robe"], n=8)
        sleeve.matrix_world = Matrix.Translation(e) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4(); parts.append((sleeve, f"forearm.{s}"))
        cuff = loft(f"herald_cuff.{s}", [((0, 0, 0.96 * L), 0.135, 0.135), ((0, 0, 1.02 * L), 0.135, 0.135)], M["gold"], n=8)
        cuff.matrix_world = sleeve.matrix_world.copy(); parts.append((cuff, f"forearm.{s}"))
    for ob, bone in parts:
        if bone == "soft": attach_soft(ob, arm, J)
        else: parent_to_bone(ob, arm, bone)
    return [ob for ob, _ in parts]

BUILDERS = {"rogue": build_rogue, "reaver": build_reaver, "starseer": build_starseer, "herald": build_herald}
PROPS = {"rogue": dict(shoulder_w=0.255, trap_r=(0.20, 0.125), chest_r=(0.205, 0.135), lchest_r=(0.18, 0.125), belly_r=(0.16, 0.12), delt_r=0.09, bicep_r=0.07, fore_r=0.062, thigh_r=0.10, calf_r=0.08),
         "reaver": dict(shoulder_w=0.28, trap_r=(0.22, 0.14), chest_r=(0.23, 0.155), lchest_r=(0.20, 0.14), belly_r=(0.19, 0.14), pelvis_r=(0.19, 0.14), delt_r=0.10, bicep_r=0.08, elbow_r=0.07, fore_r=0.072, thigh_r=0.11, calf_r=0.085),
         "starseer": dict(shoulder_w=0.22, chest_r=(0.17, 0.12)),
         "herald": dict(shoulder_w=0.245, chest_r=(0.20, 0.13), belly_r=(0.18, 0.13))}
def rogue_materials():
    return dict(hood=mat("rogue_hood", (33, 31, 30)), tunic=mat("rogue_tunic", (38, 50, 33)), leather=mat("rogue_leather", (56, 38, 26)), leather_dark=mat("rogue_leather_dark", (40, 27, 19)),
                gold=mat("gold", (212, 168, 62), rough=0.32, metal=0.85, glow=0.12), steel=mat("steel", (140, 142, 150), rough=0.35, metal=0.9),
                skin=mat("skin", (168, 118, 86)), void=mat("void", (6, 5, 5), rough=1.0), boot=mat("rogue_boot", (34, 28, 24)),
                cloth=mat("rogue_cloth", (40, 42, 40)))
def reaver_materials():
    return dict(plate=mat("reaver_plate", (78, 80, 86), rough=0.45, metal=0.7), gold=mat("gold", (212, 168, 62), rough=0.32, metal=0.85, glow=0.12),
                steel=mat("steel", (140, 142, 150), rough=0.35, metal=0.9), cape=mat("reaver_cape", (96, 30, 42)), leather=mat("reaver_leather", (48, 34, 26)),
                void=mat("void", (6, 5, 5), rough=1.0), under=mat("reaver_under", (36, 34, 34)), boot=mat("reaver_boot", (30, 28, 30), rough=0.5, metal=0.6))
def starseer_materials():
    return dict(hat=mat("star_hat", (40, 42, 62)), cloak=mat("star_cloak", (58, 46, 84)), robe=mat("star_robe", (30, 28, 42)), band=mat("star_band", (70, 40, 70)),
                gold=mat("gold", (212, 168, 62), rough=0.32, metal=0.85, glow=0.12), wood=mat("star_wood", (46, 34, 26)), glow=mat("star_glow", (255, 210, 140), rough=0.2, glow=3.0),
                void=mat("void", (6, 5, 5), rough=1.0), skin=mat("skin", (168, 118, 86)), boot=mat("star_boot", (28, 26, 34)))
def herald_materials():
    return dict(robe=mat("herald_robe", (74, 62, 42)), robe_dark=mat("herald_robe_dark", (56, 48, 34)), gold=mat("gold", (212, 168, 62), rough=0.32, metal=0.85, glow=0.12),
                bead=mat("herald_bead", (40, 30, 24), rough=0.4), void=mat("void", (6, 5, 5), rough=1.0), skin=mat("skin", (168, 118, 86)), boot=mat("herald_boot", (40, 34, 26)))
REGIONS = {
    "rogue": lambda M: dict(tunic=M["tunic"], cloth=M["hood"], head=M["hood"], sleeve=M["tunic"], bracer=M["leather"], skin=M["skin"], legs=M["cloth"], boot=M["boot"]),
    "reaver": lambda M: dict(tunic=M["under"], cloth=M["under"], head=M["plate"], sleeve=M["plate"], bracer=M["plate"], skin=M["plate"], legs=M["under"], boot=M["boot"]),
    "starseer": lambda M: dict(tunic=M["robe"], cloth=M["cloak"], head=M["cloak"], sleeve=M["cloak"], bracer=M["robe"], skin=M["skin"], legs=M["robe"], boot=M["boot"]),
    "herald": lambda M: dict(tunic=M["robe"], cloth=M["robe"], head=M["robe"], sleeve=M["robe"], bracer=M["robe"], skin=M["skin"], legs=M["robe"], boot=M["boot"]),
}

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
    "attack3": dict(turn=32, dx=0.3, dz=-0.1, aim={"thigh.R": (1, -0.25, -0.5), "shin.R": (0.35, -0.1, -1), "thigh.L": (-0.75, 0.15, -0.7), "shin.L": (-0.7, 0.15, -0.7),
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
for cls, build in BUILDERS.items():
    if ONLY and cls not in ONLY: continue
    M = globals()[f"{cls}_materials"]()
    for pose_id in STRIP:
        if ONLY_POSES and pose_id not in ONLY_POSES: continue
        body, J = build_body(cls, PROPS.get(cls, {}), REGIONS[cls](M))
        arm = build_armature(cls, J)
        weight_to_armature(body, arm, J)
        pieces = build(J, arm, M)
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
        for ob in [body, arm] + pieces: bpy.data.objects.remove(ob, do_unlink=True)
        for me in list(bpy.data.meshes):
            if me.users == 0: bpy.data.meshes.remove(me)
        for a in list(bpy.data.armatures):
            if a.users == 0: bpy.data.armatures.remove(a)
with open(os.path.join(OUT, "lowpoly-renders.manifest.json"), "w", encoding="utf-8", newline="\n") as fh:
    json.dump({"schema": "ashenspire/lowpoly-renders/v1", "canvas": CANVAS, "strip": STRIP, "renders": manifest}, fh, indent=2); fh.write("\n")
print(f"LOWPOLY OK: {len(manifest)} renders -> {OUT}")
