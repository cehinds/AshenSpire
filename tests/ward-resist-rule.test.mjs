import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { enqueueExpandedAction } from '../src/engine/combatExpansionActions.js';
import { executeAction } from '../src/engine/actions.js';
import { createCombatExpansionRuleSnapshot, combatExpansionRulesProblems } from '../src/model/combatExpansionRules.js';

// Owner ruling 2026-10-11: Ward absorbs at most half of a spell's damage,
// never more than the pool, and every point it absorbs is spent. At 0 it is broken.

const drainQueue = combat => { while (combat.queue.length) executeAction(combat, combat.queue.shift()); };

function fixture(effects = [{ op: 'damage', target: 'enemy', amount: 5, hits: 2 }]) {
  const registries = createRegistries({ ...contentBundle, cards: contentBundle.cards.map(card => card.id === 'starstonePebble'
    ? { ...card, effects, cost: 0, manaCost: 0, upgrade: undefined } : card) });
  const combat = createCombat({ registries, rng: createRng(801), combatExpansionVersion: 2,
    enemyIds: ['wanderingSoldier'], player: { classId: 'starseer', maxHp: 100, hp: 100,
      maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1,
      deck: [{ cardId: 'starstonePebble', instanceId: 'paired', upgraded: false }] } });
  const enemy = combat.enemies[0]; enemy.block = enemy.barrier = 0;
  enemy.damageResistanceFlat = {}; enemy.damageWeaknessPercent = {};
  enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 100, ward: 3 };
  delete enemy.combatCounter; delete enemy.combatEvade; delete enemy.combatStance;
  enemy.persistentWard.value = enemy.persistentWard.max = 3;
  return { combat, enemy, registries };
}

const spellCarrier = { cardId: 'starstonePebble', tags: ['camp:spell', 'maneuver:casting'],
  combatProfile: { camp: 'spell', maneuver: 'casting', school: 'force', damageType: 'blunt', reach: 'near', targeting: 'single' } };

// Queue one spell action through the same planning path as a played card, then run it.
function castSpell(combat, enemy, amount) {
  const actions = [{ effect: { op: 'damage', target: 'enemy', amount }, source: combat.player, owner: combat.player, target: enemy, card: spellCarrier, meta: {} }];
  enqueueExpandedAction(combat, actions, { source: combat.player, target: enemy, carrier: spellCarrier });
  drainQueue(combat);
}

function captureEvents(combat) {
  const seen = [], emit = combat.emit;
  combat.emit = (type, payload) => { seen.push({ type, ...payload }); return emit(type, payload); };
  return seen;
}

test('Ward 40 absorbs at most half of a spell: damage taken is at least half and the pool drops by the absorbed sum', () => {
  const plain = fixture(); plain.enemy.persistentWard.value = plain.enemy.persistentWard.max = 0;
  const plainBefore = plain.enemy.hp;
  dispatch(plain.combat, { type: 'playCard', cardInstanceId: 'paired', targetId: plain.enemy.id });
  const unwarded = plainBefore - plain.enemy.hp;

  const { combat, enemy } = fixture();
  enemy.persistentWard.value = enemy.persistentWard.max = 40;
  const before = enemy.hp;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: 'paired', targetId: enemy.id });
  const damage = out.events.filter(event => event.type === 'damageDealt' && event.targetId === enemy.id);
  const absorbed = damage.reduce((sum, event) => sum + event.wardResisted, 0);
  const taken = before - enemy.hp;

  assert.ok(unwarded > 0);
  assert.ok(taken * 2 >= unwarded, `damage taken ${taken} must be at least half of ${unwarded}`);
  assert.equal(absorbed, Math.floor(unwarded * 0.5));
  assert.equal(enemy.persistentWard.value, 40 - absorbed, 'pool drops by exactly the absorbed sum');
});

test('repeated spells drain Ward to 0, after which nothing is absorbed and full damage lands', () => {
  const { combat, enemy } = fixture([]);
  enemy.hp = enemy.maxHp = 1000;
  enemy.persistentWard.value = enemy.persistentWard.max = 10;
  const seen = captureEvents(combat);
  for (let cast = 0; cast < 12; cast++) castSpell(combat, enemy, 5);
  assert.equal(enemy.persistentWard.value, 0, 'Ward is broken at 0');
  const dealt = seen.filter(event => event.type === 'damageDealt' && event.targetId === enemy.id);
  const late = dealt.slice(-3);
  assert.ok(late.length === 3);
  for (const event of late) {
    assert.equal(event.wardResisted, 0);
    assert.equal(event.amount, 5);
  }
  const hpBeforeLast = enemy.hp;
  castSpell(combat, enemy, 5);
  assert.equal(hpBeforeLast - enemy.hp, 5, 'a broken Ward lets the full spell through');
});

test('a Ward spend follows its damageDealt with cause resisted', () => {
  const { combat, enemy } = fixture();
  enemy.persistentWard.value = enemy.persistentWard.max = 40;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: 'paired', targetId: enemy.id });
  const dealtAt = out.events.findIndex(event => event.type === 'damageDealt' && event.targetId === enemy.id);
  const spentAt = out.events.findIndex(event => event.type === 'persistentWardChanged' && event.cause === 'resisted' && event.targetId === enemy.id);
  assert.ok(dealtAt >= 0 && spentAt > dealtAt, 'persistentWardChanged must come after damageDealt');
  assert.ok(out.events[spentAt].spent > 0);
});

test('previewing a spell does not change the Ward pool', () => {
  const { combat, enemy } = fixture();
  enemy.persistentWard.value = enemy.persistentWard.max = 40;
  previewCard(combat, 'paired', enemy.id);
  previewCard(combat, 'paired', enemy.id);
  assert.equal(enemy.persistentWard.value, 40);
});

test('saved rules without statuses.ward stay valid; resistMaxShare outside 0 to 1 is rejected', () => {
  const good = createCombatExpansionRuleSnapshot();
  assert.deepEqual(combatExpansionRulesProblems(good), []);
  const old = structuredClone(good); delete old.statuses.ward;
  assert.deepEqual(combatExpansionRulesProblems(old), []);
  const bad = structuredClone(good); bad.statuses.ward.resistMaxShare = 2;
  assert.ok(combatExpansionRulesProblems(bad).some(problem => /resistMaxShare/.test(problem)));
});

// Queue one action of any camp (two hits by default) through the played-card planning path.
function castAction(combat, enemy, profile, { amount = 5, hits = 2 } = {}) {
  const card = { cardId: 'starstonePebble', tags: [`camp:${profile.camp}`] };
  const effect = { op: 'damage', target: 'enemy', amount, hits, combatProfile: { reach: 'near', targeting: 'single', ...profile } };
  const actions = [{ effect, source: combat.player, owner: combat.player, target: enemy, card, meta: {} }];
  enqueueExpandedAction(combat, actions, { source: combat.player, target: enemy, carrier: card });
  drainQueue(combat);
}

test('Ward drained by a rider between the contacts of one spell action is not over-reported or over-absorbed', () => {
  const forceSpell = { camp: 'spell', maneuver: 'casting', school: 'force', damageType: 'force' };
  // Control: the same two-hit spell into a target with no Ward.
  const plain = fixture(); plain.enemy.hp = plain.enemy.maxHp = 1000;
  plain.enemy.persistentWard.value = plain.enemy.persistentWard.max = 0;
  const plainBefore = plain.enemy.hp;
  castAction(plain.combat, plain.enemy, forceSpell);
  const unwarded = plainBefore - plain.enemy.hp;

  // Ward 5 absorbs its planned share on hit one; the force rider then strips 2 more before hit two lands.
  const { combat, enemy } = fixture();
  enemy.hp = enemy.maxHp = 1000;
  enemy.persistentWard.value = enemy.persistentWard.max = 5;
  const seen = captureEvents(combat);
  const before = enemy.hp;
  castAction(combat, enemy, forceSpell);
  const dealt = seen.filter(event => event.type === 'damageDealt' && event.targetId === enemy.id);
  const spent = seen.filter(event => event.type === 'persistentWardChanged' && event.targetId === enemy.id && event.cause === 'resisted')
    .reduce((sum, event) => sum + event.spent, 0);
  const reported = dealt.reduce((sum, event) => sum + event.wardResisted, 0);
  const stripped = seen.filter(event => event.type === 'combatWardStripped' && event.targetId === enemy.id);

  assert.equal(dealt.length, 2, 'two hits land');
  assert.ok(stripped.length > 0, 'the rider drains Ward mid-action');
  assert.equal(reported, spent, 'RESISTED reports exactly the Ward that was spent');
  assert.equal(enemy.persistentWard.value, 5 - spent - stripped.reduce((sum, event) => sum + event.amount, 0), 'pool drops by spent plus stripped');
  assert.equal(enemy.persistentWard.value, 0, 'Ward is broken at 0 by the end of the action');
  assert.equal(before - enemy.hp, unwarded - spent, 'each point Ward spent is damage not taken; the rest lands');
  for (const event of dealt) assert.ok(event.wardResisted >= 0);
});

test('a physical two-hit action never emits wardResisted or touches the Ward pool', () => {
  const { combat, enemy } = fixture();
  enemy.hp = enemy.maxHp = 1000;
  enemy.persistentWard.value = enemy.persistentWard.max = 10;
  const seen = captureEvents(combat);
  castAction(combat, enemy, { camp: 'physical', maneuver: 'attack', school: 'steel', damageType: 'slashing' });
  const dealt = seen.filter(event => event.type === 'damageDealt' && event.targetId === enemy.id);
  assert.equal(dealt.length, 2, 'two hits land');
  for (const event of dealt) assert.equal(event.wardResisted, 0);
  assert.equal(seen.filter(event => event.type === 'persistentWardChanged' && event.targetId === enemy.id).length, 0);
  assert.equal(enemy.persistentWard.value, 10);
});
