#!/usr/bin/env node
// Fixed-capacity Crimson/Azure charge contract. This intentionally starts red:
// charges are a run resource, not six inventory items with different labels.

import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, serializeRun, deserializeRun, initializeRunFlaskCharges } from '../src/model/state.js';
import { applyGraceRefill } from '../src/engine/encounters.js';
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
check(/flaskCharges/.test(combat) && /crimsonFlask/.test(combat) && /azureFlask/.test(combat),
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

const rewards = text('src/engine/encounters.js') + session;
check(!/(push\([^\n]*flaskId[^\n]*(crimsonFlask|azureFlask))/.test(rewards),
  'rewards never turn Crimson/Azure charge capacity into inventory drops');

console.log(`\nflask-reallocation: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
