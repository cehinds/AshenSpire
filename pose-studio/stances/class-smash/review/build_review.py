from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
import hashlib

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
CLASSES = [
    ("Rogue", ROOT / "pose-studio/stances/class-smash/rogue", ""),
    ("Starseer", ROOT / "pose-studio/stances/class-smash/starseer", ""),
    ("Herald", ROOT / "pose-studio/stances/class-smash/herald", "frames/"),
]
PHASES = [
    ("01", "Stance", "01-held.png"),
    ("02", "Takeoff", "02-takeoff.png"),
    ("03", "Airborne", "03-airborne.png"),
    ("04", "Impact", "04-impact.png"),
    ("05", "Stance", "05-held.png"),
]
BG = (18, 24, 35, 255)
TILE = (27, 35, 49, 255)
ACCENT = (106, 174, 220, 255)
WHITE = (240, 244, 249, 255)
MUTED = (161, 177, 196, 255)
W, H = 400, 452
GAP = 12
PAD = 12
HEADER = 44
TARGET_BODY = 494
REVIEW_EXPOSURE_MS = 350
NOMINAL_ACTION_MS = 195
NOMINAL_SLOT_MS = 39
NOMINAL_CONTACT_MS = 117
REVIEW_BODY_HEIGHT = {"Rogue": 515, "Starseer": 508, "Herald": 480}
BASELINE = 418
def load_font(size):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/Library/Fonts/Arial.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


FONT = load_font(18)
SMALL = load_font(13)

sources = []
for name, folder, sub in CLASSES:
    prov = json.loads((folder / "provenance.json").read_text())
    reg = prov.get("registration", {})
    norm = prov.get("normalization", {})
    anchor = reg.get("groundAnchor") or prov.get("groundAnchor")
    body = reg.get("bodyHeight") or prov.get("bodyHeight")
    if not anchor or not body:
        raise ValueError(f"Missing groundAnchor/bodyHeight for {name}")
    frames = []
    for _, _, filename in PHASES:
        path = folder / sub / filename
        im = Image.open(path).convert("RGBA")
        if im.size != (1024, 1024):
            raise ValueError(f"Unexpected frame size: {path}: {im.size}")
        frames.append(im)
    sources.append({"name": name, "folder": folder, "anchor": tuple(anchor), "body": body, "review_body": REVIEW_BODY_HEIGHT[name], "frames": frames})

# Render each full, normalized source frame around its documented ground anchor.
def tile_for(si, pi):
    src = sources[si]
    canvas = Image.new("RGBA", (W, H), TILE)
    draw = ImageDraw.Draw(canvas)
    # The same target body height and baseline are used for every class. Scaling is
    # uniform and applied to the whole source canvas, preserving airborne/VFX space.
    scale = (TARGET_BODY / src["review_body"]) * (W / 1024)
    px = round(W / 2 - src["anchor"][0] * scale)
    py = round(BASELINE - src["anchor"][1] * scale)
    resized = src["frames"][pi].resize((round(1024 * scale), round(1024 * scale)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(resized, (px, py))
    draw = ImageDraw.Draw(canvas)
    draw.line((PAD, BASELINE, W-PAD, BASELINE), fill=(83, 101, 124, 255), width=1)
    # Class label remains visible on the static contact sheet and GIF.
    draw.rectangle((0, 0, W, HEADER), fill=(20, 27, 39, 255))
    draw.text((PAD, 12), src["name"], font=FONT, fill=WHITE)
    return canvas

phases = []
for pi, (num, label, _) in enumerate(PHASES):
    frame = Image.new("RGBA", (3*W + 4*GAP, H + 66), BG)
    draw = ImageDraw.Draw(frame)
    draw.rectangle((0, 0, frame.width, 54), fill=(14, 20, 30, 255))
    draw.text((PAD, 15), f"{num}  {label}", font=FONT, fill=ACCENT)
    draw.text((frame.width-PAD-260, 19), "Review timing  ·  350 ms per slot", font=SMALL, fill=MUTED)
    for si in range(3):
        x = GAP + si*(W+GAP)
        frame.alpha_composite(tile_for(si, pi), (x, 58))
    phases.append(frame.convert("RGB"))
    phases[-1].save(OUT / f"phase-{num}.png", optimize=True)

# Animated review preview; each of the five slots is held for 350 ms.
phases[0].save(OUT / "combined-review.gif", save_all=True, append_images=phases[1:], duration=REVIEW_EXPOSURE_MS, loop=0, optimize=False, disposal=2)

# Three class rows by five phase columns.
cell_w, cell_h = 264, 292
sheet = Image.new("RGB", (78 + GAP + 5*cell_w + 4*GAP, 48 + GAP + 3*cell_h + 2*GAP), BG)
draw = ImageDraw.Draw(sheet)
for pi, (num, label, _) in enumerate(PHASES):
    x = GAP + pi*(cell_w+GAP)
    draw.text((x+8, 10), f"{num} {label}", font=SMALL, fill=ACCENT)
for si, src in enumerate(sources):
    y = 48 + GAP + si*(cell_h+GAP)
    draw.text((GAP, y+8), src["name"], font=SMALL, fill=WHITE)
    for pi in range(5):
        tile = tile_for(si, pi)
        tile.thumbnail((cell_w, cell_h), Image.Resampling.LANCZOS)
        x = 78 + GAP + pi*(cell_w+GAP)
        card = Image.new("RGB", (cell_w, cell_h), TILE[:3])
        card.paste(tile.convert("RGB"), ((cell_w-tile.width)//2, (cell_h-tile.height)//2))
        sheet.paste(card, (x, y))
sheet.save(OUT / "contact-sheet.png", optimize=True)

# Keep source hashes and timing provenance reproducible from the integrated files.
metadata = {
    "purpose": "Review-only composite; source frame files are not modified.",
    "alignment": "Uniform whole-frame scale maps a held-pose anatomical estimate to 494 px in the source-space review canvas; each provenance groundAnchor maps to the same baseline. Airborne/VFX are preserved with no frame cropping. Estimates exclude raised weapons and are for comparative display only.",
    "reviewExposureMsPerSlot": REVIEW_EXPOSURE_MS,
    "nominalActionMs": NOMINAL_ACTION_MS,
    "nominalSlotMs": NOMINAL_SLOT_MS,
    "nominalContactMs": NOMINAL_CONTACT_MS,
    "classes": [],
}
for name, folder, sub in CLASSES:
    prov = json.loads((folder / "provenance.json").read_text())
    reg = prov.get("registration", {})
    anchor = reg.get("groundAnchor") or prov.get("groundAnchor")
    body = reg.get("bodyHeight") or prov.get("bodyHeight")
    review_body = REVIEW_BODY_HEIGHT[name]
    frame_hashes = {}
    for _, _, filename in PHASES:
        path = folder / sub / filename
        frame_hashes[filename] = hashlib.sha256(path.read_bytes()).hexdigest()
    metadata["classes"].append({
        "class": name,
        "sourceProvenance": str((folder / "provenance.json").relative_to(ROOT)),
        "groundAnchor": anchor,
        "documentedBodyHeight": body,
        "reviewHeldPoseAnatomicalEstimate": review_body,
        "sourceFrameSha256": frame_hashes,
        "reviewScaleFactor": round(TARGET_BODY / review_body, 6),
        "reviewDisplayBodyHeight": TARGET_BODY,
    })
(OUT / "review-sources.json").write_text(json.dumps(metadata, indent=2) + "\n")
