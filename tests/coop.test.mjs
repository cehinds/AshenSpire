// tests/coop.test.mjs — the co-op scenario, end to end, in one test.
//
// One seeded party on the REAL host (tools/session.mjs) with every in-run
// intent routed through the LAN door (tools/lan.mjs applyGameIntent): the
// shared map, shared combat to each reward door (normal, elite chest, boss
// relic choice), a seat dropping mid-fight and rejoining (enemy rescale), a
// third seat joining and leaving and owing catch-up (reward, treasure,
// event), its reconnect replay, a disk save → restore (and a malformed seat
// refused into refusedMembers), per-seat Weapon Art meters, and co-op/solo
// outcome parity for one play. The co-op screen (src/ui/screens/coop.js) is
// then mounted on the fake DOM and fed the host's own combat and reward
// snapshots. Invariants are checked at every step.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createRunState } from '../src/model/state.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createCoopCombat, playCard as coopPlayCard, endTurn as coopEndTurn, coopHpMult } from '../src/engine/coopCombat.js';
import { seatOrderProblems } from '../src/model/seats.js';
import { eventChoicesWithHistory } from '../src/content/events.js';
import { createSession, restoreSession } from '../tools/session.mjs';
import { applyGameIntent } from '../tools/lan.mjs';
import { rewardDom } from './helpers/reward-dom.mjs';

const REG = createRegistries(contentBundle);
const BOSS_CHOICES = REG.balance.rewards.bossRelicChoices;

// ---- harness ----------------------------------------------------------------

// Every intent crosses the LAN door. `refused` says whether the host must
// refuse it; a refusal must come back as an error message owed to the sender.
function intent(S, id, msg, { refused = false } = {}) {
  const out = applyGameIntent(S, id, msg);
  assert.equal(out.handled, true, `${msg.t} is a game intent`);
  if (refused) {
    assert.ok(out.refusal, `${msg.t} from ${id} is refused`);
    assert.equal(out.refusal.t, 'intentRefused');
    assert.equal(out.refusal.intent, msg.t);
    assert.ok(out.refusal.error.length > 0, 'the refusal names its reason');
  } else {
    assert.equal(out.refusal, null, `${msg.t} from ${id} lands (${out.refusal && out.refusal.error})`);
  }
  return out;
}

// The invariants every step keeps: the party's seat order is a valid order and
// every member rides it; every seat's run is sane; the snapshot is wire-safe.
function invariants(S, label) {
  assert.deepEqual(seatOrderProblems(S.session.seatOrder, REG), [], `${label}: seat order is valid`);
  for (const m of S.session.members.values()) {
    assert.deepEqual(m.run.seatOrder, S.session.seatOrder, `${label}: ${m.id} rides the party's order`);
    assert.ok(Number.isInteger(m.run.hp) && m.run.hp >= 0 && m.run.hp <= m.run.maxHp, `${label}: ${m.id} hp ${m.run.hp}/${m.run.maxHp}`);
    assert.equal(new Set(m.run.relics).size, m.run.relics.length, `${label}: ${m.id} holds no relic twice`);
    assert.equal(new Set(m.run.deck.map((c) => c.instanceId)).size, m.run.deck.length, `${label}: ${m.id} deck ids unique`);
    assert.ok(m.run.cinders >= 0, `${label}: ${m.id} cinders non-negative`);
    if (!m.alive) assert.equal(m.catchup.length, 0, `${label}: a fallen seat owes nothing`);
  }
  const snap = JSON.parse(JSON.stringify(S.snapshot()));
  assert.equal(snap.party.length, S.session.members.size, `${label}: snapshot carries the party`);
  assert.ok(snap.seatName, `${label}: snapshot names the seat`);
  return snap;
}

// Weaken the live fight so the bots win it in a few rounds; keep seats alive.
function soften(S) {
  for (const e of S.live.combat.enemies) { e.hp = Math.min(e.hp, 6); e.maxHp = Math.max(e.maxHp, e.hp); }
}
function heal(S) {
  for (const m of S.livingMembers()) m.run.hp = m.run.maxHp;
}

// Drive the live fight to its result through the LAN door: each present seat
// plays greedily via `playCard` intents, then `endTurn`.
function fightThrough(S) {
  let guard = 0;
  while (S.live && guard++ < 60) {
    soften(S);
    for (const m of S.connectedMembers()) {
      if (!S.live) break;
      const P = S.live.combat.players.get(m.id);
      if (!P || !P.connected || P.ended || !P.entity.alive) continue;
      const card = P.piles.hand.find((h) => {
        const def = resolveCard(REG, { cardId: h.cardId, upgraded: h.upgraded });
        return !(def.keywords || []).includes('unplayable') && (def.cost === 'X' ? 0 : def.cost) <= P.entity.energy
          && (def.manaCost || 0) <= P.entity.mana && (def.staminaCost || 0) <= (P.entity.stamina || 0)
          && (def.effects || []).some((e) => e.target === 'enemy');
      });
      if (card) {
        const out = applyGameIntent(S, m.id, { t: 'playCard', cardInstanceId: card.instanceId, targetId: S.live.combat.enemies.find((e) => e.alive).id });
        assert.equal(out.handled, true);
      }
      if (S.live && !S.live.combat.players.get(m.id).ended) intent(S, m.id, { t: 'endTurn' });
    }
  }
  assert.equal(S.live, null, 'the shared fight concluded');
}

// Walk the map (every present seat votes the first reachable node) until the
// scene is a fight; non-combat scenes are resolved through the LAN door.
function walkToCombat(S) {
  let guard = 0;
  while (S.scene.kind !== 'combat' && guard++ < 40) {
    heal(S);
    const sc = S.scene;
    if (sc.kind === 'map') {
      const node = S.session.reachableIds[0];
      for (const m of S.connectedMembers()) { intent(S, m.id, { t: 'chooseNode', nodeId: node }); if (S.scene.kind !== 'map') break; }
    } else if (sc.kind === 'reward') {
      for (const id of Object.keys(sc.offers)) intent(S, id, { t: 'chooseReward', pick: { cardId: sc.offers[id].cardIds[0] } });
    } else if (sc.kind === 'shrine') {
      for (const m of S.connectedMembers()) if (S.scene.kind === 'shrine') intent(S, m.id, { t: 'shrineChoice', choice: 'rest' });
    } else if (sc.kind === 'event') {
      for (const m of S.connectedMembers()) {
        if (S.scene.kind !== 'event') break;
        if (S.scene.next) intent(S, m.id, { t: 'eventContinue' });
        else {
          const open = (S.scene.open && S.scene.open[m.id]) || [0];
          intent(S, m.id, { t: 'eventChoice', choiceIndex: open[0] ?? 0 });
        }
      }
    } else assert.fail(`unexpected scene ${sc.kind}`);
    invariants(S, `walk ${guard}`);
  }
  assert.equal(S.scene.kind, 'combat', 'the walk reaches a shared fight');
}

// Close a reward door: each present seat takes its first card (and relic /
// flask when offered), and a second send is refused with nothing granted twice.
function takeRewards(S, extraPick = () => ({})) {
  const sc = S.scene;
  assert.equal(sc.kind, 'reward');
  const ids = Object.keys(sc.offers);
  const before = Object.fromEntries(ids.map((id) => { const m = S.session.members.get(id); return [id, { deck: m.run.deck.length, relics: m.run.relics.length }]; }));
  for (const [i, id] of ids.entries()) {
    const offer = sc.offers[id];
    const pick = { cardId: offer.cardIds[0], ...extraPick(id, offer) };
    intent(S, id, { t: 'chooseReward', pick });
    const m = S.session.members.get(id);
    assert.equal(m.run.deck.length, before[id].deck + 1, `${id}: one card lands`);
    if (i < ids.length - 1) {
      // the door is still open for the others: a re-send is refused whole
      intent(S, id, { t: 'chooseReward', pick }, { refused: true });
      assert.equal(m.run.deck.length, before[id].deck + 1, `${id}: no double grant`);
    }
  }
  return before;
}

function forceFight(S, type) {
  const out = S.resolveNode({ type });
  assert.equal(out.ok, true);
  assert.equal(S.scene.kind, 'combat');
  assert.equal(S.scene.pool, type === 'monster' ? 'normal' : type);
}

// ---- the co-op screen on the fake DOM ------------------------------------------

async function mountScreen() {
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
    contains(n) { return n === this || this.children.some((c) => c.contains(n)); },
  });
  const { mountCoop } = await import('../src/ui/screens/coop.js');
  const sent = [];
  const conn = { _h: null, setHandlers(h) { this._h = h; }, send(m) { sent.push(m); }, close() {}, get open() { return true; } };
  const app = dom.document.createElement('main');
  dom.document.body.append(app);
  mountCoop(app, { registries: REG, conn, myId: 'p1', meta: {}, onSettingsChange() {}, onLeave() {} });
  return { app, sent, deliver: (snapshot) => conn._h.onMessage({ t: 'state', snapshot: JSON.parse(JSON.stringify(snapshot)) }), message: (m) => conn._h.onMessage(m) };
}

// ---- the scenario ---------------------------------------------------------------

test('co-op: a seeded party plays the shared run through the host and the LAN door', async () => {
  const S = createSession({ registries: REG, seedString: 'COOPSCENARIO' });
  S.addMember({ id: 'p1', name: 'Wren', classId: 'reaver' });
  S.addMember({ id: 'p2', name: 'Fenn', classId: 'starseer' });
  // Before start the lobby has a shape but no map; a map intent is refused.
  assert.equal(S.scene.kind, 'lobby');
  assert.equal(applyGameIntent(S, 'p1', { t: 'noSuchIntent' }).handled, false, 'a non-game message is not routed');
  S.start();
  let snap = invariants(S, 'start');
  assert.equal(snap.scene.kind, 'map');
  assert.equal(snap.party.length, 2);
  assert.ok(snap.map && snap.map.nodes.length > 0, 'the whole map rides the snapshot');

  // Determinism: the same seed builds the same map and the same seat order.
  const twin = createSession({ registries: REG, seedString: 'COOPSCENARIO' });
  twin.addMember({ id: 'p1', name: 'Wren', classId: 'reaver' });
  twin.start();
  assert.deepEqual(twin.session.seatOrder, S.session.seatOrder);
  assert.deepEqual(twin.session.reachableIds, S.session.reachableIds);

  // ---- fork vote: a lone vote holds the party; an unreachable node is refused
  const opts = S.session.reachableIds.slice();
  assert.equal(S.chooseNode('p1', 'no-such-node').ok, false);
  assert.equal(S.chooseNode('p1', opts[0]).waiting, 1, 'one vote holds the party');
  assert.equal(S.scene.kind, 'map');
  assert.equal(S.scene.votes.p1, opts[0]);

  // ---- walk to the first shared fight ---------------------------------------
  walkToCombat(S);
  snap = invariants(S, 'first fight');
  assert.equal(snap.scene.headcount, 2);
  assert.equal(snap.scene.players.length, 2);

  // Per-seat Art meters: each seat carries its own meter rows, and a hit by one
  // seat's weapon charges only that seat.
  const C = S.live.combat;
  for (const P of C.players.values()) assert.ok(Array.isArray(snap.scene.players.find((p) => p.id === P.id).artCharge));
  const p1Charge = () => JSON.stringify(C.players.get('p1').artCharge);
  const p2ChargeBefore = JSON.stringify(C.players.get('p2').artCharge);
  {
    const P = C.players.get('p1');
    const strike = Object.values(P.piles).flat().find((c) => c.kitRole === 'attack' && c.grantedBy);
    assert.ok(strike, 'p1 holds a weapon kit strike');
    for (const pile of Object.values(P.piles)) { const i = pile.indexOf(strike); if (i >= 0) pile.splice(i, 1); }
    P.piles.hand.push(strike);
    for (const e of C.enemies) { e.hp = e.maxHp = 999; if (e.poiseMeter) e.poiseMeter.max = 999; }
    Object.assign(P.entity, { energy: 20, stamina: P.entity.maxStamina, mana: P.entity.maxMana });
    const before = p1Charge();
    intent(S, 'p1', { t: 'playCard', cardInstanceId: strike.instanceId, targetId: C.enemies[0].id });
    assert.notEqual(p1Charge(), before, 'p1\'s own meter moved');
    assert.equal(JSON.stringify(C.players.get('p2').artCharge), p2ChargeBefore, 'p2\'s meter never moved');
    const rows = S.snapshot().scene;
    const changed = rows.events.filter((e) => e.type === 'artChargeChanged');
    assert.ok(changed.length > 0 && changed.every((e) => e.playerId === 'p1'), 'the charge receipt names its seat');
    const row = rows.players.find((p) => p.id === 'p1').artCharge.find((r) => r.weaponId === strike.grantedBy);
    assert.ok(row && row.value > 0, 'the snapshot HUD row shows the charge');
    // A card the seat does not hold is refused by the engine (settles nothing).
    assert.equal(S.combatPlay('p1', 'not-a-card', C.enemies[0].id).ok, false);
    assert.equal(S.combatPlay('ghost', 'x').ok, false);
  }

  // ---- a seat drops mid-fight and rejoins: the enemies rescale ------------------
  const full = C.enemies.map((e) => e.maxHp);
  S.setConnected('p2', false);
  assert.equal(S.snapshot().scene.headcount, 1);
  assert.equal(C.players.get('p2').connected, false);
  C.enemies.forEach((e, i) => assert.ok(Math.abs(e.maxHp - Math.round(full[i] * coopHpMult(1) / coopHpMult(2))) <= 1, 'down-rescale matches the headcount ratio'));
  S.setConnected('p2', true);
  assert.equal(C.players.get('p2').connected, true);
  C.enemies.forEach((e, i) => assert.ok(Math.abs(e.maxHp - full[i]) <= 2, 'rejoin rescales back up'));
  invariants(S, 'rejoin');
  assert.equal(S.serialize(), null, 'a live fight is never written to disk');

  // Mount the co-op screen with the host's own live combat snapshot.
  const realInterval = globalThis.setInterval;
  const realTimeout = globalThis.setTimeout;
  const intervals = [];
  const timeouts = [];
  const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => realTimeout(r, 2)); };
  globalThis.setInterval = (fn, ms, ...a) => { const h = realInterval(fn, ms, ...a); h.unref?.(); intervals.push(h); return h; };
  globalThis.setTimeout = (fn, _ms, ...a) => { const h = realTimeout(fn, 0, ...a); h.unref?.(); timeouts.push(h); return h; }; // screen beats collapse to 0ms
  let screen;
  try {
    screen = await mountScreen();
    screen.deliver(S.snapshot());
    await settle();
    assert.ok(screen.app.querySelector('.coop-seat'), 'the combat board draws a seat');
    screen.message({ t: 'intentRefused', intent: 'chooseReward', error: 'already chosen' });
    assert.match(globalThis.document.querySelector('.coop-turn-banner').textContent, /already chosen/, 'a refusal surfaces on screen');
  } finally {
    globalThis.setTimeout = realTimeout;
  }

  // ---- normal reward door ----------------------------------------------------------
  fightThrough(S);
  assert.equal(S.scene.kind, 'reward');
  assert.equal(S.scene.pool, 'normal');
  snap = invariants(S, 'normal reward');
  const normalOffers = structuredClone(S.scene.offers);
  for (const id of ['p1', 'p2']) {
    assert.ok(normalOffers[id].cardIds.length > 0);
    assert.equal(normalOffers[id].relicId, null, 'a normal door carries no relic');
  }
  // A card not on the table lands nothing (the seat has then chosen, though),
  // so pick an off-table card for nobody; take the real pick through the door.
  const cindersBefore = S.session.members.get('p1').run.cinders;
  // Reward screen renders the host's own reward scene.
  try {
    globalThis.setTimeout = (fn, _ms, ...a) => { const h = realTimeout(fn, 0, ...a); h.unref?.(); timeouts.push(h); return h; }; // screen beats collapse to 0ms
    screen.deliver(S.snapshot());
    await settle(); // the finale frame plays, then the door draws
    const cont = screen.app.querySelector('.coop-continue');
    assert.ok(cont, 'the reward door draws Continue');
    cont.click();
    assert.equal(screen.sent.at(-1).t, 'chooseReward', 'Continue sends the door');
    // What the screen sent is what the LAN door routes.
    const pick = screen.sent.at(-1).pick;
    intent(S, 'p1', { t: 'chooseReward', pick });
    intent(S, 'p1', { t: 'chooseReward', pick }, { refused: true });
    assert.equal(S.session.members.get('p1').run.cinders, cindersBefore, 'cinders were paid at the fight, not at the pick');
  } finally {
    globalThis.setTimeout = realTimeout;
  }
  intent(S, 'p2', { t: 'chooseReward', pick: { cardId: normalOffers.p2.cardIds[0] } });
  assert.equal(S.scene.kind, 'map', 'every present seat chose: the door closes');
  intent(S, 'p1', { t: 'chooseReward', pick: {} }, { refused: true }); // no door open
  invariants(S, 'after normal');

  // ---- elite door: the chest --------------------------------------------------------
  heal(S);
  forceFight(S, 'elite');
  fightThrough(S);
  assert.equal(S.scene.pool, 'elite');
  {
    const offers = S.scene.offers;
    for (const id of ['p1', 'p2']) {
      assert.ok(offers[id].chest && offers[id].chest.options.length > 0, `${id} rolled a chest`);
      assert.ok(offers[id].chest.options.every((o) => o.category !== 'armament'), 'no armament in a co-op chest');
    }
    const m1 = S.session.members.get('p1');
    const relicsBefore = m1.run.relics.length;
    // A bad chest index is refused, nothing moves, the door stays open.
    intent(S, 'p1', { t: 'chooseReward', pick: { chestIndex: 99 } }, { refused: true });
    assert.equal(S.scene.kind, 'reward');
    const takeable = offers.p1.chest.options.findIndex((o) => o.category !== 'upgrade');
    takeRewards(S, (id) => (id === 'p1' ? { chestIndex: Math.max(0, takeable), takeRelic: true, flask: true } : { takeRelic: true }));
    assert.ok(m1.run.relics.length >= relicsBefore, 'the chest pick lands at most once');
  }
  invariants(S, 'after elite');

  // ---- a shrine: each seat rests, mends or leaves; the stop closes when all have
  S.session.members.get('p2').run.hp = 1;
  assert.equal(S.resolveNode({ type: 'shrine' }).ok, true);
  assert.equal(S.scene.kind, 'shrine');
  assert.ok(S.scene.smithing.p1 && S.scene.rest.p1, 'each seat sees its own smith plan and rest view');
  assert.equal(S.shrineChoice('p1', 'dance').ok, false, 'an unknown shrine choice is refused');
  assert.equal(S.shrineChoice('p1', 'mend', 'ghost').ok, false, 'mending nobody is refused');
  intent(S, 'p1', { t: 'shrineChoice', choice: 'mend', targetId: 'p2' });
  assert.ok(S.session.members.get('p2').run.hp > 1, 'the mend heals the ally');
  assert.equal(S.scene.kind, 'shrine', 'the stop waits on p2');
  intent(S, 'p2', { t: 'shrineChoice', choice: 'leave' });
  assert.equal(S.scene.kind, 'map');
  assert.equal(S.shrineChoice('p1', 'rest').ok, false, 'no shrine open');
  assert.equal(S.flaskIntent('p1', { action: 'use', slot: 0 }).ok, false, 'no fight, no flask');
  assert.equal(S.flaskIntent('p1', { action: 'inspect' }).ok, false, 'only a use crosses the host');
  invariants(S, 'after shrine');

  // ---- a third seat joins, then leaves mid-fight and owes catch-up -----------------
  const p3 = S.addMember({ id: 'p3', name: 'Ash', classId: 'reaver' });
  assert.deepEqual(p3.run.seatOrder, S.session.seatOrder, 'a mid-run joiner rides the party order');
  invariants(S, 'p3 joined');
  heal(S);
  forceFight(S, 'monster');
  assert.equal(S.snapshot().scene.headcount, 3);
  const threeHp = S.live.combat.enemies.map((e) => e.maxHp);
  S.setConnected('p3', false);
  S.live.combat.enemies.forEach((e, i) => assert.ok(e.maxHp < threeHp[i] || threeHp[i] <= 2, 'a leaver shrinks the fight'));
  fightThrough(S);
  assert.equal(S.scene.kind, 'reward');
  assert.equal(S.scene.offers.p3, undefined, 'an absent seat has no live offer');
  assert.equal(p3.catchup.length, 1);
  assert.equal(p3.catchup[0].type, 'reward', 'its missed reward is queued');
  takeRewards(S);
  // Treasure while away: queued; present seats are paid now.
  const p1Relics = S.session.members.get('p1').run.relics.length;
  S.resolveNode({ type: 'treasure' });
  assert.equal(p3.catchup.at(-1).type, 'treasure');
  assert.ok(S.session.members.get('p1').run.relics.length >= p1Relics);
  // An event while away: queued with the choices its history admitted.
  const eventDef = REG.events.all().find((e) => eventChoicesWithHistory(e).length > 1
    && eventChoicesWithHistory(e).every((c) => !(c.effects || []).some((x) => x.op === 'startCombat')));
  assert.ok(eventDef, 'content holds a fightless event with choices');
  S.resolveNode({ type: 'event', resolved: { kind: 'event', eventId: eventDef.id } });
  assert.equal(S.scene.kind, 'event');
  for (const id of ['p1', 'p2']) {
    const open = S.scene.open[id] || [0];
    heal(S);
    intent(S, id, { t: 'eventChoice', choiceIndex: open[0] });
  }
  // an absent seat cannot choose in the room
  assert.equal(S.eventChoice('p3', 0).ok, false);
  assert.ok(S.scene.next, 'the result shows before the party moves');
  for (const id of ['p1', 'p2']) intent(S, id, { t: 'eventContinue' });
  assert.equal(S.scene.kind, 'map');
  assert.deepEqual(p3.catchup.map((c) => c.type), ['reward', 'treasure', 'event']);
  assert.equal(S.partyHistory().length >= 1, true, 'the party\'s choice is on the record');
  invariants(S, 'p3 owes three');

  // ---- disk save → restore (and a malformed seat refused) -----------------------------
  const dir = mkdtempSync(join(tmpdir(), 'coop-test-'));
  try {
    const saved = S.serialize();
    assert.ok(saved, 'on the map the run serialises');
    const file = join(dir, '.coop-session.json');
    // Poison a fourth, extra record: a catch-up naming a relic the build lacks.
    const poisoned = structuredClone(saved.members.find((m) => m.id === 'p2'));
    poisoned.id = 'p4'; poisoned.name = 'Bad'; poisoned.index = 9;
    poisoned.catchup = [{ type: 'treasure', relicId: 'noSuchRelic', act: 1, floor: 1 }];
    writeFileSync(file, JSON.stringify({ ...saved, members: [...saved.members, poisoned] }));
    const R = restoreSession(REG, JSON.parse(readFileSync(file, 'utf8')));
    assert.deepEqual(R.refusedMembers().map((r) => r.id), ['p4'], `the malformed seat is refused, by name: ${JSON.stringify(R.refusedMembers())}`);
    assert.match(R.refusedMembers()[0].reason, /noSuchRelic/);
    assert.deepEqual(R.snapshot().refusedMembers.map((r) => r.id), ['p4'], 'the receipt rides the snapshot');
    assert.equal(R.serialize().refusedMembers[0].id, 'p4', 'the evidence bytes ride the next save');
    assert.deepEqual([...R.session.members.keys()].sort(), ['p1', 'p2', 'p3']);
    assert.ok([...R.session.members.values()].every((m) => !m.connected), 'restored seats wait to re-attach');
    for (const id of ['p1', 'p2', 'p3']) {
      const a = S.session.members.get(id).run; const b = R.session.members.get(id).run;
      assert.equal(b.hp, a.hp); assert.equal(b.deck.length, a.deck.length); assert.deepEqual(b.relics, a.relics);
    }
    assert.equal(R.session.members.get('p3').catchup.length, 3, 'the owed queue survives the disk');
    // A save that saves nobody is refused whole.
    assert.throws(() => restoreSession(REG, { ...saved, members: [poisoned], refusedMembers: [] }), /no member survived/);
    // A malformed seat order is refused whole.
    assert.throws(() => restoreSession(REG, { ...saved, seatOrder: ['nope'] }), /Malformed session save/);
    // Continue on the restored host: all seats come back at once.
    R.setConnectedMany(['p1', 'p2'], true);
    invariants(R, 'restored');
    assert.equal(R.scene.kind, 'map');
    runRestored(R);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  function runRestored(R) {
    // ---- reconnect replay: p3 comes back during a fight, its queue holds it out ----
    heal(R);
    forceFight(R, 'monster');
    const two = R.live.combat.enemies.map((e) => e.maxHp);
    R.setConnected('p3', true);
    assert.equal(R.live.combat.players.has('p3'), false, 'a seat with a queue does not join the fight yet');
    const row = R.snapshot().party.find((p) => p.id === 'p3');
    assert.equal(row.catchup, 3);
    assert.deepEqual(row.catchupQueue.map((c) => c.type), ['reward', 'treasure', 'event']);
    const m3 = R.session.members.get('p3');
    const deck3 = m3.run.deck.length;
    // Bad index refused, nothing moves.
    intent(R, 'p3', { t: 'catchupChoice', index: 7, pick: {} }, { refused: true });
    const owedReward = m3.catchup[0].offer;
    intent(R, 'p3', { t: 'catchupChoice', index: 0, pick: { cardId: owedReward.cardIds[0] } });
    assert.equal(m3.run.deck.length, deck3 + 1, 'the missed card lands once');
    intent(R, 'p3', { t: 'catchupChoice', index: 0, pick: { takeRelic: true } });
    const ev = m3.catchup[0];
    assert.equal(ev.type, 'event');
    const evOpen = Array.isArray(ev.open) ? ev.open : [0];
    const res = applyGameIntent(R, 'p3', { t: 'catchupChoice', index: 0, pick: { choiceIndex: evOpen[0] } });
    assert.equal(res.refusal, null, res.refusal && res.refusal.error);
    assert.ok(m3.catchup[0].done, 'the missed event\'s result is held until read');
    intent(R, 'p3', { t: 'catchupChoice', index: 0, pick: { choiceIndex: evOpen[0] } }, { refused: true }); // read the result first
    intent(R, 'p3', { t: 'catchupChoice', index: 0, pick: { continue: true } });
    assert.equal(m3.catchup.length, 0, 'the queue drained');
    assert.equal(R.live.combat.players.has('p3'), true, 'a drained seat joins the live fight');
    R.live.combat.enemies.forEach((e, i) => assert.ok(e.maxHp >= two[i], 'the joiner scales the fight up'));
    intent(R, 'p3', { t: 'catchupChoice', index: 0, pick: {} }, { refused: true }); // nothing left
    invariants(R, 'replayed');
    fightThrough(R);
    takeRewards(R);
    // p3 leaves for good.
    R.setConnected('p3', false);
    assert.equal(R.connectedMembers().length, 2);

    // ---- boss door: a choice of distinct boss relics per seat -----------------------
    heal(R);
    const bossId = (R.session.mapGraph.bossIds || [R.session.mapGraph.bossId])[0];
    R.session.cursorId = bossId;
    forceFight(R, 'boss');
    fightThrough(R);
    assert.equal(R.scene.pool, 'boss');
    assert.equal(R.scene.afterReward, 'advanceAct');
    const offers = R.scene.offers;
    const kept = {};
    for (const id of ['p1', 'p2']) {
      const o = offers[id];
      assert.equal(o.relicId, null);
      assert.ok(o.relicIds.length <= BOSS_CHOICES);
      assert.equal(new Set(o.relicIds).size, o.relicIds.length, 'distinct boss relics');
      for (const r of o.relicIds) assert.equal(REG.relics.get(r).rarity, 'boss');
      kept[id] = o.relicIds.at(-1);
    }
    const r1 = R.session.members.get('p1').run.relics.length;
    // p1 names a relic that is not on its table: nothing lands (and p1 has chosen).
    const foreign = REG.relics.all().find((r) => r.rarity === 'boss' && !offers.p1.relicIds.includes(r.id));
    assert.ok(foreign, 'a boss relic exists off p1\'s table');
    intent(R, 'p1', { t: 'chooseReward', pick: { takeRelic: true, relicId: foreign.id } });
    assert.equal(R.session.members.get('p1').run.relics.length, r1, 'a relic not offered lands nothing');
    intent(R, 'p1', { t: 'chooseReward', pick: { takeRelic: true, relicId: kept.p1 } }, { refused: true });
    const r2 = R.session.members.get('p2').run.relics.slice();
    intent(R, 'p2', { t: 'chooseReward', pick: { takeRelic: true, relicId: kept.p2 } });
    assert.ok(kept.p2, 'p2 was offered a boss relic');
    assert.deepEqual(R.session.members.get('p2').run.relics.slice(r2.length), [kept.p2], 'p2 keeps exactly the relic it named');
    assert.equal(R.session.actNumber, 2, 'the boss door advances the act');
    assert.equal(R.scene.kind, 'map');
    const p3 = R.session.members.get('p3');
    assert.equal(p3.catchup.length, 1, 'the absent seat owes its boss door');
    assert.equal(p3.catchup[0].offer.pool, 'boss');
    invariants(R, 'act 2');

    // Mount the reward scene for a boss choice using a host-shaped reward snapshot.
    globalThis.setTimeout = (fn, _ms, ...a) => { const h = realTimeout(fn, 0, ...a); h.unref?.(); timeouts.push(h); return h; }; // screen beats collapse to 0ms
    try {
      const snapR = R.snapshot();
      screen.deliver({ ...snapR, scene: { kind: 'reward', pool: 'boss', chosen: {}, afterReward: 'advanceAct', offers: { p1: { ...p3.catchup[0].offer } } } });
      const options = screen.app.querySelectorAll('.coop-boss-relic');
      assert.ok(options.length > 1);
      assert.equal(options.length, p3.catchup[0].offer.relicIds.length, 'one option per boss relic');
      options[1].click();
      screen.app.querySelector('.coop-continue').click();
      assert.equal(screen.sent.at(-1).t, 'chooseReward');
      assert.equal(screen.sent.at(-1).pick.relicId, p3.catchup[0].offer.relicIds[1], 'the screen sends the relic tapped');
    } finally {
      globalThis.setTimeout = realTimeout;
      for (const h of intervals) clearInterval(h);
      for (const h of timeouts) clearTimeout(h);
      globalThis.setInterval = realInterval;
    }
  }

  // ---- co-op / solo outcome parity for one play -------------------------------------------
  {
    const seed = 4242;
    const run = createRunState({ seed, classId: 'reaver', registries: REG });
    const solo = createCombat({ registries: REG, rng: createRng(seed), enemyIds: ['wanderingSoldier'],
      player: { ...structuredClone(run), classId: run.class, relicIds: run.relics, loadout: run.loadout } });
    const coop = createCoopCombat({ registries: REG, rng: createRng(seed), enemyIds: ['wanderingSoldier'], players: [{
      id: 'p1', name: 'Wren', classId: run.class, maxHp: run.maxHp, hp: run.hp, energyMax: run.energyMax, drawPerTurn: run.drawPerTurn,
      maxMana: run.maxMana, mana: run.mana, maxStamina: run.maxStamina, stamina: run.stamina,
      deck: structuredClone(run.deck), loadout: structuredClone(run.loadout), relicIds: [...run.relics], flasks: [],
      attributes: { ...run.attributes }, attributeMode: run.attributeMode, derivedStatRuleSnapshot: structuredClone(run.derivedStatRuleSnapshot),
    }] });
    assert.equal(coop.enemies[0].maxHp, solo.enemies[0].maxHp, 'one seat rolls the solo enemy HP (×1.0)');
    for (const c of [solo, coop]) for (const e of c.enemies) { e.hp = e.maxHp = 999; if (e.poiseMeter) e.poiseMeter.max = 999; }
    const strikeOf = (piles) => Object.values(piles).flat().find((c) => c.kitRole === 'attack' && c.grantedBy);
    const place = (piles, card) => { for (const pile of Object.values(piles)) { const i = pile.indexOf(card); if (i >= 0) pile.splice(i, 1); } piles.hand.push(card); };
    const s = strikeOf(solo.piles); place(solo.piles, s);
    Object.assign(solo.player, { energy: 20, stamina: solo.player.maxStamina, mana: solo.player.maxMana });
    dispatch(solo, { type: 'playCard', cardInstanceId: s.instanceId, targetId: solo.enemies[0].id });
    const P = coop.players.get('p1');
    const c = Object.values(P.piles).flat().find((x) => x.cardId === s.cardId && x.grantedBy === s.grantedBy); place(P.piles, c);
    Object.assign(P.entity, { energy: 20, stamina: P.entity.maxStamina, mana: P.entity.maxMana });
    coopPlayCard(coop, 'p1', c.instanceId, coop.enemies[0].id);
    assert.ok(solo.enemies[0].hp < 999, 'the solo strike lands');
    assert.equal(coop.enemies[0].hp, solo.enemies[0].hp, 'the same strike deals the same damage in co-op');
    assert.deepEqual(P.artCharge, solo.artCharge, 'and charges the same Art meter');
  }
});
