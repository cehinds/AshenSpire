"""Extract aligned PNG cells with ImageMagick; preserve source art unchanged."""
from pathlib import Path
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parent


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def css(t, z):
    return dict(position='absolute', left=f"{t['x']}%", top=f"{t['y']}%",
                width=f"{t['size']}%", height=f"{t['size']}%", objectFit='contain',
                transform=f"translate(-50%, -50%) rotate({t['rotation']}deg)",
                transformOrigin='50% 50%', opacity=t['opacity'], zIndex=z)


def main():
    sources = json.loads((ROOT / 'sources.json').read_text())
    isolation = json.loads((ROOT / 'isolation-crops.json').read_text())['rectangles']
    manifest = dict(format='ashenspire.mineral-cutouts/1', collection='minerals',
                    status='proposal', canvas=dict(width=400, height=400),
                    codeFormat='Category + object digit + effect digit; 0 is a real variant. Prefix with minerals/ to distinguish the weapon library.',
                    layerOrder=['object', 'cracks', 'glow'],
                    units='x/y/size are percentages of square canvas; rotation is degrees; opacity is 0–1.',
                    references=['sources.json'], families=[], components=[], presets=[])
    (ROOT / 'png').mkdir(exist_ok=True)
    for family in sources['families']:
        code = family['code']
        manifest['families'].append(dict(code=code, name=family['name'], names=family['names']))
        for role in manifest['layerOrder']:
            source = ROOT / family['layers'][role]['path']
            w, h = map(int, subprocess.check_output(['magick', 'identify', '-format', '%w %h', str(source)]).split())
            assert digest(source) == family['layers'][role]['sha256']
            for i in range(10):
                col, row = i % 5, i // 5
                x, y = round(col * w / 5), round(row * h / 2)
                cw, ch = round((col + 1) * w / 5) - x, round((row + 1) * h / 2) - y
                path = Path('png') / f'{code}{i}-{role}.png'
                subprocess.run(['magick', str(source), '-crop', f'{cw}x{ch}+{x}+{y}', '+repage',
                                '-resize', '400x400!', str(ROOT / path)], check=True)
                # Technical atlas isolation: discard adjacent-cell fragments,
                # retaining the main sprite's original canvas coordinates.
                rect = isolation.get(path.name)
                if rect:
                    ix, iy, iw, ih = rect
                    subprocess.run(['magick', '-size', '400x400', 'canvas:none', '(', str(ROOT / path),
                                    '-crop', f'{iw}x{ih}+{ix}+{iy}', '+repage', ')',
                                    '-geometry', f'+{ix}+{iy}', '-compose', 'over', '-composite', str(ROOT / path)], check=True)
                t = dict(x=50, y=50, size=90 if role != 'cracks' else 60,
                         rotation=0, opacity={'object': 1, 'cracks': .85, 'glow': .18}[role], visible=True)
                z = manifest['layerOrder'].index(role)
                manifest['components'].append(dict(id=f'minerals.{code}.{role}.{i}', category=code,
                    variant=i, role=role, label=f'{code}{i} · {family["names"][i]} · {role}',
                    src=path.as_posix(), width=400, height=400, alpha=True,
                    sha256=digest(ROOT / path), transform=t, css=css(t, z), zIndex=z,
                    reference=dict(source=family['layers'][role]['path'], crop=[x,y,cw,ch],
                                   normalizedSize=[400,400], isolationCrop=rect, sourceSha256=digest(source))))
        for i in range(10):
            manifest['presets'].append(dict(id=f'minerals/{code}{i}{i}', category=code,
                objectVariant=i, effectVariant=i, name=family['names'][i],
                layers=[f'minerals.{code}.{role}.{i}' for role in manifest['layerOrder']]))
    (ROOT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (ROOT / 'data.js').write_text('window.MINERAL_ART = ' + json.dumps(manifest, separators=(',', ':')) + ';\n')
    print(f'Exported {len(manifest["components"])} RGBA components and {len(manifest["presets"])} presets.')


if __name__ == '__main__':
    main()
