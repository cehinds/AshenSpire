"""Export authored great-axe skins without creating equipment/runtime bindings."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib, json
from atlas_components import extract_figures

PACK=Path(__file__).resolve().parent
IDS=['STANCE-READY']+[f'ATK-{i:02}' for i in range(1,8)]+['DEFEND','HURT','CAST','STANCE-AGGRESSIVE','STANCE-DEFENSIVE','BUFF','PORTRAIT','CONVERSATION']
OUTFITS=json.loads((PACK/'outfits.json').read_text(encoding='utf-8'))
ATTACK=json.loads((PACK/'attack-sequence.json').read_text(encoding='utf-8'))
FONT=next((ImageFont.truetype(str(p),16) for p in [Path('C:/Windows/Fonts/segoeui.ttf'),Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')] if p.exists()),ImageFont.load_default())
def key(row):
    name=row['id'] if str(row.get('sharedSet','')).lower()=='true' else row.get('artKey') or row['id']
    return row['classId']+('' if name=='default' else '-'+name)
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def save(im,path):
    im.save(path,'WEBP',quality=92,method=4,exact=True)
    decoded=Image.open(path).convert('RGBA')
    assert decoded.size==im.size and decoded.getchannel('A').tobytes()==im.getchannel('A').tobytes(),path
groups=[];prepared={};scale_limits=[]
for row in OUTFITS:
    name=key(row);src=PACK/'sources'/f'{name}.png'
    if name in prepared or not src.exists(): continue
    atlas=Image.open(src).convert('RGBA')
    assert atlas.getchannel('A').getextrema()==(0,255),f'{name}: transparency missing'
    crops,extraction=extract_figures(atlas,count=16)
    # One normalized coordinate space and shared scale across ALL skins/poses.
    unit=1254/atlas.width
    extents=[];heights=[]
    for i,crop in enumerate(crops):
        if IDS[i]=='PORTRAIT': continue
        alpha=crop.getchannel('A').point(lambda a:255 if a>32 else 0)
        core=alpha.getbbox();feet=alpha.crop((0,max(0,core[3]-10),crop.width,core[3])).getbbox()
        rootx=(feet[0]+feet[2])/2 if feet else crop.width/2
        extents.append(max(rootx,crop.width-rootx)*unit);heights.append(crop.height*unit)
    scale_limits.append(min(232/max(extents),432/max(heights)))
    prepared[name]=(crops,extraction,unit)
shared_scale=min(scale_limits)
for row in OUTFITS:
    name=key(row)
    if any(g['id']==name for g in groups): continue
    src=PACK/'sources'/f'{name}.png'
    if name not in prepared: continue
    crops,extraction,unit=prepared[name]
    scale=shared_scale*unit
    dest=PACK/'frames'/name;dest.mkdir(exist_ok=True,parents=True)
    frames={};metadata={}
    for pose,crop in zip(IDS,crops):
        core=crop.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox()
        assert core,pose
        feet=crop.getchannel('A').crop((0,max(0,core[3]-10),crop.width,core[3])).point(lambda a:255 if a>32 else 0).getbbox()
        rootx=(feet[0]+feet[2])/2 if feet else crop.width/2
        factor=min(460/crop.width,460/crop.height) if pose=='PORTRAIT' else scale
        scaled=crop.resize((round(crop.width*factor),round(crop.height*factor)),Image.Resampling.LANCZOS)
        x=round(256-(crop.width/2 if pose=='PORTRAIT' else rootx)*factor)
        y=round(480-core[3]*factor)
        # Fail instead of silently clamping and shifting the foot anchor.
        assert x>=0 and x+scaled.width<=512 and y>=0 and y+scaled.height<=512,(name,pose,x,y,scaled.size)
        frame=Image.new('RGBA',(512,512));frame.alpha_composite(scaled,(x,y))
        save(frame,dest/f'{pose}.webp');frames[pose]=frame
        box=frame.getchannel('A').getbbox()
        assert box and box[0]>0 and box[1]>0 and box[2]<512 and box[3]<512,(name,pose,'edge clipping')
        metadata[pose]={'sha256':digest(dest/f'{pose}.webp'),'bounds':box,'anchor':[256,480],'scale':factor,'sourceBounds':extraction['bounds'][IDS.index(pose)]}
    playback=[frames[p] for p in ATTACK['frames']]
    playback[0].save(dest/'attack-preview.webp','WEBP',save_all=True,append_images=playback[1:],duration=ATTACK['durations'],loop=0,lossless=True,method=3)
    sheet=Image.new('RGB',(1200,1376),'#181a1e');draw=ImageDraw.Draw(sheet)
    for i,pose in enumerate(IDS):
        x=i%4*300;y=i//4*344;thumb=frames[pose].resize((292,292),Image.Resampling.LANCZOS)
        sheet.paste(thumb,(x+4,y+4),thumb);draw.text((x+10,y+300),pose,font=FONT,fill='#e8ce96')
        draw.text((x+10,y+322),name,font=FONT,fill='#aaaab5')
    sheet.save(dest/'labeled-sheet.webp','WEBP',quality=92,method=3)
    groups.append({'id':name,'classId':row['classId'],'armourId':row['id'],'name':row['name'],'directory':f'frames/{name}','sourceSha256':digest(src),'frames':metadata,'extraction':extraction})
    print('Exported '+name,flush=True)
expected=sorted({key(row) for row in OUTFITS});missing=sorted(set(expected)-{g['id'] for g in groups})
data={'status':'authored-preview-only','runtimeBinding':None,'missingMapping':'No distinct great-axe group or two-handed axe package exists in the inspected runtime catalog.','authoredEquipment':{'weaponFamily':'great-axe','weaponCount':1,'grip':'two hands on one haft','rightHand':'nearer axe head','leftHand':'nearer butt'},'poses':IDS,'attack':ATTACK,'groups':groups,'outfits':[{**r,'appearanceId':key(r)} for r in OUTFITS],'expectedAppearances':expected,'missingAppearances':missing,'generator':'built-in image_gen'}
data['sharedNormalizedScale']=shared_scale
overview=Image.new('RGB',(1120,224*((len(groups)+3)//4)),'#181a1e');draw=ImageDraw.Draw(overview)
for i,group in enumerate(groups):
    x=i%4*280;y=i//4*224
    thumb=Image.open(PACK/group['directory']/'STANCE-READY.webp').resize((190,190),Image.Resampling.LANCZOS)
    overview.paste(thumb,(x+45,y),thumb);draw.text((x+8,y+190),group['id'],font=FONT,fill='#e8ce96')
overview.save(PACK/'appearance-overview.webp','WEBP',quality=92,method=3)
(PACK/'manifest.json').write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8',newline='\n')
(PACK/'data.js').write_text('window.GREAT_AXE_ART='+json.dumps(data)+';\n',encoding='utf-8',newline='\n')
print(f'{len(groups)}/{len(expected)} appearances; {len(OUTFITS)} catalog entries; missing: {missing}',flush=True)
