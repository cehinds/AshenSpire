// tools/player-poise-threshold.mjs — observed-red contract for inert player Poise.
//
// Player Poise is a truthful equipment receipt only. It is deliberately NOT
// the enemy poise meter: no player state field, HUD bar, combat consumer,
// stagger behavior, or save/session authority is introduced by this slice.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, createEnemyCombatEntity } from '../src/model/state.js';
import { dealPoiseDamage } from '../src/engine/actions.js';
import { validateContent } from '../src/model/validate.js';
import { PASSIVE_TYPES } from '../src/model/schemas.js';
import * as projectionModel from '../src/model/statProjection.js';

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

check('one pure playerPoiseThresholdReceipt reader owns the projection', () => {
  assert(typeof projectionModel.playerPoiseThresholdReceipt === 'function', 'statProjection.js does not export playerPoiseThresholdReceipt');
  const registries = createRegistries(contentBundle);
  const run = createRunState({ seed: 0x5015e, classId: 'reaver', registries });
  const before = JSON.stringify(run);
  const receipt = projectionModel.playerPoiseThresholdReceipt(registries, run);
  equal(JSON.stringify(run), before, 'receipt reader mutated the run');
  assert(receipt && Array.isArray(receipt.sources), 'receipt.sources is absent');
  assert(Number.isFinite(receipt.equipment) && Number.isFinite(receipt.relic), 'receipt subtotals are not finite');
  equal(receipt.raw, receipt.equipment + receipt.relic, 'receipt raw subtotal');
  equal(receipt.value, receipt.raw, 'inert receipt value');
  equal(receipt.active, false, 'receipt must explicitly remain inert');
  assert(/no current consumer/i.test(receipt.note || ''), 'receipt does not disclose that it has no consumer');
});

check('the player model, combat engine, and HUD resource plan have no Poise consumer', () => {
  const forbidden = [
    'src/model/state.js',
    'src/engine/combat.js',
    'src/engine/coopCombat.js',
    'src/engine/actions.js',
    'src/model/resources.js',
    'src/content/resources.js',
  ];
  const offenders = forbidden.filter((file) => /poiseThreshold/i.test(readFileSync(resolve(ROOT, file), 'utf8')));
  assert(offenders.length === 0, `consumer/state claim found in ${offenders.join(', ')}`);
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
if (failures) process.exit(1);
