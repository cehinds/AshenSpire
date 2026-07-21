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


def srgb_to_oklab(r, g, b):
    """sRGB (0..1) -> Oklab. Euclidean distance here is perceptual.

    Oklab rather than CIE Lab (Vira's call, and she measured it): CIE76 is poor
    at low chroma, and these armour sets are dark desaturated neutrals — exactly
    where it flatters. She found RGB overstating separation by 20% for the same
    reason. Not CIEDE2000: ~60 lines of hue-rotation special cases nobody in
    this repo can audit. A metric you cannot check is a claim, not a check.
    """
    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = lin(r), lin(g), lin(b)
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s_ = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s_,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s_,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s_)


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
    return srgb_to_oklab(acc[0] / n, acc[1] / n, acc[2] / n)


def dist(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def lch(lab):
    """Oklab -> (L, C, h°). Separating the channels is the whole point.

    Bjorn's finding, from looking at the sprites rather than at the numbers: the
    pairs that read as two different suits differ in HUE; the pair that reads as
    one suit under two lights differs only in lightness and chroma within one
    hue. A scalar dE adds those as one currency. Perceptually they are not one
    currency — a hue shift says 'different object', a lightness shift says 'same
    object, differently lit'.

    Which makes a scalar floor gameable in exactly the way Vira's ratio was:
    you pass it by making one set darker, manufacturing the very failure the
    test exists to prevent, while the test goes green.
    """
    L, a, b = lab
    return L, math.hypot(a, b), math.degrees(math.atan2(b, a))


def dhue(a, b):
    """Absolute hue difference in degrees, wrapped to 0..180."""
    d = abs(lch(a)[2] - lch(b)[2]) % 360.0
    return 360.0 - d if d > 180.0 else d


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

    print("\n=== CHANNEL DECOMPOSITION of each class's tightest pair ===")
    print("    (dL lightness, dC chroma, dh hue angle — a scalar dE adds these as")
    print("     one currency, and Bjorn's eyes say they are not one currency)")
    decomp = {}
    for cls in sorted(by_class):
        sets = by_class[cls]
        ids = sorted(sets)
        pr = min(((dist(sets[a], sets[b]), a, b) for i, a in enumerate(ids)
                  for b in ids[i + 1:]), key=lambda t: t[0])
        _, a, b = pr
        la, ca, _ = lch(sets[a])
        lb, cb, _ = lch(sets[b])
        dh = dhue(sets[a], sets[b])
        decomp[cls] = {"pair": [a, b], "dE": pr[0], "dL": abs(la - lb),
                       "dC": abs(ca - cb), "dHueDeg": dh}
        print(f"    {cls:9} {a:11} vs {b:11}  dE {pr[0]:.4f}   "
              f"dL {abs(la - lb):.4f}  dC {abs(ca - cb):.4f}  dh {dh:6.1f}deg")

    print("\n=== BETWEEN CLASSES (silhouettes differ — palette carries little) ===")
    clss = sorted(by_class)
    for i, ca in enumerate(clss):
        for cb in clss[i + 1:]:
            # centroid of each class's rendered sets
            def cent(c):
                v = list(by_class[c].values())
                return [sum(x[k] for x in v) / len(v) for k in range(3)]
            print(f"    {dist(cent(ca), cent(cb)):6.1f}   {ca} / {cb}")

    def cent2(c):
        v = list(by_class[c].values())
        return [sum(x[k] for x in v) / len(v) for k in range(3)]

    tightest_within = min(dist(by_class[c][a], by_class[c][b])
                          for c in by_class
                          for i, a in enumerate(sorted(by_class[c]))
                          for b in sorted(by_class[c])[i + 1:])
    closest_between = min(dist(cent2(ca), cent2(cb))
                          for i, ca in enumerate(clss) for cb in clss[i + 1:])

    print(f"\nTIGHTEST WITHIN-CLASS PAIR : {tightest_within:.4f}   ({worst[1]}: {worst[2]} vs {worst[3]})")
    print(f"CLOSEST BETWEEN-CLASS PAIR : {closest_between:.4f}  (context only)")
    print("  RETRACTED: `tightest-within > closest-between` was proposed as an invariant")
    print("  and is WRONG. Vira solved for its ceiling — unbounded. An optimiser maximises")
    print("  it by painting all three classes the same colour, driving the denominator to")
    print("  zero, then spreading each class freely. Satisfied by destroying the thing the")
    print("  game needs. The flaw is the ratio form: same-class pairs are separated by")
    print("  COLOUR and cross-class pairs by SILHOUETTE, so the two numbers never")
    print("  constrained each other, and a ratio invents a relationship to exploit.")
    print("  The absolute within-class floor is the real instrument. See test 34.")

    # tightest/closest is printed above as a diagnostic and deliberately NOT
    # returned into the manifest. Vira solved for its ceiling: unbounded, and
    # maximised by painting all three classes identical. A number recorded in an
    # artifact is an invitation to assert it later; this one is malformed for
    # every threshold. The absolute floor is the real instrument.
    return {
        "tightestPairChannels": decomp,
        "withinClassMin": {c: min(dist(by_class[c][a], by_class[c][b])
                                  for i, a in enumerate(sorted(by_class[c]))
                                  for b in sorted(by_class[c])[i + 1:])
                           for c in by_class},
    }


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:]
    _out = os.path.abspath(argv[0] if argv else "assets/equipment")
    with open(os.path.join(_out, "manifest.json"), encoding="utf-8") as fh:
        measure(_out, json.load(fh))
