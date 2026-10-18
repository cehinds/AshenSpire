"""Revise the ten melee heads and label the complete component catalog."""
import copy,hashlib,json,subprocess
from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage
ROOT=Path(__file__).resolve().parent
sheet=Path('/workspace/generated_images/exec-9cd7eea3-4698-4da5-9e72-287753d2f4ec.png')
data=json.loads((ROOT/'cutout-manifest.json').read_text())
im=Image.open(sheet).convert('RGBA');alpha=np.asarray(im.getchannel('A'))
labels,count=ndimage.label(alpha>8);sizes=np.bincount(labels.ravel());sizes[0]=0
largest=np.argsort(sizes)[-10:];assert sizes[largest].min()>1000
slices=ndimage.find_objects(labels)
boxes=[(slices[n-1][1].start,slices[n-1][0].start,slices[n-1][1].stop,slices[n-1][0].stop) for n in largest]
boxes.sort(key=lambda b:(b[1]+b[3])/2);boxes=sorted(boxes[:5],key=lambda b:b[0])+sorted(boxes[5:],key=lambda b:b[0])
shapes=['Sword blade','Hammer head','Scythe blade','Scimitar blade','Shield ward']
# Broad mounting heels, inside the weapon rather than at the end of a thin wisp.
anchors=[(.23,.79),(.30,.76),(.29,.77),(.23,.79),(.23,.79)]
settings=[(480,-9),(470,-10),(460,0),(470,-8),(440,-4)]
for i,(x,y,r,b) in enumerate(boxes):
 x,y,r,b=max(0,x-6),max(0,y-6),min(im.width,r+6),min(im.height,b+6)
 out=ROOT/'cutouts/Y/effects'/f'{i}.png'
 subprocess.run(['magick',str(sheet),'-crop',f'{r-x}x{b-y}+{x}+{y}','+repage','-resize','448x448','-background','none','-gravity','center','-extent','512x512','-define','png:color-type=6','-define','png:exclude-chunk=date,time',str(out)],check=True)
 a=data['assets'][f'Y.effect.{i}'];a['name']=('Blue' if i<5 else 'Violet')+' ethereal '+shapes[i%5].lower()
 a['sha256']=hashlib.sha256(out.read_bytes()).hexdigest();a['alphaBounds']=list(Image.open(out).convert('RGBA').getchannel('A').getbbox())
 ax,ay=anchors[i%5];a['anchors']['emissionRoot']={'x':ax,'y':ay}
 a['references'].update(sourceFile=sheet.name,sourceSha256=hashlib.sha256(sheet.read_bytes()).hexdigest(),sourceCell={'x':x,'y':y,'width':r-x,'height':b-y},extractionCrop={'x':x,'y':y,'width':r-x,'height':b-y},revisionIntent='Broad blade/head wraps around the stone; proportions follow the user-annotated outline, without a long spectral connector.')
for i in range(10):
 data['assets'][f'V.object.{i}']['name']=['Amber','Ivory','Ruby','Amethyst','Teal crystal','Smoky quartz','Moonstone','Black opal','Sapphire','Emerald'][i]+' scepter'
for c in data['compositions'].values():
 if c['category']=='Y':
  layers={l['id']:l for l in c['layers']};size,rotation=settings[c['effectDigit']%5]
  layers['object']['overrides'].update(x=135,y=465)
  layers['foreground']['overrides'].update(width=size,height=size,rotationDeg=rotation,opacity=.58)
  c['designRevision']=7
for a in data['assets'].values():
 a['displayCode']=a['id'] if a['kind']=='background' else f"{a['category']}{a['digit'] if a['kind']=='object' else 0}{a['digit'] if a['kind']=='effect' else 0}"
 a['displayLabel']=f"{a['displayCode']} · {a['name']} · {a['kind']}"
for c in data['compositions'].values():
 layers={l['id']:l for l in c['layers']};obj=data['assets'][layers['object']['assetId']];fx=data['assets'][layers['foreground']['assetId']]
 c['displayName']=f"{fx['name']} / {obj['name']}" if c['category'] in 'YZ' else f"{obj['name']} / {fx['name']}"
 c['displayLabel']=f"{c['code']} · {c['displayName']}"
for category in data['categories']:
 if category['letter']=='Y':category['revision']=7
data['scope'].update(latestBatchObjectCount=0,latestBatchNewPngCount=0,latestBatchRevisedEffectCount=10)
data['revision']=7;data['references']['meleeRevision']='revision-v7.json'
data['scope']['confirmed']='Broad ethereal heads wrap around scepter stones. Every object, effect, background, assembled choice and intact reference has a visible code and name. Asset IDs and counts stay stable.'
for letter in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
 path=ROOT/'cutouts'/letter/'assets.json'
 if path.exists():path.write_text(json.dumps({k:a for k,a in data['assets'].items() if a['category']==letter},indent=2)+'\n')
(ROOT/'cutout-manifest.json').write_text(json.dumps(data,indent=2)+'\n');(ROOT/'cutouts-data.js').write_text('window.CARD_CUTOUT_DATA = '+json.dumps(data,separators=(',',':'))+';\n')
(ROOT/'revision-v7.json').write_text(json.dumps({'revision':7,'sourceCommit':'b8d337437c0f5b9ae096205b50ea3feaaf9b9b00','request':'Follow the broad weapon outlines in the annotated screenshot and label every item.','changedPngs':[f'Y.effect.{i}' for i in range(10)],'unchangedPngCount':352,'magicPlacement':{'parent':{'x':135,'y':465},'perShape':[{'shape':s,'size':p[0],'rotationDeg':p[1],'anchor':a} for s,p,a in zip(shapes,settings,anchors)]},'labelPolicy':'Labels are in HTML and JSON outside the transparent PNG pixels. Display codes keep the existing category/object/effect scheme; 0 is a real variant.','generationSource':str(sheet)},indent=2)+'\n')
print('Revision 7: ten revised heads; 362 components and 2520 compositions labelled.')
