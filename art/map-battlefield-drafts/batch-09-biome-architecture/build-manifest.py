"""Measure unchanged source PNGs. Never paints, resizes, trims, or rewrites images."""
import hashlib
import json
import statistics
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parent
brief=json.loads((ROOT/'brief.json').read_text())
FAMILY='ashen-spire-painted-v1'

def read(p):return json.loads(p.read_text())
def write(p,d):p.write_text(json.dumps(d,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

expected=[f'{biome}/{name}' for biome in brief['biomes'] for name in brief['perBiome']]+['mountains/'+name for name in brief['mountains']]
reviews={i['id']:i for folder in [*brief['biomes'],'mountains'] for i in read(ROOT/folder/'review.json')['items']}
assert len(expected)==brief['count']==45
assert set(reviews)==set(expected),'Review coverage differs from the requested batch.'
assets=[]
for name in expected:
 png=ROOT/(name+'.png');sidecar=ROOT/(name+'.provenance.json');prov=read(sidecar)
 digest=sha(png);source=Path(prov['sourceOutputPath'])
 assert digest==sha(source),f'{name}: generated source bytes changed'
 assert reviews[name]['sha256']==digest,f'{name}: visual review refers to different bytes'
 assert reviews[name]['verdict']=='approved',f'{name}: visual review is incomplete'
 role='ground' if Path(name).name.startswith('ground-') else 'backdrop' if Path(name).name.startswith('backdrop-') else 'prop'
 profile={'ground':'battlefield-ground','backdrop':'battlefield-backdrop','prop':'battlefield-prop'}[role]
 group,stem=name.split('/')
 tags={'biome':[group] if group!='mountains' else [stem.split('-')[2]],'role':[role],'lighting':['night' if 'night' in stem else 'interior' if 'dungeon' in stem and role!='prop' else 'day'],'weather':['rain' if 'rain' in stem else 'clear'],'setting':['dungeon' if 'dungeon' in stem else 'city' if 'city' in stem else 'town' if 'town' in stem else 'castle' if 'castle' in stem else 'street' if 'street' in stem else 'mountain' if group=='mountains' else 'outdoors']}
 if group=='mountains':tags['depth']=['distant' if 'distant' in stem else 'near']
 with Image.open(png) as image:
  width,height=image.size
  asset={'id':name,'file':name+'.png','category':role,'status':'draft-unregistered','productionAssetId':None,'styleFamilyId':FAMILY,'styleProfileId':profile,'tags':tags,'width':width,'height':height,'mode':image.mode,'sha256':digest,'provenanceFile':name+'.provenance.json'}
  if role!='backdrop':assert image.mode=='RGBA',f'{name}: transparent layer requires RGBA'
  if image.mode=='RGBA':
   alpha=image.getchannel('A');hist=alpha.histogram();asset['alphaRange']=list(alpha.getextrema())
   bounds=alpha.point(lambda x:255 if x>=32 else 0).getbbox();assert bounds,f'{name}: no visible subject'
   asset['visibleBoundsAt32']=list(bounds)
   edge=list(alpha.crop((0,0,width,1)).tobytes())+list(alpha.crop((0,height-1,width,height)).tobytes())+list(alpha.crop((0,1,1,height-1)).tobytes())+list(alpha.crop((width-1,1,width,height-1)).tobytes())
   asset['alphaQA']={'transparentFraction':hist[0]/(width*height),'borderPixelsAt32':sum(a>=32 for a in edge),'normalizedMarginsAt32':[bounds[0]/width,bounds[1]/height,(width-bounds[2])/width,(height-bounds[3])/height]}
   if role=='ground':
    tops=[next((y for y in range(height) if alpha.getpixel((x,y))>=128),height) for x in range(int(width*.3),int(width*.7))]
    asset['medianCenterHorizonY']=int(statistics.median(tops));asset['bottomAlphaRange']=list(alpha.crop((0,height-1,width,height)).getextrema())
  prov.update(generator='OpenAI image_gen',styleFamilyId=FAMILY,styleProfileId=profile,status='draft-unregistered',actualDimensions={'width':width,'height':height},sha256=digest,sourceSha256=sha(source),processing='Byte-identical retained imagegen output; no image editing, trimming, resizing or upscaling.',qa={k:v for k,v in asset.items() if k in ['width','height','mode','alphaRange','visibleBoundsAt32','alphaQA','medianCenterHorizonY','bottomAlphaRange']})
  write(sidecar,prov)
 assets.append(asset)
write(ROOT/'manifest.json',{'version':1,'status':'draft-not-runtime-bound','branch':'feature/ImproveMapBattleFieldArt','styleFamilyId':FAMILY,'styleSystem':{'guide':'../style-system/style-guide.json','library':'../style-system/library.json'},'assets':assets})
write(ROOT.parent/'style-system/audit-biome-architecture.json',{'scope':'45 new original source paintings: generating agents inspect each result; full-family and composition review is recorded in batch-09 REVIEW.md.','items':[{'assetKey':'batch-09-biome-architecture/'+name,'verdict':reviews[name]['verdict'],'reason':reviews[name]['reason'],'profileId':reviews[name]['profileId'],'sha256':reviews[name]['sha256']} for name in expected]})
print(f'Measured {len(assets)} unchanged PNGs and verified their source-byte/review hashes.')
