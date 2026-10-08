"""Normalize whole animation sheets and export class-default card actions.

Pillow is used only for lossless alpha isolation, shared-scale normalization,
and WebP export. Painted poses come from the recorded imagegen source sheets.
"""
import argparse
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'pose-studio/renewal'
OUT = BASE / 'cards'
spec = importlib.util.spec_from_file_location('base_actions', ROOT / 'tools/alternative-base-actions-build.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
write_json, uri = base.write_json, base.uri
CLASSES = {'reaver': 'Two-handed greatsword · crossbow', 'rogue': 'Twin daggers · bow',
           'starseer': 'Staff · open spellbook and upward staff', 'herald': 'Unarmed · open spellbook'}
ACTIONS = ['attack', 'smash', 'sweep', 'counter', 'defend', 'spell', 'ranged', 'rangedMagic']
SHEETS = {'melee': ['attack-load', 'attack-contact', 'ready', 'smash-load', 'smash-contact', 'smash-return',
                    'sweep-load', 'sweep-contact', 'sweep-return'],
          'guard': ['guard-rise', 'guard-brace', 'guard-return', 'counter-load', 'counter-parry', 'counter-contact'],
          'casting': ['spell-load', 'spell-release', 'spell-return', 'ranged-load', 'ranged-aim', 'ranged-release',
                      'magic-load', 'magic-release', 'magic-return']}


def components(image, count):
    """Isolate connected silhouettes, including fine alpha fringes, without cell cuts."""
    alpha = image.getchannel('A')
    w, h = image.size
    occupied = bytearray(1 if p > 8 else 0 for p in alpha.tobytes())
    regions = []
    for seed in range(len(occupied)):
        if not occupied[seed]:
            continue
        occupied[seed] = 0
        stack, pixels = [seed], []
        while stack:
            p = stack.pop()
            pixels.append(p)
            x, y = p % w, p // w
            for yy in range(max(0, y-1), min(h, y+2)):
                for xx in range(max(0, x-1), min(w, x+2)):
                    q = yy*w+xx
                    if occupied[q]:
                        occupied[q] = 0
                        stack.append(q)
        if len(pixels) > 2000:
            mask = bytearray(w*h)
            for p in pixels:
                mask[p] = 255
            mask = Image.frombytes('L', image.size, bytes(mask)).filter(ImageFilter.MaxFilter(5))
            isolated = image.copy()
            isolated.putalpha(ImageChops.multiply(alpha, mask))
            regions.append(isolated)
    assert len(regions) == count, f'Expected {count} separate figures, found {len(regions)}'
    regions.sort(key=lambda im: im.getbbox()[3])
    ordered = []
    for i in range(0, count, 3):
        ordered.extend(sorted(regions[i:i+3], key=lambda im: im.getbbox()[0]))
    return ordered


def normalize(actor, sheet, diagnostic=False, body_height=355):
    folder = OUT / actor
    source = Image.open(folder / 'source' / (sheet+'.png')).convert('RGBA')
    extrema = source.getchannel('A').getextrema()
    assert extrema[0] == 0 and extrema[1] >= 240, f'{actor}/{sheet}: no true alpha'
    names = SHEETS[sheet]
    if sheet == 'casting' and actor in ('starseer', 'herald'):
        names = names[:6]
    figures = components(source, len(names))
    boxes = [f.getbbox() for f in figures]
    # Match the upright recovery body between sheets, then constrain the WHOLE
    # sheet by its widest reach. No pose gets an independent size adjustment.
    scale = body_height / (boxes[2][3] - boxes[2][1])
    anchors = []
    for figure, box in zip(figures, boxes):
        # Include both boots even when a leaning pose lifts one heel. A single
        # lowest scanline can snap the anchor from one foot to the other.
        band = figure.getchannel('A').crop((0, max(box[1], box[3]-50), source.width, box[3]))
        weights = [(i % source.width, value) for i, value in enumerate(band.tobytes()) if value > 64]
        x = sum(px*weight for px, weight in weights)/sum(weight for _, weight in weights)
        anchors.append((x, box[3]))
        scale = min(scale, 238/max(x-box[0], box[2]-x), 440/(box[3]-box[1]))
    if diagnostic:
        print(actor, sheet, 'scale', round(scale, 4), 'boxes', boxes, 'anchors', anchors)
    frames = {}
    (folder / 'frames').mkdir(exist_ok=True)
    for name, figure, box, (x, floor) in zip(names, figures, boxes, anchors):
        crop = figure.crop(box)
        crop = crop.resize((round(crop.width*scale), round(crop.height*scale)), Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA', (512, 512))
        canvas.alpha_composite(crop, (round(256-(x-box[0])*scale), round(464-(floor-box[1])*scale)))
        bounds = canvas.getchannel('A').point(lambda p: 255 if p > 8 else 0).getbbox()
        assert bounds and all(0 < p < 512 for p in bounds), (actor, name, bounds)
        path = folder / 'frames' / (name+'.webp')
        canvas.save(path, quality=88, method=4)
        lite = path.with_name(name+'-lite.webp')
        canvas.resize((256, 256), Image.Resampling.LANCZOS).save(lite, quality=80, method=4)
        frames[name] = {'path': path.relative_to(BASE).as_posix(), 'lite': lite.relative_to(BASE).as_posix(),
                        'bounds': list(bounds), 'anchor': [256, 464]}
    recipe = {'source': sheet+'.png', 'sha256': hashlib.sha256((folder/'source'/(sheet+'.png')).read_bytes()).hexdigest(),
              'scale': scale, 'bounds': boxes, 'anchors': anchors, 'poses': names,
              'isolation': '8-connected alpha > 8; 2px edge fringe; no cell-boundary cuts'}
    return frames, recipe


def sequences(actor):
    def seq(label, poses, travel, effect, impact=2):
        return {'label': label, 'poses': poses, 'durations': [45, 40, 30, 95, 50] if impact == 3 else [60, 55, 50, 45, 50], 'travel': travel,
                'effect': effect, 'impact': impact, 'hold': False}
    melee = 'impact' if actor == 'herald' else 'slash'
    ranged_magic = actor in ('starseer', 'herald')
    return {
        'attack': seq('Attack', ['ready', 'attack-load', 'attack-contact', 'attack-contact', 'ready'], [0, 0, 80, 50, 0], melee),
        'smash': seq('Smash', ['ready', 'smash-load', 'smash-contact', 'smash-return', 'ready'], [0, -8, 60, 32, 0], 'impact'),
        'sweep': seq('Sweep', ['ready', 'sweep-load', 'sweep-contact', 'sweep-return', 'ready'], [0, 0, 55, 28, 0], melee),
        'counter': seq('Counter', ['ready', 'counter-load', 'counter-parry', 'counter-contact', 'ready'], [0, -12, -8, 45, 0], 'parry', 3),
        'defend': seq('Defend', ['ready', 'guard-rise', 'guard-brace', 'guard-return', 'ready'], [0, -3, -6, -3, 0], 'ward'),
        'spell': seq('Spell', ['spell-return', 'spell-load', 'spell-release', 'spell-release', 'spell-return'], [0]*5, 'ward'),
        'ranged': seq('Ranged · '+('magic' if ranged_magic else 'crossbow' if actor == 'reaver' else 'bow'),
                      ['ranged-load', 'ranged-aim', 'ranged-release', 'ranged-release', 'ranged-load'], [0, 0, -4, -2, 0],
                      'sacredbolt' if actor == 'herald' else 'starbolt' if ranged_magic else 'thrust'),
        'rangedMagic': seq('Ranged · magic',
                           ['ranged-load', 'ranged-load', 'ranged-aim', 'ranged-release', 'ranged-load'] if ranged_magic else
                           ['magic-return', 'magic-load', 'magic-release', 'magic-release', 'magic-return'], [0]*5,
                           'sacredbolt' if actor == 'herald' else 'starbolt'),
    }


def projects(actor, frames, seqs):
    folder = OUT / actor
    template = json.loads((BASE/'reaver-base.rig.json').read_text())['poses']['ready']
    starter = json.loads((ROOT/'content/config/ui/presentation/presentationSequence.json').read_text())['components']['starter']
    rig = {'schemaVersion': 1, 'name': actor.title()+' · card actions', 'canvas': {'width': 512, 'height': 512},
           'assets': {}, 'poses': {}, 'animations': {}, 'queues': {}}
    for name, frame in frames.items():
        rig['assets'][name] = {'id': name, 'src': uri(BASE/frame['path'])}
        pose = json.loads(json.dumps(template))
        pose.update(id=name, name=name, reviewed=False)
        pose['layers'][0]['assetId'] = name
        rig['poses'][name] = pose
    for action, seq in seqs.items():
        rig['animations'][action] = {'id': action, 'name': seq['label'], 'frames': [
            {'id': action+'-'+str(i), 'poseId': pose, 'duration': seq['durations'][i],
             'event': 'contact' if i == seq['impact'] else '', 'overrides': {'figure': {'x': seq['travel'][i]}}}
            for i, pose in enumerate(seq['poses'])]}
        project = {**starter, 'id': f'alternative.cards.{actor}.{action}', 'name': actor.title()+' · '+seq['label'],
                   'actor': actor, 'duration': 260, 'poses': seq['poses'], 'bindings': [], 'assets': {},
                   'dependencies': ['ashenspire.effects'], 'clips': []}
        for pose in seq['poses']:
            project['assets']['pose:'+pose] = uri(BASE/frames[pose]['path'])
        # Arrow is an existing projectile, not a six-frame combat effect.
        effect = seq['effect']
        if effect != 'arrow':
            project['clips'] = [{'id': 'effect-'+effect, 'effect': effect, 'cue': 'contact', 'offset': 0,
                'duration': 130, 'anchor': 'weapon', 'x': 0, 'y': 0, 'size': 190, 'opacity': .6,
                'rotation': 0, 'layer': 'front', 'travel': action.startswith('ranged'), 'muted': False}]
            for i in range(1, 7):
                key = f'assets/combat-effects/{effect}{i}.webp'
                project['assets'][key] = uri(ROOT/key.replace('assets/', 'assets-mobile/', 1))
        write_json(folder/(action+'.pose.json'), project, True)
    rig['queues']['review'] = {'id': 'review', 'name': 'Card action review', 'items': [
        {'id': 'queue-'+a, 'animationId': a, 'repeats': 1, 'pause': 500} for a in ACTIONS]}
    write_json(folder/(actor+'-cards.rig.json'), rig, True)


def build(diagnostic=False, only=None):
    (ROOT/'assets-display/alternative').mkdir(parents=True, exist_ok=True)
    families, runtime, hashes = {}, {}, {}
    for actor, weapon in CLASSES.items():
        if only and actor not in only:
            continue
        frames, recipes = {}, {}
        for sheet in SHEETS:
            body_height = 464-frames['ready']['bounds'][1] if 'ready' in frames else 355
            exported, recipe = normalize(actor, sheet, diagnostic, body_height)
            frames.update(exported)
            recipes[sheet] = recipe
        seqs = sequences(actor)
        # Staff/book and book casters aim with the upward casting pose and
        # release there before recovery; no physical ranged weapon is invented.
        if actor in ('starseer', 'herald'):
            seqs['ranged']['poses'] = seqs['rangedMagic']['poses']
        manifest = {'schemaVersion': 1, 'target': 'alternative/dev', 'classId': actor, 'armour': 'default',
                    'referenceWeapon': weapon, 'equipmentIndependent': True, 'selection': 'card-profile',
                    'frames': frames, 'sequences': seqs,
                    'bytes': {tier: sum((BASE/f['lite' if tier == 'lite' else 'path']).stat().st_size for f in frames.values()) for tier in ['webp', 'lite']}}
        folder = OUT/actor
        write_json(folder/'manifest.json', manifest)
        write_json(folder/'source/normalization.json', recipes)
        projects(actor, frames, seqs)
    for actor in CLASSES:
        manifest = json.loads((OUT/actor/'manifest.json').read_text())
        frames = manifest['frames']
        families[actor] = {'manifest': f'cards/{actor}/manifest.json', 'rig': f'cards/{actor}/{actor}-cards.rig.json', 'folder': f'cards/{actor}/'}
        runtime[actor] = {**manifest, 'frames': {}}
        for name, frame in frames.items():
            exported = {**frame}
            for key, suffix in [('path', ''), ('lite', '-mobile')]:
                filename = f'card-{actor}-{name}{suffix}.webp'
                data = (BASE/frame[key]).read_bytes()
                (ROOT/'assets-display/alternative'/filename).write_bytes(data)
                hashes[filename] = hashlib.sha256(data).hexdigest()
                exported[key] = 'assets-display/alternative/'+filename
            runtime[actor]['frames'][name] = exported
        print(actor, len(frames), 'poses', manifest['bytes'])
    write_json(OUT/'registry.json', {'schemaVersion': 1, 'selection': 'card-profile', 'equipmentIndependent': True,
        'classes': list(CLASSES), 'actions': ACTIONS, 'families': families})
    module = '// Generated by tools/alternative-card-actions-build.py.\nexport const alternativeCardAnimations = '
    (ROOT/'src/content/alternativeCardAnimations.js').write_text(module+json.dumps({'classes': runtime, 'hashes': hashes, 'filePaths': {name: 'assets-display/alternative/'+name for name in hashes}}, separators=(',', ':'))+';\n', encoding='utf-8', newline='\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--diagnostic', action='store_true')
    parser.add_argument('--classes', nargs='+', choices=list(CLASSES))
    args = parser.parse_args()
    build(args.diagnostic, args.classes)
