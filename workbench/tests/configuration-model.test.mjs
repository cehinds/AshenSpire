// node --test workbench/tests/configuration-model.test.mjs — the Configuration studio's pure model.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../modules/configuration/model.mjs';

test('profileFiles offers game.json, presets and bundles, and nothing else', () => {
  const out = C.profileFiles([
    'games/ashenspire/presets/current.json',
    'games/ashenspire/game.lock.json',
    'games/ashenspire/bundles/core/bundle.json',
    'games/ashenspire/packs/core/pack.json',
    'games/ashenspire/game.json',
    'games/ashenspire/presets/core.json',
    'games/ashenspire/bundles/current/bundle.json',
    'games/ashenspire/bundles/current/other.json',
  ]);
  assert.deepEqual(out.map((f) => f.path), [
    'games/ashenspire/game.json',
    'games/ashenspire/presets/core.json',
    'games/ashenspire/presets/current.json',
    'games/ashenspire/bundles/core/bundle.json',
    'games/ashenspire/bundles/current/bundle.json',
  ]);
  assert.deepEqual(out.map((f) => f.resolves), [true, true, true, false, false]);
});
