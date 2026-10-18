import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { selectProposal, sequenceFor, sampleSequence, positionFrame, resolveFrameAsset } from './index.mjs';
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const catalog = await json('./catalog.json');
const source = await json('../manifest.json');
function fetchSparseArt(assets, cwd = new URL('../../../', import.meta.url)) {
  const missing = [...new Set(assets)].filter(asset => !existsSync(new URL(asset, cwd)));
  if (!missing.length) return;
  const entries = execFileSync('git', ['ls-files', '-v', '-z', '--', ...missing], { cwd, encoding: 'utf8' }).split('\0');
  const sparse = entries.filter(entry => entry.startsWith('S ')).map(entry => entry.slice(2));
  if (!sparse.length) return;
  const objects = execFileSync('git', ['ls-tree', '-r', '-z', 'HEAD', '--', ...sparse], { cwd, encoding: 'utf8' })
    .split('\0').filter(Boolean).map(entry => entry.split('\t')[0].split(' ')[2]);
  const status = execFileSync('git', ['cat-file', '--batch-check'], { cwd, input: objects.join('\n')+'\n', encoding: 'utf8',
    env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } }).trim().split('\n');
  const needed = status.filter(line => line.endsWith(' missing')).map(line => line.split(' ')[0]);
  // Fetch only the required tracked blobs together, not one network round trip per PNG.
  // Like Git's lazy fetch, do not negotiate commit history for raw blob wants:
  // shallow negotiation otherwise treats an absent blob as a bad revision.
  if (needed.length) execFileSync('git', ['-c', 'fetch.negotiationAlgorithm=noop', 'fetch', '--no-tags', '--no-write-fetch-head', '--filter=blob:none', 'origin', ...needed], { cwd, stdio: 'pipe' });
}
test('sparse artwork hydration works in a cold shallow partial clone', () => {
  const root = mkdtempSync(join(tmpdir(), 'rear-sparse-'));
  const source = join(root, 'source'), clone = join(root, 'clone');
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    mkdirSync(join(source, 'art/enemy-back-motion/fixture'), { recursive: true });
    writeFileSync(join(source, 'README.md'), 'fixture');
    const asset = 'art/enemy-back-motion/fixture/frame.png';
    writeFileSync(join(source, asset), 'real tracked fixture bytes');
    git(source, 'init');
    git(source, 'config', 'uploadpack.allowFilter', 'true');
    git(source, 'add', '.');
    git(source, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture');
    git(root, 'clone', '--depth=1', '--filter=blob:none', '--no-checkout', pathToFileURL(source).href, clone);
    git(clone, 'sparse-checkout', 'set', '--no-cone', '/README.md');
    git(clone, 'checkout');
    assert.equal(git(clone, 'rev-parse', '--is-shallow-repository').trim(), 'true');
    assert.equal(existsSync(join(clone, asset)), false);
    const sha = git(clone, 'rev-parse', `HEAD:${asset}`).trim();
    const before = execFileSync('git', ['cat-file', '--batch-check'], { cwd: clone, input: sha+'\n', encoding: 'utf8', env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } });
    assert.match(before, / missing\n$/);
    fetchSparseArt([asset], pathToFileURL(clone+'/'));
    const bytes = execFileSync('git', ['cat-file', 'blob', sha], { cwd: clone, env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } });
    assert.equal(bytes.toString(), 'real tracked fixture bytes');
    assert.equal(existsSync(join(clone, asset)), false, 'index sparsity is not changed');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
async function sourceArtBytes(asset) {
  try { return await readFile(new URL('../../../'+asset, import.meta.url)); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const cwd = new URL('../../../', import.meta.url);
    // Lean CI omits authoring PNGs; hash their real tracked bytes, not substitutes.
    const entry = execFileSync('git', ['ls-files', '-v', '-z', '--', asset], { cwd, encoding: 'utf8' });
    if (entry !== `S ${asset}\0`) throw error; // Ordinary deletions still fail.
    return execFileSync('git', ['show', `HEAD:${asset}`], { cwd, maxBuffer: 16 * 1024 * 1024 });
  }
}
test('catalog preserves all source artwork and provenance exactly', async () => {
  assert.deepEqual(catalog.actors, source.actors);
  assert.equal(catalog.actors.length, 13);
  assert.equal(catalog.actors.reduce((n,a)=>n+a.proposals.length,0),130);
  const assets = catalog.actors.flatMap(actor => actor.proposals.flatMap(proposal => [
    ...[...Object.values(proposal.stances), ...Object.values(proposal.animations||{}), ...Object.values(proposal.reactions||{})].flatMap(s=>s.frames),
    ...(proposal.designFrame ? [proposal.designFrame] : []),
  ].map(frame => frame.asset)));
  for (const asset of assets) {
    assert.match(asset, /^art\/enemy-back-(proposals|motion)\/[a-zA-Z0-9_./-]+\.png$/);
    assert.ok(!asset.split('/').includes('..'));
  }
  fetchSparseArt(assets);
  const motion = new Set();
  for (const actor of catalog.actors) for (const proposal of actor.proposals) {
    const frames = [...Object.values(proposal.stances), ...Object.values(proposal.animations||{}), ...Object.values(proposal.reactions||{})].flatMap(s=>s.frames);
    if (proposal.designFrame) frames.push(proposal.designFrame);
    for (const frame of frames) {
      assert.match(frame.asset,/^art\/enemy-back-(proposals|motion)\/[a-zA-Z0-9_./-]+\.png$/);
      assert.ok(!frame.asset.split('/').includes('..'));
      const bytes = await sourceArtBytes(frame.asset);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),frame.sha256);
      if(frame.asset.startsWith('art/enemy-back-motion/')) motion.add(frame.asset);
    }
  }
  assert.equal(motion.size,57);
});
test('source verification does not hide an ordinary missing asset behind git', async () => {
  await assert.rejects(sourceArtBytes('art/enemy-back-motion/not-a-tracked-frame.png'), { code: 'ENOENT' });
});
test('explicit selection and absent states never substitute artwork', () => {
  assert.equal(selectProposal(catalog,'unknown','v01').reason,'unknown-actor');
  assert.equal(selectProposal(catalog,'wyrmLord').reason,'unknown-version');
  const selected=selectProposal(catalog,'wyrmLord','v02');
  assert.equal(sequenceFor(selected,'stances','attack').reason,'state-unavailable');
  assert.equal(sequenceFor(selected,'stances','neutral').available,true);
  assert.equal(sequenceFor(selected,'animations','neutral').reason,'state-unavailable');
  assert.equal(sequenceFor(selected,'stances','typo').reason,'unknown-state');
  assert.equal(sequenceFor(selected,'typo','neutral').reason,'unknown-state');
});
test('sampling honors unequal durations, boundaries, clamp and explicit loop', () => {
  const seq=sequenceFor(selectProposal(catalog,'courtDuelist','v01'),'animations','attack');
  assert.equal(seq.durationMs,620);
  assert.equal(sampleSequence(seq,179).index,0);
  assert.equal(sampleSequence(seq,180).index,1);
  assert.equal(sampleSequence(seq,270).index,2);
  assert.equal(sampleSequence(seq,620).index,3);
  assert.equal(sampleSequence(seq,620).complete,true);
  assert.equal(sampleSequence(seq,620,{loop:true}).index,0);
  assert.throws(()=>sampleSequence(seq,NaN),RangeError);
  assert.throws(()=>sampleSequence(seq,-1),RangeError);
  assert.equal(sampleSequence({available:false,reason:'state-unavailable'},0).reason,'state-unavailable');
});
test('positioning respects off-center feet, scale and mirrored anchors', () => {
  const frame={canvas:[512,512],anchors:{feet:[0.75,0.875]}};
  assert.deepEqual(positionFrame(frame,[100,200],{scale:0.5}),{available:true,x:-92,y:-24,width:256,height:256,flipX:false});
  assert.equal(positionFrame(frame,[100,200],{scale:0.5,flipX:true}).x,36);
  assert.equal(positionFrame(frame,[0,0],{anchor:'head'}).reason,'anchor-unavailable');
  assert.throws(()=>positionFrame(frame,[NaN,0]),RangeError);
  assert.throws(()=>positionFrame(frame,[0,0],{scale:0}),RangeError);
});

test('asset resolution is host-injected and stays outside core', async () => {
  const frame=sequenceFor(selectProposal(catalog,'wyrmLord','v01'),'stances','neutral').frames[0];
  assert.equal(resolveFrameAsset(frame,p=>'https://example.test/'+p).asset,'https://example.test/'+frame.asset);
  assert.equal(resolveFrameAsset({asset:'assets/front.png'}).reason,'asset-unavailable');
  assert.equal(resolveFrameAsset({asset:'art/enemy-back-motion/../evil.png'}).reason,'asset-unavailable');
  const api=await readFile(new URL('./index.mjs',import.meta.url),'utf8');
  assert.ok(!/\bimport\s|registerTool|document\.|window\./.test(api));
  assert.equal(catalog.runtimeVerified,false);
});
