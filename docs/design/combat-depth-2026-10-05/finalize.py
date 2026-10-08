from pathlib import Path
import hashlib,json,shutil
from PIL import Image
root=Path(__file__).resolve().parent
catalog=json.loads((root/'catalog.json').read_text(encoding='utf-8'))
receipts={p.stem:json.loads(p.read_text(encoding='utf-8')) for p in (root/'receipts').glob('*.json')}
for i,e in enumerate(catalog['entries']):
    if e['id'] in receipts: catalog['entries'][i]=receipts[e['id']]
for e in catalog['entries']:
    if e.get('facing','').startswith('away, rear'):
        continue
    e['referenceImages']=['references/composition.png']
    e['promptUsed']=e['prompt']
    if e['family']=='armor' and e['outfitId']!='default':
        e['referenceImages']=[f"masters/{e['classId']}-default.png"]
        e['promptUsed']+=' Use the supplied single class sprite as the identity and pose reference. Preserve its anatomy, weapon configuration, framing and direction; change the armor materials and cloth palette to this named outfit. Output only ONE variant.'
    if e['id']=='reaver-default':
        e['promptUsed']='Use case: background-extraction / stylized-concept. Create ONE production-quality full body idle combat sprite of the Reaver in Wayfarer Plate, matching the knight at the left of the reference exactly in visual quality and dark fantasy painted realism. Reference image is style and character reference only. Isolate this single knight: battered dark steel plate, muted oxidized green patina, chainmail, layered brown leather, ragged deep rust-red cloak/scarf, closed battered helmet. Facing RIGHT in three-quarter side view, sword held downward to right, full helmet through both feet and entire sword visible. No scenery, no floor, no shadow blob, no HUD, no lettering, no other characters, no panels. Truly transparent alpha background. Tall portrait 1024x1536 canvas, feet on common baseline at 94% canvas height, center mass at 50% width, ample clearance around sword and cloak. Restrained neutral overcast key light from upper left, ember warm edge highlights, crisp readable silhouette and intricate weathering. This is an individual game sprite, not a concept sheet.'
layers=json.loads((root/'layers.json').read_text(encoding='utf-8'))
(root/'layers').mkdir(exist_ok=True)
for layer in layers:
    dest=root/layer['file']
    if not dest.exists(): shutil.copy2(layer['source'],dest)
    im=Image.open(dest)
    layer['size']=im.size
    layer['sha256']=hashlib.sha256(dest.read_bytes()).hexdigest()
    layer['alphaRange']=im.getchannel('A').getextrema() if im.mode=='RGBA' else None
catalog['layers']=layers
catalog['referenceProject']='https://github.com/cehinds/TheAshenedSpire'
catalog['referenceFiles']=['references/composition.png','references/depth-markup.png']
catalog['sharedArmorPolicy']='Shared rows reuse their named visual class and outfit. They are not 16 extra visual sets.'
catalog['limitations']=['Idle pose illustrations only; not animation strips or rigs.','Body anchors measured from alpha bounds; action and hand anchors still require animation authoring.','Preview only; production HUD, cards, footer and game rendering remain unchanged.']
count=sum(e['status']=='generated' for e in catalog['entries'])
catalog['coverage']={'generated':count,'expected':len(catalog['entries']),'pending':[e['id'] for e in catalog['entries'] if e['status']!='generated']}
data=json.dumps(catalog,indent=2)
(root/'catalog.json').write_text(data,encoding='utf-8')
(root/'catalog-data.js').write_text('window.COMBAT_ART_CATALOG = '+data+';\n',encoding='utf-8')
print(json.dumps(catalog['coverage']))
