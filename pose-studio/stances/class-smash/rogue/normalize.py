from PIL import Image,ImageDraw
from pathlib import Path
from scipy.ndimage import label,find_objects,distance_transform_edt
import numpy as np,json,hashlib,shutil
p=Path(__file__).parent;im=Image.open(p/'generated-raw.png').convert('RGBA');pixels=np.array(im);labels,n=label(pixels[:,:,3]>10)
major=[9,2,1,25,10];seeds=np.zeros(labels.shape,dtype=np.uint8)
for slot,component in enumerate(major,1):seeds[labels==component]=slot
_,indices=distance_transform_edt(seeds==0,return_indices=True);assignment=seeds[tuple(indices)]
rects=[[0,0,435,724],[435,0,875,724],[815,0,1240,724],[1200,0,1710,724],[1690,0,2172,724]]
names=['01-held.png','02-takeoff.png','03-airborne.png','04-impact.png','05-held.png'];scale=1.25;ground=689;anchor=[512,930];frames=[];bounds=[]
for i,(r,name) in enumerate(zip(rects,names),1):
 isolated=pixels.copy();isolated[assignment!=i]=0;crop=Image.fromarray(isolated).crop(r);crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS);f=Image.new('RGBA',(1024,1024));f.alpha_composite(crop,(round(512-crop.width/2),round(930-ground*scale)));f.save(p/name);frames.append(f);bounds.append(f.getbbox())
shutil.copyfile(p/names[0],p/names[4]);frames[4]=frames[0].copy();bounds[4]=bounds[0]
preview=Image.new('RGB',(1500,340),(30,35,40));d=ImageDraw.Draw(preview)
for i,f in enumerate(frames):
 f=f.resize((300,300),Image.Resampling.LANCZOS);preview.paste(f,(i*300,30),f);d.text((i*300+8,8),names[i],fill='white');d.line((i*300,30+round(930*300/1024),(i+1)*300,30+round(930*300/1024)),fill=(80,85,90))
preview.save(p/'preview-strip.png');gif=[]
for f in frames:
 b=Image.new('RGB',(400,400),(30,35,40));f=f.resize((400,400),Image.Resampling.LANCZOS);b.paste(f,(0,0),f);gif.append(b)
gif[0].save(p/'preview.gif',save_all=True,append_images=gif[1:],duration=[500,140,280,260,500],loop=0)
meta=json.loads((p/'provenance.json').read_text());meta.update({'sourceStripSha256':hashlib.sha256((p/'generated-raw.png').read_bytes()).hexdigest(),'slotRects':rects,'alphaBounds':bounds,'qaConcerns':[],'generationOutput':'/workspace/generated_images/exec-f42dbef0-d37e-42bf-b0a0-65ce3ca6e9a5.png'});meta['normalization'].update({'rawGroundY':ground,'verticalRegistration':'all slots raw y689 to y930, no per-frame foot alignment','extraction':'Five disjoint main alpha components at threshold10, ids9,2,1,25,10; nearest-main-component assignment retains low-alpha edges/dust. Overlapping x-ranges stay separated without painting.'});(p/'provenance.json').write_text(json.dumps(meta,indent=2)+'\n')
