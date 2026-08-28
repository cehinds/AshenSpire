#!/usr/bin/env node
// Observed-red contract: representative DEX weapons and five-stat ownership.
//
// This gate deliberately models no range, distance, line-of-sight or board
// position. A bow is a data-authored core-card projection in the combat system
// that already exists; `ranged` and `precision` are explicit presentation tags.

import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { equipmentKitReceipt, stampDeck, validateEquipment } from '../src/model/loadout.js';
import { DAMAGE_SCHOOLS, SCHEMAS } from '../src/model/schemas.js';
import { deriveStat } from '../src/model/derivedStats.js';
import { createCombat, previewCard, dispatch } from '../src/engine/combat.js';
import { createCoopCombat } from '../src/engine/coopCombat.js';
import { createRng } from '../src/engine/rng.js';
import { validateContent } from '../src/model/validate.js';
import { createMemoryStorage, createSaveManager } from '../src/engine/save.js';

const R = createRegistries(contentBundle);
let passed = 0;
let failed = 0;
function check(ok, label, detail = '') {
  if (ok) { passed += 1; console.log(`PASS ${label}`); }
  else { failed += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}
const equal = (actual, expected, label) => check(Object.is(actual, expected), label, `${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);

const profile = (id) => (R.equipment.basicCardProfiles || []).find((row) => row.id === id);
const piece = (id) => (R.equipment.armaments || []).find((row) => row.id === id);
const daggerProfile = profile('daggerPierceAttack');
const bowProfile = profile('bowPierceAttack');
const bowTechnique = profile('bowTechnique');
const dagger = piece('dagger');
const bow = piece('shortbow');

equal(JSON.stringify(SCHEMAS.basicCardProfile.fields.damageSchool.values), JSON.stringify(DAMAGE_SCHOOLS),
  'schema consumes the one authoritative damage-school vocabulary');
for (const school of DAMAGE_SCHOOLS) {
  const bundle = { ...contentBundle, equipment: { ...contentBundle.equipment,
    basicCardProfiles: contentBundle.equipment.basicCardProfiles.map((row) => ({ ...row })) } };
  bundle.equipment.basicCardProfiles[0].damageSchool = school;
  const schoolErrors = validateContent(bundle).errors.filter((error) => /basicCardProfiles.*damageSchool/.test(error.path));
  check(schoolErrors.length === 0, `schema accepts runtime damage school ${school}`, schoolErrors.map((error) => error.msg).join(' | '));
}
{
  const bundle = { ...contentBundle, equipment: { ...contentBundle.equipment,
    basicCardProfiles: contentBundle.equipment.basicCardProfiles.map((row) => ({ ...row })) } };
  bundle.equipment.basicCardProfiles[0].damageSchool = 'magick';
  const said = validateContent(bundle).errors.map((error) => `${error.path}: ${error.msg}`).join(' | ');
  check(/damageSchool.*magick|Expected one of.*magick/i.test(said), 'unknown damage school fails closed by path', said);
}

check(dagger?.attackProfile === 'daggerPierceAttack', 'dagger explicitly references its DEX attack profile', String(dagger?.attackProfile));
check(daggerProfile?.scalingStat === 'dexterity' && daggerProfile?.baseValue === 3
  && daggerProfile?.pointsPerTier === 5 && daggerProfile?.rounding === 'floor'
  && daggerProfile?.gainPerTier === 1 && (daggerProfile?.cap === '' || daggerProfile?.cap == null),
  'dagger profile authors base 3 + floor(DEX/5), uncapped', JSON.stringify(daggerProfile));
check(daggerProfile?.damageSchool === 'physical' && daggerProfile?.tags?.includes('pierce')
  && daggerProfile?.tags?.includes('flourish') && !(daggerProfile?.mods || []).some((mod) => /^hits=/.test(mod)),
  'dagger explicitly authors Pierce, finesse tags, and two hits', JSON.stringify(daggerProfile));
check(!(dagger?.mods || []).some((mod) => /^strike\.damage=/.test(mod))
  && dagger?.mods?.includes('strike.hits=2'),
  'dagger item authors hits only and cannot erase scaled damage', JSON.stringify(dagger?.mods));

const sword = piece('straightSword');
check(!(sword?.mods || []).some((mod) => /^strike\.damage=/.test(mod)),
  'Straight Sword has no duplicate item damage above its profile receipt', JSON.stringify(sword?.mods));

check(bow?.kind === 'weapon' && bow?.hand === 'right' && bow?.rarity === 'common',
  'representative shortbow is a common right-hand weapon row', JSON.stringify(bow));
check(bow?.artKey === 'dagger',
  'shortbow declares the temporary existing generic-art boundary', JSON.stringify(bow));
{
  const mutateBow = (patch) => ({ ...R, equipment: { ...R.equipment,
    armaments: R.equipment.armaments.map((row) => row.id === 'shortbow' ? { ...row, ...patch } : row) } });
  const unknown = validateEquipment(mutateBow({ artKey: 'notRendered' })).join(' | ');
  check(/shortbow.*artKey.*notRendered/i.test(unknown), 'mutant: unknown generic art key is refused by item name', unknown);
  const drift = validateEquipment(mutateBow({ accent: '000000' })).join(' | ');
  check(/shortbow.*accent.*artKey/i.test(drift), 'mutant: generic art reuse cannot disagree with rendered fields', drift);
}
check(bow?.attackProfile === 'bowPierceAttack' && bow?.techniqueProfile === 'bowTechnique',
  'shortbow references explicit attack and technique profiles', JSON.stringify(bow));
check(bowProfile?.baseValue === 4 && bowProfile?.scalingStat === 'dexterity'
  && bowProfile?.pointsPerTier === 5 && bowProfile?.rounding === 'floor'
  && bowProfile?.gainPerTier === 1 && (bowProfile?.cap === '' || bowProfile?.cap == null),
  'bow profile authors base 4 + floor(DEX/5), uncapped', JSON.stringify(bowProfile));
check(bowProfile?.damageSchool === 'physical'
  && ['pierce', 'ranged', 'precision'].every((tag) => bowProfile?.tags?.includes(tag))
  && !(bowProfile?.mods || []).some((mod) => /^hits=/.test(mod)),
  'bow explicitly authors Pierce/ranged/precision and one hit', JSON.stringify(bowProfile));
check(bowTechnique?.role === 'technique' && bowTechnique?.scalingStat === 'dexterity'
  && ['ranged', 'precision'].every((tag) => bowTechnique?.tags?.includes(tag)),
  'bow technique is an explicit DEX presentation row', JSON.stringify(bowTechnique));
for (const row of [bow, bowProfile, bowTechnique].filter(Boolean)) {
  check(!['range', 'distance', 'position', 'lineOfSight', 'los'].some((key) => Object.hasOwn(row, key)),
    `${row.id} adds no ranged-position system field`, JSON.stringify(row));
}

const baseRun = createRunState({ seed: 0x51a7, classId: 'reaver', registries: R });
const allTen = { strength: 10, dexterity: 10, vigour: 10, wisdom: 10, intelligence: 10 };
function roleReceipt(pieceId, role, attributes) {
  if (!piece(pieceId)) return null;
  const loadout = structuredClone(baseRun.loadout);
  loadout.sets.rightHand[0] = pieceId;
  loadout.sets.leftHand[0] = null;
  return equipmentKitReceipt(R, loadout, 'reaver', attributes, baseRun.equipmentProfileRuleSnapshot)
    .find((row) => row.role === role)?.receipt || null;
}
function vector(attributes) {
  const rules = baseRun.derivedStatRuleSnapshot.rules;
  const cls = R.classes.get('reaver');
  return {
    swordAttack: roleReceipt('straightSword', 'attack', attributes)?.value ?? null,
    daggerAttack: roleReceipt('dagger', 'attack', attributes)?.value ?? null,
    bowAttack: roleReceipt('shortbow', 'attack', attributes)?.value ?? null,
    weaponGuard: roleReceipt('straightSword', 'guard', attributes)?.value ?? null,
    sceptreAttack: roleReceipt('boneSceptre', 'attack', attributes)?.value ?? null,
    staffAttack: roleReceipt('ashStaff', 'attack', attributes)?.value ?? null,
    hp: deriveStat(rules, 'hp', { attributes, classDef: cls }).value,
    stamina: deriveStat(rules, 'stamina', { attributes, classDef: cls }).value,
    mana: deriveStat(rules, 'mana', { attributes, classDef: cls }).value,
    energy: deriveStat(rules, 'energy', { attributes, classDef: cls }).value,
    draw: deriveStat(rules, 'draw', { attributes, classDef: cls }).value,
  };
}

const expectedBase = {
  swordAttack: 7, daggerAttack: 5, bowAttack: 6, weaponGuard: 4,
  sceptreAttack: 6, staffAttack: 4,
  hp: 94, stamina: 2, mana: 2, energy: 3, draw: 5,
};
const expectedChanges = {
  strength: { swordAttack: 8 },
  dexterity: { daggerAttack: 6, bowAttack: 7, weaponGuard: 5, energy: 4 },
  // hp pays per POINT (D17: "1 hp point per") — 84 + 15; stamina still tiers.
  vigour: { hp: 99, stamina: 3 },
  wisdom: { sceptreAttack: 7, mana: 3 },
  intelligence: { staffAttack: 5, draw: 6 },
};
equal(JSON.stringify(vector(allTen)), JSON.stringify(expectedBase), 'all-10 output vector matches exact representative receipts');
for (const stat of Object.keys(allTen)) {
  const attributes = { ...allTen, [stat]: 15 };
  const expected = { ...expectedBase, ...expectedChanges[stat] };
  equal(JSON.stringify(vector(attributes)), JSON.stringify(expected),
    `${stat.toUpperCase()} +5 changes only its owned output cells`);
}

const standardRun = createRunState({ seed: 0x4850, classId: 'reaver', registries: R });
const con15Run = createRunState({
  seed: 0x4851, classId: 'reaver', registries: R,
  attributes: { strength: 10, dexterity: 10, vigour: 15, wisdom: 10, intelligence: 10 },
});
check(standardRun.maxHp === 96 && con15Run.maxHp === 99 && con15Run.maxStamina === 3,
  'actual Wayfarer runs consume the VIG HP/Stamina receipt (HP per point, D17)', `${standardRun.maxHp}/${con15Run.maxHp}/${con15Run.maxStamina}`);

function executionReceipt(pieceId, expectedPerHit, expectedHits) {
  if (!piece(pieceId)) return { missing: true };
  const run = createRunState({ seed: 91, classId: 'reaver', registries: R });
  run.attributes = { ...allTen };
  run.loadout.sets.rightHand[0] = pieceId;
  run.loadout.sets.leftHand[0] = null;
  stampDeck(R, run);
  const attack = run.deck.find((card) => card.equipmentRole === 'attack');
  const def = resolveCard(R, attack);
  const effect = def.effects.find((row) => row.op === 'damage');
  const combat = createCombat({
    registries: R, rng: createRng(91),
    player: {
      classId: run.class, attributes: run.attributes, maxHp: run.maxHp, hp: run.hp,
      maxMana: run.maxMana, mana: run.mana, maxStamina: run.maxStamina, stamina: run.stamina,
      energyMax: run.energyMax, drawPerTurn: run.drawPerTurn, deck: run.deck,
      relicIds: [], flasks: [], loadout: run.loadout,
    },
    enemyIds: [R.enemies.ids()[0]],
  });
  const live = [...combat.piles.hand, ...combat.piles.draw].find((card) => card.instanceId === attack.instanceId);
  if (!combat.piles.hand.includes(live)) {
    combat.piles.draw.splice(combat.piles.draw.indexOf(live), 1);
    combat.piles.hand.push(live);
  }
  const preview = previewCard(combat, live.instanceId, 'e1').values.find((row) => row.op === 'damage');
  const before = combat.enemies[0].hp;
  dispatch(combat, { type: 'playCard', cardInstanceId: live.instanceId, targetId: 'e1' });
  return {
    receipt: attack.profileReceipt?.value,
    definitionAmount: effect?.amount,
    definitionHits: effect?.hits ?? 1,
    previewAmount: preview?.value,
    previewHits: preview?.hits,
    executedTotal: before - combat.enemies[0].hp,
    expectedPerHit,
    expectedHits,
  };
}
for (const [id, amount, hits] of [['dagger', 5, 2], ['shortbow', 6, 1]]) {
  const got = executionReceipt(id, amount, hits);
  check(!got.missing && got.receipt === amount && got.definitionAmount === amount
    && got.definitionHits === hits && got.previewAmount === amount && got.previewHits === hits
    && got.executedTotal === amount * hits,
  `${id} receipt, preview and execution agree per hit`, JSON.stringify(got));
}

function projectedAttack(pieceId, extraMod = null) {
  const armaments = contentBundle.equipment.armaments.map((row) => row.id === pieceId && extraMod
    ? { ...row, mods: [...row.mods, extraMod] } : row);
  const registries = createRegistries({ ...contentBundle, equipment: { ...contentBundle.equipment, armaments } });
  const run = createRunState({ seed: 711, classId: 'reaver', registries });
  run.attributes = { ...allTen };
  run.loadout.sets.rightHand[0] = pieceId;
  run.loadout.sets.leftHand[0] = null;
  stampDeck(registries, run);
  const attack = run.deck.find((card) => card.equipmentRole === 'attack');
  return {
    receipt: attack.profileReceipt,
    final: resolveCard(registries, attack).effects.find((effect) => effect.op === 'damage')?.amount,
  };
}

for (const [id, amount, rarityBonus] of [['straightSword', 7, 0], ['dagger', 5, 0], ['shortbow', 6, 0], ['boneSceptre', 6, 1]]) {
  const receipt = roleReceipt(id, 'attack', allTen);
  const projected = projectedAttack(id);
  check(receipt?.rarityBonus === rarityBonus && receipt?.value === amount
    && projected.receipt?.value === amount && projected.final === amount
    && !(piece(id)?.mods || []).some((mod) => /^strike\.damage=/.test(mod)),
  `${id} applies rarity exactly once and no item mod duplicates final damage`, JSON.stringify({ receipt, projected, mods: piece(id)?.mods }));
}

for (const id of ['straightSword', 'dagger', 'shortbow']) {
  if (!piece(id)) continue;
  const mutant = projectedAttack(id, 'strike.damage=+1');
  check(mutant.final !== mutant.receipt?.value,
    `mutant: receipt/final parity catches ${id} item damage duplication`, JSON.stringify(mutant));
}

const layered = createRunState({
  seed: 901, classId: 'reaver', registries: R,
  derivedStatOptions: {
    modeModifiers: { equipmentProfiles: {
      daggerPierceAttack: { gainPerTier: 2 }, bowPierceAttack: { gainPerTier: 2 },
    } },
    runModifiers: [{ equipmentProfiles: {
      daggerPierceAttack: { gainPerTier: 3 }, bowPierceAttack: { gainPerTier: 3 },
    } }],
    explicitOverride: { equipmentProfiles: {
      daggerPierceAttack: { gainPerTier: 4 }, bowPierceAttack: { gainPerTier: 4 },
    } },
  },
});
check(layered.equipmentProfileRuleSnapshot.profiles.daggerPierceAttack.gainPerTier === 4
  && layered.equipmentProfileRuleSnapshot.profiles.bowPierceAttack.gainPerTier === 4,
  'host override precedence snapshots both DEX profile rows', JSON.stringify(layered.equipmentProfileRuleSnapshot.profiles));
layered.loadout.sets.leftHand[0] = null;
layered.loadout.sets.rightHand[0] = 'dagger';
stampDeck(R, layered);
const layeredAttack = layered.deck.find((card) => card.equipmentRole === 'attack');
check(layeredAttack.profileId === 'daggerPierceAttack' && layeredAttack.profileReceipt.value === 11,
  'DEX dagger consumes the host-resolved override snapshot', JSON.stringify(layeredAttack));
layered.loadout.sets.rightHand[0] = 'shortbow';
stampDeck(R, layered);
check(layeredAttack.profileId === 'bowPierceAttack' && layeredAttack.profileReceipt.value === 12,
  'DEX bow consumes the same host-resolved override snapshot', JSON.stringify(layeredAttack));

const save = createSaveManager(createMemoryStorage());
save.saveRun(layered);
const resumed = save.loadRun(R);
const resumedAttack = resumed?.deck.find((card) => card.equipmentRole === 'attack');
check(resumedAttack?.profileId === 'bowPierceAttack'
  && JSON.stringify(resumedAttack.profileReceipt) === JSON.stringify(layeredAttack.profileReceipt)
  && resolveCard(R, resumedAttack).effects.find((effect) => effect.op === 'damage')?.amount === 12,
  'save resume preserves DEX profile and calculation receipt identity', JSON.stringify(resumedAttack));

const coop = createCoopCombat({
  registries: R, rng: createRng(902), enemyIds: [R.enemies.ids()[0]],
  players: [{
    id: 'p1', classId: layered.class, maxHp: layered.maxHp, hp: layered.hp,
    maxMana: layered.maxMana, mana: layered.mana, maxStamina: layered.maxStamina, stamina: layered.stamina,
    deck: layered.deck, relicIds: [], flasks: [],
  }],
});
const coopAttack = [...coop.players.get('p1').piles.hand, ...coop.players.get('p1').piles.draw]
  .find((card) => card.instanceId === layeredAttack.instanceId);
check(coopAttack?.profileId === layeredAttack.profileId
  && JSON.stringify(coopAttack.profileReceipt) === JSON.stringify(layeredAttack.profileReceipt)
  && resolveCard(R, coopAttack).effects.find((effect) => effect.op === 'damage')?.amount === 12,
  'co-op transport preserves DEX profile and calculation receipt identity', JSON.stringify(coopAttack));

const driftProfiles = contentBundle.equipment.basicCardProfiles.map((row) => (
  ['daggerPierceAttack', 'bowPierceAttack'].includes(row.id) ? { ...row, gainPerTier: 99 } : row
));
const driftR = createRegistries({ ...contentBundle, equipment: { ...contentBundle.equipment, basicCardProfiles: driftProfiles } });
stampDeck(driftR, layered);
check(layeredAttack.profileReceipt.value === 12
  && resolveCard(driftR, layeredAttack).effects.find((effect) => effect.op === 'damage')?.amount === 12,
  'live profile drift cannot rewrite the saved host snapshot', JSON.stringify(layeredAttack.profileReceipt));

console.log(`\nequipment-stat-isolation: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
