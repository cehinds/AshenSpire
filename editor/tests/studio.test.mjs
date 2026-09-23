import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Workspace, safePath, parseCSV, stringifyCSV, hash, editable } from '../core.mjs';
import { createStudio } from '../server.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ashenspire-studio-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'content/source'), { recursive: true });
  await fs.writeFile(path.join(root, 'content/source/items.csv'), '# keep this note\nid,name\nsword,Steel sword\n');
  return { root, workspace: new Workspace(root, path.join(root, 'state')) };
}
test('CSV round trips comments, quotes, commas and empty cells', () => {
  const input = '# help\nid,name,tags\nx,"Say ""hello"", friend",a|b\ny,,\n';
  assert.deepEqual(parseCSV(stringifyCSV(parseCSV(input))), parseCSV(input));
  assert.throws(() => parseCSV('id,name\nx,"unclosed'), /Unclosed/);
  assert.throws(() => parseCSV('id,id\nx,y'), /unique/);
  assert.throws(() => parseCSV('id,name\nx'), /expected/);
});
test('source allowlist excludes generated artifacts and editor code', () => {
  for (const p of ['AshenSpire.html', 'build/AshenSpire.html', 'buildordinal.json', 'src/content/generated/items.js', 'editor/server.mjs', 'tools/launch.mjs']) assert.equal(editable(p), false, p);
  assert.equal(editable('content/source/weapons.csv'), true);
  assert.equal(editable('src/content/cards/reaver.js'), true);
});
test('path boundary rejects traversal, hidden files, Windows streams, and symlinks', async t => {
  const { root } = await fixture(t);
  for (const p of ['../secret', '.git/config', 'content/../secret', 'content\\secret', 'file.txt:stream', '/absolute']) await assert.rejects(safePath(root,p,true));
  await fs.symlink(path.join(root,'content'), path.join(root,'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(safePath(root,'linked/source/items.csv'), /Linked/);
});
test('saving checks expected hashes and keeps the exact previous bytes', async t => {
  const { root, workspace } = await fixture(t);
  const file = await workspace.read('content/source/items.csv');
  const result = await workspace.save([{ ...file, text: file.text.replace('Steel sword','Bronze sword') }]);
  assert.equal(result.files[0].hash, hash(file.text.replace('Steel sword','Bronze sword')));
  assert.equal(await fs.readFile(path.join(root,'state/backups',result.backup,'0.bak'),'utf8'), file.text);
  await assert.rejects(workspace.save([{ ...file, text: file.text }]), /changed on disk/);
});
test('batch preflight prevents partial saves when another file conflicts', async t => {
  const { workspace } = await fixture(t);
  const file = await workspace.read('content/source/items.csv');
  await assert.rejects(workspace.save([{ ...file, text:file.text.replace('Steel','Iron') }, { path:'editor/workspace/new.json',hash:'stale',text:'[]' }]), /changed on disk/);
  assert.equal((await workspace.read(file.path)).text, file.text);
});
test('duplicate ids and concurrent stale saves are rejected', async t => {
  const { workspace } = await fixture(t); const file = await workspace.read('content/source/items.csv');
  await assert.rejects(workspace.save([{...file,text:'id,name\nx,A\nx,B\n'}]), /duplicate/);
  const results = await Promise.allSettled([workspace.save([{...file,text:file.text.replace('Steel','Iron')}]),workspace.save([{...file,text:file.text.replace('Steel','Gold')}])]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length,1);
  assert.equal(results.filter(r => r.status === 'rejected').length,1);
});
test('HTTP blocks cross-origin writes, preview access to APIs, and syntax errors', async t => {
  const { root } = await fixture(t); const app = await createStudio({root,port:0,stateDir:path.join(root,'state')}); t.after(() => app.close());
  const { token } = await (await fetch(`${app.url}/api/session`)).json();
  assert.equal((await fetch(`${app.url}/api/inventory`)).status,403);
  assert.equal((await fetch(`${app.url}/api/session`,{headers:{Origin:'https://untrusted.example'}})).status,403);
  assert.equal((await fetch(`${app.url.replace('127.0.0.1','localhost')}/api/session`)).status,403);
  const redirect = await fetch(`${app.url}/game/assets/example.svg`,{redirect:'manual'});
  assert.equal(redirect.status,302);
  assert.match(redirect.headers.get('location'),/^http:\/\/localhost:/);
  const save = changes => fetch(`${app.url}/api/save`,{method:'POST',headers:{'x-studio-token':token,'Content-Type':'application/json'},body:JSON.stringify({changes})});
  const bad = await save([{path:'editor/workspace/test.js',hash:null,text:'export const = ;'}]); assert.equal(bad.status,400); assert.match((await bad.json()).error,/Syntax check/);
  const good = await save([{path:'editor/workspace/test.js',hash:null,text:'export const answer = 42;'}]); assert.equal(good.status,200);
  assert.equal(await fs.readFile(path.join(root,'editor/workspace/test.js'),'utf8'),'export const answer = 42;');
});
test('sprite import validates signatures and never overwrites an existing image', async t => {
  const { root } = await fixture(t); const app = await createStudio({root,port:0,stateDir:path.join(root,'state')}); t.after(() => app.close());
  const {token} = await (await fetch(`${app.url}/api/session`)).json();
  const upload = data => fetch(`${app.url}/api/import`,{method:'POST',headers:{'x-studio-token':token,'Content-Type':'application/json'},body:JSON.stringify(data)});
  assert.equal((await upload({name:'bad.png',base64:Buffer.from('<script>').toString('base64')})).status,400);
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKioAAAAASUVORK5CYII=';
  const one = await (await upload({name:'sprite.png',base64:png})).json(), two = await (await upload({name:'sprite.png',base64:png})).json();
  assert.notEqual(one.path,two.path); assert.match(one.path,/^assets\/imported\//);
});
