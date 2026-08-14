// tools/coop-restore-isolation.mjs — ONE POISONED MEMBER FAILS WITH A RECEIPT;
// THE PARTY RESTORES. (Viki's #163 gate, named note 1: "one both-names member
// aborts the WHOLE session restore — both members down, host blob unharmed on
// disk. A party-sized refusal for one member's save is a card for Rune's
// server seat.")
//
// THE CONTRACT THIS ASSERTS, and it is the design, not a description of dev:
//
//   1. A restore blob with ONE poisoned member restores the HEALTHY members.
//      The poisoned member is refused BY NAME, WITH THE REASON — the same
//      refusal text the old whole-party throw carried, now a receipt instead
//      of a detonation.
//   2. THE EVIDENCE BYTES ARE KEPT (house rule; the same rule Vira's solo door
//      answers with the archive drawer). The refused member's ORIGINAL record
//      rides the session: serialize() writes it back out byte-equal, so a
//      host that saves after a partial restore never destroys the one copy of
//      the save that needs a human (or a migration) to look at it. The next
//      restore RE-ATTEMPTS it — a save refused for a vocabulary the content
//      later learns to heal comes back on its own.
//   3. THE CALLER'S PARSED BLOB IS NEVER TOUCHED — refused or clean. Viki's
//      named note 2: at dev the refusal path half-heals the in-memory blob
//      before throwing (members healed in order, snapshot sourceStats
//      rewritten, THEN the refusal), so a caller that re-serialized a refused
//      blob would write a half-migrated one. The door works on its own clone
//      now; the caller's object is evidence, not scratch.
//   4. BOTH EDGES. All-healthy: byte-for-byte the restore we already ship,
//      zero receipts. All-poisoned: still refuses WHOLE, loudly, every member
//      named with their reason — a "session" that restores nobody is not a
//      party, and pretending it resumed would be the silent version of the
//      same loss.
//
// THE DOOR (the instrument rule's same-door clause): every known-bad below is
// built by POISONING PRISTINE DISK BYTES — JSON.parse of the string the real
// serialize() produced — and enters through restoreSession(), the exact stages
// the host resume path walks (tools/lan.mjs: readFile → JSON.parse →
// restoreSession). NEVER by mutating an object the door has already touched:
// createSession HEALS IN PLACE, so poison written onto a once-restored object
// is poison written onto healed vocabulary — Viki watched her own plant go
// false-red exactly that way (her 2026-08-14 gate log), and this file is
// downstream of that lesson.
//
//   node tools/coop-restore-isolation.mjs
//
// Exit 0: every check held. Exit 1: a failure. Boundary: node-only, one Linux
// box, the naive bot resolver — no browser, no LAN socket; what lan.mjs DOES
// with a receipt (how the host surfaces it to the lobby) is a UI subject this
// tool does not reach.

import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { playCard, endTurn } from '../src/engine/coopCombat.js';
import { createSession, restoreSession } from './session.mjs';

const REG = createRegistries(contentBundle);
const fails = [];
const ok = (cond, msg, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}${detail ? ` — ${detail}` : ''}`);
  if (!cond) fails.push(msg);
};

// ---- drive a real session to a clean boundary (the resume-smoke walk) ------
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
    try { if (card) playCard(combat, memberId, card.instanceId, tgt && tgt.id); else { endTurn(combat, memberId); break; } }
    catch { endTurn(combat, memberId); break; }
  }
  if (!P.ended && combat.phase === 'player' && !combat.result) endTurn(combat, memberId);
}
function route(S, nodeId) {
  for (const m of S.connectedMembers()) {
    S.chooseNode(m.id, nodeId);
    if (S.scene.kind !== 'map') return;
  }
}
function walkToBoundary(S) {
  let guard = 0;
  while (guard++ < 40) {
    const sc = S.scene;
    if (sc.kind === 'map' && guard > 1) return;
    if (sc.kind === 'map') route(S, S.session.reachableIds[0]);
    else if (sc.kind === 'combat') { S.autoResolveCombat(botTurn); for (const m of S.livingMembers()) if (m.run.hp < 12) m.run.hp = m.run.maxHp; }
    else if (sc.kind === 'reward') { for (const id of Object.keys(sc.offers)) S.chooseReward(id, { cardId: sc.offers[id].cardIds[0] }); }
    else if (sc.kind === 'shrine') S.connectedMembers().forEach((m) => S.shrineChoice(m.id, 'rest'));
    else if (sc.kind === 'event') S.connectedMembers().forEach((m) => S.eventChoice(m.id, 0));
    else return;
  }
}

// ---- the poisons, each applied to PRISTINE bytes ---------------------------
// The ambiguous save Vira's migration refuses by design: BOTH the dead name
// and its heir claim one seat (Law 0 clause 5 — no honest way to pick).
function poisonBothNames(md) {
  md.run.attributes.constitution = md.run.attributes.vigour;
}
// The legitimate old save: the dead name ALONE, in both persisted homes —
// this one is MIGRATABLE and must restore healed. It exists in this file to
// prove the half-heal: at dev, healing it in place and THEN refusing a
// neighbour is what tears the caller's blob.
function spellDead(md) {
  const a = md.run.attributes;
  if (Object.hasOwn(a, 'vigour')) { a.constitution = a.vigour; delete a.vigour; }
  const rules = md.run.derivedStatRuleSnapshot && md.run.derivedStatRuleSnapshot.rules
    && md.run.derivedStatRuleSnapshot.rules.rules;
  for (const rule of Object.values(rules || {})) {
    if (rule && rule.sourceStat === 'vigour') rule.sourceStat = 'constitution';
  }
}
// Two claims on one seat, the other authority: the roster and the run disagree
// about the member's class.
function poisonClass(md) {
  md.classId = md.run.class === 'reaver' ? 'starseer' : 'reaver';
}
// Corrupt bytes: the record stopped being a run at all.
function poisonNoRun(md) {
  delete md.run;
}

const refusedOf = (S) => (typeof S.refusedMembers === 'function' ? S.refusedMembers() : null);

try {
  const S = createSession({ registries: REG, seedString: 'PARTYLINE' });
  S.addMember({ id: 'p1', name: 'Wren', classId: 'starseer' });
  S.addMember({ id: 'p2', name: 'Fenn', classId: 'reaver' });
  S.addMember({ id: 'p3', name: 'Moss', classId: 'reaver' });
  S.start();
  walkToBoundary(S);
  ok(S.scene.kind === 'map', 'a real 3-member run reached a clean boundary to persist at');
  const data = S.serialize();
  ok(data && data.v === 1, 'the real serializer produced the blob (the disk bytes every known-bad is built from)');
  const json = JSON.stringify(data);
  const deckOf = (blob, id) => blob.members.find((m) => m.id === id).run.deck.length;

  // ---- 1 · ONE POISONED MEMBER: receipt for one, restore for the rest ------
  {
    const bad = JSON.parse(json);
    poisonBothNames(bad.members[1]); // p2
    const before = JSON.stringify(bad);
    let R = null;
    let threw = null;
    try { R = restoreSession(REG, bad); } catch (e) { threw = e.message; }
    ok(threw === null, 'one poisoned member no longer detonates the whole restore', threw ? `threw: ${threw.slice(0, 120)}` : 'restored');
    if (R) {
      const party = [...R.session.members.keys()].sort();
      ok(JSON.stringify(party) === '["p1","p3"]', 'the healthy members restore', `party: ${party.join(', ') || '(nobody)'}`);
      ok(R.session.members.get('p1') && R.session.members.get('p1').run.deck.length === deckOf(bad, 'p1')
        && R.session.members.get('p3').run.deck.length === deckOf(bad, 'p3'),
      'the healthy members restore with their builds intact (deck sizes match the bytes)');
      const rf = refusedOf(R);
      ok(Array.isArray(rf) && rf.length === 1 && rf[0].id === 'p2' && /constitution|retired/.test(rf[0].reason || ''),
        'the poisoned member is refused BY NAME, and the receipt carries the refusal reason',
        rf && rf[0] ? `${rf[0].id}: ${String(rf[0].reason).slice(0, 90)}` : `refusedMembers() -> ${JSON.stringify(rf)}`);
      const snap = R.snapshot();
      ok(Array.isArray(snap.refusedMembers) && snap.refusedMembers.length === 1 && snap.refusedMembers[0].id === 'p2'
        && !!snap.refusedMembers[0].reason,
      'the receipt reaches snapshot() — every client can see WHO fell out and WHY');

      // -- 2 · the evidence bytes ride the blob ------------------------------
      const out = R.serialize();
      ok(out && Array.isArray(out.refusedMembers) && out.refusedMembers.length === 1
        && JSON.stringify(out.refusedMembers[0]) === JSON.stringify(bad.members[1]),
      'serialize() writes the refused member back out BYTE-EQUAL — a save cycle cannot destroy the evidence');
      const R2 = restoreSession(REG, JSON.parse(JSON.stringify(out)));
      const rf2 = refusedOf(R2);
      ok([...R2.session.members.keys()].sort().join(',') === 'p1,p3'
        && Array.isArray(rf2) && rf2.length === 1 && rf2[0].id === 'p2',
      'the next restore RE-ATTEMPTS the refused save and carries it again — the receipt survives the save cycle');

      // -- 3 · the caller's blob is evidence, not scratch --------------------
      ok(JSON.stringify(bad) === before,
        'the caller\'s parsed blob is untouched by a refusing restore (Viki\'s note 2: no half-heal)');
    }
  }

  // ---- 1b · the other poisons take the same per-member door ----------------
  for (const [name, poison, reasonRx] of [
    ['a class/run contradiction', poisonClass, /class/],
    ['a record with no run in it', poisonNoRun, /./],
  ]) {
    const bad = JSON.parse(json);
    poison(bad.members[1]);
    let R = null; let threw = null;
    try { R = restoreSession(REG, bad); } catch (e) { threw = e.message; }
    const rf = R && refusedOf(R);
    ok(threw === null && R && [...R.session.members.keys()].sort().join(',') === 'p1,p3'
      && Array.isArray(rf) && rf.length === 1 && rf[0].id === 'p2' && reasonRx.test(rf[0].reason || ''),
    `${name} is a one-member receipt, not a party wipe`,
    threw ? `threw: ${threw.slice(0, 100)}` : (rf && rf[0] ? `${rf[0].id}: ${String(rf[0].reason).slice(0, 80)}` : 'no receipt'));
  }

  // ---- 3b · THE HALF-HEAL, WATCHED: a migratable member beside a refused one
  {
    const bad = JSON.parse(json);
    spellDead(bad.members[0]);       // p1 — legitimate old save, heals
    poisonBothNames(bad.members[1]); // p2 — refused
    const before = JSON.stringify(bad);
    let R = null; let threw = null;
    try { R = restoreSession(REG, bad); } catch (e) { threw = e.message; }
    ok(threw === null && R && [...R.session.members.keys()].sort().join(',') === 'p1,p3',
      'an old-vocabulary member heals and restores even when a neighbour is refused',
      threw ? `threw: ${threw.slice(0, 100)}` : 'p1 healed, p3 clean, p2 refused');
    if (R) {
      ok(Object.hasOwn(R.session.members.get('p1').run.attributes, 'vigour')
        && !Object.hasOwn(R.session.members.get('p1').run.attributes, 'constitution'),
      'the healed member\'s SESSION run speaks the live vocabulary');
    }
    ok(JSON.stringify(bad) === before,
      'and the caller\'s blob still spells the OLD name — the heal happened on the door\'s clone, not the evidence',
      JSON.stringify(bad) === before ? 'byte-identical' : 'the blob was mutated (the half-heal, live at this ref)');
  }

  // ---- 4 · EDGE: all-healthy restores unchanged ----------------------------
  {
    const clean = JSON.parse(json);
    const before = JSON.stringify(clean);
    const R = restoreSession(REG, clean);
    const snap = R.snapshot();
    ok(snap.party.length === 3 && [...R.session.members.keys()].sort().join(',') === 'p1,p2,p3',
      'EDGE all-healthy: the full party restores, exactly as before this branch');
    const rf = refusedOf(R);
    ok((rf === null || rf.length === 0) && (!snap.refusedMembers || snap.refusedMembers.length === 0),
      'EDGE all-healthy: zero receipts — no phantom refusals', rf === null ? 'no refusedMembers() accessor at this ref' : `${(rf || []).length} receipt(s)`);
    ok(JSON.stringify(clean) === before, 'EDGE all-healthy: the caller\'s blob is untouched even on the clean path');
  }

  // ---- 5 · EDGE: all-poisoned still refuses WHOLE --------------------------
  {
    const bad = JSON.parse(json);
    poisonBothNames(bad.members[0]);
    poisonClass(bad.members[1]);
    poisonNoRun(bad.members[2]);
    const before = JSON.stringify(bad);
    let threw = null;
    try { restoreSession(REG, bad); } catch (e) { threw = e.message; }
    ok(threw !== null, 'EDGE all-poisoned: a restore with NO healthy member still refuses whole — a party of nobody is not a resume');
    ok(threw !== null && ['p1', 'p2', 'p3'].every((id) => threw.includes(`'${id}'`)),
      'EDGE all-poisoned: the whole-party refusal names EVERY member with their reason',
      threw ? threw.slice(0, 160) : '');
    ok(JSON.stringify(bad) === before, 'EDGE all-poisoned: even the refusing path leaves the caller\'s blob untouched');
  }
} catch (e) {
  ok(false, `threw: ${e.stack || e.message}`);
}

console.log(fails.length
  ? `\nCOOP RESTORE ISOLATION FAILED (${fails.length})`
  : '\nOne poisoned member fails with a receipt; the party restores.');
process.exit(fails.length ? 1 : 0);
