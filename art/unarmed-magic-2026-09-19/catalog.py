"""Export all skins and a merge-only payload for the physical-unarmed integrator."""
from export import PACK, IDS, ORDER, export
import hashlib
import json
import sys
import shutil

def key(row):
    return row['classId'] + ('' if row['id'] == 'default' else '-' + row['id'])

def appearance(row):
    return {**row, 'id': row['id'] if str(row.get('sharedSet', '')).lower() == 'true' else row['artKey'] or row['id']}

def write(name, value):
    (PACK / name).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')

rows = json.loads((PACK / 'outfits.json').read_text(encoding='utf-8'))
expected = [r for r in rows if key(r) == key(appearance(r))]
previous = json.loads((PACK / 'manifest.json').read_text(encoding='utf-8')) if (PACK / 'manifest.json').exists() else {}
cache = {g['id']: g for g in previous.get('groups', [])}
groups = []
for row in expected:
    source = PACK / 'sources' / f'{key(row)}.png'
    if not source.exists(): continue
    old = cache.get(key(row))
    if '--refresh' not in sys.argv and old and old['sourceSha256'] == hashlib.sha256(source.read_bytes()).hexdigest() and all((PACK / f['file']).exists() for f in old['frames'].values()):
        groups.append(old)
    else: groups.append(export(row))
missing = [key(r) for r in expected if key(r) not in {g['id'] for g in groups}]
for group in groups:
    group.pop('runtimeBound', None)
    group['defaultRuntimeRoles'] = ['cast', 'buff']
manifest = {'motionProfile': 'unarmedMagic', 'sequence': ORDER, 'frameMs': 160, 'impactPose': 'ATK-05',
    'poses': IDS, 'groups': groups, 'outfits': rows, 'aliases': {key(r): key(appearance(r)) for r in rows},
    'coverage': {'catalogEntries': len(rows), 'expectedAppearances': len(expected), 'generatedAppearances': len(groups), 'missing': missing},
    'equipment': {'weaponGroup': 'unarmed', 'rightGroup': 'empty', 'leftGroup': 'empty'},
    'presentationIntent': 'magic', 'effectsBaked': False, 'frameSize': [512, 512], 'anchor': [256, 480], 'generator': 'OpenAI built-in image_gen'}
write('manifest.json', manifest)
(PACK / 'data.js').write_text('window.UNARMED_MAGIC = ' + json.dumps(manifest) + ';\n', encoding='utf-8')
clips = {'magicChannel': {'frames': ['MAGIC-' + p for p in ORDER], 'frameMs': 160, 'impactIndex': 5}}
for pose in IDS:
    clips['magic' + pose.title().replace('-', '')] = {'frames': ['MAGIC-' + pose], 'frameMs': 160, 'impactIndex': 0}
sets = {}
for group in groups:
    frames = {}
    for pose, data in group['frames'].items():
        box = data['box']
        frames['MAGIC-' + pose] = {'file': f'assets/animations/unarmed-magic/{group["id"]}/{pose}.webp',
            'box': dict(zip(['x0', 'y0', 'x1', 'y1'], [round(box[0]*1.25), round(box[1]*1.25), round(box[2]*1.25)-1, round(box[3]*1.25)-1]))}
    sets[group['id'] + 'Unarmed'] = {'frames': frames}
write('runtime-fragment.json', {'schemaVersion': 1, 'motionProfile': 'unarmed', 'ownedRoles': ['cast', 'buff'],
    'clips': clips, 'references': {'cast': 'magicChannel', 'buff': 'magicBuff'}, 'sets': sets,
    'bindings': [{'classId': r['classId'], 'armourId': r['id'], 'rightGroup': 'empty', 'leftGroup': 'empty', 'setId': key(appearance(r)) + 'Unarmed'} for r in rows]})
print(f'Coverage {len(groups)}/{len(expected)} appearances; {len(rows)} armor entries. Missing: {missing}', flush=True)
if '--require-complete' in sys.argv: assert not missing, 'Incomplete appearance coverage'
if '--runtime' in sys.argv:
    assert not missing, 'Refuse partial runtime export'
    root = PACK.parents[1]
    for group in groups:
        target = root / 'assets/animations/unarmed-magic' / group['id']
        target.mkdir(parents=True, exist_ok=True)
        for pose, frame in group['frames'].items():
            original = PACK / frame['file']
            exported = target / f'{pose}.webp'
            shutil.copy2(original, exported)
            assert hashlib.sha256(original.read_bytes()).digest() == hashlib.sha256(exported.read_bytes()).digest()
    print('Copied 512 verified runtime frames; import runtime-fragment.json through the shared unarmed importer.')
