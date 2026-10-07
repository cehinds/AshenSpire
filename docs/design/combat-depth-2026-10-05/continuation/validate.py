from pathlib import Path
import hashlib,json,subprocess
from PIL import Image
ROOT=Path(__file__).resolve().parent;PACK=ROOT.parent;REPO=PACK.parents[2]
C=json.loads((ROOT/'scene-catalog.json').read_text(encoding='utf-8'))
I=json.loads((ROOT/'inventory.json').read_text(encoding='utf-8'))
issues=[];checks=[]
def require(value,message):
    if not value:issues.append(message)
require({s['id'] for s in C['scenes']}=={s['id'] for s in I['scenes']},'Canonical scene coverage mismatch')
require({s['id'] for s in C['actors']}=={s['id'] for s in I['sprites']},'Canonical actor coverage mismatch')
require(len(C['scenes'])==32,'Expected 32 named combat scenes')
for row in I['sprites']:
    require(hashlib.sha256((PACK/row['file']).read_bytes()).hexdigest()==row['sha256'],'Original sprite changed: '+row['id'])
for a in C['actors']+C['layers']:
    path=(ROOT/a['file']).resolve()
    require(path.is_relative_to(PACK.resolve()),'Path outside package: '+a['id'])
    require(path.is_file(),'Missing: '+a['file'])
    if not path.is_file():continue
    require(hashlib.sha256(path.read_bytes()).hexdigest()==a['sha256'],'Hash drift: '+a['id'])
    im=Image.open(path);require(list(im.size)==a['size'],'Dimensions: '+a['id'])
    if a.get('kind')=='far':continue
    require(im.mode=='RGBA','No RGBA: '+a['id'])
    if im.mode!='RGBA':continue
    alpha=im.getchannel('A');require(alpha.getextrema()[0]==0,'No empty alpha: '+a['id'])
    box=alpha.point(lambda v:255 if v>32 else 0).getbbox();require(list(box)==a['visibleBounds'],'Bounds: '+a['id'])
    if 'family' in a:
        require(box[0]>0 and box[1]>0 and box[2]<im.width and box[3]<im.height,'Clipped actor: '+a['id'])
        require(box[0]<=a['footAnchor'][0]<=box[2] and a['footAnchor'][1]==box[3],'Foot anchor: '+a['id'])
        require(a['facing'].startswith('away') if a['family']!='enemy' else a['facing']=='left','Facing metadata: '+a['id'])
    elif a['kind']=='ground':
        top=alpha.crop((int(im.width*.25),0,int(im.width*.75),int(im.height*.2)))
        require(top.getextrema()[1]<=32,'Ground has opaque upper-center backing: '+a['id'])
        bottom=alpha.crop((int(im.width*.2),int(im.height*.9),int(im.width*.8),im.height))
        require(sum(bottom.histogram()[200:])/(bottom.width*bottom.height)>.97,'Ground does not fill bottom: '+a['id'])
    elif a['kind']=='foreground':
        middle=alpha.crop((int(im.width*.4),int(im.height*.1),int(im.width*.6),int(im.height*.8)))
        require(sum(middle.histogram()[33:])/(middle.width*middle.height)<.01,'Foreground obstructs center: '+a['id'])
for s in C['scenes']:
    require(len(s['layers'])==4 and len(set(s['layers']))==4,'Four distinct layer references: '+s['id'])
    require(s['devices']['desktop']!=s['devices']['phone'],'Phone composition not independent: '+s['id'])
    for device,d in s['devices'].items():
        require(len({t['depth'] for t in d['layers']})==4,'Independent motion depths: '+s['id'])
        if device=='phone':require(d['layers'][-1]['id']==s['region']+'-phone-foreground','Dedicated phone foreground missing: '+s['id'])
        for t in d['layers']:require(t['width']>0 and t['height']>0,'Invalid transform: '+s['id'])
        require(d['actors'][0]['footY']>d['actors'][1]['footY'],'Near/far foot placement: '+s['id'])
changed=subprocess.check_output(['git','diff','--name-only',I['baseRevision']],cwd=REPO,text=True).splitlines()
changed+=subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=REPO,text=True).splitlines()
require(all(p.startswith('docs/design/combat-depth-2026-10-05/') for p in changed),'Change outside authorized art package')
report=dict(actors=len(C['actors']),scenes=len(C['scenes']),sceneCompositions=len(C['scenes'])*2,layers=len(C['layers']),protectedOriginals=52,issues=issues,checks=['canonical scene and actor coverage','52 original sprite hashes preserved','PNG hashes and dimensions','real alpha and unclipped actor silhouettes','foot anchors and visible bounds','ground fill and empty upper center','foreground center clearance','four independently moving layers per scene','separate desktop and phone transforms','art-only tracked change scope'],runtimeVerified=False)
(ROOT/'validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(report,indent=2));raise SystemExit(bool(issues))
