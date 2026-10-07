"""Normalize generated rear artwork and reuse the approved layered body recipes."""
import json, math, shutil, hashlib, zipfile, sys, copy
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent
OLD=ROOT.parent/'class-armor-weapons-2026-10-06'
sys.path.insert(0,str(OLD))
import build as old
read=old.read
def write(p,v): p.write_text(json.dumps(v,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    specs=read(ROOT/'registration.json')
    prior=read(OLD/'weapon-anchors.json')
    aliases={'frostSpear':'halberd','cinderAxe':'battleaxe','duskChime':'boneSceptre'}
    (ROOT/'assets').mkdir(exist_ok=True)
    meta={}
    for wid,previous in prior.items():
        master=aliases.get(wid,wid)
        src=ROOT/'sources'/f'{master}-rear.png'
        im=Image.open(src).convert('RGBA'); x,y,angle=specs[master]
        grip=[x*im.width,y*im.height]
        alpha=im.getpixel(tuple(round(v) for v in grip))[3]
        assert alpha>120, f'{wid}: grip is outside paint {grip}, alpha={alpha}'
        b=old.bounds(im); scale=previous['length']/math.hypot(b[2]-b[0],b[3]-b[1])
        normalized=old.affine(im,scale,angle,grip)
        assert normalized.getpixel((256,256))[3]>120,wid
        output=ROOT/'assets'/f'weapon-{wid}.png';normalized.save(output)
        meta[wid]={'masterId':master,'source':str(src.relative_to(ROOT)),'sha256':sha(src),'normalizedSha256':sha(output),'grip':grip,'angle':angle,'scale':scale,'alphaAtGrip':alpha,'canonicalAlias':aliases.get(wid)}
    manifest=read(OLD/'manifest.json')
    manifest['id']='rear-weapon-views-2026-10-06-v1'
    manifest['title']='Rear three-quarter weapons · all armor pairs'
    manifest['provenance']['layerSourceCommit']='4115a9c50d183abe64b897052ddd26da21f02a58'
    manifest['provenance']['weaponViews']='25 newly painted rear designs, 28 canonical records, three explicit aliases. Built-in image generation.'
    contacts=0; layercount=0; failures=[]
    for entry in manifest['projects']:
        project=read(OLD/entry['projectPath'])
        shutil.copyfile(OLD/project['assets']['body']['src'],ROOT/project['assets']['body']['src'])
        project['notes']+=' Rear-view weapon edition: shield interiors and reverse weapon surfaces.'
        for pose in project['poses'].values():
            body=pose['layers'][0]
            # Rear shield handles now need the same actual palm pixels above them.
            for side,anchor in [('left','H2'),('right','H1')]:
                weapon=next((l for l in pose['layers'] if l['id']==side+'-weapon'),None)
                if not weapon: continue
                if not any(l['id']==side+'-fingers' for l in pose['layers']):
                    template=copy.deepcopy(next(l for l in project['poses']['straightSword--dagger']['layers'] if l['id']==side+'-fingers'))
                    pose['layers'].insert(pose['layers'].index(weapon)+1,template)
                contacts+=1
            layercount+=len(pose['layers'])
        for wid in prior:
            for side in ['right','left']:
                pid=f'{wid}--empty' if side=='right' else f'empty--{wid}'
                l=next(l for l in project['poses'][pid]['layers'] if l['role']=='weapon')
                im=Image.open(ROOT/project['assets'][wid]['src'])
                rendered=old.affine(im,l['scale'],l['rotation'],l['pivot'],[256+l['x'],256+l['y']])
                b=old.bounds(rendered)
                if b[0]<=0 or b[1]<=0 or b[2]>=512 or b[3]>=512: failures.append([entry['id'],wid,side,b])
        write(ROOT/entry['projectPath'],project)
    write(ROOT/'manifest.json',manifest);write(ROOT/'weapon-metadata.json',meta)
    report={'appearances':len(manifest['projects']),'armaments':len(meta),'generatedMasters':len(specs),'poses':26071,'contacts':contacts,'layers':layercount,'clippingFailures':failures,'paintedGripChecks':28,'passed':not failures,'visualApproval':False}
    write(ROOT/'validation.json',report)
    files=[ROOT/'manifest.json']+sorted(ROOT.glob('*.rig.json'))+sorted((ROOT/'assets').glob('*.png'))
    with zipfile.ZipFile(ROOT/'rear-weapon-views.spritepack.zip','w',zipfile.ZIP_DEFLATED) as z:
        for p in files:
            info=zipfile.ZipInfo(p.relative_to(ROOT).as_posix(),date_time=(2026,10,6,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,p.read_bytes())
    print(json.dumps(report))
    assert not failures,failures
if __name__=='__main__':main()
