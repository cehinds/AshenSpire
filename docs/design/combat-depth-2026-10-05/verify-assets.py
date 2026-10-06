from pathlib import Path
import hashlib,json,re,csv,io
from PIL import Image
root=Path(__file__).resolve().parent
repo=root.parents[2]
catalog=json.loads((root/'catalog.json').read_text())
entries=catalog['entries'];issues=[]
ids=[e['id'] for e in entries]
if len(ids)!=len(set(ids)):issues.append('Duplicate asset IDs')
source=(repo/'src/content/enemyArt.js').read_text()
enemy_ids=json.loads(re.search(r'ENEMY_POSES = Object.freeze\((\[.*?\])\)',source).group(1))
if set(enemy_ids)!=set(e['id'] for e in entries if e['family']=='enemy'):issues.append('Enemy roster coverage mismatch')
csv_text='\n'.join(line for line in (repo/'content/source/outfits.csv').read_text(encoding='utf-8').splitlines() if not line.startswith('#'))
outfits=list(csv.DictReader(io.StringIO(csv_text)))
expected={r['classId']+'-'+r['id'] for r in outfits if r['sharedSet']!='true'}
if expected!=set(e['id'] for e in entries if e['family']=='armor'):issues.append('Armor catalog coverage mismatch')
for e in entries:
    p=root/e['file']
    if e['status']!='generated' or not p.exists():issues.append(f"Missing {e['id']}");continue
    im=Image.open(p)
    if im.mode!='RGBA' or im.getchannel('A').getextrema()[0]!=0:issues.append(f"No transparent alpha: {e['id']}")
    if hashlib.sha256(p.read_bytes()).hexdigest()!=e['validation']['sha256']:issues.append(f"Changed PNG bytes: {e['id']}")
    if im.size!=tuple(e['validation']['size']):issues.append(f"Dimension mismatch: {e['id']}")
    x0,y0,x1,y1=e['validation']['visibleBounds']
    if x0<=0 or y0<=0 or x1>=im.width or y1>=im.height:issues.append(f"Silhouette touches canvas boundary: {e['id']}")
for layer in catalog['layers']:
    p=root/layer['file'];im=Image.open(p)
    if layer['id']!='far' and (im.mode!='RGBA' or im.getchannel('A').getextrema()[0]!=0):issues.append(f"Layer has no alpha: {layer['id']}")
    if hashlib.sha256(p.read_bytes()).hexdigest()!=layer['sha256']:issues.append(f"Layer hash mismatch: {layer['id']}")
report={'sprites':len(entries),'armor':len(expected),'enemies':len(enemy_ids),'layers':len(catalog['layers']),'issues':issues,'checks':['canonical armor and enemy coverage','unique IDs','true alpha','PNG source hashes','dimensions and measured anchors','sprite clearance at all edges','transparent foreground layers']}
(root/'review').mkdir(exist_ok=True)
(root/'review/asset-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
raise SystemExit(bool(issues))
