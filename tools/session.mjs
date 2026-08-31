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
import { createRunState, initializeRunDerivedStats, initializeRunFlaskCharges, migrateRunSchema } from '../src/model/state.js';
import { normalizeRunAttributes } from '../src/model/attributes.js';
import { validateRunStartingKit } from '../src/model/startingKits.js';
import { stampDeck } from '../src/model/loadout.js';
import {
  commitSmithing, grantSmithingReward, initializeRunSmithing, smithingPlan,
} from '../src/model/smithing.js';
import { flaskSlotCap, reallocateFlaskCharges } from '../src/model/gracerefill.js';
import { buildActMap } from '../src/engine/actmap.js';
import {
  rollEncounter, rollRuneReward, rollCardRewardIds, rollFlaskDrop,
  rollRelicReward, shrineHealAmount, applyGraceRefill,
} from '../src/engine/encounters.js';
import {
  createCoopCombat, coopOutcome, playCard, endTurn, useFlask, joinCombat, leaveCombat,
} from '../src/engine/coopCombat.js';
import { applyStatus } from '../src/engine/statuses.js';
import { COOP_CARD_IDS } from '../src/content/cards/coop.js';

// Focused browser gates may establish only the starting HP/Block named by the
// story before driving the real LAN intent/event/render path. Keep that setup
// out of the socket protocol and out of the product snapshot: the tool that
// owns the gate opts in inside the same launcher process, and normal launchers
// never call this setter.
let combatStartStateForTools = null;
export function setCombatStartStateForTools(state = null) {
  const badExtraHand = state?.extraHand != null
    && (!Array.isArray(state.extraHand) || state.extraHand.some((id) => typeof id !== 'string'));
  const badNextDraw = state?.nextDraw != null
    && (!Array.isArray(state.nextDraw) || state.nextDraw.some((id) => typeof id !== 'string'));
  const badFlasks = state?.flasks != null
    && (!Array.isArray(state.flasks) || state.flasks.some((id) => typeof id !== 'string'));
  const badRelicIds = state?.relicIds != null
    && (!Array.isArray(state.relicIds) || state.relicIds.some((id) => typeof id !== 'string'));
  const badPlayerStatuses = state?.playerStatuses != null
    && (!Array.isArray(state.playerStatuses) || state.playerStatuses.some((row) => typeof row?.id !== 'string' || !Number.isFinite(row?.stacks)));
  const badAlly = state?.ally != null && (typeof state.ally !== 'object'
    || typeof state.ally.name !== 'string' || !Number.isFinite(state.ally.hp) || !Number.isFinite(state.ally.block)
    || (state.ally.extraHand != null && (!Array.isArray(state.ally.extraHand)
      || state.ally.extraHand.some((id) => typeof id !== 'string'))));
  const badEnemy = state?.enemy != null && (typeof state.enemy !== 'object'
    || (state.enemy.hp != null && !Number.isFinite(state.enemy.hp))
    || (state.enemy.statuses != null && (!Array.isArray(state.enemy.statuses)
      || state.enemy.statuses.some((row) => typeof row?.id !== 'string' || !Number.isFinite(row?.stacks)))));
  if (state !== null && (typeof state !== 'object' || typeof state.name !== 'string'
      || !Number.isFinite(state.hp) || !Number.isFinite(state.block) || badExtraHand || badNextDraw || badFlasks || badRelicIds || badPlayerStatuses || badAlly || badEnemy)) {
    throw new Error('Tool combat start state requires { name, hp, block, extraHand?: string[], nextDraw?: string[], flasks?: string[], relicIds?: string[], playerStatuses?: { id, stacks }[], ally?: { name, hp, block, extraHand?: string[] }, enemy?: { hp?, statuses? } }');
  }
  combatStartStateForTools = state ? structuredClone(state) : null;
}

// Re-export so tests/other tools share the one definition (no divergent copy).
export { coopHpMult } from '../src/engine/coopCombat.js';

/** A deterministic per-member RNG stream, independent of the shared map RNG. */
function memberRng(seed, index, counters) {
  return createRng((seed ^ ((index + 1) * 0x9e3779b1)) >>> 0, counters || {});
}

// Rebuild a session from a serialize() blob (host disk-resume). Members come
// back disconnected; players re-attach by rejoinId.
//
// BLAST RADIUS IS ONE MEMBER, NOT THE PARTY (Viki's #163 gate, note 1). A
// member whose record fails the door — the both-names refusal, a class/run
// contradiction, corrupt bytes, whatever — is refused BY NAME WITH THE REASON
// and set aside; the healthy members restore. The receipt surfaces in
// snapshot() (every client sees who fell out and why), the ORIGINAL bytes ride
// serialize() back out unchanged (the evidence-kept house rule: a save cycle
// after a partial restore must not destroy the one copy a human or a future
// migration could still read), and the next restore re-attempts them. The one
// refusal that stays whole: a blob where NO member survives — a party of
// nobody is not a resume, and pretending it resumed would be the silent
// version of the same loss.
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

  // PER-MEMBER RESTORE REFUSALS — the receipts. Each holds the member's
  // identity as far as the record states it, the refusal reason, and `member`:
  // a pristine clone of the ORIGINAL record, kept so serialize() can write the
  // evidence bytes back out untouched (see restoreSession's header).
  const refused = [];

  // Restore members (disconnected until they re-attach by rejoinId).
  // `refusedMembers` records from an earlier partial restore are RE-ATTEMPTED
  // through the same door: a save refused for vocabulary the content has since
  // learned to heal comes back on its own; one still poisoned lands back in
  // the receipts, evidence intact.
  if (restore) {
    const records = [...restore.members, ...(restore.refusedMembers || [])];
    for (let i = 0; i < records.length; i++) {
      const orig = records[i];
      try {
        // THE DOOR WORKS ON ITS OWN CLONE. normalizeRunAttributes and the kit/
        // derived-stat initializers heal IN PLACE, and at the old whole-party
        // door that meant a refusal mid-roster left the CALLER'S parsed blob
        // half-healed (Viki's #163 note 2) — earlier members migrated, later
        // ones untouched, and a host that re-serialized it would have written
        // a half-migrated save. The caller's object is evidence, never
        // scratch; everything below mutates this clone only.
        const md = structuredClone(orig);
        if (!md || typeof md !== 'object' || !md.run || typeof md.run !== 'object') {
          throw new Error('member record does not carry a run');
        }
        if (typeof md.id !== 'string' || !md.id) throw new Error('member record has no id');
        if (md.classId !== md.run.class) {
          throw new Error(`Session member '${md.id}' class '${md.classId}' disagrees with run class '${md.run.class}'`);
        }
        const legacyKit = md.run.schemaVersion === 1;
        migrateRunSchema(md.run);
        normalizeRunAttributes(md.run, registries);
        const discoveredArmaments = [...new Set(md.discoveredArmaments || [])];
        validateRunStartingKit(md.run, registries, { discoveredArmaments }, { legacy: legacyKit });
        initializeRunDerivedStats(md.run, registries, { preserveDeficits: true });
        initializeRunSmithing(registries, md.run);
        stampDeck(registries, md.run, undefined, { adoptEquipmentBonuses: false, reconcileEquipmentPools: false });
        initializeRunFlaskCharges(md.run, registries);
        delete md.run.migratedFromRunSchemaVersion;
        members.set(md.id, {
          id: md.id, name: md.name, index: md.index, classId: md.classId, tint: md.tint || 'gold', spriteStyle: md.spriteStyle || 'rendered',
          connected: false, run: md.run, rng: memberRng(seed, md.index, md.rng),
          discoveredArmaments,
          catchup: md.catchup || [], cardSeq: md.cardSeq || 0, alive: md.alive !== false,
        });
      } catch (e) {
        const has = (k, t) => orig && typeof orig === 'object' && typeof orig[k] === t;
        refused.push({
          id: has('id', 'string') && orig.id ? orig.id : `<member ${i}>`,
          name: has('name', 'string') ? orig.name : null,
          index: has('index', 'number') ? orig.index : null,
          reason: e.message,
          member: structuredClone(orig),
        });
      }
    }
    // A restore that saves NOBODY is refused whole, every member named with
    // their reason — this is the all-poisoned edge, and it must stay loud.
    if (records.length && !members.size) {
      throw new Error('Session restore refused: no member survived the door — '
        + refused.map((r) => `'${r.id}': ${r.reason}`).join(' · '));
    }
    // Shrine plans are host projections of the migrated member runs, not
    // trusted serialized client-facing bytes. Rebuild them on restore so an
    // older saved Shrine cannot disable Smithing after the run itself heals.
    if (session.scene?.kind === 'shrine') {
      session.scene = {
        ...session.scene,
        done: { ...(session.scene.done || {}) },
        smithing: Object.fromEntries([...members.values()]
          .filter((member) => member.alive)
          .map((member) => [member.id, smithingPlan(registries, member.run)])),
        receipts: {
          ...(session.scene.receipts || {}),
          ...Object.fromEntries([...members.values()]
            .filter((member) => member.run.lastSmithingReceipt)
            .map((member) => [member.id, structuredClone(member.run.lastSmithingReceipt)])),
        },
      };
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
  let combatReceiptSeq = 0; // stable wire identity; resync reuses session.scene

  function memberAsPlayer(m) {
    return {
      id: m.id, name: m.name, classId: m.classId,
      maxHp: m.run.maxHp, hp: m.run.hp, deck: m.run.deck,
      maxMana: m.run.maxMana, mana: m.run.mana,
      maxStamina: m.run.maxStamina, stamina: m.run.stamina,
      energyMax: m.run.energyMax, drawPerTurn: m.run.drawPerTurn,
      startingKitId: m.run.startingKitId,
      derivedStatRuleSnapshot: structuredClone(m.run.derivedStatRuleSnapshot),
      damageBySchoolAdd: { ...m.run.damageBySchoolAdd },
      attributeMode: m.run.attributeMode, attributes: { ...m.run.attributes },
      relicIds: m.run.relics, flasks: m.run.flasks, flaskCharges: m.run.flaskCharges,
      itemUpgradeLevels: { ...(m.run.itemUpgradeLevels || {}) },
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
    // Co-op player entities intentionally share the engine id `player`; the
    // active seat key is the authoritative discriminator. Stamp it at emission
    // time, while that discriminator is still exact, rather than asking the UI
    // to infer a target later from HP or block deltas.
    const emit = combat.emit;
    combat.emit = (type, payload = {}) => emit(type,
      (type === 'damageDealt' || type === 'hpLost' || type === 'healed') && payload.targetId === 'player'
        ? { ...payload, playerId: payload.playerId ?? combat.playerKey }
        : payload);
    if (combatStartStateForTools) {
      const member = connectedMembers().find((entry) => entry.name === combatStartStateForTools.name);
      const player = member ? combat.players.get(member.id) : null;
      const entity = player?.entity;
      if (!entity) throw new Error(`Tool combat start state cannot find '${combatStartStateForTools.name}'`);
      entity.hp = combatStartStateForTools.hp;
      entity.block = combatStartStateForTools.block;
      if (combatStartStateForTools.flasks) {
        entity.flasks = combatStartStateForTools.flasks.map((flaskId) => ({ flaskId }));
      }
      if (combatStartStateForTools.relicIds) {
        entity.relicIds = [...combatStartStateForTools.relicIds];
      }
      if (combatStartStateForTools.ally) {
        const allyMember = connectedMembers().find((entry) => entry.name === combatStartStateForTools.ally.name);
        const allyPlayer = allyMember ? combat.players.get(allyMember.id) : null;
        const ally = allyPlayer?.entity;
        if (!ally) throw new Error(`Tool combat start state cannot find ally '${combatStartStateForTools.ally.name}'`);
        ally.hp = combatStartStateForTools.ally.hp;
        ally.block = combatStartStateForTools.ally.block;
        if (combatStartStateForTools.ally.extraHand) {
          allyPlayer.piles.hand.push(...combatStartStateForTools.ally.extraHand.map((cardId, index) => ({
            instanceId: `tool-ally-extra-${index + 1}`,
            cardId,
            upgraded: false,
          })));
        }
      }
      for (const row of combatStartStateForTools.playerStatuses || []) {
        applyStatus(combat, entity, row.id, row.stacks, entity);
      }
      if (combatStartStateForTools.extraHand) {
        player.piles.hand.push(...combatStartStateForTools.extraHand.map((cardId, index) => ({
          instanceId: `tool-extra-${index + 1}`,
          cardId,
          upgraded: false,
        })));
      }
      if (combatStartStateForTools.nextDraw) {
        player.piles.draw.unshift(...combatStartStateForTools.nextDraw.map((cardId, index) => ({
          instanceId: `tool-next-${index + 1}`,
          cardId,
          upgraded: false,
        })));
      }
      const enemy = combat.enemies.find((entry) => entry.alive);
      if (enemy && combatStartStateForTools.enemy) {
        if (Number.isFinite(combatStartStateForTools.enemy.hp)) enemy.hp = combatStartStateForTools.enemy.hp;
        for (const row of combatStartStateForTools.enemy.statuses || []) {
          applyStatus(combat, enemy, row.id, row.stacks, entity);
        }
      }
    }
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
      .filter((e) => ['enemyMoveStarted', 'damageDealt', 'healed', 'enemyDied', 'playerDowned', 'arcaneExposureChanged', 'arcaneExposureRefused', 'arcaneBreak'].includes(e.type)
        || (e.type === 'hpLost' && e.cause !== 'attack'))
      .map((e) => ({
        type: e.type, sourceId: e.sourceId, enemyId: e.enemyId, moveId: e.moveId,
        kind: e.kind, targetId: e.targetId, playerId: e.playerId,
        reason: e.reason, school: e.school, amount: e.amount, value: e.value,
        blocked: e.blocked, isAttack: e.isAttack, cause: e.cause,
        requested: e.requested, attempted: e.attempted,
        threshold: e.threshold, status: e.status, duration: e.duration,
      }));
    live.evCursor = c.eventLog.length;
    return {
      kind: 'combat',
      receiptSeq: ++combatReceiptSeq,
      events,
      pool: live.pool,
      phase: c.phase,
      turn: c.turn,
      result: c.result,
      headcount: connectedMembers().length,
      enemies: c.enemies.map((e) => ({
        id: e.id, enemyId: e.enemyId, hp: e.hp, maxHp: e.maxHp, block: e.block,
        alive: e.alive, intent: e.intent, statuses: e.statuses, poiseMeter: e.poiseMeter,
        arcaneExposure: e.arcaneExposure ? structuredClone(e.arcaneExposure) : undefined,
        damageResistanceBySchool: e.damageResistanceBySchool ? { ...e.damageResistanceBySchool } : undefined,
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
        relicIds: [...P.entity.relicIds],
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

  // The host is the only authority that turns a client's explicit menu action
  // into combat mutation. Inspect/cancel never cross this boundary.
  function flaskIntent(memberId, intent = {}) {
    if (!intent || intent.action !== 'use') return { ok: false, error: 'host refused unsupported flask intent' };
    const slot = Number.isInteger(intent.slot) ? intent.slot : null;
    const chargeKind = intent.chargeKind === 'hp' || intent.chargeKind === 'mana' ? intent.chargeKind : null;
    if (slot == null && chargeKind == null) return { ok: false, error: 'host refused flask intent without a slot or charge kind' };
    return combatFlask(memberId, slot, intent.targetId, chargeKind);
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
      offer.smithingStoneReceipt = grantSmithingReward(
        registries,
        m.run,
        pool,
        `coop:${session.actNumber}:${session.floor}:${pool}:${m.id}`,
      );
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
    if (flask && offer.flaskId && m.run.flasks.length < flaskSlotCap(registries.balance)) {
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
    // At every Grace, every character refills their fixed-capacity allocation.
    // In co-op the host owns that truth, not whichever client taps first. Every
    // LIVING member is refilled on arrival, connected or not: a member who is
    // away does not lose a grace they were standing at, and the top-up is
    // idempotent so their catchup queue has nothing to replay.
    //
    // No settings override here on purpose. The server is authoritative and has
    // no browser to read `meta.settings` from; the counts are the authored
    // table. A per-session override is a lobby setting and a separate subject.
    for (const m of livingMembers()) applyGraceRefill(registries, m.run);
    session.scene = {
      kind: 'shrine',
      done: {},
      smithing: Object.fromEntries(livingMembers().map((m) => [m.id, smithingPlan(registries, m.run)])),
      receipts: {},
    };
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
    } else if (choice === 'smith') {
      // The client sends intent only. The host rebuilds the plan, validates the
      // armament id, spends the purse, mutates every sourced basic, and places
      // the durable receipt in the next broadcast snapshot.
      try {
        const receipt = commitSmithing(registries, m.run, targetId);
        session.scene.receipts[memberId] = receipt;
        session.scene.smithing[memberId] = smithingPlan(registries, m.run);
      } catch (error) {
        return { ok: false, error: error?.message || 'Smithing refused' };
      }
    } else {
      return { ok: false, error: `unknown shrine choice '${choice}'` };
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
      if (pick && pick.flask && offer.flaskId && m.run.flasks.length < flaskSlotCap(registries.balance)) m.run.flasks.push({ flaskId: offer.flaskId });
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
      smithingStones: m.run.smithingStones,
      itemUpgradeLevels: { ...(m.run.itemUpgradeLevels || {}) },
      ...(m.run.lastSmithingReceipt
        ? { lastSmithingReceipt: structuredClone(m.run.lastSmithingReceipt) }
        : {}),
      mana: m.run.mana, maxMana: m.run.maxMana,
      stamina: m.run.stamina, maxStamina: m.run.maxStamina,
      energyMax: m.run.energyMax, drawPerTurn: m.run.drawPerTurn,
      derivedStatRuleSnapshot: structuredClone(m.run.derivedStatRuleSnapshot),
      attributeMode: m.run.attributeMode, attributes: { ...m.run.attributes },
      deck: m.run.deck.map((c) => ({
        instanceId: c.instanceId,
        cardId: c.cardId,
        upgraded: c.upgraded,
        ...(c.equipmentRole ? { equipmentRole: c.equipmentRole } : {}),
        ...(c.profileId ? { profileId: c.profileId } : {}),
        ...(Array.isArray(c.mods) ? { mods: [...c.mods] } : {}),
        ...(c.sourceArmamentId ? { sourceArmamentId: c.sourceArmamentId } : {}),
        ...(Number.isInteger(c.smithingLevel) ? { smithingLevel: c.smithingLevel } : {}),
      })),
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
      // THE EVIDENCE BYTES, byte-equal to what came in. A refused member's
      // original record rides every save the host writes after a partial
      // restore, so the refusal never becomes a deletion; the next
      // restoreSession re-attempts these through the same door.
      refusedMembers: refused.map((r) => structuredClone(r.member)),
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
      // The receipts, for every client to draw: who fell out of the restore
      // and why. Identity + reason only — the evidence bytes stay host-side,
      // in serialize().
      refusedMembers: refused.map((r) => ({ id: r.id, name: r.name, reason: r.reason })),
    };
  }

  return {
    session,
    /** The restore receipts: [{ id, name, index, reason }] — never the bytes. */
    refusedMembers: () => refused.map((r) => ({ id: r.id, name: r.name, index: r.index, reason: r.reason })),
    addMember, setConnected, connectedMembers, livingMembers,
    start, chooseNode, resolveNode,
    combatPlay, combatEndTurn, flaskIntent, autoResolveCombat,
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
