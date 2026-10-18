"""Export one revision-six atlas, or assemble its manifest without touching A–P.
Only ImageMagick crop/resize/pad is used; source pixels are never repainted here.
"""
import argparse, copy, hashlib, importlib.util, json, subprocess
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage
ROOT=Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--family',choices=list('QRSTUVWXYZ'));args=p.parse_args()
data=json.loads((ROOT/'cutout-manifest.json').read_text())
sources=json.loads((ROOT/'generation-sources-v6.json').read_text())
spec=importlib.util.spec_from_file_location('exporter',ROOT/'export-cutouts.py');exporter=importlib.util.module_from_spec(spec);spec.loader.exec_module(exporter)
families={
 'Q':('Broken swords','J','A','attack',0), 'R':('Broken hammers','K','D','smash',3),
 'S':('Broken shields','M','E','defend',1), 'T':('Ruined spellbooks','I','I','spell',5),
 'U':('Sweep scythes','L','C','sweep',4), 'V':('Magic scepters',None,'I','spell',5),
 'W':('Broken scythes','L','C','sweep',4), 'X':('Broken scimitars','B','B','sweep',4),
 'Y':('Ethereal melee','V','Y','spell',5), 'Z':('Ranged projectiles','V','Z','spell',5),
}
broken=set('QRSTWX')
weapon_names=['Sword','Hammer','Scythe','Scimitar','Shield ward']
elements=['Divine','Necrotic','Force','Earth','Frost','Fire','Lightning','Psychic','Alteration','Wind']
def save(path,value):path.write_text(json.dumps(value,indent=2)+'\n')
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def refs(action):return copy.deepcopy(next(t['references'] for t in data['cardTypes'] if t['id']==action))
if args.family:
 letter=args.family;label,parent,fx,action,bg=families[letter];kind='effect' if letter in 'YZ' else 'object'
 sheet=Path(sources[letter]['path']);im=Image.open(sheet).convert('RGBA');w,h=im.size
 assert im.getchannel('A').getextrema()[0]==0
 boxes=None
 if kind=='object':
  labels,count=ndimage.label(np.asarray(im.getchannel('A'))>8);sizes=np.bincount(labels.ravel());sizes[0]=0
  largest=np.argsort(sizes)[-10:];assert sizes[largest].min()>500
  slices=ndimage.find_objects(labels)
  boxes=[(slices[n-1][1].start,slices[n-1][0].start,slices[n-1][1].stop,slices[n-1][0].stop) for n in largest]
  boxes.sort(key=lambda b:(b[1]+b[3])/2);boxes=sorted(boxes[:5],key=lambda b:b[0])+sorted(boxes[5:],key=lambda b:b[0])
 assets={}
 for i in range(10):
  x,y,right,bottom=round(i%5*w/5),round(i//5*h/2),round((i%5+1)*w/5),round((i//5+1)*h/2)
  cell={'x':x,'y':y,'width':right-x,'height':bottom-y}
  if kind=='effect':
   cell_alpha=np.asarray(im.getchannel('A'))[y:bottom,x:right]
   rows,cols=np.where(cell_alpha>8)
   bx,by,br,bb=max(0,int(cols.min())-8),max(0,int(rows.min())-8),min(right-x,int(cols.max())+9),min(bottom-y,int(rows.max())+9)
   x,y,right,bottom=x+bx,y+by,x+br,y+bb
  if boxes:
   bx,by,br,bb=boxes[i];x,y,right,bottom=max(0,bx-2),max(0,by-2),min(w,br+2),min(h,bb+2)
  out=ROOT/'cutouts'/letter/(kind+'s')/f'{i}.png';out.parent.mkdir(parents=True,exist_ok=True)
  subprocess.run(['magick',str(sheet),'-crop',f'{right-x}x{bottom-y}+{x}+{y}','+repage','-trim','+repage','-resize','448x448','-background','none','-gravity','center','-extent','512x512','-define','png:color-type=6','-define','png:exclude-chunk=date,time',str(out)],check=True)
  png=Image.open(out).convert('RGBA');alpha=png.getchannel('A');bounds=list(alpha.getbbox());assert bounds[0]>=30 and bounds[1]>=30 and bounds[2]<=482 and bounds[3]<=482
  name=f'{label} {i}'
  if letter=='Y':name=f'{weapon_names[i%5]} · {"blue" if i<5 else "violet"} ethereal extension'
  if letter=='Z':name=f'{elements[i]} projectile'
  reference_letter=letter if letter in 'QRSTVWX' else 'W' if letter=='U' else 'V'
  source_ref=f'source-art-v6/{reference_letter}-reference.png'
  t=exporter.transform(kind)
  a={'id':f'{letter}.{kind}.{i}','kind':kind,'category':letter,'digit':i,'name':name,'src':out.relative_to(ROOT).as_posix(),'mimeType':'image/png','width':512,'height':512,'hasTransparency':True,'alphaBounds':bounds,'sha256':digest(out),'defaultTransform':t,'css':exporter.css(t),'combatReferences':refs(action),'suggestedCardTypes':[action],
   'references':{'method':'image-edit-derived-variant','sourceReference':source_ref,'referenceSha256':digest(ROOT/source_ref),'sourceFile':sheet.name,'sourceSha256':digest(sheet),'sourceCell':cell,'extractionCrop':{'x':x,'y':y,'width':right-x,'height':bottom-y},'fidelity':'Generated variant referenced to existing artwork; not a pixel-identical edit.'}}
  if parent:
   a['references']['baseAssetId']=f'{parent}.object.{i}'
   if parent!='V':a['references']['baseAssetSha256']=data['assets'][f'{parent}.object.{i}']['sha256']
  if letter in broken:a.update(condition='broken',intactAssetId=f'{parent}.object.{i}')
  if letter=='V':
   a['anchors']={'stoneHead':{'x':.74,'y':.27}};a['references']['repositorySources']=['docs/design/rear-weapon-views-2026-10-06/assets/weapon-emberlightSceptre.png','docs/design/rear-weapon-views-2026-10-06/assets/weapon-boneSceptre.png']
  if letter in 'YZ':
   pixels=np.asarray(png).astype(float);core=pixels[:,:,:3].max(2)*pixels[:,:,3]/255>(150 if letter=='Y' else 60)
   ay,ax=np.where(core);projection=ax-ay;tail=projection<=np.quantile(projection,.015)
   a['anchors']={'emissionRoot':{'x':round(float(ax[tail].mean()/512),6),'y':round(float(ay[tail].mean()/512),6)}};a['magicRole']='ethereal-melee' if letter=='Y' else 'ranged-projectile'
   if letter=='Y':a['weaponShape']=weapon_names[i%5].lower();a['suggestedCardTypes']=[['attack','smash','sweep','sweep','defend'][i%5],'spell']
   else:a['elementProposal']=elements[i].lower()
  assets[a['id']]=a
 save(ROOT/'cutouts'/letter/'assets.json',assets)
 print(f'Exported and alpha-checked {letter}: ten {kind}s.');raise SystemExit()

for letter in families:data['assets'].update(json.loads((ROOT/'cutouts'/letter/'assets.json').read_text()))
catalog=json.loads((ROOT/'art-catalog.json').read_text())['bindings']['tags']
for letter,(_,_,_,action,_) in families.items():
 for a in [a for a in data['assets'].values() if a['category']==letter]:
  tags=[f'maneuver:{action}'] if f'maneuver:{action}' in catalog else []
  if letter in 'VYZ':tags=['source:spell','fx:magic']+(['delivery:melee'] if letter=='Y' else ['range:ranged'] if letter=='Z' else [])
  if letter=='Y':tags.append('maneuver:'+['attack','smash','sweep','sweep','defend'][a['digit']%5])
  if letter=='Z':
   element=a['elementProposal'];element_tag=next((k for k in [f'school:{element}',f'damage:{element}'] if k in catalog),None)
   if element_tag:tags.append(element_tag)
   else:a['elementMappingNote']='Visual proposal; no matching element tag exists in the pinned catalog. Uses existing spell/magic/ranged identities.'
  a['tagReferences']=[{'id':tag,'binding':catalog[tag]} for tag in tags if tag in catalog]
 save(ROOT/'cutouts'/letter/'assets.json',{k:a for k,a in data['assets'].items() if a['category']==letter})
data['categories']=[c for c in data['categories'] if c['letter'] not in families]
for letter,(label,parent,fx,action,bg) in families.items():
 c={'letter':letter,'id':label.lower().replace(' ','-'),'label':label,'revision':6,'references':refs(action),'objectIds':[f'{"V" if letter in "YZ" else letter}.object.{i}' for i in range(10)],'effectIds':[f'{fx}.effect.{i}' for i in range(10)],'backgroundId':f'background.{bg}','exampleCodes':[f'{letter}{i}{i}' for i in range(10)]}
 if letter in 'YZ':c['magicMode']='melee' if letter=='Y' else 'ranged'
 if letter in broken:c['condition']='broken';c['intactFamily']=parent
 data['categories'].append(c)
 for i in range(10):
  for j in range(10):
   code=f'{letter}{i}{j}';comp=copy.deepcopy(data['compositions']['A00']);comp.update(code=code,category=letter,objectDigit=i,effectDigit=j)
   layers={l['id']:l for l in comp['layers']};layers['object'].update(assetId=c['objectIds'][i],overrides={});layers['background']['assetId']=c['backgroundId']
   for id in ['backEffect','foreground']:layers[id].update(assetId=c['effectIds'][j],overrides={'opacity':.32 if id=='backEffect' else .3})
   if letter in 'YZ':
    layers['object']['overrides']={'x':165,'y':440,'width':300,'height':300,'rotationDeg':0}
    layers['backEffect']['visible']=False
    layers['foreground']['overrides']={'width':320,'height':320,'rotationDeg':0,'opacity':.78,'blendMode':'screen'}
    layers['foreground']['attachment']={'enabled':True,'parentLayer':'object','parentAnchor':'stoneHead','selfAnchor':'emissionRoot','referenceParentSize':300,'offset':{'x':0 if letter=='Y' else 24,'y':0 if letter=='Y' else -24}}
    comp['magicMode']=c['magicMode']
   data['compositions'][code]=comp
for t in data['cardTypes']:
 additions=[letter for letter,(_,_,_,action,_) in families.items() if action==t['id']]
 t['objectFamilies']=list(dict.fromkeys(t['objectFamilies']+[l for l in additions if l not in 'YZ']))
 if t['id']=='sweep':t['preferredObjectFamily']='U';t['proposal']='Scythe for Sweep; U is the intact preferred set and W provides broken counterparts of L. Earlier scimitars remain alternatives.'
 if t['id']=='spell':t['preferredObjectFamily']='V';t['exampleCodes']=['Y00','Y11','Y22','Z00','Z55','Z66'];t['proposal']='Scepter for magic: a separate ethereal melee weapon emerges from its stone, or a separate projectile fires from it. Books remain alternative spell objects.'
data['revision']=6
data['references']['expansionCatalog']='expansion-v6.json'
data['scope'].update(confirmed='Eighty additional objects, plus ten ethereal melee and ten projectile overlays. Scythes for Sweep; scepters for magic. Earlier A–P IDs preserved.',latestBatchObjectCount=80,physicalObjectCount=212,totalObjectCountIncludingFire=222,effectFileCount=120,totalPngCount=362,categoryCount=26)
for key in ['latestBatchReconstructedComponentCount','latestBatchUnchangedObjectCount']:data['scope'].pop(key,None)
data['scope']['objectsPerCategory']={c['letter']:len(c['objectIds']) for c in data['categories']};data['scope']['exampleCombinationsPerCategory']={c['letter']:len(c['exampleCodes']) for c in data['categories']}
data['codeScheme']['magic']='Yxy: scepter x and ethereal weapon y. Zxy: same scepter x and projectile y. V owns the standalone scepter PNGs. 0 is a real variant. Attachments do not combine the PNG files.'
data['attachmentContract']={'coordinates':'Normalized 0–1 points inside the PNG canvas. Parent stoneHead attaches to effect emissionRoot.','transform':'Parent position, rotation, scale and contained image size propagate through a 2D affine matrix. Child rotation is relative to the parent; x/y editing detaches for free placement.','rangedOffset':'Offset is in unrotated parent coordinates at referenceParentSize; projectile has a small forward gap.','implementation':'layer-math.js','scope':'Art compositor only; no gameplay tags or runtime mechanics are added.'}
save(ROOT/'cutout-manifest.json',data);(ROOT/'cutouts-data.js').write_text('window.CARD_CUTOUT_DATA = '+json.dumps(data,separators=(',',':'))+';\n')
save(ROOT/'expansion-v6.json',{'revision':6,'sourceCommit':'2a8488bf493c5aa07259209f631a02a41b0526d4','families':[{ 'letter':l,'label':r[0],'baseFamily':r[1],'effectFamily':r[2],'cardType':r[3]} for l,r in families.items()],'preferredArt':{'sweep':'U','magicBase':'V','magicMelee':'Y','magicRanged':'Z'},'brokenMeaning':'Visual condition only. Does not create a broken gameplay status.','elementNames':elements,'sourcePolicy':'Reuse existing components and repository scepter references; keep original PNGs unchanged. New variants are generated edits.','counts':{'objects':80,'effects':20,'newCompositions':1000}})
print(f'Assembled revision 6: {len(data["assets"])} PNGs and {len(data["compositions"])} compositions.')
