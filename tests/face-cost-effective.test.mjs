import { legacyGearRegistries } from './helpers/legacy-gear.mjs';
// Owner, 2026-11-15 (batch 4): card faces outside a fight (deck, rewards, shop, upgrade picker) show the price the player would pay under the shipped
// spell cost rule, not the authored one: -1 Mana with a Focus item equipped, no Prepared discount (no stance). The +1 Stamina on non-cantrip spells was dropped by the owner on 2026-11-23,
// and the +1 Mana on every spell on 2026-11-26 (Star Seer hotfix): printed Mana is the face Mana.
import test from 'node:test';
import assert from 'node:assert/strict';
import { reg as currentReg } from './elementFixture.mjs';
import { createRunState } from '../src/model/state.js';
import { FaceCostProfile, SetFaceCostRun, SetFaceCostCombat, SetFaceCostPricer } from '../src/model/faceCosts.js';
import { SpellCostAdjust } from '../src/engine/spellCosts.js';
import { fight } from './elementFixture.mjs';
SetFaceCostPricer(SpellCostAdjust);
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';
import { cardManaCategory } from '../src/model/cardManaPolicy.js';

const reg = legacyGearRegistries(currentReg), profile = reg.gameProfile;
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

test('a spell face shows its printed Mana and Stamina (no surcharges since 2026-11-26); a non-spell is unchanged', () => {
  const run = newRun('greatsword');
  assert.ok(spells.length > 20);
  for (const def of spells) {
    const before = printed(def), after = FaceCostProfile(reg, def, run);
    assert.equal(after.mana, before.mana, def.id);
    if (def.cost !== 'X') assert.equal(after.stamina, before.stamina, def.id);
  }
  const smash = reg.cards.get('base.smash');
  assert.deepEqual(FaceCostProfile(reg, smash, run), printed(smash));
});

test('a Focus item takes 1 Mana off the face price; Prepared is never applied outside a fight', () => {
  const plain = newRun('greatsword');
  const def = spells.find(d => !cantrip(d) && d.cost !== 'X' && printed(d).mana > 0);
  for (const hand of ['boneSceptre', 'duskChime']) assert.equal(FaceCostProfile(reg, def, newRun(hand)).mana, FaceCostProfile(reg, def, plain).mana - 1, `${hand}: absent-version saved pricing is unchanged`);
  assert.equal(FaceCostProfile(reg, def, plain).stamina, printed(def).stamina, 'no Prepared -1 on a face');
  const saved = newRun('greatsword');
  saved.fixCoreRules = { ...shipped, spellCosts: { ...shipped.spellCosts, staminaSurcharge: 1 } }; // rules carrying the pre-2026-11-23 surcharge (as a fight saved before the ruling does; runs do not pin rules)
  assert.equal(FaceCostProfile(reg, def, saved).stamina, printed(def).stamina + 1, 'rules that carry the old surcharge still price the +1 Stamina face');
});

test('a run made before the ruling keeps printed costs; the registered run is the one read', () => {
  const old = newRun('greatsword');
  const { spellCosts, elementFlux, ...saved } = shipped;
  old.fixCoreRules = saved; // the rules block a run saved before the ruling carries
  const def = spells.find(d => printed(d).mana > 0);
  assert.deepEqual(FaceCostProfile(reg, def, old), printed(def));
  assert.deepEqual(FaceCostProfile(reg, def, null), printed(def), 'no run: printed');
  // Printed Mana is the face Mana now, so a Focus item marks the registered run as the one read.
  SetFaceCostRun(newRun('boneSceptre'));
  assert.equal(FaceCostProfile(reg, def).mana, printed(def).mana - 1, 'the registered run prices the face');
  SetFaceCostRun(null);
  assert.deepEqual(FaceCostProfile(reg, def), printed(def));
});

test('in a fight the pile faces are priced by the fight: Prepared takes 1 Stamina off a spell down to 1, as the hand pays it', () => {
  const def = spells.find(d => !cantrip(d) && d.cost !== 'X' && printed(d).stamina > 1);
  const single = spells.find(d => !cantrip(d) && d.cost !== 'X' && printed(d).stamina === 1);
  const { combat } = fight({ registries: reg });
  combat.loadout.sets.rightHand[0] = 'greatsword';
  try {
    SetFaceCostCombat(combat);
    const plain = FaceCostProfile(reg, def);
    assert.equal(plain.stamina, printed(def).stamina);
    combat.player.combatStance = { maneuver: 'casting', camp: 'spell' };
    assert.equal(FaceCostProfile(reg, def).stamina, printed(def).stamina - 1, 'Prepared: 1 Stamina off, as the hand pays it');
    assert.equal(FaceCostProfile(reg, single).stamina, 1, 'Prepared never takes a 1 Stamina spell below 1 (owner, 2026-11-26)');
    // A fight saved before the owner rulings of 2026-11-23 and 2026-11-26 keeps its surcharges and the old Prepared floor of 0.
    const rules = combat.fixCoreRules.spellCosts;
    rules.manaSurcharge = 1; rules.staminaSurcharge = 1;
    delete rules.preparedStaminaMinimum; delete rules.preparedManaDiscount;
    assert.equal(FaceCostProfile(reg, def).stamina, printed(def).stamina, 'a saved fight: the surcharge and the Prepared discount cancel');
    combat.result = 'victory';
    assert.equal(FaceCostProfile(reg, def, null).stamina, printed(def).stamina, 'a finished fight no longer prices faces');
  } finally { SetFaceCostCombat(null); }
});


import { playingCardModel } from '../src/model/playingCard.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { cardPlayCosts, dispatch } from '../src/engine/combat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { GearSelectorMatches } from '../src/model/gearEffects.js';

test('current deck and pile Mana faces share final gear pricing with quotes, payments and resumed fights', () => {
  for (const cardId of ['core.meteor', 'core.cantrip']) {
    for (const [classId, right, left] of [
      ['reaver', 'ashStaff', null],
      ['starseer', 'greatsword', null],
      ['starseer', 'ashStaff', null],
      ['starseer', 'boneSceptre', 'emberlightSceptre'],
      ['starseer', 'emberlightSceptre', 'boneSceptre'],
      ['starseer', 'boneSceptre', 'blightRod'],
      ['starseer', 'gorefireBrand', 'emberlightSceptre'],
      ['starseer', 'duskChime', null],
      ['starseer', 'duskChime', 'boneSceptre'],
    ]) {
      const run = createRunState({ registries: currentReg, classId, seed: 5, profileMeta: meta });
      run.loadout.sets.rightHand[0] = right; run.loadout.sets.leftHand[0] = left;
      const def = currentReg.cards.get(cardId), printedMana = currentReg.framework.costProfile(def).mana;
      const label = `${classId}/${right}/${left}/${cardId}`;
      SetFaceCostRun(run);
      try {
        const deck = playingCardModel(currentReg, { cardId }, { rules: run }).costs;
        assert.equal(deck.mana, printedMana, `${label}: the deck shows printed Mana and no Prepared gear discounts`);
        const combat = createRunCombat({ registries: currentReg, run, rng: createRng(5), enemyIds: ['wanderingSoldier'] });
        combat.player.stamina = combat.player.maxStamina = 40;
        combat.player.mana = combat.player.maxMana = 40;
        combat.piles.hand = [{ instanceId: 'face-mana', cardId, upgraded: false }];
        SetFaceCostCombat(combat);
        const idle = playingCardModel(currentReg, { cardId }, { rules: combat }).costs;
        assert.equal(idle.mana, deck.mana, `${label}: the initial pile and deck agree`);
        combat.player.combatStance = { maneuver: 'prepared', camp: 'spell' };
        const snapshot = serializeCombatSnapshot(combat), counters = combat.rng.getCounters();
        const quote = cardPlayCosts(combat, 'face-mana');
        const pile = playingCardModel(currentReg, { cardId }, { rules: combat }).costs;
        const alreadyProjected = resolveCombatCard(combat, combat.piles.hand[0]);
        assert.equal(FaceCostProfile(currentReg, alreadyProjected).mana, quote.mana, `${label}: an already adjusted definition is priced once`);
        assert.equal(pile.mana, quote.mana, `${label}: Prepared pile equals the live quote`);
        // Staffs and robes no longer cut Prepared Mana by type; the Starseer's Nightweave carries an Arcane Initiate (owner, 2026-11-27).
        const preparedRules = (combat.player.itemProps.cardRules || []).filter(row => row.stat === 'manaCost' && row.conds.some(cond => cond.name === 'stance'));
        const wornWeaponIds = [right, left].filter(Boolean);
        // Dusk Chime carries a Decay Initiate; no other weapon cuts Prepared Mana.
        const chime = wornWeaponIds.includes('duskChime');
        const weaponCuts = preparedRules.filter(row => wornWeaponIds.includes(row.source));
        assert.equal(weaponCuts.length, chime ? 1 : 0, `${label}: only Dusk Chime cuts Prepared Mana`);
        assert.ok(preparedRules.every(row => row.initiate), `${label}: every Prepared Mana cut is an Initiate`);
        const robeInitiate = classId === 'starseer' && GearSelectorMatches('arcaneSpell', null, def);
        const chimeInitiate = chime && GearSelectorMatches('schoolSpell', 'decay', def);
        const initiate = robeInitiate || chimeInitiate
          ? 1
          : 0;
        const base = classId === 'starseer' && printedMana > 0 ? Math.max(0, printedMana - 1) : printedMana; // Starseer is a Graduate; Reaver is not.
        const chainCut = cardId === 'core.cantrip' ? 1 : 0; // a mirrored cantrip takes the successive-Spell cut, and with no cost minimum (owner 2026-11-22) it may reach 0 for a non-Graduate too
        const preparedCut = 0; // Prepared itself takes no Mana; staff, robe and other gear tags own the Prepared Mana cut (owner, 2026-11-26)
        assert.equal(pile.mana, Math.max(0, base - preparedCut - initiate - chainCut), `${label}: Prepared, one Initiate cut`);
        assert.deepEqual(serializeCombatSnapshot(combat), snapshot, `${label}: faces and quotes are pure`);
        const restored = restoreCombatSnapshot({ registries: currentReg, snapshot, rng: createRng(5, counters), expectedGameProfile: combat.gameProfile });
        const play = ctx => dispatch(ctx, { type: 'playCard', cardInstanceId: 'face-mana', targetId: ctx.enemies[0].id });
        const live = play(combat), resumed = play(restored);
        assert.deepEqual(live, resumed);
        assert.equal(live.events.find(event => event.type === 'cardPlayed').manaSpent, pile.mana);
      } finally { SetFaceCostCombat(null); SetFaceCostRun(null); }
    }
  }
});
