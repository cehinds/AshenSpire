"""Normalize generated full-suite atlases and bind completed outfit art to one motion profile."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib, json, shutil, sys
from atlas_components import extract_figures
from attack_preview import add_attack_variant, render_playback, DRY_POSE

PACK=Path(__file__).resolve().parent
ROOT=PACK.parents[1]
OUTFITS=json.loads((PACK/'outfits.json').read_text(encoding='utf-8'))
IDS=['STANCE-READY']+[f'ATK-{i:02}' for i in range(1,8)]+['DEFEND','HURT','CAST','STANCE-AGGRESSIVE','STANCE-DEFENSIVE','BUFF','PORTRAIT']
ATTACK=json.loads((PACK/'attack-sequence.json').read_text(encoding='utf-8'))
ORDER=ATTACK['frames']
FONT=next((ImageFont.truetype(str(p),16) for p in [Path('C:/Windows/Fonts/segoeui.ttf'),Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')] if p.exists()),ImageFont.load_default())

def key(row):
    return row['classId']+('' if row['id']=='default' else '-'+row['id'])

def appearance(row):
    # Shared armor has a dedicated painting for each wearer, despite its legacy art alias.
    return {**row,'id':row['id'] if str(row.get('sharedSet','')).lower()=='true' else row['artKey'] or row['id']}

EXPECTED_APPEARANCES={key(appearance(row)) for row in OUTFITS}

def write_webp(image,path):
    image.save(path,'WEBP',quality=90,method=3,exact=True)
    decoded=Image.open(path)
    assert decoded.size==image.size and decoded.mode=='RGBA'
    assert decoded.getchannel('A').tobytes()==image.getchannel('A').tobytes()

bind_only='--bind-only' in sys.argv
refresh='--refresh-playback' in sys.argv
groups=json.loads((PACK/'manifest.json').read_text(encoding='utf-8'))['groups'] if bind_only or refresh else []
if bind_only or refresh:
    for group in groups:
        assert hashlib.sha256((PACK/'sources'/f"{group['id']}.png").read_bytes()).hexdigest()==group['sourceSha256'], 'Source changed since reviewed export'
        for pose,digest in group['frameSha256'].items():
            assert hashlib.sha256((PACK/group['directory']/f'{pose}.webp').read_bytes()).hexdigest()==digest, 'Frame changed since reviewed export'
for row in ([] if bind_only or refresh else OUTFITS):
    if key(appearance(row)) != key(row): continue
    outfit=key(row)
    dest=PACK/'frames'/outfit
    source=PACK/'sources'/f'{outfit}.png'
    if not source.exists(): continue
    dest.mkdir(parents=True,exist_ok=True)
    frames={}
    atlas=Image.open(source).convert('RGBA')
    assert atlas.getchannel('A').getextrema()[0]==0, f'{outfit}: source must be transparent'
    try:crops,extraction=extract_figures(atlas)
    except AssertionError as error:raise AssertionError(f'{outfit}: {error}') from error
    scale=min(440/max(c.width for c in crops[:14]),440/max(c.height for c in crops[:14]))
    for pose,crop in zip(IDS,crops):
        factor=min(480/crop.width,480/crop.height) if pose=='PORTRAIT' else scale
        scaled=crop.resize((round(crop.width*factor),round(crop.height*factor)),Image.Resampling.LANCZOS)
        opaque=crop.getchannel('A').point(lambda alpha:255 if alpha>32 else 0)
        body=opaque.getbbox()
        foot=opaque.crop((0,max(0,body[3]-12),crop.width,body[3])).getbbox()
        rootx=(foot[0]+foot[2])/2 if foot and pose!='PORTRAIT' else crop.width/2
        x=max(8,min(round(256-rootx*factor),504-scaled.width))
        frame=Image.new('RGBA',(512,512));frame.alpha_composite(scaled,(x,480-round(body[3]*factor)))
        write_webp(frame,dest/f'{pose}.webp');frames[pose]=frame
    add_attack_variant(PACK,outfit,frames,write_webp)
    display=render_playback(dest,frames,ORDER,ATTACK['frameMs'],FONT)
    groups.append({'id':outfit,'classId':row['classId'],'armourId':row['id'],'name':row['name'],'directory':f'frames/{outfit}','sequence':ORDER,'poses':IDS,'display':display,'extraction':extraction,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'frameSha256':{pose:hashlib.sha256((dest/f'{pose}.webp').read_bytes()).hexdigest() for pose in IDS}})
    print(f'Normalized {outfit}',flush=True)

for group in groups:
    dest=PACK/group['directory']
    if refresh:
        frames={pose:Image.open(dest/f'{pose}.webp').convert('RGBA') for pose in IDS}
        add_attack_variant(PACK,group['id'],frames,write_webp)
        group['display']=render_playback(dest,frames,ORDER,ATTACK['frameMs'],FONT)
        print(f"Updated attack {group['id']}",flush=True)
    group['variantSourceSha256']=hashlib.sha256((PACK/'sources'/'buff-no-aura'/f"{group['id']}.png").read_bytes()).hexdigest()
    group['poses']=IDS+[DRY_POSE]
    group['sequence']=ORDER
    group['frameSha256']={pose:hashlib.sha256((dest/f'{pose}.webp').read_bytes()).hexdigest() for pose in group['poses']}

manifest={'motionProfile':'swordShield','sequence':ORDER,'frameMs':ATTACK['frameMs'],'groups':groups,'outfits':OUTFITS,'generator':'built-in image_gen','authoredEquipment':{'rightGroup':'sword','leftGroup':'shield'},'reverseHandArtwork':'shared canonical artwork; not mirrored'}
(PACK/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8',newline='\n')
(PACK/'data.js').write_text('window.SWORD_SHIELD_ART='+json.dumps(manifest)+';\n',encoding='utf-8',newline='\n')
print(f'Exported {len(groups)}/{len(EXPECTED_APPEARANCES)} unique appearances; catalog has {len(OUTFITS)} armor entries.')
if '--bind' in sys.argv or bind_only:
    assert {g['id'] for g in groups}==EXPECTED_APPEARANCES, 'Refuse partial runtime bindings'
    path=ROOT/'content/config/ui/presentation/equipmentAnimations.json'
    doc=json.loads(path.read_text(encoding='utf-8'));data=doc['components']
    profile=data.get('motionProfiles',{}).get('swordShield')
    if profile is None:
        profile=json.loads(json.dumps(data['motionProfiles']['greatswordTwoHand']))
        profile['clips']={name.replace('greatsword','swordShield'):clip for name,clip in profile['clips'].items()}
        profile['references']={role:ref.replace('greatsword','swordShield') if ref else None for role,ref in profile['references'].items()}
    profile['clips']['swordShieldAttack']=dict(ATTACK)
    data.setdefault('motionProfiles',{})['swordShield']=profile
    set_ids={}
    for group in groups:
        outfit=group['id'];set_id=outfit+'SwordShield'
        set_ids[outfit]=set_id
        runtime=ROOT/'assets/animations/sword-shield-outfits'/outfit
        runtime.mkdir(parents=True,exist_ok=True)
        metadata={}
        for pose in IDS+[DRY_POSE]:
            src=PACK/group['directory']/f'{pose}.webp';shutil.copy2(src,runtime/src.name)
            box=Image.open(src).getchannel('A').getbbox()
            metadata[pose]={'file':(runtime/src.name).relative_to(ROOT).as_posix(),'box':dict(zip(['x0','y0','x1','y1'],[round(box[0]*1.25),round(box[1]*1.25),round(box[2]*1.25)-1,round(box[3]*1.25)-1]))}
        data['sets'][set_id]={'motionProfile':'swordShield','authoredEquipment':{'rightGroup':'sword','leftGroup':'shield'},'frames':metadata}
    data['bindings']=[b for b in data['bindings'] if b['setId'] not in set_ids.values()]
    for row in OUTFITS:
        visual=appearance(row)
        for right,left in [('sword','shield'),('shield','sword')]:
            data['bindings'].append({'classId':row['classId'],'armourId':row['id'],'rightGroup':right,'leftGroup':left,'setId':set_ids[key(visual)]})
    path.write_text(json.dumps(doc,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(f'Bound all {len(OUTFITS)} class/armor entries to ordered sword/shield bindings; reverse order shares canonical artwork.')
