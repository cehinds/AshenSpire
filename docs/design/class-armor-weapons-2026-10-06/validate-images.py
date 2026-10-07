from build import *
from PIL import ImageChops
manifest=read(ROOT/'manifest.json');report={'bodies':0,'weapons':0,'handPaintChecks':0,'weaponPaintChecks':0,'clippingFailures':[]}
for item in manifest['projects']:
 p=read(ROOT/item['projectPath']);body=Image.open(ROOT/p['assets']['body']['src']).convert('RGBA')
 assert body.size==(512,512);assert bounds(body);report['bodies']+=1
 for hand in item['handContacts'].values():
  assert body.getpixel(tuple(map(round,hand)))[3]>120,(item['id'],hand);report['handPaintChecks']+=1
 for wid in p['assets']:
  if wid=='body':continue
  for side,pid in [('right',wid+'--empty'),('left','empty--'+wid)]:
   l=next(l for l in p['poses'][pid]['layers'] if l['role']=='weapon');im=Image.open(ROOT/p['assets'][wid]['src']).convert('RGBA')
   painted=affine(im,1,l['rotation'],l['pivot'],[l['pivot'][0]+l['x'],l['pivot'][1]+l['y']]);a=painted.getchannel('A')
   edges=[a.crop((0,0,512,1)),a.crop((0,511,512,512)),a.crop((0,0,1,512)),a.crop((511,0,512,512))]
   if any(e.getextrema()[1]>32 for e in edges):report['clippingFailures'].append([item['id'],wid,side])
for file in (ROOT/'assets').glob('weapon-*.png'):
 im=Image.open(file);assert im.size==(512,512);assert im.getpixel((256,256))[3]>120,file;report['weaponPaintChecks']+=1;report['weapons']+=1
receipts=read(ROOT/'receipts.json')
for r in receipts:
 r['tool']='built-in image_gen';r['sha256']=sha(ROOT/r['file']);assert r['sha256']==sha(r['generatedPath'])
 ref=Path(r['reference']);ref=ref if ref.is_absolute() else ROOT/ref;r['referenceSha256']=sha(ref)
write(ROOT/'receipts.json',receipts)
report['passed']=not report['clippingFailures'];write(ROOT/'image-validation.json',report);print(json.dumps(report,indent=2))
assert report['passed']
