"""Verify delivered PNGs, provenance, selections and zero-valued variants."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
data = json.loads((ROOT / 'cutout-manifest.json').read_text())
assets = data['assets']
assert len(assets) == 170
assert len(data['categories']) == 8
assert len(data['compositions']) == 800
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
        assert im.size == (512, 512) and alpha.getextrema()[0] == 0, path
        assert alpha.getextrema()[1] > 0, path
        for xy in [(0, 0), (0, 511), (511, 0), (511, 511)]:
            assert alpha.getpixel(xy) == 0, path
    assert asset['references']['sourceSha256']
for c in data['categories']:
    for kind in ['object', 'effect']:
        ids = c[kind + 'Ids']
        assert len(ids) == 10
        assert [assets[id]['digit'] for id in ids] == list(range(10))
    for i in range(10):
        for j in range(10):
            code = f"{c['letter']}{i}{j}"
            composition = data['compositions'][code]
            layers = {layer['id']: layer for layer in composition['layers']}
            assert layers['object']['assetId'] == c['objectIds'][i]
            assert layers['foreground']['assetId'] == c['effectIds'][j]
            assert layers['object']['visible'] and layers['foreground']['visible']
            for layer in layers.values():
                assert layer['assetId'] in assets
assert len(data['cardTypes']) == 10
assert data['tagComposition']['maxTags'] == 4
assert data['runtimeEnabled'] is False
print('Validated 70 core objects + 10 cleansing fires + 80 effect exports + 10 backgrounds; 800 combinations, real option 0, alpha, hashes and references.')
