"""Build the art-only matrix and metadata; never modifies runtime files or PNG bytes."""
from pathlib import Path
import csv, json, hashlib, shutil, subprocess
from PIL import Image
P=Path(__file__).resolve().parent
REPO=P.parents[2]
BASE=Path('D:/repos/.codex/worktrees/combat-perspective-art/AshenSpire/docs/design/combat-depth-2026-10-05')
REV='c448cb31c1459581e22642136a224256d4fd3c25'
BASE_REV='41ae95ae42cce66e56805cc35ae1903a92a4d5a5'
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,x): p.write_text(json.dumps(x,indent=2)+'\n',encoding='utf-8',newline='\r\n')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def measure(p):
    im=Image.open(p); a=im.getchannel('A')
    b=a.point(lambda x:255 if x>32 else 0).getbbox()
    hist=a.histogram();w,h=im.size
    return dict(size=[w,h],mode=im.mode,sha256=sha(p),alphaRange=list(a.getextrema()),
        transparentFraction=hist[0]/(w*h),visibleBounds=list(b),
        clearMargins=[b[0],b[1],w-b[2],h-b[3]],
        idleAnchor=[(b[0]+b[2])/2,b[3]],anchorKind='bottom-center of alpha >32; idle placement only')
for folder in ['masters','sources','review','references']: (P/folder).mkdir(exist_ok=True)
source_paths=['content/source/outfits.csv','content/source/equipmentRequirements.csv',
 'content/source/equipSlots.csv','content/source/weapons.csv','content/source/itemUpgradeChanges.csv',
 'src/content/classes.js','src/content/equipment.js','src/content/generated/outfits.js',
 'src/content/sharedOutfitArt.js','src/model/paintedOutfitArt.js','src/model/loadout.js',
 'tests/shared-armor.test.mjs','docs/LORE.md']
sources=[]
for path in source_paths:
    target_name=Path(path).name.replace('.test.mjs','.test.snapshot.mjs')
    target=P/'sources'/target_name
    if not target.exists(): shutil.copyfile(REPO/path,target)
    sources.append(dict(path=path,snapshot=target.relative_to(P).as_posix(),sha256=sha(target)))
rows=list(csv.DictReader(x for x in (P/'sources/outfits.csv').read_text().splitlines() if not x.startswith('#')))
if not (P/'sources/baseline-catalog.json').exists(): shutil.copyfile(BASE/'catalog.json',P/'sources/baseline-catalog.json')
old={e['id']:e for e in read(P/'sources/baseline-catalog.json')['entries'] if e['family']=='armor'}
receipts=read(P/'receipts.json')
new={e['id']:e for e in receipts}
classes=['reaver','starseer','herald','rogue']
entries=[]
for row in rows:
    identity=row['classId']+'-'+row['id']
    original=old.get(identity)
    same_default=row['sharedSet']=='true' and row['artClassId']==row['classId']
    if same_default:
        original=old[row['classId']+'-default']
    if original:
        master_id=original['id']; filename='masters/'+master_id+'.png'
        if not (P/filename).exists(): shutil.copyfile(BASE/original['file'],P/filename)
        provenance=dict(kind='approved-byte-reuse',sourceCommit=BASE_REV,sourceFile=original['file'],
            originalMetadata='sources/baseline-catalog.json',originalId=original['id'],
            reason='Same wearer, exact same named default armor and palette; shared gameplay bonuses do not alter appearance.' if same_default else 'Approved exact class/outfit appearance.')
    else:
        master_id=identity; filename='masters/'+identity+'.png'
        if identity in new:
            src=Path(new[identity]['generatedSource'])
            if src.exists() and (not (P/filename).exists() or sha(P/filename)!=sha(src)): shutil.copyfile(src,P/filename)
        provenance=dict(kind='new-wearer-specific',receiptId=identity,reason='Legacy other-class art alias is not appearance coverage.')
    available=(P/filename).exists()
    entries.append(dict(id=identity,classId=row['classId'],outfitId=row['id'],name=row['name'],
        canonicalId='armor/'+row['classId']+'/'+row['id'],masterId=master_id,file=filename,
        status='available' if available else 'missing',facing='rear three-quarter right; away toward upper right',
        pose='idle',provenance=provenance,requirements={r['attributeId']:int(r['minimum']) for r in csv.DictReader(
            x for x in (P/'sources/equipmentRequirements.csv').read_text().splitlines() if not x.startswith('#'))
            if r['itemId']==row['id']},unlock=row['unlock'],legacyArtAlias=dict(classId=row['artClassId'],outfitId=row['artKey']),
        validation=measure(P/filename) if available else None))
names=list(dict.fromkeys(r['name'] for r in rows))
matrix=[]
for name in names:
    for cls in classes:
        matches=[e for e in entries if e['name']==name and e['classId']==cls]
        matrix.append(dict(armorName=name,classId=cls,supported=bool(matches),
            canonicalIds=[e['canonicalId'] for e in matches],appearanceId=matches[0]['masterId'] if matches else None,
            reason='Defined in canonical outfits; unlock/stat requirements are conditional eligibility, not missing artwork.' if matches
              else 'No (wearer class, armor) record. armourForClass and equippedIn resolve class-scoped armor; not a current wearable appearance.'))
catalog=dict(schemaVersion=1,scope='Art-only idle illustrations; no runtime integration',sourceRevision=REV,
    baselineCommit=BASE_REV,classes=classes,entries=entries,sources=sources,
    counts=dict(canonicalRecords=len(rows),namedArmors=len(names),matrixCells=len(matrix),
    supportedAppearances=sum(m['supported'] for m in matrix),unsupportedCombinations=sum(not m['supported'] for m in matrix),
    uniqueMasters=len(set(e['file'] for e in entries)),missing=sum(e['status']=='missing' for e in entries)))
write(P/'catalog.json',catalog);write(P/'matrix.json',matrix)
with (P/'matrix.csv').open('w',newline='',encoding='utf-8') as f:
    w=csv.writer(f);w.writerow(['armorName','classId','supported','canonicalIds','appearanceId','reason'])
    for m in matrix:w.writerow([m['armorName'],m['classId'],m['supported'],' | '.join(m['canonicalIds']),m['appearanceId'],m['reason']])
for receipt in receipts:
    local_refs=[]
    archived_refs=receipt.get('localReferences',[])
    for i,path in enumerate(receipt['referenceImages']):
        src=Path(path)
        archived=P/archived_refs[i]['file'] if i<len(archived_refs) else None
        dst=archived if archived and archived.exists() else P/'references'/Path(str(path).replace('\\','/')).name
        if not dst.exists():shutil.copyfile(src,dst)
        local_refs.append(dict(file=dst.relative_to(P).as_posix(),sha256=sha(dst),role='wearer identity and equipment' if i==0 else 'armor reference'))
    receipt['localReferences']=local_refs
    receipt['generatedSha256']=sha(Path(receipt['generatedSource'])) if Path(receipt['generatedSource']).exists() else receipt['generatedSha256']
write(P/'receipts.json',receipts)
write(P/'inventory.json',dict(sourceRevision=REV,baselineCommit=BASE_REV,sources=sources,counts=catalog['counts'],
  conclusions=['Four playable classes; LOCKED_CLASSES is empty.',
   'ARMOUR is exactly the 35 generated outfit rows; ARMAMENTS contains no armor.',
   'Nineteen armor names; four starting/shared pairs describe the same same-class appearance, but separate canonical records.',
   'Twelve cross-class shared appearances require new masters; the nineteen approved exact appearances are reused.',
   'Bastion, Rimeweave and Waywatcher each retain their own approved master despite legacy artKey aliases.',
   'Shared sets require attribute 3; unlocks constrain availability, not the supported matrix.',
   'Head/hands/feet/talisman slots explicitly have no authored pieces.',
   'Item upgrades change statistics on existing armor IDs; they define no new visual armor records.',
   'Weapons follow approved idle body illustrations; this is not every arbitrary hand loadout or an animation request.']))
print(json.dumps(catalog['counts']))
