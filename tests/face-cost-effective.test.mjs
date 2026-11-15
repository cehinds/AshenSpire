// Owner, 2026-11-15 (batch 4): card faces outside a fight (deck, rewards, shop, upgrade picker) show the price the player would pay under the shipped
// spell cost rule, not the authored one: +1 Mana, +1 Stamina unless a cantrip, -1 Mana with a Focus item equipped, no Prepared discount (no stance).
import test from 'node:test';
import assert from 'node:assert/strict';
import { reg, profile } from './elementFixture.mjs';
import { createRunState } from '../src/model/state.js';
import { FaceCostProfile, SetFaceCostRun, SetFaceCostCombat, SetFaceCostPricer } from '../src/model/faceCosts.js';
import { SpellCostAdjust } from '../src/engine/spellCosts.js';
import { fight } from './elementFixture.mjs';
SetFaceCostPricer(SpellCostAdjust);
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';
import { cardManaCategory } from '../src/model/cardManaPolicy.js';

const meta = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
const newRun = hand => {
  const run = createRunState({ registries: reg, classId: 'starseer', seed: 5, profileMeta: meta });
  run.loadout.sets.rightHand[0] = hand;
  return run;
};
const spells = profile.content.cards.map(card => reg.cards.get(card.id)).filter(def => cardManaCategory(reg, def) === 'spell');
const printed = def => reg.framework.costProfile(def);
const hasTag = (def, id) => (def.cardTags ?? def.tags ?? []).some(tag => (tag.id ?? tag) === id);
const cantrip = def => hasTag(def, 'rank.cantrip') || hasTag(def, 'cost.manaOnly'); // neither pays the Stamina surcharge

test('a spell face shows +1 Mana and +1 Stamina (cantrips +1 Mana only); a non-spell is unchanged', () => {
  const run = newRun('greatsword');
  assert.ok(spells.length > 20);
  for (const def of spells) {
    const before = printed(def), after = FaceCostProfile(reg, def, run);
    assert.equal(after.mana, before.mana + 1, def.id);
    if (def.cost !== 'X') assert.equal(after.stamina, before.stamina + (cantrip(def) ? 0 : 1), def.id);
  }
  const smash = reg.cards.get('base.smash');
  assert.deepEqual(FaceCostProfile(reg, smash, run), printed(smash));
});

test('a Focus item takes 1 Mana off the face price; Prepared is never applied outside a fight', () => {
  const plain = newRun('greatsword'), focus = newRun('boneSceptre');
  const def = spells.find(d => !cantrip(d) && d.cost !== 'X' && printed(d).mana > 0);
  assert.equal(FaceCostProfile(reg, def, focus).mana, FaceCostProfile(reg, def, plain).mana - 1);
  assert.equal(FaceCostProfile(reg, def, plain).stamina, printed(def).stamina + 1, 'no Prepared -1 on a face');
});

test('a run made before the ruling keeps printed costs; the registered run is the one read', () => {
  const old = newRun('greatsword');
  const { spellCosts, elementFlux, ...saved } = shipped;
  old.fixCoreRules = saved; // the rules block a run saved before the ruling carries
  const def = spells[0];
  assert.deepEqual(FaceCostProfile(reg, def, old), printed(def));
  assert.deepEqual(FaceCostProfile(reg, def, null), printed(def), 'no run: printed');
  SetFaceCostRun(newRun('greatsword'));
  assert.equal(FaceCostProfile(reg, def).mana, printed(def).mana + 1);
  SetFaceCostRun(null);
  assert.deepEqual(FaceCostProfile(reg, def), printed(def));
});

test('in a fight the pile faces are priced by the fight: Prepared takes 1 Stamina off a spell, as the hand pays it', () => {
  const def = spells.find(d => !cantrip(d) && d.cost !== 'X' && printed(d).stamina > 0);
  const { combat } = fight();
  combat.loadout.sets.rightHand[0] = 'greatsword';
  try {
    SetFaceCostCombat(combat);
    const plain = FaceCostProfile(reg, def);
    assert.equal(plain.stamina, printed(def).stamina + 1);
    combat.player.combatStance = { maneuver: 'casting', camp: 'spell' };
    assert.equal(FaceCostProfile(reg, def).stamina, printed(def).stamina, 'Prepared: the surcharge and the discount cancel');
    combat.result = 'victory';
    assert.equal(FaceCostProfile(reg, def, null).stamina, printed(def).stamina, 'a finished fight no longer prices faces');
  } finally { SetFaceCostCombat(null); }
});
