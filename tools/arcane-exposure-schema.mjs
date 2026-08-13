// tools/arcane-exposure-schema.mjs — observed-red schema/carrier contract.
//
// This slice stops before engine resolution. It establishes only truthful,
// persisted carriers and a strict configured | immune | absent enemy model.
// Tags are never damage schools. Raw school resistance is never buildup.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { validateContent } from '../src/model/validate.js';
import * as schemaVocabulary from '../src/model/schemas.js';

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
const damageCard = (card) => [...(card.effects || []), ...((card.upgrade && card.upgrade.effects) || [])].some((effect) => effect && effect.op === 'damage');

function mutableBundle() {
  return {
    ...contentBundle,
    cards: contentBundle.cards.map((row) => ({ ...row })),
    enemies: contentBundle.enemies.map((row) => ({
      ...row,
      ...(row.arcaneExposure ? { arcaneExposure: {
        ...row.arcaneExposure,
        ...(row.arcaneExposure.onBreak ? { onBreak: { ...row.arcaneExposure.onBreak } } : {}),
      } } : {}),
      ...(row.damageResistanceBySchool ? { damageResistanceBySchool: { ...row.damageResistanceBySchool } } : {}),
    })),
    equipment: {
      ...contentBundle.equipment,
      basicCardProfiles: contentBundle.equipment.basicCardProfiles.map((row) => ({ ...row })),
    },
  };
}

function errors(bundle) {
  return validateContent(bundle).errors.map((error) => `${error.path}: ${error.msg}`).join('\n');
}

function expectPath(bundle, pattern, label) {
  const said = errors(bundle);
  assert(pattern.test(said), `${label} escaped its exact schema path; errors: ${said.slice(0, 500) || 'none'}`);
}

function configuredEnemy(bundle) {
  return bundle.enemies.find((enemy) => enemy.arcaneExposure && enemy.arcaneExposure.mode === 'configured');
}

console.log('arcane-exposure-schema — carrier and enemy-union contract\n');

check('one authoritative damage-school vocabulary includes physical and magic', () => {
  assert(Array.isArray(schemaVocabulary.DAMAGE_SCHOOLS), 'schemas.js does not export DAMAGE_SCHOOLS');
  assert(schemaVocabulary.DAMAGE_SCHOOLS.includes('physical') && schemaVocabulary.DAMAGE_SCHOOLS.includes('magic'), 'physical/magic missing from school vocabulary');
  const loadout = readFileSync(resolve(ROOT, 'src/model/loadout.js'), 'utf8');
  assert(!/export const DAMAGE_SCHOOLS\s*=/.test(loadout), 'loadout.js still owns a second school vocabulary');
});

check('visible system name has one data-owned Arcane Exposure label', () => {
  equal(contentBundle.balance.arcaneExposure && contentBundle.balance.arcaneExposure.label, 'Arcane Exposure', 'balance.arcaneExposure.label');
});

check('every damage card explicitly authors damageSchool and exposureBuildupPerHit', () => {
  const bad = contentBundle.cards.filter(damageCard).filter((card) => (
    typeof card.damageSchool !== 'string'
      || !Number.isInteger(card.exposureBuildupPerHit)
      || card.exposureBuildupPerHit < 0
  ));
  assert(bad.length === 0, `missing/invalid damage cards: ${bad.map((card) => card.id).join(', ')}`);
  return `${contentBundle.cards.filter(damageCard).length} damage cards`;
});

check('every equipment profile explicitly authors per-hit buildup beside its school', () => {
  const rows = contentBundle.equipment.basicCardProfiles;
  const bad = rows.filter((row) => !Number.isInteger(row.exposureBuildupPerHit) || row.exposureBuildupPerHit < 0);
  assert(bad.length === 0, `missing/invalid profiles: ${bad.map((row) => row.id).join(', ')}`);
  assert(rows.some((row) => row.exposureBuildupPerHit > 0), 'no profile can build Arcane Exposure');
  assert(rows.filter((row) => row.damageSchool === 'physical').every((row) => row.exposureBuildupPerHit === 0), 'physical profile has nonzero buildup');
});

for (const [field, value, pattern] of [
  ['damageSchool', 'magick', /basicCardProfiles\..*damageSchool.*(expected one of|unknown damage school)/i],
  ['exposureBuildupPerHit', 'one', /basicCardProfiles\..*exposureBuildupPerHit.*expected (integer|number)/i],
  ['exposureBuildupPerHit', -1, /basicCardProfiles\..*exposureBuildupPerHit.*(non-negative|>=\s*0)/i],
  ['exposureBuildupPerHit', 1.5, /basicCardProfiles\..*exposureBuildupPerHit.*(whole|integer)/i],
]) {
  check(`profile schema refuses ${field}=${JSON.stringify(value)}`, () => {
    const bundle = mutableBundle();
    bundle.equipment.basicCardProfiles[0][field] = value;
    expectPath(bundle, pattern, `${field} mutant`);
  });
}

check('damage-card schema refuses a missing carrier independently of profiles', () => {
  const bundle = mutableBundle();
  const card = bundle.cards.find(damageCard);
  delete card.exposureBuildupPerHit;
  expectPath(bundle, new RegExp(`cards\\.${card.id}\\.exposureBuildupPerHit`), 'missing card buildup');
});

check('run card instances persist both carriers and resolved definitions agree', () => {
  const registries = createRegistries(contentBundle);
  const run = createRunState({ seed: 0xa7ca, classId: 'starseer', registries });
  const attack = run.deck.find((card) => card.equipmentRole === 'attack');
  assert(attack, 'starting attack instance absent');
  assert(typeof attack.damageSchool === 'string', 'instance damageSchool absent');
  assert(Number.isInteger(attack.exposureBuildupPerHit), 'instance exposureBuildupPerHit absent');
  const resolved = resolveCard(registries, attack);
  equal(resolved.damageSchool, attack.damageSchool, 'resolved school drifted from persisted carrier');
  equal(resolved.exposureBuildupPerHit, attack.exposureBuildupPerHit, 'resolved buildup drifted from persisted carrier');
  const saved = JSON.parse(JSON.stringify(run));
  equal(saved.deck.find((card) => card.instanceId === attack.instanceId).damageSchool, attack.damageSchool, 'save lost school carrier');
});

check('combat cloning preserves the host-authored card carriers', () => {
  const registries = createRegistries(contentBundle);
  const run = createRunState({ seed: 0xc0de, classId: 'starseer', registries });
  const source = run.deck.find((card) => card.equipmentRole === 'attack');
  assert(typeof source.damageSchool === 'string', 'source attack school absent before combat clone');
  assert(Number.isInteger(source.exposureBuildupPerHit), 'source attack buildup absent before combat clone');
  const combat = createCombat({
    registries,
    rng: createRng(0xc0de),
    player: {
      classId: run.class, attributes: run.attributes, maxHp: run.maxHp, hp: run.hp,
      maxMana: run.maxMana, mana: run.mana, maxStamina: run.maxStamina, stamina: run.stamina,
      energyMax: run.energyMax, drawPerTurn: run.drawPerTurn, deck: run.deck,
      relicIds: run.relics, flasks: run.flasks, loadout: run.loadout,
    },
    enemyIds: ['wanderingSoldier'],
  });
  const cards = [...combat.piles.draw, ...combat.piles.hand, ...combat.piles.discard];
  const cloned = cards.find((card) => card.instanceId === source.instanceId);
  assert(cloned, 'combat clone lost attack instance');
  equal(cloned.damageSchool, source.damageSchool, 'combat clone lost school');
  equal(cloned.exposureBuildupPerHit, source.exposureBuildupPerHit, 'combat clone lost buildup');
});

check('enemy content proves configured, immune, and truly absent states', () => {
  const modes = contentBundle.enemies.map((enemy) => enemy.arcaneExposure ? enemy.arcaneExposure.mode : 'absent');
  for (const mode of ['configured', 'immune', 'absent']) assert(modes.includes(mode), `no ${mode} enemy fixture`);
});

check('configured enemy owns the complete provisional policy table', () => {
  const enemy = configuredEnemy(contentBundle);
  assert(enemy, 'configured fixture absent');
  const cfg = enemy.arcaneExposure;
  assert(Number.isInteger(cfg.threshold) && cfg.threshold > 0, 'threshold must be a positive integer');
  assert(Number.isFinite(cfg.buildupMultiplier) && cfg.buildupMultiplier > 0, 'buildupMultiplier must be finite and positive');
  equal(cfg.resetMode, 'zero', 'default reset mode');
  equal(cfg.overflowPolicy, 'discard', 'default overflow policy');
  equal(cfg.lockPolicy, 'whileMagicVulnerable', 'default lock policy');
  assert(cfg.onBreak && cfg.onBreak.status === 'magicVulnerable', 'registered onBreak status');
  assert(Number.isFinite(cfg.onBreak.value) && cfg.onBreak.value > 0, 'onBreak value');
  assert(Number.isInteger(cfg.onBreak.duration) && cfg.onBreak.duration > 0, 'onBreak duration');
});

for (const field of ['threshold', 'buildupMultiplier', 'resetMode', 'overflowPolicy', 'lockPolicy', 'onBreak']) {
  check(`configured union refuses missing ${field}`, () => {
    const bundle = mutableBundle();
    const enemy = configuredEnemy(bundle);
    assert(enemy, 'configured fixture absent before mutation');
    delete enemy.arcaneExposure[field];
    expectPath(bundle, new RegExp(`arcaneExposure\\.${field}`), `missing ${field}`);
  });
}

check('immune union refuses configured-only fields', () => {
  const bundle = mutableBundle();
  const enemy = bundle.enemies.find((row) => row.arcaneExposure && row.arcaneExposure.mode === 'immune');
  assert(enemy, 'immune fixture absent before mutation');
  enemy.arcaneExposure.threshold = 10;
  expectPath(bundle, /arcaneExposure\.threshold/, 'immune threshold');
});

check('raw damageResistanceBySchool is a separate closed-school percent map', () => {
  const authored = contentBundle.enemies.filter((enemy) => enemy.damageResistanceBySchool);
  assert(authored.length > 0, 'no raw school-resistance fixture');
  const schools = new Set(schemaVocabulary.DAMAGE_SCHOOLS || []);
  for (const enemy of authored) {
    assert(enemy.damageResistanceBySchool !== enemy.arcaneExposure, `${enemy.id} aliases exposure and resistance`);
    for (const [school, percent] of Object.entries(enemy.damageResistanceBySchool)) {
      assert(schools.has(school), `${enemy.id} unknown resistance school ${school}`);
      assert(Number.isFinite(percent) && percent >= 0 && percent <= 100, `${enemy.id}.${school} invalid percent ${percent}`);
    }
  }
});

check('resistance validator refuses unknown schools and out-of-range percents by path', () => {
  const bundle = mutableBundle();
  bundle.enemies[0].damageResistanceBySchool = { magick: 20, magic: 101 };
  const said = errors(bundle);
  assert(/damageResistanceBySchool\.magick/i.test(said), 'unknown resistance school escaped');
  assert(/damageResistanceBySchool\.magic/i.test(said), 'out-of-range resistance escaped');
});

check('Magic Vulnerable is registered but cannot become generic vulnerability', () => {
  const status = contentBundle.statuses.find((row) => row.id === 'magicVulnerable');
  assert(status, 'registered magicVulnerable status absent');
  assert(!status.modifiers || !own(status.modifiers, 'damageTakenMult'), 'Magic Vulnerable would affect non-magic HP packets');
  assert(!status.taggedVulnerability, 'Magic Vulnerable infers schools from tags');
});

check('schema/carrier slice has no Arcane Exposure engine or meter implementation', () => {
  const forbidden = ['src/model/state.js', 'src/engine/actions.js', 'src/engine/combat.js', 'src/engine/coopCombat.js'];
  const offenders = forbidden.filter((file) => /arcaneExposure|magicVulnerable/i.test(readFileSync(resolve(ROOT, file), 'utf8')));
  assert(offenders.length === 0, `engine work landed before checkpoint: ${offenders.join(', ')}`);
});

console.log(`\n${failures ? `ARCANE EXPOSURE SCHEMA RED — ${failures}/${checks} contracts failing` : `ARCANE EXPOSURE SCHEMA GREEN — ${checks}/${checks}`}`);
if (failures) process.exit(1);
