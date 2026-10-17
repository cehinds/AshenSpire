"""Export generated RGBA atlas cells into independent, consistently sized PNGs.

ImageMagick only crops/pads/resizes generated pixels; it does not synthesize art.
Run from any directory after generation-sources.json has been populated.
"""
import hashlib
import json
import subprocess
from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parent
SPEC = json.loads((ROOT / 'art-selection-v3.json').read_text())
SOURCES = json.loads((ROOT / 'generation-sources.json').read_text())

def run(*args):
    return subprocess.check_output([str(x) for x in args], text=True).strip()

def css(transform):
    return {
        'position': 'absolute',
        'left': f"{transform['x'] / 512 * 100:g}%",
        'top': f"{transform['y'] / 640 * 100:g}%",
        'width': f"{transform['width'] / 512 * 100:g}%",
        'height': f"{transform['height'] / 640 * 100:g}%",
        'objectFit': 'contain',
        'transformOrigin': '50% 50%',
        'transform': f"translate(-50%, -50%) rotate({transform['rotationDeg']:g}deg) scale({transform['scaleX']:g}, {transform['scaleY']:g})",
        'opacity': str(transform['opacity']),
        'mixBlendMode': transform['blendMode'],
        'pointerEvents': 'none',
    }

def transform(kind):
    return dict(x=256, y=320, width=512 if kind == 'background' else 460,
                height=640 if kind == 'background' else 460,
                rotationDeg=0, scaleX=1, scaleY=1, opacity=1,
                blendMode='normal', anchor=dict(x=.5, y=.5))

manifest = {
    'formatVersion': 1, 'revision': 3, 'runtimeEnabled': False,
    'coordinateSpace': {'width': 512, 'height': 640, 'units': 'px'},
    'codeScheme': SPEC['codeScheme'],
    'style': SPEC['style'], 'scope': SPEC['scope'], 'cardTypes': SPEC['cardTypes'], 'tagComposition': SPEC['tagComposition'],
    'layerOrder': ['background', 'backEffect', 'object', 'secondaryObject', 'foreground'],
    'transformContract': 'x/y locate the anchor in the 512x640 art crop. Width/height are the image element box, before scale. Rotation is clockwise degrees. CSS derives from numeric transforms; edit the numbers and regenerate CSS when exporting.',
    'orientationContract': 'Alternate orientation previews rotate the exact same PNG. They are not new three-dimensional camera views.',
    'references': {'sourceBranch': 'origin/Feature/json-game-modules', 'sourceCommit': '63ee50d0ff5f241d1259207f230ccbfcab315939', 'visualTarget': SPEC['reference'], 'identityCatalog': 'art-catalog.json', 'proposalCatalog': 'art-proposals-v2.json'},
    'assets': {}, 'categories': [], 'compositions': {},
}

background_names = ['Midnight gold', 'Charcoal silver', 'Dark teal bronze', 'Umber crimson', 'Wine black', 'Midnight violet', 'Forest green', 'Antique amber', 'Olive brown', 'Warm ivory black']
background_by_category = dict(zip('ABCDEFGH', [0, 4, 4, 3, 1, 6, 6, 9]))

def export_sheet(key, kind, letter=None, names=None):
    source = Path(SOURCES[key]['path'])
    im = Image.open(source).convert('RGBA')
    width, height = im.size
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    if kind != 'background':
        assert im.getchannel('A').getextrema()[0] == 0, f'{key}: source has no transparent pixels'
    ids = []
    for index in range(10):
        col, row = index % 5, index // 5
        x, right = round(col * width / 5), round((col + 1) * width / 5)
        y, bottom = round(row * height / 2), round((row + 1) * height / 2)
        out = ROOT / 'cutouts' / ('backgrounds' if kind == 'background' else f'{letter}/{kind}s') / f'{index}.png'
        out.parent.mkdir(parents=True, exist_ok=True)
        crop_x, crop_y, crop_right, crop_bottom = x, y, right, bottom
        if kind == 'object' and letter in 'ABCDEFG':
            # Locate the main connected object for a tighter rectangular crop.
            # This excludes neighboring atlas-cell fragments without repainting pixels.
            alpha_cell = np.asarray(im.getchannel('A').crop((x, y, right, bottom)))
            labels, count = ndimage.label(alpha_cell > 8)
            sizes = np.bincount(labels.ravel()); sizes[0] = 0
            assert count and sizes.max() > 0, f'{key}/{index}: no main object'
            rows, cols = np.where(labels == sizes.argmax())
            crop_x, crop_y = x + max(0, int(cols.min()) - 2), y + max(0, int(rows.min()) - 2)
            crop_right, crop_bottom = x + min(right-x, int(cols.max()) + 3), y + min(bottom-y, int(rows.max()) + 3)
        args = ['magick', source, '-crop', f'{crop_right-crop_x}x{crop_bottom-crop_y}+{crop_x}+{crop_y}', '+repage']
        if kind == 'background':
            args += ['-resize', '512x640^', '-gravity', 'center', '-extent', '512x640', '-alpha', 'off']
        else:
            args += ['-trim', '+repage', '-resize', '448x448', '-background', 'none', '-gravity', 'center', '-extent', '512x512', '-define', 'png:color-type=6']
        run(*args, out)
        exported = Image.open(out).convert('RGBA')
        alpha = exported.getchannel('A')
        low, high = alpha.getextrema()
        bbox = alpha.getbbox()
        assert bbox is not None, f'{key}/{index}: empty export'
        if kind != 'background':
            assert low == 0 and high > 0, f'{key}/{index}: not a usable transparent PNG'
            assert bbox[0] >= 24 and bbox[1] >= 24 and bbox[2] <= 488 and bbox[3] <= 488, f'{key}/{index}: missing safe margin'
        asset_id = f'background.{index}' if kind == 'background' else f'{letter}.{kind}.{index}'
        t = transform(kind)
        manifest['assets'][asset_id] = {
            'id': asset_id, 'kind': kind, 'category': letter, 'digit': index,
            'name': names[index],
            'combatReferences': next((c['references'] for c in SPEC['categories'] if c['letter'] == letter), []),
            'suggestedCardTypes': [c['id'] for c in SPEC['cardTypes'] if letter in c['objectFamilies']],
            'src': out.relative_to(ROOT).as_posix(),
            'mimeType': 'image/png', 'width': exported.width, 'height': exported.height,
            'hasTransparency': low < 255, 'alphaBounds': list(bbox),
            'sha256': hashlib.sha256(out.read_bytes()).hexdigest(),
            'defaultTransform': t, 'css': css(t),
            'references': {'generationKey': key, 'sourceFile': source.name, 'sourceSha256': source_hash,
                           'sourceCell': {'x': x, 'y': y, 'width': right-x, 'height': bottom-y},
                           'extractionCrop': {'x': crop_x, 'y': crop_y, 'width': crop_right-crop_x, 'height': crop_bottom-crop_y},
                           'visualReference': SPEC['reference']},
        }
        ids.append(asset_id)
    return ids

export_sheet('backgrounds', 'background', names=background_names)
for category in SPEC['categories']:
    letter = category['letter']
    objects = export_sheet(f'{letter}-objects', 'object', letter, [r['name'] for r in category['objects']])
    effects = export_sheet(f'{letter}-effects', 'effect', letter, [r['name'] for r in category['effects']])
    manifest['categories'].append({
        'letter': letter, 'id': category['id'], 'label': category['label'],
        'references': category['references'], 'objectIds': objects, 'effectIds': effects,
        'backgroundId': f'background.{background_by_category[letter]}',
        'exampleCodes': [f'{letter}{i}{i}' for i in range(10)],
    })
    for i in range(10):
        category['objects'][i]['asset'] = manifest['assets'][objects[i]]['src']
        category['effects'][i]['asset'] = manifest['assets'][effects[i]]['src']
    for i in range(10):
        for j in range(10):
            code = f'{letter}{i}{j}'
            manifest['compositions'][code] = {
                'code': code, 'category': letter, 'objectDigit': i, 'effectDigit': j,
                'layers': [
                    {'id': 'background', 'assetId': f'background.{background_by_category[letter]}', 'zIndex': 0, 'visible': True, 'overrides': {}},
                    {'id': 'backEffect', 'assetId': effects[j], 'zIndex': 10, 'visible': True, 'overrides': {'opacity': .5, 'width': 490, 'height': 490}},
                    {'id': 'object', 'assetId': objects[i], 'zIndex': 20, 'visible': True, 'overrides': {}},
                    {'id': 'secondaryObject', 'assetId': 'A.object.0', 'zIndex': 25, 'visible': False, 'overrides': {'x': 340, 'y': 330, 'width': 380, 'height': 380, 'rotationDeg': 20}},
                    {'id': 'foreground', 'assetId': effects[j], 'zIndex': 30, 'visible': True, 'overrides': {'opacity': .65}},
                ],
            }
    print(f'Exported {letter}: ten objects, ten effects; composed all 00–99 choices.', flush=True)

(ROOT / 'cutout-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
(ROOT / 'cutouts-data.js').write_text('window.CARD_CUTOUT_DATA = ' + json.dumps(manifest, separators=(',', ':')) + ';\n')
(ROOT / 'art-selection-v3.json').write_text(json.dumps(SPEC, indent=2) + '\n')
print(f"Exported {len(manifest['assets'])} standalone PNGs; {len(manifest['compositions'])} composition records.")
