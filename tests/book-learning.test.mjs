import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, validateRunShape } from '../src/model/state.js';
import { skillBookReadPlan, commitSkillBookRead } from '../src/model/consumables.js';
import { bookLessons, bookTags, bookLessonCard } from '../src/model/bookLearning.js';
import { swapRunClass } from '../src/model/classSwap.js';
import { deckCopyLimit } from '../src/model/deckRules.js';
import { equipClassCard, learnedClassIds } from '../src/model/classLibrary.js';
import { awardClassXp } from '../src/model/classTree.js';
import { runClassIdentity } from '../src/model/classCard.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { validateContent } from '../src/model/validate.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { buildMarketStock } from '../src/engine/shopKinds.js';
import { consumablePurchasePlan } from '../src/model/marketAdditions.js';

const reg = createRegistries(contentBundle);
const fresh = () => createRunState({ seed: 221, classId: 'reaver', registries: reg });
function read(run, id, pick, skillId) {
  const plan = skillBookReadPlan(reg, run, id, { skillId });
  assert.equal(plan.ok, true, plan.reason);
  return commitSkillBookRead(reg, run, { ...plan, choice: pick || plan.lessons[0] });
}

test('book definitions validate, including canonical tags, universal and class books', () => {
  const result = validateContent(contentBundle);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  for (const patch of [{ skill: {} }, { learnTags: ['not-a-tag'] }, { learnAny: true }, { learnAny: true, learnTags: ['blade'] }, { skill: 'class:rogue', learnClass: 'starseer' }]) {
    const bad = { ...contentBundle, consumables: contentBundle.consumables.map((row) => row.id === 'bladeManual' ? { ...row, ...patch } : row) };
    assert.equal(validateContent(bad).ok, false, JSON.stringify(patch));
  }
});

test('the expanded catalog reaches market stock including already-learned class books', () => {
  const configured = createRegistries(configuredContentBundle(contentBundle, {
    'gameConfig.shops.market.skillBooks.chance': 100,
    'gameConfig.shops.market.skillBooks.stock': 20,
  }));
  const run = createRunState({ seed: 221, classId: 'reaver', registries: configured });
  run.cinders = 9999;
  run.shopStock = buildMarketStock(configured, createRng(221), run, { meta: {} });
  const books = run.shopStock.skillBooks;
  for (const id of ['spellbook', 'universalTome', 'starseerClassBook', 'rogueClassBook', 'heraldClassBook']) {
    const item = books.find((row) => row.id === id);
    assert.ok(item, id);
    assert.equal(consumablePurchasePlan(configured, run, 'skillBooks', item).ok, true);
  }
  const own = books.find((row) => row.id === 'reaverClassBook');
  assert.equal(consumablePurchasePlan(configured, run, 'skillBooks', own).ok, true);
});

test('reading grants exact XP plus an immediate tagged card before a skill level-up', () => {
  const run = fresh(); run.consumables = { bladeManual: 2 };
  const plan = skillBookReadPlan(reg, run, 'bladeManual');
  assert.ok(plan.lessons.length);
  assert.ok(plan.lessons.every((row) => reg.cards.get(row.id).tags.includes('blade')));
  const quote = { ...plan, choice: plan.lessons[0] };
  const before = run.deck.length;
  const receipt = commitSkillBookRead(reg, run, quote);
  assert.equal(receipt.gained, 40);
  assert.equal(receipt.levelUps, 0);
  assert.equal(run.deck.length, before + 1);
  assert.equal(run.deck.at(-1).cardId, quote.choice.id);
  assert.equal(run.consumables.bladeManual, 1);
  const snapshot = structuredClone(run);
  assert.throws(() => commitSkillBookRead(reg, run, quote), /changed/);
  assert.deepEqual(run, snapshot, 'replaying a quote cannot consume another copy');
});

test('cross-class spells are available without a focus equipped and become ordinary owned cards', () => {
  const run = fresh(); run.consumables = { spellbook: 1 };
  const options = bookLessons(reg, run, reg.consumables.get('spellbook'));
  assert.ok(options.length);
  assert.ok(options.every((row) => reg.cards.get(row.id).tags.includes('source:spell')));
  const other = options.find((row) => !reg.classes.get('reaver').cardPool.includes(row.id));
  assert.ok(other, 'another class teaches a spell');
  read(run, 'spellbook', other);
  assert.equal(run.deck.at(-1).cardId, other.id);
  assert.equal(run.skills['item:magic-focus'].xp, 40);
  assert.equal(run.class, 'reaver');
});

test('universal book chooses an XP track and can teach a card or a class', () => {
  for (const kind of ['card', 'class']) {
    const run = fresh(); run.consumables = { universalTome: 1 };
    const plan = skillBookReadPlan(reg, run, 'universalTome', { skillId: 'item:shield' });
    const choice = plan.lessons.find((row) => row.kind === kind);
    assert.ok(choice);
    read(run, 'universalTome', choice, 'item:shield');
    assert.equal(run.skills['item:shield'].xp, 40);
    assert.equal(run.class, 'reaver', 'learning never auto-equips');
    if (kind === 'class') assert.ok(learnedClassIds(run).includes(choice.id));
    else assert.equal(run.deck.at(-1).cardId, choice.id);
  }
});

test('book XP upgrades existing and new matching ordinary cards without a held focus', () => {
  const run = fresh(); run.consumables = { spellbook: 1 };
  run.skills['item:magic-focus'] = { level: reg.balance.skill.upgradeAt, xp: 0, pendingDrafts: 0 };
  const schools = bookTags(reg, { skill: 'item:magic-focus' });
  const plan = skillBookReadPlan(reg, run, 'spellbook');
  const choice = plan.lessons.find((row) => reg.cards.get(row.id).tags.some((tag) => schools.includes(tag)));
  assert.ok(choice);
  const ordinary = { instanceId: 'book-review-existing', cardId: choice.id, upgraded: false };
  const aside = { instanceId: 'book-review-sideboard', cardId: choice.id, upgraded: false };
  const bound = { instanceId: 'book-review-bound', cardId: choice.id, upgraded: false, sourceArmamentId: 'test-focus' };
  run.deck.push(ordinary, bound); run.sideboard = [aside];
  read(run, 'spellbook', choice);
  assert.equal(ordinary.upgraded, true);
  assert.equal(aside.upgraded, true);
  assert.equal(run.deck.at(-1).upgraded, true);
  assert.equal(bound.upgraded, false, 'equipment-owned upgrades remain governed by the smith');
});

test('cancel, missing or invalid choices, wrong tracks, and combat cannot spend books or XP', () => {
  const run = fresh(); run.consumables = { shieldManual: 1 };
  const before = structuredClone(run);
  const plan = skillBookReadPlan(reg, run, 'shieldManual');
  assert.deepEqual(run, before, 'opening and cancelling is inert');
  assert.throws(() => commitSkillBookRead(reg, run, plan), /Choose/);
  assert.throws(() => commitSkillBookRead(reg, run, { ...plan, choice: { kind: 'class', id: 'rogue' } }), /Choose/);
  assert.throws(() => commitSkillBookRead(reg, run, { ...plan, skillId: 'item:blade', choice: plan.lessons[0] }), /Choose/);
  assert.throws(() => commitSkillBookRead(reg, run, { ...plan, choice: plan.lessons[0] }, { inCombat: true }), /fight|combat/i);
  assert.deepEqual(run, before);
});

test('class books retain XP, tree picks, armour and card ownership through equip, remove and reload', () => {
  const run = fresh(); run.consumables = { starseerClassBook: 2 };
  read(run, 'starseerClassBook');
  assert.equal(run.skills['class:starseer'].xp, 40);
  assert.equal(skillBookReadPlan(reg, run, 'starseerClassBook').ok, true, 'known class can still grant XP and bonuses');
  run.skills['class:reaver'] = { xp: 17, level: 2, pendingDrafts: 1 };
  run.coreTags = ['ironFooting'];
  const reaverArmour = [...run.loadout.sets.armor];
  const skills = structuredClone(run.skills);
  const cards = run.deck.filter((row) => !row.equipmentRole).map((row) => row.instanceId);
  equipClassCard(reg, run, 'starseer');
  assert.equal(run.class, 'starseer');
  assert.deepEqual(run.skills, skills);
  equipClassCard(reg, run, null);
  assert.equal(run.zones.core, null);
  assert.deepEqual(run.zones.coreTags, []);
  assert.equal(runClassIdentity(reg, run).name, 'Classless');
  assert.equal(awardClassXp(reg, run, { victory: true }), null);
  const saves = createSaveManager(createMemoryStorage());
  saves.saveRun(run, createRng(221));
  const restored = saves.loadRun(reg);
  assert.ok(restored, 'classless run loads through the real save door');
  assert.equal(restored.classUnequipped, true);
  assert.deepEqual(restored.skills, skills);
  equipClassCard(reg, restored, 'reaver');
  assert.deepEqual(restored.coreTags, ['ironFooting']);
  assert.deepEqual(restored.loadout.sets.armor, reaverArmour);
  assert.deepEqual(restored.skills, skills);
  assert.ok(cards.every((id) => restored.deck.some((row) => row.instanceId === id)));
  assert.deepEqual(validateRunShape(restored), []);
});

test('classless combat and its restored snapshot mount no class properties; equipping restores them', () => {
  const run = fresh(); equipClassCard(reg, run, null);
  const enemyId = reg.enemies.all().find((row) => row.hp && row.hp[1] < 200).id;
  const combat = createRunCombat({ registries: reg, rng: createRng(221), run, enemyIds: [enemyId] });
  assert.equal(combat.player.classUnequipped, true);
  assert.ok(!Object.keys(combat.propertyMounts?.player || {}).some((id) => id.startsWith('class:')));
  const snapshot = serializeCombatSnapshot(combat);
  const restored = restoreCombatSnapshot({ registries: reg, rng: createRng(221), snapshot });
  assert.equal(restored.player.classUnequipped, true);
  assert.ok(!Object.keys(restored.propertyMounts?.player || {}).some((id) => id.startsWith('class:')));
  equipClassCard(reg, run, 'reaver');
  const equipped = createRunCombat({ registries: reg, rng: createRng(221), run, enemyIds: [enemyId] });
  assert.ok(Object.keys(equipped.propertyMounts?.player || {}).some((id) => id.startsWith('class:')));
});

test('class equip rejects unknown/unlearned cards, combat and unfinished rewards without mutation', () => {
  const run = fresh(); const before = structuredClone(run);
  assert.throws(() => equipClassCard(reg, run, 'rogue'), /Learn/);
  assert.throws(() => equipClassCard(reg, run, null, { inCombat: true }), /combat/);
  assert.deepEqual(run, before);
  run.pendingReward = {};
  assert.throws(() => equipClassCard(reg, run, null), /reward/);
  assert.equal(run.classUnequipped, undefined);
});

test('the Mirror retains learned class ownership while resetting all class progress', () => {
  const run = fresh(); run.consumables = { starseerClassBook: 1 };
  read(run, 'starseerClassBook');
  run.skills['class:reaver'] = { level: 3, xp: 17, pendingDrafts: 0 };
  run.coreTags = ['ironFooting'];
  swapRunClass(reg, run, 'rogue');
  assert.deepEqual(new Set(learnedClassIds(run)), new Set(['reaver', 'starseer', 'rogue']));
  assert.ok(!Object.keys(run.skills).some((id) => id.startsWith('class:')));
  equipClassCard(reg, run, 'reaver');
  assert.deepEqual(run.coreTags, [], 'the Mirror reset is not undone by re-equipping');
});

test('book commit rechecks live copy limits and keeps excess lessons in the sideboard', () => {
  for (const limit of [1, 2]) {
    const run = fresh(); run.consumables = { universalTome: 1 };
    run.skills['item:shield'] = { level: 20, xp: 0, pendingDrafts: 0 };
    const plan = skillBookReadPlan(reg, run, 'universalTome', { skillId: 'item:shield' });
    const choice = plan.lessons.find((row) => row.kind === 'card' && deckCopyLimit(reg, row.id, {}, run.class) === 1);
    assert.ok(choice);
    run.deck = run.deck.filter((card) => card.cardId !== choice.id);
    const quote = { ...plan, choice };
    for (let i = 0; i < limit; i++) run.deck.push({ instanceId: `limit-${i}`, cardId: choice.id, upgraded: false });
    const receipt = commitSkillBookRead(reg, run, quote, { settings: { classSpellPowerCopies: limit } });
    assert.equal(receipt.destination, 'sideboard');
    assert.equal(run.deck.filter((card) => card.cardId === choice.id).length, limit);
    assert.equal(run.sideboard.at(-1).cardId, choice.id);
    assert.equal(run.skills['item:shield'].xp, 40);
    assert.equal(run.consumables.universalTome, undefined);
  }
});

test('lesson preview matches the awarded upgrade and leaves the live run untouched', () => {
  const run = fresh(); run.consumables = { spellbook: 1 };
  run.skills['item:magic-focus'] = { level: reg.balance.skill.upgradeAt, xp: 0, pendingDrafts: 0 };
  const plan = skillBookReadPlan(reg, run, 'spellbook');
  const schools = bookTags(reg, { skill: plan.skillId });
  const choice = plan.lessons.find((row) => reg.cards.get(row.id).tags.some((tag) => schools.includes(tag)));
  const before = structuredClone(run);
  const preview = bookLessonCard(reg, run, plan.def, plan.skillId, choice.id);
  assert.equal(preview.upgraded, true);
  assert.deepEqual(run, before);
  const receipt = read(run, 'spellbook', choice);
  const actual = run[receipt.destination].at(-1);
  assert.equal(preview.upgraded, actual.upgraded);
});
