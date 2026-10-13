from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib
p=Path(__file__).parent;seed=p.parents[1]/'sequence-review/frames/W.webp';sha=lambda q:hashlib.sha256(q.read_bytes()).hexdigest()
names=['Waist cleave','Chest crosscut','Low knee sweep','Travelling step-through','Planted hip pivot','Retreat cut','Reverse return arc','Broad heavy cleave','Compact parry riposte','Advancing draw cut'];entries=[];actions=[]
for i,title in enumerate(names,1):
 d=p/f'Sweep{i:02}';norm=json.loads((d/'normalization.json').read_text());fs=[]
 for n in range(1,6):
  q=d/f'frame-{n:02}.webp';im=Image.open(q);assert im.size==(768,512) and im.mode=='RGBA';b=im.getbbox();assert b and b[0]>0 and b[1]>0 and b[2]<768 and b[3]<512,(q,b)
  if n in [1,5]:assert q.read_bytes()==seed.read_bytes()
  else:actions.append(sha(q))
  fs.append(dict(slot=n,role=['approved-stance','load','contact','followthrough','approved-stance'][n-1],path=q.relative_to(p).as_posix(),sha256=sha(q)))
 entries.append(dict(id=f'SW{i:02}',folder=d.name,name=title,frames=fs,strip=f'{d.name}/strip.png',gif=f'{d.name}/preview.gif',raw=f'{d.name}/{norm["raw"]}',normalization=f'{d.name}/normalization.json',status='option-review-candidate'))
 prompts=[dict(path=q.name,sha256=sha(q)) for q in sorted(d.glob('*prompt.txt'))];raws=[dict(path=q.name,sha256=sha(q),dimensions=list(Image.open(q).size)) for q in sorted(d.glob('raw*.png'))]
 (d/'provenance.json').write_text(json.dumps(dict(generator='image_gen.imagegen',whole_strip_generation=True,approved_seed='pose-studio/stances/update-stances/sequence-review/frames/W.webp',approved_seed_sha256=sha(seed),source_painting='greatsword-sweep/sheet-b.png middle-left SW18',active_raw=norm['raw'],raw_files=raws,prompts=prompts,bookends='frames01/05 exact W bytes; not newly painted assets',reference_policy='techniques interpreted from text; no external images imported',references=['https://www.hema101.com/post/beginner-s-guide-to-fencing-with-the-longsword','https://hemapenzance.com/blog/how-to-lunge-with-a-sabre'],reference_limitations='Waist/knee/footwork variations are artistic adaptations, not direct source poses. Sabre footwork cautiously adapted to greatsword.'),indent=2)+'\n')
assert len(actions)==30 and len(set(actions))==30
(p/'manifest.json').write_text(json.dumps(dict(schema=1,kind='horizontal-greatsword-sweep-options',status='option-review-candidates-not-runtime-selection',frame_size=[768,512],slots_per_example=5,examples_count=10,exported_slots=50,unique_painted_action_frames=30,shared_approved_bookend_paintings=1,bookend_source='pose-studio/stances/update-stances/sequence-review/frames/W.webp',bookend_sha256=sha(seed),source_ground_y=467,examples=entries),indent=2)+'\n')
for start,end in [(1,10),(2,4),(5,7),(8,10)]:
 c=Image.new('RGB',(1920,(end-start+1)*270),'#18202a')
 for row,e in enumerate(entries[start-1:end]):
  im=Image.open(p/e['strip']).resize((1920,256));c.paste(im,(0,row*270+14),im);ImageDraw.Draw(c).text((8,row*270),e['id']+' '+e['name'],fill='white')
 c.save(p/('all-ten-contact-sheet.jpg' if start==1 else f'batch-{start:02}-{end:02}.jpg'),quality=92)
gridframes=[]
for slot in range(1,6):
 c=Image.new('RGB',(960,1400),'#18202a');draw=ImageDraw.Draw(c)
 for idx,e in enumerate(entries):
  x=(idx%2)*480;y=(idx//2)*280;draw.text((x+8,y+5),e['id']+' '+e['name']+f' / frame {slot}/5',fill='white')
  im=Image.open(p/e['frames'][slot-1]['path']).resize((384,256),Image.Resampling.LANCZOS)
  c.paste(im,(x+48,y+21),im)
 gridframes.append(c)
gridframes[0].save(p/'comparison-2x5.gif',save_all=True,append_images=gridframes[1:],duration=[350,200,180,230,350],loop=0)
print('PASS: 10×5 slots; 20 bookends byte-identical W; 30 distinct action frames; RGBA768×512; all silhouettes inside frame margins.')
