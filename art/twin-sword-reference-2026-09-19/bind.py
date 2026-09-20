"""Add only the twinSword family to the current shared animation configuration."""
from pathlib import Path
import hashlib
import json
import shutil

PACK = Path(__file__).resolve().parent
ROOT = PACK.parents[1]

def appearance_key(row):
    art_id = row['id'] if str(row.get('sharedSet', '')).lower() == 'true' else row.get('artKey') or row['id']
    return row['classId'] + ('' if art_id == 'default' else '-' + art_id)

def bind(manifest):
    expected = {appearance_key(row) for row in manifest['outfits']}
    assert {g['id'] for g in manifest['groups']} == expected, 'Refuse partial twin-sword runtime coverage'
    # Verify every source and frame before writing anything to runtime.
    for group in manifest['groups']:
        assert hashlib.sha256((PACK / group['source']).read_bytes()).hexdigest() == group['sourceSha256']
        for frame in group['frames'].values():
            assert hashlib.sha256((PACK / frame['file']).read_bytes()).hexdigest() == frame['sha256']
    path = ROOT / 'content/config/ui/presentation/equipmentAnimations.json'
    doc = json.loads(path.read_text(encoding='utf-8'))
    data = doc['components']
    original_other_profiles = {k: v for k, v in data.get('motionProfiles', {}).items() if k != 'twinSword'}
    clips = {name: {'frames': [pose], 'frameMs': 260, 'impactIndex': 0} for name, pose in {
        'ready': 'STANCE-READY', 'defend': 'DEFEND', 'hurt': 'HURT', 'cast': 'CAST', 'buff': 'BUFF',
        'aggressive': 'STANCE-AGGRESSIVE', 'defensive': 'STANCE-DEFENSIVE',
        'portrait': 'PORTRAIT', 'conversation': 'CONVERSATION'}.items()}
    clips['twinSwordAttack'] = {k: manifest['attack'][k] for k in ['frames', 'frameMs', 'impactIndex']}
    clips['enterStance'] = {'frames': ['BUFF'], 'frameMs': 180, 'impactIndex': 0}
    clips['leaveStance'] = {'frames': ['STANCE-READY'], 'frameMs': 180, 'impactIndex': 0}
    profile = {
        'normalLungeMs': 260,
        'supportedHandItems': {'right': ['straightSword'], 'left': ['katana']},
        'authoredEquipment': {'rightGroup': 'sword', 'leftGroup': 'sword', 'rightShape': 'straight', 'leftShape': 'curved'},
        'clips': clips,
        'references': {'idle': 'ready', 'attack': 'twinSwordAttack', 'defend': 'defend', 'buff': 'buff',
            'hurt': 'hurt', 'cast': 'cast', 'stanceActivate': 'enterStance', 'stanceDeactivate': 'leaveStance',
            'aggressiveStance': 'aggressive', 'defensiveStance': 'defensive', 'conversation': 'conversation',
            'portrait': 'portrait', 'menu': 'ready', 'detail': 'portrait', 'dodge': None, 'victory': None,
            'defeat': None, 'revive': None},
        'poseRoles': {'idle': 'idle', 'stand': 'menu', 'attack': 'attack', 'attack1': 'attack', 'attack2': 'attack',
            'attack3': 'attack', 'attack4': 'attack', 'guard': 'defend', 'shieldGuard': 'defend',
            'shieldGuard3': 'defend', 'parry': 'defend', 'shieldBash': 'attack', 'hit': 'hurt', 'power': 'buff',
            'cast': 'cast', 'gorefire': 'aggressiveStance', 'bulwark': 'defensiveStance', 'prepared': 'defensiveStance',
            'starstoneCharge': 'defensiveStance', 'bloodRite': 'buff', 'prototypeGuardStance': 'defensiveStance',
            'prototypeFocusStance': 'defensiveStance', 'defeated': 'defeat'}}
    additive = {'motionProfiles': {'twinSword': profile}, 'sets': {}, 'bindings': []}
    for group in manifest['groups']:
        dest = ROOT / 'assets/animations/twin-sword-outfits' / group['id']
        dest.mkdir(parents=True, exist_ok=True)
        frames = {}
        for pose, frame in group['frames'].items():
            src = PACK / frame['file']
            shutil.copy2(src, dest / src.name)
            x0, y0, x1, y1 = frame['bounds']
            frames[pose] = {'file': (dest / src.name).relative_to(ROOT).as_posix(),
                'box': {'x0': round(x0 * 1.25), 'y0': round(y0 * 1.25), 'x1': round(x1 * 1.25) - 1, 'y1': round(y1 * 1.25) - 1}}
        additive['sets'][group['id'] + 'TwinSword'] = {'motionProfile': 'twinSword', 'frames': frames}
    for row in manifest['outfits']:
        additive['bindings'].append({'classId': row['classId'], 'armourId': row['id'], 'rightGroup': 'sword',
            'leftGroup': 'sword', 'grip': 'dual', 'setId': appearance_key(row) + 'TwinSword'})
    owned = set(additive['sets'])
    # Never rebuild or replace another weapon family's profile or binding.
    data.setdefault('motionProfiles', {}).update(additive['motionProfiles'])
    data['sets'].update(additive['sets'])
    data['bindings'] = [b for b in data['bindings'] if b['setId'] not in owned] + additive['bindings']
    assert all(data['motionProfiles'][k] == v for k, v in original_other_profiles.items())
    (PACK / 'runtime-additions.json').write_text(json.dumps(additive, indent=2) + '\n', encoding='utf-8')
    path.write_text(json.dumps(doc, indent=2) + '\n', encoding='utf-8')
    print(f'Bound {len(expected)} appearances / {len(additive["bindings"])} catalog entries. Reverse hand order retains fallback.')

if __name__ == '__main__':
    bind(json.loads((PACK / 'manifest.json').read_text(encoding='utf-8')))
