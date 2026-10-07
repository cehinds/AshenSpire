import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {validateProject as validate,anchorWorld,checkPose} from './workshop-core.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8').replace(/^\uFEFF/,''));
const manifest=read('manifest.json');let poses=0,contacts=0,layers=0;
assert.equal(manifest.projects.length,31);assert.equal(manifest.coverage.armorRecords,35);
const expected=['empty',...Object.keys(read('weapon-metadata.json'))];assert.equal(expected.length,29);
for(const entry of manifest.projects){
 const project=validate(read(entry.projectPath));assert.equal(Object.keys(project.poses).length,841);
 for(const asset of Object.values(project.assets)){assert.ok(asset.src.startsWith('assets/'));assert.ok(fs.existsSync(path.join(root,asset.src)));}
 for(const right of expected)for(const left of expected){
  const pose=project.poses[`${right}--${left}`];assert.ok(pose);assert.equal(pose.weaponType,right);assert.equal(pose.offhandType,left);poses++;
  assert.equal(pose.layers.filter(l=>l.role==='weapon').length,Number(right!=='empty')+Number(left!=='empty'));
  assert.equal(pose.layers[0].role,'body');
  for(const l of pose.layers){layers++;assert.equal(l.scale,1);assert.equal(l.erase.length,0);assert.equal(l.parentId,null);
   if(l.role!=='weapon')continue;
   const palm=anchorWorld(pose,['body',l.handAnchor]),grip=anchorWorld(pose,[l.id,'grip']);
   assert.ok(Math.hypot(palm[0]-grip[0],palm[1]-grip[1])<1e-6);assert.equal(l.locked,false);assert.ok(l.anchors.every(a=>!a.pinned));contacts++;
  }
  assert.deepEqual(checkPose(pose).filter(s=>!s.includes('unreviewed')),[]);
 }
}
const report={schema:'ashenspire.layer-validation.v1',projects:31,armorRecords:35,armaments:28,poses,contacts,layers,passed:true,visualApproval:false};
fs.writeFileSync(path.join(root,'geometry-validation.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
