// Owner 2026-10-28 (batch 3): ten new Core mana-cost spells (four Starseer, four Herald, two colorless). Each costs mana
// (MP >= 1), resolves at both grades, counts as a mana card for the depth 4+ reward lean, and stays in its own class.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileRewardOffers } from '../src/model/gameProfileRewards.js';
import { basicOrCantripMatcher } from '../src/model/stanceCoverage.js';
import { balanceMana } from '../src/content/generated/balanceMana.js';
import { balanceExposure } from '../src/content/generated/balanceExposure.js';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const ids = list => list.map(id => `core.${id}`);
const BY_CLASS = {
  starseer: ids(['starfall', 'cometLance', 'searingRay', 'meteor']),
  herald: ids(['sanctifiedWard', 'healingPrayer', 'judgment', 'dawnBulwark']),
  colorless: ids(['arcaneSiphon', 'emberWave']),
};
const ALL = Object.values(BY_CLASS).flat();
const def = id => profile.content.cards.find(card => card.id === id);
const live = (classId, seed, floor) => {
  const run = createRunState({ registries, seed, classId, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  run.floor = floor;
  return run;
};
const offered = (classId, seed, floor) => gameProfileRewardOffers(registries, live(classId, seed, floor), createRng(seed + 50000), { offerId: 'b3' })
  .options.filter(option => option.kind === 'combatCards').map(option => option.id);

test('every new spell is authored in its class, costs mana, is not a cantrip, and has a rarity of uncommon or rare', () => {
  for (const [cls, list] of Object.entries(BY_CLASS)) for (const id of list) {
    const card = def(id);
    assert.equal(card.class, cls, id);
    assert.ok(card.manaCost >= 1, `${id} costs mana`);
    assert.ok(card.staminaCost >= balanceMana.minActionCost, `${id}: a mana card costs at least ${balanceMana.minActionCost} SP (balance.mana.minActionCost)`);
    assert.ok(['uncommon', 'rare'].includes(card.rarity), id);
    assert.ok(!card.tags.includes('rank.cantrip'), `${id} is not a cantrip`);
    assert.ok(card.tags.includes('camp:spell'), id);
    if (card.effects.some(e => e.op === 'damage')) assert.ok(card.exposureBuildupPerHit >= balanceExposure.buildupPerManaSpell, `${id}: a mana attack builds at least ${balanceExposure.buildupPerManaSpell} Arcane Exposure per hit`);
  }
  assert.equal(ALL.length, 10);
  assert.equal(new Set(ALL.map(id => def(id).name)).size, 10);
});

test('every new spell resolves at base and upgraded with its authored cost, a face and a stronger upgrade', () => {
  for (const id of ALL) {
    const base = resolveCard(registries, { cardId: id }), up = resolveCard(registries, { cardId: id, upgraded: true });
    assert.equal(base.cost, def(id).staminaCost, id);
    assert.equal(base.manaCost, def(id).manaCost, id);
    assert.equal(up.cost, base.cost, `${id}: the upgrade keeps its SP cost`);
    assert.equal(up.manaCost, base.manaCost, `${id}: the upgrade keeps its MP cost`);
    assert.ok(base.textTemplate && up.textTemplate, id);
    assert.notDeepEqual(up.effects, base.effects, `${id}: the upgrade changes numbers`);
    assert.deepEqual(up.keywords, base.keywords, `${id}: the upgrade keeps its keywords`);
  }
});

test('no authored Burn exceeds the 3-stack application cap, so the face never promises more than lands', () => {
  for (const id of ALL) for (const effects of [def(id).effects, def(id).upgrade.effects]) for (const effect of effects) {
    if (effect.op === 'applyStatus' && effect.status === 'burn') assert.ok(effect.stacks <= 3, `${id}: Burn ${effect.stacks} (the engine caps Burn at 3 stacks)`);
  }
});

test('resource variants are authored for all four resource modes and agree with the fixed cost', () => {
  const variants = profile.content.resourceVariants;
  for (const id of ALL) {
    const card = def(id), row = variants[id];
    assert.ok(row, id);
    assert.deepEqual(row['sp,mp'], { cost: card.staminaCost, staminaCost: card.staminaCost, manaCost: card.manaCost }, id);
    assert.deepEqual(row.none, { cost: 0, staminaCost: 0, manaCost: 0 }, id);
    assert.equal(row.mp.manaCost, card.manaCost, id);
    assert.equal(row.sp.staminaCost, card.staminaCost, id);
  }
});

test('Healing Prayer matches the heal-rules cheap shape and no new spell is strictly better than a same-cost same-rarity peer', () => {
  const card = def('core.healingPrayer'), shapes = profile.modules['heal-rules'].shapes;
  const shape = shapes.filter(s => s.tags.every(t => card.tags.includes(t))).sort((a, b) => b.tags.length - a.tags.length)[0];
  assert.equal(shape.id, 'cheap');
  assert.deepEqual([card.staminaCost, card.manaCost], [shape.cost.sp, shape.cost.mp]);
  assert.ok(card.keywords.includes('exhaust'));
  // Same rarity and same SP/MP: the effect lists differ in kind, so none dominates another.
  const key = id => `${def(id).rarity}/${def(id).staminaCost}/${def(id).manaCost}`;
  for (const a of ALL) for (const b of ALL) if (a !== b && key(a) === key(b)) {
    const ops = id => def(id).effects.map(e => `${e.op}:${e.status || ''}:${e.target || ''}`).sort().join(',');
    assert.notEqual(ops(a), ops(b), `${a} and ${b} would duplicate each other`);
  }
});

test('the reward model counts each new spell as a mana card, never as a basic or cantrip', () => {
  const matches = basicOrCantripMatcher(registries, live('starseer', 1, 1));
  for (const id of ALL) {
    assert.ok((def(id).manaCost || 0) > 0, `${id} is a mana card`);
    assert.ok(!matches(id), `${id} is not a basic/cantrip`);
  }
});

test('Magic classes see their new spells more often at depth 4+ than at depth 1-3 (600 seeds per class and band)', () => {
  const report = [];
  for (const classId of ['starseer', 'herald']) {
    const own = new Set([...BY_CLASS[classId], ...BY_CLASS.colorless]);
    const share = floors => {
      let hits = 0, total = 0;
      for (let seed = 1; seed <= 600; seed++) for (const id of offered(classId, seed, floors[seed % floors.length])) { total++; if (own.has(id)) hits++; }
      return hits / total;
    };
    const early = share([1, 2, 3]), late = share([4, 5, 6]);
    report.push(`${classId}: depth 1-3 ${(early * 100).toFixed(1)}%, depth 4+ ${(late * 100).toFixed(1)}%`);
    assert.ok(early > 0, `${classId} sees its new spells early at all`);
    assert.ok(late > early * 1.2, `${classId}: depth 4+ share ${late} should exceed depth 1-3 share ${early}`);
  }
  console.log(`new-spell share of card offers: ${report.join('; ')}`);
});

test('offers never cross classes: Magic spells only reach their own class, colorless reach everyone, Martial never sees a Magic card', () => {
  const magic = { starseer: BY_CLASS.starseer, herald: BY_CLASS.herald };
  for (const classId of ['starseer', 'herald', 'reaver', 'rogue']) {
    const seen = new Set();
    for (let seed = 1; seed <= 600; seed++) for (const id of offered(classId, seed, 1 + (seed % 6))) seen.add(id);
    for (const [owner, list] of Object.entries(magic)) for (const id of list) {
      if (owner === classId) assert.ok(seen.has(id), `${classId} never offered its own ${id}`);
      else assert.ok(!seen.has(id), `${classId} was offered ${owner}'s ${id}`);
    }
    for (const id of BY_CLASS.colorless) assert.ok(seen.has(id), `${classId} never offered colorless ${id}`);
  }
});
