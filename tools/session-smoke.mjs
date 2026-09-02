// tools/session-smoke.mjs — headless check of the authoritative co-op session
// (S2 loop + S3 live combat). No browser, no network: drives the session object
// directly through map → shared combat → rewards, then exercises drop-out
// rescale + catch-up accrual + reconnect replay.
//
//   node tools/session-smoke.mjs

import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard, passiveSum } from '../src/model/registries.js';
import { playCard, endTurn } from '../src/engine/coopCombat.js';
import { createSession, restoreSession, coopHpMult } from './session.mjs';
import { playerPoiseThresholdReceipt } from '../src/model/statProjection.js';
import { COOP_CARD_IDS } from '../src/content/cards/coop.js';
import { availableEventChoices, recordEventChoice } from '../src/model/quests.js';
import { eventChoicesWithHistory } from '../src/content/events.js';

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
      // history admitted, and is chosen on return through the live choice's
      // door — effects run, the fact recorded at the node the party met it,
      // and the queue drains (MULTIPLAYER.md's catch-up series; Codex on #541).
      {
        const C = createSession({ registries: REG, seedString: 'GOLDBOUGH' });
        C.addMember({ id: 'c1', name: 'Ash', classId: 'reaver' });
        C.addMember({ id: 'c2', name: 'Bel', classId: 'starseer' });
        C.start();
        C.session.cursorId = C.session.reachableIds[0];
        C.session.scene = { kind: 'event', eventId: 'ancientRuneStone', done: {} };
        const stone = REG.events.get('ancientRuneStone');
        const smashIdx = stone.choices.findIndex((c) => (c.effects || []).some((e) => e.op === 'addCinders'));
        const smash = stone.choices[smashIdx].effects.find((e) => e.op === 'addCinders').amount;
        const c2 = C.session.members.get('c2');
        C.setConnected('c2', false);
        const q1 = C.eventChoice('c1', smashIdx);
        const queued = c2.catchup[c2.catchup.length - 1];
        C.eventContinue('c1');
        ok(q1.ok && C.scene.kind !== 'event' && queued && queued.type === 'event' && queued.eventId === 'ancientRuneStone' && queued.act === 1,
          `the room settles without the absent seat (scene ${C.scene.kind}) and the event is queued in its catch-up (${queued ? queued.type + ' ' + queued.eventId : 'nothing queued'})`);
        const spentBefore = c2.run.cinders;
        const histBefore = (c2.run.history || []).length;
        const refused = C.resolveCatchup('c2', c2.catchup.length - 1, { choiceIndex: 99 });
        C.setConnected('c2', true);
        const replayed = C.resolveCatchup('c2', c2.catchup.length - 1, { choiceIndex: smashIdx });
        const recorded = (c2.run.history || []).slice(histBefore).some((h) => h.eventId === 'ancientRuneStone' && h.choiceId === 'smashStone');
        ok(!refused.ok && replayed.ok && c2.run.cinders === spentBefore + smash && recorded && c2.catchup.length === 0 && c2.run.floor === C.session.floor,
          `a bad index is refused, the replayed choice pays out (+${c2.run.cinders - spentBefore} cinders, expected +${smash}), is recorded (${recorded}), drains the queue (${c2.catchup.length} left) and the seat snaps back to the party's floor`);
        // THE OPTIONS FROZEN IN EACH ENTRY ARE HONOURED: a seat away for the
        // Abandoned Cart and then the Merchant's Ghost has "pay in kind" frozen
        // open at the ghost (its history had no strongbox then), and the entry
        // is served against that list, not against the history as the replay
        // has since rewritten it — a strongbox in the history by then must not
        // turn the button the entry put on screen inert (Codex on #548). The
        // cart's strongbox itself is withheld from the entry (a 50% fight the
        // party did not meet), so the rewritten history is written directly.
        {
          const E = createSession({ registries: REG, seedString: 'GOLDBOUGH' });
          E.addMember({ id: 'e1', name: 'Ash', classId: 'reaver' });
          E.addMember({ id: 'e2', name: 'Bel', classId: 'starseer' });
          E.start();
          E.session.cursorId = E.session.reachableIds[0];
          const e2 = E.session.members.get('e2');
          E.setConnected('e2', false);
          const cart = REG.events.get('abandonedCart'), ghost = REG.events.get('merchantsGhost');
          const cartIds = ['lootStrongbox', 'leave'], ghostIds = ['payInKind', 'stealRelic', 'leave'];
          E.session.scene = { kind: 'event', eventId: 'abandonedCart', done: {}, picks: {}, open: { e1: null, e2: [0, 1] } };
          E.eventChoice('e1', cartIds.indexOf('leave'));
          E.session.scene = { kind: 'event', eventId: 'merchantsGhost', done: {}, picks: {}, open: { e1: [0, 1, 2], e2: [0, 1, 2] } };
          E.eventChoice('e1', ghostIds.indexOf('leave'));
          const queuedBoth = e2.catchup.filter((c) => c.type === 'event').map((c) => c.eventId);
          E.setConnected('e2', true);
          const cartEntry = e2.catchup[0], ghostEntry = e2.catchup[1];
          const first = E.resolveCatchup('e2', 0, { choiceIndex: cartIds.indexOf('leave') });
          e2.run.actNumber = 1; e2.run.floor = E.session.floor; e2.run.mapNodeId = E.session.cursorId ?? null;
          recordEventChoice(e2.run, { eventId: 'abandonedCart', choiceId: 'lootStrongbox' }); // the history the frozen list predates
          const liveWouldRefuse = !availableEventChoices(eventChoicesWithHistory(ghost), e2.run).some((row) => row.choice.id === 'payInKind');
          e2.run.cinders = Math.max(e2.run.cinders, ((ghost.choices[ghostIds.indexOf('payInKind')].requires || {}).cinders) || 0); // the price, so the refusal under test is the history's, not the purse's
          const second = e2.catchup[0] && e2.catchup[0].eventId === 'merchantsGhost' ? E.resolveCatchup('e2', 0, { choiceIndex: ghostIds.indexOf('payInKind') }) : { ok: false, error: 'ghost not next' };
          ok(queuedBoth.join(',') === 'abandonedCart,merchantsGhost' && cartEntry && !cartEntry.open.includes(cartIds.indexOf('lootStrongbox')) && ghostEntry && ghostEntry.open.includes(ghostIds.indexOf('payInKind'))
            && first.ok && liveWouldRefuse && second.ok && e2.catchup.length === 0 && (cart.choices.length === 2 && ghost.choices.length === 3),
            `both missed events are queued (${queuedBoth.join(', ')}; the cart's strongbox withheld, "pay in kind" frozen open), and the ghost's entry is served against its frozen list — live history would refuse it (${liveWouldRefuse}), the replay honours it (${second.ok ? 'ok' : second.error}); ${e2.catchup.length} left`);
        }
        // A CHOICE THAT STARTS A FIGHT IS WITHHELD from the entry unless the
        // party fought that encounter: the absent seat at the Feral Shrine
        // cannot take the offering (its relic) behind a party that left; behind
        // a party that fought the wyrm it can (Codex on #548).
        {
          const shrine = REG.events.get('feralShrine');
          const fightIdx = shrine.choices.findIndex((c) => (c.effects || []).some((e) => e.op === 'startCombat'));
          const calmIdx = shrine.choices.findIndex((c) => !(c.effects || []).some((e) => e.op === 'startCombat'));
          const F = createSession({ registries: REG, seedString: 'GOLDBOUGH' });
          F.addMember({ id: 'f1', name: 'Ash', classId: 'reaver' });
          F.addMember({ id: 'f2', name: 'Bel', classId: 'starseer' });
          F.start();
          F.session.cursorId = F.session.reachableIds[0];
          F.setConnected('f2', false);
          F.session.scene = { kind: 'event', eventId: 'feralShrine', done: {} };
          F.eventChoice('f1', calmIdx);
          const f2 = F.session.members.get('f2');
          const left = f2.catchup[f2.catchup.length - 1];
          const relicsBefore = f2.run.relics.length;
          F.setConnected('f2', true);
          const refused = F.resolveCatchup('f2', f2.catchup.length - 1, { choiceIndex: fightIdx });
          const G = createSession({ registries: REG, seedString: 'GOLDBOUGH' });
          G.addMember({ id: 'g1', name: 'Ash', classId: 'reaver' });
          G.addMember({ id: 'g2', name: 'Bel', classId: 'starseer' });
          G.start();
          G.session.cursorId = G.session.reachableIds[0];
          G.setConnected('g2', false);
          G.session.scene = { kind: 'event', eventId: 'feralShrine', done: {} };
          G.eventChoice('g1', fightIdx);
          const g2 = G.session.members.get('g2');
          const fought = g2.catchup[g2.catchup.length - 1];
          ok(left && Array.isArray(left.open) && !left.open.includes(fightIdx) && left.open.includes(calmIdx) && !refused.ok && f2.run.relics.length === relicsBefore
            && fought && Array.isArray(fought.open) && fought.open.includes(fightIdx),
            `the offering is withheld from the entry behind a party that left (open ${JSON.stringify(left && left.open)}, replay ${refused.ok ? 'taken' : 'refused'}, relics ${relicsBefore} -> ${f2.run.relics.length}) and open behind a party that fought the wyrm (open ${JSON.stringify(fought && fought.open)})`);
        }
        // A RETURN INTO A LIVE FIGHT WAITS ON THE CATCH-UP: the seat's body
        // enters the fight only once its queue has drained, carrying what the
        // replay wrote to the run (a lost tenth of max HP), so the fight
        // cannot write the old numbers back over it (Codex on #548).
        {
          const stone = REG.events.get('ancientRuneStone');
          const studyIdx = stone.choices.findIndex((c) => (c.effects || []).some((e) => e.op === 'maxHp' || (e.op === 'damage' && e.target === 'self') || /maxHp/i.test(JSON.stringify(e))));
          const shrine = REG.events.get('feralShrine');
          const fightIdx = shrine.choices.findIndex((c) => (c.effects || []).some((e) => e.op === 'startCombat'));
          const H = createSession({ registries: REG, seedString: 'GOLDBOUGH' });
          H.addMember({ id: 'h1', name: 'Ash', classId: 'reaver' });
          H.addMember({ id: 'h2', name: 'Bel', classId: 'starseer' });
          H.start();
          H.session.cursorId = H.session.reachableIds[0];
          H.setConnected('h2', false);
          H.session.scene = { kind: 'event', eventId: 'ancientRuneStone', done: {} };
          H.eventChoice('h1', studyIdx);
          const h2 = H.session.members.get('h2');
          H.session.scene = { kind: 'event', eventId: 'feralShrine', done: {} };
          H.eventChoice('h1', fightIdx);
          H.eventContinue('h1');
          const inFight = H.scene.kind === 'combat';
          H.setConnected('h2', true);
          const heldOut = inFight && !H.live.combat.players.has('h2') && H.connectedMembers().some((m) => m.id === 'h2');
          const maxBefore = h2.run.maxHp;
          const r1 = H.resolveCatchup('h2', 0, { choiceIndex: studyIdx });
          const r2 = h2.catchup.length ? H.resolveCatchup('h2', 0, { choiceIndex: 0 }) : { ok: true };
          const P2 = H.live && H.live.combat.players.get('h2');
          ok(inFight && heldOut && r1.ok && r2.ok && h2.catchup.length === 0 && P2 && P2.entity.maxHp === h2.run.maxHp && h2.run.maxHp < maxBefore,
            `a seat returning mid-fight is held out of it while its queue stands (held out ${heldOut}) and joins once it drains, with the replay's max HP (${maxBefore} -> ${h2.run.maxHp}; body ${P2 && P2.entity.maxHp})`);
        }
        // A LETHAL REPLAY ENDS A PARTY WITH NOBODY LEFT (Codex on #548).
        {
          const avatar = REG.events.get('goldboughAvatar');
          const hurtIdx = avatar.choices.findIndex((c) => (c.effects || []).some((e) => e.op === 'damage' && e.target === 'self'));
          const leaveIdx = avatar.choices.findIndex((c) => !(c.effects || []).length);
          const L = createSession({ registries: REG, seedString: 'GOLDBOUGH' });
          L.addMember({ id: 'l1', name: 'Ash', classId: 'reaver' });
          L.addMember({ id: 'l2', name: 'Bel', classId: 'starseer' });
          L.start();
          L.session.cursorId = L.session.reachableIds[0];
          L.setConnected('l2', false);
          L.session.scene = { kind: 'event', eventId: 'goldboughAvatar', done: {} };
          L.eventChoice('l1', leaveIdx);
          const l1 = L.session.members.get('l1'), l2 = L.session.members.get('l2');
          l1.run.hp = 0; l1.alive = false; // the last present seat has since fallen
          l2.run.hp = 1;
          L.setConnected('l2', true);
          const r = L.resolveCatchup('l2', 0, { choiceIndex: hurtIdx });
          ok(r.ok && l2.alive === false && l2.run.hp === 0 && L.scene.kind === 'complete' && L.scene.victory === false,
            `a lethal replay fells the last living seat and ends the run (alive ${l2.alive}, hp ${l2.run.hp}, scene ${L.scene.kind}/${L.scene.victory})`);
        }
        // A seat that chose and then dropped owes nothing.
        const D = createSession({ registries: REG, seedString: 'GOLDBOUGH' });
        D.addMember({ id: 'd1', name: 'Ash', classId: 'reaver' });
        D.addMember({ id: 'd2', name: 'Bel', classId: 'starseer' });
        D.start();
        D.session.cursorId = D.session.reachableIds[0];
        D.session.scene = { kind: 'event', eventId: 'ancientRuneStone', done: {} };
        D.eventChoice('d2', smashIdx);
        D.setConnected('d2', false);
        D.eventChoice('d1', smashIdx);
        D.eventContinue('d1');
        ok(D.scene.kind !== 'event' && D.session.members.get('d2').catchup.length === 0, 'a seat that chose and then dropped is not asked again');
      }
      // A DISK RESUME RECONNECTS EVERYONE TOGETHER: a half-answered event
      // restored with two seats must wait on the second seat's choice, not
      // advance after the first seat back (Codex on #547).
      {
        const P = createSession({ registries: REG, seedString: 'GOLDBOUGH' });
        P.addMember({ id: 'p1', name: 'Ash', classId: 'reaver' });
        P.addMember({ id: 'p2', name: 'Bel', classId: 'starseer' });
        P.start();
        P.session.cursorId = P.session.reachableIds[0];
        P.session.scene = { kind: 'event', eventId: 'feralShrine', done: {} };
        const shrine = REG.events.get('feralShrine');
        const calmIdx = shrine.choices.findIndex((c) => !(c.effects || []).some((e) => e.op === 'startCombat'));
        P.eventChoice('p1', calmIdx);
        const Q = restoreSession(REG, P.serialize());
        Q.setConnectedMany(['p1', 'p2'], true);
        const held = Q.scene.kind === 'event' && !!Q.session.scene.done.p1 && !Q.session.scene.done.p2;
        const r2 = Q.eventChoice('p2', calmIdx);
        Q.eventContinue('p1'); Q.eventContinue('p2');
        ok(held && r2.ok && Q.scene.kind !== 'event',
          `a resumed party reconnects together and the half-answered event waits on the second seat (held ${held}, then scene ${Q.scene.kind})`);
      }
      // A CHOICE THAT KILLS fells the seat, and a party with nobody left is over.
      {
        const W = createSession({ registries: REG, seedString: 'GOLDBOUGH' });
        W.addMember({ id: 'w1', name: 'Ash', classId: 'reaver' });
        W.start();
        W.session.cursorId = W.session.reachableIds[0];
        W.session.scene = { kind: 'event', eventId: 'goldboughAvatar', done: {} };
        const avatar = REG.events.get('goldboughAvatar');
        const hurtIdx = avatar.choices.findIndex((c) => (c.effects || []).some((e) => e.op === 'damage' && e.target === 'self'));
        const w1 = W.session.members.get('w1'); w1.run.hp = 1;
        const r = W.eventChoice('w1', hurtIdx);
        ok(r.ok && r.result === 'defeat' && w1.alive === false && w1.run.hp === 0 && W.scene.kind === 'complete' && W.scene.victory === false,
          `a choice that kills fells the seat and ends a party with nobody left (alive=${w1.alive}, hp=${w1.run.hp}, scene ${W.scene.kind}/${W.scene.victory})`);
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
  // THE SEAT'S POISE THRESHOLD reaches the shared fight the way it reaches a
  // solo one: derived from the loadout, relics and tiers, never the engine's
  // zero default.
  {
    const p1m = S.session.members.get('p1');
    const owed = playerPoiseThresholdReceipt(REG, { loadout: p1m.run.loadout, relics: p1m.run.relics, class: p1m.classId, itemUpgradeLevels: p1m.run.itemUpgradeLevels || {} }).value;
    // The entity carries it as its poise METER's max (state.js stampPlayerPoiseMax);
    // an absent meter is the engine's "no vessel" — the zero this fix removes.
    const meter = S.live.combat.players.get('p1').entity.poiseMeter;
    const stamped = meter ? meter.max : null;
    ok(owed > 0 && stamped === owed, `the seat's Poise threshold is stamped on its combat entity (owed ${owed}, meter max ${stamped})`);
  }
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
    else if (sc.kind === 'event') (sc.next ? S.eventContinue('p1') : S.eventChoice('p1', 0));
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
