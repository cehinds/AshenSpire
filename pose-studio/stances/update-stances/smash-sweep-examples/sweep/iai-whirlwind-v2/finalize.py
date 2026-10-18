from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib
p=Path(__file__).parent;seed=p/'seed/stance-final.png';sha=lambda q:hashlib.sha256(q.read_bytes()).hexdigest()
names=['Waist whirlwind draw','Reverse half-turn','Cross-step whirlwind','Planted deep pivot','Rising spiral','Low leg orbit','Compact low finish','Broad orbit','Two-direction unwind','Advancing low whirlwind']
descriptions=['Counter-coil, rightward waist crosscut and low forward left-blade finish.','Right blade preload, body half-turn into left return cut, then rightward low completion.','Crossed-foot coil and mid-turn, then uncrossed wide low landing.','Wide planted squat with hip pivot and deeper compact finish.','A rising diagonal spiral crosses from waist toward chest before a low recovery.','The strike and surrounding orbit drop toward knee level with a compressed body.','The turning crosscut settles into a narrower compact low finish; arms extend during contact.','Wide base and broad surrounding arc with an extended waist cut.','Rightward preload reverses into a leftward body turn, then a low rightward unwind.','Lifted front boot starts a forward step; the cut plants and advances into a wide low finish.']
entries=[];actions=[]
for i,(title,description) in enumerate(zip(names,descriptions),1):
 d=p/f'Sweep{i:02}';fs=[]
 for n in range(1,6):
  q=d/f'frame-{n:02}.png';im=Image.open(q);assert im.size==(1024,1024) and im.mode=='RGBA';b=im.getbbox();assert b and b[0]>0 and b[1]>0 and b[2]<1024 and b[3]<1024,(q,b)
  if n in[1,5]:assert q.read_bytes()==seed.read_bytes()
  else:actions.append(sha(q))
  fs.append(dict(slot=n,role=['new-low-iai-stance','counter-coil','turning-cut','low-followthrough','new-low-iai-stance'][n-1],path=q.relative_to(p).as_posix(),sha256=sha(q)))
 gif=Image.open(d/'preview.gif');assert gif.n_frames==5
 entry=dict(id=f'SW{i:02}',folder=d.name,name=title,description=description,frames=fs,strip=f'{d.name}/strip.png',gif=f'{d.name}/preview.gif',raw=f'{d.name}/raw.png',provenance=f'{d.name}/provenance.json',normalization=f'{d.name}/normalization.json',review='director-reviewed-option-candidate-not-runtime-selection');entries.append(entry)
 raws=[dict(path=q.name,sha256=sha(q),dimensions=list(Image.open(q).size)) for q in sorted(d.glob('raw*.png'))];prompts=[dict(path=q.name,sha256=sha(q)) for q in sorted(d.glob('*prompt.txt'))]
 (d/'provenance.json').write_text(json.dumps(dict(generator='image_gen.imagegen',whole_strip_generation=True,active_raw='raw.png',raws=raws,prompts=prompts,seed='seed/stance-final.png',seed_sha256=sha(seed),bookends='Exact approved normalized NEW seed PNG bytes copied to slots01/05; original runtimeW not used or modified',effects='Curved slash arcs painted by ImageGen inside whole-strip generation, no mechanical effect painting',anatomy='Low iai-inspired gather; visible palm-up underhand hilt grip, thumb above, knuckles below, inner elbow crease facing camera; level flat blade in approved idle seed',normalization='Shared body scale from approved seed/raw idle height; anatomical helmet registration and manually identified boot contact plane; effect bounds not used for centering/scale',references=['https://www.meikyokan.org/hawaiikendo_lessons-in-iaido','https://www.northlondonbudo.co.uk/iaido-information/a-sample-iaido-kata-a-sequence-of-moves'],reference_limitations='Dojo text observations inform low coil/turn/draw vocabulary only. Katana/seated motions adapted artistically to armored greatsword. No external character art or effects imported.'),indent=2)+'\n')
assert len(actions)==30 and len(set(actions))==30
manifest=dict(schema=2,kind='low-iai-greatsword-whirlwind-options',status='director-reviewed-candidates-await-user-selection',frame_size=[1024,1024],slots_per_example=5,examples_count=10,exported_slots=50,unique_painted_action_frames=30,shared_new_bookend_paintings=1,bookend_source='seed/stance-final.png',bookend_sha256=sha(seed),bookend_preservation='20 exported bookend files byte-identical to new approved normalized seed; source raw separately preserved',runtime_W_changed=False,source_ground_y=726,legacy_revision='../legacy-horizontal-v1/manifest.json',comparison='comparison-2x5.gif',contact_sheet='all-ten-contact-sheet.jpg',examples=entries)
(p/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
seedmeta=dict(generator='image_gen.imagegen',active_raw='raw-final-clean.png',active_normalized='stance-final.png',active_normalized_sha256=sha(seed),raws=[dict(path=q.name,sha256=sha(q),dimensions=list(Image.open(q).size)) for q in sorted((p/'seed').glob('raw*.png'))],prompts=[dict(path=q.name,sha256=sha(q)) for q in sorted((p/'seed').glob('*prompt.txt'))],normalization=dict(raw_size=[1536,1024],resized_size=[614,410],placement=[65,367],canvas=[1024,1024],method='one uniform scale then transparent padding; no new painting'),approval_scope='User-directed low stance, palm up, thumb up/knuckles down, inside elbow, level flat blade; director accepted clean final seed; options only')
(p/'seed/provenance.json').write_text(json.dumps(seedmeta,indent=2)+'\n')
for start,end in[(1,10),(2,4),(5,7),(8,10)]:
 c=Image.new('RGBA',(2560,(end-start+1)*532),'#273342');draw=ImageDraw.Draw(c)
 for row,e in enumerate(entries[start-1:end]):
  im=Image.open(p/e['strip']).resize((2560,512));c.alpha_composite(im,(0,row*532+20));draw.text((12,row*532),e['id']+' '+e['name'],fill='white')
 c.convert('RGB').save(p/('all-ten-contact-sheet.jpg' if start==1 else f'batch-{start:02}-{end:02}.jpg'),quality=90)
grid=[]
for slot in range(1,6):
 c=Image.new('RGBA',(960,1650),'#273342');draw=ImageDraw.Draw(c)
 for idx,e in enumerate(entries):
  x=idx%2*480;y=idx//2*330;draw.text((x+8,y+7),e['id']+' '+e['name']+f' / {slot}/5',fill='white');im=Image.open(p/e['frames'][slot-1]['path']).crop((0,200,1024,900)).resize((448,306),Image.Resampling.LANCZOS);c.alpha_composite(im,(x+16,y+22))
 grid.append(c.convert('RGB'))
grid[0].save(p/'comparison-2x5.gif',save_all=True,append_images=grid[1:],duration=[350,210,180,260,350],loop=0)
assert Image.open(p/'comparison-2x5.gif').n_frames==5
print('PASS:50RGBA1024² slots;20byte-exactnewseedbookends;30uniqueactions;fullalpha margins;11GIFs×5frames;raw/prompts/sourcehashprovenance.')
