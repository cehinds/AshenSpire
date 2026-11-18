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
import { dispatch } from '../src/engine/combat.js';
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
  const { cardAsEnteredStance, stanceForCard, kindForCard } = await import('../src/model/alternativeStance.js');
  const combat = liveCore();
  const out = play(combat, give(combat, 'enterGorefire', 'eg1'));
  const played = out.events.find(e => e.type === 'cardPlayed');
  const card = reg.cards.get('enterGorefire');
  assert.equal(stanceForCard(card), 'casting', 'the card alone reads as a skill');
  const entered = cardAsEnteredStance(card, out.events, played);
  assert.equal(stanceForCard(entered), 'offensive');
  assert.equal(kindForCard(entered).maneuver, combat.player.combatStance.maneuver);
  // A card with no stance change, or no enterStance effect, is returned as it came.
  assert.equal(cardAsEnteredStance(reg.cards.get('core.defend'), out.events, played), reg.cards.get('core.defend'));
  assert.equal(cardAsEnteredStance(card, [played], played), card);
});
