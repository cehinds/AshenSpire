// tools/conhp.mjs — D22 Constitution/HP authority contract.
//
// Same production doors used here:
//   content -> validateContent/createRegistries -> createRunState
//   persisted run -> createSaveManager.loadRun -> run normalization/migration
// Expectations are derived from the current resolved rule snapshot so a ruleset
// change cannot leave this instrument permanently red for an obsolete formula.

import { contentBundle } from '../src/content/index.js';
import { RELIC_MODIFIER_TAGS } from '../src/model/schemas.js';
import { createRegistries } from '../src/model/registries.js';
import { validateContent } from '../src/model/validate.js';
import { createRunState } from '../src/model/state.js';
import { deriveStat } from '../src/model/derivedStats.js';
import { equipPiece, runMods, stampDeck } from '../src/model/loadout.js';
import { createMemoryStorage, createSaveManager, RUN_KEY, RUN_ARCHIVE_KEY } from '../src/engine/save.js';
import { executeRunEffects } from '../src/engine/actions.js';
import { createRng } from '../src/engine/rng.js';
import { relicText } from '../src/ui/components/card.js';
import { readFileSync } from 'node:fs';

let checks = 0;
let failures = 0;
const check = (name, fn) => {
  checks++;
  try {
    const detail = fn();
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    failures++;
    console.log(`FAIL  ${name} — ${error?.message || error}`);
  }
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const eq = (actual, expected, message) => assert(Object.is(actual, expected), `${message}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
const clone = (value) => structuredClone(value);
const cloneBundle = () => ({
  ...contentBundle,
  attributes: clone(contentBundle.attributes),
  classes: clone(contentBundle.classes),
  relics: clone(contentBundle.relics),
  attributeRules: clone(contentBundle.attributeRules),
  derivedStatRules: clone(contentBundle.derivedStatRules),
});

const relicModifiers = (registries, relicIds) => (relicIds || []).flatMap((id) => (
  registries.relics.get(id).passives?.modifiers || []
));
const resourceModifierBonus = (registries, relicIds, resource, attributes) => relicModifiers(registries, relicIds)
  .filter((row) => row.resource === resource)
  .reduce((sum, row) => {
    if (row.tag === 'resource.flat') return sum + row.amount;
    if (row.tag === 'resource.attributeTier') {
      return sum + Math.floor(attributes[row.sourceStat] / row.pointsPerTier) * row.amountPerTier;
    }
    return sum;
  }, 0);
const expectedHp = (registries, run) => {
  const cls = registries.classes.get(run.class);
  const gear = runMods(registries, run.loadout, run.class).maxHp;
  const hp = deriveStat(run.derivedStatRuleSnapshot.rules, 'hp', {
    attributes: run.attributes,
    classDef: cls,
  });
  return Math.max(1, hp.value + gear + (run.maxHpAdjustment || 0));
};

console.log('conhp — D22 Constitution HP formula (door: content boot + run load)\n');

check('the five authored attributes restore Constitution in the third seat', () => {
  eq(contentBundle.attributes.map((row) => row.id).join(','),
    'strength,dexterity,constitution,wisdom,intelligence', 'attribute ids');
  eq(contentBundle.attributes[2].shortLabel, 'CON', 'third short label');
});

check('the retired-name door migrates Vigour to Constitution, never the reverse', () => {
  eq(contentBundle.attributeRules.retired.vigour, 'constitution', 'Vigour heir');
  assert(!Object.hasOwn(contentBundle.attributeRules.retired, 'constitution'), 'Constitution is still marked retired');
});

check('HP and Stamina consume Constitution; HP follows the resolved per-point rule', () => {
  const hp = contentBundle.derivedStatRules.rules.hp;
  const stamina = contentBundle.derivedStatRules.rules.stamina;
  eq(hp.sourceStat, 'constitution', 'HP source');
  eq(hp.base, 30, 'HP base');
  eq(hp.pointsPerTier ?? contentBundle.derivedStatRules.defaults.pointsPerTier, 1, 'HP points per tier');
  eq(hp.gainPerTier, 2, 'HP gain per tier');
  eq(stamina.sourceStat, 'constitution', 'Stamina source');
});


check('starter relic bonuses use the one closed modifier-tag list, not relic-id branches', () => {
  for (const cls of contentBundle.classes) {
    const relic = contentBundle.relics.find((row) => row.id === cls.startingRelic);
    assert(relic, `${cls.id} starting relic is missing`);
    assert(Array.isArray(relic.passives?.modifiers), `${relic.id}.passives.modifiers is missing`);
    for (const row of relic.passives.modifiers) {
      // IMPORTED, never re-typed. This line held a hand-typed copy of the three
      // tags until 2026-08-15: it AGREED with the declaration, which is exactly
      // how a second home survives (SOP 5 — agreement is not synchronization),
      // and it sat inside the check whose own name says "the ONE closed list".
      // tools/onevocab.mjs A1 is what found it and what keeps it collapsed.
      assert(RELIC_MODIFIER_TAGS.includes(row.tag),
        `${relic.id} has unknown modifier tag '${row.tag}'`);
    }
  }
});

check('the production content door rejects an unknown relic modifier tag by name', () => {
  const bad = cloneBundle();
  const relic = bad.relics.find((row) => row.id === bad.classes[0].startingRelic);
  relic.passives ||= {};
  relic.passives.modifiers = [{ tag: 'resource.mystery', resource: 'hp', amount: 1 }];
  const result = validateContent(bad);
  assert(!result.ok, 'validateContent accepted an unknown relic modifier tag');
  assert(result.errors.some((row) => `${row.path} ${row.msg}`.includes('resource.mystery')),
    `unknown tag was not named: ${JSON.stringify(result.errors)}`);
});

check('the production content door rejects malformed attribute-tier modifier data by path', () => {
  const bad = cloneBundle();
  const relic = bad.relics.find((row) => row.id === bad.classes[0].startingRelic);
  relic.passives ||= {};
  relic.passives.modifiers = [{ tag: 'resource.attributeTier', resource: 'hp', sourceStat: 'constitution', pointsPerTier: 0, amountPerTier: 1 }];
  const result = validateContent(bad);
  assert(!result.ok, 'validateContent accepted pointsPerTier 0');
  assert(result.errors.some((row) => `${row.path} ${row.msg}`.includes('pointsPerTier')),
    `bad tier width was not named: ${JSON.stringify(result.errors)}`);
});

check('the production content door reports modifiers:null by its named path instead of throwing', () => {
  const bad = cloneBundle();
  const relic = bad.relics.find((row) => row.id === bad.classes[0].startingRelic);
  relic.passives.modifiers = null;
  let result;
  try { result = validateContent(bad); }
  catch (error) { throw new Error(`validateContent threw ${error?.name}: ${error?.message}`); }
  assert(!result.ok, 'validateContent accepted modifiers:null');
  assert(result.errors.some((row) => row.path === `relics.${relic.id}.passives.modifiers` && row.msg.includes('array')),
    `named array refusal missing: ${JSON.stringify(result.errors)}`);
});

check('attribute-tier relic rows must fold into their target resource rule at content boot', () => {
  for (const [field, value] of [['sourceStat', 'constitution'], ['pointsPerTier', 4]]) {
    const bad = cloneBundle();
    const relic = bad.relics.find((row) => row.id === 'starstoneShard');
    relic.passives.modifiers = [{
      tag: 'resource.attributeTier', resource: 'mana', sourceStat: 'wisdom', pointsPerTier: 5, amountPerTier: 1,
      [field]: value,
    }];
    const result = validateContent(bad);
    assert(!result.ok, `validateContent accepted incompatible ${field}`);
    assert(result.errors.some((row) => row.path === `relics.starstoneShard.passives.modifiers[0].${field}`),
      `${field} refusal did not name its row: ${JSON.stringify(result.errors)}`);
  }
});

check('attribute-tier relic rows reject a non-floor target rule at content boot', () => {
  const bad = cloneBundle();
  const relic = bad.relics.find((row) => row.id === 'forsakenMedallion');
  relic.passives.modifiers.push({
    tag: 'resource.attributeTier', resource: 'hp', sourceStat: 'constitution',
    pointsPerTier: 1, amountPerTier: 1,
  });
  bad.derivedStatRules.rules.hp.rounding = 'ceil';
  const result = validateContent(bad);
  assert(!result.ok, 'validateContent accepted hp rounding=ceil with a tier-folding relic');
  assert(result.errors.some((row) => row.path === 'relics.forsakenMedallion.passives.modifiers[1]' && row.msg.includes('rounding')),
    `rounding refusal did not name the modifier row: ${JSON.stringify(result.errors)}`);
});

check('starter relic display numbers derive from modifier rows, never duplicated prose', () => {
  const source = cloneBundle();
  const relic = source.relics.find((row) => row.id === 'starstoneShard');
  relic.passives.modifiers[0].amount = 3;
  relic.passives.modifiers[1].amount = 4;
  const text = relicText(relic, createRegistries(source));
  assert(text.includes('Mana +3'), `Mana modifier did not reach text: ${text}`);
  assert(text.includes('Magic damage +4'), `magic modifier did not reach text: ${text}`);
  assert(!text.includes('Mana +1') && !text.includes('Magic damage +1'), `stale duplicated values survived: ${text}`);
});



check('fresh runs match the resolved HP receipt plus equipment', () => {
  const registries = createRegistries(contentBundle);
  for (const cls of registries.classes.all()) {
    const run = createRunState({ seed: 0xd220 + cls.id.length, classId: cls.id, registries });
    eq(run.maxHp, expectedHp(registries, run), `${cls.id} maxHp`);
    eq(run.hp, run.maxHp, `${cls.id} begins full`);
  }
});

check('fresh runs declare a permanent max-HP adjustment ledger at zero', () => {
  const registries = createRegistries(contentBundle);
  const run = createRunState({ seed: 0xd22, classId: 'reaver', registries });
  eq(run.maxHpAdjustment, 0, 'fresh maxHpAdjustment');
});

check('each adjacent CON point adds exactly the resolved HP gain', () => {
  const atCon = (constitution) => {
    const source = cloneBundle();
    const row = clone(source.attributeRules.presets.tuned.reaver);
    const delta = constitution - row.constitution;
    row.constitution = constitution;
    row.strength -= delta;
    const registries = createRegistries(source);
    return {
      run: createRunState({ seed: 0x10 + constitution, classId: 'reaver', registries, attributes: row }),
      registries,
    };
  };
  const at10 = atCon(10).run;
  const at14 = atCon(14).run;
  const { run: at15, registries } = atCon(15);
  const hp = at15.derivedStatRuleSnapshot.rules.rules.hp;
  eq(at14.maxHp - at10.maxHp, 4 * hp.gainPerTier, 'four CON points add four resolved gains');
  eq(at15.maxHp - at14.maxHp, hp.gainPerTier, 'one CON point adds one resolved gain');
});

check('the legacy class coefficient is gone from the classes, not merely unread (#484)', () => {
  for (const cls of contentBundle.classes) {
    assert(!('hpPerConTier' in cls), `${cls.id} still authors hpPerConTier — the field was removed because no rule read it`);
  }
  const registries = createRegistries(cloneBundle());
  const run = createRunState({ seed: 0x21, classId: 'reaver', registries });
  eq(Number.isInteger(run.maxHp) && run.maxHp > 0, true, 'HP still derives from class maxHp + the CON rule with the field gone');
});

check('WIS 15 gives three Mana and the Starseer starter relic adds one flat Mana, total four', () => {
  const registries = createRegistries(contentBundle);
  const attrs = { strength: 8, dexterity: 10, constitution: 10, wisdom: 15, intelligence: 10 };
  const run = createRunState({
    seed: 0x2515, classId: 'starseer', registries, attributes: attrs,
    startingKitId: 'starseerStarstone', profileMeta: { discoveredArmaments: ['starstoneStaff'] },
  });
  eq(Math.floor(run.attributes.wisdom / 5), 3, 'Wisdom tiers');
  eq(resourceModifierBonus(registries, run.relics, 'mana', run.attributes), 1, 'flat relic Mana');
  eq(run.maxMana, 4, 'starting Mana');
});

check('a Vigour-era save migrates its allocation and rule snapshot back to Constitution', () => {
  const registries = createRegistries(contentBundle);
  const old = createRunState({ seed: 0x50, classId: 'reaver', registries });
  const allocation = old.attributes.constitution ?? old.attributes.vigour;
  old.attributes.vigour = allocation;
  delete old.attributes.constitution;
  old.derivedStatRuleSnapshot.rulesetVersion = 2;
  old.derivedStatRuleSnapshot.snapshotVersion = 1;
  old.derivedStatRuleSnapshot.rules.rulesetVersion = 2;
  delete old.derivedStatRuleSnapshot.relicModifiers;
  for (const id of ['hp', 'stamina']) old.derivedStatRuleSnapshot.rules.rules[id].sourceStat = 'vigour';
  Object.assign(old.derivedStatRuleSnapshot.rules.rules.hp, { pointsPerTier: 1, gainPerTier: 1 });
  const storage = createMemoryStorage();
  storage.setItem(RUN_KEY, JSON.stringify(old));
  const loaded = createSaveManager(storage).loadRun(registries);
  assert(loaded, 'Vigour-era save did not load');
  assert(!Object.hasOwn(loaded.attributes, 'vigour'), 'Vigour survived migration');
  eq(loaded.attributes.constitution, old.attributes.vigour, 'allocation preserved');
  eq(loaded.derivedStatRuleSnapshot.rulesetVersion, contentBundle.derivedStatRules.rulesetVersion, 'snapshot migrated to current ruleset');
  eq(loaded.maxHp, expectedHp(registries, loaded), 'HP rederived through D22');
});

check('a mixed Constitution/Vigour save is refused rather than silently choosing one value', () => {
  const registries = createRegistries(contentBundle);
  const old = createRunState({ seed: 0x51, classId: 'reaver', registries });
  const allocation = old.attributes.constitution ?? old.attributes.vigour;
  old.attributes.constitution = allocation;
  old.attributes.vigour = allocation + 1;
  const storage = createMemoryStorage();
  storage.setItem(RUN_KEY, JSON.stringify(old));
  const loaded = createSaveManager(storage).loadRun(registries);
  eq(loaded, null, 'mixed-vocabulary save result');
});

check('new host snapshots carry the resolved data-owned HP rule', () => {
  const registries = createRegistries(contentBundle);
  const run = createRunState({ seed: 0xc00, classId: 'herald', registries });
  const hp = run.derivedStatRuleSnapshot.rules.rules.hp;
  eq(hp.sourceStat, 'constitution', 'snapshot source');
  assert(Number.isFinite(hp.base), 'snapshot HP base must be host-resolved numeric data');
  assert(Number.isFinite(hp.gainPerTier), 'snapshot HP coefficient must be host-resolved numeric data');
  eq(run.maxHp, expectedHp(registries, run), 'host-stamped maxHp');
});

check('a current host snapshot missing one damage-school key is refused at the save door', () => {
  const registries = createRegistries(contentBundle);
  const run = createRunState({ seed: 0x5c001, classId: 'starseer', registries });
  delete run.derivedStatRuleSnapshot.relicModifiers.damageBySchoolAdd.magic;
  run.damageBySchoolAdd.magic = 0;
  const storage = createMemoryStorage();
  storage.setItem(RUN_KEY, JSON.stringify(run));
  eq(createSaveManager(storage).loadRun(registries), null, 'incomplete snapshot load result');
});

check('permanent max-HP loss and the current HP deficit survive save re-derivation', () => {
  const registries = createRegistries(contentBundle);
  const run = createRunState({ seed: 0xc022, classId: 'reaver', registries });
  run.hp = run.maxHp - 26;
  const beforeMax = run.maxHp;
  executeRunEffects({ run, registries, rng: createRng(0xc022) }, [{ op: 'loseMaxHpPct', pct: 10 }]);
  eq(run.maxHpAdjustment, run.maxHp - beforeMax, 'curse ledger records the exact max-HP delta');
  const cursedMax = run.maxHp;
  const cursedHp = run.hp;
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  saves.saveRun(run, createRng(0xc022));
  const loaded = saves.loadRun(registries);
  assert(loaded, 'cursed run did not load');
  eq(loaded.maxHp, cursedMax, 'permanent curse survives');
  eq(loaded.hp, cursedHp, 'absolute current HP deficit survives');
  eq(loaded.maxHpAdjustment, run.maxHpAdjustment, 'ledger survives');
});

check('Armoury loadout change reconciles equipment HP and survives equip -> save -> load', () => {
  const registries = createRegistries(contentBundle);
  const run = createRunState({ seed: 0xea11, classId: 'herald', registries });
  run.hp = run.maxHp - 7;
  const oldMax = run.maxHp;
  const edited = structuredClone(run.loadout);
  assert(equipPiece(registries, edited, 'armor', 0, 'pilgrim', { has: () => true }, {
    inCombat: false, attributes: run.attributes,
  }), 'Pilgrim Wrap did not equip through equipPiece');
  run.loadout = edited;
  stampDeck(registries, run);
  eq(run.maxHp, oldMax + 4, 'equipment max HP reconciled');
  eq(run.maxHp - run.hp, 7, 'absolute HP deficit preserved');
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  saves.saveRun(run, createRng(0xea11));
  const loaded = saves.loadRun(registries);
  assert(loaded, 'equipped run was archived/refused on reload');
  eq(loaded.maxHp, run.maxHp, 'equipped max HP round-trips');
  eq(loaded.hp, run.hp, 'equipped current HP round-trips');
});


// ---------------------------------------------------------------------------
// THE SAVE THAT WENT AND CAME BACK (Vira, 2026-08-15).
//
// The checks above build their Vigour-era save by editing a run this tree
// created, and test 50c builds one by string-replacing "constitution" with
// "vigour" in a Constitution-era fixture. Both are reconstructions, and a
// reconstruction can only carry the differences its author remembered: neither
// carries the Vigour tree's own hp override (pointsPerTier 1 / gainPerTier 1)
// or its schemaVersion 3, which is exactly what a real save from that window
// has. tests/fixtures/run-save-vigour-window.json is not a reconstruction — it
// is the bytes createSaveManager.saveRun actually wrote at dev = 5f58bca and
// dev = d7d1920, preserved as migration evidence from that shipped window.
//
// The claim: Constitution -> Vigour -> Constitution loses nothing. Not "loads",
// not "does not throw" — the round-tripped save and its never-renamed twin
// arrive at THE SAME player-visible state, field for field.
const windowFixture = (() => {
  try { return JSON.parse(readFileSync(new URL('../tests/fixtures/run-save-vigour-window.json', import.meta.url), 'utf8')); }
  catch { return null; }
})();

const loadThroughDoor = (registries, save) => {
  const storage = createMemoryStorage();
  storage.setItem(RUN_KEY, JSON.stringify(save));
  return createSaveManager(storage).loadRun(registries);
};
const PLAYER_VISIBLE = ['class', 'maxHp', 'hp', 'maxHpAdjustment', 'maxMana', 'mana', 'maxStamina',
  'stamina', 'energyMax', 'drawPerTurn', 'cinders', 'floor', 'actNumber', 'attributes', 'relics'];
const visible = (run) => JSON.stringify(Object.fromEntries(PLAYER_VISIBLE.map((k) => [k, run[k]])));

check('a REAL Vigour-window save loads, and the round trip Constitution -> Vigour -> Constitution is lossless', () => {
  assert(windowFixture, 'tests/fixtures/run-save-vigour-window.json is missing (the probe must have a referent)');
  const raw = JSON.stringify(windowFixture.vigourEraRoundTrip);
  assert(raw.includes('"vigour"') && !raw.includes('"constitution"'),
    'the round-trip artifact must really carry the retired name and only the retired name');
  const registries = createRegistries(contentBundle);
  const there = loadThroughDoor(registries, windowFixture.vigourEraRoundTrip);
  const never = loadThroughDoor(registries, windowFixture.constitutionEra);
  assert(there, 'the round-tripped save was archived at the load door');
  assert(never, 'its never-renamed twin was archived at the load door');
  assert(!Object.hasOwn(there.attributes, 'vigour'), 'the retired key survived the load');
  eq(visible(there), visible(never), 'round-tripped save vs never-renamed twin');
  return `maxHp ${there.maxHp}, deficit ${there.maxHp - there.hp}, curse ledger ${there.maxHpAdjustment}`;
});

check('a save written by the shipped Vigour bundle migrates to host HP without healing', () => {
  assert(windowFixture, 'fixture missing');
  const registries = createRegistries(contentBundle);
  const before = windowFixture.vigourEraNative;
  const after = loadThroughDoor(registries, before);
  assert(after, 'a run started on the live build was archived at the load door');
  // A stale ruleset is re-derived under the current host rule. Preserve the
  // player's deficit rather than retaining a superseded maximum.
  eq(after.maxHp, expectedHp(registries, after), 'host-derived max HP');
  eq(after.maxHp - after.hp, before.maxHp - before.hp, 'in-flight HP deficit');
  eq(after.maxStamina, before.maxStamina, 'in-flight stamina pool');
  eq(after.attributes.constitution, before.attributes.vigour, 'the points arrive under the live name');
  return `maxHp ${before.maxHp} -> ${after.maxHp}; deficit ${after.maxHp - after.hp} preserved`;
});

check('the both-names guard fires BY NAME, across persisted homes, and stays out of other refusals', () => {
  // `loadRun() === null` is four different refusals wearing one face — a bad
  // total, a dangling id, an unreadable snapshot and this guard all return it.
  // The archive carries the reason, so the check reads that instead: a guard
  // credited for someone else's refusal is decoration with a green next to it.
  assert(windowFixture, 'fixture missing');
  const registries = createRegistries(contentBundle);
  const con = windowFixture.constitutionEra;
  const vig = windowFixture.vigourEraRoundTrip;
  const reasonFor = (save) => {
    const storage = createMemoryStorage();
    storage.setItem(RUN_KEY, JSON.stringify(save));
    assert(createSaveManager(storage).loadRun(registries) === null, 'the planted save LOADED');
    const index = JSON.parse(storage.getItem(RUN_ARCHIVE_KEY) || '{"entries":[]}');
    return (index.entries.at(-1) || {}).reason || '';
  };
  const GUARD = /^Mixed retired attribute 'vigour' and heir 'constitution' at /;
  // Both names in the allocation.
  const inAllocation = structuredClone(vig);
  inAllocation.attributes.constitution = inAllocation.attributes.vigour;
  assert(GUARD.test(reasonFor(inAllocation)), `allocation mix: ${reasonFor(inAllocation)}`);
  // One name per persisted home — the case the guard's own comment claims and
  // the one a half-finished migration would actually produce. Each half here is
  // real serialized output; only the pairing is planted.
  const acrossHomes = structuredClone(vig);
  for (const id of ['hp', 'stamina']) {
    acrossHomes.derivedStatRuleSnapshot.rules.rules[id].sourceStat = con.derivedStatRuleSnapshot.rules.rules[id].sourceStat;
  }
  const acrossReason = reasonFor(acrossHomes);
  assert(GUARD.test(acrossReason), `cross-home mix: ${acrossReason}`);
  assert(acrossReason.includes('attributes.vigour') && acrossReason.includes('rules.hp.sourceStat'),
    `the refusal must name every witness: ${acrossReason}`);
  // NEGATIVE CONTROL: an ordinary bad allocation must NOT be credited to it.
  const badTotal = structuredClone(vig);
  badTotal.attributes.vigour += 3;
  const otherReason = reasonFor(badTotal);
  assert(!GUARD.test(otherReason) && /total/.test(otherReason), `negative control: ${otherReason}`);
  return 'fires on 2 mixed shapes, silent on a wrong total';
});

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exitCode = 1;
