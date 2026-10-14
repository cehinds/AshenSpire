import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('production export preserves shared registration, airborne height and exact stance bookends',()=>{
  const result=spawnSync('python3',['-c',String.raw`
import importlib.util,tempfile,json
from pathlib import Path
from PIL import Image,ImageDraw
spec=importlib.util.spec_from_file_location('exporter','tools/class-smash-export.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as tmp:
 root=Path(tmp);folder=root/'pose-studio/stances/class-smash/rogue';folder.mkdir(parents=True)
 (root/'src/content').mkdir(parents=True)
 (root/'src/content/alternativeCardAnimations.js').write_text('export const alternativeCardAnimations = '+json.dumps({'classes':{'rogue':{'frames':{'ready':{'bounds':[100,140,350,464]}}}}})+';')
 provenance={'directorApproved':True,'registration':{'groundAnchor':[512,900],'bodyHeight':600}}
 (folder/'provenance.json').write_text(json.dumps(provenance))
 for i,name in enumerate(m.NAMES):
  image=Image.new('RGBA',(1024,1024));draw=ImageDraw.Draw(image)
  draw.rectangle([400,300-(150 if i==2 else 0),620,899-(150 if i==2 else 0)],fill=(100,120,140,255))
  image.save(folder/(name+'.png'))
 entry,outputs=m.prepare_class('rogue',root)
 frames=entry['frames'];held=frames['held'];air=frames['airborne']
 assert all(f['size']==held['size'] and f['drawOffset']==held['drawOffset'] for f in frames.values())
 assert abs(held['stageBounds'][3]-464)<1e-9
 assert air['stageBounds'][3]<held['stageBounds'][3]-70,'airborne feet must stay airborne'
 assert len([p for p in outputs if p.endswith('.webp')])==8
 assert all(f['stageAnchor']==[384,464] for f in frames.values())
 # A changed return pose cannot silently become an approximate bookend.
 image.putpixel((500,500),(255,0,0,255));image.save(folder/'05-held.png')
 try:m.prepare_class('rogue',root);raise AssertionError('accepted changed bookend')
 except ValueError as e:assert 'bookends' in str(e)
 # Director acceptance cannot be inferred from files being present.
 provenance['directorApproved']=False;(folder/'provenance.json').write_text(json.dumps(provenance))
 try:m.prepare_class('rogue',root);raise AssertionError('accepted unapproved source')
 except ValueError as e:assert 'directorApproved' in str(e)
print('shared scale, world anchor, transparent derivatives and director gate passed')
`],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/director gate passed/);
});
