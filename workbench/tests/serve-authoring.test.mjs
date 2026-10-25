import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import {serve} from '../../tools/serve.mjs';
import {isAuthoringFile,compositeSourcePath} from '../../tools/art-authoring.mjs';

function fixture(){
 const dir=mkdtempSync(path.join(tmpdir(),'serve-authoring-')),root=path.join(dir,'game'),assetRoot=path.join(dir,'AI-Art');
 mkdirSync(root);mkdirSync(assetRoot);
 const put=(base,name,bytes)=>{const file=path.join(base,name);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,bytes);};
 return {dir,root,assetRoot,put,close:()=>rmSync(dir,{recursive:true,force:true})};
}

test('the actual server path expression produces URL-relative paths for both native Windows and POSIX normalization',()=>{
 const source=readFileSync(new URL('../../tools/serve.mjs',import.meta.url),'utf8');
 const lines=source.split('\n').filter(line=>line.includes('const rel = normalize(urlPath).'));
 assert.equal(lines.length,1,'one actual request-relative path declaration');
 const f=fixture();try{
  for(const platform of [path.win32,path.posix])for(const name of ['tools/hud-component-studio/studio.js','tools/hud-component-studio/reference.png','assets-display/alternative/pose.webp','assets-display/alternative/index.json','music/score/composer.mjs']){
   const rel=vm.runInNewContext(`(()=>{${lines[0]} return rel;})()`,{urlPath:'/'+name,normalize:platform.normalize,sep:platform.sep});
   assert.equal(rel,name);
   assert.doesNotThrow(()=>isAuthoringFile(rel));
   const owned=/\.m?js$/.test(name)||name.endsWith('.json');
   const expected=owned?path.join(f.root,name):path.join(f.assetRoot,name.startsWith('assets-display/')?'common/'+name:name);
   assert.equal(compositeSourcePath(rel,{root:f.root,assetRoot:f.assetRoot}),expected);
  }
 }finally{f.close();}
});

// This exact HTTP test is also run by workbench.yml on native windows-latest
// and macos-latest. The win32 case above is a deterministic unit regression,
// not a claim that a Linux host is native Windows.
test('the native authoring server preserves game ownership and refuses raw or encoded backslash escapes',async()=>{
 const f=fixture();let app;
 try{
  const image='assets-display/alternative/pose.webp',reference='tools/hud-component-studio/reference.png';
  f.put(f.assetRoot,'common/'+image,'external display bytes');
  f.put(f.assetRoot,reference,'external reference bytes');
  for(const [name,text]of [['tools/hud-component-studio/studio.js','game editor'],['assets-display/alternative/index.json','game catalog'],['music/score/composer.mjs','game score code']]){
   f.put(f.root,name,text);f.put(f.assetRoot,name.startsWith('assets-display/')?'common/'+name:name,'must not shadow game');
  }
  f.put(f.dir,'secret.txt','outside game sentinel');
  f.put(f.assetRoot,'secret.txt','outside mapped tree sentinel');
  app=await serve({root:f.root,assetRoot:f.assetRoot,port:0,open:false,host:'127.0.0.1',quiet:true});
  const url=new URL(app.url);
  const request=(wirePath,method='GET')=>new Promise((resolve,reject)=>{
   const req=http.request({hostname:url.hostname,port:url.port,path:wirePath,method,headers:{Connection:'close'}},res=>{
    const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString()}));
   });
   req.setTimeout(3000,()=>req.destroy(Error('fixture request timed out')));req.on('error',reject);req.end();
  });
  for(const [name,body]of [[image,'external display bytes'],[reference,'external reference bytes'],['tools/hud-component-studio/studio.js','game editor'],['assets-display/alternative/index.json','game catalog'],['music/score/composer.mjs','game score code']])assert.deepEqual(await request('/'+name),{status:200,body});
  for(const wirePath of ['/tools\\hud-component-studio\\reference.png','/tools%5chud-component-studio%5creference.png','/assets-display/..\\..\\secret.txt','/assets-display/..%5C..%5Csecret.txt'])assert.deepEqual(await request(wirePath),{status:403,body:'Forbidden'},wirePath);
  for(const wirePath of ['/assets-display/%2e%2e/%2e%2e/secret.txt','/assets-display/..%2f..%2fsecret.txt','/secret.txt']){
   const response=await request(wirePath);assert.notEqual(response.status,200,wirePath);assert.doesNotMatch(response.body,/sentinel/);
  }
  const head=await request('/'+image,'HEAD');assert.equal(head.status,200);assert.equal(head.body,'');
 }finally{
  if(app){app.server.closeAllConnections();await new Promise(done=>app.server.close(done));}
  f.close();
 }
});
