import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm, symlink} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {reviewPaths,serveReview,reviewRelative} from '../pose-studio/stances/update-stances/sequence-review/render-paths.mjs';

async function fixture(t) {
  const temporary=await mkdtemp(path.join(os.tmpdir(),'sequence-path-fixture-'));
  t.after(()=>rm(temporary,{recursive:true,force:true}));
  const game=path.join(temporary,'game'),art=path.join(temporary,'art checkout');
  const put=async(root,relative,bytes)=>{const full=path.join(root,relative);await mkdir(path.dirname(full),{recursive:true});await writeFile(full,bytes);};
  await put(game,reviewRelative+'/index.html','game editor HTML');
  await put(game,reviewRelative+'/app.mjs','game editor module');
  await put(game,reviewRelative+'/preview-assets.json','old game metadata');
  await put(game,reviewRelative+'/frames/C.webp','old local fixture frame');
  await put(game,reviewRelative+'/renders/old-proof.txt','preserve original fixture proof');
  await put(art,reviewRelative+'/index.html','untrusted duplicate editor HTML');
  await put(art,reviewRelative+'/app.mjs','untrusted duplicate editor module');
  await put(art,reviewRelative+'/preview-assets.json','{"frames":{"C":{"imagePath":"frames/C.webp"}}}');
  await put(art,reviewRelative+'/frames/C.webp','synthetic external frame bytes');
  return {temporary,game,art,put};
}

test('composite HTTP serves Game code and external JSON/frames; generated output belongs to authoring',async t=>{
  const f=await fixture(t),paths=reviewPaths({root:f.game,env:{ASHEN_ART_CHECKOUT:f.art}});
  assert.equal(paths.folder,path.join(f.game,reviewRelative));
  assert.equal(paths.output,path.join(f.art,reviewRelative,'renders'));
  const server=await serveReview(paths);
  try {
    for(const [name,expected] of [['index.html','game editor HTML'],['app.mjs','game editor module'],
      ['preview-assets.json','{"frames":{"C":{"imagePath":"frames/C.webp"}}}'],['frames/C.webp','synthetic external frame bytes']]) {
      const response=await fetch(server.url(name));
      assert.equal(response.status,200,name);assert.equal(await response.text(),expected,name);
    }
    await mkdir(paths.output,{recursive:true});
    await writeFile(path.join(paths.output,'new-fixture-proof.txt'),'external output');
    assert.equal(existsSync(path.join(f.game,reviewRelative,'renders/new-fixture-proof.txt')),false);
    assert.equal(await readFile(path.join(f.game,reviewRelative,'renders/old-proof.txt'),'utf8'),'preserve original fixture proof');
    assert.equal(await readFile(path.join(f.art,reviewRelative,'renders/new-fixture-proof.txt'),'utf8'),'external output');
  } finally {await server.close();}
  assert.equal(server.server.address(),null,'owned HTTP server is closed');
});

test('explicit --asset-root selection wins over an unrelated terminal override',async t=>{
  const f=await fixture(t),other=path.join(f.temporary,'other art');await mkdir(other);
  const paths=reviewPaths({root:f.game,assetRoot:f.art,env:{ASHEN_ART_CHECKOUT:other}});
  assert.equal(paths.art,f.art);assert.equal(paths.output,path.join(f.art,reviewRelative,'renders'));
});

test('self-contained local fixtures retain the original folder server and adjacent renders',async t=>{
  const f=await fixture(t),paths=reviewPaths({root:f.game,env:{}});
  assert.equal(paths.art,null);assert.equal(paths.output,path.join(f.game,reviewRelative,'renders'));
  const server=await serveReview(paths);
  try {
    assert.equal(await(await fetch(server.url('index.html'))).text(),'game editor HTML');
    assert.equal(await(await fetch(server.url('preview-assets.json'))).text(),'old game metadata');
    assert.equal(await(await fetch(server.url('frames/C.webp'))).text(),'old local fixture frame');
  } finally {await server.close();}
  assert.equal(server.server.address(),null);
});

test('authoring renders cannot escape through a link into Game or a release cache',async t=>{
  const f=await fixture(t);
  const folder=path.join(f.art,reviewRelative);await mkdir(folder,{recursive:true});
  // A directory junction on Windows exercises the same canonical-path boundary.
  await symlink(path.join(f.game,reviewRelative,'renders'),path.join(folder,'renders'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>reviewPaths({root:f.game,assetRoot:f.art,env:{}}),/outside the authoring checkout|runtime cache/);
});

test('stdlib portable-render preflight rejects every escaping manifest field before encoding or writes',async t=>{
  const f=await fixture(t),output=path.join(f.art,'arbitrary output root');await mkdir(output);
  const outside=path.join(f.game,'outside');await mkdir(outside);
  await symlink(outside,path.join(output,'escape-link'),process.platform==='win32'?'junction':'dir');
  const manifestLinkRoot=path.join(f.art,'manifest-link-root');await mkdir(manifestLinkRoot);
  await symlink(outside,path.join(manifestLinkRoot,'manifest.json'),process.platform==='win32'?'junction':'dir');
  const tool=fileURLToPath(new URL('../pose-studio/stances/update-stances/sequence-review/render-portable.py',import.meta.url));
  const script=String.raw`
import json, pathlib, runpy, sys
module=runpy.run_path(sys.argv[1])
safe, preflight, main=module['safe_render_path'], module['preflight'], module['main']
root, linked=map(pathlib.Path,sys.argv[2:4])
assert safe(root,'valid-frame.png')==root/'valid-frame.png'
assert safe(root,'nested/frame.png')==root/'nested/frame.png'
valid={'frames':['valid-frame.png'],'gif':'valid.gif','gifAliases':['alias.gif'],'storyboard':'board.png'}
preflight(root,{'outputs':[valid]})
bad=['','../outside.png','/absolute.png','C:/absolute.png','C:relative.png','..\\outside.png','nested\\file.png','escape-link/outside.png']
for field in ['frames','gif','gifAliases','storyboard']:
    for name in bad:
        row=dict(valid);row[field]=[name] if field in ['frames','gifAliases'] else name
        try: preflight(root,{'outputs':[row]})
        except ValueError: pass
        else: raise AssertionError((field,name))
manifest=root/'manifest.json'
original=json.dumps({'outputs':[valid,{**valid,'gifAliases':['../escape.gif']}]})
manifest.write_text(original)
try: main(['--renders-root',str(root)])
except ValueError: pass
else: raise AssertionError('main did not preflight every row')
assert manifest.read_text()==original
assert 'PIL' not in sys.modules, 'encoder was imported before path rejection'
try: main(['--renders-root',str(linked)])
except ValueError: pass
else: raise AssertionError('fixed manifest path escaped the root')
print(json.dumps({'guardCases':len(bad)*4,'validPaths':2,'preflightBeforeEncoder':True,'fixedManifestContained':True}))
`;
  const result=spawnSync(process.env.PYTHON||(process.platform==='win32'?'python':'python3'),
    ['-I','-c',script,tool,output,manifestLinkRoot],{encoding:'utf8',timeout:10_000});
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),{guardCases:32,validPaths:2,preflightBeforeEncoder:true,fixedManifestContained:true});
});
