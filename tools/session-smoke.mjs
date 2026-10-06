// tools/session-smoke.mjs — headless check of the authoritative co-op session
// (S2 loop + S3 live combat). No browser, no network: drives the session object
// directly through map → shared combat → rewards, then exercises drop-out
// rescale + catch-up accrual + reconnect replay.
//
//   node tools/session-smoke.mjs

import { contentBundle } from '../src/content/index.js';
import { botCardTargetId } from './simbot.mjs';
import { createRegistries, resolveCard, passiveSum } from '../src/model/registries.js';
import { playCard, endTurn } from '../src/engine/coopCombat.js';
import { createSession, restoreSession, coopHpMult } from './session.mjs';
import { playerPoiseThresholdReceipt } from '../src/model/statProjection.js';
import { COOP_CARD_IDS } from '../src/content/cards/coop.js';
import { availableEventChoices, recordEventChoice } from '../src/model/quests.js';
import { eventChoicesWithHistory } from '../src/content/events.js';
import { rollRelicReward } from '../src/engine/encounters.js';
// A missed event's replay commits the choice, then the seat reads its result
// and continues; the proofs that expect the queue to move on do both.
const replay = (S, id, idx, pick) => { const r = S.resolveCatchup(id, idx, pick); if (r.ok && r.pending) S.resolveCatchup(id, idx, { continue: true }); return r; };

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
      // Stamina is a price too (plan phase 8 put one on the signature arts):
      // a play the pool cannot fund throws, and a throw ends the bot's turn.
      return (def.cost === 'X' ? 0 : def.cost) <= P.entity.energy && (def.manaCost || 0) <= P.entity.mana && (def.staminaCost || 0) <= (P.entity.stamina || 0);
    });
    const tgt = combat.enemies.find((e) => e.alive);
    try {
      if (card) playCard(combat, memberId, card.instanceId, botCardTargetId(REG, combat, card, tgt?.id));
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
    else if (sc.kind === 'event') { for (const m of S.connectedMembers()) (sc.next ? S.eventContinue(m.id) : S.eventChoice(m.id, 0)); }
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
  ok(S.snapshot().party.every((p) => p.spriteStyle === 'animated'), 'members without an explicit sprite style default to Animated');
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
      else if (sc.kind === 'event') for (const m of S.connectedMembers()) (sc.next ? S.eventContinue(m.id) : S.eventChoice(m.id, 0));
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
    else if (sc.kind === 'event') for (const m of S.connectedMembers()) (sc.next ? S.eventContinue(m.id) : S.eventChoice(m.id, 0));
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
      // AN EVENT THAT STARTS A FIGHT opens the shared combat on the named
      // encounter (the Feral Shrine's keeper), and the flag is consumed.
      {
        const V = createSession({ registries: REG, seedString: 'GOLDBOUGH' });
        V.addMember({ id: 'v1', name: 'Ash', classId: 'reaver' });
        V.start();
        V.session.cursorId = V.session.reachableIds[0];
        V.session.scene = { kind: 'event', eventId: 'feralShrine', done: {} };
        const shrine = REG.events.get('feralShrine');
        const fightIdx = shrine.choices.findIndex((c) => (c.effects || []).some((e) => e.op === 'startCombat'));
        const wanted = shrine.choices[fightIdx].effects.find((e) => e.op === 'startCombat').encounterId;
        const r = V.eventChoice('v1', fightIdx);
        // THE RESULT SHOWS FIRST: the scene stays an event, carrying this
        // seat's resultText and the pending fight, until the seat asks for it
        // (DEVELOPER.md's event contract; Codex on #541).
        const told = shrine.choices[fightIdx].resultText || '';
        ok(r.ok && r.pending === 'combat' && V.scene.kind === 'event' && V.scene.next && V.scene.next.encounterId === wanted
          && V.scene.results && V.scene.results.v1 === told && told.length > 0,
          `a fight-starting choice leaves the event open with its result to read (pending ${r.pending}, next ${V.scene.next && V.scene.next.encounterId}, result "${String(V.scene.results && V.scene.results.v1).slice(0, 40)}…")`);
        // THE PENDING STATE IS A SAVE: the fighter's transient flag is consumed
        // when the fight becomes scene.next, so a host restart here restores
        // (Codex on #545).
        {
          const saved = V.serialize();
          let restored = null, err = null;
          try { restored = restoreSession(REG, saved); } catch (e) { err = e.message; }
          ok(saved && V.session.members.get('v1').run.combatEntered == null && restored && restored.scene.kind === 'event' && restored.scene.next && restored.scene.next.encounterId === wanted,
            `the pending fight is a restorable save (flag ${V.session.members.get('v1').run.combatEntered}, restored scene ${restored ? restored.scene.kind + '/' + (restored.scene.next && restored.scene.next.encounterId) : err})`);
        }
        const rc = V.eventContinue('v1');
        const enemyIds = V.scene.kind === 'combat' ? (V.scene.enemies || []).map((e) => e.enemyId || e.id) : [];
        ok(rc.ok && rc.combat === wanted && V.scene.kind === 'combat' && V.session.members.get('v1').run.combatEntered == null,
          `STEEL YOURSELF opens the shared combat on the named encounter (${wanted}) and consumes the flag (scene ${V.scene.kind}, combat=${rc.combat}, enemies ${JSON.stringify(enemyIds).slice(0, 80)})`);
        // THE FORCED ENCOUNTER BRINGS ITS OWN POOL: the wyrm is an elite, so the
        // fight is priced as one and its victory pays the elite reward (relic,
        // Smithing Stone), as the solo player's does (Codex on #541).
        const wantedPool = REG.encounters.get(wanted).pool;
        ok(V.scene.kind === 'combat' && V.scene.pool === wantedPool && wantedPool !== 'normal',
          `the forced encounter's fight carries the encounter's own pool (${wanted} is ${wantedPool}; scene pool ${V.scene.pool})`);
        {
          const v1 = V.session.members.get('v1');
          // The wyrm at 1 HP so the seat's first blow ends it through the
          // engine's own door; the reward that follows is the fight's.
          V.autoResolveCombat((combat, id) => { for (const e of combat.enemies) if (e.alive) e.hp = Math.min(e.hp, 1); botTurn(combat, id); });
          const offer = V.session.scene.kind === 'reward' ? V.session.scene.offers.v1 : null;
          ok(V.session.scene.kind === 'reward' && V.session.scene.pool === wantedPool && offer && offer.pool === wantedPool
            && typeof offer.relicId === 'string' && offer.smithingStoneReceipt && offer.smithingStoneReceipt.amount > 0,
            `its victory pays the ${wantedPool} reward: relic ${offer && offer.relicId}, Smithing Stone ${offer && offer.smithingStoneReceipt && offer.smithingStoneReceipt.amount} (seat stones ${v1.run.smithingStones})`);
        }
      }
      // THE RESULT SHOWS BEFORE THE MAP for every other choice too: a calm
      // choice leaves the event open with its resultText and the advance
      // pending, and CONTINUE moves the party on — the solo screen's contract,
      // where advancing at once broadcast the map in place of the outcome
      // (Codex on #541).
      {
        const N = createSession({ registries: REG, seedString: 'GOLDBOUGH' });
        N.addMember({ id: 'n1', name: 'Ash', classId: 'reaver' });
        N.start();
        N.session.cursorId = N.session.reachableIds[0];
        N.session.scene = { kind: 'event', eventId: 'feralShrine', done: {} };
        const shrine = REG.events.get('feralShrine');
        const calmIdx = shrine.choices.findIndex((c) => !(c.effects || []).some((e) => e.op === 'startCombat'));
        const told = shrine.choices[calmIdx].resultText || '';
        const r = N.eventChoice('n1', calmIdx);
        const shown = r.ok && r.pending === 'advance' && N.scene.kind === 'event' && N.scene.next && N.scene.next.kind === 'advance'
          && N.scene.results && N.scene.results.n1 === told && told.length > 0 && N.partyHistory().length === 1;
        const rc = N.eventContinue('n1');
        ok(shown && rc.ok && N.scene.kind !== 'event',
          `a calm choice leaves the event open with its result to read (pending ${r.pending}, recorded ${N.partyHistory().length}, result "${String(N.scene.results && N.scene.results.n1 || told).slice(0, 40)}…") and CONTINUE moves the party on (then scene ${N.scene.kind})`);
      }
      // A FORCED FIGHT SURVIVES ITS CHOOSER'S DISCONNECT: the seat that chose
      // the fight drops before the room resolves; the other seat's peaceful
      // choice still opens the fight the party bought (Codex on #541).
      {
        const X = createSession({ registries: REG, seedString: 'GOLDBOUGH' });
        X.addMember({ id: 'x1', name: 'Ash', classId: 'reaver' });
        X.addMember({ id: 'x2', name: 'Bel', classId: 'starseer' });
        X.start();
        X.session.cursorId = X.session.reachableIds[0];
        X.session.scene = { kind: 'event', eventId: 'feralShrine', done: {} };
        const shrine = REG.events.get('feralShrine');
        const fightIdx = shrine.choices.findIndex((c) => (c.effects || []).some((e) => e.op === 'startCombat'));
        const calmIdx = shrine.choices.findIndex((c) => !(c.effects || []).some((e) => e.op === 'startCombat'));
        const wanted = shrine.choices[fightIdx].effects.find((e) => e.op === 'startCombat').encounterId;
        const r1 = X.eventChoice('x1', fightIdx);
        X.setConnected('x1', false);
        const r2 = X.eventChoice('x2', calmIdx);
        const r3 = r2.ok && r2.pending === 'combat' ? X.eventContinue('x2') : { ok: false };
        ok(r1.ok && r2.ok && r2.combat === wanted && r3.ok && r3.combat === wanted && X.scene.kind === 'combat' && X.session.members.get('x1').run.combatEntered == null,
          `the fight a seat chose before dropping still opens for the party once the present seat has read its result (pending ${r2.combat}, opened ${r3.combat}, scene ${X.scene.kind}; the flag is consumed)`);
      }
      // A SEAT THAT LEAVES DURING THE ACKNOWLEDGMENT does not strand the
      // others on "Waiting for the party…": presence changes re-settle the
      // event, as they re-settle a map vote (Codex on #545).
      {
        const Y = createSession({ registries: REG, seedString: 'GOLDBOUGH' });
        Y.addMember({ id: 'y1', name: 'Ash', classId: 'reaver' });
        Y.addMember({ id: 'y2', name: 'Bel', classId: 'starseer' });
        Y.start();
        Y.session.cursorId = Y.session.reachableIds[0];
        Y.session.scene = { kind: 'event', eventId: 'feralShrine', done: {} };
        const shrine = REG.events.get('feralShrine');
        const fightIdx = shrine.choices.findIndex((c) => (c.effects || []).some((e) => e.op === 'startCombat'));
        const calmIdx = shrine.choices.findIndex((c) => !(c.effects || []).some((e) => e.op === 'startCombat'));
        const wanted = shrine.choices[fightIdx].effects.find((e) => e.op === 'startCombat').encounterId;
        Y.eventChoice('y1', fightIdx); const r2 = Y.eventChoice('y2', calmIdx);
        const r3 = Y.eventContinue('y1');
        const stillWaiting = Y.scene.kind === 'event' && r3.waiting === 1;
        Y.setConnected('y2', false);
        ok(r2.pending === 'combat' && stillWaiting && Y.scene.kind === 'combat' && Y.session.members.get('y1').run.combatEntered == null,
          `a seat leaving mid-acknowledgment settles the room for the seats still in it (waited on 1, then scene ${Y.scene.kind} on ${wanted})`);
        // AND A SEAT THAT LEAVES BEFORE CHOOSING settles a room where everyone
        // present has chosen.
        const Z = createSession({ registries: REG, seedString: 'GOLDBOUGH' });
        Z.addMember({ id: 'z1', name: 'Ash', classId: 'reaver' });
        Z.addMember({ id: 'z2', name: 'Bel', classId: 'starseer' });
        Z.start();
        Z.session.cursorId = Z.session.reachableIds[0];
        Z.session.scene = { kind: 'event', eventId: 'feralShrine', done: {} };
        const q1 = Z.eventChoice('z1', calmIdx);
        Z.setConnected('z2', false);
        const zPending = Z.scene.kind === 'event' && Z.scene.next && Z.scene.next.kind === 'advance';
        Z.eventContinue('z1');
        ok(q1.ok && q1.waiting === 1 && zPending && Z.scene.kind !== 'event',
          `a seat leaving before choosing settles a room where every present seat has chosen: the result is shown (pending advance), and CONTINUE moves on (then scene ${Z.scene.kind})`);
      }
      // A SEAT RETURNING TO A ROOM EVERYONE LEFT after it had chosen settles the
      // room for itself, rather than waiting on the absent (Codex on #541).
      // (r1 leaves FIRST, then r2: r2 leaving a room where every present seat
      // had chosen would settle it, so the room must empty with r1's choice made.)
      {
        const R = createSession({ registries: REG, seedString: 'GOLDBOUGH' });
        R.addMember({ id: 'r1', name: 'Ash', classId: 'reaver' });
        R.addMember({ id: 'r2', name: 'Bel', classId: 'starseer' });
        R.start();
        R.session.cursorId = R.session.reachableIds[0];
        R.session.scene = { kind: 'event', eventId: 'feralShrine', done: {} };
        const shrine = REG.events.get('feralShrine');
        const calmIdx = shrine.choices.findIndex((c) => !(c.effects || []).some((e) => e.op === 'startCombat'));
        R.eventChoice('r1', calmIdx);
        R.setConnected('r1', false);
        R.setConnected('r2', false);
        const emptyStays = R.scene.kind === 'event' && !R.scene.next;
        R.setConnected('r1', true);
        const rPending = R.scene.kind === 'event' && R.scene.next && R.scene.next.kind === 'advance';
        R.eventContinue('r1');
        ok(emptyStays && rPending && R.scene.kind !== 'event',
          `an emptied room stays put (scene event, nothing pending) and the chosen seat's return settles it to its result (pending advance; then scene ${R.scene.kind})`);
      }
      // THE ABSENT KEEP THEIR TURN: an event the party settles while a living
      // seat is away goes into that seat's catch-up queue with the choices its
      // history admitted, and is