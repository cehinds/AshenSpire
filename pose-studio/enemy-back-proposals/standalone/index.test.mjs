import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { selectProposal, sequenceFor, sampleSequence, positionFrame, resolveFrameAsset } from './index.mjs';
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const catalog = await json('./catalog.json');
const source = await json('../manifest.json');
test('catalog preserves all source artwork and provenance exactly', async () => {
  assert.deepEqual(catalog.actors, source.actors);
  assert.equal(catalog.actors.length, 13);
  assert.equal(catalog.actors.reduce((n,a)=>n+a.proposals.length,0),130);
  const motion = new Set();
  for (const actor of catalog.actors) for (const proposal of actor.proposals) {
    const frames = [...Object.values(proposal.stances), ...Object.values(proposal.animations||{}), ...Object.values(proposal.reactions||{})].flatMap(s=>s.frames);
    if (proposal.designFrame) frames.push(proposal.designFrame);
    for (const frame of frames) {
      assert.match(frame.asset,/^art\/enemy-back-(proposals|motion)\/[a-zA-Z0-9_./-]+\.png$/);
      assert.ok(!frame.asset.split('/').includes('..'));
      const bytes = await readFile(new URL('../../../'+frame.asset, import.meta.url));
      assert.equal(createHash('sha256').update(bytes).digest('hex'),frame.sha256);
      if(frame.asset.startsWith('art/enemy-back-motion/')) motion.add(frame.asset);
    }
  }
  assert.equal(motion.size,57);
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
