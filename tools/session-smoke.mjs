// tools/session-smoke.mjs — headless check of the authoritative co-op session
// (S2 loop + S3 live combat). No browser, no network: drives the session object
// directly through map → shared combat → rewards, then exercises drop-out
// rescale + catch-up accrual + reconnect replay.
//
//   node tools/session-smoke.mjs

import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard, passiveSum } from '../src/model/registries.js';
import { playCard, endTurn } from '../src/engine/coopCombat.js';
import { createSession, coopHpMult } from './session.mjs';
import { COOP_CARD_IDS } from '../src/content/cards/coop.js';

const REG = createRegistries(contentBundle);
const fails = [];
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails.push(msg); };

// One member's greedy turn inside a live coopCombat (leftmost affordable → end).
function botTurn(combat, memberId) {
  const P = combat.players.get(memberId);
  if (!P || !P.connected || !P.entity.alive || P.ended) return;
  let guard = 0;
  while (combat.phase === 'player' && !P.ended && !combat.result && guard++ < 50) {
    const card = P.piles.hand.find((h) => {
      const def = resolveCard(REG, { cardId: h.cardId, upgraded: h.upgraded });
      if ((def.keywords || []).includes('unplayable')) return false;
      return (def.cost === 'X' ? 0 : def.cost) <= P.entity.energy && (def.manaCost || 0) <= P.entity.mana;
    });
    const tgt = combat.enemies.find((e) => e.alive);
    try {
      if (card) playCard(combat, memberId, card.instanceId, tgt && tgt.id);
      else { endTurn(combat, memberId); break; }
    } catch { endTurn(combat, memberId); break; }
  }
  if (!P.ended && combat.phase === 'player' && !combat.result) endTurn(combat, memberId);
}

// Fork voting: every present member votes for the same node so the party moves.
function route(S, nodeId) {
  for (const m of S.connectedMembers()) {
    S.chooseNode(m.id, nodeId);
    if (S.scene.kind !== 'map') return; // vote resolved (or solo routed)
  }
}

// Walk the party forward, auto-resolving each non-combat scene and each live
// fight, until they reach `stopKind` or a fixed step budget runs out.
function walk(S, { steps = 12, healBetween = true } = {}) {
  let guard = 0;
  while (guard++ < steps * 6) {
    const sc = S.scene;
    if (sc.kind === 'complete') return sc;
    if (sc.kind === 'map') route(S, S.session.reachableIds[0]);
    else if (sc.kind === 'combat') {
      S.autoResolveCombat(botTurn);
      if (healBetween) for (const m of S.livingMembers()) if (m.run.hp < 6) m.run.hp = m.run.maxHp; // keep the bot alive to keep walking
    } else if (sc.kind === 'reward') {
      for (const id of Object.keys(sc.offers)) S.chooseReward(id, { cardId: sc.offers[id].cardIds[0], takeRelic: true, flask: true });
    } else if (sc.kind === 'shrine') { for (const m of S.connectedMembers()) S.shrineChoice(m.id, 'rest'); }
    else if (sc.kind === 'event') { for (const m of S.connectedMembers()) S.eventChoice(m.id, 0); }
    else return sc;
    if (guard > 3 && S.scene.kind === 'map') return S.scene; // reached a fresh map after progress
  }
  return S.scene;
}

try {
  ok(coopHpMult(1) === 1 && Math.abs(coopHpMult(2) - 1.6) < 1e-9, 'coop HP scaling wired: 1p×1.0, 2p×1.6');

  const S = createSession({ registries: REG, seedString: 'GOLDBOUGH' });
  S.addMember({ id: 'p1', name: 'Wren', classId: 'starseer' });
  S.addMember({ id: 'p2', name: 'Fenn', classId: 'reaver' });
  S.start();
  ok(S.scene.kind === 'map', 'start → shared map scene');
  ok(S.snapshot().party.length === 2, 'snapshot shows a 2-member party');
  ok(S.snapshot().party.every((p) => p.attributeMode && p.attributes), 'party snapshot transports creation mode + inert attributes');

  // --- fork voting: one vote holds the party; a tie breaks toward the host ---
  const opts = S.session.reachableIds;
  const r1 = S.chooseNode('p1', opts[0]);
  ok(S.scene.kind === 'map' && r1.waiting === 1, 'a lone vote holds the party on the map (1 still to vote)');
  ok(S.scene.votes && S.scene.votes.p1 === opts[0], 'the vote is recorded on the scene for all clients');
  if (opts.length > 1) {
    S.chooseNode('p2', opts[1]); // 1-1 tie → the host's (earliest-joined) pick wins
    ok(S.scene.kind !== 'map' || S.session.cursorId === opts[0], 'tie breaks toward the host pick and the party travels');
    ok(S.session.cursorId === opts[0], 'party traveled to the host-voted node');
  } else {
    S.chooseNode('p2', opts[0]);
    ok(S.session.cursorId === opts[0], 'both votes in → the party travels');
  }
  // rewind to a clean map for the rest of the walk (whatever the node opened)
  {
    let unlock = 0;
    while (S.scene.kind !== 'map' && S.scene.kind !== 'complete' && unlock++ < 10) {
      const sc = S.scene;
      if (sc.kind === 'combat') S.autoResolveCombat(botTurn);
      else if (sc.kind === 'reward') for (const id of Object.keys(sc.offers)) S.chooseReward(id, { cardId: sc.offers[id].cardIds[0] });
      else if (sc.kind === 'shrine') for (const m of S.connectedMembers()) S.shrineChoice(m.id, 'rest');
      else if (sc.kind === 'event') for (const m of S.connectedMembers()) S.eventChoice(m.id, 0);
      else break;
    }
    for (const m of S.livingMembers()) if (m.run.hp < 12) m.run.hp = m.run.maxHp;
  }

  // ONE SEAT CARRIES AN UPGRADED RELIC INTO THE FIGHT. Ancestral Horn at tier
  // 1 prices Power cards lower than the tier-0 Horn does, and a client prices
  // from the snapshot (coop.js snapshotCosts) — so the snapshot has to carry
  // the tier, not just the id. Written through the run the way Smithing
  // writes it (run.relics + run.itemUpgradeLevels keyed by item ref).
  const p2run = S.session.members.get('p2').run;
  p2run.relics.push('ancestralHorn');
  p2run.itemUpgradeLevels = { ...(p2run.itemUpgradeLevels || {}), 'relic/ancestralHorn': 1 };
  // First node → live shared combat, both members in one fight.
  route(S, S.session.reachableIds[0]);
  // (first node may be an event/shrine; push until a combat opens)
  let steps = 0;
  while (S.scene.kind !== 'combat' && S.scene.kind !== 'complete' && steps++ < 8) {
    const sc = S.scene;
    if (sc.kind === 'map') route(S, S.session.reachableIds[0]);
    else if (sc.kind === 'reward') for (const id of Object.keys(sc.offers)) S.chooseReward(id, { cardId: sc.offers[id].cardIds[0] });
    else if (sc.kind === 'shrine') for (const m of S.connectedMembers()) S.shrineChoice(m.id, 'rest');
    else if (sc.kind === 'event') for (const m of S.connectedMembers()) S.eventChoice(m.id, 0);
  }
  ok(S.scene.kind === 'combat', 'party reaches a live shared combat');
  // A CO-OP EVENT CHOICE IS A QUEST STEP: every member who chose has the
  // record in their own run's history, by stable event and choice id, and the
  // shared map is built on the host's (S.partyHistory()) — the door main.js
  // walks with run.history, which this session never walked before.
  {
    const withEvents = S.connectedMembers().filter((m) => (m.run.history || []).some((h) => h.kind === 'event-choice' || h.eventId));
    const p1h = S.session.members.get('p1').run.history || [];
    // GOLDBOUGH's first stretch reaches an event before its first combat, so a
    // walk that recorded nothing is the defect, not a vacuous green.
    ok(p1h.length >= 1, `the walk answered an event before its first combat and the host recorded it (${p1h.length} record(s))`);
    ok(S.partyHistory().length === p1h.length && S.partyHistory().every((h, i) => h.eventId === p1h[i].eventId && h.choiceId === p1h[i].choiceId),
      `the party's choice history is the host's (${S.partyHistory().length} record(s) for p1)`);
    ok(withEvents.length === (p1h.length ? S.connectedMembers().length : 0),
      `every member who answered an event carries the record (${withEvents.length} of ${S.connectedMembers().length}; p1 has ${p1h.length})`);
    if (p1h.length) ok(p1h.every((h) => typeof h.eventId === 'string' && typeof h.choiceId === 'string' && Number.isInteger(h.actNumber) && Number.isInteger(h.floor)),
      `each record names its event, choice, act and floor (${JSON.stringify(p1h[0])})`);
    ok(S.serialize() === null || Array.isArray(S.serialize().history), 'the party history rides the host save (serialize)');
  }
  // THE PARTY'S HISTORY IS THE PARTY'S, NOT THE FIRST SEAT'S: with the
  // earliest-joined member gone before the event, the present member's choice
  // is the record the next map answers to, and the scene carried each seat's
  // open choices by authored index.
  {
    const T = createSession({ registries: REG, seedString: 'GOLDBOUGH' });
    T.addMember({ id: 'p1', name: 'Wren', classId: 'starseer' });
    T.addMember({ id: 'p2', name: 'Fenn', classId: 'reaver' });
    T.start();
    T.setConnected('p1', false);
    let hops = 0; let sawOpen = null;
    while (T.scene.kind !== 'event' && T.scene.kind !== 'complete' && hops++ < 24) {
      for (const m of T.livingMembers()) if (m.run.hp < 12) m.run.hp = m.run.maxHp;
      const sc = T.scene;
      if (sc.kind === 'map') for (const m of T.connectedMembers()) T.chooseNode(m.id, T.session.reachableIds[0]);
      else if (sc.kind === 'combat') T.autoResolveCombat(botTurn);
      else if (sc.kind === 'reward') for (const id of Object.keys(sc.offers)) T.chooseReward(id, { cardId: sc.offers[id].cardIds[0] });
      else if (sc.kind === 'shrine') for (const m of T.connectedMembers()) T.shrineChoice(m.id, 'rest');
    }
    if (T.scene.kind === 'event') {
      sawOpen = T.scene.open;
      const eventId = T.scene.eventId;
      // A CHOICE WITH A PRICE IS REFUSED BEFORE ANYTHING IS RECORDED, and a
      // fallen seat's choice is refused outright.
      const priced = (REG.events.get(eventId).choices || []).findIndex((c) => c.requires && typeof c.requires.cinders === 'number');
      if (priced >= 0) {
        const p2 = T.session.members.get('p2'); const hadCinders = p2.run.cinders; p2.run.cinders = 0;
        const refused = T.eventChoice('p2', priced);
        ok(!refused.ok && (p2.run.history || []).length === 0 && T.partyHistory().length === 0,
          `a choice the member cannot afford is refused and records nothing (${JSON.stringify(refused)})`);
        p2.run.cinders = hadCinders;
      }
      const fallen = T.eventChoice('p1', 0);
      // THE PRICED CHOICE, on an event that has one: the Weeping Pilgrim's
      // "Give 50 cinders" is refused for a member holding none, before any
      // record is written — posed by setting the scene directly, the way a
      // resumed save lands on it (no picks/open, which the choice initialises).
      {
        const U = createSession({ registries: REG, seedString: 'GOLDBOUGH' });
        U.addMember({ id: 'q1', name: 'Ash', classId: 'reaver' });
        U.start();
        U.session.cursorId = U.session.reachableIds[0]; // a real node, so the event can advance from it
        U.session.scene = { kind: 'event', eventId: 'weepingPilgrim', done: {} };
        const pilgrim = REG.events.get('weepingPilgrim');
        const priced = pilgrim.choices.findIndex((c) => c.requires && typeof c.requires.cinders === 'number');
        const q1 = U.session.members.get('q1'); q1.run.cinders = 0;
        const refused = U.eventChoice('q1', priced);
        ok(priced >= 0 && !refused.ok && (q1.run.history || []).length === 0 && U.partyHistory().length === 0 && U.scene.kind === 'event',
          `a choice the member cannot afford is refused before anything is recorded (${JSON.stringify(refused)})`);
        q1.run.cinders = pilgrim.choices[priced].requires.cinders;
        const relicsBefore = q1.run.relics.length;
        const paid = U.eventChoice('q1', priced);
        ok(paid.ok && U.partyHistory().length === 1 && U.partyHistory()[0].choiceId === (q1.run.history[0] || {}).choiceId,
          `the same choice with the cinders in hand is recorded (${JSON.stringify(U.partyHistory()[0])})`);
        // AND THE TRANSACTION HAPPENED: the cinders are gone and the relic is
        // in hand — the authored effects ran before the fact was recorded.
        ok(q1.run.cinders === 0 && q1.run.relics.length === relicsBefore + 1,
          `the choice's authored effects ran before the record (cinders ${pilgrim.choices[priced].requires.cinders} -> ${q1.run.cinders}, relics ${relicsBefore} -> ${q1.run.relics.length})`);
      }
      ok(!fallen.ok && T.partyHistory().length === 0, `an absent seat's choice is refused (${JSON.stringify(fallen)})`);
      const r = T.eventChoice('p2', 0);
      const party = T.partyHistory();
      ok(r.ok && party.length === 1 && party[0].eventId === eventId && party[0].choiceId === (T.session.members.get('p2').run.history[0] || {}).choiceId
        && (T.session.members.get('p1').run.history || []).length === 0,
        `with the first seat absent, the present member's choice is the party's record (${JSON.stringify(party[0])}; p1 recorded ${(T.session.members.get('p1').run.history || []).length})`);
      ok(sawOpen && Object.keys(sawOpen).length === 2 && (sawOpen.p2 === null || Array.isArray(sawOpen.p2)),
        `the event scene carries each seat's open choices by authored index (${JSON.stringify(sawOpen)})`);
    } else {
      ok(false, `the host-absent walk did not reach an event (scene ${T.scene.kind}) — the party-record check could not be asked`);
    }
  }
  ok(S.scene.players.length === 2 && S.scene.enemies.length >= 1, 'combat scene exposes both players + shared enemies');
  ok(S.scene.players.every((p) => p.attributeMode && p.attributes), 'combat snapshot transports each seat\'s inert attributes');
  {
    const p2snap = S.scene.players.find((p) => p.id === 'p2');
    const hostSays = passiveSum(REG, p2run.relics, 'powerCostReduction', p2run.itemUpgradeLevels);
    const tierZero = passiveSum(REG, p2run.relics, 'powerCostReduction', {});
    const clientSays = p2snap ? passiveSum(REG, p2snap.relicIds, 'powerCostReduction', p2snap.itemUpgradeLevels || {}) : null;
    ok(hostSays > tierZero, `the posed Horn tier prices Power cards below tier 0 on the host (reduction ${hostSays} vs ${tierZero})`);
    ok(clientSays === hostSays, `the combat snapshot carries the seat's relic tiers, so a client prices Power cards as the host charges them (client ${clientSays} vs host ${hostSays})`);
  }
  const hostEnemy = S.live.combat.enemies[0];
  const snapshotEnemy = S.snapshot().scene.enemies.find((enemy) => enemy.id === hostEnemy.id);
  ok(JSON.stringify(snapshotEnemy.arcaneExposure) === JSON.stringify(hostEnemy.arcaneExposure), 'combat snapshot transports the host Arcane Exposure state exactly');
  ok(JSON.stringify(snapshotEnemy.damageResistanceBySchool) === JSON.stringify(hostEnemy.damageResistanceBySchool), 'combat snapshot keeps raw school resistance separate');
  const twoPMult = coopHpMult(2);
  ok(S.live && Math.abs(S.live.combat.baseHpMult - twoPMult) < 1e-9, 'enemies scaled to the 2-player headcount');

  const p1AttributesBefore = JSON.stringify({
    attributeMode: S.session.members.get('p1').run.attributeMode,
    attributes: S.session.members.get('p1').run.attributes,
  });
  // Combat carries an inert copy for snapshots. Even if that copy is damaged,
  // the run remains the sole authority and no combat outcome writes it back.
  S.live.combat.players.get('p1').attributeMode = 'ghost';
  S.live.combat.players.get('p1').attributes.strength = 999;
  const p2DeckBefore = S.session.members.get('p2').run.deck.length;
  S.autoResolveCombat(botTurn);
  ok(JSON.stringify({
    attributeMode: S.session.members.get('p1').run.attributeMode,
    attributes: S.session.members.get('p1').run.attributes,
  }) === p1AttributesBefore, 'combat snapshot copies cannot mutate or overwrite the authoritative run allocation');
  ok(S.scene.kind === 'reward' || S.scene.kind === 'complete', 'shared combat settles into rewards (or run end)');
  if (S.scene.kind === 'reward') {
    ok(!!S.scene.offers.p1 && !!S.scene.offers.p2, 'both present members get their own reward offer');
    ok(COOP_CARD_IDS.includes(S.scene.offers.p1.cardIds[S.scene.offers.p1.cardIds.length - 1]), 'party rewards carry a co-op-only card option');
    for (const id of Object.keys(S.scene.offers)) S.chooseReward(id, { cardId: S.scene.offers[id].cardIds[0] });
    ok(S.session.members.get('p2').run.deck.length === p2DeckBefore + 1, 'p2 deck grew by the chosen card');
  }

  // --- drop-out: p2 disconnects; the party fights on rescaled to solo ---
  S.setConnected('p2', false);
  ok(S.connectedMembers().length === 1, 'headcount drops to 1 when p2 disconnects');
  let g = 0;
  while (S.scene.kind !== 'combat' && S.scene.kind !== 'complete' && g++ < 10) {
    const sc = S.scene;
    if (sc.kind === 'map') route(S, S.session.reachableIds[0]);
    else if (sc.kind === 'reward') { for (const id of Object.keys(sc.offers)) S.chooseReward(id, { cardId: sc.offers[id].cardIds[0] }); }
    else if (sc.kind === 'shrine') S.shrineChoice('p1', 'rest');
    else if (sc.kind === 'event') S.eventChoice('p1', 0);
    for (const m of S.livingMembers()) if (m.run.hp < 10) m.run.hp = m.run.maxHp;
  }
  ok(S.scene.kind === 'combat', 'the solo remaining member reaches the next fight');
  ok(S.live && Math.abs(S.live.combat.baseHpMult - coopHpMult(1)) < 1e-9, 'enemies rescale DOWN to solo when p2 is away');
  const p2CatchBefore = S.session.members.get('p2').catchup.length;
  S.autoResolveCombat(botTurn);
  if (S.scene.kind === 'reward') { ok(!S.scene.offers.p2, 'absent p2 gets no live reward offer'); for (const id of Object.keys(S.scene.offers)) S.chooseReward(id, { cardId: S.scene.offers[id].cardIds[0] }); }
  const p2 = S.session.members.get('p2');
  ok(p2.catchup.length === p2CatchBefore + 1, 'p2 accrued a queued catch-up reward while away');

  // --- reconnect: p2 replays the missed choice as a series ---
  S.setConnected('p2', true);
  const deckBefore = p2.run.deck.length;
  const queued = p2.catchup[0];
  ok(queued.type === 'reward' && queued.offer.cardIds.length > 0, 'queued item is a reward with rolled options');
  const res = S.resolveCatchup('p2', 0, { cardId: queued.offer.cardIds[0], takeRelic: true, flask: true });
  ok(res.ok && p2.run.deck.length === deckBefore + 1, 'catch-up replay adds the chosen missed card');
  ok(p2.catchup.length === 0, 'catch-up queue drains after replay');

  // --- Mend at a shrine: isolate this rule from the long combat walk above.
  // That walk may truthfully kill either bot as card balance evolves; Mend
  // refuses dead allies, so reusing its survivors made this a balance lottery
  // rather than an ally-targeting contract.
  const M = createSession({ registries: REG, seedString: 'MENDGATE' });
  M.addMember({ id: 'p1', name: 'Wren', classId: 'starseer' });
  M.addMember({ id: 'p2', name: 'Fenn', classId: 'reaver' });
  M.start();
  M.session.scene = { kind: 'shrine', done: {} };
  const p1m = M.session.members.get('p1');
  p1m.run.hp = 20;
  const mendBefore = p1m.run.hp;
  M.shrineChoice('p2', 'mend', 'p1'); // p2 mends p1
  ok(p1m.run.hp === Math.min(p1m.run.maxHp, mendBefore + Math.ceil(p1m.run.maxHp * 0.3)), 'Mend heals the targeted ally for 30% of their max HP');
} catch (e) {
  ok(false, `threw: ${e.stack || e.message}`);
}

console.log(fails.length ? `\nSESSION SMOKE FAILED (${fails.length})` : '\nSession + live combat (S2+S3) OK');
process.exit(fails.length ? 1 : 0);
