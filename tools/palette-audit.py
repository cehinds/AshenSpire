# tools/palette-audit.py — how far apart do the armour sets actually LOOK?
#
#   blender --background --factory-startup --python tools/palette-audit.py -- assets/equipment
#
# Vira measured the palette distances in outfits.csv. I accepted them. Bjorn
# pointed out that a capture proves you looked, not what you looked for — and
# the same trap has a deeper floor here:
#
#   The CSV hex is the INPUT. What reaches the eye is that colour through a warm
#   key light, a cool rim, a hero rim at 2.6, and the Standard view transform.
#   Measuring the source is measuring the adjacent thing.
#
# So this reads the rendered pixels. It also measures the comparison that
# actually matters, which is not the one either of us ran: WITHIN a class the
# geometry is identical (one builder, four repaints), so palette is the only
# differentiator. BETWEEN classes the silhouettes differ completely — plate and
# helm, robe and wide hat, hood and halo — so palette carries almost nothing.

import bpy
import json
import math
import os
import sys

# Importable: tools/equipment-blender.py execs this and calls measure() straight
# after rendering, so the numbers are produced by the SAME run that produced the
# images. A separate audit pass could be forgotten, and a stale number is worse
# than none — it reads like a check while asserting nothing about what shipped.


def to_srgb(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055


def srgb_to_lab(r, g, b):
    """sRGB (0..1) -> CIE Lab, D65. CIE76 distance in this space is euclidean."""
    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = lin(r), lin(g), lin(b)
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 1.00000
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883

    def f(t):
        return t ** (1 / 3) if t > 0.008856 else (7.787 * t) + (16 / 116)
    fx, fy, fz = f(x), f(y), f(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def body_lab(path):
    """Mean Lab of the figure's opaque pixels — what the eye actually integrates.

    Weighted by alpha and skipping near-transparent edge pixels, so antialiased
    fringe against nothing doesn't drag every set toward the same grey.
    """
    img = bpy.data.images.load(path)
    px = list(img.pixels)  # flat RGBA, linear, bottom-up
    bpy.data.images.remove(img)
    n = 0
    acc = [0.0, 0.0, 0.0]
    # Every 4th pixel is plenty at 450x570 and keeps this quick.
    for i in range(0, len(px), 16):
        a = px[i + 3]
        if a < 0.9:
            continue
        acc[0] += to_srgb(min(1.0, max(0.0, px[i])))
        acc[1] += to_srgb(min(1.0, max(0.0, px[i + 1])))
        acc[2] += to_srgb(min(1.0, max(0.0, px[i + 2])))
        n += 1
    if not n:
        return None
    return srgb_to_lab(acc[0] / n, acc[1] / n, acc[2] / n)


def dist(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def measure(OUT, manifest, verbose=True):
    labs = {}
    for key, entry in manifest["armour"].items():
        path = os.path.join(OUT, entry["files"][0])
        if not os.path.exists(path):
            print("MISSING", path)
            continue
        lab = body_lab(path)
        if lab:
            labs[key] = lab

    by_class = {}
    for key, lab in labs.items():
        cls, sid = key.split("/")
        by_class.setdefault(cls, {})[sid] = lab

    print("\n=== WITHIN CLASS (geometry identical — palette is the ONLY signal) ===")
    worst = None
    for cls in sorted(by_class):
        sets = by_class[cls]
        ids = sorted(sets)
        pairs = []
        for i, a in enumerate(ids):
            for b in ids[i + 1:]:
                pairs.append((dist(sets[a], sets[b]), a, b))
        pairs.sort()
        print(f"\n{cls}:  min ΔE {pairs[0][0]:.1f}  ({pairs[0][1]} vs {pairs[0][2]})")
        for d, a, b in pairs:
            print(f"    {d:6.1f}   {a} / {b}")
        if worst is None or pairs[0][0] < worst[0]:
            worst = (pairs[0][0], cls, pairs[0][1], pairs[0][2])

    print("\n=== BETWEEN CLASSES (silhouettes differ — palette carries little) ===")
    clss = sorted(by_class)
    for i, ca in enumerate(clss):
        for cb in clss[i + 1:]:
            # centroid of each class's rendered sets
            def cent(c):
                v = list(by_class[c].values())
                return [sum(x[k] for x in v) / len(v) for k in range(3)]
            print(f"    {dist(cent(ca), cent(cb)):6.1f}   {ca} / {cb}")

    print(f"\nWORST WITHIN-CLASS PAIR: ΔE {worst[0]:.1f} — {worst[1]} {worst[2]} vs {worst[3]}")
    print("Reference: ΔE ~2.3 is a just-noticeable difference; ~10 is clearly distinct.")

    return {
        "withinClassMinDeltaE": {c: min(dist(by_class[c][a], by_class[c][b])
                                        for i, a in enumerate(sorted(by_class[c]))
                                        for b in sorted(by_class[c])[i + 1:])
                                 for c in by_class},
    }


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:]
    _out = os.path.abspath(argv[0] if argv else "assets/equipment")
    with open(os.path.join(_out, "manifest.json"), encoding="utf-8") as fh:
        measure(_out, json.load(fh))
