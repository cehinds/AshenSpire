// Codex review on PR #2835: a finesse card's static face reads DEX but must use the physical-damage weight, not the Block weight.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('static faces weight a finesse hit on the physical-damage channel', () => {
  const src = readFileSync(new URL('../src/model/playingCard.js', import.meta.url), 'utf8');
  assert.match(src, /ChannelWeight\(faceEffects, magicHit \? 'pr' : 'ar'\)/);
  assert.doesNotMatch(src, /finesseHit \? 'dr' : 'ar'/);
});
