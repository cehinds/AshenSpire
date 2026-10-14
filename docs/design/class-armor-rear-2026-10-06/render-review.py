"""Render review derivatives only. Master PNG bytes are never edited."""
from pathlib import Path
import json, math, shutil, hashlib
from PIL import Image, ImageDraw, ImageFont
P=Path(__file__).resolve().parent
C=json.loads((P/'catalog.json').read_text()); E=list({e['masterId']:e for e in C['entries']}.values())
R=P/'review';R.mkdir(exist_ok=True)
def load_font(size):
    for path in ('DejaVuSans.ttf','C:/Windows/Fonts/segoeui.ttf'):
        try:return ImageFont.truetype(path,size)
        except OSError:pass
    return ImageFont.load_default()
font=load_font(17)
small=load_font(12)
def cut(e):
    return Image.open(P/e['file']).convert('RGBA').crop(e['validation']['visibleBounds'])
def put(im,e,box):
    pic=cut(e);pic.thumbnail((box[2],box[3]),Image.Resampling.LANCZOS)
    im.alpha_composite(pic,(round(box[0]+(box[2]-pic.width)/2),round(box[1]+box[3]-pic.height)))
def sheet(entries,device,index):
    phone=device=='phone';w=390 if phone else 1536;cols=2 if phone else 4
    cw=w//cols;ch=192 if phone else 480;head=54
    im=Image.new('RGBA',(w,head+math.ceil(len(entries)/cols)*ch),'#171e1d');d=ImageDraw.Draw(im)
    d.text((12,12),f'AshenSpire / {device} / {index}',font=font,fill='#ead4a9')
    for i,e in enumerate(entries):
        x=(i%cols)*cw;y=head+(i//cols)*ch
        if phone:
            d.rectangle((x+5,y,x+cw-5,y+ch-35),fill='#b9c1ba')
        else:
            for yy in range(y,y+ch-52,20):
                for xx in range(x+8,x+cw-8,20):
                    d.rectangle((xx,yy,min(xx+19,x+cw-9),min(yy+19,y+ch-53)),fill='#9ba8a2' if ((xx-x)//20+(yy-y)//20)%2 else '#c4ccc3')
        put(im,e,(x+20,y+10,cw-40,ch-(52 if phone else 72)))
        d.text((x+10,y+ch-33),e['masterId'],font=small if phone else font,fill='#efdeba')
    im.convert('RGB').save(R/f'contact-{device}-{index}.jpg',quality=94)
for device in ['desktop','phone']:
    for start in range(0,len(E),8):sheet(E[start:start+8],device,start//8+1)
new=[e for e in E if e['provenance']['kind']=='new-wearer-specific']
sheet(new,'desktop','new')
BASE=Path('D:/repos/.codex/worktrees/combat-perspective-art/AshenSpire/docs/design/combat-depth-2026-10-05/continuation')
S=P/'references/scene';S.mkdir(exist_ok=True)
if not (S/'catalog.json').exists():shutil.copyfile(BASE/'scene-catalog.json',S/'catalog.json')
SC=json.loads((S/'catalog.json').read_text());scene=SC['scenes'][0];layers={e['id']:e for e in SC['layers']}
used={}
for device in ['desktop','phone']:
    config=scene['devices'][device];stage=Image.new('RGBA',(config['width'],config['height']),'#73756d')
    for t in config['layers']:
        layer=layers[t['id']];dst=S/(t['id']+'.png')
        if not dst.exists():shutil.copyfile(BASE/layer['file'],dst)
        used[t['id']]=dict(sourceFile=layer['file'],file=dst.relative_to(P).as_posix(),sha256=hashlib.sha256(dst.read_bytes()).hexdigest())
        pic=Image.open(dst).convert('RGBA').resize((round(t['width']),round(t['height'])),Image.Resampling.LANCZOS)
        stage.alpha_composite(pic,(round(t['x']),round(t['y'])))
    size=(1280,800) if device=='desktop' else (390,520)
    stage=stage.resize(size,Image.Resampling.LANCZOS)
    stage.convert('RGB').save(R/f'stage-{device}.jpg',quality=94)
    for e in E:
        im=stage.copy()
        # Art-review scale: tall enough for a meaningful reading, without clipping equipment.
        box=(size[0]*.1,size[1]*.30,size[0]*.48,size[1]*.57) if device=='desktop' else (22,174,245,280)
        put(im,e,box)
        ImageDraw.Draw(im).text((14,14),e['masterId'],font=font,fill='#f2dfbb',stroke_width=1,stroke_fill='#181b1a')
        im.convert('RGB').save(R/f'{e["masterId"]}-{device}.jpg',quality=90)
    # Small montage to inspect every composition; individual device-sized files retained.
    tw,th=(320,200) if device=='desktop' else (195,260)
    for start in range(0,len(E),8):
        subset=E[start:start+8]; montage=Image.new('RGB',(tw*4,th*math.ceil(len(subset)/4)),'#17201d')
        for i,e in enumerate(subset):
            pic=Image.open(R/f'{e["masterId"]}-{device}.jpg').resize((tw,th),Image.Resampling.LANCZOS)
            montage.paste(pic,(i%4*tw,i//4*th))
        montage.save(R/f'compositions-{device}-{start//8+1}.jpg',quality=93)
(P/'scene-provenance.json').write_text(json.dumps(dict(sourceCommit=C['baselineCommit'],sceneId=scene['id'],layers=list(used.values()),note='Review background derivatives from approved layers. Not runtime integration.'),indent=2),newline='\r\n')
# Embed catalog so the gallery also works directly from disk.
template=(P/'gallery-template.html').read_text(encoding='utf-8')
(P/'index.html').write_text(template.replace('__CATALOG__',json.dumps(C,indent=2)),encoding='utf-8',newline='\r\n')
print(f'Rendered {len(E)} unique masters, 8 contact sheets, 62 individual device compositions, and 8 composition montages.')
