from pathlib import Path
import argparse, hashlib, json, shutil
from PIL import Image

p=argparse.ArgumentParser()
p.add_argument('--id',required=True)
p.add_argument('--source',required=True)
a=p.parse_args()
root=Path(__file__).resolve().parent
catalog=json.loads((root/'catalog.json').read_text(encoding='utf-8'))
entry=next(e for e in catalog['entries'] if e['id']==a.id)
source=Path(a.source)
dest=root/entry['file']
shutil.copy2(source,dest)
im=Image.open(dest)
alpha=im.getchannel('A') if im.mode=='RGBA' else None
box=alpha.point(lambda v:255 if v>32 else 0).getbbox() if alpha else (0,0,*im.size)
hist=alpha.histogram() if alpha else None
entry.update(status='generated',generatedSource=str(source),validation=dict(size=list(im.size),mode=im.mode,alphaRange=list(alpha.getextrema()) if alpha else None,transparentFraction=hist[0]/(im.width*im.height) if hist else 0,visibleBounds=box,anchor=[(box[0]+box[2])/2,box[3]] if box else None,sha256=hashlib.sha256(dest.read_bytes()).hexdigest()))
(root/'receipts').mkdir(exist_ok=True)
(root/'receipts'/f'{a.id}.json').write_text(json.dumps(entry,indent=2),encoding='utf-8')
print(json.dumps(dict(id=a.id,**entry['validation'])))
