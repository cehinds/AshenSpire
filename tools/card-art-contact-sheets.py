"""QA montage of existing artwork, never an artwork-generation step."""
import argparse, hashlib, json, math, textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

parser=argparse.ArgumentParser()
parser.add_argument('--library',default='D:/repos/AshenedSpire-Editor/public/parts/card-assembler/card-art-library')
parser.add_argument('--out',default='docs/design/card-art-20261005/contact-sheets')
args=parser.parse_args()
library=Path(args.library).resolve(); output=Path(args.out).resolve(); output.mkdir(parents=True,exist_ok=True)
rows=[]
for path in sorted((library/'receipts').glob('*.json')):
    receipt=json.loads(path.read_text(encoding='utf-8'))
    if not receipt.get('sourceMaster') or not receipt.get('sha256'): continue
    master=(library/receipt['sourceMaster']).resolve()
    if not master.is_relative_to(library/'masters'): raise ValueError('Master outside source directory: '+str(path))
    if hashlib.sha256(master.read_bytes()).hexdigest()!=receipt['sha256']: raise ValueError('Master hash changed: '+str(path))
    rows.append((receipt,master))
rows.sort(key=lambda row:(row[0].get('class','equipment'),row[0]['kind'],row[0]['id']))
try: font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',13); titlefont=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',20)
except OSError: font=ImageFont.load_default(); titlefont=font
pages=[]
for start in range(0,len(rows),24):
    subset=rows[start:start+24]; sheet=Image.new('RGB',(1200,1400),'#171b18'); draw=ImageDraw.Draw(sheet)
    number=start//24+1; draw.text((20,12),f'AshenSpire card artwork - page {number} - {len(rows)} verified masters',font=titlefont,fill='#e8dabd')
    keys=[]
    for i,(receipt,path) in enumerate(subset):
        x=12+(i%6)*198; y=52+(i//6)*335
        with Image.open(path) as art:
            image=art.convert('RGB'); image.thumbnail((186,279),Image.Resampling.LANCZOS); sheet.paste(image,(x+(186-image.width)//2,y))
        key=receipt['kind']+':'+receipt['id']; keys.append(key)
        lines=textwrap.wrap(key,width=25)[:2]
        for j,line in enumerate(lines): draw.text((x,y+284+j*15),line,font=font,fill='#eee3cb')
        draw.text((x,y+316),receipt.get('class','equipment'),font=font,fill='#9bab9c')
    filename=f'page-{number:02d}.jpg'; sheet.save(output/filename,'JPEG',quality=92,subsampling=0)
    pages.append({'file':filename,'subjects':keys})
(output/'index.json').write_text(json.dumps({'subjects':len(rows),'pages':pages},indent=2)+'\n',encoding='utf-8')
print(json.dumps({'subjects':len(rows),'pages':len(pages),'output':str(output)}))
