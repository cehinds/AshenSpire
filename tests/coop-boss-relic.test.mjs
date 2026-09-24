// tests/coop-boss-relic.test.mjs — SPEC §6.1 in co-op: every seat's boss door
// lays out the same choice of distinct boss relics the solo door does, each
// seat keeps exactly one of its own offer (or none), and the co-op screen
// sends the relic the player tapped.
//
// Host half: tools/session.mjs (the authoritative co-op host) — the per-seat
// offer shape, chooseReward and the catch-up replay. Client half: the real
// src/ui/screens/coop.js on the fake DOM helper, fed a host snapshot over a
// stub connection, asserting the message it sends.

import test from 'node:test';
import assert from 'node:assert/strict';

import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createSession } from '../tools/session.mjs';
import { rewardDom } from './helpers/reward-dom.mjs';

const REG = createRegistries(contentBundle);
const BOSS = REG.relics.all().filter((r) => r.rarity === 'boss').map((r) => r.id);
const COUNT = REG.balance.rewards.bossRelicChoices;

function party(seed = 'BOSSRELIC') {
  const S = createSession({ registries: REG, seedString: seed });
  S.addMember({ id: 'p1', name: 'Wren', classId: 'reaver' });
  S.addMember({ id: 'p2', name: 'Fenn', classId: 'starseer' });
  S.start();
  return S;
}
const seat = (S, id) => S.livingMembers().find((m) => m.id === id);
// A reward scene holding `offers`, the shape grantRewards writes.
// Standing on the map's first node, so closing the scene can advance from it.
function openReward(S, offers) {
  if (!S.session.mapGraph.nodes[S.session.cursorId]) S.session.cursorId = Object.keys(S.session.mapGraph.nodes)[0];
  S.session.scene = { kind: 'reward', pool: 'boss', offers, chosen: {}, afterReward: null };
}

test('each seat\'s boss offer is a choice of distinct boss relics it does not hold', () => {
  const S = party();
  seat(S, 'p2').run.relics.push(BOSS[0]);
  for (const id of ['p1', 'p2']) {
    const offer = S.rollRewardFor(id, 'boss');
    assert.equal(offer.relicId, null, 'a boss offer carries no single relic');
    assert.equal(offer.relicIds.length, COUNT);
    assert.equal(new Set(offer.relicIds).size, COUNT, 'distinct');
    for (const r of offer.relicIds) {
      assert.equal(REG.relics.get(r).rarity, 'boss');
      assert.ok(!seat(S, id).run.relics.includes(r), `${id} is never offered a relic it holds`);
    }
  }
  // Elites keep the single relic path.
  const elite = S.rollRewardFor('p1', 'elite');
  assert.equal(elite.relicIds, undefined);
});

test('the host offer is deterministic by seed', () => {
  assert.deepEqual(party('SAME').rollRewardFor('p1', 'boss').relicIds, party('SAME').rollRewardFor('p1', 'boss').relicIds);
});

test('an exhausted pool pays the consolation instead of a relic row', () => {
  const S = party();
  seat(S, 'p1').run.relics.push(...BOSS);
  const offer = S.rollRewardFor('p1', 'boss');
  assert.deepEqual(offer.relicIds, []);
  assert.ok(offer.cinders >= REG.balance.rewards.bossRelicConsolationCinders);
});

test('each seat keeps exactly the one relic it named, from its own offer', () => {
  const S = party();
  const p1Offer = { pool: 'boss', cardIds: [], cinders: 0, relicId: null, relicIds: BOSS.slice(0, 3) };
  const p2Offer = { pool: 'boss', cardIds: [], cinders: 0, relicId: null, relicIds: BOSS.slice(3, 6) };
  openReward(S, { p1: p1Offer, p2: p2Offer });
  const before1 = seat(S, 'p1').run.relics.length;
  const before2 = seat(S, 'p2').run.relics.length;
  // p1 names a relic that is only on p2's table: refused, nothing lands.
  S.chooseReward('p1', { takeRelic: true, relicId: BOSS[4] });
  assert.equal(seat(S, 'p1').run.relics.length, before1, 'a relic not offered to this seat lands nothing');
  // p2 keeps its second relic, and only it.
  S.chooseReward('p2', { takeRelic: true, relicId: BOSS[4] });
  assert.deepEqual(seat(S, 'p2').run.relics.slice(before2), [BOSS[4]]);
});

test('a seat may skip the boss relic, and a legacy takeRelic keeps one, never two', () => {
  const S = party();
  const offer = () => ({ pool: 'boss', cardIds: [], cinders: 0, relicId: null, relicIds: BOSS.slice(0, 3) });
  openReward(S, { p1: offer(), p2: offer() });
  const b1 = seat(S, 'p1').run.relics.length;
  const b2 = seat(S, 'p2').run.relics.length;
  S.chooseReward('p1', {});
  assert.equal(seat(S, 'p1').run.relics.length, b1, 'skip grants none');
  S.chooseReward('p2', { takeRelic: true });
  assert.deepEqual(seat(S, 'p2').run.relics.slice(b2), [BOSS[0]], 'a bare takeRelic keeps the first offered');
});

test('a seat that sends its pick twice keeps one relic and one card, never two', () => {
  // The co-op screen stays up after a seat's first tap while the others
  // choose, and re-sends its whole pick on the next tap: a second message
  // naming ANOTHER boss relic (or the same card) must land nothing new.
  const S = party();
  const offer = () => ({ pool: 'boss', cardIds: ['stomp'], cinders: 0, relicId: null, relicIds: BOSS.slice(0, 3) });
  openReward(S, { p1: offer(), p2: offer() });
  const m = seat(S, 'p1');
  const relics = m.run.relics.length;
  const deck = m.run.deck.length;
  S.chooseReward('p1', { cardId: 'stomp', takeRelic: true, relicId: BOSS[0] });
  S.chooseReward('p1', { cardId: 'stomp', takeRelic: true, relicId: BOSS[1] });
  assert.deepEqual(m.run.relics.slice(relics), [BOSS[0]], 'one boss relic from one choice');
  assert.equal(m.run.deck.length, deck + 1, 'the card lands once');
});

test('a seat that has chosen is done at the door: a later relic pick is refused', () => {
  // The screen sends the whole door once on Continue; a seat that took only
  // its card has chosen, and a second message landing a relic on top would be
  // a second pick at one door (review of #1287).
  const S = party();
  const offer = () => ({ pool: 'boss', cardIds: ['stomp'], cinders: 0, relicId: null, relicIds: BOSS.slice(0, 3) });
  openReward(S, { p1: offer(), p2: offer() });
  const m = seat(S, 'p1');
  const relics = m.run.relics.length;
  const deck = m.run.deck.length;
  assert.equal(S.chooseReward('p1', { cardId: 'stomp' }).ok, true);
  const again = S.chooseReward('p1', { cardId: 'stomp', takeRelic: true, relicId: BOSS[2] });
  assert.equal(again.ok, false);
  assert.deepEqual(m.run.relics.slice(relics), [], 'no relic lands after the seat has chosen');
  assert.equal(m.run.deck.length, deck + 1);
});

test('a missed boss door replays as the same choice on catch-up', () => {
  const S = party();
  const m = seat(S, 'p1');
  const before = m.run.relics.length;
  m.catchup.push({ type: 'reward', offer: { pool: 'boss', cardIds: [], cinders: 0, relicId: null, relicIds: BOSS.slice(0, 3) }, act: 1, floor: 1 });
  const res = S.resolveCatchup('p1', 0, { takeRelic: true, relicId: BOSS[2] });
  assert.equal(res.ok, true);
  assert.deepEqual(m.run.relics.slice(before), [BOSS[2]]);
});

// ---- the co-op screen -------------------------------------------------------

function mountCoopScreen(snapshot) {
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
    mountCoop(app, { registries: REG, conn, myId: 'p1', meta: {}, onSettingsChange() {}, onLeave() {} });
    conn._h.onMessage({ t: 'state', snapshot });
    return { app, sent };
  });
}

const partyRows = (catchupQueue = []) => [
  { id: 'p1', name: 'Wren', classId: 'reaver', connected: true, alive: true, hp: 60, maxHp: 60, cinders: 0, deckSize: 10, relics: 0, flasks: 0, catchup: catchupQueue.length, catchupQueue },
];
const baseSnap = { actNumber: 1, floor: 4, seedString: 'X', endless: false, seatOrder: ['weald', 'marches', 'reach'], seatId: 'weald', seatName: 'The Hollow Weald' };

test('the co-op reward screen lays out one option per boss relic and sends the one tapped', async () => {
  // coop.js starts pad/fullscreen polls on mount; unref'd so the file can exit.
  const realInterval = globalThis.setInterval;
  globalThis.setInterval = (fn, ms, ...a) => { const h = realInterval(fn, ms, ...a); h.unref?.(); return h; };
  try {
    const { app, sent } = await mountCoopScreen({
      ...baseSnap, party: partyRows(),
      scene: { kind: 'reward', pool: 'boss', chosen: {}, afterReward: null, offers: { p1: { pool: 'boss', cardIds: ['stomp'], cinders: 1, relicId: null, relicIds: BOSS.slice(0, 3) } } },
    });
    const options = app.querySelectorAll('.coop-boss-relic');
    assert.deepEqual(options.map((o) => o.dataset.relicId), BOSS.slice(0, 3));
    options[1].click();
    assert.equal(sent.length, 0, 'a tap stages the relic; Continue sends the door (coop-parity)');
    app.querySelector('.coop-continue').click();
    assert.equal(sent.length, 1, 'one completion, one message');
    assert.equal(sent[0].t, 'chooseReward');
    assert.equal(sent[0].pick.relicId, BOSS[1]);
    assert.equal(sent[0].pick.takeRelic, true);

    // The catch-up door replays the same choice.
    const cu = await mountCoopScreen({
      ...baseSnap, scene: { kind: 'map' }, reachableIds: [], map: null,
      party: partyRows([{ type: 'reward', act: 1, floor: 2, offer: { pool: 'boss', cardIds: ['stomp'], relicId: null, relicIds: BOSS.slice(0, 3) } }]),
    });
    const cuOptions = cu.app.querySelectorAll('.coop-boss-relic');
    assert.equal(cuOptions.length, 3);
    cuOptions[2].click();
    cu.app.querySelector('.coop-continue').click();
    assert.deepEqual(cu.sent.at(-1), { ...cu.sent.at(-1), t: 'catchupChoice', index: 0, pick: { ...cu.sent.at(-1).pick, takeRelic: true, relicId: BOSS[2] } });

    // An elite offer still shows the single 'Take the relic'.
    const elite = await mountCoopScreen({
      ...baseSnap, party: partyRows(),
      scene: { kind: 'reward', pool: 'elite', chosen: {}, afterReward: null, offers: { p1: { pool: 'elite', cardIds: ['stomp'], cinders: 1, relicId: 'forsakenMedallion' } } },
    });
    assert.equal(elite.app.querySelectorAll('.coop-boss-relic').length, 0);
    const single = elite.app.querySelectorAll('.coop-relic-take');
    assert.equal(single.length, 1);
    single[0].click();
    elite.app.querySelector('.coop-continue').click();
    assert.equal(elite.sent.at(-1).pick.relicId, 'forsakenMedallion');
  } finally {
    globalThis.setInterval = realInterval;
  }
});
