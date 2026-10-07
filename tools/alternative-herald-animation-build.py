"""Normalize Herald sheets and export portable projects using the reviewed Reaver contract."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops
import json, base64, hashlib, shutil
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'pose-studio/renewal'
OUT=BASE/'herald'
GEN=OUT/'source'
SHEETS={
 'attack': ('attack.png', .68, [
  ('ready',(0,0,560,516),280,502),('windup',(560,0,1050,516),800,502),('advance',(1050,0,1536,516),1270,502),
  ('contact',(0,516,660,1024),280,987),('follow',(520,516,1055,1024),800,987),('return',(1055,516,1536,1024),1270,987)]),
 'reactions': ('reactions.png', .58, [('hurt',(0,0,724,724),350,662),('hurt-recover',(724,0,1448,724),1080,662),('down',(1370,260,2172,724),1780,662)]),
 'casts': ('casts.png', .52, [('power',(0,0,724,724),350,689),('channel',(724,0,1448,724),1080,689),('release',(1448,0,2172,724),1800,689)])
}
# Split the shared gutter around the contact blade and adjacent trailing cloak.
GUTTERS={'contact':[(0,516),(660,516),(660,650),(520,800),(520,1024),(0,1024)],
         'follow':[(660,516),(1055,516),(1055,1024),(520,1024),(520,800),(660,650)],
         'hurt-recover':[(724,0),(1448,0),(1448,350),(1370,450),(1370,724),(724,724)]}

for sub in ['frames','source']: (OUT/sub).mkdir(parents=True,exist_ok=True)
frames={}
for sheet,(file,scale,poses) in SHEETS.items():
 src=Image.open(GEN/file).convert('RGBA')
 for name,box,x,y in poses:
  isolated=src
  if name in GUTTERS:
   mask=Image.new('L',src.size);ImageDraw.Draw(mask).polygon(GUTTERS[name],fill=255)
   isolated=src.copy();isolated.putalpha(ImageChops.multiply(src.getchannel('A'),mask))
  crop=isolated.crop(box)
  crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS)
  frame=Image.new('RGBA',(512,512));frame.alpha_composite(crop,(round(256-(x-box[0])*scale),round(464-(y-box[1])*scale)))
  frame.save(OUT/'frames'/f'{name}.png')
  frame.save(OUT/'frames'/f'{name}.webp','WEBP',quality=88,method=6)
  frame.resize((256,256),Image.Resampling.LANCZOS).save(OUT/'frames'/f'{name}.lite.webp','WEBP',quality=80,method=6)
  bounds=frame.getchannel('A').point(lambda a:255 if a>8 else 0).getbbox()
  assert bounds and min(bounds)>0 and max(bounds)<512,(name,bounds)
  frames[name]={'path':'herald/frames/'+name+'.webp','lite':'herald/frames/'+name+'.lite.webp','bounds':list(bounds),'anchor':[256,464]}
def uri(name):return 'data:image/webp;base64,'+base64.b64encode((OUT/'frames'/f'{name}.webp').read_bytes()).decode()
manifest=json.loads((BASE/'manifest.json').read_text())
manifest['frames']=frames;manifest['classId']='herald';manifest['loadout']='swordShield'
manifest['sequences']['attack']['label']='Sword and shield attack'
manifest['sequences']['attack']['effect']='slash'
manifest['coverage']=[dict(r,status='draft' if r['classId']=='herald' and r['loadout']=='swordShield' else 'pending') for r in manifest['coverage']]
manifest['bytes']={tier:sum(p.stat().st_size for p in (OUT/'frames').glob('*.lite.webp' if tier=='lite' else '*.webp') if tier=='lite' or '.lite.' not in p.name) for tier in ['webp','lite']}
manifest['sourceHashes']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (OUT/'source').glob('*.png')}
manifest['notes']=['Sword in right hand, shield retained on left arm.','Sword sheathed and right hand empty for powers and spells.','Flattened draft poses; final grip, cloak silhouette and sheath transitions need review before gameplay binding.']
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
rig=json.loads((BASE/'reaver-sword.rig.json').read_text());rig['name']='Alternative Herald · sword and shield'
for name in frames:
 rig['assets'][name]['src']=uri(name);rig['poses'][name]['gripMode']='one-handed'
rig['animations']['attack']['name']='Sword and shield attack'
(OUT/'herald-swordShield.rig.json').write_text(json.dumps(rig,separators=(',',':')))
for action in ['attack','power','spell']:
 project=json.loads((BASE/f'{action}.pose.json').read_text());project['actor']='herald';project['id']='alternative.herald.swordShield.'+action;project['name']='Alternative Herald · '+manifest['sequences'][action]['label']
 for pose in project['poses']:project['assets']['pose:'+pose]=uri(pose)
 (OUT/f'{action}.pose.json').write_text(json.dumps(project,separators=(',',':')))
(OUT/'source/normalization.json').write_text(json.dumps({'sheets':SHEETS,'gutters':GUTTERS},indent=2)+'\n')
print(json.dumps({'frames':len(frames),'bytes':manifest['bytes']}))

# Refresh coverage only after every portable family project has been written.
import runpy
runpy.run_path(str(ROOT/'tools/alternative-animation-registry.py'))['refresh']()
