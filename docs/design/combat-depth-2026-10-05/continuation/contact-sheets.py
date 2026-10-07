from pathlib import Path
import json, math
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent
C=json.loads((ROOT/'scene-catalog.json').read_text(encoding='utf-8'))
L={x['id']:x for x in C['layers']};A={x['id']:x for x in C['actors']}
out=ROOT/'review';out.mkdir(exist_ok=True)
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',16)
small=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',13)
def compose(s,device):
    d=s['devices'][device];w,h=d['width'],d['height'];im=Image.new('RGBA',(w,h),'#74766e')
    def layer(t):
        pic=Image.open(ROOT/L[t['id']]['file']).convert('RGBA').resize((round(t['width']),round(t['height'])),Image.Resampling.LANCZOS)
        im.alpha_composite(pic,(round(t['x']),round(t['y'])))
    for t in d['layers'][:-1]:layer(t)
    for p in d['actors']:
        a=A[p['id']];b=a['visibleBounds'];scale=min(p['height']*h/(b[3]-b[1]),w*(.43 if device=='phone' else .35)/(b[2]-b[0]))
        pic=Image.open(ROOT/a['file']).convert('RGBA').resize((round(a['size'][0]*scale),round(a['size'][1]*scale)),Image.Resampling.LANCZOS)
        im.alpha_composite(pic,(round(p['x']*w-a['footAnchor'][0]*scale),round(p['footY']*h-a['footAnchor'][1]*scale)))
    layer(d['layers'][-1]);return im.convert('RGB')
for device in ('desktop','phone'):
    for start in range(0,len(C['scenes']),8):
        scenes=C['scenes'][start:start+8];tw,th=(576,384) if device=='desktop' else (288,384)
        sheet=Image.new('RGB',(tw*4,(th+55)*math.ceil(len(scenes)/4)),'#171c18');draw=ImageDraw.Draw(sheet)
        for i,s in enumerate(scenes):
            im=compose(s,device);im.save(out/f"{s['id']}-{device}.jpg",quality=90)
            im.thumbnail((tw,th));x=i%4*tw;y=i//4*(th+55);sheet.paste(im,(x,y));draw.text((x+9,y+th+5),s['name'],fill='#ebd4a1',font=font if device=='desktop' else small);draw.text((x+9,y+th+29),s['id'],fill='#a4ad9f',font=small)
        sheet.save(out/f'scenes-{device}-{start//8+1}.jpg',quality=92)
actors=[a for a in C['actors'] if a['family'] in ('companion','speaker')]
sheet=Image.new('RGB',(350*len(actors),580),'#1b211b');draw=ImageDraw.Draw(sheet)
for i,a in enumerate(actors):
    card=Image.new('RGBA',(334,520),'#c6cbbb');pic=Image.open(ROOT/a['file']).convert('RGBA');pic.thumbnail((310,490),Image.Resampling.LANCZOS);card.alpha_composite(pic,((334-pic.width)//2,(520-pic.height)//2));sheet.paste(card.convert('RGB'),(i*350+8,8));draw.text((i*350+14,540),a['name'],fill='#e9d5a9',font=font)
sheet.save(out/'rear-companions-speakers.jpg',quality=94)
print(f"Rendered {len(C['scenes'])*2} scene compositions and rear sprite contact sheet")
