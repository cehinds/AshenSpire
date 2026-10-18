"""Generate reflowed design studies and reusable component scenes from desktop seeds."""
from pathlib import Path
import json,copy,re,hashlib
D=Path(__file__).resolve().parent
pages=['class','attributes','keepsake','equipment','feats','spells','review']
def load(f):return json.loads((D/f).read_text())
def save(f,s):(D/f).write_text(json.dumps(s,indent=2)+'\n')
def add(s,id,t,parent,x,y,w,h,**kw):
 n=dict(id=id,name=id.replace('-',' ').title(),type=t,parent=parent,x=x,y=y,width=w,height=h,z=kw.pop('z',1),visible=True,locked=False,opacity=1,rotation=0,scaleX=1,scaleY=1,states={});n.update(kw);s['nodes'].append(n);return n

def reflow(seed,non=False):
 s=copy.deepcopy(seed);B={n['id']:n for n in s['nodes']};N=s['nodes'];heights={};s['title']='AshenSpire · Mobile '+('Reaver' if non else 'caster')+' concept';s['canvas'].update(width=390,height=2500);s['metadata']['formFactor']='mobile';s['metadata']['layout']='390px reflow; page scenes crop to full scroll height; no desktop group scaling'
 def resize(g,w,h):
  g['width']=w;g['height']=h
  for n in N:
   if n['parent']==g['id'] and n['type'] in ['image','rect'] and ('surface' in n['id'] or 'background' in n['id'] or 'outline' in n['id']):n.update(width=w,height=h)
 def settext(id,x,y,w,size=None):
  if id not in B:return
  n=B[id];n.update(x=x,y=y,width=w)
  if size:n['fontSize']=size;n['height']=max(40,len(str(n.get('text','')).split('\n'))*size*1.3)
 def button(id,x,y,w,h=48):
  g=B[id];g.update(x=x,y=y);resize(g,w,h)
  for n in N:
   if n['parent']==id and n['type']=='text':n.update(x=12,y=16,width=w-24,fontSize=16,height=30)
 for state in s['states']:
  p=state['id'];g=B[p+'-page'];g['width']=390;g['height']=2500
  head=B[p+'-header'];resize(head,390,86);B[p+'-header-base'].update(width=390,height=86)
  settext(p+'-title',14,12,355,25);settext('review-header-identity' if p=='review' else p+'-identity',14,49,355,16)
  for id in [p+'-top-1190',p+'-top-1260',p+'-top-1345']:B[id]['visible']=False
  nav=B[p+'-navigation'];nav.update(x=12,y=98,width=366,height=216);B[p+'-rail']['visible']=False
  order=[a['id'] for a in s['states']]
  for i,q in enumerate(order):button(p+'-nav-'+q,(i%2)*188,(i//2)*54,178)
  if p+'-nav-spells-qualifier' in B:B[p+'-nav-spells-qualifier']['visible']=False
  intro=B[p+'-intro'];intro.update(x=18,y=337,width=354,height=125)
  settext(p+'-eyebrow',0,0,354,14);settext(p+'-heading',0,29,354,28);settext(p+'-subheading',0,93,354,16)
  content=B[p+'-content'];content.update(x=18,y=477,width=354,height=1600)
  footer=B[p+'-footer'];resize(footer,390,80);B[p+'-footer-base'].update(width=390,height=80);button(p+'-back',12,16,102);button(p+'-next',126,16,252)
  for n in N:
   if n['parent']==p+'-next' and n['type']=='text':n['fontSize']=16
  end=477
  if p=='class':
   for i,c in enumerate(['reaver','starseer','rogue','herald']):
    card=B[c+'-class-card'];card.update(x=0,y=i*195);resize(card,354,179);B[c+'-art'].update(x=10,y=12,width=111,height=153);settext(c+'-name',135,24,202,24);settext(c+'-style',135,66,202,16);settext(c+'-role',135,139,202,16)
   detail=B['class-summary'];detail.update(x=0,y=795);resize(detail,354,402);settext('class-selected-heading',22,22,310,27);settext('class-description',22,72,310,16);settext('class-stat-line',22,132,310,16);B['class-keepsake-art'].update(x=22,y=180,width=100,height=100);settext('class-keepsake',22,297,310,22);settext('class-next-hint',22,354,310,16);end=477+1197
  elif p=='attributes':
   # Name and mode controls belong to a distinct identity/form component on phone.
   field=B['attributes-name-field'];field.update(x=18,y=477,width=354)
   for n in N:
    if n['parent']==field['id'] and n['type'] in ['image','rect']:n['width']=354
   settext('attributes-name-field-label',0,0,354,14);settext('attributes-name-field-value',15,36,324,16)
   tabs=B['attributes-mode-tabs'];tabs.update(x=18,y=567,width=354,height=48)
   resize(B['attributes-mode-standard'],171,48);resize(B['attributes-mode-assign'],171,48);B['attributes-mode-assign']['x']=183
   content['y']=633
   allocation=B['attribute-allocation'];allocation.update(x=0,y=0);resize(allocation,354,468);settext('attribute-points-heading',18,20,318,23)
   for i,old in enumerate(['Might','Agility','Vitality','Intellect','Will']):
    row=B['attribute-'+old.lower()];row.update(x=14,y=70+i*75);resize(row,326,63);settext(old+'-label',14,19,242,18);settext(old+'-value',278,19,35,20)
   detail=B['attribute-impact'];detail.update(x=0,y=484);resize(detail,354,402);settext('attribute-impact-title',20,22,314,25);settext('attribute-impact-body',20,85,314,17);settext('attribute-concept-note',20,302,314,16);end=633+886
  elif p in ['keepsake','equipment','feats']:
   count=6 if p=='feats' else (4 if p=='keepsake' or non else 3)
   for i in range(count):
    card=B[p+'-choice-'+str(i)];card.update(x=0,y=i*165);resize(card,354,150)
    art=B[p+'-choice-art-'+str(i)];art.update(x=12,y=17,width=112,height=112)
    if art['type']=='group':
     oldw=105 if p=='feats' else 112;oldh=117 if p=='feats' else 112
     # Reflow emblem from canonical normalized 110px composition: children scale individually.
     for child in N:
      if child['parent']==art['id']:
       child['x']*=112/105;child['y']=(child['y']-6)*112/105;child['width']*=112/105;child['height']*=112/105
    settext(p+'-choice-label-'+str(i),139,26,200,22);settext(p+'-choice-description-'+str(i),139,78,200,16)
   det=B[p+'-details'];det.update(x=0,y=count*165+8);resize(det,354,443);B[p+'-detail-art'].update(x=93,y=20,width=168,height=180)
   if B[p+'-detail-art']['type']=='group':
    art=B[p+'-detail-art'];factor=168/215
    for child in N:
     if child['parent']==art['id']:child['x']*=factor;child['y']=(child['y']-0)*factor;child['width']*=factor;child['height']*=factor
   settext(p+'-detail-name',20,223,314,26);B[p+'-detail-divider'].update(x=24,y=268,width=306,height=18);settext(p+'-detail-description',20,304,314,17)
   if p=='feats':settext('feat-rules-undecided',18,458,354,14);B['feat-rules-undecided']['text']='Concept · starting-feat rules to be decided'
   end=477+count*165+451
  elif p=='spells':
   settext('spells-selection-count',0,135,354,17);content['y']=510
   for i in range(3):
    card=B['spell-card-'+str(i)];card.update(x=0,y=i*490);resize(card,354,471)
    B[card['id']+'-art'].update(x=12,y=12,width=330,height=314);B[card['id']+'-trim'].update(width=354,height=471);B[card['id']+'-background'].update(width=354,height=471)
    B[card['id']+'-rank-background'].update(x=129,y=315,width=96,height=32);settext(card['id']+'-rank-text',150,324,74,15);settext(card['id']+'-title',20,365,314,24);settext(card['id']+'-description',20,414,314,17)
   settext('spells-selected-summary',0,1487,354,17);B['spells-selected-summary']['text']='Selected: Comet Fragment\nChoose one more spell.'
   det=B['spells-details'];det.update(x=0,y=1580);resize(det,354,420);B['spells-detail-art'].update(x=83,y=18,width=188,height=210);settext('spells-detail-name',20,249,314,26);B['spells-detail-divider'].update(x=24,y=294,width=306,height=18);settext('spells-detail-description',20,334,314,17);end=510+2000
  elif p=='review':
   identity=B['review-identity'];identity.update(x=0,y=0);resize(identity,354,193);B['review-portrait'].update(x=12,y=13,width=116,height=163);settext('review-name',145,27,194,25);settext('review-class',145,75,194,19);settext('review-style',145,114,194,16)
   labels=['attributes','keepsake','equipment','feats']+([] if non else['spells'])
   for i,label in enumerate(labels):
    row=B['review-'+label];row.update(x=0,y=210+i*114);resize(row,354,100);settext('review-'+label+'-label',16,15,262,19);settext('review-'+label+'-value',16,50,262,16);settext('review-'+label+'-edit',296,32,48,16)
    add(s,'review-'+label+'-edit-target','rect',row['id'],288,20,52,48,fill='none',stroke='#786443',strokeWidth=1,z=.5)
   settings=B['review-run-settings'];settings.update(x=0,y=210+len(labels)*114+18,width=354,height=284)
   for i,label in enumerate(['journey','seed','destination']):
    field=B['review-'+label];field.update(x=0,y=i*88,width=354)
    for child in N:
     if child['parent']==field['id'] and child['type'] in ['image','rect']:child['width']=354
    settext(field['id']+'-label',0,0,354,14);settext(field['id']+'-value',15,36,324,16)
   end=477+settings['y']+284
  height=end+108;heights[p]=height;g['height']=height;footer['y']=height-80
 # Default phone navigation is compact; full steps remain an independent editable expanded component.
 for index,state in enumerate(s['states']):
  p=state['id'];nav=B[p+'-navigation'];grid=add(s,p+'-expanded-navigation','group',nav['id'],0,0,366,216,fill='none',visible=False);grid['name']=p.title()+' / expanded all-steps grid'
  for n in list(N):
   if n['parent']==nav['id'] and n['id']!=grid['id']:n['parent']=grid['id']
  nav['height']=56
  current=add(s,p+'-current-step','group',nav['id'],0,0,198,48,fill='none');add(s,current['id']+'-background','rect',current['id'],0,0,198,48,fill='#163e2b',stroke='#72ce94',strokeWidth=1,radius=4)
  add(s,current['id']+'-label','text',current['id'],12,16,174,32,text=str(index+1)+' of '+str(len(s['states']))+' · '+p.title(),fontSize=16,fontFamily='Arial',fill='#e7dec8')
  allsteps=add(s,p+'-all-steps-control','group',nav['id'],210,0,156,48,fill='none');add(s,allsteps['id']+'-background','image',allsteps['id'],0,0,156,48,asset='soot-material');add(s,allsteps['id']+'-trim','image',allsteps['id'],0,0,156,48,asset='panel-frame');add(s,allsteps['id']+'-label','text',allsteps['id'],12,16,132,32,text='All steps  ▾',fontSize=16,fontFamily='Arial',fill='#e7dec8')
  for n in N:
   if n['parent']==p+'-page' and n['id'] not in [p+'-header',p+'-navigation']:n['y']-=168
  heights[p]-=168;B[p+'-page']['height']=heights[p]
 s['canvas']['height']=max(heights.values());s['metadata']['pageHeights']=heights;s['metadata']['mobileNavigation']='Compact current-step/default; expanded all-steps grid is a separate editable component. Static design states, not implemented runtime navigation.'
 # Mobile text boxes reserve actual wrapped height; the renderer performs measured wrapping.
 for n in s['nodes']:
  if n['type']=='text':n['height']=max(n['height'],n.get('fontSize',16)*1.35*max(1,len(n.get('text','').split('\n'))))
 return s

def wrapper(s,id,children,name=None):
 B={n['id']:n for n in s['nodes']};ids=[i for i in children if i in B]
 if not ids:return
 ns=[B[i] for i in ids];p=ns[0]['parent'];x=min(n['x'] for n in ns);y=min(n['y'] for n in ns);w=max(n['x']+n['width'] for n in ns)-x;h=max(n['y']+n['height'] for n in ns)-y
 g=add(s,id,'group',p,x,y,w,h,fill='none',z=min(n['z'] for n in ns));g['name']=name or id.replace('-',' ').title()
 for n in ns:n['parent']=id;n['x']-=x;n['y']-=y

def deepen(s):
 # Split fill and stroke, so material/background and border remain independent.
 for n in list(s['nodes']):
  if n['type']=='rect' and n.get('fill') not in [None,'none','transparent'] and n.get('stroke') not in [None,'none','transparent']:
   trim=copy.deepcopy(n);trim.update(id=n['id']+'-trim',name=n['name']+' · independent trim',fill='none',z=n['z']+.1);n['stroke']='none';n['name']+=' · background';s['nodes'].append(trim)
 for st in s['states']:
  p=st['id']
  for section in ['header','navigation','intro','content','footer']:
   next(n for n in s['nodes'] if n['id']==p+'-'+section)['name']=p.title()+' / '+section.title()
 if any(n['id']=='feat-rules-undecided' for n in s['nodes']):wrapper(s,'feats-rules-note',['feat-rules-undecided'],'Feats / rules pending note')
 if any(n['id']=='spells-selected-summary' for n in s['nodes']):wrapper(s,'spells-selected-spells',['spells-selected-summary'],'Spells / selected spell summary')
 for old in ['Might','Agility','Vitality','Intellect','Will']:
  wrapper(s,'attribute-'+old.lower()+'-label-control',[old+'-label']);wrapper(s,'attribute-'+old.lower()+'-value-control',[old+'-value'])
 wrapper(s,'attributes-identity-form',['attributes-name-field','attributes-mode-tabs'],'Attributes / identity and mode form')
 wrapper(s,'attributes-impact-heading',['attribute-impact-title']);wrapper(s,'attributes-impact-body',['attribute-impact-body']);wrapper(s,'attributes-derived-stats',['attribute-concept-note'])
 for label in ['attributes','keepsake','equipment','feats','spells']:
  wrapper(s,'review-'+label+'-heading',['review-'+label+'-label']);wrapper(s,'review-'+label+'-body',['review-'+label+'-value']);wrapper(s,'review-'+label+'-edit-control',['review-'+label+'-edit','review-'+label+'-edit-target'])
 for i in range(3):
  base='spell-card-'+str(i)
  wrapper(s,base+'-artwork',[base+'-art']);wrapper(s,base+'-header',[base+'-cost-medallion',base+'-cost-number']);wrapper(s,base+'-body',[base+'-title',base+'-description']);wrapper(s,base+'-rank',[base+'-rank-background',base+'-rank-background-trim',base+'-rank-text'])
 return s

def subtree(s,root):
 ids={root};changed=True
 while changed:
  old=len(ids);ids.update(n['id'] for n in s['nodes'] if n['parent'] in ids);changed=old!=len(ids)
 return [copy.deepcopy(n) for n in s['nodes'] if n['id'] in ids]
def extracted(s,root,state,title,height=None):
 N=subtree(s,root);r=next(n for n in N if n['id']==root);r.update(parent=None,x=0,y=0,visible=True,states={})
 for n in N:
  n.update(n.get('states',{}).get(state,{}));n['states']={}
 ids={n['asset'] for n in N if n['type']=='image'}
 return dict(version=1,title=title,canvas=dict(width=max(1,round(r['width'])),height=max(1,round(height or r['height'])),background=s['canvas']['background'] if root.endswith('-page') else 'transparent'),defaultState=state,states=[{'id':state,'name':state.title()}],assets={id:s['assets'][id] for id in sorted(ids)},nodes=N,metadata={'componentSource':root,'sourceState':state,'designOnly':True})

caster=load('source-desktop.json');non=load('source-desktop-noncaster.json');mobile=reflow(caster);mobile_non=reflow(non,True)
scenes={'desktop':deepen(caster),'desktop-noncaster':deepen(non),'mobile':deepen(mobile),'mobile-noncaster':deepen(mobile_non)}
scene_files={'desktop':'scene.json','desktop-noncaster':'scene-noncaster.json','mobile':'scene-mobile.json','mobile-noncaster':'scene-mobile-noncaster.json'}
manifest={'version':1,'title':'AshenSpire · Character creation component library','assetsBase':'assets/','scenes':[],'pages':[],'components':[],'definitions':[],'notes':['Design-only; feat starting budget remains undecided.','Spells only for caster classes or spell-tagged classes. Noncaster scenes omit Spells.','Mobile canvas is390px reflow; individual page scenes crop to full scroll height.']}
render=[];definitions={}
for variant,s in scenes.items():
 save(scene_files[variant],s);mobileflag=variant.startswith('mobile');context='noncaster' if 'noncaster' in variant else'caster';manifest['scenes'].append({'id':variant,'title':variant.replace('-',' ').title(),'src':scene_files[variant],'formFactor':'mobile' if mobileflag else'desktop','classContext':context})
 B={n['id']:n for n in s['nodes']}
 for state in s['states']:
  page=state['id'];root=page+'-page';h=s.get('metadata',{}).get('pageHeights',{}).get(page,s['canvas']['height']);file='page-'+page+'-'+variant+'.json';out=extracted(s,root,page,page.title()+' · '+variant,h);save(file,out)
  preview='exports/'+page+'-'+variant+'.png';wire='exports/'+page+'-'+variant+'-wireframe.png'
  manifest['pages'].append({'id':page+'-'+variant,'pageId':page,'title':page.title(),'scene':variant,'sourceScene':scene_files[variant],'state':page,'src':file,'preview':preview,'wireframe':wire,'width':out['canvas']['width'],'height':out['canvas']['height'],'classContext':context,'formFactor':'mobile' if mobileflag else'desktop'})
  if mobileflag:
   manifest['pages'][-1]['viewport']=preview.replace('.png','-viewport.png');manifest['pages'][-1]['previewSource']='Studio full view PNG export';render.append({'src':file,'preview':preview,'wireframe':wire})
  else:
   # Desktop original exports remain unchanged; new catalog names share copied original preview.
   import shutil
   if context=='caster':shutil.copy(D/'exports'/(page+'.png'),D/preview);shutil.copy(D/'exports'/(page+'-wireframe.png'),D/wire)
   else:render.append({'src':file,'preview':preview,'wireframe':wire})
 # Record every leaf and nested group in hierarchy; group scenes are standalone editable scenes.
 for n in s['nodes']:
  ancestry=n;page=None
  while ancestry:
   if ancestry['id'].endswith('-page'):page=ancestry['id'][:-5];break
   ancestry=B.get(ancestry['parent'])
  if page is None:continue
  cid=variant+'--'+n['id'];record={'id':cid,'name':n['name'],'type':n['type'],'parent':variant+'--'+n['parent'] if n['parent'] else None,'page':page,'scene':variant,'sourceScene':scene_files[variant],'state':page,'rootNodeId':n['id'],'width':n['width'],'height':n['height'],'category':n['type']}
  if n['type']=='group' and not n['id'].endswith('-page'):
   file='component-'+cid+'.json';out=extracted(s,n['id'],page,n['name']);save(file,out);record['src']=file;record['preview']='exports/components/'+cid+'.png';record['wireframe']='exports/components/'+cid+'-wireframe.png'
   # Pixel-identical reusable components share canonical definition signature.
   sig=[];idx={v['id']:i for i,v in enumerate(out['nodes'])}
   for v in out['nodes']:
    c={k:a for k,a in v.items() if k not in ['id','name','parent','states']};c['parent']=idx.get(v['parent']);sig.append(c)
   hash=hashlib.sha256(json.dumps(sig,sort_keys=True).encode()).hexdigest()[:16];record['definitionId']='definition-'+hash
   if hash not in definitions:
    definitions[hash]={'id':record['definitionId'],'name':n['name'],'src':file,'preview':record['preview'],'width':out['canvas']['width'],'height':out['canvas']['height'],'rootNodeId':n['id']};render.append({'src':file,'preview':record['preview'],'wireframe':record['wireframe']})
   else:
    (D/file).unlink();record['src']=definitions[hash]['src'];record['preview']=definitions[hash]['preview'];record['definitionRootNodeId']=definitions[hash]['rootNodeId'];record.pop('wireframe',None)
  elif n['type']=='image':record['asset']=n['asset'];record['preview']=s['assets'][n['asset']]['src']
  manifest['components'].append(record)
manifest['definitions']=list(definitions.values())
# Dedicated assign-row reusable control; Standard page values remain read-only.
a={'version':1,'title':'Assign attribute row · reusable control','canvas':{'width':354,'height':84,'background':'transparent'},'defaultState':'assign-row','states':[{'id':'assign-row','name':'Assign row'}],'assets':{id:caster['assets'][id] for id in ['soot-material','panel-frame']},'nodes':[],'metadata':{'designOnly':True,'standardMode':'No allocation controls on Standard pages','budget':'Existing gameplay allocation rules; no new budget proposed'}}
add(a,'assign-row','group',None,0,0,354,84,fill='none');add(a,'assign-row-background','image','assign-row',0,0,354,84,asset='soot-material');add(a,'assign-row-trim','image','assign-row',0,0,354,84,asset='panel-frame')
for id,x,label,w in [('label',14,'Intelligence',167),('minus',190,'−',48),('value',243,'3',34),('plus',286,'+',48)]:
 g=add(a,'assign-row-'+id,'group','assign-row',x,18,w,48,fill='none')
 if id in ['minus','plus']:add(a,g['id']+'-background','rect',g['id'],0,0,w,48,fill='#171510');add(a,g['id']+'-trim','rect',g['id'],0,0,w,48,fill='none',stroke='#806b42',strokeWidth=1)
 add(a,g['id']+'-label','text',g['id'],12 if id in ['minus','plus'] else 0,15,w,32,text=label,fontSize=18,fontFamily='Arial',fill='#e7dec8')
save('component-assign-attribute-row.json',a);manifest['definitions'].append({'id':'assign-attribute-row','name':'Assign attribute row · label/value/minus/plus','src':'component-assign-attribute-row.json','preview':'exports/components/assign-attribute-row.png','width':354,'height':84});render.append({'src':'component-assign-attribute-row.json','preview':'exports/components/assign-attribute-row.png','wireframe':'exports/components/assign-attribute-row-wireframe.png'})
save('component-manifest.json',manifest);save('render-manifest.json',render)
keep={d['src'] for d in manifest['definitions']}|{'component-manifest.json'}
for f in D.glob('component-*.json'):
 if f.name not in keep:f.unlink()
outputs={j[k] for j in render for k in ['preview','wireframe']}
for f in (D/'exports/components').glob('*.png'):
 if str(f.relative_to(D)) not in outputs:f.unlink()

print(len(manifest['pages']),'page scenes;',len(manifest['components']),'hierarchy records;',len(manifest['definitions']),'reusable definitions;',len(render),'renders')
