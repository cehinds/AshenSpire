// tests/coop-parity.test.mjs — co-op parity with solo on three game-feel
// systems (PR #1287 round 2):
//   SPEC §12.2.1 item 10 — each seat's Weapon Art charge meters accrue from
//     its own hits, unleash from its own full meter, and ride the host snapshot;
//   SPEC §7.4 "Co-op"    — hit-stop / kill cam decisions over a co-op receipt,
//     and the host's transient `finale` frame for a fight-ending kill;
//   SPEC §3.8.1 co-op    — the elite chest per seat: rolled on the seat's
//     stream, stored in the offer, a pick that lands exactly one option, stale
//     picks refused without mutation, and catch-up replaying the stored chest.
//
// Host half: tools/session.mjs (the authoritative co-op host). Client half: the
// real src/ui/screens/coop.js on the fake DOM helper (the reward door), as
// tests/coop-boss-relic.test.mjs does.

import test from 'node:test';
import assert from 'node:assert/strict';

import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createSession, restoreSession } from '../tools/session.mjs';
import { applyChestOption } from '../src/model/rewardChest.js';
import { rollEliteChest } from '../src/engine/encounters.js';
import { createRng } from '../src/engine/rng.js';
import { receiptJuicePlan, coopFinaleHoldMs, hitStopForEvent, COMBAT_JUICE } from '../src/ui/models/CombatJuiceModel.js';
import { rewardDom } from './helpers/reward-dom.mjs';

const REG = createRegistries(contentBundle);
const RULES = REG.balance.weaponArtCharge;

function party(seed = 'COOPPARITY', classes = ['reaver', 'reaver']) {
  const S = createSession({ registries: REG, seedString: seed });
  S.addMember({ id: 'p1', name: 'Wren', classId: classes[0] });
  S.addMember({ id: 'p2', name: 'Fenn', classId: classes[1] });
  S.start();
  S.session.cursorId = Object.keys(S.session.mapGraph.nodes)[0];
  return S;
}
const seat = (S, id) => S.livingMembers().find((m) => m.id === id);

// A live fight whose enemies cannot fall by accident.
function fight(S, type = 'monster') {
  assert.equal(S.resolveNode({ type }).ok, true);
  const C = S.live.combat;
  for (const enemy of C.enemies) { enemy.hp = enemy.maxHp = 999; if (enemy.poiseMeter) enemy.poiseMeter.max = 999; }
  return C;
}
// Put the named seat's card in its hand, give it the means, play it through the host.
function play(S, memberId, pred) {
  const P = S.live.combat.players.get(memberId);
  const card = Object.values(P.piles).flat().find(pred);
  assert.ok(card, `${memberId} holds the card somewhere`);
  for (const pile of Object.values(P.piles)) { const i = pile.indexOf(card); if (i >= 0) pile.splice(i, 1); }
  P.piles.hand.push(card);
  P.ended = false;
  Object.assign(P.entity, { energy: 20, stamina: P.entity.maxStamina, mana: P.entity.maxMana });
  const target = S.live.combat.enemies.find((e) => e.alive);
  const res = S.combatPlay(memberId, card.instanceId, target.id);
  assert.equal(res.ok, true, res.error);
  return card;
}
const kitStrike = (weaponId) => (c) => c.kitRole === 'attack' && c.grantedBy === weaponId;
const artOf = (weaponId) => (c) => c.equipmentRole === 'weaponArt' && c.grantedBy === weaponId;

// ---- Weapon Art charge, per seat (SPEC §12.2.1 item 10) -----------------------

test('each seat fills only its own meter, from its own weapon hits', () => {
  const S = party();
  const C = fight(S);
  play(S, 'p1', kitStrike('straightSword'));
  assert.equal(C.players.get('p1').artCharge.straightSword, RULES.gainPerHit);
  assert.deepEqual(C.players.get('p2').artCharge, {}, 'the other seat\'s meter never moves');
  const rows = S.snapshot().scene.players;
  const p1Row = rows.find((p) => p.id === 'p1').artCharge.find((r) => r.weaponId === 'straightSword');
  assert.equal(p1Row.value, RULES.gainPerHit);
  assert.equal(rows.find((p) => p.id === 'p2').artCharge.find((r) => r.weaponId === 'straightSword').value, 0);
  const changed = S.snapshot().scene.events.filter((e) => e.type === 'artChargeChanged');
  assert.deepEqual(changed.map((e) => [e.playerId, e.weaponId, e.value, e.reason]), [['p1', 'straightSword', RULES.gainPerHit, 'hit']]);
});

test('the charge receipt names its seat, and a hit another seat landed charges nobody else', () => {
  const S = party();
  const C = fight(S);
  play(S, 'p2', kitStrike('straightSword'));
  const receipt = S.snapshot().scene.events.find((e) => e.type === 'artChargeChanged');
  assert.equal(receipt.playerId, 'p2');
  assert.equal(receipt.weaponId, 'straightSword');
  // The active seat is p2 now; a hit carrying p1's seat id is not p2's.
  const before = C.players.get('p2').artCharge.straightSword;
  C.emit('damageDealt', { sourceId: 'player', sourcePlayerId: 'p1', targetId: C.enemies[0].id, amount: 4, blocked: 0, cardInstanceId: 'x', grantedBy: 'straightSword', equipmentRole: 'granted', isAttack: true });
  assert.equal(C.players.get('p2').artCharge.straightSword, before);
  assert.equal(C.players.get('p1').artCharge.straightSword, undefined);
});

test('a full seat unleashes its Art; only that seat\'s meter empties', () => {
  const S = party();
  const C = fight(S);
  const max = REG.balance.weaponArtCharge.maxByWeapon?.straightSword ?? RULES.defaultMax;
  C.players.get('p1').artCharge.straightSword = max;
  C.players.get('p2').artCharge.straightSword = 2;
  // The hand card carries the play door's own reading.
  const P1 = C.players.get('p1');
  const art = Object.values(P1.piles).flat().find(artOf('straightSword'));
  for (const pile of Object.values(P1.piles)) { const i = pile.indexOf(art); if (i >= 0) pile.splice(i, 1); }
  P1.piles.hand.push(art);
  play(S, 'p1', kitStrike('straightSword')); // any settle refreshes the scene; the meter is capped
  const handCard = S.snapshot().scene.players.find((p) => p.id === 'p1').hand.find((c) => c.instanceId === art.instanceId);
  assert.deepEqual(handCard.artCharge, { weaponId: 'straightSword', value: max, max, unleashed: true });
  play(S, 'p1', (c) => c === art);
  const events = S.snapshot().scene.events;
  assert.ok(events.some((e) => e.type === 'artUnleashed' && e.playerId === 'p1' && e.weaponId === 'straightSword'));
  assert.equal(events.find((e) => e.type === 'cardPlayed' && e.cardInstanceId === art.instanceId).unleashed, true);
  assert.equal(C.players.get('p1').artCharge.straightSword, 0);
  assert.equal(C.players.get('p2').artCharge.straightSword, 2, 'the teammate keeps its charge');
});

test('a non-full Art plays plain and spends nothing', () => {
  const S = party();
  const C = fight(S);
  C.players.get('p1').artCharge.straightSword = 1;
  const art = play(S, 'p1', artOf('straightSword'));
  const events = S.snapshot().scene.events;
  assert.ok(!events.some((e) => e.type === 'artUnleashed'));
  assert.equal(events.find((e) => e.type === 'cardPlayed' && e.cardInstanceId === art.instanceId).unleashed, undefined);
  assert.equal(C.players.get('p1').artCharge.straightSword, 1);
});

// ---- combat juice over a co-op receipt (SPEC §7.4 "Co-op") --------------------

const T = COMBAT_JUICE.sizing.damageTiers;
const receipt = [
  { type: 'damageDealt', sourceId: 'player', sourcePlayerId: 'p1', targetId: 'e1', amount: T.heavyAt, blocked: 0 },
  { type: 'damageDealt', sourceId: 'player', sourcePlayerId: 'p1', targetId: 'e1', amount: T.capAt, blocked: 0 },
  { type: 'enemyStaggered', targetId: 'e1' },
  { type: 'damageDealt', sourceId: 'player', sourcePlayerId: 'p2', targetId: 'e2', amount: T.heavyAt + 10, blocked: T.heavyAt + 10 },
  { type: 'damageDealt', sourceId: 'e2', targetId: 'player', playerId: 'p2', amount: T.critAt, blocked: 0 },
  { type: 'enemyDied', targetId: 'e1' },
];
const rankOf = (id) => (id === 'e1' ? 'boss' : null);

test('a receipt freezes each struck figure once, for its longest stop, with who struck it', () => {
  const plan = receiptJuicePlan(receipt, { rankOf }, { paced: true });
  const byId = Object.fromEntries(plan.stops.map((s) => [s.targetId, s]));
  assert.equal(byId.e1.ms, Math.max(...receipt.slice(0, 3).map((e) => hitStopForEvent(e, { paced: true }))));
  assert.equal(byId.e1.ms, COMBAT_JUICE.motion.hitStop.maxMs);
  assert.deepEqual(byId.e1.sourceIds, ['p1']);
  assert.equal(byId.e2, undefined, 'guard-absorbed damage never stops time');
  assert.equal(byId.p2.ms, hitStopForEvent(receipt[4], { paced: true }), 'a seat struck by an enemy freezes too');
  assert.deepEqual(byId.p2.sourceIds, ['e2']);
  assert.equal(plan.killCam.plan.reason, 'boss');
  assert.equal(plan.killCam.event, receipt[5]);
});

test('the co-op juice gates are solo\'s', () => {
  for (const gates of [{ paced: false }, { paced: true, reducedMotion: true }]) {
    const plan = receiptJuicePlan(receipt, { rankOf }, gates);
    assert.deepEqual(plan.stops, []);
    assert.equal(plan.killCam, null);
  }
  const noCam = receiptJuicePlan(receipt, { rankOf }, { paced: true, killCam: false });
  assert.ok(noCam.stops.length > 0, 'the Kill cam setting leaves hit-stop alone');
  assert.equal(noCam.killCam, null);
  // A plain kill that wins the fight is the last-enemy cam.
  const last = receiptJuicePlan([{ type: 'enemyDied', targetId: 'e9' }], { won: true }, { paced: true });
  assert.equal(last.killCam.plan.reason, 'lastEnemy');
});

test('the finale holds for the kill cam, else the authored hold, and not at instant speed', () => {
  const cam = receiptJuicePlan(receipt, { rankOf }, { paced: true }).killCam;
  assert.equal(coopFinaleHoldMs(cam, { paced: true }), COMBAT_JUICE.motion.killCam.bossMs);
  assert.equal(coopFinaleHoldMs(null, { paced: true }), COMBAT_JUICE.motion.coopFinaleHoldMs);
  assert.equal(coopFinaleHoldMs(cam, { paced: false }), 0);
});

test('a fight-ending kill reaches the client as the host\'s transient finale', () => {
  const S = party();
  const C = fight(S);
  const [first, ...rest] = C.enemies;
  for (const e of rest) { e.hp = 0; e.alive = false; }
  first.hp = 1;
  play(S, 'p1', kitStrike('straightSword'));
  const snap = S.snapshot();
  assert.equal(snap.scene.kind, 'reward');
  assert.equal(snap.finale.kind, 'combat');
  assert.equal(snap.finale.result, 'victory');
  assert.ok(snap.finale.events.some((e) => e.type === 'enemyDied' && e.targetId === first.id), 'the killing receipt rides the finale');
  assert.equal(S.serialize().finale, undefined, 'never persisted');
  assert.equal(JSON.stringify(S.serialize()).includes('"finale"'), false);
  S.chooseReward('p1', {});
  S.chooseReward('p2', {});
  assert.equal(S.snapshot().finale, undefined, 'dropped when the door closes');
});

// ---- the co-op elite chest (SPEC §3.8.1) --------------------------------------

test('each seat rolls its own chest on its own stream: no armament, no single relic, repeatable by seed', () => {
  const a = party('CHESTSEED', ['reaver', 'starseer']);
  const b = party('CHESTSEED', ['reaver', 'starseer']);
  const p1 = a.rollRewardFor('p1', 'elite');
  const p2 = a.rollRewardFor('p2', 'elite');
  assert.equal(p1.relicId, undefined, 'the chest replaces the single relic');
  assert.ok(p1.chest && p1.chest.options.length > 0);
  assert.notDeepEqual(p1.chest, p2.chest, 'each seat has its own table');
  for (const offer of [p1, p2]) {
    assert.ok(offer.chest.options.every((o) => o.category !== 'armament'), 'co-op has no armament bag');
    assert.equal(new Set(offer.chest.options.map((o) => o.category)).size, offer.chest.options.length, 'distinct categories');
  }
  assert.deepEqual(b.rollRewardFor('p1', 'elite').chest, p1.chest, 'one seed, one chest');
  // A normal door is untouched.
  assert.equal(a.rollRewardFor('p1', 'normal').chest, undefined);
});

test('rollEliteChest omit leaves a category out before it is drawn', () => {
  const S = party();
  const run = seat(S, 'p1').run;
  for (let i = 0; i < 20; i++) {
    const chest = rollEliteChest(REG, createRng(1000 + i), run, { omit: ['armament', 'relic'] });
    assert.ok(chest.options.every((o) => o.category === 'upgrade' || o.category === 'cinders'));
  }
});

function openReward(S, offers) {
  S.session.scene = { kind: 'reward', pool: 'elite', offers, chosen: {}, afterReward: null };
}
const chestOffer = (options) => ({ pool: 'elite', cardIds: [], cinders: 0, flaskId: null, chest: { options } });

test('a chest pick grants exactly the named option and nothing else', () => {
  const S = party();
  const m1 = seat(S, 'p1');
  const m2 = seat(S, 'p2');
  const relic = REG.relics.all().find((r) => r.rarity === 'common' && !m2.run.relics.includes(r.id)).id;
  const purse = { category: 'cinders', cinders: 77, smithingStones: 2 };
  openReward(S, {
    p1: chestOffer([{ category: 'relic', relicId: relic }, purse]),
    p2: chestOffer([{ category: 'relic', relicId: relic }, purse]),
  });
  const before = structuredClone(m1.run);
  assert.equal(S.chooseReward('p1', { chestIndex: 1 }).ok, true);
  assert.equal(m1.run.cinders, before.cinders + 77);
  assert.equal(m1.run.smithingStones, (before.smithingStones || 0) + 2);
  assert.deepEqual(m1.run.relics, before.relics, 'the other option stays in the chest');
  assert.deepEqual(m1.run.deck, before.deck);
  const relicsBefore = m2.run.relics.length;
  assert.equal(S.chooseReward('p2', { chestIndex: 0 }).ok, true);
  assert.deepEqual(m2.run.relics.slice(relicsBefore), [relic]);
});

test('a seat that has chosen cannot take a chest option while the others choose', () => {
  const S = party();
  const m1 = seat(S, 'p1');
  const purse = { category: 'cinders', cinders: 55, smithingStones: 0 };
  openReward(S, { p1: { ...chestOffer([purse]), cardIds: ['stomp'] }, p2: chestOffer([purse]) });
  assert.equal(S.chooseReward('p1', { cardId: 'stomp' }).ok, true);
  const before = structuredClone(m1.run);
  const res = S.chooseReward('p1', { chestIndex: 0 });
  assert.equal(res.ok, false, 'the second pick at one door is refused');
  assert.deepEqual(m1.run, before, 'nothing granted on top');
  assert.equal(S.session.scene.kind, 'reward', 'p2 is still choosing');
});

test('a bad index or a stale upgrade is refused with nothing mutated, and the door stays open', () => {
  const S = party();
  const m = seat(S, 'p1');
  const upgradeable = m.run.deck.find((c) => !c.upgraded && !c.equipmentRole && !c.sourceArmamentId && REG.cards.get(c.cardId).upgrade);
  assert.ok(upgradeable, 'the starting deck holds an ordinary upgradeable card');
  openReward(S, { p1: chestOffer([{ category: 'upgrade', mode: 'owned', instanceId: upgradeable.instanceId, cardId: upgradeable.cardId }]), p2: chestOffer([]) });
  const before = structuredClone(m.run);
  assert.equal(S.chooseReward('p1', { chestIndex: 5 }).ok, false);
  upgradeable.upgraded = true; // the instance changed since the roll
  const snapshot = structuredClone(m.run);
  const res = S.chooseReward('p1', { chestIndex: 0, cardId: null });
  assert.equal(res.ok, false);
  assert.deepEqual(m.run, snapshot, 'nothing moved');
  assert.equal(S.session.scene.kind, 'reward');
  assert.equal(S.session.scene.chosen.p1, undefined, 'the seat may still choose');
  upgradeable.upgraded = false;
  assert.equal(S.chooseReward('p1', { chestIndex: 0 }).ok, true);
  assert.equal(m.run.deck.find((c) => c.instanceId === upgradeable.instanceId).upgraded, true);
  assert.equal(m.run.deck.length, before.deck.length);
});

test('a missed elite chest is stored in the catch-up entry and replays those options', () => {
  const S = party();
  S.setConnected('p2', false);
  const C = fight(S, 'elite');
  for (const e of C.enemies) { e.hp = 1; }
  // Fell every enemy with p1's strikes.
  let guard = 0;
  while (S.live && guard++ < 10) play(S, 'p1', kitStrike('straightSword'));
  const m2 = seat(S, 'p2');
  const entry = m2.catchup.find((item) => item.type === 'reward');
  assert.ok(entry && entry.offer.chest, 'the absent seat\'s chest is stored in its catch-up entry');
  const stored = structuredClone(entry.offer.chest);
  const view = S.snapshot().party.find((p) => p.id === 'p2').catchupQueue.find((item) => item.type === 'reward');
  assert.deepEqual(view.offer.chest, stored, 'the view shows the stored options, not a re-roll');
  assert.deepEqual(view.chestTakeable, stored.options.map(() => true));
  const index = m2.catchup.indexOf(entry);
  const purse = stored.options.findIndex((o) => o.category === 'cinders');
  const pickIndex = purse >= 0 ? purse : 0;
  const cindersBefore = m2.run.cinders;
  const relicsBefore = m2.run.relics.length;
  S.setConnected('p2', true);
  const res = S.resolveCatchup('p2', index, { chestIndex: pickIndex });
  assert.equal(res.ok, true, res.error);
  const option = stored.options[pickIndex];
  if (option.category === 'cinders') assert.equal(m2.run.cinders, cindersBefore + option.cinders);
  if (option.category === 'relic') assert.equal(m2.run.relics.length, relicsBefore + 1);
  assert.ok(!m2.catchup.includes(entry), 'the entry is resolved');
});

test('a stale chest option on catch-up is marked and refused, and the entry waits', () => {
  const S = party();
  const m = seat(S, 'p1');
  const inst = m.run.deck.find((c) => !c.upgraded && !c.equipmentRole && !c.sourceArmamentId && REG.cards.get(c.cardId).upgrade);
  const offer = chestOffer([{ category: 'upgrade', mode: 'owned', instanceId: inst.instanceId, cardId: inst.cardId }, { category: 'cinders', cinders: 5, smithingStones: 0 }]);
  m.catchup.push({ type: 'reward', offer, act: 1, floor: 1 });
  inst.upgraded = true; // an earlier replayed entry upgraded it
  const view = S.snapshot().party.find((p) => p.id === 'p1').catchupQueue[0];
  assert.deepEqual(view.chestTakeable, [false, true]);
  const before = structuredClone(m.run);
  assert.equal(S.resolveCatchup('p1', 0, { chestIndex: 0 }).ok, false);
  assert.deepEqual(m.run, before);
  assert.equal(m.catchup.length, 1);
  assert.equal(S.resolveCatchup('p1', 0, { chestIndex: 1 }).ok, true);
  assert.equal(m.run.cinders, before.cinders + 5);
  assert.equal(m.catchup.length, 0);
});

test('a restored offer or catch-up entry naming unknown content is refused at the door, never granted', () => {
  const bad = { category: 'relic', relicId: 'noSuchRelic' };
  const purse = { category: 'cinders', cinders: 5, smithingStones: 0 };
  // The pending reward scene: p1's stored chest names a relic this build lacks.
  const S = party();
  openReward(S, { p1: chestOffer([bad, purse]), p2: chestOffer([purse]) });
  const saved = JSON.parse(JSON.stringify(S.serialize()));
  const R = restoreSession(REG, saved);
  assert.deepEqual(R.refusedMembers().map((r) => r.id), ['p1'], 'the poisoned seat is refused with its reason');
  assert.match(R.refusedMembers()[0].reason, /noSuchRelic/);
  R.setConnected('p1', true);
  assert.equal(R.chooseReward('p1', { chestIndex: 0 }).ok, false, 'nothing is granted from the bad offer');

  // A catch-up entry, by the same door.
  const T = party();
  seat(T, 'p2').catchup.push({ type: 'reward', offer: chestOffer([bad, purse]), act: 1, floor: 1 });
  const U = restoreSession(REG, JSON.parse(JSON.stringify(T.serialize())));
  assert.deepEqual(U.refusedMembers().map((r) => r.id), ['p2']);
  assert.equal(U.livingMembers().some((m) => m.id === 'p2'), false);

  // And the grant itself refuses an id the registries do not hold.
  const run = structuredClone(seat(T, 'p1').run);
  const relics = run.relics.slice();
  assert.equal(applyChestOption(REG, run, bad), false);
  assert.deepEqual(run.relics, relics);
});

// ---- the co-op screen's chest door --------------------------------------------

function mountCoopScreen(snapshot, { myIds } = {}) {
  const dom = rewardDom();
  Object.assign(globalThis, dom);
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.location = { search: '', href: 'http://localhost/', hash: '' };
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  dom.window.matchMedia = globalThis.matchMedia;
  dom.document.addEventListener = () => {};
  dom.document.removeEventListener = () => {};
  dom.document.documentElement = dom.document.createElement('html');
  return import('../src/ui/screens/coop.js').then(({ mountCoop }) => {
    const sent = [];
    const conn = { _h: null, setHandlers(h) { this._h = h; }, send(m) { sent.push(m); }, close() {}, get open() { return false; } };
    const app = dom.document.createElement('main');
    dom.document.body.append(app);
    mountCoop(app, { registries: REG, conn, myId: 'p1', myIds, meta: {}, onSettingsChange() {}, onLeave() {} });
    conn._h.onMessage({ t: 'state', snapshot });
    return { app, sent, dom };
  });
}
const partyRows = (catchupQueue = []) => [
  { id: 'p1', name: 'Wren', classId: 'reaver', connected: true, alive: true, hp: 60, maxHp: 60, cinders: 0, deckSize: 10, relics: 0, flasks: 0, catchup: catchupQueue.length, catchupQueue },
];
const baseSnap = { actNumber: 1, floor: 4, seedString: 'X', endless: false, seatOrder: ['weald', 'marches', 'reach'], seatId: 'weald', seatName: 'The Hollow Weald' };
const OPTIONS = [
  { category: 'relic', relicId: 'forsakenMedallion' },
  { category: 'upgrade', mode: 'rare', cardId: 'executioner' },
  { category: 'cinders', cinders: 90, smithingStones: 1 },
];

test('the co-op reward door lays out the chest and sends the index tapped; a stale catch-up option is disabled', async () => {
  const realInterval = globalThis.setInterval;
  globalThis.setInterval = (fn, ms, ...a) => { const h = realInterval(fn, ms, ...a); h.unref?.(); return h; };
  try {
    const { app, sent } = await mountCoopScreen({
      ...baseSnap, party: partyRows(),
      scene: { kind: 'reward', pool: 'elite', chosen: {}, afterReward: null, offers: { p1: { pool: 'elite', cardIds: ['stomp'], cinders: 1, chest: { options: OPTIONS } } } },
    });
    const opts = app.querySelectorAll('.coop-chest-option');
    assert.deepEqual(opts.map((o) => o.dataset.chestIndex), ['0', '1', '2']);
    assert.equal(app.querySelectorAll('.coop-relic-take').length, 0, 'no single relic beside the chest');
    opts[2].click();
    app.querySelector('.coop-continue').click();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].t, 'chooseReward');
    assert.equal(sent[0].pick.chestIndex, 2);

    const cu = await mountCoopScreen({
      ...baseSnap, scene: { kind: 'map' }, reachableIds: [], map: null,
      party: partyRows([{ type: 'reward', act: 1, floor: 2, offer: { pool: 'elite', cardIds: ['stomp'], chest: { options: OPTIONS } }, chestTakeable: [true, false, true] }]),
    });
    const cuOpts = cu.app.querySelectorAll('.coop-chest-option');
    assert.equal(cuOpts.length, 3);
    assert.equal(cuOpts[1].disabled, true, 'a stale option is drawn disabled');
    cuOpts[1].click();
    assert.equal(cu.sent.filter((m) => m.t === 'catchupChoice').length, 0, 'a disabled option sends nothing');
    cuOpts[0].click();
    cu.app.querySelector('.coop-continue').click();
    assert.equal(cu.sent.at(-1).t, 'catchupChoice');
    assert.equal(cu.sent.at(-1).pick.chestIndex, 0);
  } finally {
    globalThis.setInterval = realInterval;
  }
});

test('couch co-op: each local seat stages its own reward pick; switching seats neither loses nor transfers it (PR #1287 review)', async () => {
  const realInterval = globalThis.setInterval;
  globalThis.setInterval = (fn, ms, ...a) => { const h = realInterval(fn, ms, ...a); h.unref?.(); return h; };
  try {
    // Two seats on one screen whose offers serialize identically.
    const offer = () => ({ pool: 'elite', cardIds: ['stomp', 'executioner'], cinders: 1, chest: { options: OPTIONS } });
    const party2 = [...partyRows(), { ...partyRows()[0], id: 'p2', name: 'Fenn' }];
    const { app, sent, dom } = await mountCoopScreen(
      { ...baseSnap, party: party2, scene: { kind: 'reward', pool: 'elite', chosen: {}, afterReward: null, offers: { p1: offer(), p2: offer() } } },
      { myIds: ['p1', 'p2'] },
    );
    const seatTab = (i) => dom.document.querySelectorAll('.seat-tab').find((t) => t.dataset.seatI === String(i));
    const chestSelected = () => app.querySelectorAll('.coop-chest-option').map((o) => o.className.includes('is-selected'));
    // p1 stages a card and chest option 2.
    app.querySelectorAll('.reward-row .card')[1].click();
    app.querySelectorAll('.coop-chest-option')[2].click();
    // Switch to p2: nothing of p1's is staged for it.
    seatTab(1).click();
    assert.deepEqual(chestSelected(), [false, false, false], 'p2 does not inherit p1\'s chest pick');
    assert.equal(app.querySelectorAll('.reward-row .card.selected').length, 0, 'nor its card');
    app.querySelectorAll('.coop-chest-option')[0].click();
    // Back to p1: its picks survived the switch.
    seatTab(0).click();
    assert.deepEqual(chestSelected(), [false, false, true], 'p1 keeps its chest pick');
    app.querySelector('.coop-continue').click();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].as, 'p1');
    assert.equal(sent[0].pick.cardId, 'executioner');
    assert.equal(sent[0].pick.chestIndex, 2);
    // p2 submits only its own pick.
    seatTab(1).click();
    app.querySelector('.coop-continue').click();
    assert.equal(sent.at(-1).as, 'p2');
    assert.equal(sent.at(-1).pick.cardId, null);
    assert.equal(sent.at(-1).pick.chestIndex, 0);
  } finally {
    globalThis.setInterval = realInterval;
  }
});

test('a seat that re-sends its chest pick is granted the chest once', () => {
  const S = party();
  const m1 = seat(S, 'p1');
  seat(S, 'p2');
  const purse = { category: 'cinders', cinders: 77, smithingStones: 2 };
  const other = { category: 'cinders', cinders: 11, smithingStones: 0 };
  openReward(S, { p1: chestOffer([purse, other]), p2: chestOffer([purse]) });
  const before = m1.run.cinders;
  assert.equal(S.chooseReward('p1', { chestIndex: 0 }).ok, true);
  // The co-op screen stays up and re-sends the whole pick on a later tap.
  S.chooseReward('p1', { chestIndex: 0 });
  S.chooseReward('p1', { chestIndex: 1 });
  assert.equal(m1.run.cinders, before + 77, 'one chest option, once');
});

test('one elite door: the card AND a chest option are staged and land together (Codex P1)', async () => {
  const realInterval = globalThis.setInterval;
  globalThis.setInterval = (fn, ms, ...a) => { const h = realInterval(fn, ms, ...a); h.unref?.(); return h; };
  try {
    const offer = { pool: 'elite', cardIds: ['stomp', 'executioner'], cinders: 1, chest: { options: OPTIONS } };
    const { app, sent } = await mountCoopScreen({ ...baseSnap, party: partyRows(), scene: { kind: 'reward', pool: 'elite', chosen: {}, afterReward: null, offers: { p1: offer } } });
    app.querySelectorAll('.coop-chest-option')[2].click();
    assert.equal(sent.length, 0, 'a chest tap does not close the door');
    app.querySelectorAll('.reward-row .card')[1].click();
    assert.equal(sent.length, 0, 'nor does a card tap');
    assert.equal(app.querySelectorAll('.coop-chest-option')[2].className.includes('is-selected'), true, 'the staged chest option stays marked');
    app.querySelector('.coop-continue').click();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].pick.cardId, 'executioner');
    assert.equal(sent[0].pick.chestIndex, 2);

    // The host lands both from that one message, in a one-seat session.
    const S = createSession({ registries: REG, seedString: 'SOLOSEAT' });
    S.addMember({ id: 'p1', name: 'Wren', classId: 'reaver' });
    S.start();
    S.session.cursorId = Object.keys(S.session.mapGraph.nodes)[0];
    const m = seat(S, 'p1');
    S.session.scene = { kind: 'reward', pool: 'elite', offers: { p1: offer }, chosen: {}, afterReward: null };
    const deck = m.run.deck.length;
    const cinders = m.run.cinders;
    assert.equal(S.chooseReward('p1', sent[0].pick).ok, true);
    assert.equal(m.run.deck.length, deck + 1);
    assert.equal(m.run.deck.at(-1).cardId, 'executioner');
    assert.equal(m.run.cinders, cinders + 90);
    // Once per seat still holds: a repeat grants nothing more.
    S.session.scene = { kind: 'reward', pool: 'elite', offers: { p1: offer }, chosen: {}, afterReward: null, claimed: { p1: { card: true, chest: true } } };
    S.chooseReward('p1', sent[0].pick);
    assert.equal(m.run.deck.length, deck + 1);
    assert.equal(m.run.cinders, cinders + 90);
  } finally {
    globalThis.setInterval = realInterval;
  }
});

test('catch-up: a held chest relic with no substitute left is unavailable and refused, the entry waits (Codex P2)', () => {
  const S = party();
  const m = seat(S, 'p1');
  const stored = REG.relics.all().find((r) => r.rarity === 'common').id;
  const offer = chestOffer([{ category: 'relic', relicId: stored }, { category: 'cinders', cinders: 5, smithingStones: 0 }]);
  m.catchup.push({ type: 'reward', offer, act: 1, floor: 1 });
  // An earlier replayed entry granted the stored relic, and the seat owns every substitute.
  for (const id of REG.relics.all().map((r) => r.id)) if (!m.run.relics.includes(id)) m.run.relics.push(id);
  const view = S.snapshot().party.find((p) => p.id === 'p1').catchupQueue[0];
  assert.deepEqual(view.chestTakeable, [false, true], 'the duplicate relic is not advertised');
  const before = structuredClone(m.run);
  const rng = JSON.stringify(m.rng.getCounters());
  const res = S.resolveCatchup('p1', 0, { chestIndex: 0 });
  assert.equal(res.ok, false);
  assert.deepEqual(m.run, before, 'nothing granted');
  assert.equal(m.catchup.length, 1, 'the entry is not consumed');
  assert.equal(JSON.stringify(m.rng.getCounters()), rng, 'no draw spent');
  assert.equal(S.resolveCatchup('p1', 0, { chestIndex: 1 }).ok, true, 'another option still lands');
  assert.equal(m.run.cinders, before.cinders + 5);
  assert.equal(m.catchup.length, 0);
});

test('catch-up: a held chest relic with a substitute left is still takeable and pays the substitute', () => {
  const S = party();
  const m = seat(S, 'p1');
  const held = REG.relics.all().find((r) => r.rarity === 'common' && !m.run.relics.includes(r.id)).id;
  m.run.relics.push(held);
  m.catchup.push({ type: 'reward', offer: chestOffer([{ category: 'relic', relicId: held }]), act: 1, floor: 1 });
  assert.deepEqual(S.snapshot().party.find((p) => p.id === 'p1').catchupQueue[0].chestTakeable, [true]);
  const n = m.run.relics.length;
  assert.equal(S.resolveCatchup('p1', 0, { chestIndex: 0 }).ok, true);
  assert.equal(m.run.relics.length, n + 1);
});

test('a flask-growth relic from a co-op chest grows the seat\'s flask belt at once', () => {
  const S = party();
  const m1 = seat(S, 'p1');
  seat(S, 'p2');
  assert.ok(m1.run.flaskCharges, 'the seat carries a flask belt');
  assert.ok(!m1.run.relics.includes('goldenSprout'));
  const capacity = m1.run.flaskCharges.capacity;
  openReward(S, { p1: chestOffer([{ category: 'relic', relicId: 'goldenSprout' }]), p2: chestOffer([]) });
  assert.equal(S.chooseReward('p1', { chestIndex: 0 }).ok, true);
  assert.ok(m1.run.relics.includes('goldenSprout'));
  assert.equal(m1.run.flaskCharges.capacity, capacity + 1, 'Golden Sprout\'s growth binds when the relic lands');
});

// ---- the finale behind an enemy-turn replay (SPEC §7.4, co-op) -----------------

// The combat board on the fake DOM: the reward helper plus the few element
// methods the board's sprites and flask row reach for.
function mountCoopBoard() {
  const dom = rewardDom();
  Object.assign(globalThis, dom);
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.location = { search: '', href: 'http://localhost/', hash: '' };
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.CSS = { escape: (s) => s };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '', opacity: '0' });
  dom.window.matchMedia = globalThis.matchMedia;
  dom.document.addEventListener = () => {};
  dom.document.removeEventListener = () => {};
  dom.document.documentElement = dom.document.createElement('html');
  const EP = Object.getPrototypeOf(dom.document.createElement('div'));
  Object.assign(EP, {
    getAnimations: () => [],
    animate: () => ({ cancel() {}, finished: Promise.resolve(), addEventListener() {} }),
    focus() {}, scrollIntoView() {},
    prepend(n) { n.remove(); n.parentNode = this; this.children.unshift(n); },
    replaceChildren(...c) { this.children.forEach((x) => { x.parentNode = null; }); this.children = []; this.append(...c); },
    insertBefore(n) { this.appendChild(n); return n; },
    contains(n) { return n === this || this.children.some((c) => c.contains(n)); },
    replaceWith(n) { const p = this.parentNode; if (!p) return; n.remove(); n.parentNode = p; p.children[p.children.indexOf(this)] = n; this.parentNode = null; },
  });
  return import('../src/ui/screens/coop.js').then(({ mountCoop }) => {
    const conn = { _h: null, setHandlers(h) { this._h = h; }, send() {}, close() {}, get open() { return false; } };
    const app = dom.document.createElement('main');
    dom.document.body.append(app);
    mountCoop(app, { registries: REG, conn, myId: 'p1', meta: {}, onSettingsChange() {}, onLeave() {} });
    return { app, deliver: (snapshot) => conn._h.onMessage({ t: 'state', snapshot }), message: (m) => conn._h.onMessage(m) };
  });
}

test('a finale that arrives while the enemy turn plays is still played before the next scene', async () => {
  // Timers are held and released by hand, so the test can look at the board
  // between the replay's end and the next scene.
  const realTimeout = globalThis.setTimeout;
  const realInterval = globalThis.setInterval;
  const queued = [];
  globalThis.setTimeout = (fn, _ms, ...a) => { queued.push(() => fn(...a)); return queued.length; };
  globalThis.setInterval = (fn, ms, ...a) => { const h = realInterval(fn, ms, ...a); h.unref?.(); return h; };
  const tick = () => new Promise((r) => setImmediate(r));
  try {
    const S = party('FINALEPACE');
    fight(S);
    const fightSnap = JSON.parse(JSON.stringify(S.snapshot()));
    const { app, deliver } = await mountCoopBoard();
    deliver(fightSnap);
    assert.ok(app.querySelector('.combat.coop'), 'the board is up');

    const enemy = fightSnap.scene.enemies[0];
    const enemyTurn = structuredClone(fightSnap);
    enemyTurn.scene.turn += 1;
    enemyTurn.scene.receiptSeq = (Number(fightSnap.scene.receiptSeq) || 0) + 1;
    enemyTurn.scene.events = [{ type: 'enemyMoveStarted', sourceId: enemy.id, enemyId: enemy.enemyId, moveId: 'x', kind: 'attack' }];
    deliver(enemyTurn); // the replay starts and holds the render
    const finale = { ...structuredClone(fightSnap.scene), result: 'victory', events: [] };
    deliver({
      ...structuredClone(fightSnap), finale,
      scene: { kind: 'reward', pool: 'normal', chosen: {}, afterReward: null, offers: { p1: { pool: 'normal', cardIds: ['stomp'], cinders: 1 } } },
    });

    let sawFinale = false;
    for (let i = 0; i < 60 && !app.querySelector('.coop-continue'); i++) {
      for (const fn of queued.splice(0)) fn();
      await tick();
      if (app.querySelector('.turn-ribbon')?.textContent === 'Victory') sawFinale = true;
    }
    assert.ok(sawFinale, 'the fight-ending frame played on the board');
    assert.ok(app.querySelector('.coop-continue'), 'then the reward door drew');
  } finally {
    globalThis.setTimeout = realTimeout;
    globalThis.setInterval = realInterval;
  }
});

// ---- a refused choice is told to the sender (tools/lan.mjs → coop.js) ----------

test('the LAN host sends a refused reward or catch-up choice back, and the screen says so', async () => {
  const { applyGameIntent } = await import('../tools/lan.mjs');
  const S = party();
  const purse = { category: 'cinders', cinders: 5, smithingStones: 0 };
  openReward(S, { p1: chestOffer([purse]), p2: chestOffer([purse]) });
  assert.deepEqual(applyGameIntent(S, 'p1', { t: 'chooseReward', pick: {} }), { handled: true, refusal: null });
  const again = applyGameIntent(S, 'p1', { t: 'chooseReward', pick: { chestIndex: 0 } });
  assert.equal(again.handled, true);
  assert.deepEqual(again.refusal, { t: 'intentRefused', intent: 'chooseReward', error: 'already chosen' });
  const cu = applyGameIntent(S, 'p2', { t: 'catchupChoice', index: 0, pick: {} });
  assert.equal(cu.refusal.intent, 'catchupChoice');
  assert.equal(cu.refusal.error, 'nothing to catch up');
  assert.equal(applyGameIntent(S, 'p1', { t: 'noSuchIntent' }).handled, false);

  const realInterval = globalThis.setInterval;
  globalThis.setInterval = (fn, ms, ...a) => { const h = realInterval(fn, ms, ...a); h.unref?.(); return h; };
  try {
    const { deliver, message } = await mountCoopBoard();
    deliver({ ...baseSnap, party: partyRows(), scene: { kind: 'reward', pool: 'elite', chosen: {}, afterReward: null, offers: { p1: chestOffer([purse]) } } });
    message(again.refusal);
    const shown = globalThis.document.querySelector('.coop-turn-banner');
    assert.ok(shown, 'the refusal is announced');
    assert.match(shown.textContent, /already chosen/);
  } finally {
    globalThis.setInterval = realInterval;
  }
});

// ---- damage floats scale inside their tier, as solo's do (SPEC §7.4) ----------

test('co-op damage floats carry solo\'s within-tier --dmg-scale, so 24 reads bigger than 16', async () => {
  const realInterval = globalThis.setInterval;
  globalThis.setInterval = (fn, ms, ...a) => { const h = realInterval(fn, ms, ...a); h.unref?.(); return h; };
  try {
    const { guardHitFloatParts } = await import('../src/ui/fx.js');
    const S = party('DMGSCALE');
    fight(S);
    const fightSnap = JSON.parse(JSON.stringify(S.snapshot()));
    const { app, deliver } = await mountCoopBoard();
    // Record every --dmg-scale the screen writes, per element.
    const doc = globalThis.document;
    const make = doc.createElement.bind(doc);
    doc.createElement = (tag) => {
      const el = make(tag);
      const props = {};
      el.style.setProperty = (k, v) => { props[k] = v; };
      el.style.getPropertyValue = (k) => props[k] ?? '';
      return el;
    };
    // The board sets figure ids through `dataset`, which the fake DOM's
    // selector matcher cannot see: resolve the bare `[data-eid="…"]` anchor
    // lookup the float spawner makes.
    const find = (n, id) => { for (const c of n.children) { if (c.dataset?.eid === id) return c; const f = find(c, id); if (f) return f; } return null; };
    const qs = app.querySelector.bind(app);
    app.querySelector = (sel) => { const m = /^\[data-eid="([^"]+)"\]$/.exec(sel); return m ? find(app, m[1]) : qs(sel); };
    deliver(fightSnap);
    const enemy = fightSnap.scene.enemies[0];
    const hit = structuredClone(fightSnap);
    hit.scene.receiptSeq = (Number(fightSnap.scene.receiptSeq) || 0) + 1;
    hit.scene.events = [
      { type: 'damageDealt', sourceId: 'p1', targetId: enemy.id, amount: 16, blocked: 0 },
      { type: 'damageDealt', sourceId: 'p2', targetId: enemy.id, amount: 24, blocked: 0 },
    ];
    deliver(hit);
    const floats = app.querySelectorAll('.float-num').filter((el) => /^-\d+$/.test(el.textContent));
    const scaleOf = (text) => floats.find((el) => el.textContent === text)?.style.getPropertyValue('--dmg-scale');
    const want = (n) => String(guardHitFloatParts({ amount: n }).damage.scale);
    assert.ok(floats.length >= 2, 'both hits float');
    assert.equal(scaleOf('-16'), want(16));
    assert.equal(scaleOf('-24'), want(24));
    assert.notEqual(scaleOf('-16'), scaleOf('-24'), 'two hits in one tier do not render the same size');
  } finally {
    globalThis.setInterval = realInterval;
  }
});
