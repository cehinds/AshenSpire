"""Add requested stances/buff, labeled contact sheets, and group-level coverage."""
from pathlib import Path
from collections import deque
from PIL import Image, ImageFilter, ImageChops, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parent
manifest=json.loads((ROOT/'manifest.json').read_text())
coverage=json.loads((ROOT/'coverage.json').read_text())
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',17)

def extract(im):
 a=im.getchannel('A').resize((im.width//2,im.height//2),Image.Resampling.BOX)
 a=a.point(lambda v:255 if v>10 else 0).filter(ImageFilter.MaxFilter(3))
 w,h=a.size;data=bytearray(a.tobytes());found=[]
 for k in range(w*h):
  if not data[k]:continue
  data[k]=0;q=deque([k]);pixels=[];minx=maxx=k%w;miny=maxy=k//w
  while q:
   p=q.popleft();pixels.append(p);x=p%w;y=p//w
   minx=min(minx,x);maxx=max(maxx,x);miny=min(miny,y);maxy=max(maxy,y)
   for n,valid in ((p-1,x>0),(p+1,x<w-1),(p-w,y>0),(p+w,y<h-1)):
    if valid and data[n]:data[n]=0;q.append(n)
  if len(pixels)<700:continue
  mask=bytearray(w*h)
  for p in pixels:mask[p]=255
  mask=Image.frombytes('L',(w,h),bytes(mask)).resize(im.size,Image.Resampling.NEAREST)
  isolated=im.copy();isolated.putalpha(ImageChops.multiply(im.getchannel('A'),mask))
  box=isolated.getbbox();found.append((box,isolated.crop(box)))
 return sorted(found,key=lambda v:v[0][0])

def save(im,path):
 im.save(path,'WEBP',quality=88,method=3,exact=True)
 check=Image.open(path);check.load();assert check.size==im.size
 return path.relative_to(ROOT).as_posix()

for g in manifest['groups']:
 directory=ROOT/'animations'/g['classId']/g['id'].split('__')[1]
 src=Image.open(ROOT/'sources'/f"{g['classId']}-supplement.png").convert('RGBA')
 parts=extract(src)
 if len(parts)!=3:raise RuntimeError(f"{g['classId']}: expected 3 supplemental poses, got {len(parts)}")
 # Match the standing body height in the initial atlas. Aggressive and buff use the same scale.
 ready=Image.open(ROOT/g['frames'][0]['file']).convert('RGBA');ready_h=ready.getbbox()[3]-ready.getbbox()[1]
 body_height=ready_h*(0.83 if g['classId']=='reaver' else 1)
 scale=body_height/parts[1][1].height
 scale=min(scale,450/max(c.width for _,c in parts),450/max(c.height for _,c in parts))
 for i,(pose,label) in enumerate([('STANCE-AGGRESSIVE','Aggressive ready stance'),('STANCE-DEFENSIVE','Defensive ready stance'),('BUFF','Self enhancement')]):
  box,c=parts[i];size=(round(c.width*scale),round(c.height*scale));c=c.resize(size,Image.Resampling.LANCZOS)
  foot=c.getchannel('A').crop((0,max(0,c.height-12),c.width,c.height)).getbbox();rootx=(foot[0]+foot[2])/2 if foot else c.width/2
  x=max(8,min(round(256-rootx),504-c.width));frame=Image.new('RGBA',(512,512));frame.alpha_composite(c,(x,480-c.height))
  path=save(frame,directory/f'{pose}.webp')
  g['frames'].append({'id':pose,'label':label,'file':path,'size':[512,512],'root':[256,480],'sourceBox':box})
 g['frames'][0]['id']='STANCE-READY';g['frames'][0]['label']='Basic ready stance'
 ready_file=directory/'STANCE-READY.webp';save(ready,ready_file);g['frames'][0]['file']=ready_file.relative_to(ROOT).as_posix()
 images=[Image.open(ROOT/f['file']).convert('RGBA') for f in g['frames']]+[Image.open(ROOT/g['portrait']).convert('RGBA')]
 clean=Image.new('RGBA',(2048,2048));sheet=Image.new('RGB',(1200,1360),'#181a1e');draw=ImageDraw.Draw(sheet)
 for i,im in enumerate(images):
  clean.alpha_composite(im,((i%4)*512,(i//4)*512));thumb=im.resize((292,292),Image.Resampling.LANCZOS);x=i%4*300;y=i//4*340;sheet.paste(thumb,(x+4,y+4),thumb)
  label=g['frames'][i]['id'] if i<14 else 'PORTRAIT'
  draw.text((x+10,y+297),label,font=font,fill='#ebd4a0');draw.text((x+10,y+319),g['classId'].upper(),font=font,fill='#aaa8ae')
 save(clean,ROOT/g['atlas']);save(sheet,ROOT/g['sheet'])
 def family(item):return next((w['id'] for w in coverage['weapons'] if item in w['members']),None)
 g['rightGroup']=family(g['right']);g['leftGroup']=family(g['left'])
 g['groupTitle']=f"{next(w['name'] for w in coverage['weapons'] if w['id']==g['rightGroup'])} + {next((w['name'] for w in coverage['weapons'] if w['id']==g['leftGroup']),'Empty')} · {'Two-handed' if g['grip']=='twoHand' else 'One hand each'}"
 for pair in coverage['pairs']:
  if (pair['classId'],pair['right'],pair['left'],pair['grip'])==(g['classId'],g['rightGroup'],g['leftGroup'],g['grip']):pair['status']='review';pair['groupId']=g['id']
 print(g['classId']+': 14 poses + portrait',flush=True)

manifest['poseCountPerSet']=14
manifest['status']='Four first-pass group samples. Remaining weapon-group hand combinations are pending. Not integrated into gameplay.'
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(ROOT/'coverage.json').write_text(json.dumps(coverage,indent=2)+'\n')
(ROOT/'data.js').write_text('window.ART_DATA='+json.dumps({'manifest':manifest,'coverage':coverage})+';\n')
assert all(len(g['frames'])==14 for g in manifest['groups'])
for g in manifest['groups']:
 for frame in g['frames']:
  im=Image.open(ROOT/frame['file']);assert im.size==(512,512) and im.mode=='RGBA'
  assert im.getchannel('A').getextrema()==(0,255)
print('Verified 56 labeled RGBA WebP poses and four portraits.',flush=True)
import runpy
runpy.run_path(str(ROOT/'update-sequences.py'),run_name='__main__')
