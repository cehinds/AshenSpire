"""Extract generated atlas components, normalize with shared scale, export WebP review assets."""
from pathlib import Path
from PIL import Image, ImageFilter, ImageDraw, ImageFont, ImageChops
from collections import deque
import json, math

ROOT=Path(__file__).resolve().parent
SOURCES=ROOT/'sources'
POSES=['STANCE']+[f'ATK-{i:02}' for i in range(1,8)]+['DEFEND','HURT','CAST']
DESCRIPTIONS=['Basic ready stance','Anticipation','Windup','Maximum windup','Release','Impact','Follow-through','Recovery','Braced defense','Hit recoil','Spell cast']
SPECS=[
 ('reaver','greatsword-twoHand','Greatsword · Two-handed','reaver-greatsword-atlas.png','greatsword',None),
 ('rogue','dagger-parryDagger','Dagger + Parrying Dagger','rogue-dagger-parryDagger-atlas.png','dagger','parryDagger'),
 ('starseer','ashStaff-empty','Ash Staff + Empty hand','starseer-ashStaff-empty-atlas.png','ashStaff',None),
 ('herald','straightSword-buckler','Straight Sword + Buckler','herald-straightSword-buckler-atlas.png','straightSword','buckler'),
]

COMPONENT_CROPS={}
def components(im):
 # Low-resolution connectivity joins antialiased paint islands without slicing weapons at grid edges.
 a=im.getchannel('A').resize((im.width//2,im.height//2),Image.Resampling.BOX)
 a=a.point(lambda v:255 if v>16 else 0).filter(ImageFilter.MaxFilter(3))
 w,h=a.size; data=bytearray(a.tobytes()); found=[]
 for k in range(w*h):
  if not data[k]:continue
  data[k]=0; q=deque([k]); minx=maxx=k%w; miny=maxy=k//w; count=0; pixels=[]
  while q:
   p=q.popleft();pixels.append(p);x=p%w;y=p//w;count+=1
   minx=min(minx,x);maxx=max(maxx,x);miny=min(miny,y);maxy=max(maxy,y)
   for n,valid in ((p-1,x>0),(p+1,x<w-1),(p-w,y>0),(p+w,y<h-1)):
    if valid and data[n]:data[n]=0;q.append(n)
  if count>500:
   box=(minx*2,miny*2,min(im.width,(maxx+1)*2),min(im.height,(maxy+1)*2));found.append(box)
   mask=bytearray(w*h)
   for p in pixels:mask[p]=255
   mask=Image.frombytes('L',(w,h),bytes(mask)).resize(im.size,Image.Resampling.NEAREST)
   isolated=im.copy();isolated.putalpha(ImageChops.multiply(im.getchannel('A'),mask))
   COMPONENT_CROPS[box]=isolated.crop(box)
 return found

def webp(im,path,quality=88):
 path.parent.mkdir(parents=True,exist_ok=True)
 im.save(path,'WEBP',quality=quality,method=3,exact=True)
 check=Image.open(path);check.load()
 assert check.size==im.size
 if im.mode=='RGBA':assert check.mode=='RGBA' and check.getchannel('A').getextrema()[0]==0
 return path.relative_to(ROOT).as_posix()

font_path=Path('C:/Windows/Fonts/segoeui.ttf')
font=ImageFont.truetype(str(font_path),18) if font_path.exists() else ImageFont.load_default()
groups=[]
for cls,kit,title,source,right,left in SPECS:
 im=Image.open(SOURCES/source).convert('RGBA');boxes=components(im)
 expected=11 if cls=='reaver' else 12
 if len(boxes)!=expected:raise RuntimeError(f'{cls}: expected {expected} components, found {len(boxes)}: {boxes}')
 # Generated rows share the same floor; order by component bottom, then x within each row.
 boxes.sort(key=lambda b:b[3]); ordered=[]
 for row in range(3):ordered.extend(sorted(boxes[row*4:(row+1)*4],key=lambda b:b[0]))
 crops=[COMPONENT_CROPS[box] for box in ordered]
 full=crops[:11];scale=min(440/max(c.width for c in full),440/max(c.height for c in full))
 directory=ROOT/'animations'/cls/kit;directory.mkdir(parents=True,exist_ok=True)
 frames=[];rows=[]
 for i,crop in enumerate(full):
  resized=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS)
  # Feet, not the weapon or cloak extent, determine the horizontal root.
  alpha=crop.getchannel('A'); foot=alpha.crop((0,max(0,crop.height-14),crop.width,crop.height)).getbbox()
  rootx=(foot[0]+foot[2])/2 if foot else crop.width/2
  x=round(256-rootx*scale);y=480-resized.height
  if x<8 or x+resized.width>504:x=max(8,min(x,504-resized.width))
  frame=Image.new('RGBA',(512,512));frame.alpha_composite(resized,(x,y));frames.append(frame)
  path=webp(frame,directory/f'{POSES[i]}.webp')
  rows.append({'id':POSES[i],'label':DESCRIPTIONS[i],'file':path,'sourceBox':ordered[i],'size':[512,512],'root':[256,480]})
 portrait=Image.open(SOURCES/'reaver-portrait.png').convert('RGBA') if cls=='reaver' else crops[11]
 portrait.thumbnail((512,512),Image.Resampling.LANCZOS)
 pc=Image.new('RGBA',(512,512));pc.alpha_composite(portrait,((512-portrait.width)//2,512-portrait.height))
 portrait_file=webp(pc,directory/'PORTRAIT.webp',92)
 sheet=Image.new('RGBA',(2048,1536))
 for i,fr in enumerate(frames+[pc]):sheet.alpha_composite(fr,((i%4)*512,(i//4)*512))
 atlas_file=webp(sheet,directory/'atlas.webp')
 frames[1].save(directory/'attack-preview.webp','WEBP',save_all=True,append_images=frames[2:8],duration=[110,110,100,85,95,110,180],loop=0,quality=88,method=3)
 preview=Image.new('RGB',(1200,1020),'#181a1e');draw=ImageDraw.Draw(preview)
 for i,fr in enumerate(frames+[pc]):
  x=(i%4)*300;y=(i//4)*340
  thumb=fr.resize((292,292),Image.Resampling.LANCZOS);preview.paste(thumb,(x+4,y+4),thumb)
  draw.text((x+12,y+299),POSES[i] if i<11 else 'PORTRAIT',font=font,fill='#ebd4a0')
  draw.text((x+12,y+320),cls.upper(),font=font,fill='#a6a9b4')
 webp(preview,directory/'labeled-sheet.webp',90)
 groups.append({'id':f'{cls}__{kit}','classId':cls,'title':title,'right':right,'left':left,'grip':'twoHand' if cls=='reaver' else 'oneHand','status':'review','portrait':portrait_file,'atlas':atlas_file,'preview':(directory/'attack-preview.webp').relative_to(ROOT).as_posix(),'sheet':(directory/'labeled-sheet.webp').relative_to(ROOT).as_posix(),'frames':rows,'notes':['Generated first-pass art; needs visual review for hand allocation, pose continuity and anatomy before game integration.']})
 print(f'{cls}: {len(rows)} labeled frames, portrait, atlas, animation and labeled sheet')

map_file=webp(Image.open(SOURCES/'bellfoundry-map.png'),ROOT/'maps/bellfoundry.webp',90)
webp(Image.open(SOURCES/'reaver-idle.png'),ROOT/'characters/reaver-idle.webp',90)
manifest={'schema':'ashenspire/art-review/v1','generator':'built-in image_gen','frameSize':[512,512],'groups':groups,'maps':[{'id':'bellfoundry','file':map_file}],'status':'First production batch; full pairing coverage remains pending.'}
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
coverage=json.loads((ROOT/'coverage.json').read_text())
for pair in coverage['pairs']:
 for g in groups:
  if g['grip']=='oneHand' and (pair['classId'],pair['right'],pair['left'])==(g['classId'],g['right'],g['left']):pair['status']='review';pair['groupId']=g['id']
(ROOT/'coverage.json').write_text(json.dumps(coverage,indent=2)+'\n')
(ROOT/'data.js').write_text('window.ART_DATA='+json.dumps({'manifest':manifest,'coverage':coverage})+';\n')
print('WebP export verified.')
