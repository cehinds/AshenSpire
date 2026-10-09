"""Export the reviewed idle collection; never infer animation/action anchors."""
import hashlib
import json
import shutil
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/design/combat-depth-2026-10-05'
OUT = ROOT / 'assets-display/alternative'
SHARED = ROOT / 'assets-display/shared'
SOURCE_COMMIT = '41ae95ae42cce66e56805cc35ae1903a92a4d5a5'
OUT.mkdir(parents=True, exist_ok=True)
SHARED.mkdir(parents=True, exist_ok=True)
catalog = json.loads((SOURCE / 'catalog.json').read_text(encoding='utf-8'))
scenes = json.loads((SOURCE / 'continuation/scene-catalog.json').read_text(encoding='utf-8'))
hashes = {}
file_paths = {}
sources = {}
encoder = shutil.which('cwebp')
if not encoder:
    raise SystemExit('alternative-art-build: put the libwebp cwebp encoder on PATH before exporting')

# Query the shared policy once; both device paths retain the same export
# bytes, while their scene compositions remain independently authored.
items = [(entry['id'], SOURCE / entry['file'], True) for entry in catalog['entries']]
items += [(entry['id'], SOURCE / entry['file'], False) for entry in catalog['layers']]
items += [('card-section-texture', SOURCE / 'layers/card-section-texture.png', False)]
items += [('scene-' + entry['id'], SOURCE / 'continuation' / entry['file'], False)
          for entry in scenes['layers']]
requests = []
for id, source, sprite in items:
    if not source.resolve().is_relative_to(SOURCE.resolve()):
        raise ValueError(f'Artwork source escapes the master directory: {source}')
    with Image.open(source) as image:
        width, height = image.size
    requests.append({'path': ('sprites/' if sprite else 'environments/') + id + '.webp',
                     'width': width, 'height': height})
plans = dict(zip((item[0] for item in items), json.loads(subprocess.run(
    ['node', str(ROOT / 'tools/art-export-plan.mjs')], input=json.dumps(requests),
    text=True, capture_output=True, check=True, cwd=ROOT).stdout), strict=True))

def encode(id, source, expected=None, sprite=False):
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if expected and digest != expected:
        raise ValueError(f'Unreviewed source bytes: {source}')
    with Image.open(source) as image:
        source_size = list(image.size)
    plan = plans[id]
    paths = {}
    for device in ('desktop', 'phone'):
        folder = SHARED if any(entry['id'] == id and entry['family'] == 'companion' for entry in catalog['entries']) else OUT
        target = folder / (id + ('-mobile' if device == 'phone' else '') + '.webp')
        if device == 'phone':
            shutil.copyfile(folder / (id + '.webp'), target)
        else:
            args = [encoder, '-quiet', '-m', '6', '-q', str(plan['quality']),
                    '-alpha_q', str(plan['alphaQuality']), '-alpha_filter', 'best']
            if [plan['width'], plan['height']] != source_size:
                args += ['-resize', str(plan['width']), str(plan['height'])]
            subprocess.run(args + [str(source), '-o', str(target)], check=True)
        hashes[target.name] = hashlib.sha256(target.read_bytes()).hexdigest()
        file_paths[target.name] = target.relative_to(ROOT).as_posix()
        paths['path' if device == 'desktop' else 'mobilePath'] = file_paths[target.name]
    paths['size'] = [plan['width'], plan['height']]
    sources[id] = {'file': source.relative_to(SOURCE).as_posix(), 'sha256': digest,
                   'size': source_size}
    return paths

sprites = {}
for entry in catalog['entries']:
    if entry.get('status') != 'generated':
        raise ValueError(f'Unfinished actor: {entry["id"]}')
    sprites[entry['id']] = {k: entry[k] for k in ('name', 'family', 'facing', 'pose')}
    paths = encode(entry['id'], SOURCE / entry['file'], entry['validation']['sha256'], True)
    original_size = entry['validation']['size']
    if sources[entry['id']]['size'] != original_size:
        raise ValueError(f"Revalidate changed master dimensions for {entry['id']}")
    original_bounds = entry['validation']['visibleBounds']
    bounds = [value * paths['size'][index % 2] / original_size[index % 2]
              for index, value in enumerate(original_bounds)]
    sprites[entry['id']].update(paths, bounds=bounds,
        sourceSize=original_size, sourceBounds=original_bounds)

layers = {}
mobileLayers = {}
layer_sizes = {}
for entry in catalog['layers'] + [{'id': 'card-section-texture', 'file': 'layers/card-section-texture.png'}]:
    paths = encode(entry['id'], SOURCE / entry['file'])
    layers[entry['id']] = paths['path']
    mobileLayers[entry['id']] = paths['mobilePath']
    layer_sizes[entry['id']] = paths['size']
sceneLayers = {}
for entry in scenes['layers']:
    sceneLayers[entry['id']] = encode('scene-' + entry['id'], SOURCE / 'continuation' / entry['file'], entry['sha256'])
    sceneLayers[entry['id']]['kind'] = entry['kind']

manifest = {'sourceCommit': SOURCE_COMMIT, 'anchorContract': 'Idle alpha bounds only; no action or hand anchors.',
    'sprites': sprites, 'layers': layers, 'layerSizes': layer_sizes,
    'mobileLayers': mobileLayers, 'sceneLayers': sceneLayers,
    'scenes': {s['id']: {k: s[k] for k in ('name', 'region', 'devices')} for s in scenes['scenes']},
    'sources': sources, 'hashes': dict(sorted(hashes.items())), 'filePaths': dict(sorted(file_paths.items()))}
(ROOT / 'src/ui/alternativeArtCatalog.js').write_text(
    '// Generated by tools/alternative-art-build.py from reviewed masters.\n'
    + 'export const alternativeArtCatalog = ' + json.dumps(manifest, separators=(',', ':')) + ';\n', encoding='utf-8', newline='\n')
print(f'Encoded {len(sprites)} idle actors and {len(sceneLayers)} scene layers for both devices; '
      f'{len(hashes)} files, {sum((ROOT / file_paths[name]).stat().st_size for name in hashes):,} bytes.')
