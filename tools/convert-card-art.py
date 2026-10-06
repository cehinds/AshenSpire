"""Format/size conversion only. The authored PNG master remains unchanged."""
import json, sys
from pathlib import Path
from PIL import Image, features
from concurrent.futures import ThreadPoolExecutor

request=json.load(sys.stdin)
def convert(job):
    with Image.open(job['source']) as master:
        master.load()
        if master.format!='PNG': raise ValueError('Master must be a PNG: '+job['source'])
        image=master.convert('RGB')
        if abs(image.width/image.height-2/3)>.025: raise ValueError('Master must be a full portrait composition near 2:3: '+job['source'])
        for target in job['outputs']:
            path=Path(target['path']); path.parent.mkdir(parents=True,exist_ok=True)
            result=image.resize((target['width'],target['height']),Image.Resampling.LANCZOS)
            result.save(path,'WEBP',quality=target['quality'],method=6,exact=True)
with ThreadPoolExecutor(max_workers=4) as pool:
    list(pool.map(convert, request['jobs']))
print(json.dumps({'converted':len(request['jobs']),'pillow':Image.__version__,'webp':features.version('webp')}))
