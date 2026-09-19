"""Reproduce WebP exports and the labeled review sheet from untouched PNG sources."""
from pathlib import Path
import json, hashlib, html
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
items = json.loads((ROOT / "catalog-selection.json").read_text(encoding="utf-8"))
manifest = {"pack": "relic-icons-pack-01", "generator": "built-in image_gen", "date": "2026-09-19",
    "catalog": "src/content/relics.js", "status": "review art; not wired into runtime", "assets": []}
sheet = Image.new("RGB", (1200, 590), "#17171c")
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 19)
small = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 15)
draw.text((24, 18), "ASHENSPIRE / STARTER RELICS / PACK 01", fill="#d7c49b", font=font)
cards = []
for index, item in enumerate(items):
    rid = item["id"]
    source = ROOT / "sources" / (rid + ".png")
    original = Image.open(source).convert("RGBA")
    alpha = original.getchannel("A")
    assert alpha.getextrema() == (0, 255), rid
    bbox = alpha.getbbox()
    # Uniform clear margin, preserving the source alpha without matte removal.
    crop = original.crop(bbox)
    entry = {"id": rid, "name": item["name"], "rarity": "starter", "source": "sources/" + rid + ".png",
        "sourceDimensions": list(original.size), "sourceAlphaBounds": list(bbox),
        "sourceSHA256": hashlib.sha256(source.read_bytes()).hexdigest(), "prompt": "prompts/" + rid + ".txt",
        "interpretation": item["subject"], "exports": []}
    for size in (512, 256, 128, 64):
        scaled = crop.copy()
        scaled.thumbnail((round(size * .82), round(size * .82)), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (size, size))
        canvas.paste(scaled, ((size-scaled.width)//2, (size-scaled.height)//2))
        target = ROOT / "webp" / f"{rid}-{size}.webp"
        canvas.save(target, "WEBP", quality=88, method=6, exact=True)
        decoded = Image.open(target).convert("RGBA")
        assert decoded.getchannel("A").tobytes() == canvas.getchannel("A").tobytes()
        assert decoded.size == (size, size)
        entry["exports"].append({"path": "webp/" + target.name, "dimensions": [size, size],
            "bytes": target.stat().st_size, "alphaVerified": True,
            "sha256": hashlib.sha256(target.read_bytes()).hexdigest()})
    manifest["assets"].append(entry)
    x = index * 300
    large = Image.open(ROOT / "webp" / f"{rid}-256.webp").convert("RGBA")
    sheet.paste(large, (x+22, 64), large)
    draw.text((x+20, 337), item["name"], fill="#e4d8be", font=font)
    draw.text((x+20, 368), rid, fill="#a4a0ad", font=small)
    for dx, color in ((24, "#292833"), (120, "#d6d1c6")):
        draw.rectangle((x+dx, 416, x+dx+80, 496), fill=color)
        icon = Image.open(ROOT / "webp" / f"{rid}-64.webp").convert("RGBA")
        sheet.paste(icon, (x+dx+8, 424), icon)
    draw.text((x+20, 518), "64 px / dark + light", fill="#a4a0ad", font=small)
    safe = html.escape(item["name"])
    cards.append(f'<article><div class="hero"><img src="webp/{rid}-512.webp" alt="{safe}"></div><h2>{safe}</h2><code>{rid}</code><p>Starter relic</p><div class="sizes"><img width="48" height="48" src="webp/{rid}-64.webp" alt="{safe} at 48 pixels"><img width="64" height="64" src="webp/{rid}-64.webp" alt="{safe} at 64 pixels"><img width="128" height="128" src="webp/{rid}-128.webp" alt="{safe} at 128 pixels"></div><p>48 / 64 / 128 px</p><p>{html.escape(item["subject"])}</p><a href="sources/{rid}.png">Original PNG</a> · <a href="prompts/{rid}.txt">Exact prompt</a><p>' + ' · '.join(f'<a href="webp/{rid}-{n}.webp">{n}px WebP</a>' for n in (512,256,128,64)) + '</p></article>')
sheet.save(ROOT / "preview.png")
(ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2)+"\n", encoding="utf-8")
(ROOT / "preview.html").write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AshenSpire · Relic Pack 01</title><style>
*{box-sizing:border-box}body{margin:0;padding:32px;background:#151519;color:#dbd4c4;font:16px/1.5 system-ui}h1{font-family:Georgia,serif;font-weight:400;color:#dac292}header{max-width:850px;margin-bottom:32px}button{padding:10px 18px;background:#b69c68;color:#151519;border:0;border-radius:4px;cursor:pointer}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}article{padding:20px;background:#202025;border:1px solid #484038;border-radius:8px}h2{font-size:21px;margin-bottom:2px}code{color:#c5ad80}a{color:#d0b57d}.hero,.sizes{background:var(--matte,#292833);border-radius:6px}.hero img{width:100%;max-height:350px;object-fit:contain}.sizes{margin-top:20px;display:flex;align-items:center;justify-content:space-around;gap:8px;min-height:148px}article p{font-size:13px;color:#aaa6a0}
</style><header><h1>AshenSpire — Starter Relics</h1><p>Pack 01 · Four standalone relics, labeled by exact catalog ID. Original generated PNGs and transparent WebP exports. Select an ID when requesting revisions.</p><button onclick="document.body.style.setProperty('--matte',this.dataset.light==='yes'?'#292833':'#d6d1c6');this.dataset.light=this.dataset.light==='yes'?'no':'yes'">Toggle dark / light preview</button></header><main>''' + "".join(cards) + '</main></html>', encoding="utf-8")
print(json.dumps({"assets":len(items),"webpBytes":sum(e["bytes"] for a in manifest["assets"] for e in a["exports"]), "alpha":"all exports lossless alpha verified"}))
