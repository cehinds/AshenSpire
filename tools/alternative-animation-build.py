"""Build the first alternative sprite study and portable authoring projects.

Only cuts/normalizes supplied whole-sheet artwork. No pose is synthesized by
rotating an idle sprite. Source boxes and floor anchors are reviewed explicitly.
Run from any directory: python tools/alternative-animation-build.py.
"""
import base64
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'pose-studio/renewal'
FRAMES = OUT / 'frames'
FRAMES.mkdir(parents=True, exist_ok=True)

# x anchor is the planted stance, not the changing weapon/cloak envelope.
SHEETS = {
    'attack': {'scale': .72, 'poses': [
        ('ready', (0, 0, 512, 520), 286, 510),
        ('windup', (512, 0, 1018, 520), 806, 510),
        ('advance', (1018, 0, 1536, 520), 1284, 510),
        ('contact', (0, 520, 580, 1024), 265, 998),
        ('follow', (580, 520, 1030, 1024), 797, 1005),
        ('return', (1030, 520, 1536, 1024), 1280, 1015),
    ]},
    'reactions': {'scale': .72, 'poses': [
        ('hurt', (0, 0, 512, 500), 286, 487),
        ('hurt-recover', (512, 0, 1024, 500), 798, 490),
        ('down', (1024, 0, 1536, 500), 1300, 487),
    ]},
    'casts': {'scale': .5, 'poses': [
        ('power', (0, 0, 724, 724), 430, 720),
        ('channel', (724, 0, 1448, 724), 1130, 720),
        ('release', (1448, 0, 2172, 724), 1840, 720),
    ]},
}
sequences = {
    'attack': {'label': 'Sword attack', 'poses': ['windup','advance','contact','follow','return'], 'durations': [60,55,50,45,50], 'travel': [0,7,18,12,0], 'effect': 'slash', 'impact': 2, 'hold': False},
    'hurt': {'label': 'Hurt & recover', 'poses': ['hurt','hurt-recover','ready'], 'durations': [85,85,90], 'travel': [-9,-4,0], 'effect': None, 'impact': 0, 'hold': False},
    'down': {'label': 'Down / defeated', 'poses': ['hurt','down'], 'durations': [80,180], 'travel': [-4,0], 'effect': None, 'impact': 1, 'hold': True},
    'power': {'label': 'Basic power cast', 'poses': ['power','power','channel','power','power'], 'durations': [60,55,50,45,50], 'travel': [0,0,0,0,0], 'effect': 'ward', 'impact': 2, 'hold': False},
    'spell': {'label': 'Spell cast', 'poses': ['power','channel','release','release','power'], 'durations': [60,55,50,45,50], 'travel': [0,0,2,1,0], 'effect': 'starbolt', 'impact': 2, 'hold': False},
}
frames = {}
for sheet, spec in SHEETS.items():
    source = Image.open(OUT / 'source' / (sheet + '.png')).convert('RGBA')
    for name, box, anchor_x, floor in spec['poses']:
        crop = source.crop(box)
        scale = spec['scale']
        crop = crop.resize((round(crop.width*scale), round(crop.height*scale)), Image.Resampling.LANCZOS)
        frame = Image.new('RGBA', (512,512))
        frame.alpha_composite(crop, (round(256-(anchor_x-box[0])*scale), round(464-(floor-box[1])*scale)))
        frame.save(FRAMES / (name+'.png'))
        frame.save(FRAMES / (name+'.webp'), 'WEBP', quality=88, method=6)
        frame.resize((256,256), Image.Resampling.LANCZOS).save(FRAMES / (name+'.lite.webp'), 'WEBP', quality=80, method=6)
        frames[name] = {'path': 'frames/'+name+'.webp', 'lite': 'frames/'+name+'.lite.webp', 'bounds': list(frame.getchannel('A').point(lambda a: 255 if a>8 else 0).getbbox()), 'anchor': [256,464]}

classes = ['reaver','rogue','starseer','herald']
loadouts = [
    ('sword','Sword'), ('swordShield','Sword + shield'), ('staff','Staff'),
    ('unarmed','Unarmed'), ('twinDaggers','Twin daggers'), ('dagger','One dagger'),
    ('halberd','Halberd'), ('halberdShield','Halberd + shield'),
    ('twinSwords','Twin swords'), ('twoWeaponSwords','Two-weapon sword fighting'),
]
manifest = {'schemaVersion':1, 'target':'alternative/dev', 'status':'authoring-preview', 'classes':classes,
    'loadouts':[{'id':i,'label':n} for i,n in loadouts], 'frames':frames, 'sequences':sequences,
    'coverage':[{'classId':c,'armour':'default','loadout':i,'status':'draft' if c=='reaver' and i=='sword' else 'pending'} for c in classes for i,_ in loadouts],
    'notes':['First reference family only; other loadouts are pending and never substituted.',
        'Casting uses a sheathed sword; ready-to-sheath transition remains an art review item.',
        'Twin swords and two-weapon sword fighting remain separate authoring entries pending distinct choreography.',
        'Enemy and non-base-armour animation expansion follows this base-loadout pass.',
        'No runtime bindings or gameplay equipment rules are changed by this study.'],
    'sourceHashes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (OUT/'source').glob('*.png')},
    'bytes':{'webp':sum(p.stat().st_size for p in FRAMES.glob('*.webp') if '.lite.' not in p.name), 'lite':sum(p.stat().st_size for p in FRAMES.glob('*.lite.webp'))}}
manifest['families']={'reaver/sword':{'rig':'reaver-sword.rig.json','folder':''}}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')

def data_url(path):
    return 'data:image/webp;base64,'+base64.b64encode(path.read_bytes()).decode()

rig={'schemaVersion':1,'name':'Alternative Reaver · base sword study','canvas':{'width':512,'height':512},'assets':{},'poses':{},'animations':{},'queues':{}}
for name in frames:
    rig['assets'][name]={'id':name,'src':data_url(FRAMES/(name+'.webp'))}
    rig['poses'][name]={'id':name,'name':name,'gripMode':'one-handed','reviewed':False,'bones':[],
        'notes':'Flattened generated pose. Body/weapon partitions are not yet painted and rigged.',
        'layers':[{'id':'figure','name':'Painted figure','role':'body','assetId':name,'x':0,'y':0,'rotation':0,'scale':1,'opacity':1,'pivot':[256,464],'visible':True,'locked':False,'anchors':[{'id':'floor','kind':'joint','x':256,'y':464}]}]}
for name, seq in sequences.items():
    rig['animations'][name]={'id':name,'name':seq['label'],'frames':[{'id':name+'-'+str(i),'poseId':pose,'duration':seq['durations'][i],'event':'contact' if i==seq['impact'] else '', 'overrides':{'figure':{'x':seq['travel'][i]}}} for i,pose in enumerate(seq['poses'])]}
rig['queues']['review']={'id':'review','name':'Review actions','items':[{'id':'queue-'+name,'animationId':name,'repeats':1,'pause':600} for name in sequences]}
(OUT/'reaver-sword.rig.json').write_text(json.dumps(rig,separators=(',',':')),encoding='utf-8')

starter=json.loads((ROOT/'content/config/ui/presentation/presentationSequence.json').read_text())['components']['starter']
for name in ['attack','power','spell']:
    seq=sequences[name]
    project={**starter,'id':'alternative.reaver.sword.'+name,'name':'Alternative Reaver · '+seq['label'],'actor':'reaver','duration':260,'poses':seq['poses'],'bindings':[],'clips':[], 'assets':{},'dependencies':['ashenspire.effects']}
    for pose in seq['poses']:
        project['assets']['pose:'+pose]=data_url(FRAMES/(pose+'.webp'))
    effect=seq['effect']
    project['clips']=[{'id':'effect-'+effect,'effect':effect,'cue':'contact','offset':-15,'duration':130,'anchor':'weapon' if name=='attack' else 'hand','x':0,'y':0,'size':190,'opacity':.6,'rotation':0,'layer':'front','travel':name=='spell','muted':False}]
    for i in range(1,7):
        key='assets/combat-effects/'+effect+str(i)+'.webp'
        project['assets'][key]=data_url(ROOT/key.replace('assets/','assets-mobile/',1))
    (OUT/(name+'.pose.json')).write_text(json.dumps(project,separators=(',',':')),encoding='utf-8')

# Refresh coverage only after every portable family project has been written.
import runpy
draft_families=runpy.run_path(str(ROOT/'tools/alternative-animation-registry.py'))['refresh']()
print(json.dumps({'frames':len(frames),'coverage':len(manifest['coverage']),'draftFamilies':draft_families,'bytes':manifest['bytes']}))
