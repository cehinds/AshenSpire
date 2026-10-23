"""Build reusable components from existing artwork, recording reconstruction honestly."""
import copy
import hashlib
import importlib.util
import json
import subprocess
from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parent
spec = json.loads((ROOT / 'reuse-v5.json').read_text())
sources = json.loads((ROOT / 'generation-sources-v5.json').read_text())
data = json.loads((ROOT / 'cutout-manifest.json').read_text())
module_spec = importlib.util.spec_from_file_location('cutout_exporter', ROOT / 'export-cutouts.py')
exporter = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(exporter)

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def refs(action):
    return copy.deepcopy(next(t['references'] for t in data['cardTypes'] if t['id'] == action))

def register(path, id, kind, letter, digit, name, source, method, generation=None):
    im = Image.open(path).convert('RGBA')
    alpha = im.getchannel('A')
    assert alpha.getbbox(), path
    assert alpha.getextrema()[0] == (255 if kind == 'background' else 0), path
    t = exporter.transform(kind)
    if letter == 'O':
        t.update(width=432 if kind == 'object' else 512, height=540 if kind == 'object' else 640)
    action = source.get('action', 'attack' if digit == 0 else 'defend')
    data['assets'][id] = {
        'id': id, 'kind': kind, 'category': letter, 'digit': digit, 'name': name,
        'src': path.relative_to(ROOT).as_posix(), 'mimeType': 'image/png',
        'width': im.width, 'height': im.height, 'hasTransparency': alpha.getextrema()[0] < 255,
        'alphaBounds': list(alpha.getbbox()), 'sha256': digest(path),
        'defaultTransform': t, 'css': exporter.css(t),
        'combatReferences': refs(action), 'suggestedCardTypes': [action],
        'references': {
            'method': method, 'originalAssetId': source['originalAssetId'],
            'repositoryPath': source['repositoryPath'], 'sourceReference': source['reference'],
            'sourceSha256': source['sourceSha256'], 'sourceTier': source['sourceTier'],
            'originalArtRelease': spec['originalArtRelease'],
            'originalGameCommit': spec['originalGameCommit'],
            **(generation or {}),
        },
    }

for key, kind in [('objects', 'object'), ('effects', 'effect'), ('backgrounds', 'background')]:
    sheet = Path(sources[key]['path'])
    im = Image.open(sheet)
    width, height = im.size
    assert abs(width / height - 2) < .12, f'{key}: unexpected atlas ratio'
    boxes = None
    if kind == 'object':
        labels, count = ndimage.label(np.asarray(im.convert('RGBA').getchannel('A')) > 8)
        sizes = np.bincount(labels.ravel()); sizes[0] = 0
        largest = np.argsort(sizes)[-10:]
        assert sizes[largest].min() > 500
        slices = ndimage.find_objects(labels)
        boxes = [(slices[i-1][1].start, slices[i-1][0].start, slices[i-1][1].stop, slices[i-1][0].stop) for i in largest]
        boxes.sort(key=lambda b: (b[1]+b[3])/2)
        boxes = sorted(boxes[:5], key=lambda b:b[0]) + sorted(boxes[5:], key=lambda b:b[0])
    for r in spec['sources']:
        i = r['digit']; col, row = i % 5, i // 5
        x, y = round(col * width / 5), round(row * height / 2)
        right, bottom = round((col+1) * width / 5), round((row+1) * height / 2)
        out = ROOT / 'cutouts' / 'O' / key / f'{i}.png'
        out.parent.mkdir(parents=True, exist_ok=True)
        if boxes:
            bx, by, br, bb = boxes[i]
            x, y, right, bottom = max(0,bx-2), max(0,by-2), min(width,br+2), min(height,bb+2)
        args = ['magick', str(sheet), '-crop', f'{right-x}x{bottom-y}+{x}+{y}', '+repage']
        if kind in ['object','effect']:
            args += ['-resize', '480x608', '-background', 'none', '-gravity', 'center', '-extent', '512x640']
        else:
            args += ['-resize', '512x640!']
        args += ['-alpha', 'off'] if kind == 'background' else ['-define', 'png:color-type=6']
        subprocess.run([*args, '-define', 'png:exclude-chunk=date,time', str(out)], check=True)
        register(out, f'O.{kind}.{i}', kind, 'O', i,
            f"Existing {r['action']} · {r['palette']} · {kind}", r,
            'reconstructed-from-flattened-card', {
                'generationSourceFile': sheet.name, 'generationSourceSha256': digest(sheet),
                'sourceCell': {'x': x, 'y': y, 'width': right-x, 'height': bottom-y},
                'fidelity': 'Image-edit reconstruction. Visible design is referenced; original independent layers and hidden pixels are not recoverable exactly.',
            })
    print(f'Exported ten source-derived {key}.', flush=True)

for r in spec['nativeObjects']:
    i = r['digit']; source = ROOT / r['reference']
    out = ROOT / 'cutouts' / 'P' / 'objects' / f'{i}.png'
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['magick', str(source), '-define', 'png:color-type=6', '-define', 'png:exclude-chunk=date,time', str(out)], check=True)
    original = Image.open(source).convert('RGBA'); converted = Image.open(out).convert('RGBA')
    assert original.size == converted.size and original.tobytes() == converted.tobytes(), source
    register(out, f'P.object.{i}', 'object', 'P', i, r['name'], r,
        'lossless-format-conversion', {'decodedPixelsPreserved': True, 'sourceDecodedRgbaSha256': hashlib.sha256(original.tobytes()).hexdigest()})

data['categories'] = [c for c in data['categories'] if c['letter'] not in 'OP']
data['categories'] += [
    {'letter': 'O', 'id': 'existing-card-components', 'label': 'Existing card art', 'revision': 5,
     'references': [ref for action in ['attack','smash','sweep','defend','counter'] for ref in refs(action)],
     'objectIds': [f'O.object.{i}' for i in range(10)], 'effectIds': [f'O.effect.{i}' for i in range(10)],
     'backgroundId': 'O.background.0', 'exampleCodes': [f'O{i}{i}' for i in range(10)]},
    {'letter': 'P', 'id': 'native-transparent-reuse', 'label': 'Native asset reuse', 'revision': 5,
     'references': refs('attack') + refs('defend'),
     'objectIds': ['P.object.0','P.object.1'], 'effectIds': [f'O.effect.{i}' for i in range(10)],
     'backgroundId': 'O.background.0', 'exampleCodes': ['P00','P13','P14']},
]
for c in data['categories'][-2:]:
    letter = c['letter']
    for i, object_id in enumerate(c['objectIds']):
        for j, effect_id in enumerate(c['effectIds']):
            code = f'{letter}{i}{j}'
            comp = copy.deepcopy(data['compositions']['A00'])
            comp.update(code=code, category=letter, objectDigit=i, effectDigit=j)
            layers = {l['id']: l for l in comp['layers']}
            layers['background'].update(assetId=f'O.background.{i if letter == "O" else j}')
            layers['object'].update(assetId=object_id, overrides={})
            for id, opacity in [('backEffect', .28), ('foreground', .24)]:
                layers[id].update(assetId=effect_id, overrides={'opacity': opacity})
            if letter == 'O':
                comp['sourceReference'] = spec['sources'][i]['reference']
                if i in [4,9]:
                    sword = f'O.object.{0 if i == 4 else 5}'
                    layers['secondaryObject'].update(assetId=sword, visible=True, zIndex=15,
                        overrides={'x':330,'y':310,'width':400,'height':500,'rotationDeg':-20})
                    comp['reuseNote'] = 'Counter shield reconstructed from its card; sword reuses the matching Attack component, rather than claiming to recover its hidden original.'
            elif i == 1 and j in [4,9]:
                layers['secondaryObject'].update(assetId='P.object.0', visible=True, zIndex=15,
                    overrides={'x':315,'y':300,'width':460,'height':460,'rotationDeg':-15})
            data['compositions'][code] = comp

data['revision'] = 5
data['references']['reuseCatalog'] = 'reuse-v5.json'
data['scope']['confirmed'] = 'Earlier A–N assets preserved. Twelve existing-art object components added: ten reconstructed from flattened cards and two unchanged native PNG conversions.'
data['codeScheme']['nativeReuse'] = 'P has two existing objects (digits 0 and 1) and ten compatible effects (0–9): P00–P19. O has ten reconstructed objects/effects: O00–O99. Zero always selects a real variant.'
data['scope'].update(categoryCount=16, totalPngCount=262, totalObjectCountIncludingFire=142,
    physicalObjectCount=132, effectFileCount=100, backgroundCount=20,
    latestBatchObjectCount=12, latestBatchReconstructedComponentCount=30, latestBatchUnchangedObjectCount=2)
data['scope']['objectsPerCategory'] = {c['letter']:len(c['objectIds']) for c in data['categories']}
data['scope']['exampleCombinationsPerCategory'] = {c['letter']:len(c['exampleCodes']) for c in data['categories']}
for t in data['cardTypes']:
    if t['id'] in ['attack','smash','sweep','defend','counter'] and 'O' not in t['objectFamilies']:
        t['objectFamilies'].append('O')
    if t['id'] in ['attack','defend','counter'] and 'P' not in t['objectFamilies']:
        t['objectFamilies'].append('P')
for letter in 'OP':
    (ROOT/'cutouts'/letter/'assets.json').write_text(json.dumps({k:a for k,a in data['assets'].items() if a['category']==letter},indent=2)+'\n')
(ROOT/'cutout-manifest.json').write_text(json.dumps(data,indent=2)+'\n')
(ROOT/'cutouts-data.js').write_text('window.CARD_CUTOUT_DATA = '+json.dumps(data,separators=(',',':'))+';\n')
print(f"Revision 5: {len(data['assets'])} PNGs; {len(data['compositions'])} compositions; exact native pixels checked.")
