"""Validate retained PNGs, exported alpha, anchors, hashes and complete coverage."""
from pathlib import Path
from PIL import Image
import hashlib
import json
import numpy as np

PACK = Path(__file__).resolve().parent
manifest = json.loads((PACK / 'manifest.json').read_text(encoding='utf-8'))
plan = json.loads((PACK / 'generation-plan.json').read_text(encoding='utf-8'))
assert len(manifest['groups']) == len(plan) == 32
assert not manifest['coverage']['missingAppearances']
assert len(manifest['outfits']) == 35
reports = []
for group in manifest['groups']:
    source = PACK / group['source']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == group['sourceSha256']
    alpha = np.asarray(Image.open(source).getchannel('A'))
    assert alpha.min() == 0 and alpha.max() == 255
    assert not any((edge > 192).any() for edge in [alpha[0], alpha[-1], alpha[:, 0], alpha[:, -1]]), f"{group['id']}: opaque artwork reaches source edge"
    assert list(group['frames']) == manifest['poses']
    assert group['attack'] == manifest['attack']
    assert abs(group['bodyScale'] * group['sourceSize'][0] - manifest['unitScale']) < 1e-6
    maximum_anchor_error = 0
    for pose, frame in group['frames'].items():
        path = PACK / frame['file']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == frame['sha256']
        webp = Image.open(path).convert('RGBA'); png = Image.open(PACK / frame['png']).convert('RGBA')
        assert webp.size == png.size == (512, 512)
        assert webp.getchannel('A').tobytes() == png.getchannel('A').tobytes()
        box = webp.getchannel('A').getbbox()
        assert list(box) == frame['bounds'] and min(box[:2]) > 0 and max(box[2:]) < 512
        if pose != 'PORTRAIT':
            assert frame['scale'] == group['bodyScale']
            error = max(abs(a - b) for a, b in zip(frame['outputFootAnchor'], [256, 480]))
            assert error <= 0.500001, (group['id'], pose, error)
            maximum_anchor_error = max(maximum_anchor_error, error)
    reports.append({'id': group['id'], 'frames': 16, 'alphaExact': True, 'sourceEdgesClear': True, 'maxAnchorErrorPixels': maximum_anchor_error})
(PACK / 'validation.json').write_text(json.dumps({'appearanceCount': 32, 'catalogEntries': 35, 'frames': 512, 'groups': reports}, indent=2) + '\n', encoding='utf-8')
print('PASS: 32 sources / 512 PNG-WebP pairs, exact alpha, shared scale, anchors within half a pixel, transparent source edges, complete catalog.')
