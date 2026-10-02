// Warrior's Vow (SPEC §5.2): "Innate. Enter a Stance of your choice. Exhaust."
// The card's effect names a CHOICE, not a stance: playing it offers a pending
// choice of every stance the playing character's class owns (the stance rows'
// `class`, data), and the play intent carries the pick. These tests pin the
// offer, that each pick enters exactly that stance, that a play without a
// legal pick is refused with nothing spent, and the co-op seat route.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { validateContent } from '../src/model/validate.js';
import { createCombat, dispatch, cardChoicePlan } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';

const REG = createRegistries(contentBundle);
const ENEMY = contentBundle.enemies[0].id;
const reaverStances = () => contentBundle.stances.filter((s) => s.class === 'reaver').map((s) => s.id).sort();

function seat(id, classId = 'reaver', upgraded = false) {
  return {
    id, classId, maxHp: 78, hp: 78, mana: 2, maxMana: 2, stamina: 5, maxStamina: 5, energyMax: 3, drawPerTurn: 5,
    deck: [
      { instanceId: `${id}vow`, cardId: 'warriorsVow', upgraded },
      ...Array.from({ length: 8 }, (_, i) => ({ instanceId: `${id}s${i + 1}`, cardId: 'strike', upgraded: false })),
    ],
    relicIds: [], flasks: [],
  };
}

function soloCombat(classId = 'reaver', upgraded = false) {
  const player = seat('p', classId, upgraded);
  const c = createCombat({ registries: REG, rng: createRng(0xc0ffee), player, enemyIds: [ENEMY] });
  // Innate puts the Vow in the opening hand; assert it rather than assume it.
  assert.ok(c.piles.hand.some((card) => card.instanceId === 'pvow'), 'Warrior\'s Vow is Innate');
  return c;
}

test('Warrior\'s Vow authors a stance choice as data, not a fixed stance', () => {
  const vow = REG.cards.get('warriorsVow');
  const op = vow.effects.find((e) => e.op === 'enterStance');
  assert.ok(op, 'the card enters a stance');
  assert.equal(op.stance, undefined, 'no fixed stance');
  assert.equal(op.choose, 'classStance');
  assert.match(vow.textTemplate, /of your choice/);
  assert.ok(reaverStances().length >= 2, 'the Reaver owns at least two stances to choose between');
  assert.deepEqual(validateContent(contentBundle).errors, []);
});

test('playing Warrior\'s Vow offers a pending choice of every class stance', () => {
  const c = soloCombat();
  const plan = cardChoicePlan(c, 'pvow');
  assert.equal(plan.kind, 'stance');
  assert.deepEqual(plan.options.map((o) => o.id).sort(), reaverStances());
  for (const o of plan.options) {
    const row = contentBundle.stances.find((s) => s.id === o.id);
    assert.equal(o.name, row.name);
    assert.equal(o.tooltip, row.tooltip);
  }
  // A card without a choice offers none.
  assert.equal(cardChoicePlan(c, 'ps1'), null);
});

for (const stance of contentBundle.stances.filter((s) => s.class === 'reaver').map((s) => s.id)) {
  test(`choosing ${stance} enters exactly ${stance}`, () => {
    const c = soloCombat();
    const from = c.eventLog.length;
    dispatch(c, { type: 'playCard', cardInstanceId: 'pvow', choice: stance });
    assert.equal(c.player.stanceId, stance);
    const entered = c.eventLog.slice(from).filter((e) => e.type === 'stanceEntered');
    assert.deepEqual(entered.map((e) => e.stance), [stance], 'one stance entered, the chosen one');
    assert.ok(c.piles.exhaust.some((card) => card.instanceId === 'pvow'), 'the Vow exhausts');
  });
}

test('the upgraded Vow still offers the choice and draws 1', () => {
  const c = soloCombat('reaver', true);
  assert.deepEqual(cardChoicePlan(c, 'pvow').options.map((o) => o.id).sort(), reaverStances());
  const hand = c.piles.hand.length;
  dispatch(c, { type: 'playCard', cardInstanceId: 'pvow', choice: 'bulwark' });
  assert.equal(c.player.stanceId, 'bulwark');
  assert.equal(c.piles.hand.length, hand, 'played one, drew one');
});

test('a play without a legal choice is refused and spends nothing', () => {
  for (const choice of [undefined, 'notAStance']) {
    const c = soloCombat();
    const before = { energy: c.player.energy, stamina: c.player.stamina, hand: c.piles.hand.length };
    assert.throws(() => dispatch(c, { type: 'playCard', cardInstanceId: 'pvow', choice }), /Choose a stance/);
    assert.deepEqual({ energy: c.player.energy, stamina: c.player.stamina, hand: c.piles.hand.length }, before);
    assert.equal(c.player.stanceId ?? null, null);
  }
});

test('a choice on a card that offers none is refused', () => {
  const c = soloCombat();
  assert.throws(() => dispatch(c, { type: 'playCard', cardInstanceId: 'ps1', targetId: c.enemies[0].id, choice: 'bulwark' }), /no choice/);
});

test('a character whose class owns no stances is offered the card\'s own class stances', () => {
  const other = contentBundle.classes.find((k) => !contentBundle.stances.some((s) => s.class === k.id));
  assert.ok(other, 'some class owns no stances');
  const c = soloCombat(other.id);
  assert.deepEqual(cardChoicePlan(c, 'pvow').options.map((o) => o.id).sort(), reaverStances());
});

test('the validator refuses an enterStance with neither or both selectors, and an unknown selector', () => {
  const plant = (effect) => {
    const b = { ...contentBundle, cards: contentBundle.cards.map((c) => (c.id === 'warriorsVow' ? { ...c, effects: [effect], upgrade: undefined } : c)) };
    return validateContent(b).errors.map((e) => JSON.stringify(e));
  };
  for (const bad of [{ op: 'enterStance' }, { op: 'enterStance', stance: 'bulwark', choose: 'classStance' }, { op: 'enterStance', choose: 'anyStance' }]) {
    const errs = plant(bad);
    assert.ok(errs.some((e) => e.includes('warriorsVow') && e.includes('enterStance')), `${JSON.stringify(bad)} must be refused: ${errs.slice(0, 3)}`);
  }
});

// Co-op: the session route plays a seat's card through coopCombat.playCard,
// which must offer the same choice and enter the chosen stance on that seat.
test('co-op: a seat\'s Vow offers its class stances and enters the chosen one on that seat only', async () => {
  const { createCoopCombat, playCard, cardChoicePlan: coopPlan } = await import('../src/engine/coopCombat.js');
  for (const stance of reaverStances()) {
    const C = createCoopCombat({ registries: REG, rng: createRng(0xc0ffee), enemyIds: [ENEMY], players: [seat('p1'), seat('p2')] });
    const p1 = C.players.get('p1'), p2 = C.players.get('p2');
    assert.ok(p2.piles.hand.some((card) => card.instanceId === 'p2vow'), 'the Vow is Innate for the seat');
    assert.deepEqual(coopPlan(C, 'p2', 'p2vow').options.map((o) => o.id).sort(), reaverStances());
    assert.throws(() => playCard(C, 'p2', 'p2vow'), /Choose a stance/);
    playCard(C, 'p2', 'p2vow', undefined, stance);
    assert.equal(p2.entity.stanceId, stance, 'the playing seat enters the chosen stance');
    assert.equal(p1.entity.stanceId ?? null, null, 'the other seat is untouched');
  }
});

// The stance the player is already in does nothing as a pick: the foundation
// rules refuse it ("That stance is already active") and the legacy rules make
// it a no-op that still spends the card, so the offer marks it `active` and the
// dialog disables it rather than offer a pick the engine refuses (#1449
// review, Codex P2). The other stances stay choosable.
test('the offer marks the stance already active, solo and co-op', async () => {
  const c = soloCombat();
  assert.ok(cardChoicePlan(c, 'pvow').options.every((o) => o.active === false), 'no stance yet: nothing marked');
  c.player.stanceId = 'bulwark';
  const plan = cardChoicePlan(c, 'pvow');
  assert.deepEqual(plan.options.filter((o) => o.active).map((o) => o.id), ['bulwark']);
  dispatch(c, { type: 'playCard', cardInstanceId: 'pvow', choice: 'gorefire' });
  assert.equal(c.player.stanceId, 'gorefire');

  const { createCoopCombat, cardChoicePlan: coopPlan } = await import('../src/engine/coopCombat.js');
  const C = createCoopCombat({ registries: REG, rng: createRng(0xc0ffee), enemyIds: [ENEMY], players: [seat('p1'), seat('p2')] });
  C.players.get('p2').entity.stanceId = 'brace';
  assert.deepEqual(coopPlan(C, 'p2', 'p2vow').options.filter((o) => o.active).map((o) => o.id), ['brace']);
  assert.ok(coopPlan(C, 'p1', 'p1vow').options.every((o) => !o.active), 'the other seat\'s stance is not this seat\'s');
});

// BOUNDARY (engine/actions.js enterStance, model/validate.js): only a played
// card supplies a choice. An enterStance `choose` resolved anywhere else (a
// stance onEnter, a status hook, an enemy move) has no pick and must fail
// loudly, never enter a guessed stance. No shipped row does this.
test('a chosen enterStance resolved with no play choice throws and enters nothing', async () => {
  const { executeAction } = await import('../src/engine/actions.js');
  const c = soloCombat();
  assert.throws(
    () => executeAction(c, { effect: { op: 'enterStance', choose: 'classStance' }, source: c.player, owner: c.player, target: c.player, meta: {} }),
    /needs a play choice/,
  );
  assert.equal(c.player.stanceId ?? null, null);
  const chosenStance = /"op":"enterStance"[^{}]*"choose"/;
  const outside = Object.entries(contentBundle).filter(([kind]) => kind !== 'cards' && chosenStance.test(JSON.stringify(contentBundle[kind]))).map(([kind]) => kind);
  assert.deepEqual(outside, [], 'no shipped row outside the cards carries enterStance choose');
});
