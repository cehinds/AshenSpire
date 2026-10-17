#!/usr/bin/env python3
"""Conservative grid-aware export. Never redraw, mask or overwrite master artwork."""
import argparse
import hashlib
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw

LAYOUTS = {"stances": (3, 3), "motion": (4, 2), "damage": (2, 1)}
THRESHOLD = 32

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def counts(alpha):
    values = list(alpha.getdata())
    return {"above0": sum(v > 0 for v in values), "above32": sum(v > THRESHOLD for v in values)}

def boundary(alpha):
    w, h = alpha.size
    edges = [alpha.crop((0, 0, w, 1)), alpha.crop((0, h-1, w, h)),
             alpha.crop((0, 1, 1, h-1)), alpha.crop((w-1, 1, w, h-1))]
    return {key: sum(counts(edge)[key] for edge in edges) for key in ("above0", "above32")}

def cut(alpha, axis, nominal, radius, span):
    """Find transparent gutter near a nominal grid division; do not erase pixels."""
    width, height = alpha.size
    limit = height if axis == "y" else width
    candidates = []
    for point in range(max(1, round(nominal-radius)), min(limit-1, round(nominal+radius))+1):
        rect = (span[0], point, span[1], point+1) if axis == "y" else (point, span[0], point+1, span[1])
        value = counts(alpha.crop(rect))
        if value["above32"] == 0:
            candidates.append((value["above0"] != 0, abs(point-nominal), point, value))
    if not candidates:
        raise ValueError(f"no safe {axis} gutter near {nominal:.1f}")
    _, _, point, value = min(candidates)
    return point, value

def load_master(root, kind, spec, anchors, absolute=False):
    cols, rows = spec["grid"]
    allowed = ((3,3),(5,2)) if kind == "stances" else (LAYOUTS[kind],)
    if (cols, rows) not in allowed:
        raise ValueError(f"{kind}: unexpected grid")
    labels = spec["labels"]
    if len(labels) != cols*rows or len(set(labels)) != len(labels):
        raise ValueError(f"{kind}: labels must be unique and match grid")
    if any(not str(label).replace("-", "").replace("_", "").isalnum() for label in labels):
        raise ValueError(f"{kind}: unsafe label")
    path = root / f"{kind}-master.png"
    with Image.open(path) as opened:
        if "A" not in opened.getbands():
            raise ValueError(f"{kind}: missing true alpha channel")
        image = opened.convert("RGBA")
    alpha = image.getchannel("A")
    if alpha.getextrema()[0] != 0:
        raise ValueError(f"{kind}: no fully transparent background")
    edge = boundary(alpha)
    if edge["above32"]:
        raise ValueError(f"{kind}: artwork clipped at source boundary ({edge['above32']} pixels above alpha32)")
    width, height = image.size
    ycuts, gutters = [0], []
    for row in range(1, rows):
        point, value = cut(alpha, "y", height*row/rows, height/rows*.22, (0, width))
        ycuts.append(point)
        gutters.append({"axis": "y", "cut": point, **value})
    ycuts.append(height)
    if ycuts != sorted(set(ycuts)):
        raise ValueError(f"{kind}: unordered row cuts")
    frames = []
    for row in range(rows):
        top, bottom = ycuts[row:row+2]
        xcuts = [0]
        for col in range(1, cols):
            point, value = cut(alpha, "x", width*col/cols, width/cols*.22, (top, bottom))
            xcuts.append(point)
            gutters.append({"axis": "x", "row": row, "cut": point, **value})
        xcuts.append(width)
        if xcuts != sorted(set(xcuts)):
            raise ValueError(f"{kind}: unordered column cuts")
        for col in range(cols):
            index = row*cols+col
            rect = (xcuts[col], top, xcuts[col+1]+(col < cols-1), bottom+(row < rows-1))
            # Include the safe cut line in both neighbors, so even one-pixel
            # transparent gutters retain a transparent frame boundary. No meaningful alpha overlaps.
            cell = image.crop(rect)
            channel = cell.getchannel("A")
            bounds = channel.point(lambda v: 255 if v > THRESHOLD else 0).getbbox()
            full = channel.getbbox()
            if not bounds or boundary(channel)["above32"]:
                raise ValueError(f"{kind}/{labels[index]}: empty or clipped cell")
            reviewed = kind in anchors
            anchor = list(anchors[kind][index]) if reviewed else [(bounds[0]+bounds[2])/2, bounds[3]]
            if reviewed and absolute:
                anchor = [anchor[0]-rect[0], anchor[1]-rect[1]]
            if len(anchor) != 2 or not all(isinstance(v, (int,float)) and math.isfinite(v) for v in anchor):
                raise ValueError(f"{kind}/{labels[index]}: invalid anchor")
            if not (0 <= anchor[0] <= cell.width and 0 <= anchor[1] <= cell.height):
                raise ValueError(f"{kind}/{labels[index]}: anchor outside cell")
            frames.append({"kind": kind, "label": labels[index], "rect": rect, "bounds": bounds,
                           "full": full, "anchor": anchor, "reviewedAnchor": reviewed, "cell": cell})
    return {"path": str(path), "sha256": digest(path), "size": image.size,
            "sourceBoundary": edge, "gutters": gutters}, frames

def run(root):
    provenance = json.loads((root/"provenance.json").read_text())
    output = root/"normalized"
    output.mkdir(exist_ok=True)
    # Remove stale generated exports only; the master sources are immutable.
    for pattern in ("*/*.png", "*.png", "*.gif"):
        for path in output.glob(pattern):
            path.unlink()
    report = {"schemaVersion": 1, "status": "draft-pending-visual-review",
              "alphaThreshold": THRESHOLD, "output": {"size": [512,512], "anchor": [256,464]},
              "masters": {}, "frames": [], "errors": [], "warnings": []}
    frames = []
    try:
        normalization = provenance.get("normalization", {})
        anchors = normalization.get("footAnchors", {})
        calibration = normalization.get("masterScale", {})
        report["manualReview"] = normalization.get("review", None)
        for kind in LAYOUTS:
            if kind in anchors and len(anchors[kind]) != math.prod(provenance["masters"][kind]["grid"]):
                raise ValueError(f"{kind}: anchor count mismatch")
            try:
                source, items = load_master(root, kind, provenance["masters"][kind], anchors, normalization.get("anchorCoordinates") == "source")
                report["masters"][kind] = source
                factor = calibration.get(kind, 1.0)
                if not isinstance(factor, (int,float)) or not math.isfinite(factor) or factor <= 0:
                    raise ValueError(f"{kind}: invalid measured masterScale")
                for item in items:
                    item["calibration"] = factor
                frames.extend(items)
            except (ValueError, KeyError, OSError, IndexError, TypeError) as error:
                report["errors"].append(f"{kind}: {error}")
        if report["errors"]:
            raise ValueError("One or more source masters rejected; no frames exported")
        # One scale across every master in this actor, using meaningful alpha; faint outer noise clipping is counted explicitly.
        scale = 1.0
        for frame in frames:
            left, top, right, bottom = frame["bounds"]
            ax, ay = frame["anchor"]
            for distance, room in ((ax-left,224), (right-ax,224), (ay-top,432), (bottom-ay,47)):
                if distance > 0:
                    scale = min(scale, room/(distance*frame["calibration"]))
        report["output"]["sharedScale"] = scale
        report["output"]["authoredScaleCompensation"] = 1/scale
        report["output"]["runtimeAlignment"] = "unverified; native PNG size includes fit scale, compensate when comparing with authored seed"
        report["seedReference"] = provenance.get("seed")
        report["bodyScaleRelation"] = {"fitScale": scale, "perMasterCalibration": calibration,
                                      "previewScaleToAuthoredStances": 1/scale,
                                      "seedBodyHeightPixels": normalization.get("seedBodyHeightPixels"),
                                      "stanceBodyHeightPixels": normalization.get("stanceBodyHeightPixels"),
                                      "status": "authored anatomy calibrated by manual estimates; exact seed body-height alignment pending"}
        contact = Image.new("RGB", (5*256, math.ceil(len(frames)/5)*280), (36,39,43))
        draw = ImageDraw.Draw(contact)
        previews = {}
        for index, frame in enumerate(frames):
            full, cell = frame["full"], frame["cell"]
            frame_scale = scale*frame["calibration"]
            crop = cell.crop(full)
            crop = crop.resize((max(1,round(crop.width*frame_scale)), max(1,round(crop.height*frame_scale))), Image.Resampling.LANCZOS)
            x = round(256-(frame["anchor"][0]-full[0])*frame_scale)
            y = round(464-(frame["anchor"][1]-full[1])*frame_scale)
            omitted_count, omitted_max, omitted_meaningful = 0, 0, 0
            if x < 0 or y < 0 or x+crop.width > 512 or y+crop.height > 512:
                pixels = crop.getchannel("A").load()
                for cy in range(crop.height):
                    for cx in range(crop.width):
                        if not (0 <= x+cx < 512 and 0 <= y+cy < 512):
                            value = pixels[cx,cy]
                            if value:
                                omitted_count += 1
                                omitted_max = max(omitted_max,value)
                                omitted_meaningful += value > THRESHOLD
            if omitted_meaningful:
                raise ValueError(f'{frame["kind"]}/{frame["label"]}: meaningful output alpha clips')
            result = Image.new("RGBA", (512,512))
            result.alpha_composite(crop, (x,y))
            if boundary(result.getchannel("A"))["above32"]:
                raise ValueError("output touches boundary")
            folder = output/frame["kind"]
            folder.mkdir(exist_ok=True)
            destination = folder/(frame["label"]+".png")
            result.save(destination)
            entry = {key: frame[key] for key in ("kind","label","rect","bounds","anchor","reviewedAnchor")}
            entry.update(path=str(destination), sha256=digest(destination), translation=[x,y],
                         outputAnchor=[256,464], calibratedScale=frame_scale,
                         omittedFaintPixels=omitted_count, omittedMaxAlpha=omitted_max,
                         omittedMeaningfulPixels=omitted_meaningful, outputAlphaBounds=result.getchannel("A").getbbox())
            report["frames"].append(entry)
            thumb = result.resize((256,256), Image.Resampling.LANCZOS)
            tx, ty = index%5*256, index//5*280
            contact.paste(thumb, (tx,ty), thumb)
            draw.text((tx+4,ty+260), frame["kind"]+"/"+frame["label"], fill="white")
            # GIF is a review preview on a dark field; PNG frame alpha is preserved.
            background = Image.new("RGB",(512,512),(36,39,43))
            background.paste(result,(0,0),result)
            previews.setdefault(frame["kind"],[]).append(background)
        contact.save(output/"contact-sheet.png")
        for kind, images in previews.items():
            if kind == "motion":
                for clip, subset in (("attack", images[:4]), ("evade", images[4:])):
                    durations = provenance.get("clips", {}).get(clip, {}).get("durations", [220]*4)
                    if len(durations) != 4 or any(not isinstance(v, int) or v <= 0 for v in durations):
                        raise ValueError(f"{clip}: invalid clip durations")
                    subset[0].save(output/(clip+"-preview.gif"), save_all=True, append_images=subset[1:],
                                   duration=durations, loop=0, disposal=2)
            else:
                images[0].save(output/(kind+"-pose-slideshow.gif"), save_all=True, append_images=images[1:],
                               duration=650, loop=0, disposal=2)
        report["previewPolicy"] = "Separate four-frame attack/evade loops; stances and damage are labeled pose slideshows."
        report["masterScaleCalibration"] = calibration
        if not calibration:
            report["warnings"].append("Separate generated masters have no measured body-height calibration; inspect against seed before accepting scale.")
        if not report["manualReview"]:
            report["warnings"].append("No manual anchor/body-height review recorded; metadata presence alone does not establish review.")
        if any(not frame["reviewedAnchor"] for frame in frames):
            report["warnings"].append("Automatic bounds-bottom anchors require visual foot/root/weapon review; no anatomical foot detection is claimed.")
        for source in report["masters"].values():
            if digest(Path(source["path"])) != source["sha256"]:
                raise ValueError("source artwork changed")
        for frame in report["frames"]:
            with Image.open(frame["path"]) as check:
                if check.mode != "RGBA" or check.size != (512,512) or check.getchannel("A").getextrema()[0] != 0:
                    raise ValueError("output RGBA/size/transparency invariant failed")
    except (ValueError, KeyError, OSError, IndexError, TypeError) as error:
        report["errors"].append(str(error))
        report["status"] = "rejected"
        # Never leave partial accepted-looking artifacts after a failed gate.
        for pattern in ("*/*.png", "*.png", "*.gif"):
            for path in output.glob(pattern):
                path.unlink()
    (output/"normalized.json").write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))
    return not report["errors"]

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    raise SystemExit(0 if run(args.directory) else 1)
