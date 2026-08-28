# tools/backdrops-blender.py — procedural act backdrops, rendered in Blender.
#
# One atmospheric plate per act: layered ridge silhouettes with aerial depth
# falloff, drifting embers, and a glowing focal Goldbough (dark branching
# silhouette + emissive canopy lifted by a compositor glare, NOT a flat sphere).
# Deterministic: a fixed seed per act means re-running regenerates identically.
#
#   blender --background --factory-startup --python tools/backdrops-blender.py -- <outDir>
#
# Output: <outDir>/bg_act{1,2,3}.webp, rendered small on purpose — the art is
# low-frequency, so the UI scales+blurs it and the single-file bundle stays
# small enough to inline (tools/bundle.mjs base64s anything CSS url()s).

import bpy
import math
import os
import sys
import random

OUT = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
os.makedirs(OUT, exist_ok=True)

# Rendered small: backdrops are low-detail, and the bundle inlines them.
RES_X, RES_Y = 720, 430

# Per-act mood, in the styles/base.css palette. sky/haze drive the gradient and
# the aerial perspective; glow is the focal + ember colour.
ACTS = {
    1: {"sky": (0.055, 0.045, 0.032), "haze": (0.17, 0.13, 0.075), "glow": (0.79, 0.63, 0.15), "seed": 11},
    2: {"sky": (0.050, 0.035, 0.030), "haze": (0.19, 0.10, 0.070), "glow": (0.63, 0.28, 0.16), "seed": 22},
    3: {"sky": (0.045, 0.040, 0.048), "haze": (0.14, 0.13, 0.155), "glow": (0.66, 0.72, 0.82), "seed": 33},
}


def mat(name, color, emit=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    n, l = m.node_tree.nodes, m.node_tree.links
    n.clear()
    out = n.new("ShaderNodeOutputMaterial")
    if emit > 0:
        sh = n.new("ShaderNodeEmission")
        sh.inputs["Color"].default_value = (*color, 1)
        sh.inputs["Strength"].default_value = emit
    else:
        sh = n.new("ShaderNodeBsdfDiffuse")
        sh.inputs["Color"].default_value = (*color, 1)
    if alpha < 1.0:
        tr = n.new("ShaderNodeBsdfTransparent")
        mix = n.new("ShaderNodeMixShader")
        mix.inputs["Fac"].default_value = alpha
        l.new(tr.outputs[0], mix.inputs[1])
        l.new(sh.outputs[0], mix.inputs[2])
        l.new(mix.outputs[0], out.inputs["Surface"])
        m.blend_method = "BLEND"
    else:
        l.new(sh.outputs[0], out.inputs["Surface"])
    return m


def glow_billboard_mat(name, color, emit, peak):
    """Radial glow for a camera-facing quad.

    Stacked translucent spheres were the first two attempts and both banded —
    uniform alpha gives hard 'onion' shells, and a facing-driven alpha inverts
    into bright concentric outlines. A single billboard with a SPHERICAL
    gradient driving the alpha has no shell edges at all, so the falloff is
    genuinely smooth.
    """
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    n, l = m.node_tree.nodes, m.node_tree.links
    n.clear()
    out = n.new("ShaderNodeOutputMaterial")
    em = n.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    em.inputs["Strength"].default_value = emit
    tr = n.new("ShaderNodeBsdfTransparent")
    tc = n.new("ShaderNodeTexCoord")
    grad = n.new("ShaderNodeTexGradient")
    grad.gradient_type = "SPHERICAL"
    ramp = n.new("ShaderNodeValToRGB")
    # Spherical gradient is 1 at the quad's centre → ease it out to nothing.
    ramp.color_ramp.elements[0].position = 0.30
    ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = (peak, peak, peak, 1)
    mix = n.new("ShaderNodeMixShader")
    l.new(tc.outputs["Generated"], grad.inputs["Vector"])
    l.new(grad.outputs["Fac"], ramp.inputs["Fac"])
    l.new(ramp.outputs["Color"], mix.inputs["Fac"])
    l.new(tr.outputs[0], mix.inputs[1])
    l.new(em.outputs[0], mix.inputs[2])
    l.new(mix.outputs[0], out.inputs["Surface"])
    m.blend_method = "BLEND"
    return m


def world_gradient(scene, sky, haze):
    w = bpy.data.worlds.new("W")
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    bg = nt.nodes.new("ShaderNodeBackground")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    grad = nt.nodes.new("ShaderNodeTexGradient")
    mapp = nt.nodes.new("ShaderNodeMapping")
    mapp.inputs["Rotation"].default_value[1] = math.radians(90)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    out = nt.nodes.new("ShaderNodeOutputWorld")
    ramp.color_ramp.elements[0].color = (*sky, 1)
    ramp.color_ramp.elements[1].color = (*haze, 1)
    ramp.color_ramp.elements[1].position = 0.75
    nt.links.new(tc.outputs["Generated"], mapp.inputs["Vector"])
    nt.links.new(mapp.outputs["Vector"], grad.inputs["Vector"])
    nt.links.new(grad.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def ridge(scene, y, height, phase, shade, rng):
    """A jagged silhouette wall at depth `y`, extruded down out of frame."""
    n, span = 30, 70
    verts, faces = [], []
    for i in range(n + 1):
        x = -span / 2 + span * i / n
        wob = math.sin(i * 0.8 + phase) * 0.5 + math.sin(i * 2.3 + phase * 1.7) * 0.25
        verts.append((x, y, height * (0.5 + 0.5 * abs(wob)) * rng.uniform(0.75, 1.15)))
    for i in range(n + 1):
        verts.append((-span / 2 + span * i / n, y, -8))
    for i in range(n):
        faces.append((i, i + 1, n + 2 + i, n + 1 + i))
    me = bpy.data.meshes.new(f"ridge{y}")
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(f"Ridge{y}", me)
    scene.collection.objects.link(ob)
    ob.data.materials.append(mat(f"mr{y}", shade))


def goldbough(scene, glow, rng):
    """Dark branching silhouette + emissive canopy. Glare does the blooming."""
    dark = (0.020, 0.016, 0.012)
    trunk_m = mat("trunk", dark)
    # trunk
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.85, radius2=0.35, depth=11, location=(0, 30, 3.5))
    bpy.context.object.data.materials.append(trunk_m)
    # branches: a few tapered limbs fanning up and out
    for i in range(7):
        ang = math.radians(-62 + i * 21)
        ln = rng.uniform(3.4, 5.2)
        cx = math.sin(ang) * ln * 0.5
        cz = 8.2 + math.cos(ang) * ln * 0.5
        bpy.ops.mesh.primitive_cone_add(
            vertices=6, radius1=0.30, radius2=0.06, depth=ln, location=(cx, 30, cz),
            rotation=(0, ang, 0),
        )
        bpy.context.object.data.materials.append(trunk_m)
    # Halo shells: a few big, very faint emissive spheres BEHIND the canopy do
    # the blooming in-scene. (The compositor Glare node renders empty in 5.x
    # background mode — the node group's input isn't fed the render result —
    # so the glow is built from geometry instead of a post pass.)
    # No baked halo. Three bakes were tried and each banded: uniform-alpha
    # spheres gave hard 'onion' shells, facing-driven alpha inverted into bright
    # concentric outlines, and a gradient billboard left a visible quad seam
    # (Generated coords on a plane put the spherical falloff off-centre). The
    # bloom is a CSS radial-gradient layer instead (styles/combat.css
    # .backdrop::after) — perfectly smooth, costs no bytes, inherits the accent
    # colour, and can pulse. Blender bakes the geometry; CSS does the light.
    # canopy: clustered emissive blobs — a luminous crown, not a hard disc.
    for i in range(16):
        a = rng.uniform(0, math.tau)
        r = rng.uniform(0.2, 3.6)
        x = math.cos(a) * r
        z = 11.6 + math.sin(a) * r * 0.62
        rad = rng.uniform(1.5, 2.9)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=rad, location=(x, 30.6, z), segments=16, ring_count=10)
        ob = bpy.context.object
        ob.scale = (1.0, 0.55, 0.8)
        ob.data.materials.append(mat(f"can{i}", glow, emit=rng.uniform(1.1, 2.2), alpha=0.5))


def embers(scene, glow, rng):
    for _ in range(55):
        bpy.ops.mesh.primitive_ico_sphere_add(
            radius=rng.uniform(0.035, 0.12), subdivisions=1,
            location=(rng.uniform(-20, 20), rng.uniform(5, 26), rng.uniform(-2, 15)),
        )
        bpy.context.object.data.materials.append(mat("em", glow, emit=rng.uniform(3.0, 7.0)))


def haze(scene, colour):
    """Transparent emissive sheets → cheap aerial perspective between ridges."""
    for i, y in enumerate([28, 21, 14, 8]):
        bpy.ops.mesh.primitive_plane_add(size=110, location=(0, y, 2), rotation=(math.radians(90), 0, 0))
        bpy.context.object.data.materials.append(
            mat(f"haze{i}", colour, emit=0.55, alpha=0.10 + i * 0.016)
        )


def _set(node, socket, value):
    """Best-effort socket/property set — the glare params moved to input
    sockets in Blender 5.x, and are plain properties on older builds."""
    try:
        node.inputs[socket].default_value = value
        return
    except Exception:
        pass
    for attr in (socket.lower(), f"glare_{socket.lower()}"):
        try:
            setattr(node, attr, value)
            return
        except Exception:
            pass


def glare(scene):
    """Compositor bloom — EEVEE Next has no bloom toggle, so glare blooms the
    emissive canopy/embers. Blender 5.x moved compositing to a node GROUP
    (scene.compositing_node_group, Group In/Out, no Composite node); older
    builds use scene.node_tree with Render Layers → Composite."""
    if hasattr(scene, "compositing_node_group"):
        ng = bpy.data.node_groups.new("Backdrop Comp", "CompositorNodeTree")
        ng.interface.new_socket("Image", in_out="INPUT", socket_type="NodeSocketColor")
        ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        gi = ng.nodes.new("NodeGroupInput")
        go = ng.nodes.new("NodeGroupOutput")
        gl = ng.nodes.new("CompositorNodeGlare")
        _set(gl, "Threshold", 0.55)
        _set(gl, "Size", 8)
        _set(gl, "Strength", 0.55)
        ng.links.new(gi.outputs[0], gl.inputs["Image"])
        ng.links.new(gl.outputs["Image"], go.inputs[0])
        scene.compositing_node_group = ng
        return
    scene.use_nodes = True
    nt = scene.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new("CompositorNodeRLayers")
    gl = nt.nodes.new("CompositorNodeGlare")
    _set(gl, "Threshold", 0.55)
    _set(gl, "Size", 8)
    comp = nt.nodes.new("CompositorNodeComposite")
    nt.links.new(rl.outputs["Image"], gl.inputs["Image"])
    nt.links.new(gl.outputs["Image"], comp.inputs["Image"])


def build(act):
    cfg = ACTS[act]
    rng = random.Random(cfg["seed"])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = RES_X, RES_Y
    scene.render.film_transparent = False

    world_gradient(scene, cfg["sky"], cfg["haze"])
    # Far → near, each wall a touch brighter so depth reads without lighting.
    for i, (y, h, mul) in enumerate([(36, 10.0, 2.5), (27, 8.0, 1.8), (19, 6.5, 1.2), (11, 5.2, 0.72)]):
        shade = tuple(min(1.0, c * mul) for c in cfg["sky"])
        ridge(scene, y, h, i * 1.9, shade, rng)
    goldbough(scene, cfg["glow"], rng)
    embers(scene, cfg["glow"], rng)
    haze(scene, cfg["haze"])
    # NOTE: no compositor pass — see goldbough(); the glow is geometry.

    cam_d = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_d)
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.location = (0, -7, 6.0)
    cam.rotation_euler = (math.radians(87), 0, 0)
    cam_d.lens = 32

    scene.render.image_settings.file_format = "WEBP"
    try:
        scene.render.image_settings.quality = 82
    except Exception:
        pass
    scene.render.filepath = os.path.join(OUT, f"bg_act{act}.webp")
    bpy.ops.render.render(write_still=True)
    print("WROTE", scene.render.filepath)


for a in (1, 2, 3):
    build(a)
