#!/usr/bin/env node
// Fixed-capacity Crimson/Azure charge contract. This intentionally starts red:
// charges are a run resource, not six inventory items with different labels.

import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, serializeRun, deserializeRun, initializeRunFlaskCharges } from '../src/model/state.js';
import { applyGraceRefill, buildShopStock, rollFlaskDrop } from '../src/engine/encounters.js';
import { CHARGE_FLASK_KINDS, flaskChargePlan, moveFlaskCharge } from '../src/model/gracerefill.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';

let passed = 0;
let failed = 0;
function check(ok, name, detail = '') {
  if (ok) { passed += 1; console.log(`PASS ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}
const text = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const R = createRegistries(contentBundle);
const chargeIds = new Set(['crimsonFlask', 'azureFlask']);

check(Number.isInteger(R.balance.flaskCapacity) && R.balance.flaskCapacity > 0,
  'one positive data-owned flaskCapacity is authoritative', String(R.balance.flaskCapacity));

for (const cls of R.classes.all()) {
  const a = cls.startingFlaskAllocation;
  check(a && Number.isInteger(a.hp) && Number.isInteger(a.mana) && a.hp >= 0 && a.mana >= 0
    && a.hp + a.mana === R.balance.flaskCapacity,
  `${cls.id} authors a legal starting Crimson/Azure allocation`, JSON.stringify(a));
}

const fresh = R.classes.all().map((cls) => createRunState({ seed: 1, classId: cls.id, registries: R }));
check(fresh.every((run) => run.flaskCharges && run.flaskCharges.capacity === R.balance.flaskCapacity),
  'fresh runs own capacity plus current and allocated charge counts');
check(fresh.every((run) => run.flaskCharges
  && run.flaskCharges.hp + run.flaskCharges.mana === run.flaskCharges.capacity),
  'fresh allocation invariant is hp + mana = capacity');
check(fresh.every((run) => !(run.flasks || []).some((f) => chargeIds.has(f.flaskId))),
  'Crimson/Azure charges are not duplicated as inventory items');

const roundTrip = deserializeRun(serializeRun(fresh[0]));
check(roundTrip.flaskCharges && JSON.stringify(roundTrip.flaskCharges) === JSON.stringify(fresh[0].flaskCharges),
  'save round-trip preserves charge capacity/allocation/current truth');

const legacy = structuredClone(fresh[0]);
delete legacy.flaskCharges;
legacy.flasks.push({ flaskId: 'crimsonFlask' }, { flaskId: 'azureFlask' });
initializeRunFlaskCharges(legacy, R);
check(legacy.flaskCharges.hpCurrent === 1 && legacy.flaskCharges.manaCurrent === 1
  && !legacy.flasks.some((f) => chargeIds.has(f.flaskId)),
  'legacy inventory migrates available counts without retaining charge items');

const spent = fresh[0];
if (spent.flaskCharges) { spent.flaskCharges.hpCurrent = 0; spent.flaskCharges.manaCurrent = 0; }
applyGraceRefill(R, spent);
check(spent.flaskCharges && spent.flaskCharges.hpCurrent === spent.flaskCharges.hp
  && spent.flaskCharges.manaCurrent === spent.flaskCharges.mana,
  'Grace refills current charges to the chosen allocation without changing capacity');

const graceModel = text('src/model/gracerefill.js');
check(/export function reallocateFlaskCharges\b/.test(graceModel)
  && /hp\s*\+\s*mana/.test(graceModel),
  'one model function reallocates atomically and enforces the invariant');

const graceUi = text('src/ui/screens/rest.js') + text('src/main.js');
check(/Reallocate Flask Charges/.test(graceUi) && !/Relocate Flask Charges/i.test(graceUi),
  'Grace names the feature Reallocate Flask Charges');

const session = text('tools/session.mjs');
check(/flaskCharges/.test(session) && /reallocateFlaskCharges/.test(session),
  'host session snapshots, restores, and authors reallocation');

const combat = text('src/engine/combat.js') + text('src/engine/coopCombat.js');
check(/flaskCharges/.test(combat) && /chargeFlaskId/.test(combat)
  && !/['"](?:crimsonFlask|azureFlask)['"]/.test(combat),
  'solo and co-op consumption spend the same authoritative charge pools');

const soloRun = fresh[0];
soloRun.mana = 0;
const C = createCombat({
  registries: R, rng: createRng(9),
  player: { classId: soloRun.class, maxHp: soloRun.maxHp, hp: soloRun.hp, maxMana: soloRun.maxMana, mana: 0,
    maxStamina: soloRun.maxStamina, stamina: soloRun.stamina, energyMax: soloRun.energyMax,
    drawPerTurn: soloRun.drawPerTurn, deck: soloRun.deck, relicIds: [], flasks: [], flaskCharges: soloRun.flaskCharges },
  enemyIds: [R.enemies.ids()[0]],
});
const beforeManaCharges = C.player.flaskCharges.manaCurrent;
dispatch(C, { type: 'useFlask', chargeKind: 'mana' });
check(C.player.mana === 1 && C.player.flaskCharges.manaCurrent === beforeManaCharges - 1 && C.player.flasks.length === 0,
  'solo Azure use restores one Mana and spends one charge, not an inventory slot');

const shopSeen = new Set();
const dropSeen = new Set();
for (let seed = 1; seed <= 80; seed++) {
  const run = createRunState({ seed, classId: 'reaver', registries: R });
  for (const row of buildShopStock(R, createRng(seed), run).flasks) shopSeen.add(row.id);
  run.flaskChancePct = 100;
  const drop = rollFlaskDrop(R, createRng(seed), run);
  if (drop) dropSeen.add(drop);
}
check(![...shopSeen].some((id) => chargeIds.has(id)) && shopSeen.size > 0,
  'shop excludes Crimson/Azure definitions while utility flasks remain eligible', [...shopSeen].join(','));
check(![...dropSeen].some((id) => chargeIds.has(id)) && dropSeen.size > 0,
  'reward drops exclude Crimson/Azure definitions while utility flasks remain eligible', [...dropSeen].join(','));


// ---------------------------------------------------------------------------
// E10 — THE INCREMENT PLAN. "just increment button for each that automatically
// adjusts the other flask to keep to the total available." (Constantine.)
//
// The model half. Every property below is about flaskChargePlan/moveFlaskCharge
// and NOTHING here has seen a screen — the rendered half is tools/flaskbox.mjs
// (B4), which drives the real Shrine at both shapes. Saying which is which is
// the point: a green here is a claim about arithmetic, never about a control a
// thumb can find.
// ---------------------------------------------------------------------------
{
  const cap = R.balance.flaskCapacity;
  const pool = (hp) => ({ capacity: cap, base: cap, hp, mana: cap - hp, hpCurrent: hp, manaCurrent: cap - hp, grown: { hp: 0, mana: 0 }, granted: 0 });

  // DERIVED, NOT TYPED — one row per charge kind, from the closed set. If a
  // third charge kind is ever authored this count moves with it and no screen
  // is edited; that is the Law 0 clause 1 claim, checked rather than asserted.
  const mid = flaskChargePlan(R, pool(Math.min(2, cap)));
  check(mid.rows.length === CHARGE_FLASK_KINDS.length,
    'the plan draws one row per charge kind, derived from the closed set', `${mid.rows.length} rows`);
  check(mid.rows.every((row) => row.def && row.def.name && row.def.id),
    'every row carries its AUTHORED flask, so no screen types a flask name');
  check(mid.capacity === cap && mid.assigned === cap,
    'the plan reports the total AND what is assigned, so a screen can show the invariant holding');

  // BOTH EDGES, and they are STATES with reasons, not guards.
  const full = flaskChargePlan(R, pool(cap));
  const hpFull = full.rows.find((r) => r.kind === 'hp');
  const manaEmpty = full.rows.find((r) => r.kind === 'mana');
  check(hpFull.canAdd === false && /already/i.test(hpFull.addReason || ''),
    'MAX EDGE: a kind holding every charge cannot take one, and says why by name', hpFull.addReason);
  check(manaEmpty.canSub === false && /no /i.test(manaEmpty.subReason || ''),
    'ZERO EDGE: a kind at zero cannot give one, and says why by name', manaEmpty.subReason);
  check(hpFull.canSub === true && manaEmpty.canAdd === true,
    'at both edges the move that RESTORES balance is still offered — an edge is not a dead end');

  // THE TOTAL HOLDS. Every legal move, from every legal allocation.
  let held = true;
  let moved = 0;
  for (let hp = 0; hp <= cap; hp++) {
    for (const row of flaskChargePlan(R, pool(hp)).rows) {
      if (row.canSub) {
        const charges = pool(hp);
        moveFlaskCharge(R, charges, { from: row.kind, to: row.receiver });
        moved += 1;
        if (charges.hp + charges.mana !== cap) held = false;
        if (charges.hpCurrent + charges.manaCurrent !== cap) held = false;
      }
      if (row.canAdd) {
        const charges = pool(hp);
        moveFlaskCharge(R, charges, { from: row.donor, to: row.kind });
        moved += 1;
        if (charges.hp + charges.mana !== cap) held = false;
        if (charges.hpCurrent + charges.manaCurrent !== cap) held = false;
      }
    }
  }
  check(held && moved > 0, 'EVERY legal step from EVERY legal allocation keeps the total', `${moved} moves`);

  // A step is exactly one charge — "increment", not "reassign".
  const one = pool(Math.min(1, cap));
  const beforeHp = one.hp;
  moveFlaskCharge(R, one, { from: 'mana', to: 'hp' });
  check(one.hp === beforeHp + 1, 'a step moves exactly one charge');

  // AND IT REFUSES THE ILLEGAL MOVE BY NAME (Law 1 clause 5). A `+` that
  // silently did nothing at the edge is the plausible-wrong-answer failure.
  const empty = pool(cap);
  let refused = '';
  try { moveFlaskCharge(R, empty, { from: 'mana', to: 'hp' }); } catch (error) { refused = error.message; }
  check(/no 'mana' charge/.test(refused), 'moving a charge that is not there fails LOUD and names the kind', refused);
  let sameKind = '';
  try { moveFlaskCharge(R, pool(1), { from: 'hp', to: 'hp' }); } catch (error) { sameKind = error.message; }
  check(/same kind/.test(sameKind), 'a move from a kind to itself is refused rather than silently ignored', sameKind);
  let unknown = '';
  try { moveFlaskCharge(R, pool(1), { from: 'hp', to: 'sunlight' }); } catch (error) { unknown = error.message; }
  check(/not a charge flask kind/.test(unknown), 'an unknown kind is refused by name, never coerced', unknown);

  // THE SCREEN DOES NOT KNOW THE KINDS. Its own source may not name them.
  const restSrc = text('src/ui/screens/rest.js');
  const panel = restSrc.slice(restSrc.indexOf('flask-increment'), restSrc.indexOf('flask-increment-total'));
  check(!/['"]mana['"]/.test(panel) && !/['"]hp['"]/.test(panel),
    'the increment panel names no charge kind — it renders whatever the plan hands it');
  check(!/data-hp=/.test(restSrc),
    'the capacity+1 split buttons he asked us to remove are gone from the screen');
}

console.log(`\nflask-reallocation: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
