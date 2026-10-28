// Owner 2026-10-28 (batch 4): ten mixed Core mana-cost cards (two each Reaver, Rogue, Starseer, Herald, colorless). Martial classes
// have MP in Core (Reaver 1, Rogue 2), so they get mana cards too, sized to their pool. Each costs SP >= 1 and MP >= 1, resolves at
// both grades, counts as a mana card for the depth 4+ reward lean, and stays in its own class.
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
  reaver: ids(['ironbreaker', 'rallyingRoar']),
  rogue: ids(['venomedEdge', 'smokeVeil']),
  starseer: ids(['eclipse', 'astralBolt']),
  herald: ids(['censure', 'smite']),
  colorless: ids(['hexmark', 'manaLash']),
};
const CLASSES = ['reaver', 'rogue', 'starseer', 'herald'];
const ALL = Object.values(BY_CLASS).flat();
const def = id => profile.content.cards.find(card => card.id === id);
const live = (classId, seed, floor) => {
  const run = createRunState({ registries, seed, classId, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  run.floor = floor;
  return run;
};
const offered = (classId, seed, floor) => gameProfileRewardOffers(registries, live(classId, seed, floor), createRng(seed + 50000), { offerId: 'b4' })
  .options.filter(option => option.kind === 'combatCards').map(option => option.id);

test('every card is authored in its class, costs SP and MP, is not a cantrip, and is uncommon or rare (at most 3 rares)', () => {
  for (const [cls, list] of Object.entries(BY_CLASS)) for (const id of list) {
    const card = def(id);
    assert.equal(card.class, cls, id);
    assert.ok(card.manaCost >= 1, `${id} costs mana`);
    assert.ok(card.staminaCost >= balanceMana.minActionCost, `${id}: a mana card costs at least ${balanceMana.minActionCost} SP (balance.mana.minActionCost)`);
    assert.ok(['uncommon', 'rare'].includes(card.rarity), id);
    assert.ok(!card.tags.includes('rank.cantrip'), `${id} is not a cantrip`);
    if (card.damageSchool === 'magic') assert.ok(card.exposureBuildupPerHit >= balanceExposure.buildupPerManaSpell, `${id}: a magic attack builds at least ${balanceExposure.buildupPerManaSpell} Arcane Exposure per hit`);
    if (cls === 'starseer' || cls === 'herald' || cls === 'colorless') assert.ok(card.tags.includes('camp:spell'), id);
  }
  assert.equal(ALL.length, 10);
  assert.equal(new Set(ALL.map(id => def(id).name)).size, 10);
  assert.ok(ALL.filter(id => def(id).rarity === 'rare').length <= 3);
  // A magic-school attack must carry exposure; check every damage card explicitly.
  for (const id of ALL) if (def(id).effects.some(e => e.op === 'damage') && def(id).damageSchool === 'magic') assert.ok(def(id).exposureBuildupPerHit >= 5, id);
});

test('each class can afford its cards: a card never costs more MP than its class has', () => {
  for (const classId of CLASSES) {
    const maxMana = live(classId, 1, 1).maxMana;
    for (const id of [...BY_CLASS[classId], ...BY_CLASS.colorless]) assert.ok(def(id).manaCost <= maxMana, `${classId} (${maxMana} MP) cannot play ${id} (${def(id).manaCost} MP)`);
  }
});

test('every card resolves at base and upgraded with its authored cost, a face and a stronger upgrade', () => {
  for (const id of ALL) {
    const base = resolveCard(registries, { cardId: id }), up = resolveCard(registries, { cardId: id, upgraded: true });
    assert.equal(base.cost, def(id).staminaCost, id);
    assert.equal(base.manaCost, def(id).manaCost, id);
    assert.ok(base.manaCost >= 1 && base.cost >= 1, id);
    assert.equal(up.cost, base.cost, `${id}: the upgrade keeps its SP cost`);
    assert.equal(up.manaCost, base.manaCost, `${id}: the upgrade keeps its MP cost`);
    assert.ok(base.textTemplate && up.textTemplate, id);
    assert.notDeepEqual(up.effects, base.effects, `${id}: the upgrade changes numbers`);
    assert.deepEqual(up.keywords, base.keywords, `${id}: the upgrade keeps its keywords`);
  }
});

test('no authored Burn exceeds the 3-stack application cap', () => {
  for (const id of ALL) for (const effects of [def(id).effects, def(id).upgrade.effects]) for (const effect of effects) {
    if (effect.op === 'applyStatus' && effect.status === 'burn') assert.ok(effect.stacks <= 3, `${id}: Burn ${effect.stacks}`);
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

test('no card is strictly better than a peer it shares a reward pool with, in either direction', () => {
  const all = profile.content.cards.filter(card => card.id.startsWith('core.'));
  const amount = (card, key) => card.effects.filter(e => e.op === key).reduce((n, e) => n + (e.amount || 0), 0);
  const stacks = card => Object.fromEntries(card.effects.filter(e => e.op === 'applyStatus').map(e => [e.status, e.stacks]));
  // x is at least as good as y in every effect (so a card that only does more of y's job, for no more cost, makes y dead).
  const covers = (x, y) => {
    const keys = new Set([...x.effects.map(e => e.op), ...y.effects.map(e => e.op)]);
    const sx = stacks(x), sy = stacks(y);
    return [...keys].every(k => k === 'applyStatus' || amount(x, k) >= amount(y, k))
      && Object.keys(sy).every(s => (sx[s] || 0) >= sy[s]) && x.keywords.length <= y.keywords.length;
  };
  const samePool = (x, y) => x.class === y.class || x.class === 'colorless' || y.class === 'colorless';
  for (const id of ALL) for (const other of all) {
    const a = def(id);
    if (other.id === id || !samePool(a, other)) continue;
    // Existing cards (starters and class specials included) at the same or lower cost, any rarity, must not cover the new card.
    if (other.staminaCost <= a.staminaCost && other.manaCost <= a.manaCost) assert.ok(!covers(other, a), `${other.id} (${other.staminaCost} SP / ${other.manaCost} MP) covers ${id} at no more cost`);
    // The new card must not cover an existing same-rarity card at the same or higher cost.
    if (other.rarity === a.rarity && other.staminaCost >= a.staminaCost && other.manaCost >= a.manaCost && !ALL.includes(other.id)) assert.ok(!covers(a, other), `${id} covers ${other.id} at no more cost`);
  }
  // Ironbreaker is the cheap-SP mana option, so the 2 SP / 1 MP Reaver starter must not beat it, nor share its cost.
  const starter = def('core.reaverSpecial'), ironbreaker = def('core.ironbreaker');
  assert.ok(starter, 'core.reaverSpecial exists');
  assert.ok(!covers(starter, ironbreaker), 'core.reaverSpecial does not dominate Ironbreaker');
  assert.ok(ironbreaker.staminaCost < starter.staminaCost && ironbreaker.manaCost <= starter.manaCost, 'Ironbreaker costs less SP than the starter');
});

test('the reward model counts each card as a mana card, never as a basic or cantrip', () => {
  for (const classId of CLASSES) {
    const matches = basicOrCantripMatcher(registries, live(classId, 1, 1));
    for (const id of [...BY_CLASS[classId], ...BY_CLASS.colorless]) {
      assert.ok((def(id).manaCost || 0) > 0, `${id} is a mana card`);
      assert.ok(!matches(id), `${classId}: ${id} is not a basic/cantrip`);
    }
  }
});

test('every class sees its new cards more often at depth 4+ than at depth 1-3 (600 seeds per class and band)', () => {
  const report = [];
  for (const classId of CLASSES) {
    const own = new Set([...BY_CLASS[classId], ...BY_CLASS.colorless]);
    const share = floors => {
      let hits = 0, total = 0;
      for (let seed = 1; seed <= 600; seed++) for (const id of offered(classId, seed, floors[seed % floors.length])) { total++; if (own.has(id)) hits++; }
      return hits / total;
    };
    const early = share([1, 2, 3]), late = share([4, 5, 6]);
    report.push(`${classId}: depth 1-3 ${(early * 100).toFixed(1)}%, depth 4+ ${(late * 100).toFixed(1)}%`);
    assert.ok(early > 0, `${classId} sees its new cards early at all`);
    assert.ok(late > early, `${classId}: depth 4+ share ${late} should exceed depth 1-3 share ${early}`);
  }
  console.log(`new-card share of card offers: ${report.join('; ')}`);
});

test('offers never cross classes: class cards only reach their own class, colorless reach everyone', () => {
  for (const classId of CLASSES) {
    const seen = new Set();
    for (let seed = 1; seed <= 600; seed++) for (const id of offered(classId, seed, 1 + (seed % 6))) seen.add(id);
    for (const [owner, list] of Object.entries(BY_CLASS)) for (const id of list) {
      if (owner === classId || owner === 'colorless') assert.ok(seen.has(id), `${classId} never offered ${id}`);
      else assert.ok(!seen.has(id), `${classId} was offered ${owner}'s ${id}`);
    }
  }
});
