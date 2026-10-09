from pathlib import Path
import argparse, hashlib, json, shutil
from PIL import Image
p=argparse.ArgumentParser()
p.add_argument('--id',required=True)
p.add_argument('--source',required=True)
p.add_argument('--prompt-file',required=True)
a=p.parse_args()
root=Path(__file__).resolve().parent
c=json.loads((root/'catalog.json').read_text(encoding='utf-8'))
e=next(e for e in c['entries'] if e['id']==a.id)
dest=root/'masters'/f'{a.id}-rear.png'
shutil.copy2(a.source,dest)
im=Image.open(dest); alpha=im.getchannel('A')
box=alpha.point(lambda v:255 if v>32 else 0).getbbox()
e.setdefault('previousView',{k:e[k] for k in ['file','validation','facing','promptUsed'] if k in e})
e.update(file=dest.relative_to(root).as_posix(),facing='away, rear three-quarter right',generatedSource=a.source,promptUsed=Path(a.prompt_file).read_text(encoding='utf-8'),status='generated')
e['validation']=dict(size=list(im.size),mode=im.mode,alphaRange=list(alpha.getextrema()),transparentFraction=alpha.histogram()[0]/(im.width*im.height),visibleBounds=list(box),anchor=[(box[0]+box[2])/2,box[3]],sha256=hashlib.sha256(dest.read_bytes()).hexdigest())
(root/'receipts'/f'{a.id}.json').write_text(json.dumps(e,indent=2),encoding='utf-8')
(root/'catalog.json').write_text(json.dumps(c,indent=2),encoding='utf-8')
(root/'catalog-data.js').write_text('window.COMBAT_ART_CATALOG = '+json.dumps(c)+';\n',encoding='utf-8')
print(a.id,im.size,alpha.getextrema())
