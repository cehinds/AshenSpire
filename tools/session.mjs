// tools/session.mjs — server-authoritative co-op run (Forsaken Together S2).
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
import { createRunState, initializeRunDerivedStats, initializeRunFlaskCharges, RUN_SCHEMA_VERSION } from '../src/model/state.js';
import { normalizeRunAttributes } from '../src/model/attributes.js';
import { validateRunStartingKit } from '../src/model/startingKits.js';
import { reallocateFlaskCharges } from '../src/model/gracerefill.js';
import { buildActMap } from '../src/engine/actmap.js';
import {
  rollEncounter, rollRuneReward, rollCardRewardIds, rollFlaskDrop,
  rollRelicReward, shrineHealAmount, applyGraceRefill,
} from '../src/engine/encounters.js';
import {
  createCoopCombat, coopOutcome, playCard, endTurn, useFlask, joinCombat, leaveCombat,
} from '../src/engine/coopCombat.js';
import { COOP_CARD_IDS } from '../src/content/cards/coop.js';

// Re-export so tests/other tools share the one definition (no divergent copy).
export { coopHpMult } from '../src/engine/coopCombat.js';

/** A deterministic per-member RNG stream, independent of the shared map RNG. */
function memberRng(seed, index, counters) {
  return createRng((seed ^ ((index + 1) * 0x9e3779b1)) >>> 0, counters || {});
}

// Rebuild a session from a serialize() blob (host disk-resume). Members come
// back disconnected; players re-attach by rejoinId.
export function restoreSession(registries, data) {
  const s = createSession({ registries, seedString: data.seedString, endless: data.endless, restore: data });
  return s;
}

export function createSession({ registries, seedString, endless = false, restore = null, derivedStatOptions = {} }) {
  const LAST_ACT = registries.balance.endless.actsPerCycle; // act count (data)
  const seed = restore ? (restore.seed >>> 0) : seedOf(seedString);
  const rng = createRng(seed, restore ? restore.rng : {}); // shared: map gen, encounter rolls
  const members = new Map(); // id → member
  let order = restore ? restore.order : 0;

  const session = {
    id: `s${(seed % 100000).toString(36)}`,
    seedString: restore ? restore.seedString : seedToString(seed),
    seed,
    endless,
    actNumber: restore ? restore.actNumber : 1,
    floor: restore ? restore.floor : 0,
    mapGraph: restore ? restore.mapGraph : null,
    cursorId: restore ? restore.cursorId : null,
    reachableIds: restore ? restore.reachableIds.slice() : [],
    scene: restore ? restore.scene : { kind: 'lobby' },
    started: restore ? restore.started : false,
    members,
  };

  // Restore members (disconnected until they re-attach by rejoinId).
  if (restore) {
    for (const md of restore.members) {
      if (md.classId !== md.run.class) {
        throw new Error(`Session member '${md.id}' class '${md.classId}' disagrees with run class '${md.run.class}'`);
      }
      normalizeRunAttributes(md.run, registries);
      const discoveredArmaments = [...new Set(md.discoveredArmaments || [])];
      const legacyKit = md.run.schemaVersion === 1;
      validateRunStartingKit(md.run, registries, { discoveredArmaments }, { legacy: legacyKit });
      if (legacyKit) md.run.schemaVersion = RUN_SCHEMA_VERSION;
      initializeRunDerivedStats(md.run, registries, { preserveDeficits: true });
      initializeRunFlaskCharges(md.run, registries);
      members.set(md.id, {
        id: md.id, name: md.name, index: md.index, classId: md.classId, tint: md.tint || 'gold', spriteStyle: md.spriteStyle || 'rendered',
        connected: false, run: md.run, rng: memberRng(seed, md.index, md.rng),
        discoveredArmaments,
        catchup: md.catchup || [], cardSeq: md.cardSeq || 0, alive: md.alive !== false,
      });
    }
  }

  // ---- members -------------------------------------------------------------
  function contentAct() {
    return endless ? ((session.actNumber - 1) % LAST_ACT) + 1 : session.actNumber;
  }
  function loopCount() {
    return endless ? Math.floor((session.actNumber - 1) / LAST_ACT) : 0;
  }

  function addMember({ id, name, classId, tint, spriteStyle, attributeMode = undefined, attributes = undefined, startingKitId = undefined, discoveredArmaments = [] }) {
    const index = order++;
    const entitlement = [...new Set(discoveredArmaments || [])];
    const run = createRunState({ seed, classId, registries, attributeMode, attributes, derivedStatOptions, startingKitId, profileMeta: { discoveredArmaments: entitlement } });
    const m = {
      id,
      name: String(name || 'Forsaken').slice(0, 18),
      index,
      classId,
      connected: true,
      tint: tint || 'gold', // chosen accent — colors this hero's sprite for everyone
      spriteStyle: spriteStyle || 'rendered', // rendered PNG / classic SVG / sigil glyph
      run, // per-member build: deck/relics/flasks/hp/maxHp/cinders
      discoveredArmaments: entitlement,
      rng: memberRng(seed, index),
      catchup: [], // pending missed-node choices (S4 replay)
      cardSeq: 0, // monotonic counter for reward/catch-up card instance ids
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
      if (!connected) maybeResolveVotes(); // a leaver may complete a map vote
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
    // The ONE boot path (#54) — same module main.js and runsim.mjs use;
    // unknowns come back pre-rolled, seed-determined at map birth.
    session.mapGraph = buildActMap(registries, rng, contentAct());
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
    for (const m of livingMembers()) {
      m.run.hp = m.run.maxHp;
      m.run.mana = m.run.maxMana;
    }
    buildMap();
  }

  // Fork voting (StS2): with 2+ present members, each casts (and may change) a
  // vote for a reachable node; the party moves once everyone present has voted.
  // Majority wins; ties break toward the earliest-joined voter (the host).
  // Solo — or a party reduced to one by disconnects — routes instantly.
  function chooseNode(memberId, nodeId) {
    if (session.scene.kind !== 'map') return { ok: false, error: 'not on the map' };
    if (!session.reachableIds.includes(nodeId)) return { ok: false, error: 'node not reachable' };
    const voters = connectedMembers();
    if (voters.length > 1) {
      if (!session.scene.votes) session.scene.votes = {};
      session.scene.votes[memberId] = nodeId;
      const waiting = voters.filter((m) => !session.scene.votes[m.id]);
      if (waiting.length) return { ok: true, waiting: waiting.length };
      nodeId = tallyVotes(session.scene.votes, voters);
    }
    return travelTo(nodeId);
  }

  function tallyVotes(votes, voters) {
    const counts = {};
    for (const m of voters) {
      const v = votes[m.id];
      if (v) counts[v] = (counts[v] || 0) + 1;
    }
    let best = null;
    let bestN = -1;
    for (const m of [...voters].sort((a, b) => a.index - b.index)) {
      const v = votes[m.id];
      if (v && counts[v] > bestN) { best = v; bestN = counts[v]; }
    }
    return best;
  }

  // A disconnect during a vote can leave everyone-remaining already voted.
  function maybeResolveVotes() {
    if (session.scene.kind !== 'map' || !session.scene.votes) return;
    const voters = connectedMembers();
    if (!voters.length) return;
    const waiting = voters.filter((m) => !session.scene.votes[m.id]);
    if (!waiting.length) travelTo(tallyVotes(session.scene.votes, voters));
  }

  function travelTo(nodeId) {
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
      maxMana: m.run.maxMana, mana: m.run.mana,
      maxStamina: m.run.maxStamina, stamina: m.run.stamina,
      energyMax: m.run.energyMax, drawPerTurn: m.run.drawPerTurn,
      startingKitId: m.run.startingKitId,
      derivedStatRuleSnapshot: structuredClone(m.run.derivedStatRuleSnapshot),
      attributeMode: m.run.attributeMode, attributes: { ...m.run.attributes },
      relicIds: m.run.relics, flasks: m.run.flasks, flaskCharges: m.run.flaskCharges,
    };
  }

  function enterCombat(pool) {
    const encounterId = rollEncounter(registries, rng, { pool, act: contentAct() });
    const enc = registries.encounters.get(encounterId);
    const loop = loopCount();
    const extraHpMult = 1 + registries.balance.endless.hpPerLoop * loop; // endless cycle scaling (headcount handled by the runner)
    const combat = createCoopCombat({
      registries, rng,
      players: connectedMembers().map(memberAsPlayer),
      enemyIds: enc.enemies,
      extraHpMult,
      enemyStatuses: loop > 0 ? [{ status: 'strength', stacks: registries.balance.endless.strPerLoop * loop }] : [],
    });
    live = { combat, pool, evCursor: combat.eventLog.length }; // skip setup events
    session.scene = combatScene();
    return { ok: true, combat: session.scene };
  }

  function combatScene() {
    const c = live.combat;
    // Compact digest of display-worthy events since the LAST snapshot, so the
    // client can pace the enemy phase (banner + per-enemy lunges) without a
    // full timeline protocol. The cursor advances with each snapshot build.
    const events = c.eventLog.slice(live.evCursor || 0)
      .filter((e) => e.type === 'enemyMoveStarted' || e.type === 'enemyDied' || e.type === 'playerDowned')
      .map((e) => ({ type: e.type, sourceId: e.sourceId, enemyId: e.enemyId, moveId: e.moveId, kind: e.kind, targetId: e.targetId, playerId: e.playerId }));
    live.evCursor = c.eventLog.length;
    return {
      kind: 'combat',
      events,
      pool: live.pool,
      phase: c.phase,
      turn: c.turn,
      result: c.result,
      headcount: connectedMembers().length,
      enemies: c.enemies.map((e) => ({
        id: e.id, enemyId: e.enemyId, hp: e.hp, maxHp: e.maxHp, block: e.block,
        alive: e.alive, intent: e.intent, statuses: e.statuses, poiseMeter: e.poiseMeter,
      })),
      players: [...c.players.values()].map((P) => ({
        id: P.id, hp: P.entity.hp, maxHp: P.entity.maxHp, block: P.entity.block,
        mana: P.entity.mana, maxMana: P.entity.maxMana,
        stamina: P.entity.stamina, maxStamina: P.entity.maxStamina,
        attributeMode: P.attributeMode, attributes: { ...P.attributes },
        energy: P.entity.energy, energyMax: P.entity.energyMax,
        drawPerTurn: P.entity.drawPerTurn,
        connected: P.connected, alive: P.entity.alive, ended: P.ended,
        statuses: P.entity.statuses, stanceId: P.entity.stanceId,
        hand: P.piles.hand.map((c2) => ({ instanceId: c2.instanceId, cardId: c2.cardId, upgraded: c2.upgraded })),
        drawCount: P.piles.draw.length, discardCount: P.piles.discard.length,
        flasks: P.entity.flasks, flaskCharges: P.entity.flaskCharges,
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
  function combatFlask(memberId, slot, targetId, chargeKind = null) {
    if (!live) return { ok: false, error: 'no combat' };
    try { useFlask(live.combat, memberId, slot, targetId, chargeKind); } catch (e) { return { ok: false, error: e.message }; }
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
      const P = c.players.get(m.id);
      if (P) {
        m.run.mana = P.entity.mana;
        m.run.stamina = P.entity.stamina;
        m.run.flasks = P.entity.flasks.map((f) => ({ ...f }));
        m.run.flaskCharges = P.entity.flaskCharges ? { ...P.entity.flaskCharges } : null;
      }
    }
    live = null;
    if (c.result === 'defeat') {
      for (const m of livingMembers()) if (m.run.hp <= 0) m.alive = false;
      if (!livingMembers().length) { session.scene = { kind: 'complete', victory: false }; return { ok: true, result: 'defeat' }; }
    }
    // Victory: revive any downed-but-not-dead members at 1 HP for the next floor.
    for (const m of livingMembers()) if (m.run.hp <= 0) m.run.hp = registries.balance.coop.reviveHp;
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
    // Co-op-only cards (StS2): with a real party, every combat reward carries
    // one team-play option on top of the normal class picks.
    if (livingMembers().length > 1) {
      cardIds.push(m.rng.pick('cardRewards', COOP_CARD_IDS));
    }
    const cinders = rollRuneReward(registries, m.rng, pool, m.run.relics);
    const flaskId = pool !== 'boss' ? rollFlaskDrop(registries, m.rng, m.run) : null;
    const relicId = pool === 'elite' || pool === 'boss'
      ? rollRelicReward(registries, m.rng, m.run.relics, pool === 'boss' ? { rarities: ['boss'] } : {})
      : null;
    return { pool, cardIds, cinders, flaskId, relicId };
  }

  function grantRewards(pool) {
    const pending = {}; // memberId → reward offer (for present members to choose)
    for (const m of livingMembers()) {
      const offer = rollRewardFor(m, pool);
      m.run.cinders += offer.cinders; // gold is auto-granted; card/relic are choices
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
      m.run.deck.push({ instanceId: `m${m.index}c${m.cardSeq++}`, cardId, upgraded: false });
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
    // "at every grace ALL CHARACTERS should restore 3 hp flasks" — his word,
    // and in co-op "all characters" is the party, not whoever taps first. Every
    // LIVING member is refilled on arrival, connected or not: a member who is
    // away does not lose a grace they were standing at, and the top-up is
    // idempotent so their catchup queue has nothing to replay.
    //
    // No settings override here on purpose. The server is authoritative and has
    // no browser to read `meta.settings` from; the counts are the authored
    // table. A per-session override is a lobby setting and a separate subject.
    for (const m of livingMembers()) applyGraceRefill(registries, m.run);
    session.scene = { kind: 'shrine', done: {} };
    return { ok: true };
  }
  function shrineChoice(memberId, choice, targetId) {
    if (session.scene.kind !== 'shrine') return { ok: false, error: 'no shrine open' };
    const m = members.get(memberId);
    if (!m) return { ok: false };
    if (choice === 'reallocate') {
      reallocateFlaskCharges(m.run.flaskCharges, targetId || {});
      return { ok: true, allocation: { ...m.run.flaskCharges } };
    } else if (choice === 'rest') {
      m.run.hp = Math.min(m.run.maxHp, m.run.hp + shrineHealAmount(registries, m.run));
      m.run.mana = m.run.maxMana;
    } else if (choice === 'mend') {
      // Co-op Mend: heal an ally for 30% of their max HP instead of resting.
      const ally = members.get(targetId);
      if (!ally || !ally.alive) return { ok: false, error: 'no such ally' };
      ally.run.hp = Math.min(ally.run.maxHp, ally.run.hp + Math.ceil(ally.run.maxHp * (registries.balance.coop.mendHealPct / 100)));
    } else {
      // Smith: the chosen card if given (validated), else first unupgraded.
      const c = (targetId && m.run.deck.find((d) => d.instanceId === targetId && !d.upgraded))
        || m.run.deck.find((d) => !d.upgraded);
      if (c) c.upgraded = true;
    }
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
        m.run.deck.push({ instanceId: `m${m.index}c${m.cardSeq++}`, cardId: pick.cardId, upgraded: false });
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
      id: m.id, name: m.name, classId: m.classId, tint: m.tint, spriteStyle: m.spriteStyle, connected: m.connected, alive: m.alive,
      startingKitId: m.run.startingKitId,
      hp: m.run.hp, maxHp: m.run.maxHp, cinders: m.run.cinders,
      mana: m.run.mana, maxMana: m.run.maxMana,
      stamina: m.run.stamina, maxStamina: m.run.maxStamina,
      energyMax: m.run.energyMax, drawPerTurn: m.run.drawPerTurn,
      derivedStatRuleSnapshot: structuredClone(m.run.derivedStatRuleSnapshot),
      attributeMode: m.run.attributeMode, attributes: { ...m.run.attributes },
      deck: m.run.deck.map((c) => ({ instanceId: c.instanceId, cardId: c.cardId, upgraded: c.upgraded })),
      deckSize: m.run.deck.length, relics: m.run.relics.length, flasks: m.run.flasks.length,
      flaskCharges: structuredClone(m.run.flaskCharges),
      catchup: m.catchup.length,
      catchupQueue: m.catchup, // rolled options for the reconnect series
    };
  }

  // Serialize the run to plain JSON for host disk-resume. Returns null during a
  // live fight (combat is not persisted; resume lands at the pre-combat node).
  function serialize() {
    if (live || session.scene.kind === 'combat') return null;
    return {
      v: 1,
      seed: session.seed,
      seedString: session.seedString,
      endless: session.endless,
      actNumber: session.actNumber,
      floor: session.floor,
      cursorId: session.cursorId,
      reachableIds: session.reachableIds.slice(),
      scene: session.scene,
      started: session.started,
      mapGraph: session.mapGraph,
      rng: rng.getCounters(),
      order,
      members: [...members.values()].map((m) => ({
        id: m.id, name: m.name, index: m.index, classId: m.classId, tint: m.tint, spriteStyle: m.spriteStyle, alive: m.alive,
        run: m.run, discoveredArmaments: [...m.discoveredArmaments], catchup: m.catchup, cardSeq: m.cardSeq, rng: m.rng.getCounters(),
      })),
    };
  }

  function snapshot() {
    const g = session.mapGraph;
    const nodeType = (n) => (n.type === 'event' ? 'unknown' : n.type);
    const reachableNodes = g
      ? session.reachableIds.map((id) => { const n = g.nodes[id]; return { id, type: nodeType(n), floor: n.floor }; })
      : [];
    // Full graph so the client can draw the real SVG node map (parity with solo).
    const map = g
      ? {
          floors: g.floors,
          // `columns` TRAVELS WITH THE GRAPH, and the client has been asking for
          // it since the act-map view stopped hardcoding 7. This producer never
          // sent it, so every real co-op session fell through the client's
          // derived-width fallback while `?shot=coopmap` handed it a canned
          // snapshot that DID carry the field — the harness was green about a
          // value the host had never sent. One field, one home.
          columns: g.columns,
          startIds: g.startIds,
          bossId: g.bossId,
          nodes: Object.values(g.nodes).map((n) => ({ id: n.id, type: nodeType(n), floor: n.floor, col: n.col, next: n.next })),
        }
      : null;
    return {
      id: session.id,
      seedString: session.seedString,
      actNumber: session.actNumber,
      floor: session.floor,
      endless: session.endless,
      scene: session.scene,
      cursorId: session.cursorId,
      reachableIds: session.reachableIds,
      reachableNodes,
      map,
      party: [...members.values()].map(memberView),
    };
  }

  return {
    session,
    addMember, setConnected, connectedMembers, livingMembers,
    start, chooseNode, resolveNode,
    combatPlay, combatEndTurn, combatFlask, autoResolveCombat,
    chooseReward, shrineChoice, eventChoice, resolveCatchup,
    snapshot, serialize, contentAct, loopCount,
    get scene() { return session.scene; },
    get live() { return live; },
  };
}

// THE SECOND COPY OF main.js's CATCH, and it failed the other way round.
// It read:
//
//     try  { return seedFromString(seedString || 'GOLDBOUGH'); }
//     catch { return seedFromString('GOLDBOUGH'); }
//
// so a host who typed `MY-SEED` in the lobby did not get a fresh random map
// like the solo screens — every unusable seed produced the SAME climb, the
// GOLDBOUGH one, while the roster went on displaying what the host typed.
// Two different typed seeds, one identical run: the same law broken from the
// other side, and worse, because it looks reproducible.
//
// No catch, and no substitution. `GOLDBOUGH` survives only as the DEFAULT for
// an ABSENT seed, which is a different act from replacing a wrong one. A bad
// seed throws here and is refused at the boundary it came through
// (tools/lan.mjs, the `seed` message), so this line is now unreachable from a
// conforming client and says so loudly when it is not.
function seedOf(seedString) {
  return seedFromString(seedString || 'GOLDBOUGH');
}
