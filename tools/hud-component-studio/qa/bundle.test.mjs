import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {bundleProject} from '../bundle-project.mjs';
test('default bundle ids separate full project paths and scene filenames; explicit ids stay stable',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'studio-bundle-identities-'));
 try{
  const source={version:1,title:'Fixture',canvas:{width:800,height:600},defaultState:'class',states:[{id:'class',name:'Class'}],assets:{},nodes:[]};
  const files=['projects/a/pages/scene.json','projects/b/pages/scene.json','projects/a/pages/scene-noncaster.json'];
  const ids=[];for(const relative of files){const scenePath=path.join(root,relative);await fs.mkdir(path.dirname(scenePath),{recursive:true});await fs.writeFile(scenePath,JSON.stringify(source));ids.push((await bundleProject({scenePath,outPath:path.join(root,'output.html')})).id);}
  assert.equal(new Set(ids).size,3);
  const moved=path.join(root,'different-machine/projects/a/pages/scene.json');await fs.mkdir(path.dirname(moved),{recursive:true});await fs.writeFile(moved,JSON.stringify(source));assert.equal((await bundleProject({scenePath:moved,outPath:path.join(root,'moved.html')})).id,ids[0]);
  for(const relative of files)assert.equal((await bundleProject({scenePath:path.join(root,relative),outPath:path.join(root,'explicit.html'),id:'chosen-project'})).id,'chosen-project');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
