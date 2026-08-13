// tools/arcane-exposure-engine.mjs — observed-red host engine contract.
//
// No UI claims live here. Mid-combat state is authoritative in the host combat
// snapshot; disk saves still resume at the established pre-combat boundary.

import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createCoopCombat, playCard } from '../src/engine/coopCombat.js';
import { createRng } from '../src/engine/rng.js';
import { applyAttackDamage, computeAttackDamage } from '../src/engine/actions.js';
import { EVENTS } from '../src/model/schemas.js';

let checks = 0;
let failures = 0;
function check(name, fn) {
  checks++;
  try { fn(); console.log(`PASS  ${name}`); }
  catch (error) { failures++; console.log(`FAIL  ${name} — ${error.message}`); }
}
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const equal = (actual, expected, message) => assert(Object.is(actual, expected), `${message}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);

const R = createRegistries(contentBundle);
function player(seed = 7) {
  const run = createRunState({ seed, classId: 'starseer', registries: R });
  return {
    classId: run.class, attributes: run.attributes,
    maxHp: run.maxHp, hp: run.hp, maxMana: run.maxMana, mana: run.mana,
    maxStamina: run.maxStamina, stamina: run.stamina,
    energyMax: run.energyMax, drawPerTurn: run.drawPerTurn,
    deck: run.deck, relicIds: run.relics, flasks: run.flasks,
    loadout: run.loadout, equipmentProfileRuleSnapshot: run.equipmentProfileRuleSnapshot,
  };
}
function solo(enemyId = 'wanderingSoldier', seed = 7) {
  return createCombat({ registries: R, rng: createRng(seed), player: player(seed), enemyIds: [enemyId] });
}
function coop(enemyId = 'wanderingSoldier', seed = 8) {
  return createCoopCombat({
    registries: R, rng: createRng(seed), enemyIds: [enemyId],
    players: [{ id: 'p1', ...player(seed) }],
  });
}
const carrier = (damageSchool = 'magic', exposureBuildupPerHit = 1) => ({ damageSchool, exposureBuildupPerHit });
const recent = (ctx, type) => ctx.eventLog.filter((event) => event.type === type);
function forceAttackIntoHand(piles) {
  const all = ['hand', 'draw', 'discard', 'exhaust'];
  let attack = null;
  for (const pile of all) {
    const index = piles[pile].findIndex((card) => card.equipmentRole === 'attack');
    if (index >= 0) { attack = piles[pile].splice(index, 1)[0]; break; }
  }
  assert(attack, 'equipment attack card absent');
  piles.hand.push(attack);
  return attack;
}

console.log('arcane-exposure-engine — host resolution contract\n');

check('event vocabulary registers buildup, refusal, and break receipts', () => {
  for (const id of ['arcaneExposureChanged', 'arcaneExposureRefused', 'arcaneBreak']) assert(EVENTS.includes(id), `missing event ${id}`);
});

check('solo configured enemy owns a host meter snapshot', () => {
  const C = solo();
  equal(C.enemies[0].arcaneExposure.mode, 'configured', 'configured mode');
  equal(C.enemies[0].arcaneExposure.value, 0, 'initial value');
  equal(C.enemies[0].arcaneExposure.threshold, 8, 'authored threshold');
});

check('co-op host owns the same configured meter snapshot', () => {
  const C = coop();
  equal(C.enemies[0].arcaneExposure.mode, 'configured', 'co-op configured mode');
  equal(C.enemies[0].arcaneExposure.threshold, 8, 'co-op threshold');
});

check('absent and immune enemy snapshots remain distinct', () => {
  equal(solo('blightHound').enemies[0].arcaneExposure, undefined, 'absent enemy grew a default meter');
  equal(solo('charredColossus').enemies[0].arcaneExposure.mode, 'immune', 'immune enemy lost its mode');
});

check('only final HP-loss hits build exposure', () => {
  const C = solo();
  const E = C.enemies[0];
  E.block = 99;
  applyAttackDamage(C, C.player, E, 3, [], carrier());
  equal(E.arcaneExposure.value, 0, 'fully blocked hit built exposure');
  E.block = 0;
  applyAttackDamage(C, C.player, E, 3, [], carrier());
  equal(E.arcaneExposure.value, 1, 'HP-loss hit did not build once');
  equal(recent(C, 'arcaneExposureChanged').at(-1)?.amount, 1, 'buildup receipt amount');
});

check('explicit physical or zero carrier never builds', () => {
  const C = solo();
  const E = C.enemies[0];
  applyAttackDamage(C, C.player, E, 2, [], carrier('physical', 7));
  applyAttackDamage(C, C.player, E, 2, [], carrier('magic', 0));
  equal(E.arcaneExposure.value, 0, 'unmapped/zero carrier built exposure');
});

check('enemy multiplier is data-owned and floors per hit', () => {
  const C = solo();
  const E = C.enemies[0];
  E.arcaneExposure.buildupMultiplier = 1.5;
  applyAttackDamage(C, C.player, E, 2, [], carrier('magic', 3));
  equal(E.arcaneExposure.value, 4, 'floor(3 × 1.5)');
});

check('immune hit emits a visible refusal without a meter', () => {
  const C = solo('charredColossus');
  const E = C.enemies[0];
  applyAttackDamage(C, C.player, E, 2, [], carrier());
  equal(E.arcaneExposure.mode, 'immune', 'immune state changed');
  equal(recent(C, 'arcaneExposureRefused').at(-1)?.reason, 'immune', 'immune refusal receipt');
});

check('break resets to zero, discards overflow, and applies configured payload', () => {
  const C = solo();
  const E = C.enemies[0];
  applyAttackDamage(C, C.player, E, 2, [], carrier('magic', 99));
  equal(E.arcaneExposure.value, 0, 'overflow was not discarded');
  equal(recent(C, 'arcaneBreak').length, 1, 'break receipt count');
  equal(E.statuses.magicVulnerable.stacks, 25, 'configured status value');
  equal(E.statuses.magicVulnerable.duration, 2, 'configured status duration');
});

check('Magic Vulnerable locks buildup with a visible refusal', () => {
  const C = solo();
  const E = C.enemies[0];
  applyAttackDamage(C, C.player, E, 2, [], carrier('magic', 99));
  applyAttackDamage(C, C.player, E, 2, [], carrier());
  equal(E.arcaneExposure.value, 0, 'locked buildup changed meter');
  equal(recent(C, 'arcaneExposureRefused').at(-1)?.reason, 'locked', 'lock refusal receipt');
});

check('raw school resistance is separate and Magic Vulnerable affects magic HP only', () => {
  const C = solo('charredColossus');
  const E = C.enemies[0];
  const plainMagic = computeAttackDamage(C, C.player, E, 10, [], carrier('magic', 0));
  const plainArcane = computeAttackDamage(C, C.player, E, 10, [], carrier('arcane', 0));
  E.statuses.magicVulnerable = { stacks: 25, duration: 2 };
  const vulnerableMagic = computeAttackDamage(C, C.player, E, 10, [], carrier('magic', 0));
  const vulnerableArcane = computeAttackDamage(C, C.player, E, 10, [], carrier('arcane', 0));
  equal(plainMagic, 9, '10% raw magic resistance');
  equal(plainArcane, 10, 'raw resistance leaked schools');
  equal(vulnerableMagic, 11, '25% magic vulnerability after resistance');
  equal(vulnerableArcane, 10, 'Magic Vulnerable affected arcane');
});

check('solo and co-op use one action implementation for the same receipt', () => {
  const S = solo();
  const C = coop();
  applyAttackDamage(S, S.player, S.enemies[0], 2, [], carrier());
  applyAttackDamage(C, C.players.get('p1').entity, C.enemies[0], 2, [], carrier());
  equal(C.enemies[0].arcaneExposure.value, S.enemies[0].arcaneExposure.value, 'host state parity');
  equal(recent(C, 'arcaneExposureChanged').at(-1)?.amount, recent(S, 'arcaneExposureChanged').at(-1)?.amount, 'receipt parity');
});

check('real solo and co-op card dispatch carry the stamped school and buildup', () => {
  const S = solo();
  const soloAttack = forceAttackIntoHand(S.piles);
  dispatch(S, { type: 'playCard', cardInstanceId: soloAttack.instanceId, targetId: S.enemies[0].id });
  const C = coop();
  const seat = C.players.get('p1');
  const coopAttack = forceAttackIntoHand(seat.piles);
  playCard(C, 'p1', coopAttack.instanceId, C.enemies[0].id);
  equal(S.enemies[0].arcaneExposure.value, 1, 'solo dispatched attack buildup');
  equal(C.enemies[0].arcaneExposure.value, 1, 'co-op dispatched attack buildup');
  equal(recent(S, 'arcaneExposureChanged').at(-1)?.school, 'magic', 'solo receipt school');
  equal(recent(C, 'arcaneExposureChanged').at(-1)?.school, 'magic', 'co-op receipt school');
});

check('real preview and dispatch agree under resistance, vulnerability, and per-hit buildup', () => {
  const C = solo('charredColossus');
  // Use a configured policy on the raw-resistance fixture so one target proves
  // both lanes remain separate. This is host state, not live content mutation.
  C.enemies[0].arcaneExposure = {
    mode: 'configured', value: 0, threshold: 100, buildupMultiplier: 1,
    resetMode: 'zero', overflowPolicy: 'discard', lockPolicy: 'whileMagicVulnerable',
    onBreak: { status: 'magicVulnerable', value: 25, duration: 2 },
  };
  // The active vulnerability consumes explicit magic packets, while its lock
  // would prevent buildup. For the parity packet, author a separate matching
  // status whose value is active but does not equal the configured lock id.
  C.enemies[0].statuses.magicVulnerable = { stacks: 25, duration: 2 };
  C.enemies[0].arcaneExposure.onBreak.status = 'vulnerable';
  const attack = forceAttackIntoHand(C.piles);
  const beforeHp = C.enemies[0].hp;
  const beforeExposure = C.enemies[0].arcaneExposure.value;
  const pv = previewCard(C, attack.instanceId, C.enemies[0].id).values.find((row) => row.op === 'damage');
  dispatch(C, { type: 'playCard', cardInstanceId: attack.instanceId, targetId: C.enemies[0].id });
  equal(beforeHp - C.enemies[0].hp, pv.value * pv.hits, 'preview damage vs dispatched HP loss');
  equal(C.enemies[0].arcaneExposure.value - beforeExposure, attack.exposureBuildupPerHit * pv.hits, 'per-hit buildup vs preview hit count');
});

check('session projection source preserves refusal attempted amount', () => {
  // Source-level because session combat setup is encounter-seeded; this proves
  // the named host field is not silently dropped at the LAN boundary.
  const source = readFileSync(new URL('./session.mjs', import.meta.url), 'utf8');
  assert(/attempted:\s*e\.attempted/.test(source), 'session projection drops arcaneExposureRefused.attempted');
});

console.log(`\n${failures ? `ARCANE EXPOSURE ENGINE RED — ${failures}/${checks} failing` : `ARCANE EXPOSURE ENGINE GREEN — ${checks}/${checks}`}`);
if (failures) process.exit(1);
