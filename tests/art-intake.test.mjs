// tests/art-intake.test.mjs — which pull-request files belong to the art repository.
// Pure functions only (no git, no network): fast enough for every PR into dev.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import { ART_REPO, checkDest, classify, destinationFor, intake, parseNameStatus, selftest } from '../tools/art-intake.mjs';

test('intake reports the project-scoped shared art host', () => {
  assert.equal(ART_REPO, 'cehinds/AI-Art');
});

test('a high-tier file migrates to the art repository hd/ tree', () => {
  assert.deepEqual(classify('assets/bg/town.webp'), { verdict: 'migrate', dest: 'hd/assets/bg/town.webp' });
  assert.equal(destinationFor('assets/sfx/click.ogg'), 'hd/assets/sfx/click.ogg');
});

test('a font migrates to the common pack, not the high tier', () => {
  assert.deepEqual(classify('assets/fonts/Inter.woff2'), { verdict: 'migrate', dest: 'common/assets/fonts/Inter.woff2' });
});

test('a light-tier file migrates to light/assets/ with its runtime-relative suffix', () => {
  assert.deepEqual(classify('assets-mobile/bg/town.webp'), { verdict: 'migrate', dest: 'light/assets/bg/town.webp' });
  assert.equal(destinationFor('assets-mobile/bg/town.webp'), 'light/assets/bg/town.webp');
});

test('a source file is ignored, not an art file', () => {
  assert.deepEqual(classify('src/ui/assetmap.js'), { verdict: 'ignored', dest: null });
  assert.deepEqual(classify('asset-data/fonts/OFL.txt'), { verdict: 'ignored', dest: null });
  assert.deepEqual(classify('assetsx/a.webp'), { verdict: 'ignored', dest: null });
});

test('score renders and the music manifest migrate; the score source stays here', () => {
  assert.deepEqual(classify('music/town/theme.mp3'), { verdict: 'migrate', dest: 'common/music/town/theme.mp3' });
  assert.deepEqual(classify('music/manifest.json'), { verdict: 'migrate', dest: 'common/music/manifest.json' });
  assert.deepEqual(classify('music/score/theme.mjs'), { verdict: 'stays', dest: null });
});

test('map tiles and authoring art migrate to their art-repository homes', () => {
  assert.equal(destinationFor('map-detail/r1/t.webp'), 'common/map-detail/r1/t.webp');
  assert.equal(destinationFor('art/poses/a.png'), 'art/poses/a.png');
});

test('the diff parser keeps added and modified files and drops deletions and renames', () => {
  const diff = '\0M\0assets/bg/a.webp\0A\0src/x.js\0D\0gone.webp\0A\0music/town.mp3\0';
  assert.deepEqual(parseNameStatus(diff), [
    { status: 'M', path: 'assets/bg/a.webp' },
    { status: 'A', path: 'src/x.js' },
    { status: 'A', path: 'music/town.mp3' },
  ]);
});

test('intake sorts high, light and common migrations by original path', () => {
  const r = intake([
    { status: 'A', path: 'music/town.mp3' },
    { status: 'M', path: 'assets-mobile/a.webp' },
    { status: 'A', path: 'assets/a.webp' },
    { status: 'A', path: 'src/x.js' },
  ]);
  assert.deepEqual(r.migrate, [
    { path: 'assets-mobile/a.webp', dest: 'light/assets/a.webp' },
    { path: 'assets/a.webp', dest: 'hd/assets/a.webp' },
    { path: 'music/town.mp3', dest: 'common/music/town.mp3' },
  ]);
  assert.deepEqual(r.stays, []);
});

test('a staged destination cannot climb out of the checkout or land in a git directory', () => {
  for (const bad of ['hd/../x', '../x', 'art/.git/config', 'common//x', 'art/./x']) {
    assert.throws(() => checkDest(bad), (e) => e.exit === 2, bad);
  }
  assert.equal(checkDest('hd/assets/bg/town.webp'), 'hd/assets/bg/town.webp');
});

test('the tool selftest passes', () => {
  assert.equal(selftest(), 0);
});

test('display images migrate for every supported raster/vector extension while JSON/Markdown catalogs stay',()=>{
 for(const ext of ['png','webp','jpg','jpeg','gif','svg','PNG'])assert.deepEqual(classify('assets-display/shared/art.'+ext),{verdict:'migrate',dest:'common/assets-display/shared/art.'+ext});
 for(const file of ['layered/manifest.json','README.md','shared/library.JSON']){assert.deepEqual(classify('assets-display/'+file),{verdict:'stays',dest:null});assert.equal(destinationFor('assets-display/'+file),null);}
 for(const file of ['assets-displayx/a.png','tests/fixtures/assets-display/a.png','src/ui/catalog.js','assets-display/a.unsupported'])assert.deepEqual(classify(file),{verdict:'ignored',dest:null});
});

test('actual base tool stages raw light/display blobs at mapped homes and keeps game catalogs out',()=>{
 const root=mkdtempSync(join(tmpdir(),'intake-relocation-unit-')),game=join(root,'game'),art=join(root,'AI-Art');mkdirSync(game);mkdirSync(art);
 const git=(...args)=>execFileSync('git',args,{cwd:game,encoding:'utf8'}).trim();
 try{
  git('init','-q');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','core.hooksPath=/dev/null','commit','--allow-empty','-qm','base');const base=git('rev-parse','HEAD');
  const bytes=Buffer.from([0,255,13,10,1,2,3]);
  for(const [path,data]of Object.entries({'assets-mobile/bg/a.webp':bytes,'assets-display/shared/a.png':bytes,'assets-display/layered/manifest.json':'{}','assets-display/README.md':'game catalog','src/ui/catalog.js':'game code'})){mkdirSync(dirname(join(game,path)),{recursive:true});writeFileSync(join(game,path),data);}
  git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','core.hooksPath=/dev/null','commit','-qm','fixture head');const head=git('rev-parse','HEAD');
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('../tools/art-intake.mjs',import.meta.url)),'--stage',art,'--base',base,'--head',head],{cwd:game,encoding:'utf8',env:{...process.env,ART_REPO_WRITE_TOKEN:'',GITHUB_TOKEN:''}});
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.deepEqual(readFileSync(join(art,'light/assets/bg/a.webp')),bytes);
  assert.deepEqual(readFileSync(join(art,'common/assets-display/shared/a.png')),bytes);
  for(const path of ['common/assets-display/layered/manifest.json','common/assets-display/README.md','src/ui/catalog.js'])assert.equal(existsSync(join(art,path)),false,path);
 }finally{rmSync(root,{recursive:true,force:true});}
});
