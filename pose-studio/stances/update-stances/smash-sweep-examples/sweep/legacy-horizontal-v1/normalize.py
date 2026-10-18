"""Mechanical component isolation, common-scale anatomical anchoring and exact bookends."""
import argparse, hashlib, json, shutil
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import label, find_objects, distance_transform_edt

ap=argparse.ArgumentParser()
ap.add_argument('folder');ap.add_argument('--raw',default='raw.png');ap.add_argument('--seed',required=True)
ap.add_argument('--heads',required=True);ap.add_argument('--targets',default='377,360,377,392,377')
args=ap.parse_args();p=Path(args.folder);ar=np.array(Image.open(p/args.raw).convert('RGBA'))
lab,n=label(ar[:,:,3]>20);regs=[]
for i,s in enumerate(find_objects(lab)):
    if s and (lab[s]==i+1).sum()>1000:regs.append((s[1].start,i+1,s))
regs.sort();assert len(regs)==5, f'Expected 5 figures, found {len(regs)}'
major=np.zeros_like(lab)
for idx,(_,num,s) in enumerate(regs):major[lab==num]=idx+1
_,nearest=distance_transform_edt(major==0,return_indices=True);assigned=major[tuple(nearest)]
scale=365/(regs[0][2][0].stop-regs[0][2][0].start)
heads=list(map(float,args.heads.split(',')));desired=list(map(float,args.targets.split(',')))
frames=[];records=[]
for idx,(_,num,s) in enumerate(regs):
    out=Image.new('RGBA',(768,512));dest=p/f'frame-{idx+1:02}.webp'
    if idx in (0,4):shutil.copyfile(args.seed,dest);out=Image.open(args.seed).convert('RGBA')
    else:
        isolated=ar.copy();isolated[assigned!=idx+1]=0
        crop=Image.fromarray(isolated).crop((s[1].start-3,s[0].start-3,s[1].stop+3,s[0].stop+3))
        crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS)
        x=round(desired[idx]-(heads[idx]-(s[1].start-3))*scale);y=467-round((s[0].stop-(s[0].start-3))*scale)
        out.alpha_composite(crop,(x,y));out.save(dest,lossless=True)
        records.append(dict(frame=idx+1,component=num,scale=scale,placement=[x,y],head_reference=heads[idx],target_head=desired[idx],sole_y=467))
    frames.append(out)
strip=Image.new('RGBA',(3840,512))
for idx,f in enumerate(frames):strip.alpha_composite(f,(768*idx,0))
strip.save(p/'strip.png');gif=[]
for idx,f in enumerate(frames):
    c=Image.new('RGB',(768,546),'#18202a');c.paste(f,(0,25),f)
    ImageDraw.Draw(c).text((15,8),f'{p.name} / {idx+1}: '+['approved stance','windup','contact','followthrough','approved stance'][idx],fill='white');gif.append(c)
gif[0].save(p/'preview.gif',save_all=True,append_images=gif[1:],duration=[350,200,180,230,350],loop=0)
sha=lambda f:hashlib.sha256(Path(f).read_bytes()).hexdigest()
(p/'normalization.json').write_text(json.dumps(dict(raw=args.raw,raw_sha256=sha(p/args.raw),source_sha256=sha(args.seed),frame_count=5,frame_sha256=[sha(p/f'frame-{i:02}.webp') for i in range(1,6)],method='connected figure isolation, common body scale, anatomical head reference, sole baseline; no alpha bounds centering',transforms=records),indent=2)+'\n')
