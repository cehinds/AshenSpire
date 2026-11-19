// Owner, 2026-11-18: a card that enters a stance (the `enterStance` op) is a real stance change. The registry stance
// (hooks and modifiers) and the Core combat stance (`entity.combatStance`: the maneuver triangle, benefits, sprite and icon)
// agree afterwards, and a later maneuver card still moves the combat stance as before. An enemy's stance is untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { StanceBenefitRules, AttackDamageMultiplier, BlockGainMultiplier } from '../src/engine/stanceBenefits.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { effects: { playerDamageMultiplier: 1, enemyDamageMultiplier: 1, blockGainMultiplier: 1 } } });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function liveCore() {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  combat.player.energy = 9; combat.player.stamina = 9;
  return combat;
}
const give = (combat, cardId, instanceId) => { combat.piles.hand.push({ instanceId, cardId, upgraded: false }); return instanceId; };
const play = (combat, instanceId, targetId) => dispatch(combat, { type: 'playCard', cardInstanceId: instanceId, targetId });

test('Enter: Gorefire sets the registry stance AND the Core combat stance to the stance row\'s maneuver', () => {
  const combat = liveCore();
  const row = reg.stances.get('gorefire');
  assert.ok(row.maneuver, 'the stance row names its maneuver as data');
  const out = play(combat, give(combat, 'enterGorefire', 'eg1'));
  assert.equal(out.error, undefined);
  assert.equal(combat.player.stanceId, 'gorefire');
  assert.equal(combat.player.combatStance.maneuver, row.maneuver);
  assert.ok(out.events.some(e => e.type === 'combatStanceChanged' && e.sourceId === combat.player.id && e.maneuver === row.maneuver),
    'the change is announced, so the icon and sprite follow it');
  // The bonus the benefits table pays reads the same stance the icon shows.
  const rules = StanceBenefitRules(combat);
  assert.equal(AttackDamageMultiplier(combat, combat.player, { combatProfile: {} }), AttackDamageMultiplier(combat, { kind: 'player', combatStance: { maneuver: row.maneuver } }, { combatProfile: {} }));
  assert.ok(rules, 'stance benefits are live in Core');
});

test('Bulwark and Brace cards enter Defend; Block gain reads that stance', () => {
  for (const [cardId, stance] of [['enterBulwark', 'bulwark'], ['brace', 'brace']]) {
    const combat = liveCore();
    if (!reg.cards.get(cardId)) continue;
    play(combat, give(combat, cardId, 'x1'));
    assert.equal(combat.player.stanceId, stance);
    assert.equal(combat.player.combatStance.maneuver, reg.stances.get(stance).maneuver, stance);
    assert.equal(BlockGainMultiplier(combat, combat.player, { combatProfile: { maneuver: 'defend' } }) >= 1, true);
  }
});

test('a later maneuver card still changes the combat stance; the registry stance stays', () => {
  const combat = liveCore();
  play(combat, give(combat, 'enterGorefire', 'eg1'));
  const before = combat.player.combatStance.maneuver;
  play(combat, give(combat, 'core.defend', 'd1'));
  assert.equal(combat.player.combatStance.maneuver, 'defend');
  assert.notEqual(before, 'defend');
  assert.equal(combat.player.stanceId, 'gorefire', 'hooks of the entered stance keep working');
});

test('entering a stance never touches an enemy\'s stance', () => {
  const combat = liveCore();
  const enemy = combat.enemies[0];
  const snap = JSON.stringify(enemy.combatStance ?? null);
  play(combat, give(combat, 'enterGorefire', 'eg1'));
  assert.equal(JSON.stringify(enemy.combatStance ?? null), snap);
  assert.equal(enemy.stanceId ?? null, null);
});

test('the figure\'s pose and glyph read the stance the engine ended on, live and from a restored log', async () => {
  const { CardAsEnteredStance, stanceForCard, kindForCard } = await import('../src/model/alternativeStance.js');
  const combat = liveCore();
  const out = play(combat, give(combat, 'enterGorefire', 'eg1'));
  const played = out.events.find(e => e.type === 'cardPlayed');
  const card = reg.cards.get('enterGorefire');
  assert.equal(stanceForCard(card), 'casting', 'the card alone reads as a skill');
  const entered = CardAsEnteredStance(card, out.events, played);
  assert.equal(stanceForCard(entered), 'offensive');
  assert.equal(kindForCard(entered).maneuver, combat.player.combatStance.maneuver);
  // A card with no stance change, or no enterStance effect, is returned as it came.
  assert.equal(CardAsEnteredStance(reg.cards.get('core.defend'), out.events, played), reg.cards.get('core.defend'));
  assert.equal(CardAsEnteredStance(card, [played], played), card);
});

// Non-Core (createRegistries(contentBundle), no profile): the numbers match what dev paid before the stance change.
const plainReg = createRegistries(contentBundle);
async function plainPlay(cardId) {
  const { createCombat } = await import('../src/engine/combat.js');
  const player = { id: 'p', classId: 'reaver', maxHp: 78, hp: 78, mana: 2, maxMana: 2, stamina: 5, maxStamina: 5, energyMax: 3, drawPerTurn: 5,
    deck: [{ instanceId: 'x1', cardId, upgraded: false }, ...Array.from({ length: 8 }, (_, i) => ({ instanceId: `s${i}`, cardId: 'strike', upgraded: false }))], relicIds: [], flasks: [] };
  const combat = createCombat({ registries: plainReg, rng: createRng(1), combatExpansionVersion: 2, player, enemyIds: [contentBundle.enemies[0].id] });
  if (!combat.piles.hand.some(c => c.instanceId === 'x1')) combat.piles.hand.push({ instanceId: 'x1', cardId, upgraded: false });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'x1' });
  return combat.player;
}

test('non-Core: Defend-stance cards do not restore Block and Barrier a second time (dev numbers)', async () => {
  for (const [cardId, block] of [['enterBulwark', 13], ['brace', 12]]) {
    const player = await plainPlay(cardId);
    assert.deepEqual([player.block, player.barrier ?? 0], [block, 0], cardId);
    assert.equal(player.combatStance.maneuver, 'defend');
  }
});

test('non-Core: Enter Gorefire pays no unquoted Precision entry grant', async () => {
  const gorefire = await plainPlay('enterGorefire');
  assert.equal(gorefire.stanceId, 'gorefire');
  assert.equal(gorefire.statuses?.precision?.stacks ?? 0, 0);
  assert.equal(gorefire.block ?? 0, 2, 'dev number');
});

test('entered-stance helper reads the play that caused the change, live and from the whole restored log', async () => {
  const { CardAsEnteredStance, kindForCard } = await import('../src/model/alternativeStance.js');
  const card = reg.cards.get('enterGorefire');
  // The real engine log: Enter: Gorefire, then a Defend card whose own stance change is emitted BEFORE its cardPlayed.
  const combat = liveCore();
  play(combat, give(combat, 'enterGorefire', 'eg1'));
  play(combat, give(combat, 'core.defend', 'd1'));
  const log = combat.eventLog;
  const gorefirePlay = log.find(e => e.type === 'cardPlayed' && e.cardInstanceId === 'eg1');
  assert.ok(log.filter(e => e.type === 'combatStanceChanged').some(e => e.cardInstanceId === 'eg1'), 'the effect\'s change names its play');
  assert.equal(combat.player.combatStance.maneuver, 'defend');
  assert.equal(CardAsEnteredStance(card, log, gorefirePlay).cardTags.at(-1), 'maneuver:attack', 'the later Defend play does not leak in');
  // Synthetic receipts: a log from before the field falls back to the receipts after this cardPlayed.
  const played = { type: 'cardPlayed', sourceId: 'player', cardInstanceId: 'x' }, later = { type: 'cardPlayed', sourceId: 'player', cardInstanceId: 'y' };
  const change = (maneuver, extra = {}) => ({ type: 'combatStanceChanged', sourceId: 'player', maneuver, ...extra });
  assert.equal(CardAsEnteredStance(card, [played, change('attack'), later, change('defend')], played).cardTags.at(-1), 'maneuver:attack');
  assert.equal(CardAsEnteredStance(card, [played, later, change('defend', { cardInstanceId: 'y' })], played), card, 'tagged log: no change by this play');
  // An enemy broken by the hit reports its own stance change (sourced from the player, aimed at the enemy): not the figure's.
  const broken = { type: 'combatStanceChanged', sourceId: 'player', targetId: 'e1', maneuver: 'staggered', cardInstanceId: 'x' };
  assert.equal(CardAsEnteredStance(card, [played, change('defend', { targetId: 'player', cardInstanceId: 'x' }), broken], played).cardTags.at(-1), 'maneuver:defend');
  // Prepared (an immediate-transition Prepare) must not become an unknown maneuver tag.
  const prepared = CardAsEnteredStance(card, [played, change('prepared', { cardInstanceId: 'x' })], played);
  assert.equal(prepared.cardTags.at(-1), 'maneuver:casting');
  assert.doesNotThrow(() => kindForCard(prepared));
});

// Strike and Settle (`enterStance { choose: 'maneuver' }`): the pick is the stance the figure ends in.
function strikeAndSettle(pick) {
  const combat = liveCore();
  const id = give(combat, 'base.attack-then-defend', 'ss1');
  const quoted = previewCardDamage(combat, id);
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: id, targetId: combat.enemies[0].id, choice: pick });
  return { combat, out, quoted };
}
function previewCardDamage(combat, id) {
  return previewCard(combat, id, combat.enemies[0].id).values.find(v => v.op === 'damage')?.hitDamages?.[0];
}

test('Strike and Settle: the pick, not the card\'s attack maneuver, is the stance it ends in (Core)', async () => {
  const { CardAsEnteredStance, kindForCard } = await import('../src/model/alternativeStance.js');
  for (const [pick, ended] of [['attack', 'attack'], ['defend', 'defend'], ['counter', 'counter'], ['smash', 'smash'], ['sweep', 'sweep'], ['casting', 'prepared']]) {
    const { combat, out } = strikeAndSettle(pick);
    assert.equal(out.error, undefined, pick);
    assert.equal(combat.player.combatStance.maneuver, ended, pick);
    const played = out.events.find(e => e.type === 'cardPlayed');
    const shown = CardAsEnteredStance(reg.cards.get('base.attack-then-defend'), out.events, played);
    assert.equal(kindForCard(shown).maneuver, pick === 'casting' ? null : pick === 'attack' ? 'attack' : pick, `glyph follows the ${pick} pick`);
  }
});

test('Strike and Settle: the hit does not depend on the pick (the preview-vs-dealt gap is dev\'s and is not tested here)', () => {
  const amounts = ['attack', 'defend', 'counter', 'casting'].map(pick => {
    const { combat, out, quoted } = strikeAndSettle(pick);
    const hit = out.events.find(e => e.type === 'damageDealt' && e.targetId === combat.enemies[0].id);
    assert.ok(hit, pick);
    assert.ok(quoted > 0, 'a preview is quoted');
    return hit.amount;
  });
  assert.ok(amounts.every(amount => amount === amounts[0]), 'the pick follows the hit');
});

test('non-Core Strike and Settle keeps dev numbers: Defend pick Block 8, Counter pick Block 3, Attack pick none', async () => {
  const { createCombat } = await import('../src/engine/combat.js');
  const numbers = pick => {
    const player = { id: 'p', classId: 'reaver', maxHp: 78, hp: 78, mana: 2, maxMana: 2, stamina: 5, maxStamina: 5, energyMax: 3, drawPerTurn: 5,
      deck: [{ instanceId: 'x1', cardId: 'base.attack-then-defend', upgraded: false }, ...Array.from({ length: 8 }, (_, i) => ({ instanceId: `s${i}`, cardId: 'strike', upgraded: false }))], relicIds: [], flasks: [] };
    const combat = createCombat({ registries: plainReg, rng: createRng(1), combatExpansionVersion: 2, player, enemyIds: [contentBundle.enemies[0].id] });
    if (!combat.piles.hand.some(c => c.instanceId === 'x1')) combat.piles.hand.push({ instanceId: 'x1', cardId: 'base.attack-then-defend', upgraded: false });
    dispatch(combat, { type: 'playCard', cardInstanceId: 'x1', targetId: combat.enemies[0].id, choice: pick });
    return [combat.player.block ?? 0, combat.player.barrier ?? 0, combat.player.combatStance.maneuver];
  };
  assert.deepEqual(numbers('defend'), [8, 0, 'defend']);
  assert.deepEqual(numbers('counter'), [3, 0, 'counter']);
  assert.deepEqual(numbers('attack'), [0, 0, 'attack']);
});

test('Core 2 with the hit rolls a supported save keeps: Enter: Gorefire pays no unquoted Precision', async () => {
  const { withLegacyDefaults } = await import('./legacyHitRules.mjs');
  const combat = withLegacyDefaults(() => liveCore());
  const before = combat.player.statuses?.precision?.stacks ?? 0;
  play(combat, give(combat, 'enterGorefire', 'eg1'));
  assert.equal(combat.player.stanceId, 'gorefire');
  assert.equal(combat.player.combatStance.maneuver, 'attack');
  assert.equal(combat.player.statuses?.precision?.stacks ?? 0, before);
});
