from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import os,json, hashlib, shutil, html, re

ROOT=Path(__file__).resolve().parent
REPO=Path(os.environ.get('ASHENSPIRE_REPO', ROOT.parents[2])).resolve()
def write(p,s):
    (ROOT/p).write_text(s,encoding='utf-8',newline='\n')
def save(p,obj): write(p,json.dumps(obj,indent=2)+'\n')

# These are copies, never transformations. Source paths stay authoritative.
paths=[]
for c in ['reaver','rogue','starseer','herald']:
    paths += [f'assets/painted-outfits/{c}/{pose}.webp' for pose in ['menu','portrait','idle']]
paths += ['assets/prologue/'+n+'.webp' for n in ['road-desktop','road-mobile','warmth-desktop','warmth-mobile','carry-reaver-desktop','carry-reaver-mobile']]
paths += ['assets/environments/'+n+'.webp' for n in ['the-fractured-realm-world','fractured-realm-square','crownfall-local','crownfall-landmark','cinder-reach-map','cinder-reach-combat','ashen-crown-map','ashen-crown-combat','hollow-weald-map','hollow-weald-combat','pale-marches-map','pale-marches-combat','drowned-coast-map','drowned-coast-combat']]
paths += ['assets/environments/legacy/'+n+'.webp' for n in ['MAP-03-furnace-chapel','FC-ENV-01-background','FC-ENV-01-floor']]
paths += ['assets/equipment/weapon_'+n+'.webp' for n in ['straightSword','roundShield','warhammer','battleaxe','greatsword','dagger']]
paths += ['assets/relics/'+n+'.webp' for n in ['crackedLantern','forsakenMedallion','cutpursesCoin']]
paths += ['assets/ui/flasks/flask-'+n+'.webp' for n in ['crimson','azure']]
paths += ['assets/enemy-poses/'+n+'_idle.webp' for n in ['wanderingSoldier','blightHound','charredColossus']]
canon=[]
for p in paths:
    src=REPO/p
    assert src.is_file(),p
    out=ROOT/'canonical'/p
    out.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(src,out)
    im=Image.open(out)
    canon.append({'id':p,'file':out.relative_to(ROOT).as_posix(),'source':p,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'width':im.width,'height':im.height,'mode':im.mode,'origin':'canonical-repository-copy','transformed':False})
save('canonical-map.json',{'repository':'https://github.com/cehinds/AshenSpire','readAt':'2026-10-02','assets':canon,'note':'Curated copies only. Runtime must continue resolving original ids through assetUrl and existing outfit/equipment/environment models. Source CREDITS.md applies; new kit credit does not relicense canonical files.'})
write('CANONICAL-CREDITS.md',(REPO/'CREDITS.md').read_text(encoding='utf-8'))
write('CANONICAL-LICENSE.txt',(REPO/'LICENSE').read_text(encoding='utf-8')) if (REPO/'LICENSE').exists() else None
print('Canonical copies:',len(canon))
