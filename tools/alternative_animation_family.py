"""Shared transparent-frame and portable-project export for alternative studies."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops
import base64
import hashlib
import json
import runpy
import sys

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'pose-studio/renewal'


def build_family(actor, loadout, label, sheets, *, notes, effect='slash',
                 two_handed=(), gutters=None, rig_label=None):
    out = BASE / actor
    (out / 'frames').mkdir(parents=True, exist_ok=True)
    gutters = gutters or {}
    frames = {}
    for file, scale, poses in sheets.values():
        source = Image.open(out / 'source' / file).convert('RGBA')
        for name, box, x, y in poses:
            if '--packages-only' in sys.argv:
                frame = Image.open(out / 'frames' / f'{name}.png').convert('RGBA')
            else:
                isolated = source
                if name in gutters:
                    mask = Image.new('L', source.size)
                    ImageDraw.Draw(mask).polygon(gutters[name], fill=255)
                    isolated = source.copy()
                    isolated.putalpha(ImageChops.multiply(source.getchannel('A'), mask))
                crop = isolated.crop(box)
                crop = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.LANCZOS)
                frame = Image.new('RGBA', (512, 512))
                frame.alpha_composite(crop, (round(256 - (x - box[0]) * scale), round(464 - (y - box[1]) * scale)))
                frame.save(out / 'frames' / f'{name}.png')
                frame.save(out / 'frames' / f'{name}.webp', 'WEBP', quality=88, method=6)
                frame.resize((256, 256), Image.Resampling.LANCZOS).save(out / 'frames' / f'{name}.lite.webp', 'WEBP', quality=80, method=6)
            bounds = frame.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
            assert bounds and min(bounds) > 0 and max(bounds) < 512, (name, bounds)
            frames[name] = {'path': f'{actor}/frames/{name}.webp', 'lite': f'{actor}/frames/{name}.lite.webp', 'bounds': list(bounds), 'anchor': [256, 464]}

    def uri(path):
        return 'data:image/webp;base64,' + base64.b64encode(path.read_bytes()).decode()

    manifest = json.loads((BASE / 'manifest.json').read_text())
    manifest.update(frames=frames, classId=actor, loadout=loadout, notes=notes)
    manifest['sequences']['attack'].update(label=label, effect=effect)
    manifest['coverage'] = [dict(row, status='draft' if row['classId'] == actor and row['loadout'] == loadout else 'pending') for row in manifest['coverage']]
    manifest['bytes'] = {tier: sum(p.stat().st_size for p in (out / 'frames').glob('*.lite.webp' if tier == 'lite' else '*.webp') if tier == 'lite' or '.lite.' not in p.name) for tier in ['webp', 'lite']}
    manifest['sourceHashes'] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in (out / 'source').glob('*.png')}
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')

    rig = json.loads((BASE / 'reaver-sword.rig.json').read_text())
    rig['name'] = f'Alternative {actor.title()} · {rig_label or loadout}'
    for name in frames:
        rig['assets'][name]['src'] = uri(out / 'frames' / f'{name}.webp')
        rig['poses'][name]['gripMode'] = 'two-handed' if name in two_handed else 'one-handed'
    rig['animations']['attack']['name'] = label
    (out / f'{actor}-{loadout}.rig.json').write_text(json.dumps(rig, separators=(',', ':')))
    for action in ['attack', 'power', 'spell']:
        project = json.loads((BASE / f'{action}.pose.json').read_text())
        project.update(actor=actor, id=f'alternative.{actor}.{loadout}.{action}', name=f'Alternative {actor.title()} · ' + manifest['sequences'][action]['label'])
        for pose in project['poses']:
            project['assets']['pose:' + pose] = uri(out / 'frames' / f'{pose}.webp')
        if action == 'attack' and effect != 'slash':
            project['clips'][0].update(effect=effect, id='effect-' + effect)
            project['assets'] = {k: v for k, v in project['assets'].items() if not k.startswith('assets/combat-effects/')}
            for i in range(1, 7):
                path = f'assets/combat-effects/{effect}{i}.webp'
                project['assets'][path] = uri(ROOT / path.replace('assets/', 'assets-mobile/', 1))
        (out / f'{action}.pose.json').write_text(json.dumps(project, separators=(',', ':')))
    normalization = {'sheets': sheets, 'gutters': gutters} if gutters else sheets
    (out / 'source/normalization.json').write_text(json.dumps(normalization, indent=2) + '\n')
    runpy.run_path(str(ROOT / 'tools/alternative-animation-registry.py'))['refresh']()
    print(json.dumps({'actor': actor, 'frames': len(frames), 'bytes': manifest['bytes']}))
