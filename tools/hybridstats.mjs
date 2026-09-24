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
import { createCoopCombat, playCard as playCoopCard } from '../src/engine/coopCombat.js';
import { createRng } from '../src/engine/rng.js';
import { RESOURCE_SOURCE_IDS, resourceBarPlan, resourceDomains } from '../src/model/resources.js';
import { createSession } from './session.mjs';
import { statProjection } from '../src/model/statProjection.js';
import { derivedStatRules } from '../src/content/derivedStats.js';

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
  // Ruleset 7 (plan A3), worked by hand from src/content/derivedStats.js for the
  // lean Reaver (STR 3, DEX 1, CON 2, WIS 1, INT 1):
  //   HP      36 + floor(2 x 2) = 40, plus the Forsaken Medallion's flat 10
  //   Mana     1 + floor(1 x 1) = 2      Stamina  1 + floor(2 x 1) = 3
  //   Actions  3 + floor(1 x 0.25) = 3   draw     3 + floor(1 x 0.2) = 3
  equal(run.derivedStatRuleSnapshot && run.derivedStatRuleSnapshot.rulesetVersion, 7, 'ruleset version (7: plan A3)');
  equal(run.maxHp, 50, 'CON-derived max HP plus the starter relic');
  equal(run.hp, 50, 'new run HP starts full');
  equal(run.maxMana, 2, 'WIS-derived max Mana has no class base');
  equal(run.mana, 2, 'new run Mana starts full');
  equal(run.maxStamina, 3, 'CON-derived max Stamina');
  equal(run.stamina, 3, 'new run Stamina starts full');
  equal(run.energyMax, 3, 'DEX-derived Energy');
  equal(run.drawPerTurn, 3, 'INT-derived draw');
  assert(validateRunShape(run).length === 0, `run shape: ${validateRunShape(run).join('; ')}`);
});

check('explicit global/debug overrides are resolved once and remain uncapped', () => {
  const run = fresh({ derivedStatOptions: { explicitOverride: { rules: {
    energy: { base: 4, cap: null },
    draw: { base: 7, cap: null },
    // Ruleset 6 (#1253): Stamina's coefficient is its Constitution weight.
    stamina: { constitution: 2, cap: null },
  } } } });
  // The lean Reaver opens DEX 1, INT 1, CON 2: 4 + floor(1 x 0.2), 7 +
  // floor(1 x 0.2), and Stamina's base 1 + floor(2 x 2).
  equal(run.energyMax, 4, 'override Energy');
  equal(run.drawPerTurn, 7, 'override Draw');
  equal(run.maxStamina, 5, 'override Stamina');
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
  old.mana = 20; // a half-full legacy pool remains half-full in small units.
  saves.saveRun(old);
  const run = saves.loadRun(REG);
  equal(run.maxHp, 50, 'migrated max HP under the Constitution weight');
  equal(run.hp, 40, 'HP deficit of 10 preserved across the migration');
  equal(run.maxMana, 2, 'migrated max Mana');
  equal(run.mana, 1, 'legacy Mana proportion preserved');
  equal(run.maxStamina, 3, 'Stamina created from real attributes');
  equal(run.stamina, 3, 'new Stamina pool starts full');
  equal(run.derivedStatRuleSnapshot.rulesetVersion, 7, 'migration stamps ruleset');
});

check('solo combat consumes run Energy/Draw and transports real Stamina without inventing spend', () => {
  const run = fresh({ derivedStatOptions: { explicitOverride: { rules: { energy: { base: 4 }, draw: { base: 7 } } } } });
  const combat = createCombat({ registries: REG, rng: createRng(99), player: playerInput(run), enemyIds: ['blightHound'] });
  // Override base 4 + floor(DEX 1 x 0.25) = 4 (ruleset 7, lean Reaver).
  equal(combat.player.energyMax, 4, 'combat Energy max');
  equal(combat.drawPerTurn, 7, 'opening/per-turn draw (override base 7 + floor(INT 1 x 0.2))');
  equal(combat.player.maxStamina, 3, 'combat Stamina max');
  equal(combat.player.stamina, 3, 'combat Stamina current');
  assert(combat.piles.hand.length <= combat.handMax, 'derived draw overflowed handMax');
});

check('host session snapshot is authoritative for derived rules and every current/max pool', () => {
  const S = createSession({ registries: REG, seedString: 'HYBRIDRULES' });
  S.addMember({ id: 'p1', name: 'Wren', classId: 'reaver' });
  S.start();
  const party = S.snapshot().party[0];
  equal(party.derivedStatRuleSnapshot && party.derivedStatRuleSnapshot.rulesetVersion, 7, 'party ruleset');
  equal(party.maxStamina, 3, 'party Stamina max');
  equal(party.stamina, 3, 'party Stamina current');
  equal(party.maxMana, 2, 'party derived Mana max');
  equal(party.energyMax, 3, 'party derived Energy');
  equal(party.drawPerTurn, 3, 'party derived draw');
});

check('shared main-HUD plan shows Mana and real Stamina, never a fabricated trough', () => {
  assert(RESOURCE_SOURCE_IDS.includes('stamina'), 'stamina source reader is absent');
  const run = fresh();
  const plan = resourceBarPlan(REG, 'main', run, run, resourceDomains(REG));
  const mana = plan.find((row) => row.id === 'mana');
  const stamina = plan.find((row) => row.id === 'stamina');
  equal(mana && mana.cur, 2, 'Mana current');
  equal(mana && mana.max, 2, 'Mana max');
  equal(stamina && stamina.cur, 3, 'Stamina current');
  equal(stamina && stamina.max, 3, 'Stamina max');
});

check('Mana authority is WIS data and gameplay uses small-unit costs/restores', () => {
  // Ruleset 6 restated the bases: Mana opens on 1 (src/content/derivedStats.js).
  equal(derivedStatRules.rules.mana.base, 1, 'Mana base');
  equal(derivedStatRules.rules.mana.wisdom, 1, 'Mana source (ruleset 6: a weight on wisdom)');
  equal(derivedStatRules.rules.mana.cap ?? derivedStatRules.defaults.cap, null, 'Mana cap');
  for (const id of ['gorefireSlash', 'starstoneArc', 'urgentHeal']) {
    equal(contentBundle.cards.find((card) => card.id === id)?.manaCost, 1, `${id} Mana cost`);
  }
  const azure = contentBundle.flasks.find((flask) => flask.id === 'azureFlask');
  equal(azure.effects.find((effect) => effect.op === 'restoreMana')?.amount, 1, 'Azure restore');
  assert(!REG.classes.all().some((row) => Object.hasOwn(row, 'maxMana')), 'class data still authors maxMana');
});

check('Mana semantic constant scan refuses legacy class-scale authority', () => {
  const classSource = readFileSync(resolve(ROOT, 'src/content/classes.js'), 'utf8');
  const ruleSource = readFileSync(resolve(ROOT, 'src/content/derivedStats.js'), 'utf8');
  const cardSources = ['reaver', 'starseer', 'herald'].map((name) => readFileSync(resolve(ROOT, `src/content/cards/${name}.js`), 'utf8')).join('\n');
  const flaskSource = readFileSync(resolve(ROOT, 'src/content/flasks.js'), 'utf8');
  assert(!/maxMana\s*:\s*(40|60|80)\b/.test(classSource), 'legacy class Mana maximum remains');
  assert(!/rules:\s*\{[\s\S]*?mana:\s*\{[\s\S]*?classField[\s\S]*?maxMana/.test(ruleSource), 'Mana still reads class maxMana');
  assert(!/manaCost\s*:\s*10\b/.test(cardSources), 'legacy signature Mana cost remains');
  assert(!/id:\s*['"]azureFlask['"][\s\S]*?restoreMana['"],\s*amount:\s*20\b/.test(flaskSource), 'legacy Azure restore remains');
});

check('co-op UI affordability and host execution agree for all three Mana signatures', () => {
  const coopSource = readFileSync(resolve(ROOT, 'src/ui/screens/coop.js'), 'utf8');
  assert(/meP\.mana\s*>=\s*(\(def\.manaCost\s*\|\|\s*0\)|costs\.mana)/.test(coopSource), 'co-op hand omits Mana from affordability');
  for (const cardId of ['gorefireSlash', 'starstoneArc', 'urgentHeal']) {
    const fight = (mana) => createCoopCombat({
      registries: REG,
      rng: createRng(0x6d616e61),
      players: [{
        id: 'p1', classId: REG.cards.get(cardId).class, maxHp: 84, hp: 84,
        maxMana: 2, mana, maxStamina: 2, stamina: 2,
        energyMax: 3, drawPerTurn: 5,
        deck: [{ instanceId: `i-${cardId}`, cardId, upgraded: false }], relicIds: [], flasks: [],
      }],
      enemyIds: ['blightHound'],
    });
    const empty = fight(0);
    let refusal = '';
    // A self-only card (Urgent Heal) takes no enemy target; the host refuses one.
    const target = REG.cards.get(cardId).effects.every((effect) => effect.target === 'self') ? undefined : 'e1';
    try { playCoopCard(empty, 'p1', `i-${cardId}`, target); } catch (error) { refusal = error.message; }
    assert(/Not enough mana/.test(refusal), `${cardId} host did not refuse zero Mana`);
    const funded = fight(1);
    playCoopCard(funded, 'p1', `i-${cardId}`, target);
    equal(funded.players.get('p1').entity.mana, 0, `${cardId} host Mana after spend`);
    assert(funded.eventLog.some((event) => event.type === 'manaSpent' && event.amount === 1), `${cardId} missing spend receipt`);
  }
});

check('Hybrid Stats panel and co-op active-seat HUD use shared data plans', () => {
  const overlay = readFileSync(resolve(ROOT, 'src/ui/components/overlay.js'), 'utf8');
  const equipment = readFileSync(resolve(ROOT, 'src/ui/screens/equipment.js'), 'utf8');
  const projection = readFileSync(resolve(ROOT, 'src/model/statProjection.js'), 'utf8');
  const coop = readFileSync(resolve(ROOT, 'src/ui/screens/coop.js'), 'utf8');
  assert(/hybridStatsPlan\s*\(/.test(overlay), 'overlay Stats still hard-codes its rows');
  assert(/run\.stats[\s\S]*Fights won[\s\S]*Damage dealt[\s\S]*Damage taken/.test(equipment),
    'Armoury Stats does not preserve the active run telemetry removed from the menu');
  assert(/Legacy draw value for LAN and older saved fights/.test(projection), 'projection does not state the current shared draw meaning');
  assert(/resourceBarPlan\s*\(registries,\s*['"]main['"]/.test(coop), 'co-op never calls the shared main-HUD plan');
  assert(/resourceBars\s*\(/.test(coop), 'co-op never renders the shared resource plan');
});

check('one projection exports attribute scaling receipts for Overlay, Armoury and creation', () => {
  const run = fresh();
  const projection = statProjection(REG, run);
  equal(projection.attributes.length, 5, 'attribute rows');
  for (const id of ['hp', 'mana', 'stamina', 'energy', 'draw']) {
    const row = projection.derived.find((entry) => entry.id === id);
    assert(row, `missing ${id} receipt`);
    assert(Number.isFinite(row.base) && Number.isFinite(row.tier) && Number.isFinite(row.value), `${id} receipt is not numeric`);
    assert(typeof row.formula === 'string' && row.formula.includes(String(row.value)), `${id} formula omits result`);
  }
  const equipment = readFileSync(resolve(ROOT, 'src/ui/screens/equipment.js'), 'utf8');
  const customize = readFileSync(resolve(ROOT, 'src/ui/screens/customize.js'), 'utf8');
  assert(/statProjection\s*\(/.test(equipment), 'Armoury does not consume the shared projection');
  assert(/statProjection\s*\(/.test(customize), 'character creation does not consume the shared projection');
});

console.log(`\n${failures ? `HYBRID STATS RED — ${failures}/${checks} contracts failing` : `HYBRID STATS GREEN — ${checks}/${checks}`}`);
if (failures) process.exit(1);
