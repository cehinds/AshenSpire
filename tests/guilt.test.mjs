// Guilt (SPEC §5.2 colorless minimum): "curse, unplayable, at turn end in
// hand: lose 1 HP". The rule is DATA — the card's `onTurnEndInHand` effect
// list — and the engine only fires that list for each card still in hand when
// the player's turn ends. These tests pin the rule where it can fail: in hand
// costs HP, anywhere else costs nothing, copies stack, and a malformed hook is
// refused by the validator naming the row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { validateContent } from '../src/model/validate.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';

const REG = createRegistries(contentBundle);
const ENEMY = contentBundle.enemies[0].id;

// A combat with a known hand. The deck is built, then every Guilt is moved to
// the pile the case names so the draw's randomness is out of the picture.
function combatWith(guiltPiles) {
  const deck = [
    ...guiltPiles.map((_, i) => ({ instanceId: `g${i + 1}`, cardId: 'guilt', upgraded: false })),
    ...Array.from({ length: 8 }, (_, i) => ({ instanceId: `s${i + 1}`, cardId: 'strike', upgraded: false })),
  ];
  const c = createCombat({
    registries: REG,
    rng: createRng(0xc0ffee),
    player: { classId: 'reaver', maxHp: 78, hp: 78, mana: 2, maxMana: 2, stamina: 0, maxStamina: 0, energyMax: 3, drawPerTurn: 5, deck, relicIds: [], flasks: [] },
    enemyIds: [ENEMY],
  });
  guiltPiles.forEach((pile, i) => {
    const id = `g${i + 1}`;
    for (const p of ['hand', 'draw', 'discard', 'exhaust']) {
      const at = c.piles[p].findIndex((card) => card.instanceId === id);
      if (at >= 0) c.piles[p].splice(at, 1);
    }
    c.piles[pile].push({ instanceId: id, cardId: 'guilt', upgraded: false });
  });
  return c;
}

// HP the player lost between the player's turn end and the enemy's turn —
// the window the in-hand hook lives in, so enemy attacks never count.
function turnEndHpLoss(c) {
  const from = c.eventLog.length;
  dispatch(c, { type: 'endTurn' });
  const events = c.eventLog.slice(from);
  const stop = events.findIndex((e) => e.type === 'enemyTurnStart');
  return events.slice(0, stop < 0 ? events.length : stop)
    .filter((e) => e.type === 'hpLost' && e.targetId === c.player.id)
    .reduce((sum, e) => sum + e.amount, 0);
}

test('Guilt authors its turn-end loss as data', () => {
  const guilt = REG.cards.get('guilt');
  assert.deepEqual(guilt.onTurnEndInHand, [{ op: 'loseHp', target: 'self', amount: 1, cause: 'curse:guilt' }]);
  assert.ok(guilt.keywords.includes('unplayable'));
});

test('Guilt in hand at turn end costs exactly 1 HP', () => {
  const c = combatWith(['hand']);
  const from = c.eventLog.length;
  assert.equal(turnEndHpLoss(c), 1);
  const log = c.eventLog.slice(from);
  const lost = log.findIndex((e) => e.type === 'hpLost' && e.cause === 'curse:guilt');
  const discarded = log.findIndex((e) => e.type === 'cardDiscarded' && e.cardInstanceId === 'g1' && e.reason === 'turnEnd');
  assert.ok(lost >= 0 && discarded > lost, 'Guilt fires while in hand, then is discarded with the hand');
});

test('Guilt in the draw or discard pile costs nothing', () => {
  assert.equal(turnEndHpLoss(combatWith(['draw'])), 0);
  assert.equal(turnEndHpLoss(combatWith(['discard'])), 0);
  assert.equal(turnEndHpLoss(combatWith(['exhaust'])), 0);
});

test('two Guilts in hand cost 2 HP', () => {
  assert.equal(turnEndHpLoss(combatWith(['hand', 'hand'])), 2);
});

test('a hand without Guilt loses nothing at turn end', () => {
  assert.equal(turnEndHpLoss(combatWith([])), 0);
});

test('the validator refuses a malformed in-hand hook, naming the row', () => {
  // Shallow copies of the rows a plant touches (the bundle carries functions,
  // so it cannot be structuredClone'd); the shipped rows are never mutated.
  const plant = (mutate) => {
    const b = { ...contentBundle, cards: contentBundle.cards.map((c) => ({ ...c })), relics: contentBundle.relics.map((r) => ({ ...r })) };
    mutate(b);
    return validateContent(b).errors.map((e) => JSON.stringify(e));
  };
  // Unknown op on a card's hook.
  const badOp = plant((b) => { b.cards.find((c) => c.id === 'guilt').onTurnEndInHand = [{ op: 'notAnOp', amount: 1 }]; });
  assert.ok(badOp.some((e) => e.includes('guilt') && e.includes('onTurnEndInHand')), `unknown op must name guilt.onTurnEndInHand: ${badOp.slice(0, 3)}`);
  // Missing required field on a known op.
  const badField = plant((b) => { b.cards.find((c) => c.id === 'guilt').onTurnEndInHand = [{ op: 'loseHp', target: 'self' }]; });
  assert.ok(badField.some((e) => e.includes('guilt') && e.includes('onTurnEndInHand')), `missing amount must name guilt: ${badField.slice(0, 3)}`);
  // The hook is a card field only: a relic carrying it is refused.
  const onRelic = plant((b) => { b.relics[0].onTurnEndInHand = [{ op: 'loseHp', target: 'self', amount: 1 }]; });
  const relicId = contentBundle.relics[0].id;
  assert.ok(onRelic.some((e) => e.includes(relicId) && e.includes('onTurnEndInHand')), `hook on a relic must be refused naming ${relicId}: ${onRelic.slice(0, 3)}`);
  // The shipped bundle stays clean.
  assert.deepEqual(validateContent(contentBundle).errors, []);
});

test('the engine stays free of the DOM', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/engine/combat.js', import.meta.url), 'utf8')
    .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.ok(!/\bdocument\.|\bwindow\./.test(src));
});

// Co-op: the production session route ends a seat's turn through
// coopCombat.endTurn, which must fire the same in-hand hook on that seat only.
test('co-op: Guilt in a seat\'s hand costs that seat 1 HP at its turn end', async () => {
  const { createCoopCombat, endTurn } = await import('../src/engine/coopCombat.js');
  const seat = (id) => ({
    id, classId: 'reaver', maxHp: 78, hp: 78, mana: 2, maxMana: 2, stamina: 0, maxStamina: 0, energyMax: 3, drawPerTurn: 5,
    deck: Array.from({ length: 8 }, (_, i) => ({ instanceId: `${id}s${i + 1}`, cardId: 'strike', upgraded: false })), relicIds: [], flasks: [],
  });
  const C = createCoopCombat({ registries: REG, rng: createRng(0xc0ffee), enemyIds: [ENEMY], players: [seat('p1'), seat('p2')] });
  const p1 = C.players.get('p1'), p2 = C.players.get('p2');
  p1.piles.hand.push({ instanceId: 'g1', cardId: 'guilt', upgraded: false });
  const hp1 = p1.entity.hp, hp2 = p2.entity.hp;
  endTurn(C, 'p1'); // p2 has not ended, so no enemy phase runs yet
  assert.equal(p1.entity.hp, hp1 - 1, 'the seat holding Guilt loses 1 HP');
  assert.equal(p2.entity.hp, hp2, 'the other seat loses nothing');
  // Since derived-stat ruleset 7 a co-op seat keeps unplayed cards under the
  // shipped hand rules, as a solo fight does (SPEC §4.1), so Guilt stays in the
  // hand that holds it — and fires again next turn end — rather than going to
  // the discard.
  assert.ok(p1.piles.hand.some((c) => c.instanceId === 'g1'), 'Guilt stays in the retained hand after firing');
  assert.ok(!p1.piles.discard.some((c) => c.instanceId === 'g1'), 'and is not discarded');
});

// The shown number is bound to the hook, not typed into the sentence.
test('Guilt\'s text binds its HP loss to the hook value', async () => {
  const { staticCardTokens } = await import('../src/model/playingCard.js');
  const guilt = contentBundle.cards.find((c) => c.id === 'guilt');
  assert.match(guilt.textTemplate, /\{loseHp\}/);
  assert.deepEqual(staticCardTokens(REG.cards.get('guilt')), { loseHp: 1 });
  // A hook number with no token in the template is refused, like any effect's.
  const b = { ...contentBundle, cards: contentBundle.cards.map((c) => (c.id === 'guilt' ? { ...c, textTemplate: 'Unplayable. Lose 1 HP.' } : c)) };
  const errs = validateContent(b).errors.map((e) => JSON.stringify(e));
  assert.ok(errs.some((e) => e.includes('guilt') && e.includes('loseHp')), `untokened hook number must be refused: ${errs.slice(0, 3)}`);
});
