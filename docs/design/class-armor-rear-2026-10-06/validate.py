"""Read-only acceptance checks for the delivered art package."""
from pathlib import Path
import csv,json,hashlib,subprocess
from PIL import Image
P=Path(__file__).resolve().parent;repo=P.parents[2]
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
C=read(P/'catalog.json');M=read(P/'matrix.json');receipts={e['id']:e for e in read(P/'receipts.json')}
old={e['id']:e for e in read(P/'sources/baseline-catalog.json')['entries']}
errors=[];warnings=[];checks=[]
def check(value,label):
    checks.append(dict(check=label,passed=bool(value)))
    if not value:errors.append(label)
rows=list(csv.DictReader(x for x in (P/'sources/outfits.csv').read_text().splitlines() if not x.startswith('#')))
expected={'armor/'+r['classId']+'/'+r['id'] for r in rows}
check({e['canonicalId'] for e in C['entries']}==expected,'Every canonical armor record represented exactly')
check(len(C['entries'])==len(expected)==35,'35 unique canonical records')
check(len(M)==76 and sum(m['supported'] for m in M)==31,'76 matrix cells; 31 supported appearances')
check(len({(m['classId'],m['armorName']) for m in M})==76,'Matrix cells unique')
check(all(bool(m['canonicalIds'])==m['supported'] for m in M),'Unsupported cells never claim artwork coverage')
for s in C['sources']:
    check(sha(P/s['snapshot'])==s['sha256'],s['path']+' snapshot hash')
    check(sha(repo/s['path'])==s['sha256'],s['path']+' current worktree matches inventory')
for e in C['entries']:
    path=P/e['file'];check(path.exists(),e['id']+' file exists')
    if not path.exists():continue
    im=Image.open(path);v=e['validation'];a=im.getchannel('A');bbox=a.point(lambda x:255 if x>32 else 0).getbbox()
    check(im.mode=='RGBA' and a.getextrema()[0]==0 and a.getextrema()[1]>=250,e['id']+' real alpha')
    check(sha(path)==v['sha256'],e['id']+' catalog SHA256')
    check(list(bbox)==v['visibleBounds'],e['id']+' measured visible bounds')
    check(min(v['clearMargins'])>0,e['id']+' no alpha>32 clipping at canvas edge')
    check(v['idleAnchor']==[(bbox[0]+bbox[2])/2,bbox[3]],e['id']+' measured idle anchor')
    if e['provenance']['kind']=='new-wearer-specific':
        check(sha(path)==receipts[e['id']]['generatedSha256'],e['id']+' unchanged generator bytes')
        check(min(v['clearMargins'])>=64,e['id']+' at least 64 px clearance every side')
    else:
        original=old[e['provenance']['originalId']]
        check(sha(path)==original['validation']['sha256'],e['id']+' unchanged approved master')
        if min(v['clearMargins'])<32:warnings.append(e['id']+': approved source has a tight margin; retained exactly, preview provides external clearance.')
unique={e['masterId']:e for e in C['entries']}
check(len(unique)==31,'31 unique appearance masters')
check(len({e['validation']['sha256'] for e in unique.values()})==31,'No cross-wearer duplicate PNG aliases')
for id,e in unique.items():
    for device,size in [('desktop',(1280,800)),('phone',(390,520))]:
        p=P/'review'/f'{id}-{device}.jpg'
        check(p.exists() and Image.open(p).size==size,f'{id} {device} composition')
for r in receipts.values():
    for ref in r['localReferences']:check(sha(P/ref['file'])==ref['sha256'],r['id']+' reference hash '+ref['file'])
for layer in read(P/'scene-provenance.json')['layers']:
    check(sha(P/layer['file'])==layer['sha256'],'Review scene layer '+layer['file'])
changed=subprocess.check_output(['git','status','--porcelain','--untracked-files=all'],cwd=repo,text=True).splitlines()
check(all(line[3:].startswith('docs/design/class-armor-rear-2026-10-06/') for line in changed),'Changes confined to art-only continuation package')
committed=subprocess.check_output(['git','diff','--name-only',C['sourceRevision'],'HEAD'],cwd=repo,text=True).splitlines()
check(all(line.startswith('docs/design/class-armor-rear-2026-10-06/') for line in committed),'Committed scope confined to art package')
result=dict(passed=not errors,sourceRevision=C['sourceRevision'],counts=C['counts'],checkCount=len(checks),errors=errors,warnings=warnings,checks=checks,
 limits=['Visual review recorded separately; hashes do not prove visual quality.','No game runtime, CI, animation, or physical-device acceptance claimed.'])
(P/'validation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['passed','counts','checkCount','errors','warnings']},indent=2))
raise SystemExit(0 if not errors else 1)
