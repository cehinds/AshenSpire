"""Measure unchanged generated sources and retain hash-bound visual approvals."""
import hashlib
import json
import statistics
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parent
read=lambda p:json.loads(p.read_text())
def write(p,v):p.write_text(json.dumps(v,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
brief=read(ROOT/'brief.json');expected=[f'{setting}/{role}' for setting,spec in brief['settings'].items() for role in brief['assetNames'] if role not in spec.get('reuse',{})]
assert len(expected)==brief['count']==86
reviews={i['id']:i for setting in brief['settings'] for i in read(ROOT/setting/'review.json')['items']}
assert set(reviews)==set(expected),'Review coverage differs from brief.'
assets=[]
for name in expected:
 setting,role=name.split('/');spec=brief['settings'][setting];png=ROOT/(name+'.png');sidecar=ROOT/(name+'.provenance.json');prov=read(sidecar);source=Path(prov['sourceOutputPath']);digest=sha(png)
 assert digest==sha(source),f'{name}: generated source bytes changed'
 assert reviews[name]['sha256']==digest and reviews[name]['verdict']=='approved',f'{name}: review missing or stale'
 category='prop' if role.startswith('prop-') else role;profile={'prop':'battlefield-prop','ground':'battlefield-ground','backdrop':'battlefield-backdrop'}[category]
 with Image.open(png) as image:
  width,height=image.size
  asset={'id':name,'file':name+'.png','category':category,'status':'draft-unregistered','productionAssetId':None,'styleFamilyId':'ashen-spire-painted-v1','styleProfileId':profile,'tags':{'location':[setting],'lighting':[spec['condition']],'role':[role],'camera':['player-height','close-location'],'depth':['near' if category=='prop' else 'background' if category=='backdrop' else 'floor']},'width':width,'height':height,'mode':image.mode,'sha256':digest,'provenanceFile':name+'.provenance.json'}
  if category!='backdrop':assert image.mode=='RGBA',f'{name}: transparent component requires RGBA'
  if image.mode=='RGBA':
   alpha=image.getchannel('A');hist=alpha.histogram();asset['alphaRange']=list(alpha.getextrema());bounds=alpha.point(lambda x:255 if x>=32 else 0).getbbox();assert bounds,f'{name}: no solid subject'
   asset['visibleBoundsAt32']=list(bounds);edge=list(alpha.crop((0,0,width,1)).tobytes())+list(alpha.crop((0,height-1,width,height)).tobytes())+list(alpha.crop((0,1,1,height-1)).tobytes())+list(alpha.crop((width-1,1,width,height-1)).tobytes())
   asset['alphaQA']={'transparentFraction':hist[0]/(width*height),'borderPixelsAt32':sum(a>=32 for a in edge),'normalizedMarginsAt32':[bounds[0]/width,bounds[1]/height,(width-bounds[2])/width,(height-bounds[3])/height]}
   if category=='ground':
    tops=[next((y for y in range(height) if alpha.getpixel((x,y))>=128),height) for x in range(int(width*.3),int(width*.7))];asset['medianCenterHorizonY']=int(statistics.median(tops));asset['bottomAlphaRange']=list(alpha.crop((0,height-1,width,height)).getextrema())
  prov.update(generator='OpenAI image_gen',styleFamilyId='ashen-spire-painted-v1',styleProfileId=profile,status='draft-unregistered',actualDimensions={'width':width,'height':height},sha256=digest,sourceSha256=sha(source),processing='Byte-identical original imagegen output; no pixel editing, resizing, trimming or upscaling.',qa={k:v for k,v in asset.items() if k in ['width','height','mode','alphaRange','visibleBoundsAt32','alphaQA','medianCenterHorizonY','bottomAlphaRange']})
  write(sidecar,prov)
 assets.append(asset)
write(ROOT/'manifest.json',{'version':1,'status':'draft-not-runtime-bound','branch':'feature/ImproveMapBattleFieldArt','styleSystem':{'guide':'../style-system/style-guide.json','library':'../style-system/library.json'},'assets':assets})
write(ROOT.parent/'style-system/audit-location-streets.json',{'scope':'86 new source paintings. Generating agents inspect every final image; independent composition review is recorded in batch-10 REVIEW.md.','items':[{'assetKey':'batch-10-location-streets/'+name,'verdict':'approved','reason':reviews[name]['reason'],'profileId':reviews[name]['profileId'],'sha256':reviews[name]['sha256']} for name in expected]})
print(f'Measured {len(assets)} unchanged generated source paintings and verified reviewed SHA-256 hashes.')
