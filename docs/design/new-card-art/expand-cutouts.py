"""Export one new object set, or assemble revision 4 without altering earlier IDs.

python3 expand-cutouts.py --family I  # export once generation-sources-v4.json exists
python3 expand-cutouts.py             # assemble all five exported families
"""
import argparse
import copy
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--family', choices=list('IJKLM'))
args = parser.parse_args()
expansion = json.loads((ROOT / 'expansion-v4.json').read_text())
data = json.loads((ROOT / 'cutout-manifest.json').read_text())
families = expansion['families']
types = {'I': 'spell', 'J': 'attack', 'K': 'smash', 'L': 'sweep', 'M': 'defend'}

def save(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')

if args.family:
    f = next(f for f in families if f['letter'] == args.family)
    letter = f['letter']
    module_spec = importlib.util.spec_from_file_location('cutout_exporter', ROOT / 'export-cutouts.py')
    exporter = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(exporter)
    exporter.SOURCES = json.loads((ROOT / 'generation-sources-v4.json').read_text())
    references = next(t['references'] for t in data['cardTypes'] if t['id'] == types[letter])
    exporter.SPEC['categories'].append({'letter': letter, 'references': references})
    for t in exporter.SPEC['cardTypes']:
        if t['id'] == types[letter]:
            t['objectFamilies'].append(letter)
    names = [f['label'].replace(' II', '').rstrip('s') + ' variant ' + str(i) for i in range(10)]
    exporter.export_sheet(letter + '-objects', 'object', letter, names)
    if letter == 'I':
        exporter.export_sheet('I-effects', 'effect', 'I', [
            'Violet orbital haze', 'Teal rising wisps', 'Blue protective ring',
            'Purple crescent haze', 'Violet ascending curl', 'Gold rising rays',
            'Pale violet spiral', 'Blue radial sparks', 'Violet fragmented ring',
            'Blue violet motes'])
    for a in exporter.manifest['assets'].values():
        if a['kind'] == 'object':
            a['proposalDescription'] = f['items'][a['digit']]
            if letter in 'JM':
                a['suggestedCardTypes'].append('counter')
                a['combatReferences'] = a['combatReferences'] + next(t['references'] for t in data['cardTypes'] if t['id'] == 'counter')
    save(ROOT / 'cutouts' / letter / 'assets.json', exporter.manifest['assets'])
    print(f'Exported {letter}: ten standalone objects' + (' and ten spell effects.' if letter == 'I' else '.'))
    raise SystemExit(0)

for f in families:
    data['assets'].update(json.loads((ROOT / 'cutouts' / f['letter'] / 'assets.json').read_text()))

data['categories'] = [c for c in data['categories'] if c['letter'] not in 'IJKLMN']
data['revision'] = 4
data['scope'].update({
    'confirmed': 'Original 70 core objects, ten cleansing fires, plus 50 new objects. Counter pairs reuse separate sword and shield PNGs.',
    'latestBatchObjectCount': 50, 'physicalObjectCount': 120,
    'totalObjectCountIncludingFire': 130, 'categoryCount': 14, 'effectFileCount': 90,
    'totalPngCount': 230,
})
data['references']['expansionCatalog'] = 'expansion-v4.json'
data['codeScheme']['counter'] = 'Nxy selects Counter pair x and effect y. Pair x references M.object.x (shield) and J.object.x (sword), with independent transforms. Individual pieces retain their M/J asset IDs.'
for f in families:
    letter = f['letter']
    references = next(t['references'] for t in data['cardTypes'] if t['id'] == types[letter])
    category = {
        'letter': letter, 'id': f['id'], 'label': f['label'], 'revision': 4,
        'references': references, 'objectIds': [f'{letter}.object.{i}' for i in range(10)],
        'effectIds': [f"{f['effectFamily']}.effect.{i}" for i in range(10)],
        'backgroundId': f"background.{f['background']}",
        'exampleCodes': [f'{letter}{i}{i}' for i in range(10)],
    }
    data['categories'].append(category)

counter_refs = next(t['references'] for t in data['cardTypes'] if t['id'] == 'counter')
data['categories'].append({
    'letter': 'N', 'id': 'counter-pairs', 'label': 'Counter pairs', 'revision': 4,
    'references': counter_refs, 'objectIds': [f'M.object.{i}' for i in range(10)],
    'secondaryObjectIds': [f'J.object.{i}' for i in range(10)],
    'effectIds': [f'E.effect.{i}' for i in range(10)], 'backgroundId': 'background.4',
    'exampleCodes': [f'N{i}{i}' for i in range(10)],
})
for c in data['categories']:
    if c['letter'] not in 'IJKLMN':
        continue
    for i in range(10):
        for j in range(10):
            code = f"{c['letter']}{i}{j}"
            comp = copy.deepcopy(data['compositions']['A00'])
            comp.update(code=code, category=c['letter'], objectDigit=i, effectDigit=j)
            layers = {l['id']: l for l in comp['layers']}
            layers['background']['assetId'] = c['backgroundId']
            for id in ['backEffect', 'foreground']:
                layers[id]['assetId'] = c['effectIds'][j]
            layers['object']['assetId'] = c['objectIds'][i]
            if c['letter'] == 'N':
                layers['object']['overrides'] = {'x': 218, 'y': 350, 'width': 400, 'height': 460, 'rotationDeg': -5}
                layers['secondaryObject'].update(assetId=c['secondaryObjectIds'][i], visible=True, zIndex=15,
                    overrides={'x': 315, 'y': 290, 'width': 470, 'height': 470, 'rotationDeg': [-12, 168, -12, 168, -12, -12, 78, -102, 78, -12][i]})
                comp['pairReferences'] = {'shield': c['objectIds'][i], 'sword': c['secondaryObjectIds'][i]}
            data['compositions'][code] = comp

for t in data['cardTypes']:
    for f in families:
        if types[f['letter']] == t['id'] and f['letter'] not in t['objectFamilies']:
            t['objectFamilies'].append(f['letter'])
    if t['id'] == 'spell':
        t['objectFamilies'] = ['I']
        t['proposal'] = 'A reusable spellbook, open or closed, with a separately positioned magical effect.'
    if t['id'] == 'counter':
        t['objectFamilies'] = ['E', 'A', 'M', 'J']
        t['exampleCodes'] = [f'N{i}{i}' for i in range(10)]
        t['proposal'] = 'Shield in front of a separate sword; each object keeps its own transform and PNG reference.'
save(ROOT / 'cutout-manifest.json', data)
(ROOT / 'cutouts-data.js').write_text('window.CARD_CUTOUT_DATA = ' + json.dumps(data, separators=(',', ':')) + ';\n')
print(f"Revision 4 assembled: {len(data['assets'])} PNGs; {len(data['categories'])} categories; {len(data['compositions'])} combinations.")
