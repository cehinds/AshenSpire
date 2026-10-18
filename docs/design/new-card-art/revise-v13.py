"""Export green imagegen color edits without altering their alpha or geometry."""
import hashlib,json,subprocess
from pathlib import Path
from PIL import Image
R=Path(__file__).resolve().parent;d=json.loads((R/'cutout-manifest.json').read_text())
sources=['24bf9175-1d2d-464c-bcf4-ef7bbc541255','2539d752-7e00-4c92-a6ea-e7679e563ff6','b99b6806-084e-4539-9f7d-a39a18e943e2','3fb0c65d-d8fc-48aa-a095-d6df719a5c64','182c09e4-32b0-43cc-994a-18031a0f4be6']
for i,uid in enumerate(sources,5):
 a=d['assets'][f'Y.effect.{i}'];source=Path('/workspace/generated_images')/f'exec-{uid}.png';out=R/a['src'];prior=a['sha256']
 subprocess.run(['magick',str(source),'-resize','512x512!','-define','png:color-type=6','-define','png:exclude-chunk=date,time',str(out)],check=True)
 a['name']=a['name'].replace('Violet','Green');a['displayLabel']=a['displayLabel'].replace('Violet','Green');a['sha256']=hashlib.sha256(out.read_bytes()).hexdigest();a['alphaBounds']=list(Image.open(out).getchannel('A').getbbox());a['defaultTransform']['opacity']=.2;a['defaultTransform']['filter']='saturate(0.45)';a['css'].update(opacity='0.2',filter='saturate(0.45)')
 a['references'].update(sourceFile=source.name,sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),sourceCell={'x':0,'y':0,'width':Image.open(source).width,'height':Image.open(source).height},extractionCrop={'x':0,'y':0,'width':Image.open(source).width,'height':Image.open(source).height},colorEditReference={'commit':'6e8905767','src':a['src'],'sha256':prior},revisionIntent='Green color edit with preserved translucent energy silhouette. Render at 20% opacity and 45% saturation for soft ethereal green.')
(R/'cutout-manifest.json').write_text(json.dumps(d,indent=2)+'\n')
