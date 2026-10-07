"""Normalize Rogue sheets and export portable projects using the reviewed Reaver contract."""
from pathlib import Path
from PIL import Image
import json, base64, hashlib, shutil
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'pose-studio/renewal'
OUT=BASE/'rogue'
GEN=OUT/'source'
SHEETS={
 'attack':('attack.png',.72,[
  ('ready',(0,0,512,516),285,508),('windup',(512,0,1024,516),805,508),('advance',(1024,0,1536,516),1300,508),
  ('contact',(0,516,550,1024),290,996),('follow',(550,516,1024,1024),800,996),('return',(1024,516,1536,1024),1300,996)]),
 'reactions':('reactions.png',.55,[
  ('hurt',(0,0,724,724),420,655),('hurt-recover',(724,0,1448,724),1095,655),('down',(1448,0,2172,724),1788,660)]),
 'casts':('casts.png',.52,[
  ('power',(4,0,716,724),400,695),('channel',(750,0,1430,724),1110,695),('release',(1460,0,2172,724),1830,695)])}
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
  frames[name]={'path':'rogue/frames/'+name+'.webp','lite':'rogue/frames/'+name+'.lite.webp','bounds':list(bounds),'anchor':[256,464]}
def uri(name):return 'data:image/webp;base64,'+base64.b64encode((OUT/'frames'/f'{name}.webp').read_bytes()).decode()
manifest=json.loads((BASE/'manifest.json').read_text())
manifest['frames']=frames;manifest['classId']='rogue';manifest['loadout']='twinDaggers'
manifest['sequences']['attack']['label']='Twin-dagger attack'
manifest['coverage']=[dict(r,status='draft' if r['classId']=='rogue' and r['loadout']=='twinDaggers' else 'pending') for r in manifest['coverage']]
manifest['bytes']={tier:sum(p.stat().st_size for p in (OUT/'frames').glob('*.lite.webp' if tier=='lite' else '*.webp') if tier=='lite' or '.lite.' not in p.name) for tier in ['webp','lite']}
manifest['sourceHashes']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (OUT/'source').glob('*.png')}
manifest['notes']=['Daggers are sheathed for casting; sheath/draw transition remains pending.','Flattened poses, with separate runtime effects.','Attack contact and follow-through cloak edges need final review before gameplay binding.']
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
rig=json.loads((BASE/'reaver-sword.rig.json').read_text());rig['name']='Alternative Rogue · twin daggers'
for name in frames:
 rig['assets'][name]['src']=uri(name);rig['poses'][name]['gripMode']='one-handed'
rig['animations']['attack']['name']='Twin-dagger attack'
(OUT/'rogue-twinDaggers.rig.json').write_text(json.dumps(rig,separators=(',',':')))
for action in ['attack','power','spell']:
 project=json.loads((BASE/f'{action}.pose.json').read_text());project['actor']='rogue';project['id']='alternative.rogue.twinDaggers.'+action;project['name']='Alternative Rogue · '+manifest['sequences'][action]['label']
 for pose in project['poses']:project['assets']['pose:'+pose]=uri(pose)
 (OUT/f'{action}.pose.json').write_text(json.dumps(project,separators=(',',':')))
(OUT/'source/normalization.json').write_text(json.dumps(SHEETS,indent=2)+'\n')
print(json.dumps({'frames':len(frames),'bytes':manifest['bytes']}))
