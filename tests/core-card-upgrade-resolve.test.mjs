// Card upgrades 3/7: resolveCard and projectGameCard apply stored upgrade steps; the cache key carries them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries, profile } from './helpers/fixcore-combat-rules.mjs';
import { resolveCard } from '../src/model/registries.js';
import { projectGameCard } from '../src/model/gameProfile.js';

const subject = { gameProfile: profile };
const amount = (def) => def.effects.find((e) => e.op === 'damage').amount;
const inst = (extra) => ({ instanceId: 'i', cardId: 'core.strike', ...extra });

test('old save: upgraded:true with no list still resolves to the authored face', () => {
  const old = resolveCard(registries, inst({ upgraded: true }));
  const listed = resolveCard(registries, inst({ upgraded: true, upgradeSteps: [{ k: 'authored' }] }));
  assert.deepEqual(old, listed);
  assert.equal(old.upgraded, true);
});

test('resolveCard applies stored steps and does not reuse a cached face for other steps', () => {
  const base = amount(resolveCard(registries, inst({})));
  const one = resolveCard(registries, inst({ upgraded: true, upgradeSteps: [{ k: 'authored' }] }));
  const two = resolveCard(registries, inst({ upgraded: true, upgradeSteps: [{ k: 'authored' }, { k: 'dmg', n: 3 }] }));
  const twoB = resolveCard(registries, inst({ upgraded: true, upgradeSteps: [{ k: 'authored' }, { k: 'dmg', n: 4 }] }));
  assert.equal(amount(two), amount(one) + 3);
  assert.equal(amount(twoB), amount(one) + 4);
  assert.equal(two.name, `${resolveCard(registries, inst({})).name}+2`);
  assert.equal(amount(resolveCard(registries, inst({}))), base, 'the plain card is untouched');
});

test('a rolled first step on a card applies without the authored block', () => {
  const plain = resolveCard(registries, inst({}));
  const rolled = resolveCard(registries, inst({ upgraded: true, upgradeSteps: [{ k: 'dmg', n: 2 }] }));
  assert.equal(amount(rolled), amount(plain) + 2);
});

test('projectGameCard (Core face) matches resolveCard for the same steps', () => {
  for (const upgradeSteps of [[{ k: 'authored' }], [{ k: 'authored' }, { k: 'dmg', n: 3 }], [{ k: 'dmg', n: 2 }, { k: 'blk', n: 2 }]]) {
    const instance = inst({ upgraded: true, upgradeSteps });
    const projected = projectGameCard(subject, instance);
    const resolved = resolveCard(registries, instance);
    assert.equal(amount(projected), amount(resolved));
    assert.equal(projected.name, resolved.name);
  }
  assert.equal(projectGameCard(subject, inst({ upgraded: true })).name, projectGameCard(subject, inst({ upgraded: true, upgradeSteps: [{ k: 'authored' }] })).name);
});

test('a plain instance is not affected by an empty step list', () => {
  assert.deepEqual(resolveCard(registries, inst({ upgradeSteps: [] })), resolveCard(registries, inst({})));
});
