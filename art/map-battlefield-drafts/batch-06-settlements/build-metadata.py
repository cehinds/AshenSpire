"""Measure unchanged PNG sources; authored JSON modules are maintained separately."""
from pathlib import Path
from PIL import Image
import hashlib,json,statistics,sys
ROOT=Path(__file__).resolve().parent
DUNGEON_GROUNDS=['interiors/ground-dusty-keep.png','hollow-weald/ground-root-cellar.png','interiors/ground-frost-vault.png','cinder-reach/ground-obsidian-vault.png','drowned-coast/ground-flooded-crypt.png']

if len(sys.argv)>1:
 raise SystemExit('Usage: python build-metadata.py (edit scene recipes in modules/regions/ instead)')
def write(name,value):
 (ROOT/name).write_text(json.dumps(value,indent=2)+'\n')
assets=[]
for path in sorted(ROOT.glob('*/*.png')):
 kind=path.stem.split('-')[0]
 if kind not in ['ground','prop','backdrop']:continue
 region=path.parent.name
 if path.stem=='ground-dusty-keep':region='ashen-crown'
 if path.stem in ['ground-frost-vault','backdrop-frozen-inlet']:region='pale-marches'
 category='dungeon' if str(path.relative_to(ROOT)) in DUNGEON_GROUNDS else ('shore' if path.stem in ['ground-ice-bank','backdrop-frozen-inlet'] else 'city')
 im=Image.open(path);prov=path.with_suffix('.provenance.json')
 if not prov.exists():prov=path.parent/'generation-record.json'
 assert prov.is_file(),prov
 a={'id':str(path.relative_to(ROOT).with_suffix('')),'file':str(path.relative_to(ROOT)),'status':'draft-unregistered','productionAssetId':None,'category':kind,'tags':{'region':region,'setting':category,'materials':path.stem.split('-')[1:],'layerRole':kind},'width':im.width,'height':im.height,'mode':im.mode,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'provenanceFile':str(prov.relative_to(ROOT))}
 if im.mode=='RGBA':
  alpha=im.getchannel('A');px=alpha.load();a['alphaRange']=list(alpha.getextrema());a['visibleBoundsAt32']=list(alpha.point(lambda v:255 if v>=32 else 0).getbbox())
  if kind=='ground':
   a['medianCenterHorizonY']=statistics.median(next(y for y in range(im.height) if px[x,y]>=128) for x in range(int(im.width*.4),int(im.width*.6)))
   a['bottomAlphaRange']=list(alpha.crop((0,im.height-1,im.width,im.height)).getextrema())
 elif kind!='backdrop':raise AssertionError(path)
 assets.append(a)
assert len(assets)==17,len(assets)
write('manifest.json',{'version':1,'status':'draft-not-runtime-bound','assets':assets,'authoringModules':'modules/index.json','coverage':'location-pools.example.json','recipe':'composition.example.json','requestedGroundDimensions':[3072,1728],'actualDimensionsNote':'Native landscape outputs are measured per asset. Requested size does not imply delivered size; no originals were enlarged or repainted by this script.','reviewRequired':['Alpha cleanup and opaque material review.','Expanded native-resolution masters for larger camera travel.','Region-specific interior backdrops and prop lighting.','Actor feet, contact shadows and runtime integration.']})
print('Measured 17 sources; authored JSON modules and exports left unchanged.')
