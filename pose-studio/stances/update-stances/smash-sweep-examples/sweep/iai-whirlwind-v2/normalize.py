import argparse,json,hashlib,shutil
from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
from scipy.ndimage import label,find_objects,distance_transform_edt
ap=argparse.ArgumentParser();ap.add_argument('folder');ap.add_argument('--heads',required=True);ap.add_argument('--grounds',required=True);ap.add_argument('--targets',default='560,550,560,575,560');args=ap.parse_args();p=Path(args.folder);seed=p.parent/'seed/stance.png';ar=np.array(Image.open(p/'raw.png').convert('RGBA'));lab,n=label(ar[:,:,3]>16);regs=[]
for i,s in enumerate(find_objects(lab)):
 if s and (lab[s]==i+1).sum()>1000:regs.append((s[1].start,i+1,s))
regs.sort();assert len(regs)==5, f'five isolated paintings required; found {len(regs)}'
major=np.zeros_like(lab)
for idx,(_,num,s) in enumerate(regs):major[lab==num]=idx+1
dist,nearest=distance_transform_edt(major==0,return_indices=True);assigned=major[tuple(nearest)];heads=list(map(float,args.heads.split(',')));grounds=list(map(float,args.grounds.split(',')));targets=list(map(float,args.targets.split(',')));scale=319/(regs[0][2][0].stop-regs[0][2][0].start);frames=[];records=[]
for idx,(_,num,s) in enumerate(regs):
 out=Image.new('RGBA',(1024,1024));dest=p/f'frame-{idx+1:02}.png'
 if idx in[0,4]:shutil.copyfile(seed,dest);out=Image.open(seed).convert('RGBA')
 else:
  isolated=ar.copy();isolated[(assigned!=idx+1)|(dist>12)]=0;box=(max(0,s[1].start-12),max(0,s[0].start-12),min(ar.shape[1],s[1].stop+12),min(ar.shape[0],s[0].stop+12));crop=Image.fromarray(isolated).crop(box);crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS);x=round(targets[idx]-(heads[idx]-box[0])*scale);y=round(726-(grounds[idx]-box[1])*scale);out.alpha_composite(crop,(x,y));out.save(dest);records.append(dict(slot=idx+1,raw_component=num,shared_scale=scale,raw_helmet_x=heads[idx],target_helmet_x=targets[idx],raw_boot_floor=grounds[idx],ground_y=726,placement=[x,y]))
 frames.append(out)
strip=Image.new('RGBA',(5120,1024));gif=[]
for idx,f in enumerate(frames):
 strip.alpha_composite(f,(1024*idx,0));c=Image.new('RGBA',(1024,1060),'#273342');c.alpha_composite(f,(0,30));ImageDraw.Draw(c).text((12,9),p.name+' / '+str(idx+1)+'/5: '+['low iai stance','counter-coil','turning whirl cut','low followthrough','low iai stance'][idx],fill='white');gif.append(c.convert('RGB'))
strip.save(p/'strip.png');gif[0].save(p/'preview.gif',save_all=True,append_images=gif[1:],duration=[350,210,180,260,350],loop=0)
sha=lambda q:hashlib.sha256(q.read_bytes()).hexdigest();(p/'normalization.json').write_text(json.dumps(dict(frame_size=[1024,1024],frame_count=5,raw_sha256=sha(p/'raw.png'),seed_sha256=sha(seed),frames_sha256=[sha(p/f'frame-{i:02}.png') for i in range(1,6)],method='bounded connected-component isolation, one scale from raw idle body/approved seed, anatomical helmet x and boot floor anchors, exact normalized seed PNG bytes locked in01/05; no alpha-bounds centering',transforms=records),indent=2)+'\n')
