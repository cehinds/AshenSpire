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
import { seatTiers, lastTier, encounterTier, enemyTier } from '../src/model/encounterTier.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
// These files EXPLAIN the defect in their comments, naming the very expression
// the fix removed. A source contract that reads comments would be satisfied by
// the explanation, so whole-line comments come off before any code match.
const code = (p) => read(p).split('\n').filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*')).join('\n');
const reg = createRegistries(contentBundle);
let checks = 0;
const ok = (cond, what) => { assert.ok(cond, what); checks += 1; };

// ---- 1. the balance tool reads seats, and `act` is gone from the content ----
//
// BEHAVIOURAL, not a source match: the rule moved to src/model/encounterTier.js
// precisely so it could be driven directly, without importing a tool that runs
// a 300-seed simulation at module load (Copilot's review on #1111 asked for
// this, and it is the better test).
ok(!reg.encounters.all().some((enc) => enc.act != null),
  'no encounter row carries `act` — the field the tool used to read is gone');
const TIERS = seatTiers(reg);
ok(TIERS.size === reg.seats.all().length && [...TIERS.values()].every(Number.isInteger),
  'every declared seat maps to an integer baseTier');
ok(new Set(reg.encounters.all().map((e) => encounterTier(e, TIERS))).size > 1,
  'the encounters resolve to MORE THAN ONE tier — the whole defect was that they all read as 1');
for (const enc of reg.encounters.all()) {
  const tier = encounterTier(enc, TIERS);
  ok(Number.isInteger(tier) && tier >= 1, `${enc.id} resolves to a real tier (${tier}), not a default`);
  break; // one worked example; the set-size check above covers the rest
}
// The one null seat (SPEC §13.5) is the LAST tier's extra terminal, not tier 1.
const nullSeat = reg.encounters.all().filter((enc) => enc.seat == null);
ok(nullSeat.length === 1 && nullSeat[0].pool === 'boss',
  'exactly one encounter has a null seat, and it is a boss');
ok(encounterTier(nullSeat[0], TIERS) === lastTier(TIERS),
  `the null-seat boss (${nullSeat[0].id}) grades at the last tier, not the first`);
// An unknown seat is LOUD. This is the failure mode the defect had: a value the
// content does not declare quietly becoming a plausible tier.
assert.throws(() => encounterTier({ id: 'planted', seat: 'nowhere', enemies: [] }, TIERS),
  /not a declared seat/, 'an encounter naming an unknown seat throws by name');
checks += 1;
assert.throws(() => encounterTier(null, TIERS), /requires an encounter row/,
  'and a missing encounter row throws rather than defaulting');
checks += 1;
// An enemy nothing fights has NO tier. Returning the last one (or the first)
// would be the same invention, one level down — Copilot's finding on #1111.
ok(enemyTier('noSuchEnemy', reg.encounters.all(), TIERS) === null,
  'an enemy no encounter fields resolves to null, not to a tier');
const someEnemy = reg.encounters.all()[0].enemies[0];
ok(enemyTier(someEnemy, reg.encounters.all(), TIERS) === encounterTier(reg.encounters.all()[0], TIERS),
  `a fielded enemy (${someEnemy}) takes its encounter's tier`);
// And the tool itself is wired to that module rather than keeping a second copy.
const balanceSrc = code('tools/balance.mjs');
ok(/from\s+'\.\.\/src\/model\/encounterTier\.js'/.test(balanceSrc),
  'tools/balance.mjs resolves tiers through the shared module');
ok(!/\.act\s*\|\|\s*1/.test(balanceSrc),
  'and no longer defaults a missing `act` to tier 1');

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
ok(/const\s+history\s*=\s*def\s*&&\s*Array\.isArray\(entity\.performedMoves\)/.test(coopSrc),
  'coop.js builds the inspector\'s history from performedMoves');
ok(/\{\s*moveCards\s*,\s*history\s*\}/.test(coopSrc),
  'the enemy subject carries that history, so the section reads `known`/`none` instead of `unknown`');
ok(/seatName\s*:\s*snap\.seatName\s*\|\|\s*null/.test(coopSrc),
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
ok(/fightOver\s*=\s*true\s*;\s*closeQuickNav\(\s*\)\s*;/.test(combatSrc),
  'combat.js closes the menu the moment the fight resolves');
ok(/menuBtn\.disabled\s*=\s*true/.test(combatSrc),
  'and disables the button, so the victory beat is not a window into Save/Quit');
ok(/if\s*\(\s*fightOver\s*\)\s*return\s*;/.test(combatSrc),
  'and the click handler refuses even if something re-opens it');
const mainSrc = code('src/main.js');
ok(/storedSnapshot\s*&&\s*!storedSnapshot\.result\s*\?\s*storedSnapshot\s*:\s*null/.test(mainSrc),
  'a slot that already holds an ended snapshot falls back to the deterministic restart instead of being unplayable');

console.log(`${checks} checks passed`);
