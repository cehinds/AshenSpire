"""Technical atlas extraction only; all creative artwork comes from recorded sources.

Requires ImageMagick and Pillow (image metadata/alpha inspection only).
Run from any directory. No source image is modified.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image
import hashlib
import json
import subprocess
import numpy as np

ROOT = Path(__file__).resolve().parent
SIZE = 400


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def css(t, z):
    return dict(position='absolute', left=f"{t['x']}%", top=f"{t['y']}%",
                width=f"{t['size']}%", height=f"{t['size']}%", objectFit='contain',
                transform=f"translate(-50%, -50%) rotate({t['rotation']}deg)",
                transformOrigin='50% 50%', opacity=str(t['opacity']), zIndex=str(z),
                display='block' if t['visible'] else 'none')


def separators(alpha, count, axis):
    """Locate transparent gutters near the requested grid, without editing pixels."""
    length = alpha.shape[axis]
    weights = (alpha > 32).sum(axis=1-axis)
    edges = [0]
    for i in range(1, count):
        expected = round(i * length / count)
        radius = round(length / count * .24)
        lo, hi = expected-radius, expected+radius+1
        scores = weights[lo:hi]
        candidates = np.flatnonzero(scores == scores.min()) + lo
        # Prefer the middle of a blank gutter, not its first pixel.
        if scores.min() == 0:
            groups = np.split(candidates, np.where(np.diff(candidates) > 1)[0]+1)
            group = min(groups, key=lambda g: abs(float(g.mean())-expected))
            boundary = round(float(group.mean()))
        else:
            boundary = int(candidates[np.argmin(abs(candidates-expected))])
        edges.append(boundary)
    return edges + [length]


def main():
    sources = json.loads((ROOT / 'generation-sources.json').read_text())
    inventory = json.loads((ROOT / 'inventory.json').read_text())
    jobs = []
    for role in ('object', 'effect', 'glow'):
        (ROOT / 'png' / (role + 's')).mkdir(parents=True, exist_ok=True)

    def schedule(role, family, variant, source, reference, crop=None):
        jobs.append(dict(role=role, family=family, variant=variant, source=source,
                         reference=reference, crop=crop))

    for key, role in [('objects', 'object'), ('effects', 'effect'), ('glows', 'glow')]:
        for sheet in sources[key]:
            source = ROOT / sheet['path']
            with Image.open(source) as im:
                w, h = im.size
                alpha = np.array(im.getchannel('A'))
            cols, rows = sheet['columns'], sheet['rows']
            # Objects can sit at slightly different heights within each column.
            x_edges = separators(alpha, cols, 1)
            y_edges = separators(alpha, rows, 0)
            for row in range(rows):
                for col in range(cols):
                    single = key == 'objects' or len(sheet['group']) == 1
                    variant = row * cols + col if single else col
                    family = sheet['id'] if key == 'objects' else sheet['group'][0 if single else row][0]
                    if role == 'object':
                        x, right = x_edges[col:col+2]
                        local_y = separators(alpha[:, x:right], rows, 0)
                        y, bottom = local_y[row:row+2]
                    else:
                        y, bottom = y_edges[row:row+2]
                        local_x = separators(alpha[y:bottom, :], cols, 1)
                        x, right = local_x[col:col+2]
                    region = dict(x=x,y=y,width=right-x,height=bottom-y)
                    # Crop transparent padding only, then center the complete component.
                    ys, xs = np.where(alpha[y:bottom, x:right] > 8)
                    assert len(xs), (source, row, col)
                    right = min(right, x+int(xs.max())+4)
                    bottom = min(bottom, y+int(ys.max())+4)
                    x += max(0,int(xs.min())-3)
                    y += max(0,int(ys.min())-3)
                    crop = dict(x=x, y=y, width=right-x, height=bottom-y)
                    reference = dict(method='generated-atlas-cell', path=sheet['path'],
                                     sha256=sheet['sha256'], sourceSize=[w,h], cell=region, extractionCrop=crop,
                                     promptReference=f"generation-sources.json#{key}/{sheet.get('id', sheet.get('index'))}")
                    schedule(role, family, variant, source, reference, crop)

    existing = json.loads((ROOT.parent / 'cutout-manifest.json').read_text())['assets']
    for family, category in {'broken-sword':'Q', 'cracked-shield':'S', 'flame':'H',
                             'leaf':'G', 'hammer':'K', 'shield':'M'}.items():
        for variant in range(10):
            asset = existing[f'{category}.object.{variant}']
            source = ROOT.parent / asset['src']
            schedule('object', family, variant, source,
                     dict(method='existing-first-party-component', path='../'+asset['src'],
                          assetId=asset['id'], sha256=digest(source)))
    for family, category in {'crystal':'D', 'stone':'C'}.items():
        for variant in range(10):
            source = ROOT.parent / 'minerals' / 'png' / f'{category}{variant}-object.png'
            schedule('object', family, variant, source,
                     dict(method='existing-first-party-component', path='../minerals/png/'+source.name,
                          assetId=f'minerals.{category}.object.{variant}', sha256=digest(source)))

    def extract(job):
        role, family, variant = job['role'], job['family'], job['variant']
        path = ROOT / 'png' / (role+'s') / f'{family}-{variant}.png'
        args = ['magick', str(job['source'])]
        if job['crop']:
            c = job['crop']
            args += ['-crop', f"{c['width']}x{c['height']}+{c['x']}+{c['y']}", '+repage']
        inner = SIZE-24 if job['crop'] else SIZE
        args += ['-resize', f'{inner}x{inner}', '-background', 'none', '-gravity', 'center',
                 '-extent', f'{SIZE}x{SIZE}', str(path)]
        subprocess.run(args, check=True, capture_output=True)
        with Image.open(path) as im:
            alpha = im.getchannel('A')
            bounds = alpha.getbbox()
            assert bounds and alpha.getextrema()[0] == 0, path
        t = dict(x=50, y=50, size={'object':83,'effect':66,'glow':98}[role],
                 rotation=0, opacity={'object':1,'effect':.48,'glow':.18}[role], visible=True)
        z = {'glow':0,'object':1,'effect':2}[role]
        return dict(id=f'{role}.{family}.{variant}', role=role, family=family, variant=variant,
                    label=f'{family.replace("-", " ")} · {role} {variant}',
                    src=path.relative_to(ROOT).as_posix(), width=SIZE, height=SIZE,
                    hasTransparency=True, alphaBounds=list(bounds), sha256=digest(path),
                    reference=job['reference'], transform=t, zIndex=z, css=css(t,z))

    with ThreadPoolExecutor(max_workers=6) as pool:
        components = list(pool.map(extract, jobs))
    statuses, presets = [], []
    for entry in inventory['statuses']:
        family = entry['recipe'].removeprefix('symbol.')
        row = dict(entry, objectFamily=family,
                   objectIds=[f'object.{family}.{i}' for i in range(10)],
                   effectIds=[f'effect.{entry["id"]}.{i}' for i in range(10)],
                   glowIds=[f'glow.{entry["id"]}.{i}' for i in range(10)])
        statuses.append(row)
        for i in range(10):
            presets.append(dict(code=f'{entry["codePrefix"]}{i}{i}', statusId=entry['id'],
                                objectVariant=i, effectVariant=i,
                                layers=[row['glowIds'][i],row['objectIds'][i],row['effectIds'][i]]))
    manifest = dict(format='ashenspire.status-cutouts/1', collection='statuses', status='proposal',
                    scope='71 current runtime statuses only', canvas=dict(width=SIZE,height=SIZE),
                    layerOrder=['glow','object','effect'],
                    codeFormat='statuses-NN/Axy: volume + category letter + object digit + effect digit. Zero is a real variant; visibility hides a layer.',
                    units='x/y/size: percent of square canvas; rotation: degrees; opacity: 0–1.',
                    references=['inventory.json','generation-sources.json','../art-catalog.json','../../../../src/content/statuses.js'],
                    statuses=statuses, components=components, presets=presets)
    (ROOT / 'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    (ROOT / 'data.js').write_text('window.STATUS_ART = '+json.dumps(manifest,separators=(',',':'))+';\n')
    inventory['status'] = 'proposal-complete'
    (ROOT / 'inventory.json').write_text(json.dumps(inventory,indent=2)+'\n')
    print(f'{len(statuses)} statuses; {len(presets)} presets; {len(components)} unique PNG components')


if __name__ == '__main__':
    main()
