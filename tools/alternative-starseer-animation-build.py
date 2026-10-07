"""Normalize Starseer sheets and export portable projects using the reviewed Reaver contract."""
from pathlib import Path
from PIL import Image
import json, base64, hashlib, shutil
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'pose-studio/renewal'
OUT=BASE/'starseer'
GEN=OUT/'source'
SHEETS={'attack': ('attack.png', 0.72, [('ready', (0, 0, 512, 516), 240, 508), ('advance', (1024, 0, 1536, 516), 1270, 505), ('contact', (0, 516, 580, 1024), 240, 990), ('follow', (580, 516, 1065, 1024), 800, 990), ('return', (1065, 516, 1536, 1024), 1298, 1010)]), 'windup': ('windup.png', 0.34, [('windup', (0, 0, 1024, 1536), 585, 1390)]), 'reactions': ('reactions.png', 0.53, [('hurt', (0, 0, 724, 724), 360, 710), ('hurt-recover', (724, 0, 1448, 724), 1080, 710), ('down', (1448, 0, 2172, 724), 1780, 710)]), 'casts': ('casts.png', 0.52, [('power', (0, 0, 724, 724), 360, 700), ('channel', (724, 0, 1448, 724), 1080, 700), ('release', (1448, 0, 2172, 724), 1800, 700)])}
for sub in ['frames','source']: (OUT/sub).mkdir(parents=True,exist_ok=True)
frames={}
for sheet,(file,scale,poses) in SHEETS.items():
 src=Image.open(GEN/file).convert('RGBA')
 for name,box,x,y in poses:
  crop=src.crop(box)
  crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS)
  frame=Image.new('RGBA',(512,512));frame.alpha_composite(crop,(round(256-(x-box[0])*scale),round(464-(y-box[1])*scale)))
  frame.save(OUT/'frames'/f'{name}.png')
  frame.save(OUT/'frames'/f'{name}.webp','WEBP',quality=88,method=6)
  frame.resize((256,256),Image.Resampling.LANCZOS).save(OUT/'frames'/f'{name}.lite.webp','WEBP',quality=80,method=6)
  bounds=frame.getchannel('A').point(lambda a:255 if a>8 else 0).getbbox()
  assert bounds and min(bounds)>0 and max(bounds)<512,(name,bounds)
  frames[name]={'path':'starseer/frames/'+name+'.webp','lite':'starseer/frames/'+name+'.lite.webp','bounds':list(bounds),'anchor':[256,464]}
def uri(name):return 'data:image/webp;base64,'+base64.b64encode((OUT/'frames'/f'{name}.webp').read_bytes()).decode()
manifest=json.loads((BASE/'manifest.json').read_text())
manifest['frames']=frames;manifest['classId']='starseer';manifest['loadout']='staff'
manifest['sequences']['attack']['label']='Staff attack'
manifest['sequences']['attack']['effect']='impact'
manifest['coverage']=[dict(r,status='draft' if r['classId']=='starseer' and r['loadout']=='staff' else 'pending') for r in manifest['coverage']]
manifest['bytes']={tier:sum(p.stat().st_size for p in (OUT/'frames').glob('*.lite.webp' if tier=='lite' else '*.webp') if tier=='lite' or '.lite.' not in p.name) for tier in ['webp','lite']}
manifest['sourceHashes']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (OUT/'source').glob('*.png')}
manifest['notes']=['Staff is retained while casting; free hand releases the spell.','Flattened poses, with separate runtime effects.','Wind-up uses a dedicated repair to preserve the full staff ornament.','Final hand contacts and reaction staff-tip margin need review before gameplay binding.']
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
rig=json.loads((BASE/'reaver-sword.rig.json').read_text());rig['name']='Alternative Starseer · staff'
for name in frames:
 rig['assets'][name]['src']=uri(name);rig['poses'][name]['gripMode']='one-handed'
rig['animations']['attack']['name']='Staff attack'
(OUT/'starseer-staff.rig.json').write_text(json.dumps(rig,separators=(',',':')))
for action in ['attack','power','spell']:
 project=json.loads((BASE/f'{action}.pose.json').read_text());project['actor']='starseer';project['id']='alternative.starseer.staff.'+action;project['name']='Alternative Starseer · '+manifest['sequences'][action]['label']
 for pose in project['poses']:project['assets']['pose:'+pose]=uri(pose)
 if action=='attack':
  project['clips'][0]['effect']='impact';project['clips'][0]['id']='effect-impact'
  project['assets']={k:v for k,v in project['assets'].items() if not k.startswith('assets/combat-effects/')}
  for i in range(1,7):
   path='assets/combat-effects/impact'+str(i)+'.webp'
   project['assets'][path]='data:image/webp;base64,'+base64.b64encode((ROOT/path.replace('assets/','assets-mobile/',1)).read_bytes()).decode()
 (OUT/f'{action}.pose.json').write_text(json.dumps(project,separators=(',',':')))
(OUT/'source/normalization.json').write_text(json.dumps(SHEETS,indent=2)+'\n')
print(json.dumps({'frames':len(frames),'bytes':manifest['bytes']}))

# Refresh coverage only after every portable family project has been written.
import runpy
runpy.run_path(str(ROOT/'tools/alternative-animation-registry.py'))['refresh']()
