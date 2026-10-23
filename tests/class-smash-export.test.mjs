import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('production export preserves shared registration, airborne height and exact stance bookends',()=>{
  const result=spawnSync(process.env.ASHEN_PYTHON || process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'),['-c',String.raw`
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
 for f in frames.values():
  crop=f['sourceCrop'];scale=324/600
  assert f['size']==[(crop[2]-crop[0])*scale,(crop[3]-crop[1])*scale]
  assert abs((f['drawOffset'][0]-crop[0]*scale)-(384-512*scale))<1e-9
  assert abs((f['drawOffset'][1]-crop[1]*scale)-(464-900*scale))<1e-9
  assert abs(f['stageBounds'][0]-(f['bounds'][0]*scale+384-512*scale))<1e-9
  assert abs(f['stageBounds'][3]-(f['bounds'][3]*scale+464-900*scale))<1e-9
 assert abs(held['stageBounds'][3]-464)<1e-9
 assert air['stageBounds'][3]<held['stageBounds'][3]-70,'airborne feet must stay airborne'
 assert len([p for p in outputs if p.endswith('.webp')])==8
 assert all(f['stageAnchor']==[384,464] for f in frames.values())
 # Reject malformed rasters before writing any derivative.
 original=(folder/'02-takeoff.png').read_bytes()
 Image.new('RGBA',(512,1024),(100,120,140,255)).save(folder/'02-takeoff.png')
 try:m.prepare_class('rogue',root);raise AssertionError('accepted malformed dimensions')
 except ValueError as e:assert '1024' in str(e)
 (folder/'02-takeoff.png').write_bytes(original)
 # Bool is not a measured anatomical height.
 provenance['registration']['bodyHeight']=True;(folder/'provenance.json').write_text(json.dumps(provenance))
 try:m.prepare_class('rogue',root);raise AssertionError('accepted boolean body height')
 except ValueError as e:assert 'bodyHeight' in str(e)
 provenance['registration']['bodyHeight']=600;(folder/'provenance.json').write_text(json.dumps(provenance))
 # Clipped trails must be repaired on the source side, never cropped away.
 clipped=Image.open(folder/'02-takeoff.png').convert('RGBA');clipped.putpixel((0,500),(255,0,0,255));clipped.save(folder/'02-takeoff.png')
 try:m.prepare_class('rogue',root);raise AssertionError('accepted clipped reach')
 except ValueError as e:assert 'canvas edge' in str(e)
 (folder/'02-takeoff.png').write_bytes(original)
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

test('real class production registers verified assets with a shared world transform',async()=>{
  const {readFileSync}=await import('node:fs');
  const {createHash}=await import('node:crypto');
  const {classSmashAnimations}=await import('../src/content/classSmashAnimations.js');
  const hash=path=>createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex');
  for(const actor of ['rogue','starseer','herald']){
    const entry=classSmashAnimations.classes[actor];assert.ok(entry,actor);
    const production=JSON.parse(readFileSync(new URL('../'+entry.provenance,import.meta.url)));
    assert.deepEqual(entry.frames,production.frames);
    assert.deepEqual(Object.keys(entry.frames),['held','takeoff','airborne','impact']);
    for(const frame of Object.values(entry.frames)){
      assert.equal(hash(frame.path),frame.sha256);assert.equal(hash(frame.lite),frame.liteSha256);assert.equal(hash(frame.source.path),frame.source.sha256);
      const crop=frame.sourceCrop,scale=production.sharedLogicalScale;
      assert.deepEqual(frame.size,[(crop[2]-crop[0])*scale,(crop[3]-crop[1])*scale]);
      for(const axis of [0,1])assert.ok(Math.abs(frame.drawOffset[axis]-crop[axis]*scale-production.sourceLogicalDrawOffset[axis])<1e-9);
      assert.deepEqual(frame.stageBounds,frame.bounds.map((value,index)=>value*scale+production.sourceLogicalDrawOffset[index%2]));
      assert.deepEqual(frame.stageAnchor,[384,464]);assert.deepEqual(frame.rasterSize,[(crop[2]-crop[0])/2,(crop[3]-crop[1])/2]);assert.deepEqual(frame.mobileRasterSize,[(crop[2]-crop[0])/4,(crop[3]-crop[1])/4]);
      assert.ok(frame.bounds.every(Number.isFinite));assert.ok(frame.stageBounds.every(Number.isFinite));
      for(const [key,x]of [['path','sha256'],['lite','liteSha256']]){
        const name=frame[key].replace('assets-display/alternative/','');assert.equal(classSmashAnimations.hashes[name],frame[x]);assert.equal(classSmashAnimations.filePaths[name],frame[key]);
      }
    }
    assert.equal(hash(production.sourceProvenance),production.sourceProvenanceSha256);
    assert.equal(production.sourceBookends.first,production.sourceBookends.last,'byte-identical source bookends');
  }
});
