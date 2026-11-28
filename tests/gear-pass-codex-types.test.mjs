import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { compileGameProfiles } from '../tools/game-config.mjs';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { GEAR_TYPES } from '../src/content/gearTypes.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { runMods, reconcileRunLoadoutHp } from '../src/model/loadout.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { GearWeaponTypeOf, GearArmourGroupOf, GearTypeRow, GearSummary, ApplyGearCardRules, GearManaCost } from '../src/model/gearEffects.js';

// Exact authored classifications: docs/balance/equipment-list-2026-11-18.md, adopted by the Codex equipment buildout.
const WEAPONS = {
  "kris": "dagger",
  "stiletto": "dagger",
  "broadsword": "sword",
  "flamberge": "sword",
  "rapier": "rapier",
  "estoc": "rapier",
  "duelistsFoil": "rapier",
  "ashenClaymore": "greatsword",
  "zweihander": "greatsword",
  "pike": "spear",
  "scythe": "spear",
  "reapersCrescent": "spear",
  "mace": "mace",
  "morningStar": "mace",
  "flail": "mace",
  "maul": "hammer",
  "thunderMallet": "hammer",
  "beardedAxe": "axe",
  "moonlitKatana": "katana",
  "moonGlaives": "twinblade",
  "longbow": "bow",
  "huntersRecurve": "bow",
  "handCrossbow": "crossbow",
  "arbalest": "crossbow",
  "leatherWhip": "whip",
  "thornWhip": "whip",
  "ironKnuckles": "claws",
  "beastClaws": "claws",
  "stormSceptre": "sceptre",
  "grimoire": "tome",
  "prayerBook": "tome",
  "sunTalisman": "talisman",
  "boneTalisman": "talisman"
};
const ARMOUR = {
  "cinderforgedPlate": "heavy",
  "wyrmscaleMail": "medium",
  "ringmailHauberk": "medium",
  "huntersHide": "light",
  "sagesRobe": "unarmoured"
};
const { catalog, authors } = compileGameProfiles();
const profile = resolveGameAuthor(authors.core, catalog);
const registriesFor = p => bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, p)), p);
const registries = registriesFor(profile);
const meta = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
const pieceById = id => registries.equipment.armaments.find(p => p.id === id) || registries.equipment.armour.find(p => p.id === id);

function world({ right, left, armor, classId = 'reaver' } = {}) {
  const run = createRunState({ registries, classId, seed: 31, profileMeta: meta });
  // Isolate only the selected items from the class's default outfit and weapons.
  run.loadout = { ...run.loadout, sets: { rightHand: right ? [right] : [], leftHand: left ? [left] : [], armor: armor ? [armor] : [] }, active: { rightHand: 0, leftHand: 0, armor: 0 } };
  reconcileRunLoadoutHp(registries, run, { adoptEquipmentBonuses: true });
  const combat = createRunCombat({ registries, run, rng: createRng(31), enemyIds: ['wanderingSoldier'] });
  const card = cardId => resolveCombatCard(combat, { instanceId: `codex-${cardId}`, cardId });
  return { run, combat, card, summary: GearSummary(registries, run.loadout, classId, run), mods: runMods(registries, run.loadout, classId, run) };
}

test('all 33 Codex armaments and five armour rows resolve their authored type and full generic rule row', () => {
  assert.equal(Object.keys(WEAPONS).length, 33);
  assert.equal(Object.keys(ARMOUR).length, 5);
  for (const [id, type] of Object.entries(WEAPONS)) {
    const piece = pieceById(id);
    assert.ok(piece, id);
    assert.equal(GEAR_TYPES.items[id], type, id);
    assert.equal(GearWeaponTypeOf(piece), type, id);
    assert.deepEqual(GearTypeRow(piece), { id: type, group: false, ...GEAR_TYPES.weaponTypes[type] }, id);
  }
  for (const [id, group] of Object.entries(ARMOUR)) {
    const piece = pieceById(id);
    assert.ok(piece, id);
    assert.equal(GEAR_TYPES.armourItems[id], group, id);
    assert.equal(GearArmourGroupOf(piece), group, id);
    assert.deepEqual(GearTypeRow(piece), { id: group, group: true, ...GEAR_TYPES.armourGroups[group] }, id);
  }
});

test('classification preserves the 38 authored item signatures from the equipment rework', () => {
  // The authored lists from 057fbe0905a, read from the unprojected content: a profile's signatureMods (Sage's Robe, 2026-11-19) replace a registry
  // piece's raw mods, never the content they were authored in (tests/gear-signature-mods.test.mjs).
  const raw = id => contentBundle.equipment.armaments.find(p => p.id === id) || contentBundle.equipment.armour.find(p => p.id === id);
  const mods = Object.keys({ ...WEAPONS, ...ARMOUR }).sort().map(id => [id, raw(id).mods]);
  assert.equal(createHash('sha256').update(JSON.stringify(mods)).digest('hex'), '52b4453ae54a7c80aa8f1618a182d4e33c65a85d9f336d3bdcfb99c00c2404bc');
});

// Owner ruling 2026-11-28: Core Strike stores its 1:1 damage, 1.
const CORE_STRIKE_DAMAGE = 1;
test('Codex Sword adds one damage to real Core Strike without applying the signature reserved for Sweep', () => {
  assert.equal(world().card('core.strike').effects.find(e => e.op === 'damage').amount, CORE_STRIKE_DAMAGE);
  const sword = world({ right: 'broadsword' });
  assert.deepEqual(pieceById('broadsword').mods, ['sweep.hitWeak=+1']);
  assert.equal(sword.card('core.strike').effects.find(e => e.op === 'damage').amount, CORE_STRIKE_DAMAGE + 1);
});

test('Moon Glaives adds exactly one hit and Iron Knuckles applies its damage base once', () => {
  const glaives = world({ right: 'moonGlaives' }).card('core.strike').effects.find(e => e.op === 'damage');
  assert.equal(glaives.amount, CORE_STRIKE_DAMAGE);
  assert.equal(glaives.hits, 2, 'old strike.hits=3 is not applied to configured Core cards');
  const plain = world().card('core.strike'), claws = world({ right: 'ironKnuckles' }).card('core.strike');
  assert.equal(plain.cost, 1); assert.equal(claws.cost, plain.cost, 'Claws no longer change Stamina cost');
  assert.equal(plain.effects.find(e => e.op === 'damage').amount, CORE_STRIKE_DAMAGE);
  assert.equal(claws.effects.find(e => e.op === 'damage').amount, CORE_STRIKE_DAMAGE - 1, 'claws cardDamage -1');
});

test('Storm Sceptre no longer grants Ward, and staffs and sceptres carry no Prepared Mana cut', () => {
  const storm = world({ right: 'stormSceptre' });
  assert.equal(storm.summary.turnGrants.filter(g => g.phase === 'start' && g.status === 'ward').reduce((n, g) => n + g.amount, 0), 0);
  const spell = world().card('core.spark');
  for (const equipped of [storm, world({ right: 'stormSceptre', left: 'ashStaff' })]) {
    const prepared = ApplyGearCardRules(equipped.summary.cardRules, spell, { stance: 'prepared' });
    assert.equal(prepared.gearManaRules, undefined, 'Initiate tags own the Prepared Mana cut (owner, 2026-11-27)');
    assert.equal(GearManaCost(prepared, 3), 3);
    assert.equal(GearManaCost(ApplyGearCardRules(equipped.summary.cardRules, spell, { stance: 'idle' }), 3), 3);
  }
});

test('Codex tomes and talismans each grant one Ward at turn start', () => {
  for (const id of ['grimoire', 'prayerBook', 'sunTalisman', 'boneTalisman']) {
    const summary = world({ left: id }).summary;
    assert.equal(summary.turnGrants.filter(g => g.phase === 'start' && g.status === 'ward').reduce((n, g) => n + g.amount, 0), 1, id);
  }
});

test('Codex armour grants only authored Block and keeps its distinct group and signature effects', () => {
  // Each row is the armour's flat Block on top of Defend's authored Block (#3039 restored it to 10).
  const authoredDefend = registries.cards.get('core.defend').effects.find(e => e.op === 'block').amount;
  for (const [id, flatBlock] of [['cinderforgedPlate', 0], ['wyrmscaleMail', 0], ['ringmailHauberk', 1], ['huntersHide', 0], ['sagesRobe', 0]]) {
    const piece = pieceById(id), equipped = world({ armor: id, classId: piece.classId });
    const defendBlock = equipped.card('core.defend').effects.find(e => e.op === 'block').amount;
    assert.equal(defendBlock, authoredDefend + flatBlock, id);
    if (id === 'sagesRobe') {
      assert.equal(equipped.mods.maxMana, 0, 'the robe group has no flat Mana');
      assert.equal(equipped.combat.player.statuses.ward?.stacks, 1, 'the robe signature grants Ward');
    }
    if (id === 'huntersHide') {
      assert.equal(equipped.summary.statPoints.dexterity, 2, 'one point each from the light group and item');
      assert.equal(equipped.combat.player.statuses.dexterity?.stacks || 0, 0, 'the item grants a stat point instead of a status');
    }
  }
});

test('genuine historical no-key profile ignores newly assigned types while preserving all 38 raw item modifiers and pools', () => {
  const old = resolveGameProfile(JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-73ef.json.gz', import.meta.url)))));
  assert.equal(old.modules.gear.typeEffectsVersion, undefined);
  const legacy = registriesFor(old);
  for (const [id, type] of Object.entries({ ...WEAPONS, ...ARMOUR })) {
    const piece = pieceById(id), armor = piece.kind === 'armor', key = armor ? 'armour' : 'armaments', classId = piece.classId || 'reaver';
    // A local alias removes the real table mapping without mutating global GEAR_TYPES; the second clone adds the same type through its normal fallback.
    const alias = `codex-compat-${id}`, loadout = { sets: { [armor ? 'armor' : 'rightHand']: [alias] }, active: {} };
    const subject = { gameProfile: old, loadout, class: classId };
    const registry = mapped => ({ ...legacy, equipment: { ...legacy.equipment, [key]: [...legacy.equipment[key], { ...piece, id: alias, ...(mapped ? { [armor ? 'gearGroup' : 'gearType']: type } : {}) }] } });
    const before = registry(false), after = registry(true), untyped = before.equipment[key].at(-1), typed = after.equipment[key].at(-1);
    assert.equal(GearTypeRow(untyped), null, id);
    assert.equal(GearTypeRow(typed).id, type, id);
    assert.deepEqual(runMods(after, loadout, classId, subject), runMods(before, loadout, classId, subject), id);
    assert.deepEqual(GearSummary(after, loadout, classId, subject), GearSummary(before, loadout, classId, subject), id);
  }
});
