// Core profile: an upgraded copy plays and renders at its upgraded grade (projectGameCard applies def.upgrade once).
import test from 'node:test';
import assert from 'node:assert/strict';
import { live, registries } from './helpers/fixcore-combat-rules.mjs';
import { dispatch } from '../src/engine/combat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { playingCardModel } from '../src/model/playingCard.js';
import { projectGameCard } from '../src/model/gameProfile.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';

const amounts = def => def.effects.map(e => e.amount);
function playCopy(cardId, upgraded) {
  const combat = live();
  const enemy = combat.enemies[0];
  Object.assign(enemy, { hp: 500, maxHp: 500, block: 0, barrier: 0, persistentPoise: { value: 0, max: 0 } });
  const instance = { instanceId: `t-${cardId}-${upgraded}`, cardId, upgraded };
  combat.piles.hand.push(instance);
  combat.player.stamina = combat.player.maxStamina = 20;
  primeAccuracyRolls(combat, { count: 3 });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: enemy.id });
  const hit = combat.eventLog.slice(start).find(e => e.type === 'damageDealt' && e.targetId === enemy.id);
  return { combat, instance, hit, resolved: resolveCombatCard(combat, instance) };
}

for (const [cardId, base, up] of [['core.pommelStrike', [5, 4], [7, 6]], ['core.hammerBlow', null, null]]) {
  test(`${cardId}: upgraded copy resolves, renders and plays at the upgraded grade`, () => {
    const b = playCopy(cardId, false), u = playCopy(cardId, true);
    const baseDef = projectGameCard(b.combat, cardId), upDef = baseDef.upgrade;
    const wantBase = base || amounts(baseDef), wantUp = up || upDef.effects.map(e => e.amount);
    assert.notDeepEqual(wantBase, wantUp, 'fixture: the upgrade changes numbers');
    assert.deepEqual(amounts(b.resolved), wantBase);
    assert.deepEqual(amounts(u.resolved), wantUp);
    assert.equal(u.resolved.name, `${baseDef.name}+`);
    assert.equal(b.resolved.name, baseDef.name);
    assert.equal(u.hit.amount - b.hit.amount > 0, true, 'applied damage rises with the upgrade');
    const face = playingCardModel(registries, u.instance, { rules: u.combat, definition: undefined });
    const baseFace = playingCardModel(registries, b.instance, { rules: b.combat });
    assert.equal(face.name, `${baseDef.name}+`);
    assert.notEqual(JSON.stringify(face), JSON.stringify(baseFace));
    assert.ok(JSON.stringify(face).includes(String(wantUp[0])), 'face text carries the upgraded number');
  });
}

test('core.pommelStrike upgraded hit lands for the upgraded damage in the log', () => {
  const u = playCopy('core.pommelStrike', true), b = playCopy('core.pommelStrike', false);
  assert.equal(500 - u.combat.enemies[0].hp, u.hit.amount);
  assert.equal(u.hit.amount - b.hit.amount, 2);
});

test('Legacy profile resolution of an upgraded card is unchanged', () => {
  const legacy = createRegistries(contentBundle);
  const id = contentBundle.cards.find(c => c.upgrade?.effects && !c.gradeProfiles && legacy.cards.has(c.id)).id;
  const up = resolveCard(legacy, { cardId: id, upgraded: true }), base = resolveCard(legacy, { cardId: id });
  assert.equal(up.upgraded, true);
  assert.equal(up.name, legacy.cards.get(id).upgrade.name ?? `${base.name}+`);
  assert.deepEqual(up.effects, legacy.cards.get(id).upgrade.effects);
  assert.equal(projectGameCard(legacy, { cardId: id, upgraded: true }), null);
});
