from pathlib import Path
import json,hashlib
from PIL import Image

ROOT=Path(__file__).resolve().parent
PACK=ROOT.parent
def write(name,data): (ROOT/name).write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
def measure(path):
    im=Image.open(path);a=im.getchannel('A') if im.mode=='RGBA' else None
    box=a.point(lambda v:255 if v>32 else 0).getbbox() if a else (0,0,*im.size)
    return dict(size=list(im.size),visibleBounds=list(box),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),alphaThreshold=32,alphaRange=list(a.getextrema()) if a else None)
inventory=json.loads((ROOT/'inventory.json').read_text(encoding='utf-8'))
source=json.loads((PACK/'catalog.json').read_text(encoding='utf-8'))
receipts={p.stem:json.loads(p.read_text(encoding='utf-8')) for p in (ROOT/'receipts').glob('*.json')}
actors=[]
for e in source['entries']:
    key='theNameless-padding' if e['id']=='theNameless' and 'theNameless-padding' in receipts else e['id']
    r=receipts.get(key)
    file=r['resultFile'] if r else '../'+e['file']
    geom=measure(ROOT/file)
    box=geom['visibleBounds']
    actors.append(dict(id=e['id'],name=e['name'],family=e['family'],file=file,facing='away, rear three-quarter right' if r else e['facing'],footAnchor=[(box[0]+box[2])/2,box[3]],footAnchorMethod='alpha bounds bottom-center at alpha >32; idle placement, not animation contact',**geom))
layers={}
for id,r in receipts.items():
    if r['kind']=='sprite':continue
    layers[id]=dict(id=id,kind=r['kind'],file=r['resultFile'],**measure(ROOT/r['resultFile']))
for kind in ('far','ground','foreground'):
    path=PACK/'layers'/f'{kind}.png'
    layers['hollow-weald-'+kind]=dict(id='hollow-weald-'+kind,kind=kind,file='../layers/'+path.name,reusedApproved=True,**measure(path))
scenes=[]
depths=dict(far=.12,landmark=.38,ground=.7,foreground=1.08)
for s in inventory['scenes']:
    ids=[s['region']+'-far',s['id']+'-landmark',s['region']+'-ground',s['region']+'-foreground']
    if s['id']=='drowned-coast-3' and 'starwatch-far' in layers: ids[0]='starwatch-far'
    if s['id']=='ashen-crown-4' and 'undercroft-far' in layers: ids[0]='undercroft-far'
    if s['id'] in ('hollow-weald-2','hollow-weald-4') and 'hollow-night-far' in layers: ids[0]='hollow-night-far'
    if s['id']=='pale-marches-4' and 'glass-lake-ground' in layers: ids[2]='glass-lake-ground'
    if s['id']=='drowned-coast-4' and 'grave-ships-ground' in layers: ids[2]='grave-ships-ground'
    if not all(i in layers for i in ids):continue
    devices={}
    for device,(w,h) in dict(desktop=(1536,1024),phone=(768,1024)).items():
        transforms=[]
        for id in ids:
            if device=='phone' and id==ids[-1] and s['region']+'-phone-foreground' in layers: id=s['region']+'-phone-foreground'
            layer=layers[id];kind=layer['kind'];iw,ih=layer['size'];x0,y0,x1,y1=layer['visibleBounds']
            if kind=='landmark':
                sc=min(w*(.86 if device=='phone' else .78)/(x1-x0),h*.54/(y1-y0))
                if y0<=10: sc=max(sc,h*.59/y1)
                x=w*.5-(x0+x1)*sc/2;y=h*.57-y1*sc
            elif kind=='foreground':
                sc=max(w/iw,h/ih)*1.04;x=(w-iw*sc)/2;y=h-ih*sc
            else:
                sc=max(w/iw,h/ih)*1.04;x=(w-iw*sc)/2;y=h-ih*sc
            transforms.append(dict(id=id,x=round(x,3),y=round(y,3),width=round(iw*sc,3),height=round(ih*sc,3),depth=depths[kind]))
        devices[device]=dict(width=w,height=h,layers=transforms,actors=[dict(id='reaver-default',x=.24 if device=='desktop' else .23,footY=.86,height=.47 if device=='desktop' else .32),dict(id='charredColossus',x=.70 if device=='desktop' else .73,footY=.78 if device=='desktop' else .67,height=.48 if device=='desktop' else .34)],standingArea=dict(x=.12,y=.6,width=.76,height=.3),groundAnchor=.82,composition='Near-left rear hero, farther-right opposing enemy; phone uses separate scale and depth placement')
    scenes.append(dict(id=s['id'],name=s['name'],region=s['region'],source=s['source'],layers=ids,devices=devices))
catalog=dict(schemaVersion=1,baseRevision=inventory['baseRevision'],scope='Art integration and review only',generator='built-in image_gen',expectedScenes=32,scenes=scenes,layers=list(layers.values()),actors=actors,anchorContract='Pixels in original PNG; alpha threshold 32; x/y transforms in device canvas pixels; no baked UI; independent depth values',limitations=['Idle illustrations, no animation rigs or action anchors.','No production runtime or editor behavior changes.','Phone is a separately composed combat art stage, not a complete phone HUD.'])
write('scene-catalog.json',catalog)
(ROOT/'scene-catalog.js').write_text('window.ART_CONTINUATION = '+json.dumps(catalog,ensure_ascii=False)+';\n',encoding='utf-8',newline='\n')
print(json.dumps(dict(actors=len(actors),scenes=len(scenes),layers=len(layers))))
