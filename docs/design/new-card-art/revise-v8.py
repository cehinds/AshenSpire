"""Extract reference-model ethereal silhouettes and fit full hilts over scepters.
Only ImageMagick crop/resize/pad is used; transparency and energy are imagegen art.
"""
import hashlib,json,subprocess,math
from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parent
data=json.loads((ROOT/'cutout-manifest.json').read_text())
jobs=[('sword','O.object.0','2af7e2f4-3270-471f-98e6-a13202fbc847',(.355,.668),560,156,-10,10,(190,410)),('hammer','O.object.1','75cc7ec1-ff47-4aa3-acad-80ec82b8624c',(.557,.51),450,230,0,-165,(270,290)),('scythe','L.object.4','f6e975ae-75f5-4f78-a612-c09e8327debb',(.52,.182),470,437,-75,75,(255,190)),('scimitar','O.object.2','148d5d78-5937-4b85-8bac-8128c4358587',(.27,.287),500,114,-12,-96,(190,420)),('shield','O.object.4','faca88be-84c3-454e-9e43-84e37002ed29',(.50,.465),460,220,-45,45,(256,300))]
records=[]
for digit,(shape,ref,uid,anchor,size,parentSize,parentRotation,rotation,stone) in enumerate(jobs):
 sheet=Path('/workspace/generated_images')/f'exec-{uid}.png';im=Image.open(sheet).convert('RGBA');alpha=np.asarray(im.getchannel('A'));base=data['assets'][ref]
 for tone in range(2):
  i=digit+5*tone;lo=im.width*tone//2;hi=im.width*(tone+1)//2;yy,xx=np.where(alpha[:,lo:hi]>3);x=max(lo,lo+int(xx.min())-8);y=max(0,int(yy.min())-8);r=min(hi,lo+int(xx.max())+9);b=min(im.height,int(yy.max())+9)
  out=ROOT/'cutouts/Y/effects'/f'{i}.png'
  subprocess.run(['magick',str(sheet),'-crop',f'{r-x}x{b-y}+{x}+{y}','+repage','-resize','448x448','-background','none','-gravity','center','-extent','512x512','-define','png:color-type=6','-define','png:exclude-chunk=date,time',str(out)],check=True)
  a=data['assets'][f'Y.effect.{i}'];a['name']=('Blue' if tone==0 else 'Violet')+' ethereal '+shape+' silhouette';a['sha256']=hashlib.sha256(out.read_bytes()).hexdigest();a['alphaBounds']=list(Image.open(out).getchannel('A').getbbox());a['anchors']['emissionRoot']={'x':anchor[0],'y':anchor[1]}
  a['references'].update(sourceReference=base['src'],referenceSha256=base['sha256'],baseAssetId=ref,baseAssetSha256=base['sha256'],sourceFile=sheet.name,sourceSha256=hashlib.sha256(sheet.read_bytes()).hexdigest(),sourceCell={'x':x,'y':y,'width':r-x,'height':b-y},extractionCrop={'x':x,'y':y,'width':r-x,'height':b-y},revisionIntent='Reference-model silhouette with transparent core and flowing energy; full contour continues through the grip and pommel around the physical scepter.')
  a['displayLabel']=f"{a['displayCode']} · {a['name']} · effect"
  records.append({'assetId':a['id'],'referenceAssetId':ref,'sourceFile':str(sheet),'sourceSha256':a['references']['sourceSha256']})
  for c in data['compositions'].values():
   if c['category']!='Y' or c['effectDigit']!=i:continue
   layers={l['id']:l for l in c['layers']};pa=data['assets'][layers['object']['assetId']];p=pa['anchors']['stoneHead'];rad=math.radians(parentRotation);dx=(p['x']-.5)*parentSize;dy=(p['y']-.5)*parentSize
   layers['object']['overrides'].update(x=round(stone[0]-math.cos(rad)*dx+math.sin(rad)*dy,3),y=round(stone[1]-math.sin(rad)*dx-math.cos(rad)*dy,3),width=parentSize,height=parentSize,rotationDeg=parentRotation)
   layers['foreground']['overrides'].update(width=size,height=size,rotationDeg=rotation,opacity=.80)
   layers['foreground']['attachment']['referenceParentSize']=parentSize
   c['designRevision']=8;c['displayName']=f"{a['name']} / {pa['name']}";c['displayLabel']=f"{c['code']} · {c['displayName']}"
for c in data['categories']:
 if c['letter']=='Y':c['revision']=8
data['revision']=8;data['references']['meleeRevision']='revision-v8.json';data['scope']['confirmed']='Reference-model ethereal silhouettes with luminous full contours, transparent cores and faint flowing energy. Physical scepters and spectral outlines remain separate layers. Zero is a real variant.'
(ROOT/'cutouts/Y/assets.json').write_text(json.dumps({k:a for k,a in data['assets'].items() if a['category']=='Y'},indent=2)+'\n')
(ROOT/'cutout-manifest.json').write_text(json.dumps(data,indent=2)+'\n');(ROOT/'cutouts-data.js').write_text('window.CARD_CUTOUT_DATA = '+json.dumps(data,separators=(',',':'))+';\n')
(ROOT/'revision-v8.json').write_text(json.dumps({'revision':8,'sourceCommit':'15e77d6ae9905e6e730450911621e3dacc6052e4','request':'Follow the supplied models with transparent energy silhouettes; extend the outline through the scepter guard, grip and pommel.','changedPngs':[f'Y.effect.{i}' for i in range(10)],'unchangedPngCount':352,'generationSources':records,'labelPolicy':'Keep category/object/effect codes and names outside the PNG pixels.'},indent=2)+'\n')
print('Revision 8: ten full-model silhouettes; source shapes and alpha preserved during export.')
