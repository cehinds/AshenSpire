"""Verify delivered PNGs, provenance, selections and zero-valued variants."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
data = json.loads((ROOT / 'cutout-manifest.json').read_text())
assets = data['assets']
assert len(assets) == (262 if data['revision'] >= 5 else 230 if data['revision'] >= 4 else 170)
assert len(data['categories']) == (16 if data['revision'] >= 5 else 14 if data['revision'] >= 4 else 8)
assert len(data['compositions']) == (1520 if data['revision'] >= 5 else 1400 if data['revision'] >= 4 else 800)
assert len([a for a in assets.values() if a['kind'] == 'object' and a['category'] in 'ABCDEFG']) == 70
assert len([a for a in assets.values() if a['kind'] == 'object' and a['category'] == 'H']) == 10
for asset in assets.values():
    path = ROOT / asset['src']
    assert path.is_file(), path
    assert hashlib.sha256(path.read_bytes()).hexdigest() == asset['sha256'], path
    im = Image.open(path).convert('RGBA')
    assert im.size == (asset['width'], asset['height']), path
    alpha = im.getchannel('A')
    assert list(alpha.getbbox()) == asset['alphaBounds'], path
    if asset['kind'] == 'background':
        assert im.size == (512, 640) and alpha.getextrema() == (255, 255), path
    else:
        expected = (512,640) if asset['category']=='O' else (256,256) if asset['category']=='P' else (512,512)
        assert im.size == expected and alpha.getextrema()[0] == 0, path
        assert alpha.getextrema()[1] > 0, path
        for xy in [(0, 0), (0, im.height-1), (im.width-1, 0), (im.width-1, im.height-1)]:
            assert alpha.getpixel(xy) == 0, path
    assert asset['references']['sourceSha256']
for c in data['categories']:
    for kind in ['object', 'effect']:
        ids = c[kind + 'Ids']
        expected_count = 2 if c['letter']=='P' and kind=='object' else 10
        assert len(ids) == expected_count
        assert [assets[id]['digit'] for id in ids] == list(range(expected_count))
    for i in range(len(c['objectIds'])):
        for j in range(len(c['effectIds'])):
            code = f"{c['letter']}{i}{j}"
            composition = data['compositions'][code]
            layers = {layer['id']: layer for layer in composition['layers']}
            assert layers['object']['assetId'] == c['objectIds'][i]
            assert layers['foreground']['assetId'] == c['effectIds'][j]
            assert layers['object']['visible'] and layers['foreground']['visible']
            for layer in layers.values():
                assert layer['assetId'] in assets
if data['revision'] >= 4:
    assert len([a for a in assets.values() if a['kind'] == 'object' and a['category'] in 'IJKLM']) == 50
    assert next(t for t in data['cardTypes'] if t['id'] == 'spell')['objectFamilies'] == ['I']
    for i in range(10):
        for j in range(10):
            comp = data['compositions'][f'N{i}{j}']
            layers = {l['id']: l for l in comp['layers']}
            assert layers['object']['assetId'] == f'M.object.{i}'
            assert layers['secondaryObject']['assetId'] == f'J.object.{i}'
            assert layers['secondaryObject']['visible']
            assert layers['secondaryObject']['zIndex'] < layers['object']['zIndex']
assert len(data['cardTypes']) == 10
assert data['tagComposition']['maxTags'] == 4
assert data['runtimeEnabled'] is False
print(f"Validated revision {data['revision']}: {len(assets)} PNGs, {len(data['compositions'])} combinations, independent Counter layers, alpha, hashes and references.")

if data['revision'] >= 5:
    for a in assets.values():
        if a['category'] not in ['O','P']: continue
        r=a['references']; source=ROOT/r['sourceReference']
        assert hashlib.sha256(source.read_bytes()).hexdigest()==r['sourceSha256']
        if a['category']=='P':
            original=Image.open(source).convert('RGBA'); png=Image.open(ROOT/a['src']).convert('RGBA')
            assert original.size==png.size and original.tobytes()==png.tobytes()
        if a['category']=='O' and a['kind']=='object':
            x,y,right,bottom=a['alphaBounds']
            assert x>=14 and y>=14 and right<=498 and bottom<=626
    for digit,sword in [(4,0),(9,5)]:
        layers={l['id']:l for l in data['compositions'][f'O{digit}{digit}']['layers']}
        assert layers['secondaryObject']['assetId']==f'O.object.{sword}'
        assert layers['secondaryObject']['visible']
        assert layers['secondaryObject']['zIndex']<layers['object']['zIndex']
    print('Verified all reused source hashes, exact native decoded pixels, safe object margins and separate Counter swords.')
