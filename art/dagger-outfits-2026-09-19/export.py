"""Normalize all single-dagger skins; bind only complete catalog coverage."""
from pathlib import Path
import hashlib, json, shutil, sys
from PIL import Image, ImageDraw, ImageFont
PACK = Path(__file__).resolve().parent
ROOT = PACK.parents[1]
sys.path.insert(0, str(PACK.parent / 'sword-shield-outfits-2026-09-19'))
from atlas_components import extract_figures
IDS = ['STANCE-READY'] + [f'ATK-{i:02}' for i in range(1,8)] + ['DEFEND','HURT','CAST','STANCE-AGGRESSIVE','STANCE-DEFENSIVE','BUFF','PORTRAIT','CONVERSATION']
OUTFITS = json.loads((PACK/'outfits.json').read_text())
ATTACK = json.loads((PACK/'attack-sequence.json').read_text())
FONT = next((ImageFont.truetype(path,18) for path in [
    'C:/Windows/Fonts/segoeui.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
] if Path(path).exists()),None) or ImageFont.load_default()
def key(row):
    return row['classId'] + ('' if row['id']=='default' else '-'+row['id'])
def appearance(row):
    return {**row, 'id':row['id'] if str(row.get('sharedSet','')).lower()=='true' else row['artKey'] or row['id']}
EXPECTED = {key(appearance(row)) for row in OUTFITS}
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def write_json(path,data):
    path.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8',newline='\n')
def geometry(crop):
    opaque=crop.getchannel('A').point(lambda a:255 if a>32 else 0)
    box=opaque.getbbox()
    feet=opaque.crop((0,max(0,box[3]-12),crop.width,box[3])).getbbox()
    return box,(feet[0]+feet[2])/2
def webp(frame,path):
    frame.save(path,'WEBP',quality=92,method=4,exact=True)
    decoded=Image.open(path).convert('RGBA')
    assert decoded.size==frame.size and decoded.getchannel('A').tobytes()==frame.getchannel('A').tobytes(),path
prepared=[]
for row in OUTFITS:
    if key(row)!=key(appearance(row)):continue
    ident=key(row)
    source=PACK/'sources'/('rogue-default.png' if ident=='rogue' else ident+'.png')
    if not source.exists():continue
    stamp=digest(source);cache=PACK/'.cache'/ident;cached=cache/'extraction.json'
    if cached.exists() and json.loads(cached.read_text())['sourceSha256']==stamp:
        record=json.loads(cached.read_text())
        crops=[Image.open(cache/f'{pose}.png').convert('RGBA') for pose in IDS]
    else:
        atlas=Image.open(source).convert('RGBA')
        assert atlas.getchannel('A').getextrema()==(0,255),ident+': source alpha required'
        crops,extraction=extract_figures(atlas,count=16)
        record={'sourceSha256':stamp,'sourceSize':list(atlas.size),'extraction':extraction}
        cache.mkdir(parents=True,exist_ok=True)
        for pose,crop in zip(IDS,crops):crop.save(cache/f'{pose}.png')
        write_json(cached,record)
    prepared.append((row,source,crops,record))
    print('Extracted '+ident,flush=True)
assert prepared,'No source atlases'
# Shared scale in normalized 2048px source space. The anchor envelope protects long stabs.
scale=1.0
for row,source,crops,record in prepared:
    unit=2048/record['sourceSize'][0]
    for pose,crop in zip(IDS,crops):
        if pose=='PORTRAIT':continue
        box,rootx=geometry(crop)
        scale=min(scale,432/(crop.height*unit),244/(max(rootx,crop.width-rootx)*unit),464/(box[3]*unit))
groups=[]
for row,source,crops,record in prepared:
    ident=key(row);dest=PACK/'frames'/ident;dest.mkdir(parents=True,exist_ok=True)
    frames={};metadata={};unit=2048/record['sourceSize'][0]
    for pose,crop in zip(IDS,crops):
        box,rootx=geometry(crop);factor=scale*unit
        if pose=='PORTRAIT':factor=min(460/crop.width,460/crop.height);rootx=crop.width/2
        scaled=crop.resize((round(crop.width*factor),round(crop.height*factor)),Image.Resampling.LANCZOS)
        x,y=round(256-rootx*factor),480-round(box[3]*factor)
        assert x>=0 and y>=0 and x+scaled.width<=512 and y+scaled.height<=512,(ident,pose,'clipping')
        frame=Image.new('RGBA',(512,512));frame.alpha_composite(scaled,(x,y))
        path=dest/f'{pose}.webp';webp(frame,path);frames[pose]=frame
        metadata[pose]={'file':path.relative_to(PACK).as_posix(),'box':list(frame.getchannel('A').getbbox()),'scale':factor,'anchor':[x+rootx*factor,y+box[3]*factor],'sha256':digest(path)}
    sheet=Image.new('RGB',(1200,1380),'#181c20');draw=ImageDraw.Draw(sheet)
    draw.text((18,10),ident.upper()+' / SINGLE RIGHT DAGGER + LEFT EMPTY',font=FONT,fill='#e5cf9c')
    for i,pose in enumerate(IDS):
        x,y=(i%4)*300,44+(i//4)*334;thumb=frames[pose].resize((292,292),Image.Resampling.LANCZOS)
        sheet.paste(thumb,(x+4,y),thumb);draw.text((x+12,y+296),pose,font=FONT,fill='#e5cf9c')
    sheet.save(dest/'labeled-sheet.webp',quality=90,method=4)
    playback=[frames[pose] for pose in ATTACK['frames']]
    playback[0].save(dest/'attack-preview.webp',save_all=True,append_images=playback[1:],duration=ATTACK['frameMs'],loop=0,quality=90,method=4)
    groups.append({'id':ident,'classId':row['classId'],'armourId':row['id'],'name':row['name'],'directory':dest.relative_to(PACK).as_posix(),'frames':metadata,'source':source.relative_to(PACK).as_posix(),**record})
    print('Exported '+ident,flush=True)
missing=sorted(EXPECTED-{g['id'] for g in groups})
manifest={'motionProfile':'daggerSingle','generator':'built-in image_gen','authoredEquipment':{'rightGroup':'dagger','leftGroup':'empty'},'grip':'one','effectsBakedIn':False,'poses':IDS,'attack':ATTACK,'bodyScaleIn2048SourceSpace':scale,'bodyAnchor':[256,480],'groups':groups,'outfits':OUTFITS,'missingAppearances':missing}
write_json(PACK/'manifest.json',manifest)
(PACK/'data.js').write_text('window.DAGGER_ART = '+json.dumps(manifest)+';\n',encoding='utf-8',newline='\n')
max_error=max(max(abs(m['anchor'][0]-256),abs(m['anchor'][1]-480)) for g in groups for m in g['frames'].values())
report={'catalogEntries':len(OUTFITS),'expectedAppearances':len(EXPECTED),'exportedAppearances':len(groups),'frames':len(groups)*len(IDS),'frameDimensions':[512,512],'missingAppearances':missing,'sourceTransparency':True,'exportedAlphaExact':True,'noFrameClipping':True,'sharedBodyScale':True,'maxAnchorErrorPx':max_error}
write_json(PACK/'validation.json',report)
print(json.dumps(report,indent=2),flush=True)
if '--bind' in sys.argv:
    assert not missing,'Refuse partial runtime bindings'
    config=ROOT/'content/config/ui/presentation/equipmentAnimations.json'
    doc=json.loads(config.read_text());data=doc['components']
    # Only this family's profile, sets and bindings are added or replaced.
    profile=json.loads(json.dumps(data['motionProfiles']['greatswordTwoHand']))
    profile['clips'].pop('greatswordAttack')
    profile['clips']['daggerAttack']=ATTACK
    profile['clips']['conversation']={'frames':['CONVERSATION'],'frameMs':260,'impactIndex':0}
    profile['references']['attack']='daggerAttack';profile['references']['conversation']='conversation'
    data.setdefault('motionProfiles',{})['daggerSingle']=profile
    setids={}
    for group in groups:
        ident=group['id'];setid=ident+'DaggerSingle';setids[ident]=setid
        runtime=ROOT/'assets/animations/dagger-outfits'/ident;runtime.mkdir(parents=True,exist_ok=True)
        meta={}
        for pose,info in group['frames'].items():
            src=PACK/info['file'];target=runtime/src.name;shutil.copy2(src,target)
            box=info['box'];meta[pose]={'file':target.relative_to(ROOT).as_posix(),'box':dict(zip(['x0','y0','x1','y1'],[round(box[0]*1.25),round(box[1]*1.25),round(box[2]*1.25)-1,round(box[3]*1.25)-1]))}
        data['sets'][setid]={'motionProfile':'daggerSingle','authoredEquipment':manifest['authoredEquipment'],'frames':meta}
    data['bindings']=[b for b in data['bindings'] if b['setId'] not in setids.values()]
    for row in OUTFITS:
        data['bindings'].append({'classId':row['classId'],'armourId':row['id'],'rightGroup':'dagger','leftGroup':'empty','grip':'one','setId':setids[key(appearance(row))]})
    write_json(config,doc)
    print('Bound 35 ordered single-dagger selectors.',flush=True)
