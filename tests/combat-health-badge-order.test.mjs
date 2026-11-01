import test from 'node:test';
import assert from 'node:assert/strict';
import { combatHealthModel, visibleBadges } from '../src/ui/models/CombatHealthModel.js';
import { combatHealthRow, badgeTipHtml } from '../src/ui/components/combatHealth.js';
import { meter } from '../src/ui/kit/index.js';
import { withKitDom } from './helpers/kit-dom.mjs';

// Owner 2026-11-01: badge order is Block > Poise > Evade > Ward, Precision, Counter, Reflect > stance, at most 3 slots, a 3rd-slot "+N" overflow.
const stance = { maneuver: 'counter', label: 'Counter', help: 'Stance: Counter' };
const all = { defense: 5, poise: 3, poiseMax: 8, evasion: 2, ward: 4, precision: 3, counterStacks: 2, reflectStacks: 1, stance };
const hp = () => meter({ id: 'hp', value: '18/20', cur: 18, max: 20 });
const kinds = row => [...row.querySelectorAll('.combat-health-badge')].map(n => n.dataset.defenseKind);

test('the model orders badges Block, Poise, Evade, Ward, Precision, Counter, Reflect, stance', () => {
  assert.deepEqual(combatHealthModel(all).badges.map(b => b.kind), ['shield', 'poise', 'evade', 'ward', 'precision', 'counter', 'reflect', 'stance']);
});

test('three badges all show, with no overflow badge', () => withKitDom(() => {
  const values = { defense: 5, poise: 3, evasion: 2 };
  assert.equal(visibleBadges(combatHealthModel(values).badges).overflow, null);
  const row = combatHealthRow(hp(), values, { tooltips: false });
  assert.deepEqual(kinds(row), ['shield', 'poise', 'evade']);
  assert.equal(row.querySelector('.combat-health-overflow'), null);
}));

test('five badges show the first two plus a +3 overflow badge, and the model keeps all five', () => withKitDom(() => {
  const values = { defense: 5, poise: 3, evasion: 2, ward: 4, precision: 3 };
  assert.equal(combatHealthModel(values).badges.length, 5);
  const split = visibleBadges(combatHealthModel(values).badges);
  assert.deepEqual(split.shown.map(b => b.kind), ['shield', 'poise']);
  assert.equal(split.overflow.label, '+3');
  const row = combatHealthRow(hp(), values, { tooltips: false });
  assert.deepEqual(kinds(row), ['shield', 'poise', 'overflow']);
  const node = row.querySelector('.combat-health-badge.combat-health-overflow');
  assert.equal(node.dataset.defenseKind, 'overflow');
  assert.equal(node.querySelector('.combat-health-badge-value').textContent, '+3');
}));

test('the overflow aria-label and tooltip list the hidden badges as "label value"', () => withKitDom(() => {
  const values = { defense: 5, poise: 3, evasion: 2, ward: 4, precision: 3 };
  const badges = combatHealthModel(values).badges;
  const row = combatHealthRow(hp(), values, { tooltips: false });
  const aria = row.querySelector('.combat-health-overflow').getAttribute('aria-label');
  const hidden = badges.slice(2).map(b => `${b.label} ${b.value}`);
  assert.equal(hidden.length, 3);
  assert.equal(aria, hidden.join(', '));
  const tip = badgeTipHtml(visibleBadges(badges).overflow, {});
  for (const text of hidden) assert.ok(tip.includes(text), `${text} in the tooltip`);
  assert.match(tip, /\+3/);
}));

// Owner 2026-11-01: the player's AC badge, left of the bar. Its number is the engine's own Evasion DC ("vs Evasion N").
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat } from '../src/engine/combat.js';
import { attackHitPreview } from '../src/engine/stanceHit.js';
import { fixCoreEnabled } from '../src/model/fixCoreMechanics.js';
import { acFor } from '../src/ui/models/acBadge.js';

function fixture({ fixCore = true } = {}) {
  const registries = createRegistries({ ...contentBundle });
  const player = { classId: 'reaver', hp: 50, maxHp: 50, mana: 10, maxMana: 10, energyMax: 3, drawPerTurn: 1,
    deck: [{ instanceId: 'a', cardId: 'twinbladeFlurry' }], relicIds: [] };
  const gameProfile = fixCore ? { formatVersion: 1, modules: { effects: { fixCoreVersion: 1 } } } : undefined;
  const combat = createCombat({ registries, rng: createRng(7), player, gameProfile, combatExpansionVersion: 2, reactionRulesVersion: 2, enemyIds: ['wanderingSoldier'], ratingsRules: null });
  return combat;
}

test('AC is the hit preview\'s Evasion for the player, follows Evade stacks, and enemies have none', () => {
  const combat = fixture();
  const enemy = combat.enemies[0], me = combat.player;
  const carrier = { combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' } };
  const ac = acFor(combat, me);
  assert.equal(combat.combatExpansionVersion, 2);
  assert.equal(fixCoreEnabled(combat), true, 'the fixture runs the FixCore ruleset');
  const shot = attackHitPreview(combat, enemy, me, carrier);
  assert.equal(ac.value, shot.evasion);
  assert.equal(ac.value - shot.accuracy, shot.need, 'AC is the DC the attacker\'s d20 must reach on top of its Precision');
  assert.equal(ac.value, ac.base + ac.evade);
  assert.equal(acFor(combat, enemy), null);
  me.statuses = { ...(me.statuses || {}), evade: { stacks: 3 } };
  const more = acFor(combat, me);
  assert.equal(more.value, attackHitPreview(combat, enemy, me, carrier).evasion);
  assert.ok(more.value > ac.value && more.evade > 0, 'Evade stacks raise AC');
});

test('the player row draws the AC badge with the number; an enemy row does not; the tooltip text carries title, rule and parts', () => withKitDom(() => {
  const combat = fixture();
  const ac = acFor(combat, combat.player);
  const row = combatHealthRow(hp(), { defense: 2, ac }, { tooltips: false });
  const node = row.querySelector('.combat-health-ac');
  assert.equal(node.querySelector('.combat-health-badge-value').textContent, String(ac.value));
  assert.equal(node.nextSibling, [...row.children].find(c => c.classList.contains('combat-health-meter')), 'the AC square sits right before the bar, a sibling, so row-scoped bar styling still applies');
  assert.match(node.getAttribute('aria-label'), new RegExp(`AC ${ac.value} \\(Evasion\\)\\. Enemies hit when d20 \\+ their Precision ≥ ${ac.value}\\.`));
  assert.equal(row.querySelector('.combat-health-ac-caption').textContent, 'AC');
  const enemyRow = combatHealthRow(hp(), { defense: 2, ac: acFor(combat, combat.enemies[0]) }, { tooltips: false });
  assert.equal(enemyRow.querySelector('.combat-health-ac'), null);
}));

test('outside FixCore there is no AC badge (the hit roll is not a fixed DC there)', () => {
  const combat = fixture({ fixCore: false });
  assert.equal(fixCoreEnabled(combat), false);
  assert.equal(acFor(combat, combat.player), null);
});
