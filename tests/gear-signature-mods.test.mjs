// Item signatures (SPEC "The gear vocabulary", owner 2026-11-19): a profile-owned content.gear row may carry `signatureMods`. Present (an
// empty array included) it replaces the matched piece's authored raw mods; absent, nothing changes. The type / armour-group base still adds.
// Sage's Robe is the first item to carry one. Saves that never snapshotted the key keep their pinned behaviour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { gameDigest } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { GEAR_TYPES } from '../src/content/gearTypes.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { reconcileRunLoadoutHp, runMods, validateEquipment } from '../src/model/loadout.js';
import { equipmentCardModel } from '../src/model/equipmentCard.js';
import { GearSummary, GearArmourGroupOf, ParseGearMod } from '../src/model/gearEffects.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch } from '../src/engine/combat.js';

const META = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
const current = () => resolveGameProfile('default');
const fixture = name => resolveGameProfile(JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)))));
/** A saved profile with one gear row rewritten, re-hashed the way a real snapshot is. `edit(row)` mutates the clone's row. */
function editedProfile(base, rowId, edit) {
  const saved = structuredClone(base);
  edit(saved.content.gear.find(row => row.id === rowId));
  delete saved.hash;
  saved.hash = gameDigest(saved);
  return resolveGameProfile(saved);
}
const registriesFor = profile => bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const piece = (registries, id) => registries.equipment.armaments.find(p => p.id === id) || registries.equipment.armour.find(p => p.id === id);
const rawPiece = id => piece(contentBundle, id);

function wearing(registries, { armor, right, classId }) {
  const run = createRunState({ registries, classId, seed: 31, profileMeta: META });
  run.loadout = { ...run.loadout, sets: { rightHand: right ? [right] : [], leftHand: [], armor: armor ? [armor] : [] }, active: { rightHand: 0, leftHand: 0, armor: 0 } };
  reconcileRunLoadoutHp(registries, run, { adoptEquipmentBonuses: true });
  return { run, mods: runMods(registries, run.loadout, classId, run), summary: GearSummary(registries, run.loadout, classId, run) };
}
const wardGrant = summary => summary.turnGrants.filter(g => g.phase === 'start' && g.status === 'ward').reduce((n, g) => n + g.amount, 0);

// A signature REPLACES the raw mods, so a malformed one would erase them quietly. The projected piece goes through the same
// validateEquipment vocabulary check as every authored mod; a non-array value would be read as absent, so its shape is pinned here.
test('every shipped signature is an array of mods the gear vocabulary accepts, and a bad one is reported by name', () => {
  const rows = current().content.gear.filter(row => row.signatureMods !== undefined);
  assert.ok(rows.some(row => row.id === 'armor.sagesRobe'), 'Sage\'s Robe carries the first signature');
  for (const row of rows) assert.ok(Array.isArray(row.signatureMods) && row.signatureMods.every(mod => typeof mod === 'string' && ParseGearMod(mod)), row.id);
  assert.deepEqual(validateEquipment(registriesFor(current())), []);
  const bad = registriesFor(editedProfile(current(), 'broadsword', row => { row.signatureMods = ['strike.notAField=+1']; }));
  assert.ok(validateEquipment(bad).some(problem => problem.includes('broadsword') && problem.includes('notAField')), validateEquipment(bad).join('\n'));
});

test('a signature replaces the raw mods, an empty one clears them, and an absent one leaves them; the type base still applies', () => {
  assert.deepEqual(rawPiece('broadsword').mods, ['strike.damage=+1'], 'the authored raw mods this test edits around');
  const absent = registriesFor(current());
  assert.equal(current().content.gear.find(row => row.id === 'broadsword').signatureMods, undefined);
  assert.deepEqual(piece(absent, 'broadsword').mods, ['strike.damage=+1'], 'absent: unchanged');

  const replaced = registriesFor(editedProfile(current(), 'broadsword', row => { row.signatureMods = ['start.turnWard=+2']; }));
  assert.deepEqual(piece(replaced, 'broadsword').mods, ['start.turnWard=+2'], 'present: replaces');
  const sword = wearing(replaced, { right: 'broadsword', classId: 'reaver' });
  assert.equal(wardGrant(sword.summary), 2, 'the signature reaches the turn grants');
  assert.ok(!sword.summary.cardRules.some(rule => rule.source === 'broadsword' && rule.selector === 'strike'), 'the replaced raw rule is gone');

  const cleared = registriesFor(editedProfile(current(), 'broadsword', row => { row.signatureMods = []; }));
  assert.deepEqual(piece(cleared, 'broadsword').mods, [], 'empty: clears');
  const bare = wearing(cleared, { right: 'broadsword', classId: 'reaver' });
  const base = GEAR_TYPES.weaponTypes.sword.mods;
  assert.ok(base.length > 0, 'the sword type has a base to keep');
  assert.equal(bare.summary.cardRules.filter(rule => rule.source === 'broadsword').length, base.length, 'the sword type base still applies with no raw mods');
});

test('projection mutates neither the content nor the profile snapshot', () => {
  const profile = current(), before = JSON.stringify(profile), contentBefore = JSON.stringify(contentBundle.equipment.armour);
  const registries = registriesFor(profile);
  assert.deepEqual(piece(registries, 'sagesRobe').mods, ['start.turnWard=+1']);
  assert.notEqual(piece(registries, 'sagesRobe').mods, profile.content.gear.find(row => row.id === 'armor.sagesRobe').signatureMods, 'a copy, not the frozen array');
  assert.deepEqual(rawPiece('sagesRobe').mods, ['self.maxMana=+1'], 'the authored outfit row keeps its raw mods');
  assert.equal(JSON.stringify(profile), before, 'the profile snapshot is untouched');
  assert.equal(JSON.stringify(contentBundle.equipment.armour), contentBefore, 'the base content is untouched');
});

test('Sage\'s Robe in a new profile: uncommon Starseer robe, +1 total max MP, robe discount and melee vulnerability, signature in its help', () => {
  const profile = current(), registries = registriesFor(profile);
  const row = profile.content.gear.find(item => item.id === 'armor.sagesRobe');
  assert.equal(row.rarity, 'uncommon');
  assert.deepEqual(row.classes, ['starseer']);
  assert.equal(GearArmourGroupOf(piece(registries, 'sagesRobe')), 'unarmoured');
  const robe = wearing(registries, { armor: 'sagesRobe', classId: 'starseer' });
  assert.equal(robe.mods.maxMana, 1, 'the generic robe +1 only; no raw item MP');
  assert.equal(robe.run.equipmentPoolBonuses.maxMana, 1, 'the run pool agrees');
  assert.equal(robe.mods.flags.vulnMelee, 1, 'melee vulnerability stays');
  assert.ok(robe.summary.cardRules.some(rule => rule.source === 'sagesRobe' && rule.selector === 'spell' && rule.stat === 'manaCost' && rule.amount === -1), 'spell MP discount stays');
  assert.equal(wardGrant(robe.summary), 1);
  const help = equipmentCardModel(registries, piece(registries, 'sagesRobe')).bonuses.map(b => b.label);
  assert.ok(help.includes('Start of turn: +1 Ward'), `equipment help shows the signature: ${help.join(' | ')}`);
  assert.equal(help.filter(label => label === '+1 Max Mana').length, 1, 'and only the one Max Mana line, from the robe group');
});

test('Sage\'s Robe grants exactly 1 Ward at the start of each player turn through the ordinary Ward status', () => {
  const registries = registriesFor(current());
  const { run } = wearing(registries, { armor: 'sagesRobe', classId: 'starseer' });
  const combat = createRunCombat({ registries, run, rng: createRng(31), enemyIds: ['wanderingSoldier'] });
  dispatch(combat, { type: 'setReactions', enabled: false });
  Object.assign(combat.enemies[0], { hp: 900, maxHp: 900 });
  assert.equal(combat.player.statuses.ward?.stacks, 1, 'turn 1 starts with 1 Ward');
  for (let turn = 2; turn <= 4; turn++) {
    delete combat.player.statuses.ward; // isolate this turn's grant from carry-over and decay
    dispatch(combat, { type: 'endTurn' });
    assert.equal(combat.player.statuses.ward?.stacks, 1, `turn ${turn} starts with exactly 1 Ward`);
  }
  // Control: the same Starseer with no armour gets none, so the Ward is the robe's.
  const bare = wearing(registries, { classId: 'starseer' });
  const control = createRunCombat({ registries, run: bare.run, rng: createRng(31), enemyIds: ['wanderingSoldier'] });
  assert.equal(control.player.statuses.ward?.stacks || 0, 0);
});

test('legacy pin: a genuine pre-type-pass save keeps Sage\'s Robe at +1 max MP and no Ward', () => {
  const profile = fixture('dev-profile-73ef.json.gz');
  assert.equal(profile.modules.gear.typeEffectsVersion, undefined);
  const robe = wearing(registriesFor(profile), { armor: 'sagesRobe', classId: 'starseer' });
  assert.equal(robe.mods.maxMana, 1, 'the raw +1, no robe base');
  assert.equal(wardGrant(robe.summary), 0);
});

test('legacy pin: an existing typeEffectsVersion 1 save (no signatureMods snapshotted) keeps Sage\'s Robe at +2 max MP and no Ward', () => {
  const profile = editedProfile(current(), 'armor.sagesRobe', row => { delete row.signatureMods; });
  assert.equal(profile.modules.gear.typeEffectsVersion, 1);
  const registries = registriesFor(profile);
  assert.deepEqual(piece(registries, 'sagesRobe').mods, ['self.maxMana=+1']);
  const robe = wearing(registries, { armor: 'sagesRobe', classId: 'starseer' });
  assert.equal(robe.mods.maxMana, 2, 'raw +1 and robe base +1');
  assert.equal(wardGrant(robe.summary), 0, 'no Sage Ward');
});

test('a signature never applies without the type pass, even if a profile without typeEffectsVersion carried one', () => {
  const saved = structuredClone(current());
  delete saved.modules.gear.typeEffectsVersion;
  delete saved.hash;
  saved.hash = gameDigest(saved);
  const registries = registriesFor(resolveGameProfile(saved));
  assert.deepEqual(piece(registries, 'sagesRobe').mods, ['self.maxMana=+1'], 'original item modifiers kept (SPEC typeEffectsVersion opt-in)');
});
