"""Normalize held stances, preserve provenance, and export portable Workshop/Pose Studio projects.

Only crops, common-scale resampling and floor registration occur here. No anatomy,
hidden surfaces, weapon grips or poses are invented by the compositor.
"""
import argparse, base64, hashlib, json, subprocess
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'pose-studio/stances'
STANCES = ['offensive', 'defensive', 'casting']
PROJECTS_ONLY = False
EQUIVALENCES = {'reaver-wayfarerPlate': 'reaver-default', 'rogue-gutterLeathers': 'rogue-default',
                'starseer-nightweave': 'starseer-default', 'herald-riteVestments': 'herald-default'}
POLYGONS = {
 'reaver-default': [ [(0,0),(613,0),(613,520),(584,520),(584,1024),(0,1024)],
                     [(613,0),(1100,0),(1100,1024),(584,1024),(584,520),(613,520)],
                     [(1100,0),(1536,0),(1536,1024),(1100,1024)] ],
 'rogue-default': [ [(0,0),(667,0),(667,690),(548,690),(548,1024),(0,1024)],
                    [(667,0),(1060,0),(1060,1024),(548,1024),(548,690),(667,690)],
                    [(1060,0),(1536,0),(1536,1024),(1060,1024)] ],
 'starseer-default': [ [(0,0),(551,0),(551,360),(478,360),(478,540),(522,540),(522,1024),(0,1024)],
                       [(551,0),(1090,0),(1090,405),(1080,405),(1080,560),(1045,560),(1045,1024),(522,1024),(522,540),(478,540),(478,360),(551,360)],
                       [(1090,0),(1536,0),(1536,1024),(1045,1024),(1045,560),(1080,560),(1080,405),(1090,405)] ],
 'herald-default': [ [(0,0),(548,0),(548,1024),(0,1024)],
                     [(548,0),(1037,0),(1037,1024),(548,1024)],
                     [(1037,0),(1536,0),(1536,1024),(1037,1024)] ],
}

def write(path, value):
 path.parent.mkdir(parents=True, exist_ok=True)
 path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8', newline='\n')

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def uri(path): return 'data:image/webp;base64,' + base64.b64encode(path.read_bytes()).decode()
def bounds(image): return image.getchannel('A').point(lambda a: 255 if a > 32 else 0).getbbox()

def export(actor, images, sources):
 frames = {}
 for stance, image in images.items():
  box = bounds(image)
  if not box or min(box) < 8 or box[2] > 504 or box[3] > 496: raise ValueError(f'Clipped {actor}/{stance}: {box}')
  folder = OUT / 'frames' / actor
  folder.mkdir(parents=True, exist_ok=True)
  path = folder / (stance+'.webp'); lite = folder / (stance+'.lite.webp')
  if not PROJECTS_ONLY:
   image.save(path, 'WEBP', quality=90, method=4)
   image.resize((256,256),Image.Resampling.LANCZOS).save(lite,'WEBP',quality=84,method=4)
  frames[stance] = {'path': path.relative_to(ROOT).as_posix(), 'lite': lite.relative_to(ROOT).as_posix(),
                    'size': [512,512], 'bounds': list(box), 'anchor': [256,464], 'sha256':sha(path), 'liteSha256':sha(lite)}
 rig = {'schemaVersion':1, 'id':'alternative.stance.'+actor, 'name':actor+' · three held stances', 'canvas':{'width':512,'height':512},
        'assets':{},'poses':{},'animations':{},'queues':{}}
 starter = json.loads((ROOT/'content/config/ui/presentation/presentationSequence.json').read_text())['components']['starter']
 for stance, frame in frames.items():
  embedded = uri(ROOT/frame['path']); rig['assets'][stance] = {'id':stance,'src':embedded}
  grip = 'two-handed' if actor.split('-')[0] in ['reaver','starseer'] and stance != 'casting' else 'released'
  if actor.startswith('starseer') and stance=='casting': grip='one-handed'
  rig['poses'][stance] = {'id':stance,'name':stance,'gripMode':grip,'reviewed':False,'bones':[],
   'notes':'Flattened painted held stance; body/hand partitions are not rigged. Inspect anatomy before approval.',
   'layers':[{'id':'figure','name':'Painted figure','role':'body','assetId':stance,'x':0,'y':0,'rotation':0,'scale':1,
              'opacity':1,'pivot':[256,464],'visible':True,'locked':False,
              'anchors':[{'id':'floor','kind':'joint','name':'Floor','x':256,'y':464}]}]}
  rig['animations'][stance] = {'id':stance,'name':stance+' · hold','frames':[{'id':stance+'-hold','poseId':stance,'duration':260,'event':'','overrides':{}}]}
  project = {**starter,'id':'alternative.stance.'+actor+'.'+stance,'name':actor+' · '+stance,'duration':260,
   'actor':actor.split('-')[0], 'poses':[stance]*5, 'assets':{'pose:'+stance:embedded},'bindings':[],'clips':[], 'dependencies':[]}
  pose_path=OUT/'projects'/actor/(stance+'.pose.json')
  if actor in POLYGONS: write(pose_path, project)
  else: pose_path.unlink(missing_ok=True) # Existing Pose Studio catalog supports player classes only.
 rig['queues']['review'] = {'id':'review','name':'Three held stances','items':[
  {'id':'review-'+s,'animationId':s,'repeats':1,'pause':600} for s in STANCES]}
 write(OUT/'projects'/actor/(actor+'.rig.json'),rig)
 print(actor, len(frames), 'held poses exported', flush=True)
 return {'frames':frames,'sources':sources,'rig':f'pose-studio/stances/projects/{actor}/{actor}.rig.json', 'poseStudioSupported':actor in POLYGONS}

def build(source_checkout, only=None):
 inventory=json.loads(subprocess.check_output(['node','tools/alternative-stances-inventory.mjs'],cwd=ROOT,text=True,encoding='utf-8'))
 actors=json.loads((OUT/'registry.json').read_text())['actors'] if only else {}
 normalizations=json.loads((OUT/'source/normalization.json').read_text()) if only else {}
 for actor, polygons in POLYGONS.items():
  if only and actor != only: continue
  path=OUT/'source'/(actor+'.png')
  if not path.exists(): continue
  sheet=Image.open(path).convert('RGBA'); pieces=[]
  for polygon in polygons:
   mask=Image.new('L',sheet.size);ImageDraw.Draw(mask).polygon(polygon,fill=255)
   isolated=sheet.copy();isolated.putalpha(ImageChops.multiply(sheet.getchannel('A'),mask))
   box=bounds(isolated);pieces.append((isolated,box))
  # Same scale in all three poses; each keeps its own painted floor baseline.
  scale=min(420/max(b[3]-b[1] for _,b in pieces),470/max(b[2]-b[0] for _,b in pieces))
  images={};recipes=[]
  for stance,(isolated,box),polygon in zip(STANCES,pieces,polygons):
   cut=isolated.crop(box);resized=cut.resize((round(cut.width*scale),round(cut.height*scale)),Image.Resampling.LANCZOS)
   canvas=Image.new('RGBA',(512,512));canvas.alpha_composite(resized,(round(256-resized.width/2),464-resized.height))
   images[stance]=canvas;recipes.append({'stance':stance,'polygon':polygon,'bounds':box,'scale':scale,'floor':box[3]})
  actors[actor]={'kind':'player','status':'painted-draft',**export(actor,images,[{'kind':'imagegen','path':path.relative_to(ROOT).as_posix(),'sha256':sha(path)}])}
  normalizations[actor]=recipes
 for enemy in inventory['enemies']:
  if only and enemy['id'] != only: continue
  actor=enemy['id']; images={}; sources=[]
  names={'offensive':f'enemy-poses/{actor}_attack.webp','defensive':f'enemy-states/{actor}_guard.webp','casting':f'enemy-states/{actor}_buff.webp'}
  for stance,rel in names.items():
   path=source_checkout/'assets-mobile'/rel
   if not path.exists(): continue
   original=Image.open(path).convert('RGBA')
   # The existing enemy family has a shared 384 canvas, foot (192,364).
   canvas=Image.new('RGBA',(512,512)); scale=1.20
   resized=original.resize((round(original.width*scale),round(original.height*scale)),Image.Resampling.LANCZOS)
   canvas.alpha_composite(resized,(round(256-192*scale),round(464-364*scale)))
   images[stance]=canvas;sources.append({'stance':stance,'kind':'existing-painted-pose-reuse','assetId':'assets/'+rel,'sourceSize':list(original.size),'sha256':sha(path)})
  if images: actors[actor]={'kind':'enemy','name':enemy['name'],'status':'reused-painted-draft',**export(actor,images,sources)}
 rows=[]
 for player in inventory['players']:
  source=EQUIVALENCES.get(player['id'],player['id']); available=actors.get(source)
  if available and player['id']!=source: actors[player['id']]={**available,'equivalentTo':source,'status':'explicit-same-class-equivalence'}
  rows.append({**player,'kind':'player','stanceSource':source if available else None,'status':actors.get(player['id'],{}).get('status','unpainted'),
               'stances':{s:bool(available and s in available['frames']) for s in STANCES}})
 for enemy in inventory['enemies']:
  available=actors.get(enemy['id']);rows.append({**enemy,'kind':'enemy','status':available['status'] if available else 'unpainted',
                                              'stances':{s:bool(available and s in available['frames']) for s in STANCES}})
 counts={'canonicalPlayers':len(inventory['players']),'canonicalEnemies':len(inventory['enemies']),
         'newPlayerAppearances':sum(a['status']=='painted-draft' for a in actors.values()),
         'explicitEquivalences':sum(a['status']=='explicit-same-class-equivalence' for a in actors.values()),
         'reusedEnemyAppearances':sum(a['kind']=='enemy' for a in actors.values()),
         'unpaintedCanonicalCells':sum(r['status']=='unpainted' for r in rows),
         'availableStanceCells':sum(sum(r['stances'].values()) for r in rows),'requiredStanceCells':len(rows)*3}
 catalog={'schemaVersion':1,'target':'alternative/dev','status':'held-stance-authoring-and-integration-seam',
          'stances':STANCES,'counts':counts,'coverage':rows,'actors':actors,
          'notes':['No unpainted armour cell is substituted with a different class or default outfit.',
                   'Enemy attack/guard/buff paintings are held-pose adaptations, not newly repainted stances.',
                   'Enemy stance selection accepts only the observer public committed-intent projection.',
                   'Reduced motion and Instant retain the static readable stance. No action timing is changed.']}
 write(OUT/'registry.json',catalog);write(OUT/'source/normalization.json',normalizations)
 (ROOT/'src/content/alternativeStances.js').write_text('// GENERATED by tools/alternative-stances-build.py.\nexport const alternativeStances = '+json.dumps(catalog,separators=(',',':'))+';\n',encoding='utf-8',newline='\n')
 print(json.dumps(counts))

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source-checkout',type=Path,default=ROOT)
 parser.add_argument('--projects-only',action='store_true',help='Rebuild metadata/projects without re-encoding existing sprites')
 parser.add_argument('--actor',help='Rebuild one authored actor, retaining the other validated exports')
 args=parser.parse_args();PROJECTS_ONLY=args.projects_only
 build(args.source_checkout.resolve(), args.actor)
