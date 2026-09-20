"""Read-only delivery checks: complete catalog coverage, decoded assets and provenance."""
from pathlib import Path
from PIL import Image
import csv, hashlib, json
PACK=Path(__file__).resolve().parent
ROOT=PACK.parents[1]
data=json.loads((PACK/'manifest.json').read_text(encoding='utf-8'))
catalog=list(csv.DictReader(line for line in (ROOT/'content/source/outfits.csv').read_text(encoding='utf-8-sig').splitlines() if line.strip() and not line.lstrip().startswith('#')))
assert {(r['classId'],r['id']) for r in catalog}=={(r['classId'],r['id']) for r in data['outfits']},'Catalog entries changed'
assert len(data['groups'])==32 and len(data['outfits'])==35 and not data['missingAppearances'],'Incomplete coverage'
assert set(data['expectedAppearances'])=={g['id'] for g in data['groups']}
assert data['runtimeBinding'] is None and data['status']=='authored-preview-only'
assert len(data['poses'])==16 and len(set(data['poses']))==16
assert len(data['attack']['frames'])==len(data['attack']['durations'])
assert all(p in data['poses'] for p in data['attack']['frames'])
assert all(30<=ms<=5000 for ms in data['attack']['durations'])
frames=0;anchors=[]
for group in data['groups']:
    src=PACK/'sources'/f"{group['id']}.png"
    assert src.stat().st_size>0 and hashlib.sha256(src.read_bytes()).hexdigest()==group['sourceSha256']
    with Image.open(src) as image:image.verify()
    with Image.open(src) as image:
        assert image.mode=='RGBA' and image.getchannel('A').getextrema()==(0,255)
        assert not any(image.getchannel('A').crop(box).point(lambda x:255 if x>192 else 0).getbbox() for box in [(0,0,image.width,1),(0,image.height-1,image.width,image.height),(0,0,1,image.height),(image.width-1,0,image.width,image.height)]),f"{group['id']}: source clipped at outer edge"
    for pose in data['poses']:
        path=PACK/group['directory']/f'{pose}.webp';meta=group['frames'][pose]
        assert hashlib.sha256(path.read_bytes()).hexdigest()==meta['sha256']
        with Image.open(path) as image:
            assert image.size==(512,512) and image.mode=='RGBA'
            alpha=image.getchannel('A');assert alpha.getextrema()==(0,255)
            box=alpha.getbbox();assert box[0]>0 and box[1]>0 and box[2]<512 and box[3]<512
            assert meta['anchor']==[256,480]
            if pose!='PORTRAIT':
                core=alpha.point(lambda a:255 if a>32 else 0).getbbox()
                assert abs(core[3]-480)<=2,(group['id'],pose,core)
                anchors.append(core[3])
        frames+=1
    for file in ['labeled-sheet.webp','attack-preview.webp']:
        with Image.open(PACK/group['directory']/file) as image:image.verify()
    with Image.open(PACK/group['directory']/'attack-preview.webp') as image:assert image.n_frames==len(data['attack']['frames'])
report={'appearances':len(data['groups']),'catalogEntries':len(data['outfits']),'frames':frames,'posesPerAppearance':16,'missing':data['missingAppearances'],'bodyFootBottomRange':[min(anchors),max(anchors)],'runtimeBinding':None,'checks':['catalog coverage','source integrity and alpha','source outer-edge clearance','frame hashes','512x512 RGBA','transparent frame margins','body foot baseline','animated preview frame counts']}
print(json.dumps(report,indent=2))
