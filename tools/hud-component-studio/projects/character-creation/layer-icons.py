from pathlib import Path
from PIL import Image,ImageDraw
import json
D=Path(__file__).resolve().parent;src=D/'assets/reference-component-atlas.png';im=Image.open(src)
boxes={'medallion-background':(58,72,354,364),'medallion-trim':(379,11,776,391),'symbol-book':(771,118,1169,318),'symbol-swords':(1199,58,1517,360),'symbol-helmet':(82,383,320,701),'symbol-star':(415,397,752,715),'symbol-pouch':(807,404,1099,716),'symbol-sun-rays':(1154,367,1531,760),'prop-coins':(75,786,359,972),'prop-leaf':(476,771,677,969),'prop-glint':(870,786,1036,945),'prop-gem':(1272,776,1421,966)}
s=json.loads((D/'scene.json').read_text());p=json.loads((D/'provenance.json').read_text())
for name,box in boxes.items():
 art=im.crop(box);art.save(D/'assets'/(name+'.png'));s['assets'][name]={'src':'assets/'+name+'.png','width':art.width,'height':art.height};p['assets'].append({'asset':name+'.png','source':'ImageGen isolated component atlas','sourcePath':str(src),'date':'2026-10-11','crop':list(box),'operation':'Alpha-connected component bounds with 2px padding; no hidden-layer recovery','promptSummary':'Separate reusable emerald medallion background, hollow antique-brass trim, unique feat symbols and independent props; transparent PNG, no text'})
# These centers are intentionally transparent in original source.
assert im.getchannel('A').getpixel((578,206))==0
assert im.getchannel('A').getpixel((1344,565))==0
recipes=[ [('symbol-book',21,51,68,41),('symbol-star',34,13,42,41)], [('symbol-swords',19,21,75,72)], [('symbol-helmet',28,15,56,78)], [('symbol-star',18,18,76,76)], [('symbol-pouch',28,27,62,68),('prop-coins',54,73,44,29)], [('symbol-sun-rays',19,19,75,76),('prop-leaf',40,39,32,34)]]
old=[];new=[]
for n in s['nodes']:
 if n['id'].startswith('feats-choice-art-') or n['id']=='feats-detail-art':
  i=int(n['id'].split('-')[-1]) if n['id'].startswith('feats-choice-art-') else 0
  g=dict(n);g.update(type='group',name='Feat emblem · reusable background / trim / symbols / props',fill='none');g.pop('asset',None);g.pop('fit',None);new.append(g)
  scale=min(n['width'],n['height'])/110;offsetx=(n['width']-110*scale)/2;offsety=(n['height']-110*scale)/2
  parts=[('medallion-background',14,14,82,82),('medallion-trim',0,0,110,110)]+recipes[i]
  for z,(a,x,y,w,h) in enumerate(parts):
   new.append(dict(id=n['id']+'-'+a,name=a.replace('-',' ').title(),type='image',parent=n['id'],x=offsetx+x*scale,y=offsety+y*scale,width=w*scale,height=h*scale,z=z,visible=True,locked=False,opacity=1,rotation=0,scaleX=1,scaleY=1,states={},asset=a,fit='contain'))
 else:old.append(n)
s['nodes']=old+new;s['metadata']['iconLayerContract']='Each feat emblem has reusable background and hollow brass trim plus independent symbol and prop PNG nodes. Original atlas emblems are reference-only.'
# Remove old flattened interactive asset IDs, keep files available as reference proof.
for a in list(s['assets']):
 if a.startswith('feat-'):s['assets'].pop(a)
(D/'scene.json').write_text(json.dumps(s,indent=2));(D/'provenance.json').write_text(json.dumps(p,indent=2))
# Exploded preview of independent first emblem parts and assembly.
out=Image.new('RGBA',(1000,370),(15,15,12,255));draw=ImageDraw.Draw(out)
for j,(label,ids) in enumerate([('Background',['medallion-background']),('Hollow trim',['medallion-trim']),('Symbols',['symbol-star','symbol-book']),('Assembly',['medallion-background','medallion-trim','symbol-star','symbol-book'])]):
 draw.text((j*250+22,18),label,fill='#e4d6b4');draw.rectangle((j*250+15,55,j*250+235,335),outline='#867246')
 for a,x,y,w,h in [('medallion-background',14,14,82,82),('medallion-trim',0,0,110,110)]+recipes[0]:
  if a in ids:
   art=Image.open(D/'assets'/(a+'.png')).resize((round(w*1.75),round(h*1.75)),Image.Resampling.LANCZOS);out.alpha_composite(art,(j*250+28+round(x*1.75),85+round(y*1.75)))
out.save(D/'exports/feat-layer-exploded.png')
