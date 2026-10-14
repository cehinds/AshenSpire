from pathlib import Path
import shutil, hashlib, json
import numpy as np
import scipy.ndimage as ndi
from PIL import Image,ImageDraw
p=Path(__file__).resolve().parents[1]; s=p/'source'; f=p/'frames'; f.mkdir(exist_ok=True)
raw=s/'raw-strip.png'
im=Image.open(raw).convert('RGBA'); ar=np.array(im); ar[ar[:,:,3]<8]=0; labs,_=ndi.label(ar[:,:,3]>32)
ids=[3,2,1,7,4]; core=np.isin(labs,ids)
_,inds=ndi.distance_transform_edt(~core,return_indices=True); owner=labs[inds[0],inds[1]]
rects=[]; bounds=[]; out=[]; scale=1.35; ground=714; names=['01-held','02-takeoff','03-airborne','04-impact','05-held']
for ident,name in zip(ids,names):
 data=ar.copy(); data[:,:,3]=np.where(owner==ident,data[:,:,3],0)
 sprite=Image.fromarray(data); box=sprite.getbbox(); rects.append(list(box)); crop=sprite.crop(box)
 resized=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS)
 frame=Image.new('RGBA',(1024,1024)); x=round(512-resized.width/2); y=round(900+(box[1]-ground)*scale)
 frame.alpha_composite(resized,(x,y)); frame.save(f/(name+'.png')); out.append(frame); bounds.append(list(frame.getbbox()))
shutil.copyfile(f/'01-held.png',f/'05-held.png'); out[4]=out[0].copy(); bounds[4]=bounds[0]
preview=Image.new('RGB',(1600,390),(35,38,44)); d=ImageDraw.Draw(preview)
for i,(frame,name) in enumerate(zip(out,names)):
 thumb=frame.resize((320,320),Image.Resampling.LANCZOS); preview.paste(thumb,(320*i,40),thumb); d.text((320*i+15,12),name,fill='white'); d.line((320*i,321,320*(i+1),321),fill=(110,110,110))
preview.save(p/'preview-strip.png')
gifs=[]
for frame in out:
 thumb=frame.resize((512,512),Image.Resampling.LANCZOS); bg=Image.new('RGB',thumb.size,(35,38,44)); bg.paste(thumb,mask=thumb.getchannel('A')); gifs.append(bg)
gifs[0].save(p/'preview.gif',save_all=True,append_images=gifs[1:],duration=[360,140,200,260,400],loop=0)
hashfile=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
prov={'status':'pending root review; not production approved','generator':'image_gen image edit full five-frame strip','promptFile':'source/prompt.txt','registration':{'frameSize':[1024,1024],'groundAnchor':[512,900],'bodyHeight':round(366*scale)},'normalization':{'sharedScale':scale,'rawWorldGroundY':ground,'slotRects':rects,'method':'connected-component ownership; nearest-main-component attribution for detached alpha islands; shared scale and world ground; horizontal centering only','alphaBounds':bounds,'noAirborneFootLock':True,'frame05ByteIdentical01':True},'hashes':{str(x.relative_to(p)):hashfile(x) for x in [s/'costume-seed.png',s/'edit-canvas.png',s/'raw-strip.png',s/'prompt.txt',*sorted(f.glob('*.png'))]},'alpha':{'mode':'RGBA','rawRange':[int(ar[:,:,3].min()),int(ar[:,:,3].max())]},'seedOriginal':'pose-studio/renewal/herald/frames/ready.png','seedUse':'costume only; sword/shield replaced by right bone ritual mace and empty left hand'}
(p/'provenance.json').write_text(json.dumps(prov,indent=2)+'\n')
print(json.dumps({'bounds':bounds,'rects':rects,'frame05matches':hashfile(f/'01-held.png')==hashfile(f/'05-held.png')}))
