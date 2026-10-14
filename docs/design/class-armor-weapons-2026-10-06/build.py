"""Mechanical Sprite Workshop packaging: source artwork is preserved byte-for-byte.
Only proportional registration and authored polygon layer masks are used here.
"""
import csv, json, math, shutil, hashlib, zipfile
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parent
def read(p): return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def write(p,v): Path(p).write_text(json.dumps(v,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def bounds(im): return im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox()
def affine(im,scale,angle,source,target=(256,256)):
    r=math.radians(angle); c=math.cos(r); s=math.sin(r); tx,ty=target; x,y=source
    return im.transform((512,512),Image.Transform.AFFINE,(c/scale,s/scale,x-(c*tx+s*ty)/scale,-s/scale,c/scale,y-(-s*tx+c*ty)/scale),Image.Resampling.BICUBIC)
def anchor(id,pt,kind='grip'): return dict(id=id,name=id,x=pt[0],y=pt[1],kind=kind,pinned=id in ['H1','H2'])
def layer(id,asset,role,**kw):
    return dict(id=id,name=id,assetId=asset,role=role,x=0,y=0,rotation=0,scale=1,pivot=[256,256],visible=True,locked=False,opacity=1,parentId=None,anchors=[],masks=[],erase=[],notes='',**kw)
def make_layer(id,asset,role,**kw):
    l=layer(id,asset,role); l.update(kw);return l
def polygon(pt,radius):
    x,y=pt; rx,ry=radius
    return [[x-rx*.75,y-ry],[x+rx*.55,y-ry],[x+rx,y-ry*.35],[x+rx*.65,y+ry*.75],[x,y+ry],[x-rx*.85,y+ry*.5],[x-rx,y-ry*.25]]
def main():
    entries=read(ROOT/'sources/armor-catalog.json')['entries']; bodies=read(ROOT/'hand-anchors.json'); specs=read(ROOT/'weapon-anchors.json')
    with (ROOT/'sources/weapons.csv').open(encoding='utf-8-sig') as f: weapons=list(csv.DictReader(line for line in f if not line.startswith('#')))
    assert len(bodies)==31 and len(weapons)==28, 'Expected the complete 31 appearance / 28 armament source set'
    for bid in bodies:
        assert (ROOT/'sources'/f'{bid}-body.png').is_file(), f'Missing body: {bid}'
    for w in weapons:
        assert w['id'] in specs and (ROOT/'sources'/f"weapon-{w['id']}.png").is_file(), f"Missing armament: {w['id']}"
    ids=['empty']+[w['id'] for w in weapons]; manifest=dict(schema='ashenspire.sprite-project-pack.v1',id='class-armor-weapons-2026-10-06-v1',title='Rear armor · every armament pair',provenance={'sourceRevision':'c448cb31c1459581e22642136a224256d4fd3c25','armorCommit':'f1bad442950d43739a6f1726d63be3555b24838b','scope':'Editable idle equipment study; no game integration or attack animation','handRule':'All 28 authored armaments hand=either; handsRequired defaults to 1. Ownership, stat, and unlock requirements still apply in game.'},projects=[])
    weapon_assets={}; weapon_meta={}
    for w in weapons:
        wid=w['id']; spec=specs[wid]; src=ROOT/'sources'/f'weapon-{wid}.png'
        if not src.exists():continue
        im=Image.open(src).convert('RGBA'); b=bounds(im); length=math.hypot(b[2]-b[0],b[3]-b[1]);scale=spec['length']/length
        grip=[spec['grip'][0]*im.width,spec['grip'][1]*im.height]; ang=spec.get('angle',-45)
        normalized=affine(im,scale,ang,grip); out=ROOT/'assets'/f'weapon-{wid}.png';normalized.save(out)
        weapon_assets[wid]=dict(id=wid,src=f'assets/weapon-{wid}.png',name=w['name'],width=512,height=512)
        weapon_meta[wid]=dict(name=w['name'],kind=w['kind'],sourceSha256=sha(src),normalizedSha256=sha(out),grip=[256,256],registration=spec,visibleBounds=bounds(normalized))
    choices=[i for i in ids if i=='empty' or i in weapon_assets]
    for bid, hands in bodies.items():
        src=ROOT/'sources'/f'{bid}-body.png'
        if not src.exists():continue
        entry=next(e for e in entries if e['masterId']==bid);im=Image.open(src).convert('RGBA');b=bounds(im)
        scale=min(400/(b[3]-b[1]),380/(b[2]-b[0])); origin=[(b[0]+b[2])/2,b[3]];target=[256,464]
        norm=affine(im,scale,0,origin,target);norm.save(ROOT/'assets'/f'{bid}-body.png')
        transform=lambda p:[round((p[0]-origin[0])*scale+target[0],3),round((p[1]-origin[1])*scale+target[1],3)]
        h={k:transform(hands[k]) for k in ['right','left']};r=[hands.get('radius',[34,27])[0]*scale,hands.get('radius',[34,27])[1]*scale]
        assets={'body':dict(id='body',src=f'assets/{bid}-body.png',name=entry['name'],width=512,height=512),**weapon_assets}
        project=dict(schemaVersion=1,id=bid,name=f"{entry['classId'].title()} · {entry['name']}",canvas=dict(width=512,height=512,origin=[256,464]),assets=assets,poses={},animations={},queues={},revisions=[],notes='Layered idle carry study. Polygon foreground layers are the actual painted fingers, not generated anatomy. Weapons retain their normalized proportions. Review before runtime promotion.')
        for right in choices:
            for left in choices:
                pid=f'{right}--{left}';layers=[make_layer('body','body','body',locked=True,anchors=[anchor('H1',h['right']),anchor('H2',h['left'])])]
                for side,wid in [('left',left),('right',right)]:
                    if wid=='empty':continue
                    spec=specs[wid];pt=h[side];rot=spec.get('carryAngle',155) * (1 if side=='right' else -1)
                    layers.append(make_layer(f'{side}-weapon',wid,'weapon',handAnchor='H1' if side=='right' else 'H2',x=pt[0]-256,y=pt[1]-256,rotation=rot,anchors=[anchor('eye',[256,244],'shaft'),anchor('butt',[256,268],'shaft'),anchor('grip',[256,256])],notes=f'{side} hand contact; rigid proportions.'))
                    if spec.get('foreground',True):layers.append(make_layer(f'{side}-fingers','body','foreground',locked=True,masks=[polygon(pt,r)],notes='Original painted finger pixels clipped from body, exact registered overlap.'))
                name=lambda wid: 'Empty' if wid=='empty' else weapon_meta[wid]['name']
                project['poses'][pid]=dict(id=pid,name=f'{name(right)} / {name(left)}',classId=entry['classId'],outfit=entry['outfitId'],weapon=right,weaponType=right,offhandType=left,layers=layers,bones=[],gripMode='independent',reviewed=False,notes='Idle carry, right / left. Independent palm anchors; no two-hand attack claimed.')
        project['animations']['idle']=dict(id='idle',name='Selected idle',frames=[dict(id='idle-0',poseId='straightSword--kiteShield',duration=1000,event='',overrides={})])
        project['queues']['review']=dict(id='review',name='Review',items=[dict(id='review-0',animationId='idle',repeats=1,pause=0)],loop=True)
        write(ROOT/f'{bid}.rig.json',project)
        manifest['projects'].append(dict(id=bid,label=project['name'],classId=entry['classId'],armorId=entry['outfitId'],armorIds=[e['canonicalId'] for e in entries if e['masterId']==bid],weaponType='all',projectPath=f'{bid}.rig.json',poseCount=len(project['poses']),bodySha256=sha(src),handContacts=h))
    manifest['coverage']=dict(appearances=len(manifest['projects']),armorRecords=sum(len(p['armorIds']) for p in manifest['projects']),armaments=len(weapon_assets),posesPerAppearance=len(choices)**2,totalPoses=len(manifest['projects'])*len(choices)**2,unarmedIncluded=True)
    write(ROOT/'manifest.json',manifest);write(ROOT/'weapon-metadata.json',weapon_meta)
    files=[ROOT/'manifest.json']+sorted(ROOT.glob('*.rig.json'))+sorted((ROOT/'assets').glob('*.png'))
    with zipfile.ZipFile(ROOT/'class-armor-weapons.spritepack.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p in files:
            info=zipfile.ZipInfo(p.relative_to(ROOT).as_posix(),date_time=(2026,10,6,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,p.read_bytes())
    print(json.dumps(manifest['coverage']))
if __name__=='__main__':main()
