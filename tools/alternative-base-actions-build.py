"""Export the scoped class-default strike/defense/power study.

Uses the existing whole-sheet normalization and portable Workshop conventions.
Legacy loadout/reaction projects remain intact. No equipment/tag routing is built.
"""
import base64
import hashlib
import json
import argparse
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'pose-studio/renewal'
CLASSES = {'reaver': 'Sword', 'rogue': 'Twin daggers', 'starseer': 'Staff', 'herald': 'Sword and shield'}
ACTIONS = ['attack', 'defense', 'power']
ATTACK = [
    ('ready', (0, 0, 512, 520), 286, 510),
    ('windup', (512, 0, 1018, 520), 806, 510),
    ('advance', (1018, 0, 1536, 520), 1284, 510),
    ('contact', (0, 520, 580, 1024), 265, 998),
    ('follow', (520, 520, 1030, 1024), 797, 1005),
    ('return', (1030, 520, 1536, 1024), 1280, 1015),
]
GUTTERS = {
    'contact': [(0, 520), (580, 520), (580, 710), (520, 800), (520, 1024), (0, 1024)],
    'follow': [(580, 520), (1030, 520), (1030, 1024), (520, 1024), (520, 800), (580, 710)],
}
DEFENSE = {
    'reaver': (.56, [435, 1135, 1840], 690),
    'rogue': (.55, [414, 1094, 1840], 690),
    'starseer': (.58, [376, 1084, 1771], 700),
    'herald': (.55, [363, 1060, 1745], 678),
}


def write_json(path, data, compact=False):
    path.write_text(json.dumps(data, indent=None if compact else 2,
                               separators=(',', ':') if compact else None) + '\n', encoding='utf-8', newline='\n')


def uri(path):
    return 'data:image/webp;base64,' + base64.b64encode(path.read_bytes()).decode()


def normalize(out, source_name, scale, poses, gutters=None):
    source = Image.open(out / 'source' / source_name).convert('RGBA')
    frames = {}
    for name, box, x, floor in poses:
        isolated = source
        if name in (gutters or {}):
            mask = Image.new('L', source.size)
            ImageDraw.Draw(mask).polygon(gutters[name], fill=255)
            isolated = source.copy()
            isolated.putalpha(ImageChops.multiply(source.getchannel('A'), mask))
        crop = isolated.crop(box)
        crop = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.LANCZOS)
        frame = Image.new('RGBA', (512, 512))
        frame.alpha_composite(crop, (round(256 - (x - box[0]) * scale), round(464 - (floor - box[1]) * scale)))
        bounds = frame.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
        assert bounds and min(bounds) > 0 and max(bounds) < 512, (name, bounds)
        path = out / 'frames' / ('base-' + name)
        frame.save(path.with_suffix('.png'))
        frame.save(path.with_suffix('.webp'), 'WEBP', quality=88, method=6)
        frame.resize((256, 256), Image.Resampling.LANCZOS).save(path.with_suffix('.lite.webp'), 'WEBP', quality=80, method=6)
        frames[name] = {'path': path.with_suffix('.webp').relative_to(BASE).as_posix(),
                        'lite': path.with_suffix('.lite.webp').relative_to(BASE).as_posix(),
                        'bounds': list(bounds), 'anchor': [256, 464]}
    return frames


def build(only=None):
    families = {actor: {'manifest': ('' if actor == 'reaver' else actor+'/')+'base-actions.json',
                       'rig': ('' if actor == 'reaver' else actor+'/')+actor+'-base.rig.json',
                       'folder': '' if actor == 'reaver' else actor+'/'} for actor in CLASSES}
    starter = json.loads((ROOT / 'content/config/ui/presentation/presentationSequence.json').read_text())['components']['starter']
    pose_template = json.loads((BASE / 'reaver-sword.rig.json').read_text())['poses']['ready']
    for actor, weapon in CLASSES.items():
        if only and actor != only:
            continue
        out = BASE if actor == 'reaver' else BASE / actor
        legacy = json.loads((out / 'manifest.json').read_text())
        names = ['ready', 'windup', 'advance', 'contact', 'follow', 'return', 'power', 'channel', 'release']
        frames = {name: legacy['frames'][name] for name in names}
        recipes = {}
        if actor == 'reaver':
            frames.update(normalize(out, 'full-cape-attack.png', .72, ATTACK, GUTTERS))
            powers = [(name, (i*724, 0, (i+1)*724, 724), x, 650)
                      for i, (name, x) in enumerate(zip(['power', 'channel', 'release'], [360, 1085, 1810]))]
            frames.update(normalize(out, 'full-cape-power.png', .66, powers))
            recipes.update(attack={'source': 'full-cape-attack.png', 'scale': .72, 'poses': ATTACK, 'gutters': GUTTERS},
                           power={'source': 'full-cape-power.png', 'scale': .66, 'poses': powers})
        if actor == 'herald':
            # Exclude a neighboring cape fragment from the lower-right gutter.
            ready = [('ready', (0, 0, 560, 516), 280, 502)]
            gutter = {'ready': [(0, 0), (560, 0), (560, 320), (530, 350), (530, 516), (0, 516)]}
            frames.update(normalize(out, 'attack-left-shield.png', .68, ready, gutter))
            recipes['ready'] = {'source': 'attack-left-shield.png', 'scale': .68, 'poses': ready, 'gutters': gutter}
        scale, anchors, floor = DEFENSE[actor]
        guards = [(name, (i*724, 0, (i+1)*724, 724), anchors[i], floor)
                  for i, name in enumerate(['guard-rise', 'guard-brace', 'guard-return'])]
        if actor == 'herald':
            # The raised sword tip crosses the nominal first-cell boundary by 8 px.
            # The actual transparent gutter sits at x=760; retain the complete tip.
            guards[0] = ('guard-rise', (0, 0, 760, 724), anchors[0], floor)
            guards[1] = ('guard-brace', (760, 0, 1448, 724), anchors[1], floor)
        frames.update(normalize(out, 'base-defense.png', scale, guards))
        recipes['defense'] = {'source': 'base-defense.png', 'scale': scale, 'poses': guards}
        sequences = {
            'attack': {'label': 'Base strike · dash', 'poses': ['windup', 'advance', 'contact', 'follow', 'return'],
                       'durations': [60, 55, 50, 45, 50], 'travel': [0, 0, 96, 96, 0],
                       'effect': legacy['sequences']['attack']['effect'], 'impact': 2, 'hold': False},
            'defense': {'label': 'Base defense', 'poses': ['ready', 'guard-rise', 'guard-brace', 'guard-return', 'ready'],
                        'durations': [60, 55, 50, 45, 50], 'travel': [0, -3, -6, -3, 0],
                        'effect': 'shieldBash' if actor == 'herald' else 'ward', 'impact': 2, 'hold': False},
            'power': {'label': 'Base power', 'poses': ['ready', 'power', 'channel', 'release', 'ready'],
                      'durations': [60, 55, 50, 45, 50], 'travel': [0, 0, 0, 0, 0],
                      'effect': 'ward', 'impact': 2, 'hold': False},
        }
        manifest = {'schemaVersion': 1, 'target': 'alternative/dev', 'status': 'authoring-preview',
                    'classId': actor, 'armour': 'default', 'referenceWeapon': weapon,
                    'selection': 'class-default', 'equipmentIndependent': True,
                    'frames': frames, 'sequences': sequences,
                    'bytes': {tier: sum((BASE / f['lite' if tier == 'lite' else 'path']).stat().st_size for f in frames.values()) for tier in ['webp', 'lite']},
                    'sourceHashes': {r['source']: hashlib.sha256((out / 'source' / r['source']).read_bytes()).hexdigest() for r in recipes.values()}}
        rig = {'schemaVersion': 1, 'name': f'{actor.title()} · base strike, defense and power',
               'canvas': {'width': 512, 'height': 512}, 'assets': {}, 'poses': {}, 'animations': {}, 'queues': {}}
        for name, frame in frames.items():
            rig['assets'][name] = {'id': name, 'src': uri(BASE / frame['path'])}
            pose = json.loads(json.dumps(pose_template))
            pose.update(id=name, name=name, reviewed=False)
            pose['layers'][0]['assetId'] = name
            rig['poses'][name] = pose
        for action, seq in sequences.items():
            rig['animations'][action] = {'id': action, 'name': seq['label'], 'frames': [
                {'id': action+'-'+str(i), 'poseId': pose, 'duration': seq['durations'][i],
                 'event': 'contact' if i == seq['impact'] else '', 'overrides': {'figure': {'x': seq['travel'][i]}}}
                for i, pose in enumerate(seq['poses'])]}
            project = {**starter, 'id': f'alternative.base.{actor}.{action}', 'name': actor.title()+' · '+seq['label'],
                       'actor': actor, 'duration': 260, 'poses': seq['poses'], 'bindings': [], 'assets': {},
                       'dependencies': ['ashenspire.effects']}
            for pose in seq['poses']:
                project['assets']['pose:'+pose] = uri(BASE / frames[pose]['path'])
            effect = seq['effect']
            project['clips'] = [{'id': 'effect-'+effect, 'effect': effect, 'cue': 'contact', 'offset': -15,
                                 'duration': 130, 'anchor': 'weapon' if action == 'attack' else 'hand',
                                 'x': 0, 'y': 0, 'size': 190, 'opacity': .6, 'rotation': 0,
                                 'layer': 'front', 'travel': False, 'muted': False}]
            for i in range(1, 7):
                key = f'assets/combat-effects/{effect}{i}.webp'
                project['assets'][key] = uri(ROOT / key.replace('assets/', 'assets-mobile/', 1))
            write_json(out / f'base-{action}.pose.json', project, True)
        rig['queues']['review'] = {'id': 'review', 'name': 'Three base actions', 'items': [
            {'id': 'queue-'+a, 'animationId': a, 'repeats': 1, 'pause': 600} for a in ACTIONS]}
        write_json(out / f'{actor}-base.rig.json', rig, True)
        write_json(out / 'base-actions.json', manifest)
        write_json(out / 'source/base-normalization.json', recipes)
        folder = '' if actor == 'reaver' else actor+'/'
        families[actor] = {'manifest': folder+'base-actions.json', 'rig': folder+actor+'-base.rig.json', 'folder': folder}
        print(actor, len(frames), 'poses', manifest['bytes'])
    write_json(BASE / 'base-action-registry.json', {'schemaVersion': 1, 'selection': 'class-default',
        'equipmentIndependent': True, 'classes': list(CLASSES), 'actions': ACTIONS, 'families': families,
        'notes': ['Base armour and class reference weapon only.', 'Equipped weapons do not select animations.',
                  'Tag-combination choreography is deferred.', 'Authoring preview; no gameplay bindings.']})


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--class', dest='actor', choices=list(CLASSES))
    build(parser.parse_args().actor)
