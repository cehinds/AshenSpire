# AS-HD-040 — proposed build_rogue for tools/sprites-blender.py
#
# WHY THIS FILE IS HERE AND NOT IN tools/
# tools/** is held by lease-AS-HD-057-it-support. This seat holds
# assets/classes/** only, so this is a bounded proposal under art.md §3, not an
# edit. Whoever holds tools/** pastes the function in beside build_herald and
# adds "rogue": build_rogue to the builders map at the bottom, plus the two
# materials below next to the other module-level materials.
#
# WHY IT IS NEEDED
# tools/sprites-blender.py defines build_reaver, build_starseer and
# build_herald. There is no build_rogue anywhere in the repository, and
# tools/equipment-blender.py:408 maps "rogue": lib["build_reaver"] — the exact
# defect the full-body silhouette clause failed on. The owner ruled 2026-09-02
# that rogue is the ONE approved look of the four frozen crops, so the approved
# look is the one with no builder: it exists only as blob 8359517b.
#
# TARGET (measured from that blob — see LOOK-REFERENCE-ROGUE.md §1)
#   88.6% of the figure below v=0.3      4.0% highlights above v=0.5
#   mean value 0.153, mean saturation 0.565 — high chroma held dark
#   78.1% warm earth hue 20-80°          gold accent 0.6%
#   cool rim light 200-220° at 4.8%      (already correct in all four)
#
# NOT VERIFIED BY RENDER. Blender is not installed in this environment, so this
# has never been executed and no render has been scored against the checker.
# The geometry is derived from the reference crop by eye; the palette is derived
# from measurement. Whoever lands this must run:
#     blender --background --factory-startup --python tools/sprites-blender.py -- <out>
#     node assets/classes/check-look-conformance.mjs <out>/rogue_gold.webp
# and iterate the two materials until it passes. Treat the numbers as the gate,
# not this file.

# ---- materials to add beside the other module-level materials ---------------
# The 60-80° olive band is 10.2% of the reference and is what separates rogue's
# leather from reaver's all-steel 2.8%. Both stay dark on purpose: the approved
# look is high saturation at LOW value, so brightening these to read "green"
# breaks conformance even though the hue would be right.
ROGUE_SCALE = make_mat("rogueScale", srgb(0x3B, 0x42, 0x2A))       # h 77.5° v 0.259
ROGUE_SCALE_LT = make_mat("rogueScaleLt", srgb(0x4A, 0x53, 0x36))  # h 78.6° v 0.325


def build_rogue():
    # Restrained accent. Every other class carries a broad ACCENT_CLOTH sweep,
    # but the approved look measures gold at 0.6% — six times less than herald.
    # The player marker survives as a narrow mantle edge and the throat clasp
    # rather than a cape. See LOOK-REFERENCE-ROGUE.md §6: whether the hero-accent
    # convention outranks the approved look is an IT Manager III call, not this
    # seat's. If it does, widen this cone and expect the gold trait to fail.
    part(cone, ACCENT_CLOTH, loc=(0, 0.17, 0.74), vertices=7, radius1=0.40, radius2=0.16, depth=1.04)
    # coat: long scaled skirt, then a shorter overlay so the hem reads layered
    part(cone, ROGUE_SCALE, loc=(0, 0, 0.60), vertices=9, radius1=0.45, radius2=0.17, depth=1.24)
    part(cone, ROGUE_SCALE_LT, loc=(0, -0.02, 1.02), vertices=9, radius1=0.32, radius2=0.20, depth=0.40)
    # legs under the coat: dark, barely lit — they carry the deep-shadow share
    for side in (-1, 1):
        part(cyl, HERO_UNDER, loc=(side * 0.14, 0, 0.36), vertices=8, radius=0.095, depth=0.52)
        part(cube, NEAR_BLACK, loc=(side * 0.15, -0.03, 0.06), scale=(0.09, 0.13, 0.06))
    # torso: scaled cuirass with the chevron running down the front
    part(cube, ROGUE_SCALE, loc=(0, 0, 1.06), scale=(0.28, 0.19, 0.23))
    part(cube, ROGUE_SCALE_LT, loc=(0, -0.185, 1.10), scale=(0.055, 0.02, 0.20))
    for side in (-1, 1):
        part(cube, ROGUE_SCALE_LT, loc=(side * 0.085, -0.190, 1.00), blight=(0, side * 34, 0),
             scale=(0.030, 0.02, 0.13))
    # belt and cross-strap — leather, not metal; no buckle highlight
    part(cube, HERO_LEATHER, loc=(0, -0.02, 0.84), scale=(0.29, 0.19, 0.045))
    part(cube, HERO_LEATHER, loc=(0, -0.195, 1.06), blight=(0, 26, 0), scale=(0.035, 0.02, 0.26))
    # THE MANTLE: layered shoulder cowl falling to mid-arm. This is the shape
    # that reads as rogue at a glance and the reason its content box is the
    # widest of the four (252 px against 169-201).
    part(cone, HOOD_DARK, loc=(0, 0.01, 1.16), vertices=10, radius1=0.42, radius2=0.24, depth=0.34)
    part(cone, CLOTH_DARK, loc=(0, 0.01, 1.28), vertices=10, radius1=0.34, radius2=0.22, depth=0.22)
    for side in (-1, 1):
        part(ico, HOOD_DARK, loc=(side * 0.33, 0, 1.20), subdivisions=2, radius=0.155)
        part(cone, ROGUE_SCALE, loc=(side * 0.35, 0.01, 0.96), vertices=8, radius1=0.105, radius2=0.058, depth=0.34)
        part(cyl, HERO_LEATHER, loc=(side * 0.36, -0.02, 0.80), blight=(0, side * 6, 0), vertices=8,
             radius=0.062, depth=0.22)
    # hood: outer shell, brow ridge, and a void where the face would be.
    # Unlike herald there are NO eyes — the reference reads as an empty dark.
    part(uv, HOOD_DARK, loc=(0, 0.02, 1.46), segments=14, ring_count=10, radius=0.215)
    part(cyl, HOOD_DARK, loc=(0, -0.10, 1.48), blight=(90, 0, 0), vertices=12, radius=0.180, depth=0.05)
    part(uv, NEAR_BLACK, loc=(0, -0.085, 1.43), segments=10, ring_count=6, radius=0.145)
    part(cone, HOOD_DARK, loc=(0, 0.11, 1.63), blight=(20, 0, 0), vertices=8, radius1=0.17, radius2=0.03, depth=0.28)
    # the one gold surface: a single clasp at the throat holding the mantle shut
    part(cone, ACCENT, loc=(0, -0.215, 1.24), blight=(90, 0, 0), vertices=3, radius1=0.055, radius2=0.0, depth=0.03)
    # paired daggers, held low — reverse grip, so the blades run down past the hip
    if WITH_WEAPON:
        for side in (-1, 1):
            x = side * 0.50
            part(cube, STEEL, loc=(x, 0, 0.66), scale=(0.026, 0.012, 0.20))
            part(cone, STEEL, loc=(x, 0, 0.44), blight=(180, 0, 0), vertices=4, radius1=0.026, radius2=0.0, depth=0.10)
            part(cube, ACCENT, loc=(x, 0, 0.88), scale=(0.058, 0.020, 0.018))
            part(cyl, HERO_LEATHER, loc=(x, 0, 0.99), vertices=8, radius=0.022, depth=0.18)
