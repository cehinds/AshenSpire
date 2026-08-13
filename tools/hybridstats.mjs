// tools/hybridstats.mjs — observed contract for the integrated Hybrid stats slice.
//
// This gate starts red on the approved Phase1 + inert-derived stack. It checks
// the ownership boundaries before UI polish: the run owns versioned resolved
// rules and real pools, saves migrate them, the host transports them, combat
// consumes their maxima, and the shared HUD refuses to invent absent values.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, validateRunShape } from '../src/model/state.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { RESOURCE_SOURCE_IDS, resourceBarPlan, resourceDomains } from '../src/model/resources.js';
import { createSession } from './session.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REG = createRegistries(contentBundle);
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

function fresh(options = {}) {
  return createRunState({ seed: 0x51a7, classId: 'reaver', registries: REG, ...options });
}

function playerInput(run) {
  return {
    classId: run.class,
    maxHp: run.maxHp,
    hp: run.hp,
    maxMana: run.maxMana,
    mana: run.mana,
    maxStamina: run.maxStamina,
    stamina: run.stamina,
    energyMax: run.energyMax,
    drawPerTurn: run.drawPerTurn,
    deck: run.deck,
    relicIds: run.relics,
    flasks: run.flasks,
    loadout: run.loadout,
  };
}

console.log('hybridstats — integrated derived pools + HUD truth\n');

check('shipping content and registries expose one derived-rules object', () => {
  assert(contentBundle.derivedStatRules, 'contentBundle.derivedStatRules is absent');
  assert(REG.derivedStatRules, 'registries.derivedStatRules is absent');
  assert(REG.derivedStatRules === contentBundle.derivedStatRules, 'registry copied or replaced the authoritative rules object');
});

check('a standard Reaver run owns the versioned snapshot and all approved derived outputs', () => {
  const run = fresh();
  equal(run.derivedStatRuleSnapshot && run.derivedStatRuleSnapshot.rulesetVersion, 1, 'ruleset version');
  equal(run.maxHp, 86, 'CON-derived max HP');
  equal(run.hp, 86, 'new run HP starts full');
  equal(run.maxMana, 42, 'WIS-derived max Mana');
  equal(run.mana, 42, 'new run Mana starts full');
  equal(run.maxStamina, 2, 'CON-derived max Stamina');
  equal(run.stamina, 2, 'new run Stamina starts full');
  equal(run.energyMax, 3, 'DEX-derived Energy');
  equal(run.drawPerTurn, 5, 'INT-derived draw');
  assert(validateRunShape(run).length === 0, `run shape: ${validateRunShape(run).join('; ')}`);
});

check('explicit global/debug overrides are resolved once and remain uncapped', () => {
  const run = fresh({ derivedStatOptions: { explicitOverride: { rules: {
    energy: { base: 4, cap: null },
    draw: { base: 7, cap: null },
    stamina: { gainPerTier: 2, cap: null },
  } } } });
  equal(run.energyMax, 6, 'override Energy');
  equal(run.drawPerTurn, 9, 'override Draw');
  equal(run.maxStamina, 4, 'override Stamina');
  equal(run.derivedStatRuleSnapshot.rules.rules.energy.cap, null, 'snapshot Energy remains uncapped');
  equal(run.derivedStatRuleSnapshot.rules.rules.draw.cap, null, 'snapshot Draw remains uncapped');
});

check('pre-derived save migrates real pools and preserves full/deficit truth', () => {
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  const old = fresh();
  delete old.derivedStatRuleSnapshot;
  delete old.maxStamina;
  delete old.stamina;
  delete old.energyMax;
  delete old.drawPerTurn;
  old.maxHp = 84;
  old.hp = 74; // ten HP missing remains ten HP missing after the max grows.
  old.maxMana = 40;
  old.mana = 40; // full remains full after the max grows.
  saves.saveRun(old);
  const run = saves.loadRun(REG);
  equal(run.maxHp, 86, 'migrated max HP');
  equal(run.hp, 76, 'HP deficit preserved');
  equal(run.maxMana, 42, 'migrated max Mana');
  equal(run.mana, 42, 'full Mana preserved');
  equal(run.maxStamina, 2, 'Stamina created from real attributes');
  equal(run.stamina, 2, 'new Stamina pool starts full');
  equal(run.derivedStatRuleSnapshot.rulesetVersion, 1, 'migration stamps ruleset');
});

check('solo combat consumes run Energy/Draw and transports real Stamina without inventing spend', () => {
  const run = fresh({ derivedStatOptions: { explicitOverride: { rules: { energy: { base: 4 }, draw: { base: 7 } } } } });
  const combat = createCombat({ registries: REG, rng: createRng(99), player: playerInput(run), enemyIds: ['blightHound'] });
  equal(combat.player.energyMax, 6, 'combat Energy max');
  equal(combat.drawPerTurn, 9, 'opening/per-turn draw');
  equal(combat.player.maxStamina, 2, 'combat Stamina max');
  equal(combat.player.stamina, 2, 'combat Stamina current');
  assert(combat.piles.hand.length <= combat.handMax, 'derived draw overflowed handMax');
});

check('host session snapshot is authoritative for derived rules and every current/max pool', () => {
  const S = createSession({ registries: REG, seedString: 'HYBRIDRULES' });
  S.addMember({ id: 'p1', name: 'Wren', classId: 'reaver' });
  S.start();
  const party = S.snapshot().party[0];
  equal(party.derivedStatRuleSnapshot && party.derivedStatRuleSnapshot.rulesetVersion, 1, 'party ruleset');
  equal(party.maxStamina, 2, 'party Stamina max');
  equal(party.stamina, 2, 'party Stamina current');
  equal(party.maxMana, 42, 'party derived Mana max');
  equal(party.energyMax, 3, 'party derived Energy');
  equal(party.drawPerTurn, 5, 'party derived draw');
});

check('shared main-HUD plan shows Mana and real Stamina, never a fabricated trough', () => {
  assert(RESOURCE_SOURCE_IDS.includes('stamina'), 'stamina source reader is absent');
  const run = fresh();
  const plan = resourceBarPlan(REG, 'main', run, run, resourceDomains(REG));
  const mana = plan.find((row) => row.id === 'mana');
  const stamina = plan.find((row) => row.id === 'stamina');
  equal(mana && mana.cur, 42, 'Mana current');
  equal(mana && mana.max, 42, 'Mana max');
  equal(stamina && stamina.cur, 2, 'Stamina current');
  equal(stamina && stamina.max, 2, 'Stamina max');
});

check('Hybrid Stats panel and co-op active-seat HUD use shared data plans', () => {
  const overlay = readFileSync(resolve(ROOT, 'src/ui/components/overlay.js'), 'utf8');
  const coop = readFileSync(resolve(ROOT, 'src/ui/screens/coop.js'), 'utf8');
  assert(/hybridStatsPlan\s*\(/.test(overlay), 'overlay Stats still hard-codes its rows');
  assert(/DRAW PER TURN \/ OPENING HAND/i.test(overlay), 'panel does not state the current shared draw meaning');
  assert(/resourceBarPlan\s*\(registries,\s*['"]main['"]/.test(coop), 'co-op never calls the shared main-HUD plan');
  assert(/resourceBars\s*\(/.test(coop), 'co-op never renders the shared resource plan');
});

console.log(`\n${failures ? `HYBRID STATS RED — ${failures}/${checks} contracts failing` : `HYBRID STATS GREEN — ${checks}/${checks}`}`);
if (failures) process.exit(1);
