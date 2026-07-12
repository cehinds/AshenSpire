// tools/session.mjs — server-authoritative co-op run (Tarnished Together S2).
//
// The dungeon lives here, not in any browser. One shared map + RNG; each member
// keeps their own build (deck/relics/hp/gold). The server drives the whole run
// through the SAME pure engine solo play uses (src/engine, src/model) — the
// exact modules tests/runsim already run headless in Node.
//
// Combat is deferred to an injected resolver so this core is testable now and
// S3 can drop interactive shared combat into the same seam:
//   resolver({ enemies, party, hpMult, enemyStatuses }) → { survivors: {id: {hp}}, result }
// In tests the resolver is the naive bot; in play it becomes the live fight.
//
// Presence is the heart of it: members can detach/attach at any node boundary.
// While a member is away, every choice the party resolves for them is logged
// into their `catchup` queue with the exact rolled options, and replayed as a
// series when they return (see resolveCatchup).

import { createRng, seedFromString, seedToString } from '../src/engine/rng.js';
import { createRunState } from '../src/model/state.js';
import { generateActMap } from '../src/engine/mapgen.js';
import {
  rollEncounter, rollRuneReward, rollCardRewardIds, rollFlaskDrop,
  rollRelicReward, resolveUnknownNode, shrineHealAmount,
} from '../src/engine/encounters.js';
import {
  createCoopCombat, coopOutcome, playCard, endTurn, useFlask, joinCombat, leaveCombat,
} from '../src/engine/coopCombat.js';

const LAST_ACT = 3;

/** Co-op enemy HP scaling by live headcount — sub-linear, StS2-flavoured. */
export function coopHpMult(headcount) {
  return 1 + 0.6 * Math.max(0, headcount - 1); // 1p ×1.0, 2p ×1.6, 3p ×2.2, 4p ×2.8
}

/** A deterministic per-member RNG stream, independent of the shared map RNG. */
function memberRng(seed, index) {
  return createRng((seed ^ ((index + 1) * 0x9e3779b1)) >>> 0);
}

export function createSession({ registries, seedString, endless = false }) {
  const seed = safeSeed(seedString);
  const rng = createRng(seed); // shared: map gen, encounter rolls
  const members = new Map(); // id → member
  let order = 0;

  const session = {
    id: `s${(seed % 100000).toString(36)}`,
    seedString: seedToString(seed),
    seed,
    endless,
    actNumber: 1,
    floor: 0,
    mapGraph: null,
    cursorId: null,
    reachableIds: [],
    scene: { kind: 'lobby' },
    started: false,
    members,
  };

  // ---- members -------------------------------------------------------------
  function contentAct() {
    return endless ? ((session.actNumber - 1) % LAST_ACT) + 1 : session.actNumber;
  }
  function loopCount() {
    return endless ? Math.floor((session.actNumber - 1) / LAST_ACT) : 0;
  }

  function addMember({ id, name, classId }) {
    const index = order++;
    const run = createRunState({ seed, classId, registries });
    const m = {
      id,
      name: String(name || 'Tarnished').slice(0, 18),
      index,
      classId,
      connected: true,
      run, // per-member build: deck/relics/flasks/hp/maxHp/runes
      rng: memberRng(seed, index),
      catchup: [], // pending missed-node choices (S4 replay)
      alive: true,
    };
    members.set(id, m);
    return m;
  }

  function setConnected(id, connected) {
    const m = members.get(id);
    if (m) {
      m.connected = !!connected;
      if (live) combatPresence(id, !!connected); // rescale the live fight
    }
    return m;
  }

  function connectedMembers() {
    return [...members.values()].filter((m) => m.connected && m.alive);
  }

  function livingMembers() {
    return [...members.values()].filter((m) => m.alive);
  }

  // ---- run flow ------------------------------------------------------------
  function buildMap() {
    session.mapGraph = generateActMap({ config: registries.mapConfig(contentAct()), rng });
    // Pre-roll unknown nodes so outcomes are seed-determined (like main.js).
    const assigned = [];
    for (const node of Object.values(session.mapGraph.nodes)) {
      if (node.type === 'event') {
        node.resolved = resolveUnknownNode(registries, rng, { seenEvents: assigned });
        if (node.resolved.kind === 'event') assigned.push(node.resolved.eventId);
      }
    }
    session.floor = 0;
    session.cursorId = null;
    session.reachableIds = session.mapGraph.startIds.slice();
    session.scene = { kind: 'map' };
  }

  function start() {
    if (session.started) return;
    session.started = true;
    session.actNumber = 1;
    buildMap();
  }

  function advanceAct() {
    session.actNumber += 1;
    if (!session.endless && session.actNumber > LAST_ACT) {
      session.scene = { kind: 'complete', victory: true };
      return;
    }
    // Full heal between acts for every living member.
    for (const m of livingMembers()) m.run.hp = m.run.maxHp;
    buildMap();
  }

  // A connected member routes the party; first valid pick wins (S5: fork vote).
  function chooseNode(memberId, nodeId) {
    if (session.scene.kind !== 'map') return { ok: false, error: 'not on the map' };
    if (!session.reachableIds.includes(nodeId)) return { ok: false, error: 'node not reachable' };
    const node = session.mapGraph.nodes[nodeId];
    session.cursorId = nodeId;
    session.floor = node.floor;
    return resolveNode(node);
  }

  function resolveNode(node) {
    let kind = node.type;
    if (kind === 'event') {
      const res = node.resolved || { kind: 'event' };
      kind = res.kind === 'event' ? 'event' : res.kind;
    }
    if (kind === 'monster' || kind === 'fight') return enterCombat('normal');
    if (kind === 'elite') return enterCombat('elite');
    if (kind === 'boss') return enterCombat('boss');
    if (kind === 'shrine') return enterShrine();
    if (kind === 'treasure') return enterTreasure();
    if (kind === 'event') return enterEvent(node.resolved.eventId);
    if (kind === 'merchant') { advanceFromNode(); return { ok: true }; } // S5: real shop
    advanceFromNode();
    return { ok: true };
  }

  // After a node fully resolves, open the next choices (or the act boss).
  function advanceFromNode() {
    const node = session.mapGraph.nodes[session.cursorId];
    let next = node.next;
    if (!next || !next.length) next = [session.mapGraph.bossId];
    session.reachableIds = next.slice();
    session.scene = { kind: 'map' };
  }

  // ---- combat (live shared fight via coopCombat) ---------------------------
  let live = null; // { combat, pool } — the running shared fight

  function memberAsPlayer(m) {
    return {
      id: m.id, name: m.name, classId: m.classId,
      maxHp: m.run.maxHp, hp: m.run.hp, deck: m.run.deck,
      relicIds: m.run.relics, flasks: m.run.flasks,
    };
  }

  function enterCombat(pool) {
    const encounterId = rollEncounter(registries, rng, { pool, act: contentAct() });
    const enc = registries.encounters.get(encounterId);
    const loop = loopCount();
    const extraHpMult = 1 + 0.35 * loop; // endless cycle scaling (headcount handled by the runner)
    const combat = createCoopCombat({
      registries, rng,
      players: connectedMembers().map(memberAsPlayer),
      enemyIds: enc.enemies,
      extraHpMult,
      enemyStatuses: loop > 0 ? [{ status: 'strength', stacks: loop }] : [],
    });
    live = { combat, pool };
    session.scene = combatScene();
    return { ok: true, combat: session.scene };
  }

  function combatScene() {
    const c = live.combat;
    return {
      kind: 'combat',
      pool: live.pool,
      phase: c.phase,
      turn: c.turn,
      result: c.result,
      headcount: connectedMembers().length,
      enemies: c.enemies.map((e) => ({ id: e.id, enemyId: e.enemyId, hp: e.hp, maxHp: e.maxHp, block: e.block, intent: e.intent })),
      players: [...c.players.values()].map((P) => ({
        id: P.id, hp: P.entity.hp, maxHp: P.entity.maxHp, block: P.entity.block,
        energy: P.entity.energy, connected: P.connected, alive: P.entity.alive,
        ended: P.ended, hand: P.piles.hand.length,
      })),
    };
  }

  // Route a member's combat intents to the live shared fight.
  function combatPlay(memberId, cardInstanceId, targetId) {
    if (!live) return { ok: false, error: 'no combat' };
    try { playCard(live.combat, memberId, cardInstanceId, targetId); }
    catch (e) { return { ok: false, error: e.message }; }
    return settleCombat();
  }
  function combatEndTurn(memberId) {
    if (!live) return { ok: false, error: 'no combat' };
    try { endTurn(live.combat, memberId); } catch (e) { return { ok: false, error: e.message }; }
    return settleCombat();
  }
  function combatFlask(memberId, slot, targetId) {
    if (!live) return { ok: false, error: 'no combat' };
    try { useFlask(live.combat, memberId, slot, targetId); } catch (e) { return { ok: false, error: e.message }; }
    return settleCombat();
  }

  // Apply the fight's outcome once it ends (StS2 revive: downed players who
  // survive the fight come back next floor at 1 HP).
  function settleCombat() {
    if (!live) return { ok: true };
    const c = live.combat;
    if (!c.result) { session.scene = combatScene(); return { ok: true }; }
    const pool = live.pool;
    const outcome = coopOutcome(c);
    for (const m of livingMembers()) {
      const s = outcome.survivors[m.id];
      if (!s) continue;
      m.run.hp = s.downed ? 0 : Math.max(0, s.hp);
    }
    live = null;
    if (c.result === 'defeat') {
      for (const m of livingMembers()) if (m.run.hp <= 0) m.alive = false;
      if (!livingMembers().length) { session.scene = { kind: 'complete', victory: false }; return { ok: true, result: 'defeat' }; }
    }
    // Victory: revive any downed-but-not-dead members at 1 HP for the next floor.
    for (const m of livingMembers()) if (m.run.hp <= 0) m.run.hp = 1;
    grantRewards(pool);
    if (pool === 'boss') session.scene.afterReward = 'advanceAct';
    return { ok: true, result: c.result };
  }

  // Mid-combat presence: drop removes the player (rescale down); reconnect
  // jumps them back in (rescale up). Called from setConnected during a fight.
  function combatPresence(memberId, connected) {
    if (!live) return;
    if (connected) {
      const m = members.get(memberId);
      if (m) joinCombat(live.combat, memberAsPlayer(m));
    } else {
      leaveCombat(live.combat, memberId);
    }
    settleCombat();
  }

  // Headless convenience: bot-drive the live fight to a result (tests/sims).
  function autoResolveCombat(botTurnFn) {
    if (!live) return { ok: false, error: 'no combat' };
    let guard = 0;
    while (live && live.combat && !live.combat.result && live.combat.phase !== 'suspended' && guard++ < 400) {
      for (const m of connectedMembers()) botTurnFn(live.combat, m.id);
      settleCombat();
    }
    return { ok: true, result: live ? null : 'done' };
  }

  // ---- rewards + catch-up --------------------------------------------------
  function rollRewardFor(m, pool) {
    const cardIds = rollCardRewardIds(registries, m.rng, {
      classId: m.classId, pool, relicIds: m.run.relics,
    });
    const runes = rollRuneReward(registries, m.rng, pool, m.run.relics);
    const flaskId = pool !== 'boss' ? rollFlaskDrop(registries, m.rng, m.run) : null;
    const relicId = pool === 'elite' || pool === 'boss'
      ? rollRelicReward(registries, m.rng, m.run.relics, pool === 'boss' ? { rarities: ['boss'] } : {})
      : null;
    return { pool, cardIds, runes, flaskId, relicId };
  }

  function grantRewards(pool) {
    const pending = {}; // memberId → reward offer (for present members to choose)
    for (const m of livingMembers()) {
      const offer = rollRewardFor(m, pool);
      m.run.runes += offer.runes; // gold is auto-granted; card/relic are choices
      if (m.connected) {
        pending[m.id] = offer;
      } else {
        // Absent: log the choice-point to replay on reconnect.
        m.catchup.push({ type: 'reward', offer, act: session.actNumber, floor: session.floor });
      }
    }
    session.scene = { kind: 'reward', pool, offers: pending, chosen: {}, afterReward: null };
  }

  // A present member takes their card/relic pick (or skips with null).
  function chooseReward(memberId, { cardId = null, takeRelic = false, flask = false } = {}) {
    if (session.scene.kind !== 'reward') return { ok: false, error: 'no reward open' };
    const offer = session.scene.offers[memberId];
    const m = members.get(memberId);
    if (!offer || !m) return { ok: false, error: 'no offer for member' };
    if (cardId && offer.cardIds.includes(cardId)) {
      m.run.deck.push({ instanceId: m.run._idGen ? m.run._idGen() : `rc_${cardId}_${m.run.deck.length}`, cardId, upgraded: false });
    }
    if (takeRelic && offer.relicId && !m.run.relics.includes(offer.relicId)) {
      m.run.relics.push(offer.relicId);
    }
    if (flask && offer.flaskId && m.run.flasks.length < (registries.balance.flaskSlots || 3)) {
      m.run.flasks.push({ flaskId: offer.flaskId });
    }
    session.scene.chosen[memberId] = true;
    // When every present member has chosen, close the reward scene.
    const waiting = Object.keys(session.scene.offers).filter((id) => {
      const mm = members.get(id);
      return mm && mm.connected && !session.scene.chosen[id];
    });
    if (!waiting.length) closeReward();
    return { ok: true };
  }

  function closeReward() {
    const after = session.scene.afterReward;
    if (after === 'advanceAct') advanceAct();
    else advanceFromNode();
  }

  // ---- shrine / treasure / event (per-member, simplified for S2) -----------
  function enterShrine() {
    session.scene = { kind: 'shrine', done: {} };
    return { ok: true };
  }
  function shrineChoice(memberId, choice) {
    if (session.scene.kind !== 'shrine') return { ok: false, error: 'no shrine open' };
    const m = members.get(memberId);
    if (!m) return { ok: false };
    if (choice === 'rest') m.run.hp = Math.min(m.run.maxHp, m.run.hp + shrineHealAmount(registries, m.run));
    else { const c = m.run.deck.find((d) => !d.upgraded); if (c) c.upgraded = true; }
    session.scene.done[memberId] = true;
    const waiting = connectedMembers().filter((mm) => !session.scene.done[mm.id]);
    if (!waiting.length) advanceFromNode();
    return { ok: true };
  }

  function enterTreasure() {
    for (const m of livingMembers()) {
      const relicId = rollRelicReward(registries, m.rng, m.run.relics);
      if (m.connected) {
        if (relicId && !m.run.relics.includes(relicId)) m.run.relics.push(relicId);
      } else {
        m.catchup.push({ type: 'treasure', relicId, act: session.actNumber, floor: session.floor });
      }
    }
    advanceFromNode();
    return { ok: true };
  }

  function enterEvent(eventId) {
    session.scene = { kind: 'event', eventId, done: {} };
    return { ok: true };
  }
  function eventChoice(memberId /*, choiceIndex */) {
    if (session.scene.kind !== 'event') return { ok: false, error: 'no event open' };
    // S5: apply the real event effects per member; S2 records participation.
    session.scene.done[memberId] = true;
    const waiting = connectedMembers().filter((mm) => !session.scene.done[mm.id]);
    if (!waiting.length) advanceFromNode();
    return { ok: true };
  }

  // ---- catch-up replay (S4 foundation) -------------------------------------
  // On reconnect, hand back the member's queued missed choices as a series.
  function resolveCatchup(memberId, index, pick) {
    const m = members.get(memberId);
    if (!m || !m.catchup.length) return { ok: false, error: 'nothing to catch up' };
    const item = m.catchup[index];
    if (!item) return { ok: false, error: 'bad catch-up index' };
    if (item.type === 'reward') {
      const offer = item.offer;
      if (pick && pick.cardId && offer.cardIds.includes(pick.cardId)) {
        m.run.deck.push({ instanceId: `cu_${pick.cardId}_${m.run.deck.length}`, cardId: pick.cardId, upgraded: false });
      }
      if (pick && pick.takeRelic && offer.relicId && !m.run.relics.includes(offer.relicId)) m.run.relics.push(offer.relicId);
      if (pick && pick.flask && offer.flaskId && m.run.flasks.length < (registries.balance.flaskSlots || 3)) m.run.flasks.push({ flaskId: offer.flaskId });
    } else if (item.type === 'treasure') {
      if (pick && pick.takeRelic && item.relicId && !m.run.relics.includes(item.relicId)) m.run.relics.push(item.relicId);
    }
    m.catchup.splice(index, 1);
    return { ok: true, remaining: m.catchup.length };
  }

  // ---- snapshot (authoritative state to broadcast) -------------------------
  function memberView(m) {
    return {
      id: m.id, name: m.name, classId: m.classId, connected: m.connected, alive: m.alive,
      hp: m.run.hp, maxHp: m.run.maxHp, runes: m.run.runes,
      deckSize: m.run.deck.length, relics: m.run.relics.length, flasks: m.run.flasks.length,
      catchup: m.catchup.length,
    };
  }

  function snapshot() {
    return {
      id: session.id,
      seedString: session.seedString,
      actNumber: session.actNumber,
      floor: session.floor,
      endless: session.endless,
      scene: session.scene,
      cursorId: session.cursorId,
      reachableIds: session.reachableIds,
      party: [...members.values()].map(memberView),
    };
  }

  return {
    session,
    addMember, setConnected, connectedMembers, livingMembers,
    start, chooseNode, resolveNode,
    combatPlay, combatEndTurn, combatFlask, autoResolveCombat,
    chooseReward, shrineChoice, eventChoice, resolveCatchup,
    snapshot, contentAct, loopCount,
    get scene() { return session.scene; },
    get live() { return live; },
  };
}

function safeSeed(seedString) {
  try {
    return seedFromString(seedString || 'ERDTREE');
  } catch {
    return seedFromString('ERDTREE');
  }
}
