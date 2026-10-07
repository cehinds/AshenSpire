from pathlib import Path
import json, re, hashlib, subprocess
from PIL import Image, ImageDraw

HERE=Path(__file__).resolve().parent
PACK=HERE.parent
REPO=PACK.parents[2]
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,data): p.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
catalog=json.loads((PACK/'catalog.json').read_text(encoding='utf-8'))
env=json.loads((REPO/'content/config/ui/presentation/environments.json').read_text(encoding='utf-8'))
legacytext=(REPO/'src/content/generated/legacyDungeons.js').read_text(encoding='utf-8')
legacy=json.loads(legacytext[legacytext.index('{'):legacytext.rindex('}')+1])
scenes=[]
for region in env['components']['regions']:
    for s in region['scenes']:
        scenes.append(dict(id=s['id'],name=s['name'],region=region['id'],source=region['atlas'],box=s['box'],kind='regional',status='planned'))
for s in legacy['scenes']:
    scenes.append(dict(id=s['id'],name=s['name'],region=s['region'],source=s['background'],floor=s['floor'],kind='dungeon',status='planned'))
sprites=[]
for e in catalog['entries']:
    keep=e['family'] in ('armor','enemy')
    sprites.append(dict(id=e['id'],family=e['family'],file=e['file'],sha256=sha(PACK/e['file']),decision='retain-approved' if keep else 'rear-view-required',reason='Approved rear hero silhouette' if e['family']=='armor' else 'Left-facing enemy matches opposing depth view' if e['family']=='enemy' else 'Side/front ally needs rear three-quarter view',status='reviewed' if keep else 'planned'))
used={s['source'] for s in scenes}|{s['floor'] for s in scenes if 'floor' in s}
files=[]
for group in ('bg','environments','map'):
    for p in sorted((REPO/'assets-mobile'/group).rglob('*')):
        if p.suffix not in ('.webp','.png','.svg','.jpg'):continue
        key='assets/'+p.relative_to(REPO/'assets-mobile').as_posix()
        purpose='combat source' if key in used else 'map navigation' if 'map' in p.stem or group=='map' or 'world' in p.stem or 'crownfall' in p.stem or 'fractured-realm-square' in p.stem else 'title/prologue/legacy act backdrop'
        files.append(dict(file=key,mobile=p.relative_to(REPO).as_posix(),purpose=purpose,decision='replace-in-art-catalog' if key in used else 'retain-outside-combat-view'))
write(HERE/'inventory.json',dict(baseRevision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip(),scope='Artwork and catalog only; no runtime/editor/workflow changes',sprites=sprites,scenes=scenes,environmentFiles=files,counts=dict(sprites=len(sprites),retain=52,convert=7,scenes=len(scenes),environmentFiles=len(files))))
(HERE/'PLAN.txt').write_text('Alternative combat art continuation — 2026-10-06\n\nInventory before production: 59 actors, 32 combat scenes, 58 environment/library files.\nRetain 19 approved rear armor appearances and 33 left-facing enemies.\nConvert 2 companions and 5 speakers to rear three-quarter right; retain originals.\nReaver red cloak and corrected sword master are protected by hash comparison.\n\nProduce each of 32 scenes as four independent layer references: far distance,\nunique landmark, registered ground, edge foreground. Share regional far/ground/\nforeground masters deliberately; each scene has its own landmark identity.\nUse separate phone framing and layer transforms, preserving clear actor space.\nNo actor or UI baked into scenery. Keep alpha in landmarks/ground/foreground.\n\nRecord original source, exact prompt, hashes, alpha bounds and anchor metadata.\nValidate roster/scene coverage, alpha separation, clearance, compositions and\nall relative paths. Review desktop and phone contact sheets and moving preview.\nDeliver dedicated alternative/dev-based branch and asset integration commit.\nRuntime gameplay, HUD, cards, footer, layout editing, CI and merges are excluded.\n',encoding='utf-8',newline='\n')
thumbs=[]
for i,s in enumerate(scenes):
    source=REPO/s['source']
    if not source.exists(): source=REPO/s['source'].replace('assets/','assets-mobile/',1)
    im=Image.open(source).convert('RGB')
    if s['kind']=='regional':
        j=int(s['id'][-1])-1; w,h=im.size; im=im.crop(((j%2)*w//2,(j//2)*h//2,(j%2+1)*w//2,(j//2+1)*h//2))
    im.thumbnail((380,240));thumbs.append((s,im))
sheet=Image.new('RGB',(1600,8*285),'#20211f');d=ImageDraw.Draw(sheet)
for i,(s,im) in enumerate(thumbs):
    x=(i%4)*400;y=(i//4)*285;sheet.paste(im,(x,y));d.text((x+8,y+243),s['id']+' / '+s['name'],fill='#e5d6b0')
sheet.save(HERE/'source-scenes.jpg')
print(json.dumps(dict(sprites=len(sprites),scenes=len(scenes),files=len(files))))
