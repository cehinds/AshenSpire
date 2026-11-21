// W25 step 1: no upgrade is offered that changes a shown number and nothing the engine does.
// Probe: every shipped Core card, plain and after its authored upgrade, every rolled option played against the card before it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { play, outcome, registries } from './helpers/upgrade-probe.mjs';
import { profile } from './helpers/fixcore-combat-rules.mjs';
import { nextUpgradeOptions } from '../src/model/cardUpgradeLimits.js';

const ids = registries.cards.all().filter((c) => c.id.startsWith('core.')).map((c) => c.id);
// Ramp upgrades act from the second play, and Hexmark's contest fails in the single-play harness: a single play cannot show them.
const RAMP = new Set(['core.flick', 'core.brace', 'core.temperedEdge', 'core.hexmark']);
// Menu steps whose effect is not in the single play (end of turn, start of the next fight, a trait): tests/w25-upgrade-menu.test.mjs proves each in the engine.
// Dropping Ethereal acts at the end of a turn the card stays in hand, and stopping a rising cost acts from the second play:
// tests/card-cost-balance.test.mjs proves both in the engine.
const DEFERRED = new Set(['retain', 'innate', 'holdOne', 'reaction', 'unethereal', 'steady']);
// A run-long `attr` step (+1 INT/WIS) changes no single play: it acts when the deck loads into a fight. tests/w25-live-stats-run-bonus.test.mjs
// ('the run-long +1 INT applies to the effective attributes, the ratings, the sheet and a fight') proves it there.
const isDeferred = (step) => (step.k === 'fx' && DEFERRED.has(step.fx)) || step.k === 'attr';
const PER_CARD = 14;

test('every rolled upgrade option changes what the card does when played', () => {
  const noOps = [];
  let checked = 0;
  for (const id of ids) {
    const base = registries.cards.get(id);
    const classId = { reaver: 'reaver', starseer: 'starseer', rogue: 'rogue', herald: 'herald' }[base.class] || 'reaver';
    for (const lead of [[], base.upgrade ? [{ k: 'authored' }] : null]) {
      if (lead === null) continue;
      const run = { seed: 7, gameProfile: profile, rangePolicy: {} };
      const inst = { instanceId: 'probe-1', cardId: id, ...(lead.length ? { upgraded: true, upgradeSteps: lead } : { upgraded: false }) };
      const options = nextUpgradeOptions(run, inst, base, registries, 40, { noAuthored: true, everyFamily: true })
        .filter((step) => !isDeferred(step)).slice(0, PER_CARD);
      for (const step of options) {
        checked += 1;
        // A second-target step can only show itself with a second enemy on the field.
        const opts = { classId, ...(step.k === 'fx' && step.fx === 'target' ? { enemies: ['wanderingSoldier', 'wanderingSoldier'] } : {}) };
        const before = outcome(play(id, lead.length ? { upgraded: true, upgradeSteps: lead } : {}, opts));
        const after = outcome(play(id, { upgraded: true, upgradeSteps: [...lead, step] }, opts));
        if (after === before && !RAMP.has(id)) noOps.push(`${id}${lead.length ? '+' : ''} ${JSON.stringify(step)}`);
      }
    }
  }
  assert.ok(checked > 600, `probe checked ${checked} options`);
  assert.deepEqual(noOps, []);
});


const RUN = { seed: 7, gameProfile: profile, rangePolicy: {} };
const kindsOf = (cardId, steps = []) => {
  const base = registries.cards.get(cardId);
  const inst = { instanceId: 'k1', cardId, ...(steps.length ? { upgraded: true, upgradeSteps: steps } : { upgraded: false }) };
  return nextUpgradeOptions(RUN, inst, base, registries, 30, { noAuthored: true, everyFamily: true });
};

test('a Smash card is never offered a Poise step, and its authored upgrade keeps the Poise number the engine ignores', () => {
  for (const id of ['core.hammerBlow', 'core.stunningBlow', 'core.skullsplitter', 'core.ironbreaker', 'core.rendingSmash']) {
    assert.equal(kindsOf(id).some((s) => s.k === 'poise'), false, id);
    const card = registries.cards.get(id);
    const poise = (effects) => effects.find((e) => e.op === 'poiseDamage').amount;
    assert.equal(poise(card.upgrade.effects), poise(card.effects), `${id} authored Poise matches the base`);
  }
});

test('Venom Spray upgrade does not raise Venom past the engine cap of 3', () => {
  const card = registries.cards.get('core.venomSpray');
  assert.equal(card.upgrade.effects.find((e) => e.status === 'venom').stacks, 3);
  assert.ok(card.upgrade.effects.find((e) => e.op === 'damage').amount > card.effects.find((e) => e.op === 'damage').amount);
});

test('a rank-down is only offered on a card that pays Mana, and no option moves a card to Ranged', () => {
  for (const id of ['core.hammerBlow', 'core.whirlwind', 'core.feint', 'core.backstep']) {
    const base = registries.cards.get(id);
    if (!base) continue;
    const offered = kindsOf(id).some((s) => s.tag === 'rank.cantrip');
    if (!(base.manaCost > 0)) assert.equal(offered, false, `${id} pays no Mana`);
  }
  for (const id of ids) for (const step of kindsOf(id)) {
    assert.notEqual(step.tag, 'range:ranged', id);
    assert.notEqual(step.tag, 'maneuver:ranged', id);
  }
});

import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

// A magic weapon's Smith tier raises its spells (PR), not only the physical Strike.
function spellDamage(itemTier) {
  const run = createRunState({ registries, classId: 'starseer', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  if (itemTier) run.itemUpgradeLevels = { 'armament/boneSceptre': itemTier };
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const inst = { instanceId: 'p1', cardId: 'core.spark', upgraded: false };
  for (const pile of Object.values(combat.piles)) pile.length = 0;
  combat.piles.hand.push(inst);
  for (const e of combat.enemies) Object.assign(e, { hp: 500, maxHp: 500, block: 0, persistentPoise: { value: 0, max: 80 } });
  combat.player.stamina = combat.player.maxStamina = 20; combat.player.mana = 20;
  primeAccuracyRolls(combat, { count: 3 });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'p1', targetId: combat.enemies[0].id });
  return combat.eventLog.slice(start).find((e) => e.type === 'damageDealt').amount;
}
// Owner, 2026-11-17 (gear `statPoints`): a tier adds an attribute point split by the sceptre's weights, not PR, so a
// tier whose point lands on the lower of INT/WIS leaves PR = max(INT, WIS) alone; the ladder still raises the spell.
test('a magic weapon tier raises spell damage', () => {
  const amounts = [0, 1, 2, 3].map(spellDamage);
  assert.ok(amounts.every((amount, i) => i === 0 || amount >= amounts[i - 1]) && amounts[3] > amounts[0], amounts.join(','));
});
