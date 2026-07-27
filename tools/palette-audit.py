# tools/palette-audit.py — how far apart do the armour sets actually LOOK?
#
#   blender --background --factory-startup --python tools/palette-audit.py -- assets/equipment
#
# +--------------------------------------------------------------------------------+
# | READ THIS BEFORE YOU BELIEVE A NUMBER THIS FILE PRODUCED.                      |
# |                                                                                |
# | EVERY COLOUR NUMBER THIS TOOL HAS EVER EMITTED CAME THROUGH A DOUBLED GAMMA.   |
# |                                                                                |
# | body_lab() calls to_srgb() on values that are already sRGB-encoded, so the     |
# | sRGB transfer function is applied twice before srgb_to_oklab() undoes it once. |
# | Everything in assets/equipment/manifest.json - every withinClassMin, every     |
# | dL/dC/dHueDeg, every hue verdict - describes a lighter, desaturated picture    |
# | that no player has ever seen. Diagnosed 2026-07-27 with re-runnable evidence   |
# | (`bash tools/palette-check.sh`, checks D1a/D1b/D2b). NOT FIXED, on purpose:    |
# | see "THE ONE LINE I DID NOT TOUCH" below, which names exactly what has to be   |
# | true before anyone edits it. Do not edit it before then.                       |
# +--------------------------------------------------------------------------------+
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

# ── TWO DEFECTS FOUND 2026-07-27, both with re-runnable evidence ──────────────
#
# Commit 40c5b21 stopped a repaint with "the metric measures hue where hue is
# invalid" and did not build the instrument that would prove it. It is now built:
# tools/palette-probe.html + tools/palette-check.sh, 20 declared checks, no
# Blender required (it decodes the shipped .webp with the same decoder the game
# uses). Run `bash tools/palette-check.sh`. It found the named defect and one
# more nobody had named:
#
#   1. HUE AT INVALID CHROMA — real, and fixed below. dhue() had no chroma guard,
#      so it reported an angle between two neutrals as if it meant something. The
#      shipped manifest records dHueDeg=133.05 for starseer default|eclipse, whose
#      chromas are 0.018 and 0.008 — both under Vira's 0.03 guard. dhue() now
#      REFUSES rather than returning a number that cannot be interpreted.
#
#   2. THE COLOUR PIPELINE — NOT fixed here, deliberately. See the banner at the
#      top of this file. Evidence, all observed on 2026-07-27 by
#      `bash tools/palette-check.sh` and quoted from that run, not from memory:
#
#        - the double-encode model reproduces all three of the manifest's
#          withinClassMin to 0.04%, 0.01% and 0.04% (herald, reaver, starseer)
#          and names the SAME tightest pair in all three classes (D1b);
#        - measuring the same shipped .webp straight, in browser sRGB, misses by
#          37.9% / 34.3% / 29.7% and names a DIFFERENT tightest pair for herald
#          (D1a);
#        - one figure, starseer/starlit, is pushed across the chroma guard by the
#          encode alone (D2b) — so the commit's "3 of 12 below guard" is a fact
#          about this pipeline, not about the art, which gives 2 of 12;
#        - the hue angle of a single figure moves up to 15.3deg between the two
#          pipelines (D4c).
#
#      MAGNITUDE, CORRECTED 2026-07-27 — I first wrote "~27% low chroma
#      EVERYWHERE". The number was fine; the word was the defect. Recomputed by
#      the probe from its own twelve figures (no longer a literal I typed once):
#      chroma is low by a MEDIAN of 27.6%, RANGE 18.9% (starseer/default) to
#      51.8% (starseer/starlit). So "~27%" describes the median honestly and
#      "everywhere" hides a 2.7x spread — and that spread is precisely the
#      mechanism that pushes starseer/starlit across the chroma guard on the
#      encode alone. The one word I chose for tidiness concealed the one fact
#      that mattered most. I also mis-stated this correction on the first pass,
#      quoting 28.0% / 18.8% from the run's 4-decimal printout instead of the
#      full-precision values; these figures come from the probe's own arithmetic.
#
#      NOT FIXED because there is no Blender in the environment that found this,
#      so the corrected pipeline could not be run end to end. A blind edit to the
#      one line that produced every number in the manifest is exactly the "third
#      instrument on a hunch" 40c5b21 was right to refuse. The gate above fails
#      until it is fixed and the assets re-measured, so it cannot be forgotten.
#
# ── THE ONE LINE I DID NOT TOUCH, AND WHAT WOULD MAKE TOUCHING IT SAFE ────────
#
# The line: the three `acc[i] += to_srgb(...)` calls in body_lab(). The fix is
# almost certainly to delete the to_srgb() wrapper and accumulate the linear
# values bpy hands back — but "almost certainly" is not a licence to edit the
# line that produced every number in the shipped manifest.
#
# Cited by FUNCTION NAME, never by line number, on purpose: the refs that were
# correct at 40c5b21 (`to_srgb` at :31-32, the acc lines at :71-73, `dhue` at
# :102-105) were all invalidated by this very commit's own edits to the file
# above them. A line ref is a second copy of a fact with nothing checking the two
# agree. Function names do not drift.
#
# FOUR THINGS MUST BE TRUE BEFORE ANYONE EDITS IT. All four, not a majority:
#
#   1. A BLENDER THAT CAN RUN THIS. The whole diagnosis rests on what bpy returns
#      from `img.pixels` for a .webp — the comment above the loop asserts LINEAR
#      and the reproduction says otherwise. That is a claim about Blender, and it
#      is settled by running Blender, not by reading. Print one known pixel of a
#      known asset and compare it to the browser's decode of the same pixel.
#      Until then the DIRECTION of the fix is inferred, only the EFFECT is
#      measured. Both edges: check a near-black pixel (where the linear segment
#      c <= 0.0031308 applies) and a bright one, because the two branches of
#      to_srgb() fail differently and a mid-grey test passes either way.
#
#   2. A REGENERATE, NOT A RE-READ. Fixing this changes every number in
#      assets/equipment/manifest.json. The manifest must be rewritten by the same
#      run that renders the images (measure() is called from
#      tools/equipment-blender.py for exactly this reason). A fixed body_lab()
#      beside a stale manifest is strictly worse than today: today the numbers
#      are wrong and the file says so.
#
#   3. THE GATE MUST FLIP FOR THE RIGHT REASON. After the fix,
#      `bash tools/palette-check.sh` must fail at D1b — the double-encode model
#      must STOP reproducing the manifest. If D1b still passes, the fix did not
#      reach the numbers that ship. Delete D1a/D1b/D2b then; do not retune them.
#
#   4. TEST 34 MUST BE RE-READ, NOT RE-RUN. It is the only consumer of these
#      numbers. Probe D12 measured that every class clears its 0.005 floor in
#      BOTH pipelines and that the audit's numbers are the LOWER pair (1.34x), so
#      the defect makes test 34 fire EARLY, not late. That is why this is not a
#      shipping emergency — and also why nobody may treat a green test 34 as
#      evidence the colour pipeline is fine. Its margin is thinner than it looks.
#
# Whoever does this owns all four. It is not mine: I cannot run Blender and I
# will not claim a pipeline works because I meant it to.
#
# ── REMOVAL CONDITION (SOP 1's corollary) ─────────────────────────────────────
#
# This file is deleted, without a table, when ANY of these holds:
#
#   1. Nothing consumes its output. Today exactly one thing does — test 34, via
#      assets/equipment/manifest.json. If test 34 stops reading withinClassMin,
#      this tool measures something nobody asks about and it goes.
#   2. A masked, per-pixel instrument replaces it. This file's own method block
#      says the whole-figure mean is the wrong instrument, and probe D7b measured
#      that it disagrees with a per-pixel measure of the same images about which
#      pair is closest in 2 of 3 classes. When the better instrument exists, this
#      one is not kept for comparison — a superseded metric still in the tree is
#      a second answer to one question.
#   3. `--selfcheck` stops being able to fail. Invert any one `ok()` predicate; if
#      the exit status stays 0, the corpus is decoration.
#   4. Constantine's one word.
#
# The double-gamma defect is deliberately NOT a removal condition. Fixing it
# makes this file correct, not unnecessary.
# ──────────────────────────────────────────────────────────────────────────────

try:
    import bpy
except ImportError:  # --selfcheck exercises the pure maths with no Blender present
    bpy = None
import json
import math
import os
import sys

# Vira's guard, cited in 40c5b21: below this Oklab chroma, hue angle is noise.
# Not a taste call — the probe measures the consequence (check D4a): under a 1-LSB
# decode difference the reported hue angle of the lowest-chroma figure moves 6.6x
# further than the highest-chroma figure's, because dh ~ da/C.
CHROMA_GUARD = 0.03

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
    # SUSPECT COMMENT, left in place and labelled rather than corrected: this
    # "linear" is the assertion that justifies the to_srgb() calls below, and the
    # probe's D1b reproduction says it is wrong (see the banner at the top of the
    # file). I did not silently reword it, because the wrong comment beside the
    # wrong code is the evidence of how the defect got in; deleting it would leave
    # the bug with no explanation. It gets corrected by whoever runs Blender.
    px = list(img.pixels)  # flat RGBA, ASSERTED linear, bottom-up  <-- see D1b
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
    """Absolute hue difference in degrees wrapped to 0..180, or None if undefined.

    Hue is an angle about the neutral axis, so it is undefined for a colour ON that
    axis and noise near it. This returns None when either colour's chroma is under
    CHROMA_GUARD, because there is no honest number to return.

    It refuses rather than offering an unguarded variant on purpose. The previous
    version always returned a float, and the manifest duly recorded 133.05 degrees
    between two figures at chroma 0.018 and 0.008 — a number that reads like a
    measurement and licenses nothing. One function, one meaning: a caller that
    wants the raw angle has to say so and handle the None.
    """
    ca, cb = lch(a)[1], lch(b)[1]
    if ca < CHROMA_GUARD or cb < CHROMA_GUARD:
        return None
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
        # dHueDeg is None when the guard fired. It stays None in the manifest rather
        # than being filled with a placeholder: a number recorded in an artifact is an
        # invitation to assert it later, and this is the assertion we are refusing.
        verdict = ("VALID" if dh is not None else
                   f"HUE_INVALID chroma {min(ca, cb):.4f} below guard {CHROMA_GUARD}")
        decomp[cls] = {"pair": [a, b], "dE": pr[0], "dL": abs(la - lb),
                       "dC": abs(ca - cb), "dHueDeg": dh, "hueVerdict": verdict}
        shown = f"{dh:6.1f}deg" if dh is not None else "  ---- (HUE_INVALID)"
        print(f"    {cls:9} {a:11} vs {b:11}  dE {pr[0]:.4f}   "
              f"dL {abs(la - lb):.4f}  dC {abs(ca - cb):.4f}  dh {shown}")
        if dh is None:
            print(f"      ^ chroma {min(ca, cb):.4f} < {CHROMA_GUARD}: these two figures are"
                  " effectively neutral, so no hue claim is available about this pair.")

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
    # METHOD, recorded beside the numbers. Bjorn published three decimals he
    # could not regenerate a day later, because the method lived only in the
    # script that produced them: "a number without its method is an opinion with
    # decimal places." His re-measurement came out ~1.5x higher with the
    # ordering INVERTED, purely from alpha threshold / sample stride / averaging
    # order differing. Anyone comparing against these figures needs to know they
    # were made the same way.
    return {
        "method": {
            "space": "Oklab (CIE76-style euclidean)",
            "source": "rendered pixels of body_<class>_<set>.webp",
            "alphaMin": 0.9,
            "sampleStride": "every 4th pixel (16 floats)",
            "averaging": "mean of sRGB over opaque pixels, THEN convert to Oklab",
            "note": "measures the WHOLE figure, so shared unpainted surfaces "
                    "(the reaver's always-gold cape) dilute it; a masked render "
                    "is the correct instrument and is not built",
            # Measured 2026-07-27 by tools/palette-probe.html, which needs no Blender.
            "colorspaceSuspect": True,
            "colorspaceNote": "body_lab applies to_srgb() to values that are already "
                              "sRGB-encoded (double gamma). Reproduced to 0.04% on all "
                              "three classes: probe checks D1a/D1b. Chroma here is low by "
                              "a median of 27.6% vs what the browser shows, range 18.9-51.8% "
                              "across the twelve figures — systematic but NOT uniform, "
                              "which is why one figure crosses the chroma guard on the "
                              "encode alone (D2b). Numbers in this block describe a "
                              "desaturated picture, not the game's.",
            "capabilities": "supports: is this pair separated at all, in lightness. "
                            "does NOT support: any hue claim below chroma "
                            f"{CHROMA_GUARD}, any claim about WHICH pair is closest "
                            "(the whole-figure mean disagrees with a per-pixel measure "
                            "of the same images in 2 of 3 classes: probe D7b), or any "
                            "claim that a repaint happened (probe D8: a total hue "
                            "inversion of a shipped asset reads as 0.44x the tightest "
                            "real pair).",
            "gate": "bash tools/palette-check.sh",
        },
        "tightestPairChannels": decomp,
        "withinClassMin": {c: min(dist(by_class[c][a], by_class[c][b])
                                  for i, a in enumerate(sorted(by_class[c]))
                                  for b in sorted(by_class[c])[i + 1:])
                           for c in by_class},
    }


def selfcheck():
    """Exercise the pure maths against a known-bad corpus. No Blender needed.

        python3 tools/palette-audit.py --selfcheck

    Exits non-zero on any failure. Every case below is a defect this file has
    actually shipped or been warned about, turned into something that fails on its
    own rather than a paragraph asking a reader to be careful.

    Boundary, stated because an empty one is a stamp: this covers srgb_to_oklab,
    lch, dhue and dist. It does NOT cover body_lab, which needs bpy — so the
    double-encode defect in the header is NOT covered here. That one is checked by
    tools/palette-check.sh against the shipped .webp files.
    """
    fails = []

    def ok(name, cond, detail=""):
        print(f"  {'pass' if cond else 'FAIL'}  {name}{'  ' + detail if detail else ''}")
        if not cond:
            fails.append(name)

    print("srgb_to_oklab against published Oklab values for the sRGB primaries")
    # Ottosson's reference values. Validate the transform BEFORE trusting anything
    # derived from it — a decoder that was never checked is a claim, not a check.
    for name, rgb, want in [
        ("white", (1, 1, 1), (1.0000, 0.0000, 0.0000)),
        ("black", (0, 0, 0), (0.0000, 0.0000, 0.0000)),
        ("red", (1, 0, 0), (0.6279, 0.2249, 0.1258)),
        ("green", (0, 1, 0), (0.8664, -0.2339, 0.1795)),
        ("blue", (0, 0, 1), (0.4520, -0.0324, -0.3117)),
    ]:
        got = srgb_to_oklab(*rgb)
        ok(f"oklab({name})", all(abs(g - w) < 5e-4 for g, w in zip(got, want)),
           f"got {tuple(round(v, 4) for v in got)} want {want}")

    print("neutrals: hue is undefined, and the guard must say so rather than guess")
    # KB1 — the shipped defect. Two near-neutrals whose raw hue angle is enormous.
    n1 = srgb_to_oklab(0.235, 0.235, 0.240)
    n2 = srgb_to_oklab(0.240, 0.236, 0.233)
    raw = abs(lch(n1)[2] - lch(n2)[2]) % 360.0
    raw = 360.0 - raw if raw > 180.0 else raw
    ok("two neutrals -> dhue is None", dhue(n1, n2) is None,
       f"chromas {lch(n1)[1]:.4f}/{lch(n2)[1]:.4f}, raw angle would have been {raw:.1f}deg")
    ok("a neutral vs a saturated colour -> None",
       dhue(n1, srgb_to_oklab(0.8, 0.1, 0.1)) is None)

    print("saturated colours: the guard must NOT suppress a real hue difference")
    # KB2 — both edges of the guard. It has to stay silent AND it has to still speak.
    s1, s2 = srgb_to_oklab(0.78, 0.16, 0.16), srgb_to_oklab(0.16, 0.35, 0.78)
    d = dhue(s1, s2)
    ok("red vs blue -> a real angle", d is not None and d > 90, f"{d:.1f}deg" if d else "None")
    ok("a colour against itself -> 0deg",
       (lambda v: v is not None and v < 1e-9)(dhue(s1, s1)))

    print("wraparound: 350deg and 10deg are 20deg apart, not 340deg")
    # KB3 — the modulo. Cheap to get wrong, silent when wrong.
    import cmath
    def at(angle_deg, C=0.12, L=0.6):
        z = cmath.rect(C, math.radians(angle_deg))
        return (L, z.real, z.imag)
    w = dhue(at(350), at(10))
    ok("dhue(350, 10) == 20", w is not None and abs(w - 20) < 1e-6, f"{w}")
    w2 = dhue(at(10), at(350))
    ok("and it is symmetric", w2 is not None and abs(w2 - w) < 1e-9)

    print("the gameable scalar, from this file's own warning at lch()")
    # KB4 — palette-audit.py's docstring warns a scalar floor is passed by making one
    # set darker. That warning is now a test: darkening must raise dE while leaving hue
    # untouched, so anyone who proposes a scalar floor can see the hole first.
    base = srgb_to_oklab(0.35, 0.42, 0.30)
    dark = srgb_to_oklab(0.35 * 0.7, 0.42 * 0.7, 0.30 * 0.7)
    hue_moved = dhue(base, dark)
    ok("darkening raises dE", dist(base, dark) > 0.10, f"dE {dist(base, dark):.4f}")
    ok("darkening does not move hue", hue_moved is not None and hue_moved < 3.0,
       f"{hue_moved:.2f}deg" if hue_moved is not None else "None (chroma too low)")

    print("the aggregate is blind to the distribution (why body_lab's mean is not a summary)")
    # KB5 — the mean-of-pixels defect in miniature: a two-colour figure and a flat
    # figure of its mean are the same point to this metric. Same argument as probe D5,
    # in pure maths so it runs with no browser either.
    def body_lab_of(pixels):
        """body_lab's aggregation, minus bpy: mean the sRGB values, THEN convert."""
        m = tuple(sum(p[i] for p in pixels) / len(pixels) for i in range(3))
        return srgb_to_oklab(*m)

    def per_pixel_median(pa, pb):
        """The same two pixel populations, differenced pointwise instead of averaged."""
        ds = sorted(dist(srgb_to_oklab(*x), srgb_to_oklab(*y)) for x, y in zip(pa, pb))
        return ds[len(ds) // 2]

    red_green = [(0.996, 0.0, 0.0), (0.0, 0.996, 0.0)] * 8
    olive = tuple(sum(p[i] for p in red_green) / len(red_green) for i in range(3))
    flat = [olive] * len(red_green)
    agg = dist(body_lab_of(red_green), body_lab_of(flat))
    pp = per_pixel_median(red_green, flat)
    # Both halves can fail: the first if the aggregation ever stops collapsing them,
    # the second if per_pixel_median ever stops seeing what the aggregate misses.
    ok("aggregate cannot tell a red/green field from a flat olive one", agg < 1e-9,
       f"aggregate dE {agg:.2e}")
    ok("a per-pixel measure of the SAME two populations sees it plainly", pp > 0.20,
       f"per-pixel median dE {pp:.4f} = {pp / max(agg, 1e-12):.0e}x the aggregate")

    print()
    if fails:
        print(f"SELFCHECK FAIL — {len(fails)} case(s): {', '.join(fails)}")
        return 1
    print("SELFCHECK PASS")
    print("BOUNDARY: pure maths only (srgb_to_oklab, lch, dhue, dist). body_lab and the")
    print("          double-encode defect in this file's header are NOT covered here —")
    print("          run `bash tools/palette-check.sh` for those.")
    return 0


def source_audit(csv_path):
    """Per-material palette distances straight from content/source/outfits.csv.

        python3 tools/palette-audit.py --source-audit

    WHY, given this file's own header says measuring the source is measuring the
    adjacent thing — which is true and still true. This does not answer "do two sets
    READ as two suits"; only an eye at in-game size answers that. It answers a
    narrower question the rendered metric cannot answer at all: "did a repaint move
    one set's authored palette on top of another's." For that, source hex is the
    RIGHT instrument, because it is the only one free of the render pipeline, the
    whole-figure mean, and the double-encode defect in this file's header — three
    things that each move the answer. It is also the only check here that needs
    neither Blender nor a browser.

    Exits non-zero if a class's tightest pair collides on EVERY material, which is
    the shape of "these two sets were painted the same" rather than "these two sets
    happen to share a colour".
    """
    import csv as _csv
    MATS = ["plate", "plateLt", "leather", "under"]

    def hex_lab(hx):
        v = [int(hx[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        return srgb_to_oklab(*v)

    with open(csv_path, encoding="utf-8") as fh:
        rows = list(_csv.DictReader(l for l in fh if not l.startswith("#")))
    by_cls = {}
    for r in rows:
        by_cls.setdefault(r["classId"], {})[r["id"]] = r

    # The verdict below is deliberately THRESHOLD-FREE, because the obvious threshold
    # is not safe here: reaver default|warden's best-separated material is 0.079, so a
    # floor of 0.08 fails it and 0.075 passes it, and no evidence in this repo picks
    # between those. What does not depend on a threshold is the RANKING: if one pair is
    # the closest pair on most of the materials independently, that is the shape of two
    # sets painted alike, not of two sets that happen to share one colour. A floor is
    # still printed, as context, with its sensitivity stated.
    FLOOR = 0.08
    worst = []
    for cls in sorted(by_cls):
        sets = by_cls[cls]
        ids = sorted(sets)
        print(f"\n=== {cls} — authored palettes, per material (outfits.csv) ===")
        for sid in ids:
            r = sets[sid]
            bits = []
            for m in MATS:
                L, C, H = lch(hex_lab(r[m]))
                bits.append(f"{m}={r[m]} h{H:7.1f} C{C:.3f}")
            print(f"  {sid:11} {r['name']:18} " + "  ".join(bits))
        pairs = []
        for i, a in enumerate(ids):
            for b in ids[i + 1:]:
                ds = {m: dist(hex_lab(sets[a][m]), hex_lab(sets[b][m])) for m in MATS}
                pairs.append((min(ds.values()), max(ds.values()), a, b, ds))
        pairs.sort(key=lambda t: t[1])   # rank by the BEST-separated material
        # Per material, which pair is the closest, and by what factor over the runner-up.
        rank1 = {}
        for m in MATS:
            order = sorted(pairs, key=lambda t: t[4][m])
            rank1[m] = (f"{order[0][2]}|{order[0][3]}",
                        order[1][4][m] / order[0][4][m] if order[0][4][m] else float("inf"))
        print("  pairwise, ranked by the most-separated material (worst pair first):")
        for mn, mx, a, b, ds in pairs:
            marks = "".join("*" if rank1[m][0] == f"{a}|{b}" else " " for m in MATS)
            print(f"    {a:10}|{b:10} " + "  ".join(f"{m} {ds[m]:.3f}" for m in MATS)
                  + (f"   closest on: {marks}" if marks.strip() else ""))
        print("  (* = this pair is the CLOSEST pair on that material)")
        for m in MATS:
            print(f"    {m:8} closest pair {rank1[m][0]:22} ahead of runner-up by {rank1[m][1]:.1f}x")
        # The threshold-free verdict: is ONE pair the closest on a majority of materials?
        from collections import Counter
        tally = Counter(rank1[m][0] for m in MATS)
        top, hits = tally.most_common(1)[0]
        mn, mx, a, b, ds = pairs[0]
        print(f"  tightest by best-separated material: {a}|{b} at {mx:.3f}"
              f"  ({'below' if mx < FLOOR else 'clears'} a {FLOOR} floor — but that floor is"
              f" threshold-sensitive here and is NOT the verdict)")
        print(f"  VERDICT (threshold-free): {top} is the closest pair on {hits} of {len(MATS)} materials")
        if hits > len(MATS) / 2:
            worst.append(f"{cls}: {top} closest on {hits}/{len(MATS)} materials")

    print()
    print("BOUNDARY: authored hex only. This is silent on what the render, the lighting")
    print("          and the view transform do to these colours, and silent on whether")
    print("          any pair READS as two suits at in-game size — that needs an eye.")
    if worst:
        print("SOURCE AUDIT FAIL — one pair dominates the closest-pair ranking, which is the")
        print("  shape of two sets painted alike rather than two sets sharing one colour:")
        for w in worst:
            print(f"    {w}")
        return 1
    print("SOURCE AUDIT PASS — no pair is the closest on a majority of materials")
    return 0


if __name__ == "__main__":
    if "--selfcheck" in sys.argv:
        sys.exit(selfcheck())
    if "--source-audit" in sys.argv:
        _root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        sys.exit(source_audit(os.path.join(_root, "content", "source", "outfits.csv")))
    if bpy is None:
        print("This needs Blender. For the Blender-free checks: --selfcheck")
        sys.exit(2)
    argv = sys.argv[sys.argv.index("--") + 1:]
    _out = os.path.abspath(argv[0] if argv else "assets/equipment")
    with open(os.path.join(_out, "manifest.json"), encoding="utf-8") as fh:
        measure(_out, json.load(fh))
