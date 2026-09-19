"""Normalize generated full-suite atlases and bind completed outfit art to one motion profile."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, shutil, sys

PACK=Path(__file__).resolve().parent
ROOT=PACK.parents[1]
OUTFITS=json.loads((PACK/'outfits.json').read_text())
IDS=['STANCE-READY']+[f'ATK-{i:02}' for i in range(1,8)]+['DEFEND','HURT','CAST','STANCE-AGGRESSIVE','STANCE-DEFENSIVE','BUFF','PORTRAIT']
ORDER=['STANCE-READY','ATK-07','ATK-04','ATK-02','ATK-03','ATK-05','ATK-01','ATK-04','STANCE-READY']
FONT=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',16)

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

groups=[]
for row in OUTFITS:
    if key(appearance(row)) != key(row): continue
    outfit=key(row)
    dest=PACK/'frames'/outfit
    source=PACK/'sources'/f'{outfit}.png'
    if outfit!='reaver' and not source.exists(): continue
    dest.mkdir(parents=True,exist_ok=True)
    frames={}
    if outfit=='reaver':
        for pose in IDS:
            original=ROOT/'assets/animations/reaver/greatsword-v2'/f'{pose}.webp'
            shutil.copy2(original,dest/original.name)
            frames[pose]=Image.open(original).convert('RGBA')
    else:
        atlas=Image.open(source).convert('RGBA')
        assert atlas.getchannel('A').getextrema()[0]==0, f'{outfit}: source must be transparent'
        crops=[]
        for i in range(15):
            cell=atlas.crop((round(i%4*atlas.width/4),round(i//4*atlas.height/4),round((i%4+1)*atlas.width/4),round((i//4+1)*atlas.height/4)))
            box=cell.getchannel('A').getbbox()
            assert box and (box[2]-box[0])*(box[3]-box[1])>1000, f'{outfit}: missing cell {i}'
            crops.append(cell.crop(box))
        scale=min(440/max(c.width for c in crops[:14]),440/max(c.height for c in crops[:14]))
        for pose,crop in zip(IDS,crops):
            factor=min(480/crop.width,480/crop.height) if pose=='PORTRAIT' else scale
            scaled=crop.resize((round(crop.width*factor),round(crop.height*factor)),Image.Resampling.LANCZOS)
            foot=crop.getchannel('A').crop((0,max(0,crop.height-12),crop.width,crop.height)).getbbox()
            rootx=(foot[0]+foot[2])/2 if foot and pose!='PORTRAIT' else crop.width/2
            x=max(8,min(round(256-rootx*factor),504-scaled.width))
            frame=Image.new('RGBA',(512,512));frame.alpha_composite(scaled,(x,480-scaled.height))
            write_webp(frame,dest/f'{pose}.webp');frames[pose]=frame
    playback=[frames[p] for p in ORDER]
    playback[0].save(dest/'attack-preview.webp','WEBP',save_all=True,append_images=playback[1:],duration=100,loop=0,lossless=True,method=3)
    # Review identifiers are playback steps; source IDs remain stable for configuration.
    display=[('READY',ORDER[0])]+[(f'ATK-{i:02}',p) for i,p in enumerate(ORDER[1:-1],1)]+[(p,p) for p in IDS[8:]]
    sheet=Image.new('RGB',(1200,1360),'#181a1e');draw=ImageDraw.Draw(sheet)
    for i,(label,pose) in enumerate(display):
        x=i%4*300;y=i//4*340
        thumb=frames[pose].resize((292,292),Image.Resampling.LANCZOS);sheet.paste(thumb,(x+4,y+4),thumb)
        draw.text((x+10,y+300),label,font=FONT,fill='#e8ce96')
        draw.text((x+10,y+320),'Source: '+pose,font=FONT,fill='#aaaab5')
    sheet.save(dest/'labeled-sheet.webp','WEBP',quality=90,method=3)
    groups.append({'id':outfit,'classId':row['classId'],'armourId':row['id'],'name':row['name'],'directory':f'frames/{outfit}','sequence':ORDER,'poses':IDS,'display':display})

manifest={'motionProfile':'greatswordTwoHand','sequence':ORDER,'frameMs':100,'groups':groups,'outfits':OUTFITS,'generator':'built-in image_gen'}
(PACK/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8',newline='\n')
(PACK/'data.js').write_text('window.GREATSWORD_ART='+json.dumps(manifest)+';\n',encoding='utf-8',newline='\n')
print(f'Exported {len(groups)}/{len(EXPECTED_APPEARANCES)} unique appearances; catalog has {len(OUTFITS)} armor entries.')
if '--bind' in sys.argv:
    assert {g['id'] for g in groups}==EXPECTED_APPEARANCES, 'Refuse partial runtime bindings'
    path=ROOT/'content/config/ui/presentation/equipmentAnimations.json'
    doc=json.loads(path.read_text());data=doc['components'];base=data['sets']['reaverGreatsword']
    profile=data.get('motionProfiles',{}).get('greatswordTwoHand') or {k:base[k] for k in ['normalLungeMs','clips','references','poseRoles']}
    data.setdefault('motionProfiles',{})['greatswordTwoHand']=profile
    set_ids={}
    for group in groups:
        outfit=group['id'];set_id='reaverGreatsword' if outfit=='reaver' else outfit+'Greatsword'
        set_ids[outfit]=set_id
        runtime=ROOT/'assets/animations/greatsword-outfits'/outfit
        runtime.mkdir(parents=True,exist_ok=True)
        metadata={}
        for pose in IDS:
            src=PACK/group['directory']/f'{pose}.webp';shutil.copy2(src,runtime/src.name)
            box=Image.open(src).getchannel('A').getbbox()
            metadata[pose]={'file':(runtime/src.name).relative_to(ROOT).as_posix(),'box':dict(zip(['x0','y0','x1','y1'],[round(box[0]*1.25),round(box[1]*1.25),round(box[2]*1.25)-1,round(box[3]*1.25)-1]))}
        data['sets'][set_id]={'motionProfile':'greatswordTwoHand','frames':metadata}
    data['bindings']=[b for b in data['bindings'] if b['setId']!='reaverGreatsword' and b['setId'] not in set_ids.values()]
    for row in OUTFITS:
        visual=appearance(row)
        for right,left in [('greatsword','empty'),('empty','greatsword')]:
            data['bindings'].append({'classId':row['classId'],'armourId':row['id'],'rightGroup':right,'leftGroup':left,'setId':set_ids[key(visual)]})
    path.write_text(json.dumps(doc,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(f'Bound all {len(OUTFITS)} class/armor entries and either occupied hand to the shared greatsword motion profile.')
