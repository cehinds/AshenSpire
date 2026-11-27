"""Diagnostic BEFORE-only composites of immutable pinned rasters, not new art.

Run collect-visual-inputs.mjs first, then this script with --cache pointing to
the pinned v30 directory. Static placement mirrors the baseline renderer's
body registration only; no aura, recoil, travel, timing, HUD or viewport fit.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
args = argparse.ArgumentParser()
args.add_argument('--cache', type=Path, required=True)
opts = args.parse_args()
data = json.loads((HERE / 'visual-inputs.json').read_text())
records = {}
font_path = Path('C:/Windows/Fonts/consola.ttf')
FONT = ImageFont.truetype(str(font_path), 13) if font_path.exists() else ImageFont.load_default()
TITLE = ImageFont.truetype(str(font_path), 19) if font_path.exists() else FONT
INK = (232, 235, 240, 255)
MUTED = (169, 183, 199, 255)

def image_for(path):
    candidates = [opts.cache / tier / path for tier in ('common', 'high')]
    found = next((p for p in candidates if p.exists()), None)
    if not found:
        raise FileNotFoundError(path)
    image = Image.open(found).convert('RGBA')
    alpha = image.getchannel('A').point(lambda x: 255 if x >= 128 else 0)
    records[path] = {'resolvedPack': found.relative_to(opts.cache).as_posix(),
                     'rasterSize': list(image.size), 'alpha128Bounds': alpha.getbbox(),
                     'sha256': hashlib.sha256(found.read_bytes()).hexdigest()}
    return image

def placement(cls, name, mode='current'):
    c = data['classes'][cls]
    if name == 'HURT':
        h = c['hurt']
        return h['file'], (128 + h['dx'], 16 + h['dy'], 512*h['scale'], 512*h['scale']), None, None
    frame = c['poses'][name]
    logical = frame.get('size', [512, 512]) if frame.get('drawOffset') is not None else [512, 512]
    offset = frame.get('drawOffset', [128, 0])
    left, top, width, height = offset[0], 16 + offset[1], logical[0], logical[1]
    body = data['landmarks'].get(frame['path'])
    ready = data['landmarks'].get(c['poses']['ready']['path'])
    factor = 1.0
    if body and ready and mode == 'current':
        ready_h = c['poses']['ready'].get('size', [512, 512])[1]
        target = (ready['feetY'] - ready['headY']) * ready_h / ready['height']
        feet = top + body['feetY'] * height / body['height']
        source_h = (body['feetY'] - body['headY']) * height / body['height']
        factor = target / source_h
        # All pictured stance/ready cards are held: bodyPlacement targets floor480.
        # Pictured action frames are unmeasured; future measured action frames
        # must use bodyResize and retain their authored feet rather than this.
        target_feet = 480 if name in ['ready', 'offensive', 'defensive', 'casting', 'counter', 'sweep', 'smash', 'evade', 'defend'] else feet
        left = 384 + (left - 384) * factor
        top = target_feet + (top - feet) * factor
        width *= factor
        height *= factor
    return frame['path'], (left, top, width, height), body, factor

def write_sheet(filename, title, subtitle, cells, columns=3, s=.68, pw=560):
    ph = 475
    rows = (len(cells) + columns - 1)//columns
    out = Image.new('RGBA', (pw*columns, 91+ph*rows), (24, 30, 39, 255))
    draw = ImageDraw.Draw(out)
    draw.text((18, 12), title, font=TITLE, fill=INK)
    draw.text((18, 41), subtitle, font=FONT, fill=MUTED)
    draw.text((18, 62), 'BEFORE only | baseline 49eca254d795 | art v30 | same stage scale within sheet',font=FONT,fill=MUTED)
    for i, (cls, name, mode) in enumerate(cells):
        x, y = (i%columns)*pw, 91+(i//columns)*ph
        path, (left, top, w, h), body, factor = placement(cls,name,mode)
        img = image_for(path)
        # Fixed mapping of stage pixels: no per-frame bounds-based fitting.
        ox, oy = x+pw/2-384*s, y+372-480*s
        draw.rectangle((x+3,y+3,x+pw-3,y+ph-3), outline=(62,75,91,255),width=1)
        for yy in range(80,601,80):
            py=round(oy+yy*s)
            if not (y+66 <= py <= y+389):
                continue
            draw.line((x+8,py,x+pw-8,py),fill=(36,46,60,255))
            draw.text((x+10,py-15),str(yy),font=FONT,fill=(85,101,120,255))
        ground=round(oy+480*s)
        draw.line((x+8,ground,x+pw-8,ground),fill=(70,198,153,255),width=2)
        draw.line((round(ox+384*s),y+61,round(ox+384*s),y+399),fill=(65,81,100,255))
        drawn=img.resize((max(1,round(w*s)),max(1,round(h*s))),Image.Resampling.LANCZOS)
        # Composite into its own panel so no bitmap can obscure an adjacent
        # cell's annotation. Dimensions reserve the full opaque reach below.
        panel=Image.new('RGBA',(pw,ph),(0,0,0,0))
        panel.alpha_composite(drawn,(round(ox+left*s)-x,round(oy+top*s)-y))
        alpha=img.getchannel('A').getbbox()
        if alpha:
            projected=(pw/2+(left+alpha[0]*w/img.width-384)*s,
                       pw/2+(left+alpha[2]*w/img.width-384)*s)
            if projected[0]<4 or projected[1]>pw-4:
                raise ValueError(f'Panel too narrow for full alpha reach: {cls}/{name} {projected}')
        out.alpha_composite(panel,(x,y))
        draw.text((x+12,y+12),f'{cls.upper()} / {name}',font=TITLE,fill=INK)
        draw.text((x+12,y+39),f'{mode}; {s:g} output px / stage px',font=FONT,fill=MUTED)
        if factor is not None:
            draw.text((x+12,y+405),f'body normalization x{factor:.6f}',font=FONT,fill=INK)
        else:
            draw.text((x+12,y+405),'HURT registration; no body landmarks',font=FONT,fill=INK)
        # Asset basename plus stable record lookup keeps labels readable.
        base=Path(path).name
        draw.text((x+12,y+426),base[:51],font=FONT,fill=MUTED)
        draw.text((x+12,y+446),f'source raster {img.width}x{img.height}; floor=480',font=FONT,fill=MUTED)
    out.convert('RGB').save(HERE/filename,optimize=True)

for cls in data['classes']:
    write_sheet(f'{cls}-selected-before.png', f'{cls.title()}: selected identity audit',
                'Static current-registration reconstruction, NOT a gameplay screenshot; effects/timing omitted.',
                [(cls,n,'current') for n in ['ready','offensive','defensive','casting','counter','sweep','smash','HURT']],4,s=.58)

write_sheet('starseer-hit-reference.png', 'Primary case: Starseer receives a hit',
            'Current source selection and registration; static hit image without recoil/red flash.',
            [('starseer','ready','current'),('starseer','HURT','current')],2,s=.9)

write_sheet('reaver-sweep-current-before.png', 'Primary case: Reaver selected SW09 Sweep',
            'Current held normalization and unmeasured action placement; all panels share one stage scale.',
            [('reaver',n,'current') for n in ['ready','sweep','pilot-sweep-windup','pilot-sweep-contact','pilot-sweep-finish','ready']],3,s=.60,pw=680)

write_sheet('reaver-sweep-authored-reference.png', 'Reaver authored logical placements: BEFORE reference',
            'Normalization omitted for diagnosis only. NOT a proposed fix or after-image.',
            [('reaver',n,'authored') for n in ['ready','sweep','pilot-sweep-windup','pilot-sweep-contact','pilot-sweep-finish','ready']],3,s=.60,pw=680)

# Existing pinned alternatives, at the same source raster pixel scale. These
# are candidate inspection references, never implied to be selected in combat.
alts=['assets/animations/unarmed-magic/starseer/HURT.webp','assets/animations/unarmed/starseer/HURT.webp',
      'assets/animations/greatsword-outfits/starseer/HURT.webp','assets/painted-outfits/starseer/hit.webp']
out=Image.new('RGBA',(1180,730),(24,30,39,255));d=ImageDraw.Draw(out)
d.text((18,14),'Starseer existing HURT candidates — none establishes a matching hooded staff reaction',font=TITLE,fill=INK)
d.text((18,43),'Pinned v30 inputs at one common 0.72 source-pixel scale; no per-image fit. NOT runtime scale.',font=FONT,fill=MUTED)
for i,path in enumerate(alts):
    image=image_for(path)
    x,y=(i%2)*590,80+(i//2)*325
    # Entire 640 raster may exceed panel height, but painted-outfit candidate
    # visible character sits at the bottom; place every source floor at y+285.
    floor=600 if 'painted-outfits' in path else 480
    s=.72
    out.alpha_composite(image.resize((round(image.width*s),round(image.height*s)),Image.Resampling.LANCZOS),(round(x+295-image.width*s/2),round(y+285-floor*s)))
    d.text((x+12,y+9),path.replace('assets/animations/',''),font=FONT,fill=INK)
    d.text((x+12,y+302),f'{image.width}x{image.height}; source floor reference {floor}',font=FONT,fill=MUTED)
out.convert('RGB').save(HERE/'starseer-existing-hurt-candidates.png',optimize=True)

manifest={'sourceCommit':data['source'],'artTag':data['art'],'kind':'before-only static diagnostic reconstruction; not gameplay capture',
          'inputAssets':records,'outputImages':{p.name:{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in sorted(HERE.glob('*.png'))}}
(HERE/'image-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Wrote {len(manifest["outputImages"])} sheets using {len(records)} pinned assets.')
