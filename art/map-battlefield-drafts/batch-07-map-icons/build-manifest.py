"""Measure unchanged generated PNGs and rebuild their editable catalog mappings."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
MODULE = ROOT.parent / 'hex-world-module'
STYLE = 'map-icons-painterly-v1'
MANIFEST = '../batch-07-map-icons/manifest.json'

def read(p):
    return json.loads(p.read_text())

def write(p, value):
    p.write_text(json.dumps(value, indent=2) + '\n')

def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

registry = read(MODULE / 'map-components.json')
components = [c for f in registry['componentModules'] for c in read(MODULE / f)['items']]
assets = []
for component in components:
    name = 'map-' + component['id']
    png = ROOT / (name + '.png')
    prov_path = ROOT / (name + '.provenance.json')
    prov = read(prov_path)
    source = Path(prov['sourceOutputPath'])
    assert digest(source) == digest(png), f'{name}: source bytes changed'
    assert prov['styleSetId'] == STYLE and prov['prompt'], name
    with Image.open(png) as image:
        assert image.mode == 'RGBA', f'{name}: RGBA required'
        width, height = image.size
        alpha = image.getchannel('A')
        histogram = alpha.histogram()
        assert histogram[0] > 0 and histogram[255] > 0, f'{name}: opaque subject and transparent background required'
        # Derived binary masks are measurements only; no image output is written.
        bounds = alpha.point(lambda x: 255 if x >= 16 else 0).getbbox()
        edge = list(alpha.crop((0, 0, width, 1)).tobytes()) + list(alpha.crop((0, height-1, width, height)).tobytes()) + list(alpha.crop((0, 1, 1, height-1)).tobytes()) + list(alpha.crop((width-1, 1, width, height-1)).tobytes())
        qa = {'width': width, 'height': height, 'mode': image.mode,
              'alphaRange': list(alpha.getextrema()),
              'transparentFraction': histogram[0] / (width * height),
              'visibleBoundsAt16': list(bounds),
              'edgePixelCountAt1': sum(x >= 1 for x in edge),
              'edgePixelCountAt16': sum(x >= 16 for x in edge),
              'normalizedMarginsAt16': [bounds[0]/width, bounds[1]/height, (width-bounds[2])/width, (height-bounds[3])/height]}
    prov.update(status='draft-unregistered', actualDimensions={'width':width,'height':height}, requestedDimensions={'width':1536,'height':1536}, sha256=digest(png), sourceSha256=digest(source), processing='Byte-identical copy of generated PNG. No resizing, trimming or painted-image editing.', qa=qa)
    write(prov_path, prov)
    assets.append({'id':name, 'file':png.name, 'componentId':component['id'], 'styleSetId':STYLE,
                   'status':'draft-unregistered', 'productionAssetId':None, 'category':'mapProp',
                   'tags':{'purpose':component['tags'],'lighting':['diffuse-day']},
                   'width':width,'height':height,'mode':'RGBA','sha256':digest(png),
                   'provenanceFile':prov_path.name,'alpha':qa})
write(ROOT/'manifest.json', {'version':1,'status':'draft-not-runtime-bound','branch':'feature/ImproveMapBattleFieldArt','styleSetId':STYLE,'styleGuide':'style-guide.json','assets':assets})
art = read(MODULE/'art/map-props.json')
art['items'] = [i for i in art['items'] if i.get('sourceManifest') != MANIFEST]
art['status'] = 'matching-painted-set-with-historical-variants'
for component in components:
    name = 'map-' + component['id']
    item_id = 'batch-07-' + name
    art['items'].append({'id':item_id,'componentId':component['id'], 'asset':'art/map-battlefield-drafts/batch-07-map-icons/'+name+'.png', 'weight':1,'tags':component['tags'], 'selection':{'all':[],'any':[],'exclude':[]}, 'variantRole':'painted-draft','styleSetId':STYLE,'status':'draft-unregistered','sourceManifest':MANIFEST,'sourceAssetId':name})
    pool = next(p for p in art['pools'] if p['id']==component['artPoolId'])
    pool['itemIds'] = [i for i in pool['itemIds'] if not i.startswith('batch-07-')] + [item_id]
write(MODULE/'art/map-props.json', art)
print(f'Measured {len(assets)} unchanged PNGs; mapped {len(art["items"])} retained variants.')
