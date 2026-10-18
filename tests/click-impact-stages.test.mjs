import test from 'node:test';
import assert from 'node:assert/strict';
import { orderedImpactSample } from '../tools/click-impact-stages.mjs';

const fixture = () => ({ up: 0, contact: 1210, number: 2460,
  timing: { intentMs: 500, wordMs: 500, afterSpriteMs: 500, reactionMs: 500, scale: 1, playbackRate: 0.5, spriteSpeed: { lungeMs: 390 }, fixCore: true },
  clip: { impactMs: 195, totalMs: 390, activeMs: 390 }, holdMs: 60,
  stages: ['intent', 'action', 'sprite', 'contact', 'reaction', 'damage', 'hud', 'resolution'].map((name, i) => [[10, 510, 1010, 1205, 1960, 2460, 2460, 2460][i], name, 'player']),
});

test('raw latency retains the authored waits, half-rate clip and receipt hold; only overhead is gated', () => {
  assert.deepEqual(orderedImpactSample(fixture()), { contact: 1210, number: 2460,
    expectedContact: 1195, expectedNumber: 2450, contactOverhead: 15, numberOverhead: 10 });
});

test('default settings cannot silently shorten the declared waits or speed the sprite', () => {
  for (const [key, value] of [['intentMs', 0], ['wordMs', 499], ['afterSpriteMs', 0], ['reactionMs', 180], ['playbackRate', 1], ['scale', 0.5]]) {
    const sample = fixture(); sample.timing[key] = value;
    assert.throws(() => orderedImpactSample(sample), /default Normal|remain 500/);
  }
});

test('missing, reordered or shortened stages fail independently of the overhead verdict', () => {
  const missing = fixture(); missing.stages.splice(1, 1);
  assert.throws(() => orderedImpactSample(missing), /reordered stages/);
  const short = fixture(); short.stages[1][0] -= 100;
  assert.throws(() => orderedImpactSample(short), /intent → action/);
  const early = fixture(); early.stages[5][0] -= 100;
  assert.throws(() => orderedImpactSample(early), /reaction → damage/);
  const recovery = fixture(); recovery.stages[4][0] -= 100;
  assert.throws(() => orderedImpactSample(recovery), /sprite → reaction/);
});

test('a missing clip, mismatched active duration or readout before its stage cannot pass', () => {
  for (const mutate of [sample => { sample.clip = null; }, sample => { sample.clip.activeMs = 195; }, sample => { sample.contact = 10; }, sample => { sample.number = 10; }]) {
    const sample = fixture(); mutate(sample);
    assert.throws(() => orderedImpactSample(sample));
  }
});

test('late timers retain all their extra time in the overhead, rather than expanding declared allowance', () => {
  const sample = fixture();
  sample.contact += 500; sample.number += 800;
  const measured = orderedImpactSample(sample);
  assert.ok(measured.contactOverhead > 400);
  assert.ok(measured.numberOverhead > 750);
});

test('a committed hostile miss proves contact and stages without fabricating a number', () => {
  const sample = fixture(); sample.number = null;
  assert.throws(() => orderedImpactSample(sample), /without a wholly missed action/);
  sample.receipts = [{ type: 'attackMissed' }];
  const measured = orderedImpactSample(sample);
  assert.equal(measured.number, null); assert.equal(measured.numberOverhead, null);
  assert.equal(measured.contactOverhead, 15);
});

test('one missed hit cannot excuse missing numbers from another hit or protection payload', () => {
  for (const type of ['attackHit', 'damageDealt', 'blockGained', 'meterGuardGained', 'ratingImpact']) {
    const sample = fixture(); sample.number = null;
    sample.receipts = [{ type: 'attackMissed' }, { type }];
    assert.throws(() => orderedImpactSample(sample), /without a wholly missed action/);
  }
});
