import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import * as S from '../src/engine/statuses.js';
import { recoverStatusesAtOwnerStart } from '../src/engine/combatStatusControl.js';

const cards = new Map(contentBundle.cards.map(card => [card.id, card]));
const buildupStatuses = effects => (effects || []).filter(effect => effect.op === 'buildup').map(effect => effect.status);

test('a damaging decay spell fills only the Necrotic Blight gauge, never Crimson Blight', () => {
  const card = applyCombatExpansionCard(cards.get('flagellation'));
  const statuses = buildupStatuses(card.effects);
  assert.equal(statuses.filter(status => status === 'necroticBlight').length, 1);
  assert.equal(statuses.includes('crimsonBlight'), false);
  const upgraded = buildupStatuses(card.upgrade.effects);
  assert.equal(upgraded.filter(status => status === 'necroticBlight').length, 1);
  assert.equal(upgraded.includes('crimsonBlight'), false);
});

test('the decay spell rider uses the curse recovery profile', () => {
  const card = applyCombatExpansionCard(cards.get('flagellation'));
  const rider = card.effects.find(effect => effect.op === 'buildup' && effect.status === 'necroticBlight');
  assert.equal(rider.recoveryProfile, 'curse');
});

for (const id of ['plagueBearer', 'blightwardLash', 'scourge', 'witheringTouch', 'rotMote']) {
  test(`decay card ${id} that prints Crimson Blight adds no automatic Necrotic Blight`, () => {
    const card = applyCombatExpansionCard(cards.get(id));
    assert.equal(buildupStatuses(card.effects).includes('necroticBlight'), false, id);
    if (card.upgrade?.effects) assert.equal(buildupStatuses(card.upgrade.effects).includes('necroticBlight'), false, `${id} upgrade`);
  });
}

test('v2 Blight Bloom doubles Necrotic Blight through the gauge, like Crimson', () => {
  const card = applyCombatExpansionCard(cards.get('blightBloom'));
  const statuses = buildupStatuses(card.effects);
  assert.ok(statuses.includes('crimsonBlight') && statuses.includes('necroticBlight'), JSON.stringify(statuses));
  assert.equal(card.effects.some(effect => effect.op === 'applyStatus' && effect.status === 'necroticBlight'), false);
});

test('a card that prints Crimson Blight keeps its printed Crimson Blight buildup', () => {
  const card = applyCombatExpansionCard(cards.get('rotMote'));
  assert.ok(buildupStatuses(card.effects).includes('crimsonBlight'));
});

// ---- Engine: one Necrotic Blight application per hit; no passive recovery ----
const REG = createRegistries(contentBundle);
// Every status-recovery roll is a 1, so any row that allows a recovery roll recovers.
const recoveringRng = seed => {
  const rng = createRng(seed);
  return new Proxy(rng, { get: (target, key) => key === 'int'
    ? (stream, lo, hi) => stream === 'statusRecovery' ? lo : target.int(stream, lo, hi)
    : typeof target[key] === 'function' ? target[key].bind(target) : target[key] });
};
const v2Combat = ({ cardId = 'flagellation', rng = createRng(1) } = {}) => createCombat({ registries: REG, rng, combatExpansionVersion: 2,
  player: { classId: 'herald', maxHp: 78, hp: 78, mana: 3, maxMana: 3, stamina: 3, maxStamina: 3, energyMax: 3, drawPerTurn: 5,
    deck: Array(5).fill(cardId).map((id, i) => ({ instanceId: `c${i}`, cardId: id, upgraded: false })), relicIds: [] },
  enemyIds: ['courtMarionette'] });

test('a damaging decay spell hit applies Necrotic Blight pressure once: the card rider suppresses the Necrotic matchup rider', () => {
  const c = v2Combat();
  const enemy = c.enemies[0];
  const before = c.eventLog.length;
  dispatch(c, { type: 'playCard', cardInstanceId: c.piles.hand[0].instanceId, targetId: enemy.id });
  const events = c.eventLog.slice(before);
  assert.ok(events.some(event => event.type === 'hpLost' && event.targetId === enemy.id), 'the hit cost HP, so the Necrotic rider was eligible');
  const pressure = events.filter(event => event.type === 'statusPressure' && event.targetId === enemy.id);
  assert.deepEqual(pressure.map(event => [event.status, event.acceptedBuildup]), [['necroticBlight', 3]]);
});

test('passive recovery never removes Necrotic Blight; it still removes Crimson Blight', () => {
  const c = v2Combat({ rng: recoveringRng(1) });
  const enemy = c.enemies[0];
  S.applyStatus(c, enemy, 'necroticBlight', 2);
  S.applyStatus(c, enemy, 'crimsonBlight', 2);
  // Called directly: a v2 dispatch runs on a transaction copy with its own rng.
  const rolled = recoverStatusesAtOwnerStart(c, enemy, { cycle: 99 });
  assert.ok(rolled.some(event => event.status === 'crimsonBlight' && event.success && event.removed > 0), 'the forced roll does recover a recoverable row');
  assert.equal(rolled.some(event => event.status === 'necroticBlight'), false, 'Necrotic Blight is never rolled for');
  assert.equal(S.getStacks(enemy, 'necroticBlight'), 2);
});
