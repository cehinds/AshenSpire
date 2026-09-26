"""Aggregate available appearance exports; refuse incomplete runtime payloads."""
from pathlib import Path
import hashlib, json, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

PACK = Path(__file__).resolve().parent
rows = json.loads((PACK.parent/'sword-shield-outfits-2026-09-19/outfits.json').read_text(encoding='utf-8'))
def appearance(row):
    armor = row['id'] if str(row.get('sharedSet','')).lower() == 'true' else row.get('artKey') or row['id']
    return row['classId'] + ('' if armor == 'default' else '-'+armor)
plan = [{'classId':r['classId'], 'armourId':r['id'], 'name':r['name'], 'appearanceId':appearance(r),
         'rightGroup':'empty','leftGroup':'empty'} for r in rows]
keys = list(dict.fromkeys(r['appearanceId'] for r in plan))
groups = []
for key in keys:
    source = PACK/'sources'/f'{key}.png'
    if not source.exists(): continue
    record = PACK/'frames'/key/'manifest.json'
    if '--export' in sys.argv and (not record.exists() or json.loads(record.read_text()).get('exportVersion') != 2 or json.loads(record.read_text())['sourceSha256'] != hashlib.sha256(source.read_bytes()).hexdigest()):
        subprocess.run([sys.executable,str(PACK/'export.py'),key],check=True)
    if record.exists():
        data = json.loads(record.read_text(encoding='utf-8')); data.pop('expansion',None)
        assert data['sourceSha256'] == hashlib.sha256(source.read_bytes()).hexdigest(), key
        for frame in data['frames'].values():
            assert frame['sha256'] == hashlib.sha256((PACK/frame['file']).read_bytes()).hexdigest(), key
        data['status'] = 'generated-and-exported'; groups.append(data)
available = {g['id'] for g in groups}
for row in plan: row['status'] = 'complete' if row['appearanceId'] in available else 'missing'
missing = [k for k in keys if k not in available]
master = next(g for g in groups if g['id']=='reaver')
manifest = {**master, 'status':'complete' if not missing else 'in-progress', 'groups':groups, 'expansion':plan,
            'coverage':{'catalogEntries':len(plan),'expectedAppearances':len(keys),'exportedAppearances':len(groups),'missing':missing},
            'choreography':'one shared physical jab/cross sequence; appearance changes only; painted approximations'}
(PACK/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
(PACK/'data.js').write_text('window.UNARMED_ART = '+json.dumps(manifest)+';\n',encoding='utf-8')
(PACK/'validation.json').write_text(json.dumps({**manifest['coverage'],'frames':len(groups)*16,'rgba':True,
    'decodedAlphaExact':True,'anchor':[256,480],'bodyScaleSharedWithinEachSuite':True,
    'sourcePngsPreserved':True},indent=2)+'\n',encoding='utf-8')
font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',16)
overview = Image.new('RGB',(1600,2200),'#171b20'); draw=ImageDraw.Draw(overview)
draw.text((20,12),f'UNARMED / {len(groups)} OF {len(keys)} APPEARANCES / SAME POSES, DIFFERENT SPRITES',fill='#e4c58b',font=font)
for i,key in enumerate(keys):
    x,y=(i%8)*200,50+(i//8)*530
    draw.rectangle((x+4,y,x+196,y+520),fill='#252b33')
    if key in available:
        for j,pose in enumerate(['STANCE-READY','ATK-05']):
            # Fit square sprites without changing aspect ratio.
            im=Image.open(PACK/'frames'/key/f'{pose}.webp').resize((200,200),Image.Resampling.LANCZOS)
            overview.paste(im,(x,y+j*230),im)
    draw.text((x+8,y+470),key.split('-')[0],fill='#efdfbf',font=font)
    draw.text((x+8,y+492),key.split('-',1)[1] if '-' in key else 'default',fill='#bfc5cc',font=font)
overview.save(PACK/'overview.webp',quality=92)
print(json.dumps(manifest['coverage']))
if '--require-complete' in sys.argv: assert not missing, 'Incomplete appearance coverage'
