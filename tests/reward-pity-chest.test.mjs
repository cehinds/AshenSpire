// tests/reward-pity-chest.test.mjs — card-rarity pity and the elite chest
// (SPEC §3.8.1).
import assert from 'node:assert/strict';
import test from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, validateRunShape, serializeRun, deserializeRun } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import {
  rollCardRewardIds, pityWeights, rollEliteChest, chestUpgradeable, CHEST_CATEGORIES,
} from '../src/engine/encounters.js';
import { rewardPlan, resolveContinue } from '../src/model/rewardplan.js';
import { applyChestOption, autoTakeChest, landChestPick } from '../src/model/rewardChest.js';

const r = createRegistries(contentBundle);
const pity = r.balance.rewards.cardPity;
const rarity = (id) => r.cards.get(id).rarity;
const newRun = (seed = 5, classId = 'reaver') => createRunState({ registries: r, classId, seed });

// A scripted rng: `float` answers from a queue (then 0), `pick` takes the first.
const scripted = (floats = []) => ({
  float: () => (floats.length ? floats.shift() : 0),
  pick: (_s, items) => items[0],
  int: (_s, lo) => lo,
});

test('pity weights: rare share plus offset, clamped, rest split in ratio', () => {
  const w = { common: 60, uncommon: 35, rare: 5 };
  const all = ['common', 'uncommon', 'rare'];
  assert.deepEqual(pityWeights(w, all, 0), { rare: 5, common: 60, uncommon: 35 });
  const low = pityWeights(w, all, -5);
  assert.equal(low.rare, 0);
  assert.ok(Math.abs(low.common - (100 * 60) / 95) < 1e-9);
  assert.ok(Math.abs(low.uncommon - (100 * 35) / 95) < 1e-9);
  assert.equal(pityWeights(w, all, 10).rare, 15);
  assert.equal(pityWeights(w, all, 200).rare, 100);
  assert.equal(pityWeights(w, all, -50).rare, 0);
  // A pool with no rare card keeps its authored row.
  assert.equal(pityWeights(w, ['common', 'uncommon'], 30), w);
});

test('offset climbs per common shown, resets on a rare, and is capped', () => {
  const run = newRun();
  assert.equal(run.cardRarityOffset, undefined, 'a fresh run carries no counter until first read');
  // Rolls of 0 land every slot on common.
  rollCardRewardIds(r, scripted(), { classId: 'reaver', pool: 'normal', run });
  const n = r.balance.rewards.cardChoices;
  assert.equal(run.cardRarityOffset, pity.offsetStart + n * pity.offsetStep);
  assert.equal(run.cardRewardsSinceRare, 1);
  run.cardRarityOffset = pity.offsetMax;
  rollCardRewardIds(r, scripted(), { classId: 'reaver', pool: 'normal', run });
  assert.equal(run.cardRarityOffset, pity.offsetMax, 'capped at offsetMax');
  // A roll just under 1 lands in the rare band (last) — the offset resets.
  run.cardRewardsSinceRare = 0;
  rollCardRewardIds(r, scripted([0, 0, 0.9999]), { classId: 'reaver', pool: 'normal', run });
  assert.equal(run.cardRarityOffset, pity.offsetStart);
  assert.equal(run.cardRewardsSinceRare, 0);
});

test('offset shifts the rare band: a roll that missed rare now hits it', () => {
  const run = newRun();
  // Normal pool: 5% rare. A roll at 0.93 is uncommon at offset 0 …
  run.cardRarityOffset = 0;
  const plain = rollCardRewardIds(r, scripted([0.93]), { classId: 'reaver', pool: 'normal', run });
  assert.equal(rarity(plain[0]), 'uncommon');
  // … and rare once the offset opens the band to 5 + 5 = 10%.
  run.cardRarityOffset = 5;
  const lifted = rollCardRewardIds(r, scripted([0.93]), { classId: 'reaver', pool: 'normal', run });
  assert.equal(rarity(lifted[0]), 'rare');
});

test(`a rare is guaranteed after ${pity.rareGuaranteeAfter} rare-less offers`, () => {
  const run = newRun();
  for (let i = 0; i < pity.rareGuaranteeAfter; i++) {
    const ids = rollCardRewardIds(r, scripted(), { classId: 'reaver', pool: 'normal', run });
    assert.ok(!ids.some((id) => rarity(id) === 'rare'), `offer ${i + 1} is all common`);
  }
  assert.equal(run.cardRewardsSinceRare, pity.rareGuaranteeAfter);
  const ids = rollCardRewardIds(r, scripted(), { classId: 'reaver', pool: 'normal', run });
  assert.equal(ids.filter((id) => rarity(id) === 'rare').length, 1, 'the last slot became a rare');
  assert.equal(rarity(ids.at(-1)), 'rare');
  assert.equal(new Set(ids).size, ids.length, 'still distinct');
  assert.equal(run.cardRewardsSinceRare, 0);
  assert.equal(run.cardRarityOffset, pity.offsetStart);
});

test('over real seeds no stretch runs longer than the guarantee', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const run = newRun(seed);
    const rng = createRng(seed);
    let streak = 0;
    for (let i = 0; i < 40; i++) {
      const ids = rollCardRewardIds(r, rng, { classId: 'reaver', pool: 'normal', run });
      streak = ids.some((id) => rarity(id) === 'rare') ? 0 : streak + 1;
      assert.ok(streak <= pity.rareGuaranteeAfter, `seed ${seed}: streak ${streak}`);
    }
  }
});

test('pity is seeded: one seed replays the same offers and counters', () => {
  const play = () => {
    const run = newRun(11);
    const rng = createRng(11);
    const offers = [];
    for (let i = 0; i < 12; i++) offers.push(rollCardRewardIds(r, rng, { classId: 'reaver', pool: i % 3 ? 'normal' : 'elite', run }));
    return { offers, offset: run.cardRarityOffset, since: run.cardRewardsSinceRare };
  };
  assert.deepEqual(play(), play());
});

test('no run, or Chaos Rewards, leaves the counters alone', () => {
  const run = newRun();
  rollCardRewardIds(r, createRng(3), { classId: 'reaver', pool: 'normal' });
  rollCardRewardIds(r, createRng(3), { classId: 'reaver', pool: 'normal', run, flatRarity: true });
  assert.equal(run.cardRarityOffset, undefined);
  assert.equal(run.cardRewardsSinceRare, undefined);
});

test('an old save without the counters defaults them on first read', () => {
  const run = newRun();
  delete run.cardRarityOffset;
  delete run.cardRewardsSinceRare;
  const json = JSON.parse(JSON.stringify(run));
  const ids = rollCardRewardIds(r, createRng(4), { classId: 'reaver', pool: 'normal', run: json });
  assert.equal(ids.length, r.balance.rewards.cardChoices);
  assert.ok(Number.isFinite(json.cardRarityOffset));
  assert.ok(Number.isInteger(json.cardRewardsSinceRare));
});

// ---- the elite chest -------------------------------------------------------

test('the chest offers three distinct categories, seeded', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const run = newRun(seed);
    const chest = rollEliteChest(r, createRng(seed), run, { found: [] });
    assert.equal(chest.options.length, r.balance.rewards.eliteChest.choices, `seed ${seed}`);
    const cats = chest.options.map((o) => o.category);
    assert.equal(new Set(cats).size, cats.length, `seed ${seed}: distinct ${cats}`);
    for (const c of cats) assert.ok(CHEST_CATEGORIES.includes(c));
    assert.deepEqual(rollEliteChest(r, createRng(seed), newRun(seed), { found: [] }), chest, 'same seed, same chest');
  }
});

test('the chest draws on relicRewards only, so no other stream shifts', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const rng = createRng(seed);
    const chest = rollEliteChest(r, rng, newRun(seed), { found: [] });
    assert.ok(chest && chest.options.length, `seed ${seed}: a chest`);
    const counters = rng.getCounters();
    for (const [stream, count] of Object.entries(counters)) {
      if (stream === 'relicRewards') assert.ok(count > 0, `seed ${seed}: the chest drew on relicRewards`);
      else assert.equal(count, 0, `seed ${seed}: the chest drew on ${stream}`);
    }
  }
});

test('every category builds a valid payload', () => {
  const seen = new Set();
  for (let seed = 1; seed < 60 && seen.size < CHEST_CATEGORIES.length; seed++) {
    const run = newRun(seed);
    for (const o of rollEliteChest(r, createRng(seed), run).options) {
      seen.add(o.category);
      if (o.category === 'relic') assert.ok(r.relics.has(o.relicId) && !run.relics.includes(o.relicId));
      if (o.category === 'upgrade') {
        if (o.mode === 'owned') assert.ok(chestUpgradeable(r, run, run.deck.find((c) => c.instanceId === o.instanceId)));
        else assert.equal(rarity(o.cardId), 'rare');
      }
      if (o.category === 'armament') assert.ok(o.armamentId || o.weaponArtId);
      if (o.category === 'cinders') {
        const [lo, hi] = r.balance.rewards.eliteChest.cinders;
        assert.ok(o.cinders >= lo && o.cinders <= hi);
        assert.equal(o.smithingStones, r.balance.rewards.eliteChest.smithingStones);
      }
    }
  }
  assert.deepEqual([...seen].sort(), [...CHEST_CATEGORIES].sort());
});

test('an unbuildable category is dropped, not offered empty', () => {
  const run = newRun(2);
  run.relics = r.relics.all().map((x) => x.id); // nothing left to drop
  for (let seed = 1; seed < 20; seed++) {
    const chest = rollEliteChest(r, createRng(seed), run);
    assert.ok(!chest.options.some((o) => o.category === 'relic'));
    assert.equal(chest.options.length, 3);
  }
});

test('taking a chest option grants exactly that option', () => {
  const base = newRun(7);
  const cases = [
    { category: 'relic', relicId: r.relics.all().find((x) => x.rarity === 'common' && !base.relics.includes(x.id)).id },
    { category: 'upgrade', mode: 'owned', instanceId: base.deck.find((c) => chestUpgradeable(r, base, c))?.instanceId },
    { category: 'upgrade', mode: 'rare', cardId: r.classes.get('reaver').cardPool.find((id) => rarity(id) === 'rare') },
    { category: 'cinders', cinders: 100, smithingStones: 1 },
  ].filter((o) => o.category !== 'upgrade' || o.instanceId || o.cardId);
  for (const option of cases) {
    const run = structuredClone(base);
    const before = structuredClone(run);
    assert.equal(applyChestOption(r, run, option), true, option.category);
    if (option.category === 'relic') {
      assert.deepEqual(run.relics, [...before.relics, option.relicId]);
      assert.equal(run.deck.length, before.deck.length);
      assert.equal(run.cinders, before.cinders);
    } else if (option.category === 'upgrade' && option.mode === 'owned') {
      assert.equal(run.deck.length, before.deck.length);
      const changed = run.deck.filter((c, i) => JSON.stringify(c) !== JSON.stringify(before.deck[i]));
      assert.equal(changed.length, 1);
      assert.equal(changed[0].instanceId, option.instanceId);
      assert.equal(changed[0].upgraded, true);
      assert.deepEqual(run.relics, before.relics);
    } else if (option.category === 'upgrade') {
      assert.equal(run.deck.length, before.deck.length + 1);
      assert.deepEqual(run.deck.at(-1).cardId, option.cardId);
      assert.equal(run.deck.at(-1).upgraded, true);
    } else {
      assert.equal(run.cinders, before.cinders + 100);
      assert.equal(run.smithingStones, (before.smithingStones || 0) + 1);
      assert.deepEqual(run.deck, before.deck);
      assert.deepEqual(run.relics, before.relics);
    }
  }
});

test('the chest is one choice row in the reward menu, auto-collect picks one', () => {
  const chest = { options: [
    { category: 'relic', relicId: 'x' },
    { category: 'armament', armamentId: 'y' },
    { category: 'cinders', cinders: 90, smithingStones: 1 },
  ] };
  const plan = rewardPlan({ cinders: 50, chest }, { flaskSlotsFree: 1, armamentSlotsFree: 1 });
  const row = plan.rows.find((x) => x.kind === 'chest');
  assert.equal(row.key, 'chest');
  assert.equal(row.choice, true);
  assert.equal(row.options.length, 3);
  const { take } = resolveContinue(plan, {}, 'auto', () => 2);
  const took = take.find((x) => x.kind === 'chest');
  assert.equal(took.optionIndex, 2);
  // A full bag makes the armament option untakeable; auto never picks it.
  const full = rewardPlan({ chest }, { flaskSlotsFree: 1, armamentSlotsFree: 0 });
  const fullRow = full.rows[0];
  assert.deepEqual(fullRow.takeable, [true, false, true]);
  const picks = [0, 1].map((i) => resolveContinue(full, {}, 'auto', () => i).take[0].optionIndex);
  assert.deepEqual(picks, [0, 2]);
  // Manual Continue leaves it.
  assert.equal(resolveContinue(plan, {}, 'manual').take.length, 0);
});

test('the reward door: open the chest, pick one, Confirm grants exactly it', async () => {
  const { rewardDom } = await import('./helpers/reward-dom.mjs');
  const { mountRewards } = await import('../src/ui/screens/reward.js');
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main'); document.body.append(app);
    const run = { class: 'reaver', cinders: 0, smithingStones: 0, deck: [], flasks: [], relics: [], loadout: { storage: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] } };
    const checkpoint = { states: {}, chosenCardId: null };
    const relicId = r.relics.all().find((x) => x.rarity === 'common').id;
    const rewards = { chest: { options: [
      { category: 'relic', relicId },
      { category: 'armament', armamentId: 'greatsword' },
      { category: 'cinders', cinders: 90, smithingStones: 1 },
    ] } };
    let writes = 0;
    mountRewards(app, { registries: r, run, checkpoint, rewards, onDone() {}, onPersist() { writes++; } });
    app.querySelector('[data-kind="chest"]').click();
    const tiles = app.querySelectorAll('.reward-row .reward-chest-option');
    assert.equal(tiles.length, 3);
    assert.equal(tiles[1].disabled, true, 'a full bag locks the armament option');
    const confirm = app.querySelector('#reward-card-confirm');
    assert.equal(confirm.disabled, true);
    tiles[2].click();
    assert.equal(run.cinders, 0, 'selection never collects');
    confirm.click();
    confirm.click();
    assert.equal(run.cinders, 90);
    assert.equal(run.smithingStones, 1);
    assert.deepEqual(run.relics, [], 'the relic stays in the chest');
    assert.equal(checkpoint.states.chest, 'taken');
    assert.equal(checkpoint.chosenChestIndex, 2);
    assert.equal(writes, 1, 'one persist for one take');
    app.remove();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

test('the chest never offers the door\'s own armament drop', () => {
  let excluded = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const piece = rollEliteChest(r, createRng(seed), newRun(seed), { found: [] }).options.find((o) => o.armamentId);
    if (!piece) continue;
    const again = rollEliteChest(r, createRng(seed), newRun(seed), { found: [], exclude: [piece.armamentId] });
    const other = again.options.find((o) => o.category === 'armament');
    if (other) assert.notEqual(other.armamentId, piece.armamentId, `seed ${seed}: the door's piece is not the chest's too`);
    excluded++;
  }
  assert.ok(excluded > 0, 'some seed rolled an armament piece to exclude');
});

test('the door\'s armament row claims its bag slot before the chest\'s piece', () => {
  const rewards = { armamentId: 'longsword', chest: { options: [
    { category: 'armament', armamentId: 'greatsword' },
    { category: 'cinders', cinders: 50, smithingStones: 1 },
  ] } };
  const plan = rewardPlan(rewards, { flaskSlotsFree: 0, armamentSlotsFree: 1 });
  const chestRow = plan.rows.find((row) => row.kind === 'chest');
  assert.deepEqual(chestRow.takeable, [false, true], 'one free slot is the armament row\'s');
  const taken = resolveContinue(plan, {}, 'auto', () => 0).take;
  assert.deepEqual(taken.map((row) => row.kind), ['armament', 'chest']);
  assert.equal(taken[1].optionIndex, 1, 'auto-collect lands the chest on the purse');
  // Once the armament row is settled (taken: the bag counts it; skipped), the slot math is the bag's own.
  assert.deepEqual(rewardPlan(rewards, { flaskSlotsFree: 0, armamentSlotsFree: 1, armamentRowSettled: true }).rows.find((row) => row.kind === 'chest').takeable, [true, true]);
  assert.deepEqual(rewardPlan(rewards, { flaskSlotsFree: 0, armamentSlotsFree: 2 }).rows.find((row) => row.kind === 'chest').takeable, [true, true]);
});

test('auto-collect never loses the elite chest to a bag the armament row just filled', () => {
  // The reward screen's Continue, headless: the plan, the seeded auto pick,
  // the armament collector and the chest's landing door (landChestPick).
  const storage = ['a', 'b', 'c', 'd', 'e', 'f', 'g']; // one slot free
  const run = { class: 'reaver', cinders: 0, smithingStones: 0, deck: [], flasks: [], relics: [], loadout: { storage } };
  const collectArmament = (id) => { if (storage.length >= 8) return false; storage.push(id); return true; };
  const rewards = { armamentId: 'longsword', chest: { options: [
    { category: 'armament', armamentId: 'greatsword' },
    { category: 'cinders', cinders: 90, smithingStones: 1 },
  ] } };
  const plan = rewardPlan(rewards, { flaskSlotsFree: 0, armamentSlotsFree: 1 });
  const states = {};
  for (const row of resolveContinue(plan, {}, 'auto', () => 0).take) {
    const landed = row.kind === 'chest'
      ? landChestPick(row, (i) => applyChestOption(r, run, row.options[i], { collectArmament })) !== null
      : collectArmament(row.armamentId);
    if (landed) states[row.key] = 'taken';
  }
  assert.deepEqual(states, { armament: 'taken', chest: 'taken' }, 'the chest was claimed, not dropped');
  assert.deepEqual(storage.slice(7), ['longsword']);
  assert.equal(run.cinders, 90);
});

test('a chest pick that fails to land falls back to another takeable option', () => {
  const row = { options: [{ category: 'armament', armamentId: 'greatsword' }, { category: 'relic', relicId: 'x' }, { category: 'cinders', cinders: 90 }], takeable: [true, false, true], optionIndex: 0 };
  const tried = [];
  assert.equal(landChestPick(row, (i) => { tried.push(i); return i === 2; }), 2);
  assert.deepEqual(tried, [0, 2], 'the pick first, then the takeable options in order; never an untakeable one');
  assert.equal(landChestPick(row, () => false), null);
  // A bot door: the collector refuses the piece, the purse lands instead.
  const run = newRun();
  const cinders = run.cinders;
  const got = autoTakeChest(r, run, { options: [row.options[0], row.options[2]] }, () => 0, { armamentSlotsFree: 3, collectArmament: () => false });
  assert.equal(got.category, 'cinders');
  assert.equal(run.cinders, cinders + 90);
});

test('a refused save leaves the chest untouched, and Confirm works on retry', async () => {
  const { rewardDom } = await import('./helpers/reward-dom.mjs');
  const { mountRewards } = await import('../src/ui/screens/reward.js');
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    for (const [index, check] of [
      [0, (run) => assert.equal(run.deck[0].upgraded, true)],
      [1, (run) => assert.equal(run.cinders, 90)],
      [2, (run) => assert.deepEqual(run.loadout.storage, ['greatsword'])],
    ]) {
      const app = document.createElement('main'); document.body.append(app);
      const cardId = r.classes.get('reaver').cardPool.find((id) => r.cards.get(id).upgrade);
      const run = { class: 'reaver', cinders: 0, smithingStones: 0, deck: [{ instanceId: 'c1', cardId, upgraded: false }], flasks: [], relics: [], loadout: { storage: [] } };
      const checkpoint = { states: {}, chosenCardId: null };
      const rewards = { chest: { options: [
        { category: 'upgrade', mode: 'owned', instanceId: 'c1', cardId },
        { category: 'cinders', cinders: 90, smithingStones: 1 },
        { category: 'armament', armamentId: 'greatsword' },
      ] } };
      const collect = (id) => { if (run.loadout.storage.includes(id)) return false; run.loadout.storage.push(id); return true; };
      let refuse = true;
      mountRewards(app, { registries: r, run, checkpoint, rewards, onDone() {}, onPersist: () => !refuse, onCollectArmament: collect });
      app.querySelector('[data-kind="chest"]').click();
      const before = structuredClone(run);
      app.querySelectorAll('.reward-row .reward-chest-option')[index].click();
      const confirm = app.querySelector('#reward-card-confirm');
      confirm.click();
      assert.deepEqual(run, before, `option ${index}: a refused save rolls the grant back`);
      assert.equal(checkpoint.states.chest, undefined);
      assert.equal(checkpoint.chosenChestIndex, undefined);
      refuse = false;
      confirm.click();
      check(run);
      assert.equal(checkpoint.states.chest, 'taken');
      assert.equal(checkpoint.chosenChestIndex, index);
      app.remove();
    }
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

test('save shape: a taken chest names its option; an old relic offer still validates', () => {
  const run = newRun(3);
  const pending = (rewards, extra = {}) => ({
    schemaVersion: 1, source: 'elite', after: 'map', rewards, states: {}, chosenCardId: null,
    chosenDraftCardIds: {}, chosenDraftNodeIds: {}, ...extra,
  });
  const chest = { options: [{ category: 'cinders', cinders: 90, smithingStones: 1 }, { category: 'relic', relicId: 'forsakenMedallion' }] };
  run.pendingReward = pending({ cinders: 10, chest });
  assert.deepEqual(validateRunShape(run), []);
  run.pendingReward = pending({ cinders: 10, chest }, { states: { chest: 'taken' }, chosenChestIndex: 1 });
  assert.deepEqual(validateRunShape(run), []);
  run.pendingReward = pending({ cinders: 10, chest }, { states: { chest: 'taken' } });
  assert.ok(validateRunShape(run).some((p) => p.includes('chosenChestIndex')));
  run.pendingReward = pending({ cinders: 10, chest }, { chosenChestIndex: 5 });
  assert.ok(validateRunShape(run).some((p) => p.includes('chosenChestIndex')));
  // A normal fight's offer carries `chest: null`; an old elite offer a relicId.
  run.pendingReward = pending({ cinders: 10, chest: null, relicId: 'forsakenMedallion' }, { states: { relic: 'taken' } });
  assert.deepEqual(validateRunShape(run), []);
  // A save without the pity counters round-trips and still validates.
  delete run.pendingReward;
  delete run.cardRarityOffset;
  delete run.cardRewardsSinceRare;
  const back = deserializeRun(serializeRun(run));
  assert.equal(back.cardRarityOffset, undefined);
  assert.deepEqual(validateRunShape(back), []);
});

test('a corrupt or stale chest option is refused at the save doors, by name', async () => {
  const { createSaveManager, createMemoryStorage, RUN_KEY } = await import('../src/engine/save.js');
  const run = newRun(3);
  const pending = (options) => ({
    schemaVersion: 1, source: 'elite', after: 'map', rewards: { cinders: 10, chest: { options } }, states: {}, chosenCardId: null,
    chosenDraftCardIds: {}, chosenDraftNodeIds: {},
  });
  const shape = (option) => { run.pendingReward = pending([option]); return validateRunShape(run).join(' | '); };
  assert.match(shape({ category: 'jewel' }), /options\[0\]\.category must be one of relic, upgrade, armament, cinders/);
  assert.match(shape({ category: 'relic' }), /options\[0\]\.relicId must be a non-empty string/);
  assert.match(shape({ category: 'upgrade', mode: 'owned', cardId: 'x' }), /options\[0\]\.instanceId/);
  assert.match(shape({ category: 'upgrade', mode: 'gold', cardId: 'x' }), /options\[0\]\.mode must be owned or rare/);
  assert.match(shape({ category: 'armament' }), /exactly one of armamentId or weaponArtId/);
  assert.match(shape({ category: 'cinders', cinders: '90', smithingStones: 1 }), /options\[0\]\.cinders must be a non-negative integer/);
  assert.match(shape({ category: 'cinders', cinders: 90 }), /options\[0\]\.smithingStones/);
  assert.equal(shape({ category: 'cinders', cinders: 90, smithingStones: 1 }), '');
  // Well-shaped but naming ids the content does not hold: the load door refuses.
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  const load = (options) => {
    delete run.pendingReward;
    saves.saveRun(run, createRng(1));
    const raw = JSON.parse(storage.getItem(RUN_KEY));
    raw.pendingReward = pending(options);
    storage.setItem(RUN_KEY, JSON.stringify(raw));
    return saves.loadRun(r) ? '' : saves.runStatus().reason;
  };
  assert.equal(load([{ category: 'cinders', cinders: 90, smithingStones: 1 }, { category: 'armament', armamentId: 'greatsword' }]), '');
  assert.match(load([{ category: 'relic', relicId: 'noSuchRelic' }]), /chest relic 'noSuchRelic' is unknown/);
  assert.match(load([{ category: 'upgrade', mode: 'rare', cardId: 'noSuchCard' }]), /chest upgrade card 'noSuchCard' is unknown/);
  assert.match(load([{ category: 'armament', armamentId: 'noSuchBlade' }]), /chest armament 'noSuchBlade' is unknown/);
  assert.match(load([{ category: 'armament', weaponArtId: 'noSuchArt' }]), /chest weapon art 'noSuchArt' is unknown/);
});

test('autoTakeChest: a bot door takes one takeable option, seeded', () => {
  const chest = { options: [
    { category: 'armament', armamentId: 'longsword' },
    { category: 'cinders', cinders: 50, smithingStones: 1 },
  ] };
  // No bag slot: the armament piece is not takeable, so pick(0) lands on the purse.
  const run = newRun();
  const cinders = run.cinders;
  const relics = [...run.relics];
  const got = autoTakeChest(r, run, chest, () => 0);
  assert.equal(got.category, 'cinders');
  assert.equal(run.cinders, cinders + 50);
  assert.deepEqual(run.relics, relics, 'nothing else in the chest moves');
  assert.equal(autoTakeChest(r, run, null, () => 0), null);
  // Seeded: one seed, one chest, one taken option.
  const take = (seed) => {
    const rr = newRun(seed);
    const rng = createRng(seed);
    return autoTakeChest(r, rr, rollEliteChest(r, rng, rr), (n) => rng.int('cardRewards', 0, n - 1));
  };
  assert.deepEqual(take(21), take(21));
});

test('the boss card offer reads and moves the same pity', () => {
  const run = newRun();
  // Rolls of 0 land every boss slot on common; the offset climbs as at any door.
  rollCardRewardIds(r, scripted(), { classId: 'reaver', pool: 'boss', run });
  const n = r.balance.rewards.cardChoices;
  assert.equal(run.cardRarityOffset, pity.offsetStart + n * pity.offsetStep);
  assert.equal(run.cardRewardsSinceRare, 1);
  // A boss door that begins owed a rare shows one in its last slot.
  run.cardRewardsSinceRare = pity.rareGuaranteeAfter;
  const ids = rollCardRewardIds(r, scripted(), { classId: 'reaver', pool: 'boss', run });
  assert.equal(rarity(ids[ids.length - 1]), 'rare');
  assert.equal(run.cardRewardsSinceRare, 0);
});

test('the game hands the run to the boss card offer (src/main.js)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const bossCall = src.match(/rollCardRewardIds\(registries, rng, \{[^}]*pool: 'boss'[^}]*\}/);
  assert.ok(bossCall, 'the boss door rolls its card offer');
  assert.match(bossCall[0], /\brun\b(?!\.)/, 'the boss offer is handed the run');
});
