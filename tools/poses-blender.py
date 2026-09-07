# tools/poses-blender.py — low-poly class figures with REAL LIMBS, rendered in
# every combat position, in every tint.
#
#   blender --background --factory-startup --python tools/poses-blender.py -- <out-dir> [class ...]
#
# WHY A SECOND BUILDER FILE. tools/sprites-blender.py builds each class as a
# stack of cones and spheres with the legs as ONE skirt cone and the arms as
# fixed cylinders. That cannot pose: there is no knee to bend, no shoulder to
# swing. The owner's verdict on those figures — "low poly is fine, but the
# current models are just not working" — is a verdict on shape, not on style.
# So this file keeps the style (flat-shaded primitives, the same materials, the
# same camera and lights, imported from the sprite library rather than copied)
# and rebuilds each figure on a JOINTED skeleton: pelvis, spine, head, two
# shoulders, two elbows, two hips, two knees, each an Empty that parts are
# parented to. A pose is then a table of joint angles, and the same table works
# for every class because every class shares the skeleton.
#
# PROPORTIONS ARE ONE TABLE. The first render came out squat — a wide cube of a
# torso on stubby legs, about five heads tall, nothing like the lean figures in
# the paintings. Every rest height and width now comes from REST below, and the
# limbs, torsos and heads are placed from it, so the figure is ~7 heads and the
# four classes cannot drift apart in build.
#
# WHAT A POSE IS. Eight, named by what the fight does with them:
#   idle     standing, weapon low                        (the resting sprite)
#   guard    weight back, weapon up                      (strip frame 1 and 5)
#   attack1  wind-up: coiled, weapon drawn back          (strip frame 2)
#   attack2  strike: full lunge, weapon extended         (strip frame 3)
#   attack3  follow-through: past the target, recovering (strip frame 4)
#   hit      staggered back, off balance                 (took damage)
#   kneel    down on one knee, weapon lowered            (badly hurt)
#   down     collapsed, head bowed                       (defeated)
#
# The attack strip is guard → attack1 → attack2 → attack3 → guard, and the
# tables are written so each frame is a plausible next moment after the last:
# the torso turn and weapon arm sweep monotonically through the strike and
# settle on the way back. Played in order they read as one motion.
#
# MIRRORING IS NOT RENDERED. Every figure faces the camera's right (+X is the
# weapon side). The game flips it with CSS where a figure must face left; a
# second render per facing would double the shipped bytes for nothing.
#
# TINTS come from the same ACCENT / ACCENT_CLOTH material swap and hero rim
# light that sprites-blender.py uses, so a pose sprite and the class sprite it
# stands beside carry the player's colour the same way.

import json
import math
import os
import sys

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if not argv:
    print("usage: blender --background --factory-startup --python tools/poses-blender.py -- <out-dir> [class ...]")
    sys.exit(2)
OUT = os.path.abspath(argv[0])
ONLY = set(argv[1:])
os.makedirs(OUT, exist_ok=True)

# ---- the sprite library: materials, part(), stage, tints ----------------------
# exec'd rather than imported so the class figures, materials and stage are ONE
# definition (tools/equipment-blender.py does the same). Everything above the
# library's render loop is library.
lib_path = os.path.join(ROOT, "tools", "sprites-blender.py")
lib_src = open(lib_path, encoding="utf-8").read()
lib_src = lib_src[:lib_src.index("# ---- render every class x tint")]
lib = {"__file__": lib_path, "__name__": "sprites_lib"}
# The library reads its own OUT from argv; give it ours so it never writes.
_saved_argv = sys.argv
sys.argv = [sys.argv[0], "--", OUT]
exec(compile(lib_src, lib_path, "exec"), lib)
sys.argv = _saved_argv

part = lib["part"]
clear_parts = lib["clear_parts"]
cone, uv, ico, cyl, cube, torus = (lib[k] for k in ("cone", "uv", "ico", "cyl", "cube", "torus"))
srgb = lib["srgb"]
TINTS = lib["TINTS"]
scene = lib["scene"]
cam = lib["cam"]
hero_rim = lib["hero_rim"]
ACCENT = lib["ACCENT"]
ACCENT_CLOTH = lib["ACCENT_CLOTH"]
STEEL = lib["STEEL"]
NEAR_BLACK = lib["NEAR_BLACK"]
WOOD = lib["WOOD"]
SKIN = lib["SKIN"]
HERO_PLATE, HERO_PLATE_LT, HERO_LEATHER, HERO_UNDER = (lib[k] for k in ("HERO_PLATE", "HERO_PLATE_LT", "HERO_LEATHER", "HERO_UNDER"))
ROBE_UMBER, ROBE_UMBER_LT, ROBE_RED, HOOD_DARK, CLOTH_DARK = (lib[k] for k in ("ROBE_UMBER", "ROBE_UMBER_LT", "ROBE_RED", "HOOD_DARK", "CLOTH_DARK"))
ROGUE_SCALE, ROGUE_SCALE_LT, ROGUE_LEATHER, ROGUE_UNDER, ROGUE_HOOD, ROGUE_MANTLE = (
    lib[k] for k in ("ROGUE_SCALE", "ROGUE_SCALE_LT", "ROGUE_LEATHER", "ROGUE_UNDER", "ROGUE_HOOD", "ROGUE_MANTLE"))
WITH_WEAPON = lib["WITH_WEAPON"]


# ---- proportions ---------------------------------------------------------------
# World Z of each joint at rest, and the two half-widths. ~7 heads tall: the head
# sphere is 0.17 in radius, the figure stands 1.96 to the crown of a hood.
REST = {
    "foot": 0.00, "knee": 0.46, "hip": 0.90, "pelvis": 0.96, "spine": 1.16,
    "shoulder": 1.52, "elbow": 1.26, "wrist": 1.02, "head": 1.66,
    "hip_x": 0.12, "shoulder_x": 0.26, "hand_x": 0.30,
}
R = REST


# ---- skeleton ---------------------------------------------------------------------
# Joints are Empties. A part built at its REST world position is parented to a
# joint with the inverse of the joint's matrix, so it keeps its rest placement
# and swings with the joint when the joint is rotated. Rotations are Euler XYZ
# in degrees: X pitches forward/back, Y rolls, Z turns about the vertical.
J = {}


def joint(name, loc, parent=None):
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=loc)
    e = bpy.context.active_object
    e.name = f"j_{name}"
    e.empty_display_size = 0.05
    if parent is not None:
        e.parent = J[parent]
        e.matrix_parent_inverse = J[parent].matrix_world.inverted()
    lib["_parts"].append(e)  # the library REBINDS _parts on clear_parts(); go through the live name
    J[name] = e
    return e


def skeleton():
    J.clear()
    joint("pelvis", (0, 0, R["pelvis"]))
    joint("spine", (0, 0, R["spine"]), "pelvis")
    joint("head", (0, 0, R["head"]), "spine")
    for s, n in ((-1, "l"), (1, "r")):
        joint(f"shoulder_{n}", (s * R["shoulder_x"], 0, R["shoulder"]), "spine")
        joint(f"elbow_{n}", (s * R["hand_x"], 0, R["elbow"]), f"shoulder_{n}")
        joint(f"hip_{n}", (s * R["hip_x"], 0, R["hip"]), "pelvis")
        joint(f"knee_{n}", (s * R["hip_x"], 0, R["knee"]), f"hip_{n}")


def bone(ob, jname):
    j = J[jname]
    ob.parent = j
    ob.matrix_parent_inverse = j.matrix_world.inverted()
    return ob


def P(jname, op, mat, loc=(0, 0, 0), blight=(0, 0, 0), scale=(1, 1, 1), **kw):
    """part() then bone(): build at rest, attach to a joint."""
    return bone(part(op, mat, loc=loc, blight=blight, scale=scale, **kw), jname)


def pose(table):
    """Apply a pose table: joint -> (rx, ry, rz) degrees, plus pelvis offsets."""
    bpy.context.view_layer.update()
    for name, val in table.items():
        if name == "pelvis_dz":
            J["pelvis"].location.z = R["pelvis"] + val
        elif name == "pelvis_dx":
            J["pelvis"].location.x = val
        else:
            J[name].rotation_euler = tuple(math.radians(a) for a in val)
    bpy.context.view_layer.update()


# ---- shared body: limbs every class gets, in that class's materials ---------------
def limbs(m_thigh, m_shin, m_boot, m_upper_arm, m_forearm, m_hand, thick=1.0):
    hx, hand = R["hip_x"], R["hand_x"]
    for s, n in ((-1, "l"), (1, "r")):
        # thigh from the hip, knee, shin from the knee, boot on the shin
        P(f"hip_{n}", cyl, m_thigh, loc=(s * hx, 0, (R["hip"] + R["knee"]) / 2), vertices=8,
          radius=0.078 * thick, depth=R["hip"] - R["knee"])
        P(f"knee_{n}", ico, m_thigh, loc=(s * hx, -0.01, R["knee"]), subdivisions=1, radius=0.070 * thick)
        P(f"knee_{n}", cyl, m_shin, loc=(s * hx, 0, (R["knee"] + R["foot"]) / 2 + 0.03), vertices=8,
          radius=0.066 * thick, depth=R["knee"] - R["foot"] - 0.04)
        P(f"knee_{n}", cube, m_boot, loc=(s * (hx + 0.01), -0.045, 0.05), scale=(0.085, 0.145, 0.05))
        # upper arm from the shoulder, elbow, forearm from the elbow, hand
        P(f"shoulder_{n}", cyl, m_upper_arm, loc=(s * (R["shoulder_x"] + 0.03), 0, (R["shoulder"] + R["elbow"]) / 2),
          blight=(0, s * 8, 0), vertices=8, radius=0.060 * thick, depth=R["shoulder"] - R["elbow"])
        P(f"elbow_{n}", ico, m_upper_arm, loc=(s * hand, 0, R["elbow"]), subdivisions=1, radius=0.056 * thick)
        P(f"elbow_{n}", cyl, m_forearm, loc=(s * hand, 0, (R["elbow"] + R["wrist"]) / 2), vertices=8,
          radius=0.052 * thick, depth=R["elbow"] - R["wrist"])
        P(f"elbow_{n}", ico, m_hand, loc=(s * hand, -0.01, R["wrist"] - 0.02), subdivisions=1, radius=0.050 * thick)


def torso(m_body, m_edge, w=0.20, d=0.13):
    """A cuirass on the spine and a belt on the pelvis. Returns nothing; shape only."""
    zc = (R["spine"] + R["shoulder"]) / 2 - 0.02
    P("spine", cube, m_body, loc=(0, 0, zc), scale=(w, d, (R["shoulder"] - R["spine"]) / 2 + 0.02))
    P("spine", cube, m_edge, loc=(0, -d - 0.005, zc + 0.02), scale=(0.045, 0.015, 0.16))
    P("pelvis", cube, m_edge, loc=(0, -0.01, R["pelvis"] + 0.02), scale=(w + 0.01, d + 0.01, 0.035))


def hood(m_shell, m_void=NEAR_BLACK, peak=True, eyes=None):
    """A hood on the head: shell, brow, void where the face would be, and a peak."""
    z = R["head"] + 0.06
    P("head", uv, m_shell, loc=(0, 0.02, z), segments=14, ring_count=10, radius=0.175)
    P("head", cyl, m_shell, loc=(0, -0.085, z + 0.02), blight=(90, 0, 0), vertices=12, radius=0.148, depth=0.05)
    P("head", uv, m_void, loc=(0, -0.075, z - 0.025), segments=10, ring_count=6, radius=0.120)
    if peak:
        P("head", cone, m_shell, loc=(0, 0.09, z + 0.16), blight=(20, 0, 0), vertices=8, radius1=0.14, radius2=0.025, depth=0.24)
    if eyes:
        for s in (-1, 1):
            P("head", ico, eyes, loc=(s * 0.040, -0.160, z - 0.01), subdivisions=1, radius=0.016)


# ---- the four classes, rebuilt on the skeleton -------------------------------------
def build_rogue():
    skeleton()
    limbs(ROGUE_UNDER, ROGUE_UNDER, NEAR_BLACK, ROGUE_SCALE, ROGUE_LEATHER, ROGUE_LEATHER, thick=0.95)
    torso(ROGUE_SCALE, ROGUE_SCALE_LT, w=0.19, d=0.12)
    # cross-strap over the cuirass, leather not metal
    P("spine", cube, ROGUE_LEATHER, loc=(0, -0.13, R["spine"] + 0.17), blight=(0, 28, 0), scale=(0.028, 0.015, 0.20))
    # short split coat skirt from the pelvis — ends above the knee so a kneel reads
    for s in (-1, 1):
        P("pelvis", cube, ROGUE_SCALE, loc=(s * 0.10, -0.04, R["pelvis"] - 0.16), blight=(0, 0, s * -7),
          scale=(0.10, 0.11, 0.15))
    P("pelvis", cube, ROGUE_SCALE_LT, loc=(0, 0.10, R["pelvis"] - 0.18), scale=(0.16, 0.05, 0.17))
    # THE MANTLE: the layered shoulder cowl that reads as rogue at a glance. Dark,
    # like the painting — the approved look measures gold at 0.6%, so the old
    # accent-cloth cape is gone; the tint lives in the rim, the clasp, the guards.
    P("spine", cone, ROGUE_HOOD, loc=(0, 0.01, R["shoulder"] - 0.06), vertices=10, radius1=0.33, radius2=0.19, depth=0.26)
    P("spine", cone, ROGUE_MANTLE, loc=(0, 0.01, R["shoulder"] + 0.05), vertices=10, radius1=0.26, radius2=0.17, depth=0.18)
    P("spine", cone, ROGUE_MANTLE, loc=(0, 0.13, R["spine"] + 0.10), vertices=7, radius1=0.24, radius2=0.12, depth=0.56)
    hood(ROGUE_HOOD)
    P("spine", cone, ACCENT, loc=(0, -0.165, R["shoulder"] - 0.03), blight=(90, 0, 0), vertices=3, radius1=0.045, radius2=0.0, depth=0.03)
    # paired daggers in the hands, reverse grip, blades running down past the hip
    if WITH_WEAPON:
        for s, n in ((-1, "l"), (1, "r")):
            x = s * R["hand_x"]
            w = R["wrist"]
            P(f"elbow_{n}", cyl, ROGUE_LEATHER, loc=(x, -0.02, w + 0.02), vertices=8, radius=0.018, depth=0.12)
            P(f"elbow_{n}", cube, ACCENT, loc=(x, -0.02, w - 0.05), scale=(0.050, 0.016, 0.014))
            P(f"elbow_{n}", cube, STEEL, loc=(x, -0.02, w - 0.20), scale=(0.022, 0.010, 0.15))
            P(f"elbow_{n}", cone, STEEL, loc=(x, -0.02, w - 0.39), blight=(180, 0, 0), vertices=4, radius1=0.022, radius2=0.0, depth=0.08)


def build_reaver():
    skeleton()
    limbs(HERO_UNDER, HERO_PLATE, NEAR_BLACK, HERO_PLATE, HERO_PLATE, HERO_LEATHER, thick=1.12)
    for s, n in ((-1, "l"), (1, "r")):
        P(f"knee_{n}", ico, HERO_PLATE_LT, loc=(s * R["hip_x"], -0.055, R["knee"] + 0.02), subdivisions=1, radius=0.066)
    torso(HERO_PLATE, HERO_PLATE_LT, w=0.22, d=0.14)
    P("spine", cyl, HERO_PLATE_LT, loc=(0, 0, R["shoulder"] + 0.01), blight=(90, 0, 0), vertices=12, radius=0.16, depth=0.06)
    P("pelvis", cyl, ACCENT, loc=(0, -0.155, R["pelvis"] + 0.02), blight=(90, 0, 0), vertices=10, radius=0.045, depth=0.03)
    P("pelvis", cube, ACCENT_CLOTH, loc=(0, -0.145, R["pelvis"] - 0.20), scale=(0.10, 0.015, 0.18))
    # half-cape behind one shoulder — the painting's red sweep
    P("spine", cone, ACCENT_CLOTH, loc=(0.08, 0.15, R["spine"] + 0.16), vertices=7, radius1=0.28, radius2=0.12, depth=0.74)
    # pauldrons with the accent rim, on the shoulders so they ride the arm
    for s, n in ((-1, "l"), (1, "r")):
        P(f"shoulder_{n}", ico, HERO_PLATE, loc=(s * (R["shoulder_x"] + 0.05), 0, R["shoulder"] - 0.02), subdivisions=2, radius=0.15)
        P(f"shoulder_{n}", torus, ACCENT, loc=(s * (R["shoulder_x"] + 0.05), 0, R["shoulder"] + 0.03), major_radius=0.13, minor_radius=0.016)
    # full helm: skull, brow band, T-visor slit, cheek plates, plume
    z = R["head"] + 0.07
    P("head", uv, HERO_PLATE, loc=(0, 0, z), segments=16, ring_count=12, radius=0.165)
    P("head", torus, ACCENT, loc=(0, 0, z + 0.04), major_radius=0.155, minor_radius=0.020)
    P("head", cube, NEAR_BLACK, loc=(0, -0.145, z), scale=(0.10, 0.03, 0.017))
    P("head", cube, NEAR_BLACK, loc=(0, -0.145, z - 0.06), scale=(0.017, 0.03, 0.048))
    for s in (-1, 1):
        P("head", cube, HERO_PLATE_LT, loc=(s * 0.10, -0.112, z - 0.06), scale=(0.040, 0.040, 0.066))
    P("head", cone, ACCENT_CLOTH, loc=(0, 0.05, z + 0.23), blight=(-12, 0, 0), vertices=6, radius1=0.065, radius2=0.010, depth=0.26)
    # greatsword in the right hand, blade UP from the grip so a swing reads
    if WITH_WEAPON:
        x, w = R["hand_x"], R["wrist"]
        P("elbow_r", cyl, HERO_LEATHER, loc=(x, -0.02, w), vertices=8, radius=0.024, depth=0.20)
        P("elbow_r", ico, ACCENT, loc=(x, -0.02, w - 0.13), subdivisions=2, radius=0.042)
        P("elbow_r", cube, ACCENT, loc=(x, -0.02, w + 0.12), scale=(0.15, 0.028, 0.026))
        P("elbow_r", cube, STEEL, loc=(x, -0.02, w + 0.54), scale=(0.044, 0.016, 0.40))
        P("elbow_r", cube, HERO_PLATE_LT, loc=(x, -0.037, w + 0.54), scale=(0.011, 0.004, 0.38))
        P("elbow_r", cone, STEEL, loc=(x, -0.02, w + 1.00), vertices=4, radius1=0.044, radius2=0.0, depth=0.13)


def build_starseer():
    skeleton()
    limbs(ROBE_UMBER, ROBE_UMBER, NEAR_BLACK, ROBE_UMBER_LT, ROBE_UMBER, SKIN, thick=0.92)
    # robe over the torso and a long front panel with trim; a mantle behind
    P("spine", cone, ROBE_UMBER, loc=(0, 0, R["spine"] + 0.18), vertices=10, radius1=0.25, radius2=0.15, depth=0.40)
    P("pelvis", cone, ROBE_UMBER, loc=(0, 0, R["pelvis"] - 0.22), vertices=10, radius1=0.30, radius2=0.22, depth=0.42)
    P("pelvis", cube, ROBE_UMBER_LT, loc=(0, -0.175, R["pelvis"] - 0.20), scale=(0.09, 0.015, 0.24))
    P("pelvis", cube, ACCENT_CLOTH, loc=(0, -0.190, R["pelvis"] - 0.20), scale=(0.024, 0.015, 0.24))
    P("spine", cone, ACCENT_CLOTH, loc=(0, 0.13, R["spine"] + 0.12), vertices=7, radius1=0.30, radius2=0.14, depth=0.70)
    P("pelvis", cyl, ACCENT, loc=(0, -0.20, R["pelvis"] + 0.03), blight=(90, 0, 0), vertices=10, radius=0.038, depth=0.03)
    for s, n in ((-1, "l"), (1, "r")):
        P(f"shoulder_{n}", ico, ROBE_UMBER_LT, loc=(s * (R["shoulder_x"] + 0.02), 0, R["shoulder"] - 0.02), subdivisions=2, radius=0.105)
    # head under the wide brim and the tall crooked point; accent band and star
    z = R["head"] + 0.05
    P("head", uv, SKIN, loc=(0, 0, z), segments=14, ring_count=10, radius=0.13)
    P("head", cyl, ROBE_UMBER_LT, loc=(0, 0, z - 0.11), blight=(90, 0, 0), vertices=12, radius=0.15, depth=0.06)
    P("head", cone, ROBE_UMBER, loc=(0, 0, z + 0.14), vertices=14, radius1=0.50, radius2=0.26, depth=0.09)
    P("head", cone, ROBE_UMBER, loc=(0, 0.03, z + 0.36), blight=(-10, 0, 0), vertices=10, radius1=0.21, radius2=0.014, depth=0.44)
    P("head", torus, ACCENT, loc=(0, 0.005, z + 0.20), major_radius=0.215, minor_radius=0.022)
    P("head", ico, ACCENT, loc=(0, 0.09, z + 0.57), subdivisions=1, radius=0.040)
    # staff in the right hand, star head up; the strike is a cast, not a swing
    if WITH_WEAPON:
        x, w = R["hand_x"], R["wrist"]
        P("elbow_r", cyl, WOOD, loc=(x, -0.02, w + 0.24), vertices=8, radius=0.020, depth=1.50)
        P("elbow_r", cyl, ACCENT, loc=(x, -0.02, w - 0.10), vertices=8, radius=0.030, depth=0.05)
        P("elbow_r", ico, ACCENT, loc=(x, -0.02, w + 1.02), subdivisions=2, radius=0.080)


def build_herald():
    skeleton()
    limbs(ROBE_RED, ROBE_RED, CLOTH_DARK, ROBE_RED, ROBE_RED, SKIN, thick=0.96)
    # layered robes, rope belt, stole, a dark cowl over the shoulders
    P("spine", cone, ROBE_RED, loc=(0, 0, R["spine"] + 0.18), vertices=9, radius1=0.26, radius2=0.16, depth=0.38)
    P("pelvis", cone, ROBE_RED, loc=(0, 0, R["pelvis"] - 0.22), vertices=9, radius1=0.31, radius2=0.23, depth=0.42)
    P("pelvis", torus, CLOTH_DARK, loc=(0, 0, R["pelvis"] + 0.02), major_radius=0.22, minor_radius=0.026)
    for s in (-1, 1):
        P("pelvis", cube, ACCENT_CLOTH, loc=(s * 0.065, -0.185, R["pelvis"] - 0.16), scale=(0.026, 0.015, 0.22))
    P("spine", cone, ACCENT_CLOTH, loc=(0, 0.12, R["spine"] + 0.14), vertices=7, radius1=0.28, radius2=0.15, depth=0.64)
    P("spine", cone, HOOD_DARK, loc=(0, -0.02, R["shoulder"] - 0.02), vertices=9, radius1=0.26, radius2=0.17, depth=0.26)
    hood(HOOD_DARK, eyes=ACCENT)
    # halo above the hood, riding the head so it tilts with it
    P("head", torus, ACCENT, loc=(0, 0.15, R["head"] + 0.20), blight=(90, 0, 0), major_radius=0.22, minor_radius=0.011)
    # long bead strands from the neck down the chest
    for x in (-0.10, -0.035, 0.035, 0.10):
        for z in (R["spine"] + 0.26, R["spine"] + 0.17, R["spine"] + 0.08):
            P("spine", ico, ACCENT, loc=(x, -0.155, z - 0.02 * abs(x) / 0.10), subdivisions=1, radius=0.016)
    # censer on a chain from the right hand
    if WITH_WEAPON:
        x, w = R["hand_x"], R["wrist"]
        P("elbow_r", cyl, WOOD, loc=(x, -0.04, w - 0.16), vertices=6, radius=0.007, depth=0.28)
        P("elbow_r", ico, ACCENT, loc=(x, -0.04, w - 0.33), subdivisions=2, radius=0.042)


BUILDERS = {"reaver": build_reaver, "starseer": build_starseer, "rogue": build_rogue, "herald": build_herald}


# ---- poses ----------------------------------------------------------------------------
# Joint angles in degrees (rx pitch forward, ry roll, rz turn). +X is the
# camera's right and the weapon side. The strip frames are ordered so each is
# the next moment after the last; hit/kneel/down descend in that order.
POSES = {
    "idle": {
        "spine": (0, 0, 8), "head": (0, 0, -4),
        "shoulder_l": (6, 0, 0), "elbow_l": (-10, 0, 0),
        "shoulder_r": (6, 0, 0), "elbow_r": (-12, 0, 0),
    },
    "guard": {
        "pelvis_dz": -0.08, "pelvis_dx": -0.08,
        "spine": (6, 0, 36), "head": (0, 0, -20),
        "shoulder_l": (-44, 0, 26), "elbow_l": (-76, 0, 0),
        "shoulder_r": (-70, 0, -20), "elbow_r": (-84, 0, 0),
        "hip_l": (-26, 0, 0), "knee_l": (40, 0, 0),
        "hip_r": (28, 0, 0), "knee_r": (22, 0, 0),
    },
    "attack1": {
        "pelvis_dz": -0.10, "pelvis_dx": -0.16,
        "spine": (8, 0, 56), "head": (0, 0, -26),
        "shoulder_l": (-34, 0, 32), "elbow_l": (-64, 0, 0),
        "shoulder_r": (-104, 0, -36), "elbow_r": (-72, 0, 0),
        "hip_l": (-34, 0, 0), "knee_l": (50, 0, 0),
        "hip_r": (32, 0, 0), "knee_r": (16, 0, 0),
    },
    "attack2": {
        "pelvis_dz": -0.14, "pelvis_dx": 0.24,
        "spine": (24, 0, -26), "head": (-4, 0, 8),
        "shoulder_l": (-12, 0, 44), "elbow_l": (-44, 0, 0),
        "shoulder_r": (-34, 0, 66), "elbow_r": (-4, 0, 0),
        "hip_l": (52, 0, 0), "knee_l": (2, 0, 0),
        "hip_r": (-36, 0, 0), "knee_r": (62, 0, 0),
    },
    "attack3": {
        "pelvis_dz": -0.09, "pelvis_dx": 0.14,
        "spine": (12, 0, -44), "head": (0, 0, 16),
        "shoulder_l": (-4, 0, 28), "elbow_l": (-32, 0, 0),
        "shoulder_r": (22, 0, 56), "elbow_r": (-4, 0, 0),
        "hip_l": (36, 0, 0), "knee_l": (10, 0, 0),
        "hip_r": (-22, 0, 0), "knee_r": (44, 0, 0),
    },
    "hit": {
        "pelvis_dz": -0.04, "pelvis_dx": -0.14,
        "spine": (-20, 10, 20), "head": (-18, 0, 26),
        "shoulder_l": (-46, 0, -34), "elbow_l": (-26, 0, 0),
        "shoulder_r": (-54, 0, 38), "elbow_r": (-22, 0, 0),
        "hip_l": (-14, 0, 0), "knee_l": (20, 0, 0),
        "hip_r": (36, 0, 0), "knee_r": (52, 0, 0),
    },
    "kneel": {
        "pelvis_dz": -0.46, "pelvis_dx": 0.02,
        "spine": (20, 0, 10), "head": (18, 0, -6),
        "shoulder_l": (-34, 0, 12), "elbow_l": (-22, 0, 0),
        "shoulder_r": (12, 0, -8), "elbow_r": (-16, 0, 0),
        "hip_l": (-88, 0, 0), "knee_l": (102, 0, 0),
        "hip_r": (16, 0, 0), "knee_r": (96, 0, 0),
    },
    "down": {
        "pelvis_dz": -0.62, "pelvis_dx": 0.06,
        "spine": (52, 0, 6), "head": (38, 0, -4),
        "shoulder_l": (-50, 0, 16), "elbow_l": (-14, 0, 0),
        "shoulder_r": (38, 0, -6), "elbow_r": (-8, 0, 0),
        "hip_l": (-96, 0, 0), "knee_l": (112, 0, 0),
        "hip_r": (-26, 0, 0), "knee_r": (116, 0, 0),
    },
}
STRIP = ["idle", "guard", "attack1", "attack2", "attack3", "hit", "kneel", "down"]


# ---- render ----------------------------------------------------------------------------------
accent_bsdf = ACCENT.node_tree.nodes["Principled BSDF"]
cloth_bsdf = ACCENT_CLOTH.node_tree.nodes["Principled BSDF"]
scene.render.resolution_x, scene.render.resolution_y = 450, 570
hero_rim.data.energy = 2.6
# A lunge travels sideways and a hat stands tall: frame 2.40 tall, centred so the
# feet keep the same ground in every pose and nothing clips.
cam.data.ortho_scale = 2.40
cam.location.z = 1.02

count = 0
manifest = []
for class_id, build in BUILDERS.items():
    if ONLY and class_id not in ONLY:
        continue
    for pose_id in STRIP:
        build()
        pose(POSES[pose_id])
        for tint_id, rgb in TINTS.items():
            rgba = srgb(*rgb)
            accent_bsdf.inputs["Base Color"].default_value = rgba
            accent_bsdf.inputs["Emission Color"].default_value = rgba
            cloth_bsdf.inputs["Base Color"].default_value = rgba
            cloth_bsdf.inputs["Emission Color"].default_value = rgba
            hero_rim.data.color = rgba[:3]
            name = f"{class_id}_{pose_id}_{tint_id}.webp"
            scene.render.filepath = os.path.join(OUT, name)
            bpy.ops.render.render(write_still=True)
            manifest.append({"class": class_id, "pose": pose_id, "tint": tint_id, "file": name})
            count += 1
        clear_parts()

with open(os.path.join(OUT, "poses.manifest.json"), "w", encoding="utf-8", newline="\n") as fh:
    json.dump({"schema": "ashenspire/poses/v1", "rest": REST, "strip": STRIP, "renders": manifest}, fh, indent=2)
    fh.write("\n")
print(f"POSES OK: {count} renders -> {OUT}")
