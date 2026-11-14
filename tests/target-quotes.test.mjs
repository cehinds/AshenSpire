// Owner, 2026-11-14 (Wave 2): while a card is selected every enemy it can hit shows what the play will cost THAT enemy, so a player who taps a
// card and then an enemy knows the result before committing. Model level (the screen paints what TargetQuote returns).
//   node --test tests/target-quotes.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, previewCard, previewCardHit } from '../src/engine/combat.js';
import { TargetQuote, TargetQuoteHits, TargetQuoteHitsText } from '../src/ui/models/TargetQuoteModel.js';
import { t } from '../src/ui/strings.js';
import { withoutWeaknesses } from './withoutWeaknesses.mjs';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const META = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };

function fixture({ classId = 'reaver', hand = 'core.strike', enemies = ['wanderingSoldier', 'wanderingSoldier'] } = {}) {
  const run = createRunState({ registries: reg, classId, seed: 7, profileMeta: META });
  const combat = withoutWeaknesses(createRunCombat({ registries: reg, run, rng: createRng(7), enemyIds: enemies }));
  combat.enemies.forEach(enemy => { Object.assign(enemy, { hp: 400, maxHp: 400, block: 0, statuses: {}, attributes: { ...enemy.attributes, dexterity: 0 }, persistentPoise: { value: 0, max: 20 } }); delete enemy.combatStance; delete enemy.combatCounter; });
  combat.player.energy = 9; combat.player.stamina = 9; combat.player.mana = 9; combat.player.hp = 100; combat.player.maxHp = 100;
  const card = combat.piles.hand[0];
  card.cardId = hand; card.upgraded = false;
  return { combat, card };
}
const preview = (combat, id, targetId, ranks) => previewCard(combat, id, targetId, ranks, { rangeRoute: 'advance' });
const quoteFor = (combat, card, targetId, referenceId = 'e1') => TargetQuote({
  preview, combat, instanceId: card.instanceId, targetId, reference: preview(combat, card.instanceId, referenceId),
  hitPreview: previewCardHit(combat, card.instanceId, targetId, undefined, { observerId: combat.playerKey || 'player', rangeRoute: 'advance' }) });
const sum = (events, type) => events.filter(event => event.type === type).reduce((total, event) => total + (event.amount || 0), 0);

/** Plays the card on `targetId` and returns what it took from the enemy and what it spent. */
function playOn(combat, card, targetId) {
  const hp = combat.enemies.find(enemy => enemy.id === targetId).hp, start = combat.eventLog.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId, rangeRoute: 'advance' });
  while (combat.pendingReaction) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  const events = combat.eventLog.slice(start), played = events.findIndex(event => event.type === 'cardPlayed');
  const hits = events.filter(event => event.type === 'damageDealt' && event.targetId === targetId && event.cardInstanceId === card.instanceId).map(event => event.hpLoss);
  return { hits, lost: hp - combat.enemies.find(enemy => enemy.id === targetId).hp,
    stamina: sum(events.slice(0, played), 'staminaSpent'), mana: sum(events.slice(0, played), 'manaSpent') };
}

test('two enemies, the far one needs Advance: each quote is the HP that enemy loses and the cost paid against it', () => {
  for (const hand of ['core.strike', 'greatswordSunderingHew']) {
    const { combat, card } = fixture({ hand });
    combat.rangeState.engagements['["enemy:e2","player:player"]'] = 1;
    combat.enemies[1].block = 5; // the far enemy also holds Block, so the two numbers differ
    const near = quoteFor(combat, card, 'e1'), far = quoteFor(combat, card, 'e2');
    assert.equal(near.kind, 'hp'); assert.equal(far.kind, 'hp');
    assert.notDeepEqual(near.hits, far.hits, `${hand}: the two enemies lose different HP`);
    assert.equal(near.stamina, null, 'the reference enemy costs what the face says: no cost quoted');
    const faceStamina = preview(combat, card.instanceId, 'e1').staminaCost || 0;
    assert.equal(far.stamina, faceStamina + 1, `${hand}: Advance is quoted as the far enemy's Stamina`);
    assert.equal(far.text, TargetQuoteHitsText(far.hits));
    assert.match(far.text, /^−/, 'the HP is prefixed with a minus sign');
    // Playing on the far enemy loses exactly the HP the quote said and pays exactly the Stamina it said.
    const dealt = playOn(combat, card, 'e2');
    assert.deepEqual(dealt.hits, far.hits.slice(0, dealt.hits.length), `${hand}: each hit's HP loss is the quote`);
    assert.equal(dealt.lost, far.hits.reduce((a, b) => a + b, 0));
    assert.equal(dealt.stamina, far.stamina, `${hand}: the Stamina paid is the Stamina quoted`);
  }
  // And against the near enemy of a second fight: the quote and the HP lost agree there too.
  const { combat, card } = fixture();
  combat.rangeState.engagements['["enemy:e2","player:player"]'] = 1;
  const near = quoteFor(combat, card, 'e1'), dealt = playOn(combat, card, 'e1');
  assert.deepEqual(dealt.hits, near.hits);
  assert.equal(dealt.stamina, preview(combat, card.instanceId, 'e1').staminaCost || 0);
});

test('a play that takes no HP shows its cause word: Blocked, or Evaded when an Evade stack cancels it', () => {
  const { combat, card } = fixture({ enemies: ['wanderingSoldier', 'wanderingSoldier', 'wanderingSoldier'] });
  combat.enemies[0].block = 400; // swallows the whole hit
  combat.enemies[1].statuses = { evade: { stacks: 1 } };
  const blocked = quoteFor(combat, card, 'e1'), evaded = quoteFor(combat, card, 'e2'), plain = quoteFor(combat, card, 'e3');
  assert.deepEqual(blocked.hits, [0]); assert.equal(blocked.kind, 'cause'); assert.equal(blocked.text, t('combat.callout.blocked'));
  assert.deepEqual(evaded.hits, [0]); assert.equal(evaded.kind, 'cause'); assert.equal(evaded.text, t('combat.callout.evaded'));
  assert.equal(plain.kind, 'hp');
  assert.equal(playOn(combat, card, 'e1').lost, 0);
});

test('a multi-hit card reads N x M for equal hits and the sequence for unequal ones', () => {
  assert.equal(TargetQuoteHitsText([4]), '−4');
  assert.equal(TargetQuoteHitsText([4, 4, 4]), '−4 × 3');
  assert.equal(TargetQuoteHitsText([4, 6]), '−4, 6');
  const { combat, card } = fixture({ classId: 'starseer', hand: 'supernova' });
  combat.player.mana = 9; combat.player.stamina = 9; combat.player.energy = 9;
  const q = quoteFor(combat, card, 'e1');
  assert.ok(q.hits.length > 1, 'a multi-hit card has several hits');
  const dealt = playOn(combat, card, 'e1');
  assert.deepEqual(dealt.hits, q.hits.slice(0, dealt.hits.length));
});

test('a card that hits every enemy quotes each enemy its own HP', () => {
  const { combat, card } = fixture({ classId: 'starseer', hand: 'supernova', enemies: ['wanderingSoldier', 'wanderingSoldier'] });
  combat.enemies[1].block = 8;
  const row = preview(combat, card.instanceId, 'e1').values.find(value => value.op === 'damage' && value.target === 'allEnemies');
  assert.ok(row, 'supernova strikes every enemy');
  const one = quoteFor(combat, card, 'e1'), two = quoteFor(combat, card, 'e2');
  assert.deepEqual(one.hits, TargetQuoteHits(preview(combat, card.instanceId, 'e1'), 'e1'));
  assert.deepEqual(two.hits, TargetQuoteHits(preview(combat, card.instanceId, 'e2'), 'e2'));
  assert.notDeepEqual(one.hits, two.hits, 'the enemy holding Block loses less');
});

test('a card that does not target enemies gives no quote', () => {
  const { combat, card } = fixture({ hand: 'core.defend' });
  assert.equal(quoteFor(combat, card, 'e1'), null);
  assert.equal(quoteFor(combat, card, 'e2'), null);
});

test('a target the player cannot afford or reach shows the refusal reason, not a number', () => {
  const { combat, card } = fixture();
  combat.rangeState.engagements['["enemy:e2","player:player"]'] = 1;
  const face = preview(combat, card.instanceId, 'e1');
  combat.player.stamina = face.staminaCost || 0; // exactly the near price: the far enemy needs one more for Advance
  const near = quoteFor(combat, card, 'e1'), far = quoteFor(combat, card, 'e2');
  assert.equal(near.kind, 'hp');
  assert.equal(far.kind, 'refusal');
  assert.equal(far.text, t('combat.range.insufficient'));
  assert.ok(!/\d/.test(far.text), 'a refusal carries no number');
});

test('a quote moves nothing in the fight', () => {
  const { combat, card } = fixture();
  const before = JSON.stringify([combat.player, combat.enemies, combat.piles, combat.eventLog.length, combat.rng?.state ?? null]);
  quoteFor(combat, card, 'e1'); quoteFor(combat, card, 'e2');
  assert.equal(JSON.stringify([combat.player, combat.enemies, combat.piles, combat.eventLog.length, combat.rng?.state ?? null]), before);
});
