"""Rebuild WebP exports and review artifacts from preserved generated sources."""
from pathlib import Path
import json, hashlib, html
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
items = json.loads((ROOT / 'prompts.json').read_text())['items']
manifest = {'generator': 'built-in image_gen', 'date': '2026-09-19', 'encoding': {'quality': 88, 'method': 6, 'alpha_quality': 100}, 'items': []}
font_path = 'C:/Windows/Fonts/arial.ttf'
font = ImageFont.truetype(font_path, 22)
small = ImageFont.truetype(font_path, 17)
sheet = Image.new('RGB', (1200, 1020), '#181715')
draw = ImageDraw.Draw(sheet)
draw.text((28, 18), 'ASHENSPIRE / INVENTORY ART / 01', font=font, fill='#d5bc82')
cards = []
for i, item in enumerate(items):
    source = ROOT / 'sources' / (item['id'] + '.png')
    im = Image.open(source).convert('RGBA')
    alpha = im.getchannel('A')
    assert alpha.getextrema() == (0, 255), source
    exports = []
    for size in (1024, 512, 256):
        # Fit the entire generated canvas, preserving alpha and adding safe UI padding.
        scaled = im.resize((round(size * .84), round(size * .84)), Image.Resampling.LANCZOS)
        out = Image.new('RGBA', (size, size))
        out.alpha_composite(scaled, ((size-scaled.width)//2, (size-scaled.height)//2))
        dest = ROOT / 'webp' / f"{item['id']}-{size}.webp"
        out.save(dest, 'WEBP', quality=88, method=6, alpha_quality=100)
        decoded = Image.open(dest).convert('RGBA')
        assert decoded.size == (size, size)
        assert decoded.getchannel('A').tobytes() == out.getchannel('A').tobytes()
        exports.append({'path': str(dest.relative_to(ROOT)).replace('\\','/'), 'dimensions': [size,size], 'bytes': dest.stat().st_size, 'alphaVerified': True})
    manifest['items'].append({**{k:item[k] for k in ('id','catalogId','name','group')}, 'source': str(source.relative_to(ROOT)).replace('\\','/'), 'sourceDimensions': list(im.size), 'sourceBytes':source.stat().st_size, 'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(), 'sourceAlphaBounds':list(alpha.getbbox()), 'exports':exports})
    x, y = (i%3)*400, 60+(i//3)*470
    draw.rounded_rectangle((x+12,y,x+388,y+450), 12, fill='#252320', outline='#61543c')
    thumb = Image.open(ROOT / exports[1]['path']).convert('RGBA').resize((360,360), Image.Resampling.LANCZOS)
    sheet.paste(thumb,(x+20,y+8),thumb)
    draw.text((x+26,y+367),item['name'],font=font,fill='#f0e2c7')
    draw.text((x+26,y+399),item['catalogId'],font=small,fill='#c4bba9')
    draw.text((x+26,y+425),item['group'],font=small,fill='#a69c88')
    links = ' · '.join(f'<a href="{e["path"]}">{e["dimensions"][0]}px ({e["bytes"]//1024} KB)</a>' for e in exports)
    cards.append(f'<article><div class="art"><img src="{exports[1]["path"]}" alt="{html.escape(item["name"])}"></div><h2>{item["name"]}</h2><code>{item["catalogId"]}</code><p>{item["group"]}</p><p>{links}</p><a href="sources/{item["id"]}.png">Original PNG</a></article>')
sheet.save(ROOT/'preview-gallery.jpg', quality=94)
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(ROOT/'gallery.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AshenSpire Inventory Art 01</title><style>body{margin:32px;background:#181715;color:#eee1cb;font:16px system-ui}h1{color:#d5bc82}button{padding:10px;margin:4px;background:#d5bc82;border:0;cursor:pointer}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}article{padding:18px;background:#252320;border:1px solid #61543c;border-radius:12px}.art{background:var(--back,#171614);border-radius:8px}img{display:block;width:100%;max-height:400px;object-fit:contain}a{color:#d5bc82}h2{font-size:20px}code{color:#d1c7b3}</style><h1>AshenSpire / Inventory Art / 01</h1><p>Six standalone inventory illustrations. Catalog IDs below each item. Original sources: 1254 × 1254 RGBA. WebP: 1024, 512 and 256 square, quality 88 with lossless alpha.</p><p><button onclick="document.body.style.setProperty('--back','#171614')">Dark</button><button onclick="document.body.style.setProperty('--back','#d8d4ca')">Light</button><button onclick="document.body.style.setProperty('--back','repeating-conic-gradient(#aaa 0% 25%,#ddd 0% 50%) 0/24px 24px')">Transparency grid</button></p><main>'''+''.join(cards)+'</main><p><a href="prompts.json">Generation prompts</a> · <a href="manifest.json">Dimensions, sizes and checks</a></p></html>')
print(json.dumps({'items':len(items),'exports':sum(len(i['exports']) for i in manifest['items']),'webpBytes':sum(e['bytes'] for i in manifest['items'] for e in i['exports']),'sourceBytes':sum(i['sourceBytes'] for i in manifest['items'])}))
