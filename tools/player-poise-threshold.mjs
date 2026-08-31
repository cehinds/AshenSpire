// tools/player-poise-threshold.mjs — observed-red contract for player Poise.
//
// MIGRATED 2026-08-14 with the vessel (D10.4 "poise (very skinny bar) under
// the health bar"; D17 q5 "should also effect player too" — ruled answered
// over the mock's silence). The old contract asserted NO consumer anywhere;
// the boundary moved and this tool was watched go red on it before it was
// rewritten (2/17 failing at the old text: the note check and the
// forbidden-file scan, exactly the two clauses the vessel legitimately
// crosses).
//
// THE INVARIANT NOW: player Poise is a truthful equipment receipt with a
// DISPLAY consumer and nothing else. The combat entity stamps the receipt's
// value as its poiseMeter max (the HUD vessel — real-but-empty, value 0);
// NO COMBAT RULE consumes it and NO WRITER moves the value: dealPoiseDamage
// still refuses non-enemies, the stagger/damage vocabulary (engine/actions.js,
// engine/statuses.js) stays threshold-free, and no save/session authority is
// introduced. The stagger mechanics, resistance rules and armour weights are
// combat design dealt elsewhere — the day they land, the checks below that
// assert emptiness must MOVE with them, not be relaxed.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, createEnemyCombatEntity, createPlayerCombatEntity, stampPlayerPoiseMax } from '../src/model/state.js';
import { dealPoiseDamage } from '../src/engine/actions.js';
import { validateContent } from '../src/model/validate.js';
import { PASSIVE_TYPES } from '../src/model/schemas.js';
import * as projectionModel from '../src/model/statProjection.js';

// DOOR. Three real doors, all of them the ones the game itself uses: the
// content bundle by import, the engine/model modules by import (dealPoiseDamage
// is driven through the funnel every poiseDamage opcode drains into), and the
// authored CSV headers plus combat.js's denial sentence by readFileSync. The
// in-file `mutableBundle()` mutants are the validator's own door and right for
// those clauses. What this file never had was a re-runnable plant on the
// SHIPPED-FILE road: the header's "observed 2026-08-14, reverted" scratch edit
// was a one-off, and under SOP 2's drift clause it rotted to `unknown` at the
// next ref (Vira's audit rated this OBSERVED-ONCE). `--selftest` is that plant
// made re-runnable — including one on the WAKE RED, whose whole subject is a
// premise dying in the real tree.
if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'player-poise-threshold.mjs',
    plants: [
      {
        // THE WAKE RED'S OWN KNOWN-BAD (development.md, *The wake condition*,
        // clause 3): the premise-death must be planted through the same door a
        // real writer would arrive by. Relaxing the kind gate in
        // dealPoiseDamage IS that door — it is the funnel every poiseDamage
        // opcode drains into, so a real stagger slice landing would flip
        // exactly this predicate.
        name: 'WAKE: the no-writer premise dies — dealPoiseDamage stops refusing a player entity',
        file: 'src/engine/actions.js',
        find: "  if (!enemy || enemy.kind !== 'enemy' || !enemy.alive) return;",
        replace: "  if (!enemy || !enemy.alive) return; // planted: the kind gate is gone, a writer has arrived",
        all: true, // the gate guards two functions in this file; half a plant leaves the real funnel closed
        expectRed: /FAIL\s+WAKE RED.*THE PREMISE DIED AND A REFUSAL STILL STANDS/,
      },
      {
        name: 'a stagger rule learns the player threshold word (mechanics by the back door)',
        file: 'src/engine/statuses.js',
        append: 'export const plantedStaggerRule = (p) => p.poiseThreshold > 0;',
        expectRed: /FAIL\s+the combat-rule vocabulary stays threshold-free/,
      },
      {
        name: 'the authored poiseThreshold column disappears from the source spreadsheet',
        file: 'content/source/weapons.csv',
        find: 'poiseThreshold',
        replace: 'plantedColumn',
        expectRed: /FAIL\s+source spreadsheets author one poiseThreshold column/,
      },
      {
        name: 'the receipt is flipped active while nothing writes the value',
        file: 'src/model/statProjection.js',
        find: 'active: false',
        replace: 'active: true',
        all: true,
        expectRed: /FAIL\s+WAKE RED.*a refusal artifact already dropped/,
      },
      {
        name: 'the threshold-0 refusal is dropped — an empty vessel is stamped instead of absent',
        file: 'src/model/state.js',
        // #498: the find was the tail of the old signature, and the plant died
        // when the signature gained damageBySchoolAdd after poiseMax. Anchored
        // to the parameter pair now, which stays unique if the tail grows again.
        find: 'poiseMax = 0, damageBySchoolAdd',
        replace: 'poiseMax = 1, damageBySchoolAdd',
        expectRed: /FAIL\s+the player entity stamps a real-but-empty vessel/,
      },
    ],
  }));
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let checks = 0;
let failures = 0;

function check(name, fn) {
  checks++;
  try {
    const detail = fn();
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    failures++;
    console.log(`FAIL  ${name} — ${error && error.message ? error.message : error}`);
  }
}

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const equal = (actual, expected, message) => assert(Object.is(actual, expected), `${message}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
const own = (row, key) => Object.prototype.hasOwnProperty.call(row, key);
const pieceRows = (bundle = contentBundle) => [
  ...((bundle.equipment && bundle.equipment.armaments) || []),
  ...((bundle.equipment && bundle.equipment.armour) || []),
];

function validAuthoredValue(row) {
  return own(row, 'poiseThreshold') && Number.isInteger(row.poiseThreshold) && row.poiseThreshold >= 0;
}

function errorText(bundle) {
  return validateContent(bundle).errors.map((error) => `${error.path}: ${error.msg}`).join('\n');
}

function mutableBundle() {
  return {
    ...contentBundle,
    equipment: {
      ...contentBundle.equipment,
      armaments: contentBundle.equipment.armaments.map((row) => ({ ...row })),
      armour: contentBundle.equipment.armour.map((row) => ({ ...row })),
    },
    relics: contentBundle.relics.map((row) => ({
      ...row,
      passives: row.passives ? { ...row.passives } : row.passives,
    })),
  };
}

function refusesPieceValue(label, value, remove = false) {
  const bundle = mutableBundle();
  const row = bundle.equipment.armaments[0];
  if (remove) delete row.poiseThreshold;
  else row.poiseThreshold = value;
  const said = errorText(bundle);
  assert(/poiseThreshold/i.test(said), `${label} was accepted or refused without a poiseThreshold path`);
}

function csvHeader(file) {
  return readFileSync(resolve(ROOT, file), 'utf8').split(/\r?\n/).find((line) => line && !line.startsWith('#')) || '';
}

console.log('player-poise-threshold — inert equipment receipt contract\n');

check('source spreadsheets author one poiseThreshold column for armaments and armour', () => {
  for (const file of ['content/source/weapons.csv', 'content/source/outfits.csv']) {
    assert(csvHeader(file).split(',').includes('poiseThreshold'), `${file} has no poiseThreshold column`);
  }
});

check('every weapon, shield, staff, and armour row owns a finite whole-number contribution', () => {
  const bad = pieceRows().filter((row) => !validAuthoredValue(row)).map((row) => `${row.kind || 'armour'}:${row.classId ? `${row.classId}/` : ''}${row.id}`);
  assert(bad.length === 0, `missing/invalid rows: ${bad.join(', ')}`);
  return `${pieceRows().length} rows`;
});

check('generated equipment preserves the authored values instead of inventing defaults', () => {
  const generated = [
    readFileSync(resolve(ROOT, 'src/content/generated/weapons.js'), 'utf8'),
    readFileSync(resolve(ROOT, 'src/content/generated/outfits.js'), 'utf8'),
  ].join('\n');
  assert(/"poiseThreshold"\s*:/m.test(generated), 'generated equipment omits poiseThreshold');
  assert(!/poiseThreshold\s*\?\?|poiseThreshold\s*\|\|/.test(readFileSync(resolve(ROOT, 'src/content/equipment.js'), 'utf8')), 'normalizer silently defaults absent data');
});

for (const [label, value, remove] of [
  ['missing value', undefined, true],
  ['numeric string', '4', false],
  ['NaN', Number.NaN, false],
  ['positive Infinity', Number.POSITIVE_INFINITY, false],
  ['negative value', -1, false],
  ['fractional value', 1.5, false],
]) {
  check(`validator refuses ${label}`, () => refusesPieceValue(label, value, remove));
}

check('validator covers armour independently of armaments', () => {
  const bundle = mutableBundle();
  delete bundle.equipment.armour[0].poiseThreshold;
  assert(/poiseThreshold/i.test(errorText(bundle)), 'armour omission escaped validation');
});

check('validator names every individual equipment row when its authored value disappears', () => {
  for (const table of ['armaments', 'armour']) {
    for (let i = 0; i < contentBundle.equipment[table].length; i++) {
      const bundle = mutableBundle();
      const row = bundle.equipment[table][i];
      delete row.poiseThreshold;
      const said = errorText(bundle);
      assert(said.includes(`equipment.${table}.${row.id}.poiseThreshold`), `${table}.${row.id} omission was not named`);
    }
  }
  return `${pieceRows().length} omission mutants`;
});

check('poiseThresholdAdd is one registered numeric relic-passive key', () => {
  equal(PASSIVE_TYPES.poiseThresholdAdd, 'num', 'PASSIVE_TYPES.poiseThresholdAdd');
  const authored = contentBundle.relics.filter((row) => row.passives && own(row.passives, 'poiseThresholdAdd'));
  assert(authored.length > 0, 'no relic authors a poiseThresholdAdd modifier');
  assert(authored.every((row) => Number.isInteger(row.passives.poiseThresholdAdd)), 'relic modifier must be a finite whole number');
  return authored.map((row) => row.id).join(', ');
});

check('relic schema refuses a nonnumeric poiseThresholdAdd modifier', () => {
  const bundle = mutableBundle();
  bundle.relics[0].passives = { ...(bundle.relics[0].passives || {}), poiseThresholdAdd: 'four' };
  const said = errorText(bundle);
  assert(/poiseThresholdAdd.*(expected num|expected number|must be a number)/i.test(said), `nonnumeric modifier was not type-refused: ${said.match(/.*poiseThresholdAdd.*/i)?.[0] || 'no error'}`);
});

check('relic modifier numeric corpus refuses NaN, Infinity, negative, and fractional values', () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5]) {
    const bundle = mutableBundle();
    bundle.relics[0].passives = { ...(bundle.relics[0].passives || {}), poiseThresholdAdd: value };
    const said = errorText(bundle);
    assert(/poiseThresholdAdd.*finite non-negative integer/i.test(said), `${String(value)} escaped relic numeric validation`);
  }
});

check('one pure playerPoiseThresholdReceipt reader owns the projection', () => {
  assert(typeof projectionModel.playerPoiseThresholdReceipt === 'function', 'statProjection.js does not export playerPoiseThresholdReceipt');
  const registries = createRegistries(contentBundle);
  const run = createRunState({ seed: 0x5015e, classId: 'reaver', registries });
  run.loadout.sets.rightHand[1] = 'greatsword';
  run.relics.push('curedHide');
  const before = JSON.stringify(run);
  const receipt = projectionModel.playerPoiseThresholdReceipt(registries, run);
  equal(JSON.stringify(run), before, 'receipt reader mutated the run');
  assert(receipt && Array.isArray(receipt.sources), 'receipt.sources is absent');
  assert(Number.isFinite(receipt.equipment) && Number.isFinite(receipt.relic), 'receipt subtotals are not finite');
  equal(receipt.raw, receipt.equipment + receipt.relic, 'receipt raw subtotal');
  equal(receipt.value, receipt.raw, 'inert receipt value');
  equal(receipt.relic, 2, 'Cured Hide contribution is counted once');
  assert(!receipt.sources.some((source) => source.id === 'greatsword'), 'inactive right-hand set contributed');
  equal(receipt.sources.filter((source) => source.kind === 'equipment').length, 3, 'one active right hand, left hand, and armour source');
  equal(receipt.active, false, 'receipt must stay combat-inert (active flips only when a combat rule consumes it)');
  assert(/display consumer only/i.test(receipt.note || ''), 'receipt does not disclose its display consumer');
  assert(/no combat consumer/i.test(receipt.note || ''), 'receipt does not disclose that combat still ignores it');
});

check('the combat-rule vocabulary stays threshold-free (the display stamp is the ONLY consumer)', () => {
  // The old clause forbade the threshold everywhere; the vessel legitimately
  // crossed it in state.js, engine/combat.js and model/resources.js (watched
  // red before this rewrite). What must STAY true is narrower and sharper:
  // the files where poise DAMAGE and stagger RULES live never learn the
  // player threshold word — a stagger rule reading it is the mechanics
  // arriving by the back door.
  const forbidden = ['src/engine/actions.js', 'src/engine/statuses.js'];
  const offenders = forbidden.filter((file) => /poiseThreshold/i.test(readFileSync(resolve(ROOT, file), 'utf8')));
  assert(offenders.length === 0, `combat-rule consumer found in ${offenders.join(', ')}`);
});

check('the player entity stamps a real-but-empty vessel, and refuses one at threshold 0', () => {
  const base = { classId: 'reaver', maxHp: 80, energyMax: 3, drawPerTurn: 5 };
  const stamped = createPlayerCombatEntity({ ...base, poiseMax: 8 });
  assert(stamped.poiseMeter && stamped.poiseMeter.value === 0 && stamped.poiseMeter.max === 8,
    `poiseMax 8 must stamp {value 0, max 8}; got ${JSON.stringify(stamped.poiseMeter)}`);
  const refused = createPlayerCombatEntity({ ...base, poiseMax: 0 });
  assert(!('poiseMeter' in refused), 'threshold 0 must stamp NO meter — the HUD refusal needs the absence, not a 0/0');
  const omitted = createPlayerCombatEntity(base);
  assert(!('poiseMeter' in omitted), 'an unstamped fixture must carry no vessel (legacy shape stays graceful)');
});

check('re-stamping preserves the accumulated value and clamps it; 0 removes the vessel', () => {
  const entity = createPlayerCombatEntity({ classId: 'reaver', maxHp: 80, energyMax: 3, drawPerTurn: 5, poiseMax: 8 });
  entity.poiseMeter.value = 5; // the future writer's build-up, posed
  stampPlayerPoiseMax(entity, 12);
  assert(entity.poiseMeter.value === 5 && entity.poiseMeter.max === 12, 'a swap must not erase build-up');
  stampPlayerPoiseMax(entity, 3);
  assert(entity.poiseMeter.value === 3 && entity.poiseMeter.max === 3, 'a shrunk max must clamp, not overflow');
  stampPlayerPoiseMax(entity, 0);
  assert(!('poiseMeter' in entity), 'threshold 0 must remove the vessel');
});

check('the value has NO writer: dealPoiseDamage refuses a player entity that carries a vessel', () => {
  // Door note: dealPoiseDamage is the one function every poiseDamage opcode
  // funnels into (engine/statuses.js enqueues it; the queue calls it) — the
  // real entry is one stage above, and this check states that rather than
  // claiming the whole pipeline. Known-bad: relax the kind gate in a scratch
  // edit and this goes red (observed 2026-08-14, reverted).
  const player = createPlayerCombatEntity({ classId: 'reaver', maxHp: 80, energyMax: 3, drawPerTurn: 5, poiseMax: 8 });
  const events = [];
  const ctx = {
    registries: { balance: { poise: { growthMult: 1 } }, statuses: { all: () => [] } },
    emit: (type, payload) => events.push({ type, ...payload }),
    enqueue: () => { throw new Error('a player vessel must never enqueue onFill effects'); },
    combatants: () => [player],
  };
  dealPoiseDamage(ctx, player, 9); // above the max — would stagger an enemy
  equal(player.poiseMeter.value, 0, 'player vessel value moved — a writer arrived without its mechanics');
  equal(player.poiseMeter.max, 8, 'player vessel max moved under poise damage');
  assert(events.length === 0, `player poise damage emitted ${JSON.stringify(events)}`);
});

check('WAKE RED — the no-writer premise is probed, and the display refusals must die with it', () => {
  // THE WAKE CONDITION (commons/development.md, *The wake condition*, Freja
  // 2026-08-14). This contract's refusals — the absent-at-0 vessel, the combat
  // tooltip's denial sentence, the receipt's active:false — are all claims
  // about ONE premise: nothing writes player poise. Every check above asserts
  // the REFUSING, and none of them can fail when the premise dies, because
  // absence never fails a test written to expect absence — this vessel sat
  // correctly-absent for six days (2026-08-08 → 14) with the suite agreeing.
  // So this check probes the premise itself, through the same funnel a real
  // writer arrives by (dealPoiseDamage — the function every poiseDamage opcode
  // drains into), against BOTH players the refusal shapes: the vesseled one
  // (does the value move) and the threshold-0 one (does a writer reach the
  // absent vessel — "a resource gains a writer while its bar still refuses").
  // RED when the premise is dead while a refusal artifact still stands, and
  // RED the other way: a dropped refusal while the premise holds is the
  // display claiming mechanics that do not exist.
  const probeCtx = (who) => ({
    registries: { balance: { poise: { growthMult: 1 } }, statuses: { all: () => [] } },
    emit: (type, payload) => who.push({ type, ...payload }),
    enqueue: () => who.push({ type: 'enqueue' }),
    combatants: () => [],
  });
  const events = [];
  const vesseled = createPlayerCombatEntity({ classId: 'reaver', maxHp: 80, energyMax: 3, drawPerTurn: 5, poiseMax: 8 });
  let wrote = false;
  let how = '';
  try {
    dealPoiseDamage(probeCtx(events), vesseled, 9);
    if (vesseled.poiseMeter.value !== 0 || events.length > 0) { wrote = true; how = `value ${vesseled.poiseMeter.value}, ${events.length} event(s)`; }
  } catch (error) { wrote = true; how = `threw on the vesseled player: ${error.message}`; }
  const bare = createPlayerCombatEntity({ classId: 'reaver', maxHp: 80, energyMax: 3, drawPerTurn: 5, poiseMax: 0 });
  try {
    dealPoiseDamage(probeCtx([]), bare, 3);
    if ('poiseMeter' in bare) { wrote = true; how = how || 'a meter appeared on the threshold-0 player'; }
  } catch (error) { wrote = true; how = how || `a writer reached the ABSENT vessel and crashed on it: ${error.message}`; }
  // The refusal artifacts, read at their homes. The denial is read from
  // combat.js SOURCE, not from a rendered tooltip — that string's one home —
  // and the boundary is stated here rather than smoothed: no pixel rendered.
  const denial = /Nothing deals Poise damage to you yet/.test(readFileSync(resolve(ROOT, 'src/ui/screens/combat.js'), 'utf8'));
  const registries = createRegistries(contentBundle);
  const run = createRunState({ seed: 0x5015e, classId: 'reaver', registries });
  const receipt = projectionModel.playerPoiseThresholdReceipt(registries, run);
  if (wrote) {
    assert(!denial && receipt.active === true,
      `THE PREMISE DIED AND A REFUSAL STILL STANDS — a writer moved player poise through dealPoiseDamage (${how}) `
      + `while denial=${denial} (combat.js "Nothing deals Poise damage to you yet"), receipt.active=${receipt.active}. `
      + `Retire the denial sentence and flip the receipt WITH the mechanics, not after them.`);
    return `premise dead (${how}) and every display refusal died with it`;
  }
  assert(denial && receipt.active === false,
    `the premise still holds (no writer) but a refusal artifact already dropped: denial=${denial}, receipt.active=${receipt.active} `
    + `— the display now claims mechanics that do not exist`);
  return 'no writer at the funnel (vesseled and threshold-0 probes both silent); the denial sentence and the inert receipt stand with the premise';
});

check('enemy poiseMeter behavior remains the existing independent system', () => {
  const enemy = createEnemyCombatEntity({ instanceId: 'e1', enemyId: 'probe', hp: 20, poiseMax: 5 });
  const events = [];
  const ctx = {
    registries: { balance: { poise: { growthMult: 1 } }, statuses: { all: () => [] } },
    emit: (type, payload) => events.push({ type, ...payload }),
    enqueue: () => { throw new Error('unexpected poise onFill effect'); },
    combatants: () => [enemy],
  };
  dealPoiseDamage(ctx, enemy, 4);
  equal(enemy.poiseMeter.value, 4, 'enemy meter before fill');
  equal(enemy.skipNextTurn, false, 'enemy staggered early');
  dealPoiseDamage(ctx, enemy, 1);
  equal(enemy.poiseMeter.value, 0, 'enemy meter reset');
  equal(enemy.poiseMeter.max, 5, 'enemy meter maximum');
  equal(enemy.skipNextTurn, true, 'enemy stagger receipt');
  assert(events.some((event) => event.type === 'enemyStaggered'), 'enemy stagger event disappeared');
});

console.log(`\n${failures ? `PLAYER POISE RED — ${failures}/${checks} contracts failing` : `PLAYER POISE GREEN — ${checks}/${checks}`}`);
console.log('DOOR: content by the real bundle import; dealPoiseDamage driven at the funnel every');
console.log('      poiseDamage opcode drains into; the CSV headers and the denial sentence by');
console.log('      readFileSync of the real files. `--selftest` re-observes five known-bads planted');
console.log('      as bytes in a copy of those same files — including the WAKE premise-death at the');
console.log('      writer funnel, red in BOTH directions (observed 2026-08-15, re-runnable). The');
console.log('      header\'s 2026-08-14 scratch-edit observation is superseded: it was one-off and');
console.log('      had drifted to `unknown` under SOP 2. NOT covered: any rendered pixel.');
if (failures) process.exit(1);
