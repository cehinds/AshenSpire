"""Verify catalog completeness, shared choreography, source integrity and exports."""
from pathlib import Path
from PIL import Image
import hashlib
import json

pack = Path(__file__).resolve().parent
m = json.loads((pack / 'manifest.json').read_text(encoding='utf-8'))
assert m['coverage'] == {'catalogEntries': 35, 'expectedAppearances': 32, 'generatedAppearances': 32, 'missing': []}
assert len(m['groups']) == 32 and len({g['id'] for g in m['groups']}) == 32
assert set(g['classId'] for g in m['groups']) == {'reaver', 'starseer', 'herald', 'rogue'}
assert len(m['outfits']) == len(m['aliases']) == 35
assert set(m['aliases'].values()) == {g['id'] for g in m['groups']}
provenance = json.loads((pack / 'prompts.json').read_text(encoding='utf-8'))
assert len(provenance['generations']) == 33
assert {g['source'] for g in m['groups']} <= {e['source'] for e in provenance['generations']}
assert all(e['prompt'] and e['references'] and (pack / e['source']).is_file() for e in provenance['generations'])
total = 0
for g in m['groups']:
    source = pack / g['source']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == g['sourceSha256'], g['id']
    with Image.open(source) as im:
        assert im.mode == 'RGBA' and im.getchannel('A').getextrema() == (0, 255)
    with Image.open(source) as im: im.verify()
    assert g['sequence'] == m['sequence'] and g['frameMs'] == m['frameMs']
    assert g['poses'] == m['poses'] and len(g['frames']) == 16
    for pose, f in g['frames'].items():
        runtime = pack.parents[1] / 'assets/animations/unarmed-magic' / g['id'] / f'{pose}.webp'
        assert hashlib.sha256(runtime.read_bytes()).digest() == hashlib.sha256((pack / f['file']).read_bytes()).digest()
        frame = Image.open(pack / f['file']).convert('RGBA')
        assert frame.size == (512, 512) and frame.getchannel('A').getextrema() == (0, 255)
        assert tuple(f['box']) == frame.getbbox() and f['alphaVerified']
        assert f['anchor'] == [256, 480]
        if pose != 'PORTRAIT':
            assert f['scale'] == g['bodyScale']
            assert abs(f['offset'][0] + f['sourceAnchor'][0] * f['scale'] - 256) <= 0.5
            assert abs(f['offset'][1] + f['sourceAnchor'][1] * f['scale'] - 480) <= 0.5
        assert all(frame.getpixel(p)[3] == 0 for p in [(0, 0), (511, 0), (0, 511), (511, 511)])
        total += 1
    for filename in ['labeled-sheet.webp', 'attack-preview.webp']:
        with Image.open(pack / g['directory'] / filename) as im: im.verify()
fragment = json.loads((pack / 'runtime-fragment.json').read_text(encoding='utf-8'))
assert len(fragment['sets']) == 32 and len(fragment['bindings']) == 35
assert fragment['ownedRoles'] == ['cast', 'buff']
assert fragment['references'] == {'cast': 'magicChannel', 'buff': 'magicBuff'}
assert fragment['clips']['magicChannel']['frames'] == ['MAGIC-' + p for p in m['sequence']]
assert fragment['clips']['magicChannel']['impactIndex'] == m['sequence'].index('ATK-05')
for entry in fragment['sets'].values():
    assert len(entry['frames']) == 16
    for clip in fragment['clips'].values(): assert all(p in entry['frames'] for p in clip['frames'])
print(f'PASS: {total} transparent 512x512 frames; 32 appearances /35 entries; shared sequence, timing, source hashes and anchors; complete runtime fragment.')
