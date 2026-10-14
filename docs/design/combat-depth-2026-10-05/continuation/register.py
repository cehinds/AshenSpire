from pathlib import Path
import json,sys,hashlib,shutil
from PIL import Image
root=Path(__file__).resolve().parent
jobid,source=sys.argv[1:3]
jobs=json.loads((root/'sprite-prompts.json').read_text())
if (root/'repair-prompts.json').exists():jobs+=json.loads((root/'repair-prompts.json').read_text())
if (root/'extra-prompts.json').exists():jobs+=json.loads((root/'extra-prompts.json').read_text())
if (root/'scene-prompts.json').exists():jobs+=json.loads((root/'scene-prompts.json').read_text())
job=next(j for j in jobs if j['id']==jobid)
dest=root/job['resultFile'];dest.parent.mkdir(parents=True,exist_ok=True)
shutil.copy2(source,dest)
im=Image.open(dest);a=im.getchannel('A') if im.mode=='RGBA' else None
box=a.point(lambda v:255 if v>32 else 0).getbbox() if a else (0,0,*im.size)
record=dict(**job,generatedSource=source,generator='built-in image_gen',size=list(im.size),mode=im.mode,sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),alphaRange=list(a.getextrema()) if a else None,transparentFraction=a.histogram()[0]/(im.width*im.height) if a else 0,visibleBounds=list(box),alphaThreshold=32)
if job['kind']=='sprite':record['anchor']=[(box[0]+box[2])/2,box[3]]
(root/'receipts').mkdir(exist_ok=True)
(root/'receipts'/f'{jobid}.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(dict(id=jobid,file=job['resultFile'],size=im.size,bounds=box,alpha=record['alphaRange'])))
