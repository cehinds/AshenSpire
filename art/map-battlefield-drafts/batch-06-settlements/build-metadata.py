"""Measure unchanged PNG sources and build editable draft composition recipes."""
from pathlib import Path
from PIL import Image
import hashlib,json,statistics,sys
ROOT=Path(__file__).resolve().parent
PREVIOUS=ROOT.parent/'batch-05-regions'
REGIONS=['ashen-crown','hollow-weald','pale-marches','cinder-reach','drowned-coast']
LABELS=['Ashen Crown','Hollow Weald','Pale Marches','Cinder Reach','Drowned Coast']
CITY_GROUNDS=['market-cobbles','village-pavers','snow-courtyard','foundry-court','harbor-paving']
BUILDINGS=['half-timber-house','stilt-lodge','snow-watchtower','foundry-hall','fishers-house']
BACKDROPS=['ashen-highlands','deep-weald','snow-valley','volcanic','tidal-coast']
ACCENTS=['market-stall','woodland-shrine','frozen-wall','broken-forge','broken-jetty']
DUNGEON_GROUNDS=['interiors/ground-dusty-keep.png','hollow-weald/ground-root-cellar.png','interiors/ground-frost-vault.png','cinder-reach/ground-obsidian-vault.png','drowned-coast/ground-flooded-crypt.png']

def read(path):return json.loads(path.read_text())
def write(name,value):
 if name=='composition.example.json' and (ROOT/name).exists() and '--reset-recipe' not in sys.argv:
  print('Preserving editable composition recipe; use --reset-recipe to replace it.')
  return
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
write('manifest.json',{'version':1,'status':'draft-not-runtime-bound','assets':assets,'coverage':'location-pools.example.json','recipe':'composition.example.json','requestedGroundDimensions':[3072,1728],'actualDimensionsNote':'Native landscape outputs are measured per asset. Requested size does not imply delivered size; no originals were enlarged or repainted by this script.','reviewRequired':['Alpha cleanup and opaque material review.','Expanded native-resolution masters for larger camera travel.','Region-specific interior backdrops and prop lighting.','Actor feet, contact shadows and runtime integration.']})
byfile={a['file']:a for a in assets}
old={a['file']:a for a in read(PREVIOUS/'manifest.json')['assets']}
prev=lambda file:'../batch-05-regions/'+file
presets=[]
for i,region in enumerate(REGIONS):
 ground=region+'/ground-'+CITY_GROUNDS[i]+'.png'
 p={'id':region+'/city','label':LABELS[i]+' settlement','group':'settlements','regionId':region,'ground':ground,'backdrop':prev(region+'/backdrop-'+BACKDROPS[i]+'.png'),'backdropScale':1.6 if region=='pale-marches' else 1,'groundContactY':byfile[ground]['medianCenterHorizonY'],'props':[{'file':region+'/prop-'+BUILDINGS[i]+'.png','anchorU':.20,'visibleWidthFraction':.30,'maximumHeightFraction':.53,'baseOcclusionPixels':16},{'file':prev(region+'/prop-'+ACCENTS[i]+'.png'),'anchorU':.84,'visibleWidthFraction':.18,'maximumHeightFraction':.32,'baseOcclusionPixels':12}]}
 presets.append(p)
 ground=DUNGEON_GROUNDS[i]
 presets.append({'id':region+'/dungeon','label':LABELS[i]+' dungeon floor','group':'interiors','regionId':region,'ground':ground,'backdrop':prev('interiors/backdrop-vaulted-depths.png'),'groundContactY':byfile[ground]['medianCenterHorizonY'],'props':[{'file':prev('interiors/prop-iron-gate.png'),'anchorU':.82,'visibleWidthFraction':.24,'maximumHeightFraction':.48,'baseOcclusionPixels':16}]})
ground='pale-marches/ground-ice-bank.png'
presets.append({'id':'pale-marches/shore','label':'Pale Marches frozen inlet','group':'shore','regionId':'pale-marches','ground':ground,'backdrop':'interiors/backdrop-frozen-inlet.png','groundContactY':byfile[ground]['medianCenterHorizonY'],'props':[{'file':prev('pale-marches/prop-frozen-wall.png'),'anchorU':.82,'visibleWidthFraction':.24,'maximumHeightFraction':.25,'baseOcclusionPixels':16}]})
oldrecipe=read(PREVIOUS/'composition.example.json')
write('composition.example.json',{'version':1,'status':'preview-only','canvas':{'width':1672,'height':941},'cameras':oldrecipe['cameras'],'propPlacementRule':'Position measured alpha >= 32 silhouettes relative to each camera. Keep props behind the ground; baseOcclusionPixels sets overlap. Placement is illustrative, not runtime logic.','backdropPlacementRule':'Scale uniformly around bottom center; scale defaults to 1. Values above 1 crop/zoom existing pixels without adding source detail.','presets':presets,'notes':['All sources remain unchanged. Previews compose separate layers.','Landscape side margins are 356px; ultrawide side margins 196px; portrait top/bottom margins about 70px. Wider vertical motion requires more painted source.','Regional dungeon floors reuse a shared vaulted backdrop and iron gate, pending bespoke architecture/lighting.','House scales are rear-scene composition examples; actor-scale and contact-shadow checks remain pending.']})
print('Measured 17 sources; wrote 11 editable compositions.')
