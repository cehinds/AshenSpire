from pathlib import Path
import json, shutil, html
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent
data = json.loads((root / 'provenance.json').read_text())
cards = []
sheet = Image.new('RGB', (1200, 966), '#171719')
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 22)
small = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 17)
for i, asset in enumerate(data['assets']):
    aid = asset['id']
    source = root / 'sources' / (aid + '.png')
    shutil.copy2(asset['generatedFile'], source)
    with Image.open(source) as im:
        im = im.convert('RGB')
        dest = root / 'webp' / (aid + '.webp')
        im.save(dest, 'WEBP', quality=88, method=6)
        with Image.open(dest) as check:
            check.load()
            assert check.size == im.size
        preview = im.copy()
        preview.thumbnail((900, 600), Image.Resampling.LANCZOS)
        preview.save(root / 'previews' / (aid + '.webp'), 'WEBP', quality=82, method=6)
        thumb = im.resize((456, 304), Image.Resampling.LANCZOS)
        y = i * 322
        sheet.paste(thumb, (12, y + 9))
        draw.text((492, y + 90), aid, font=font, fill='#d1b478')
        draw.text((492, y + 130), asset['region'], font=font, fill='#e3dfd6')
        draw.text((492, y + 172), f'{im.width} x {im.height} | WebP quality 88', font=small, fill='#aaa7a0')
        asset.update(width=im.width, height=im.height, source='sources/'+aid+'.png', webp='webp/'+aid+'.webp', pngBytes=source.stat().st_size, webpBytes=dest.stat().st_size)
    cards.append(f'<article id="{aid}"><h2>{aid}</h2><p>{html.escape(asset["region"])} · {asset["width"]} × {asset["height"]} · {asset["webpBytes"]/1024:.0f} KiB</p><a href="{asset["webp"]}"><img src="previews/{aid}.webp" alt="{asset["name"]}"></a><p><a href="{asset["source"]}">PNG source</a> · <a href="{asset["webp"]}">Full-size WebP</a></p><details><summary>Generation prompt</summary><p>{html.escape(asset["prompt"])}</p></details></article>')
sheet.save(root / 'previews' / 'labeled-gallery.jpg', quality=92)
(root / 'manifest.json').write_text(json.dumps(data, indent=2), encoding='utf-8')
(root / 'gallery.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AshenSpire — Local Maps Batch 01</title><style>body{background:#171719;color:#e3dfd6;font:16px/1.6 system-ui;max-width:1200px;margin:auto;padding:28px}h1,h2,a{color:#d1b478}article{padding:24px 0;border-top:1px solid #514735}img{display:block;width:100%;height:auto}summary{cursor:pointer}details p{max-width:90ch}</style><h1>AshenSpire · Local Maps · Batch 01</h1><p>Refer to the exact MAP ID when requesting revisions. Three new destination concepts; source art and game assets preserved. Click a painting for its full-size optimized WebP. Painted paths are conceptual, not implemented navigation.</p>''' + ''.join(cards) + '</html>', encoding='utf-8')
print(json.dumps([{k:a[k] for k in ['id','width','height','pngBytes','webpBytes']} for a in data['assets']], indent=2))
