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
//   node tools/coop-restore-isolation.mjs --selftest
//
// Exit 0: every check held. Exit 1: a failure. Boundary: node-only, one Linux
// box, a pristine post-start map fixture — no browser, no LAN socket; what lan.mjs DOES
// with a receipt (how the host surfaces it to the lobby) is a UI subject this
// tool does not reach.

import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createSession, restoreSession } from './session.mjs';

const REG = createRegistries(contentBundle);
const fails = [];
const ok = (cond, msg, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}${detail ? ` — ${detail}` : ''}`);
  if (!cond) fails.push(msg);
};

// ---- one deterministic source blob for every poison -----------------------
function pristineStartFixture() {
  const session = createSession({ registries: REG, seedString: 'PARTYLINE' });
  session.addMember({ id: 'p1', name: 'Wren', classId: 'starseer' });
  session.addMember({ id: 'p2', name: 'Fenn', classId: 'reaver' });
  session.addMember({ id: 'p3', name: 'Moss', classId: 'reaver' });
  session.start();
  return { session, data: session.serialize() };
}

function startFixtureFindings(data, liveSceneKind) {
  const findings = [];
  if (!data || data.v !== 1) findings.push('VERSION');
  if (liveSceneKind !== 'map' || data?.scene?.kind !== 'map') findings.push('SCENE');
  const members = Array.isArray(data?.members) ? data.members : [];
  if (members.length !== 3) findings.push('MEMBERS');
  if (members.length !== 3 || !members.every((member) => member.alive === true)) findings.push('ALIVE');
  if (members.length !== 3 || !members.every((member) => member.run?.hp === member.run?.maxHp)) findings.push('HP');
  return findings;
}

if (process.argv.includes('--selftest')) {
  const { session, data } = pristineStartFixture();
  const clean = startFixtureFindings(data, session.scene.kind);
  const defeated = structuredClone(data);
  defeated.members[1].alive = false;
  defeated.members[1].run.hp = 0;
  const defeatedRed = startFixtureFindings(defeated, session.scene.kind);
  const nonMap = structuredClone(data);
  nonMap.scene = { ...nonMap.scene, kind: 'combat' };
  const nonMapRed = startFixtureFindings(nonMap, 'combat');
  const cleanGreen = clean.length === 0;
  const defeatedCaught = defeatedRed.includes('ALIVE') && defeatedRed.includes('HP');
  const nonMapCaught = nonMapRed.includes('SCENE');
  console.log(`${cleanGreen ? 'GREEN' : 'MISS '} clean post-start fixture: ${clean.join(', ') || 'no findings'}`);
  console.log(`${defeatedCaught ? 'RED  ' : 'MISS '} defeated-member plant: ${defeatedRed.join(', ') || 'no findings'}`);
  console.log(`${nonMapCaught ? 'RED  ' : 'MISS '} non-map plant: ${nonMapRed.join(', ') || 'no findings'}`);
  const passed = Number(defeatedCaught) + Number(nonMapCaught);
  console.log(`coop-restore-isolation --selftest: ${passed}/2 plants observed RED; clean control ${cleanGreen ? 'GREEN' : 'FAILED'}`);
  process.exit(cleanGreen && passed === 2 ? 0 : 1);
}

// ---- the poisons, each applied to PRISTINE bytes ---------------------------
// The ambiguous save Vira's migration refuses by design: BOTH the dead name
// and its heir claim one seat (Law 0 clause 5 — no honest way to pick).
function poisonBothNames(md) {
  md.run.attributes.vigour = md.run.attributes.constitution;
}
// The legitimate old save: the dead name ALONE, in both persisted homes —
// this one is MIGRATABLE and must restore healed. It exists in this file to
// prove the half-heal: at dev, healing it in place and THEN refusing a
// neighbour is what tears the caller's blob.
function spellDead(md) {
  const a = md.run.attributes;
  if (Object.hasOwn(a, 'constitution')) { a.vigour = a.constitution; delete a.constitution; }
  const rules = md.run.derivedStatRuleSnapshot && md.run.derivedStatRuleSnapshot.rules
    && md.run.derivedStatRuleSnapshot.rules.rules;
  for (const rule of Object.values(rules || {})) {
    if (rule && rule.sourceStat === 'constitution') rule.sourceStat = 'vigour';
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
  const { session: S, data } = pristineStartFixture();
  const fixtureFindings = startFixtureFindings(data, S.scene.kind);
  ok(fixtureFindings.length === 0,
    'the real v1 3-member session serializes immediately at a clean start map with every member alive at full HP',
    fixtureFindings.join(', '));
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
      ok(Array.isArray(rf) && rf.length === 1 && rf[0].id === 'p2' && /vigour|retired/.test(rf[0].reason || ''),
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
      ok(Object.hasOwn(R.session.members.get('p1').run.attributes, 'constitution')
        && !Object.hasOwn(R.session.members.get('p1').run.attributes, 'vigour'),
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
