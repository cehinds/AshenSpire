// tests/dev-sweep-fixes.test.mjs — the four dev defects reported with evidence
// on #999, which was closed without merging. Each check pins the FIX, and each
// one fails on the code as it stood:
//
//   1. tools/balance.mjs graded every encounter in the game as Act 1, because
//      it read `enc.act` and the seat refactor removed that field.
//   2. the co-op snapshot never carried the seat, so every co-op fight header
//      and map title said a bare "ACT II" where solo names the seat.
//   3. the co-op snapshot never carried `performedMoves`, so a client's
//      "Previous actions" read `unknown` — not "nothing yet" — forever.
//   4. Save and Quit stayed live through the victory hand-off, so a save could
//      checkpoint a combat that had already ended: a slot that resumes into a
//      won fight nothing will ever end.
//
// (The fifth, card.js dropping the ◆ on a zero-cost card, is pinned where it
// belongs — tests/wireframe-card.test.mjs, which used to assert the defect.)
//
// BOUNDARY: these are model, tool and source-contract checks. What a co-op
// client PAINTS is the browser gates; this says the field is sent and read.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createSession } from '../tools/session.mjs';
import { commitCombatSnapshot } from '../src/engine/combatSnapshot.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
// These files EXPLAIN the defect in their comments, naming the very expression
// the fix removed. A source contract that reads comments would be satisfied by
// the explanation, so whole-line comments come off before any code match.
const code = (p) => read(p).split('\n').filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*')).join('\n');
const reg = createRegistries(contentBundle);
let checks = 0;
const ok = (cond, what) => { assert.ok(cond, what); checks += 1; };

// ---- 1. the balance tool reads seats, and `act` is gone from the content ----
ok(!reg.encounters.all().some((enc) => enc.act != null),
  'no encounter row carries `act` — the field the tool used to read is gone');
ok(reg.encounters.all().length > 0 && new Set(reg.encounters.all().map((e) => e.seat)).size > 1,
  'encounters span more than one seat, so a tier-blind tool would be wrong about most of them');
const balanceSrc = code('tools/balance.mjs');
// The defect's exact shape: `|| 1` turned a field that no longer exists into
// "Act 1" for all 35 encounters. (The comment above the fix names `enc.act`
// on purpose, so this looks for the expression, not the spelling.)
ok(!/\.act \|\| 1/.test(balanceSrc) && !/\(e\.act \|\| 1\)/.test(balanceSrc),
  'tools/balance.mjs no longer defaults a missing `act` to tier 1');
ok(/function tierOf\(enc\)/.test(balanceSrc) && /SEAT_TIER\.get\(enc\.seat\)/.test(balanceSrc),
  'tools/balance.mjs resolves an encounter to its seat\'s authored baseTier');
ok(/throw new Error\(`balance: encounter/.test(balanceSrc),
  'an unknown seat is a throw, not a silent fall back to tier 1');
// The one null seat is the last tier's extra terminal (SPEC §13.5), not tier 1.
const nullSeat = reg.encounters.all().filter((enc) => enc.seat == null);
ok(nullSeat.length === 1 && nullSeat[0].pool === 'boss',
  'exactly one encounter has a null seat, and it is a boss');
const tiers = new Set(reg.seats.all().map((s) => s.baseTier));
ok(tiers.has(1) && Math.max(...tiers) > 1,
  'the seats declare more than one tier, so the tier the tool prints is a real distinction');

// ---- 2 + 3. the co-op snapshot carries the seat and the fight's history -----
const host = createSession({ registries: reg, seedString: 'GUARD2' });
for (const id of ['p1', 'p2']) host.addMember({ id, name: id, classId: 'reaver' });
host.start();
const preFight = host.snapshot();
ok(Array.isArray(preFight.seatOrder) && preFight.seatOrder.length === reg.seats.all().length,
  'the snapshot carries the drawn seat order');
ok(typeof preFight.seatId === 'string' && reg.seats.has(preFight.seatId),
  'the snapshot names the seat the party is climbing');
ok(preFight.seatName === reg.seats.get(preFight.seatId).name,
  `the snapshot carries the seat's display name ('${preFight.seatName}') — what coop.js reads for the fight header`);

for (const id of ['p1', 'p2']) host.chooseNode(id, host.session.mapGraph.startIds[0]);
const opening = host.snapshot();
ok(opening.scene.kind === 'combat', 'the party is in a fight');
ok(opening.scene.enemies.every((e) => Array.isArray(e.performedMoves)),
  'every enemy carries a performedMoves array — an EMPTY one is "has not acted yet"');
ok(opening.scene.enemies.every((e) => e.performedMoves.length === 0),
  'nothing has resolved on the opening turn, and the field says so rather than being absent');

// Play the fight out far enough that an enemy actually acts.
for (let turn = 0; turn < 6 && !host.live?.combat?.result; turn++) {
  for (const id of ['p1', 'p2']) host.combatEndTurn(id);
}
const later = host.snapshot();
const acted = (later.scene.enemies || []).filter((e) => e.performedMoves.length);
ok(acted.length > 0, 'after the enemy phases, at least one enemy reports the moves it PERFORMED');
ok(acted.every((e) => e.performedMoves.every((m) => typeof m === 'string' && m)),
  'each recorded move is a move id the client can name');

const coopSrc = code('src/ui/screens/coop.js');
ok(/const history = def && Array\.isArray\(entity\.performedMoves\)/.test(coopSrc),
  'coop.js builds the inspector\'s history from performedMoves');
ok(/\? \{ moveCards, history \}/.test(coopSrc),
  'the enemy subject carries that history, so the section reads `known`/`none` instead of `unknown`');
ok(/seatName: snap\.seatName \|\| null/.test(coopSrc),
  'coop.js passes the seat name through to the map board\'s act plate');

// ---- 4. a finished fight is not a resume point ------------------------------
const finished = { result: 'victory', loadout: {}, player: { flasks: [], flaskCharges: {}, hp: 1, maxHp: 1, mana: 0, maxMana: 0, stamina: 0, maxStamina: 0 }, equipmentPoolDeficits: {}, itemUpgradeLevels: {} };
assert.throws(
  () => commitCombatSnapshot({ run: {}, combat: finished, nodeId: 'n1', encounterId: 'loneSoldier' }),
  /already ended/,
  'commitCombatSnapshot refuses to checkpoint a combat whose result is set',
);
checks += 1;
assert.throws(
  () => commitCombatSnapshot({ run: {}, combat: { ...finished, result: 'defeat' }, nodeId: 'n1', encounterId: 'loneSoldier' }),
  /already ended/,
  'and refuses a lost one too — the same unplayable shape',
);
checks += 1;

const combatSrc = code('src/ui/screens/combat.js');
ok(/fightOver = true;\s*\n\s*closeQuickNav\(\);/.test(combatSrc),
  'combat.js closes the menu the moment the fight resolves');
ok(/menuBtn\.disabled = true/.test(combatSrc),
  'and disables the button, so the victory beat is not a window into Save/Quit');
ok(/if \(fightOver\) return;/.test(combatSrc),
  'and the click handler refuses even if something re-opens it');
const mainSrc = code('src/main.js');
ok(/const savedSnapshot = storedSnapshot && !storedSnapshot\.result \? storedSnapshot : null;/.test(mainSrc),
  'a slot that already holds an ended snapshot falls back to the deterministic restart instead of being unplayable');

console.log(`${checks} checks passed`);
