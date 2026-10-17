"""Read original PNGs, record delivery measurements, and preserve their bytes."""
import hashlib
import json
import statistics
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parent
assets=[]
roles={'ground-ice-bank':'ground','backdrop-forest-day':'backdrop','lightning-frame-01':'lightning','lightning-frame-02':'lightning'}
for name,role in roles.items():
 p=root/(name+'.png');prov_path=root/(name+'.provenance.json');prov=json.loads(prov_path.read_text());sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
 assert sha(p)==sha(Path(prov['sourceOutputPath'])),name
 with Image.open(p) as im:
  a={'id':name,'file':p.name,'status':'draft-unregistered','productionAssetId':None,'category':role,'width':im.width,'height':im.height,'mode':im.mode,'sha256':sha(p),'provenanceFile':prov_path.name,'styleFamilyId':'ashen-spire-painted-v1','styleProfileId':{'ground':'battlefield-ground','backdrop':'battlefield-backdrop','lightning':'weather-lightning'}[role]}
  if im.mode=='RGBA':
   alpha=im.getchannel('A');a['alphaRange']=list(alpha.getextrema());a['visibleBoundsAt32']=list(alpha.point(lambda x:255 if x>=32 else 0).getbbox())
   if role=='ground':
    tops=[next((y for y in range(im.height) if alpha.getpixel((x,y))>=128),im.height) for x in range(int(im.width*.3),int(im.width*.7))]
    a['medianCenterHorizonY']=int(statistics.median(tops));a['bottomAlphaRange']=list(alpha.crop((0,im.height-1,im.width,im.height)).getextrema())
 prov.update(styleFamilyId=a['styleFamilyId'],styleProfileId=a['styleProfileId'],sha256=sha(p),sourceSha256=sha(Path(prov['sourceOutputPath'])),actualDimensions={'width':im.width,'height':im.height},processing='Unchanged byte-identical copy of imagegen output. No resizing, trimming or painted-image edits.')
 prov['generator']='OpenAI image_gen'
 refs=prov.get('sourceReferences',prov.get('referencePaths',[]));prov['sourceReferences']=refs;prov['referenceSha256']={f:sha(Path(f)) for f in refs}
 prov['requestedDimensions']={'width':3072,'height':1728}
 for alias in ['styleFamily','profileId','generationTool','referencePaths','postprocessing']:prov.pop(alias,None)
 prov_path.write_text(json.dumps(prov,indent=2)+'\n');assets.append(a)
(root/'manifest.json').write_text(json.dumps({'version':1,'status':'draft-not-runtime-bound','branch':'feature/ImproveMapBattleFieldArt','assets':assets},indent=2)+'\n')
print('Measured four unchanged corrected sources.')
