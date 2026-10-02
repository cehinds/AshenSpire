// SPEC §15.4, §15.5 step 5 — legendary sigils, built to the shapes of the
// SPEC-only PR #1439.
//
// docs/FINISH.md §15 "Legendary sigils" is the acceptance line: a legendary
// that does not derive exactly one sigil property tag from tagging.csv is
// refused by name; an attuned sigil's trigger fires and an unattuned one's
// does not; a second attune past attuneMax is refused; the Armoury Sigils
// panel attunes and unattunes through taps (DOM test); no shop stocks a
// legendary; by default none drop, and at boss chance 100 one unowned
// legendary drops; a save at §14's last schema loads with empty
// attunedSigils. The rest is what the shapes of #1439 also pin: the numbers
// as noted Settings rows, the `sigils` stream appended last and silent at the
// defaults, the snapshot and co-op carriage, and the load door's refusals.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { sigils as shippedSigils } from '../src/content/sigils.js';
import { shops as shippedShops } from '../src/content/shops.js';
import { createRegistries, carrierRules } from '../src/model/registries.js';
import { advancedConfigRows, configuredContentBundle } from '../src/model/advancedConfig.js';
import { createRng, STREAM_NAMES } from '../src/engine/rng.js';
import { buildMarketStock, buildBlacksmithStock } from '../src/engine/shopKinds.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createCoopCombat } from '../src/engine/coopCombat.js';
import { syncLoadoutProperties } from '../src/engine/properties.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { combatSnapshotProblems, combatSnapshotReferenceProblems } from '../src/model/combatSnapshot.js';
import { createRunState, RUN_SCHEMA_VERSION, validateRunShape } from '../src/model/state.js';
import { validateContent } from '../src/model/validate.js';
import { createSaveManager, createMemoryStorage, RUN_KEY } from '../src/engine/save.js';
import { REWARD_KIND_ORDER, rewardPlan } from '../src/model/rewardplan.js';
import {
  attuneSigil, unattuneSigil, legendarySigilIds, sigilDropPool, rollSigilDrop, attuneMaxOf, sigilRarityProblems,
} from '../src/model/sigils.js';
import { sigilPurchasePlan } from '../src/model/marketAdditions.js';
import { pendingRewardCheckpoint, settleTreasureNode } from '../src/model/rewardSourcePolicy.js';
import { generateJourney, journeyGraph, completeJourneyNode } from '../src/model/worldAtlas.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { mountEquipment } from '../src/ui/screens/equipment.js';

const REG = createRegistries(contentBundle);
const registriesWith = (settings) => createRegistries(configuredContentBundle(contentBundle, settings));
const LEGENDARIES = shippedSigils.filter((row) => row.rarity === 'legendary').map((row) => row.id);
const COMMON = shippedSigils.find((row) => row.rarity !== 'legendary').id;
const POOLS = ['normal', 'elite', 'boss', 'treasure'];
const DROP_KEY = (pool) => `gameConfig.balance.sigils.dropChancePct.${pool}`;
const ATTUNE_KEY = 'gameConfig.balance.sigils.attuneMax';
// validateContent's refusals as `<path> <message>` lines.
const problemsOf = (bundle) => validateContent(bundle).errors.map((e) => `${e.path} ${e.msg}`);

function freshRun(registries = REG, seed = 7) {
  const run = createRunState({ seed, classId: 'reaver', registries });
  run.seenEvents = [];
  return run;
}

function fightFor(run, registries = REG, seed = 5) {
  const enemyId = registries.enemies.all().find((def) => def.hp && def.hp[1] < 200).id;
  return createRunCombat({ registries, rng: createRng(seed), run, enemyIds: [enemyId] });
}

function reload(run, registries = REG) {
  const storage = createMemoryStorage();
  createSaveManager(storage).saveRun(run, createRng(run.seed));
  const manager = createSaveManager(storage);
  return { run: manager.loadRun(registries), status: manager.runStatus() };
}

// The Last Vigil sigil: at combat start, at or below its HP percent, gain Block.
const VIGIL = 'vigilSigil';
function openingBlock(combat) {
  const start = combat.eventLog.findIndex((e) => e.type === 'combatStart');
  const turn = combat.eventLog.findIndex((e) => e.type === 'playerTurnStart');
  return combat.eventLog.slice(start, turn).filter((e) => e.type === 'blockGained' && e.targetId === 'player').map((e) => e.amount);
}
function lowHp(run) {
  run.hp = Math.max(1, Math.floor((run.maxHp * REG.balance.sigils.vigilSigil.pct) / 100) - 1);
  return run;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

test('content: at least three legendaries ship, with no cost, each deriving exactly one sigil property tag with a rule', () => {
  assert.ok(LEGENDARIES.length >= 3, `three or more legendaries ship (got ${LEGENDARIES.join(', ')})`);
  assert.ok(LEGENDARIES.includes(VIGIL));
  assert.deepEqual(legendarySigilIds(REG), LEGENDARIES, 'authored order');
  for (const id of LEGENDARIES) {
    const def = REG.sigils.get(id);
    assert.equal(def.cost, undefined, `${id} has no cost`);
    assert.equal(def.propertyTags.length, 1, `${id} derives exactly one property tag`);
    const node = contentBundle.nodes.find((row) => row.id === def.propertyTags[0]);
    assert.equal(node.parentId, 'sigil', `${id}'s tag is a leaf under the sigil branch`);
    assert.ok(contentBundle.nodeEffects[def.propertyTags[0]], `${id}'s tag has a rule`);
  }
  assert.deepEqual(problemsOf(contentBundle), [], 'the shipped content validates');
});

test('content: each legendary is an on/if combination no relic uses, from the existing EVENTS', () => {
  const combo = (t) => `${t.on}|${t.if ? JSON.stringify(t.if).replace(/"(pct|n|atLeast)":[^,}]+/g, '"$1":V') : '-'}`;
  const relicCombos = new Set();
  for (const relic of REG.relics.all()) {
    for (const t of relic.triggers || []) relicCombos.add(combo(t));
    for (const rule of carrierRules(REG, relic.propertyTags || [])) for (const t of rule.triggers || []) relicCombos.add(combo(t));
  }
  for (const id of LEGENDARIES) {
    const rules = carrierRules(REG, REG.sigils.get(id).propertyTags);
    assert.ok(rules.length && rules.every((rule) => (rule.triggers || []).length), `${id} carries triggers`);
    for (const rule of rules) for (const t of rule.triggers) assert.ok(!relicCombos.has(combo(t)), `${id}'s ${combo(t)} is not a relic's`);
  }
});

test('FINISH: a legendary that does not derive exactly one sigil property tag from tagging.csv is refused by name', () => {
  const tagRow = (id, tagId) => ({ family: 'sigil', subfamily: '', objectId: id, tagId });
  const withTagging = (tagging) => ({ ...contentBundle, tagging });
  // Two property tags: a second sigil leaf added to the Last Vigil.
  const two = withTagging([...contentBundle.tagging, tagRow(VIGIL, 'emberSigil')]);
  assert.ok(problemsOf(two).some((p) => p.includes(`sigils.${VIGIL}`) && /exactly one/.test(p)), problemsOf(two).join(' | '));
  // None: its property row removed.
  const none = withTagging(contentBundle.tagging.filter((row) => !(row.family === 'sigil' && row.objectId === VIGIL && row.tagId === VIGIL)));
  assert.ok(problemsOf(none).some((p) => p.includes(`sigils.${VIGIL}`) && /derives no property tag/.test(p)));
  // A property tag that is not a leaf under the sigil branch (a relic's).
  const elsewhere = withTagging([...contentBundle.tagging.filter((row) => !(row.family === 'sigil' && row.objectId === VIGIL && row.tagId === VIGIL)), tagRow(VIGIL, 'azureSigil')]);
  assert.ok(problemsOf(elsewhere).some((p) => p.includes(`sigils.${VIGIL}`) && /not a leaf under the sigil branch/.test(p)));
  // A legendary authored with a cost.
  const priced = { ...contentBundle, sigils: shippedSigils.map((row) => (row.id === VIGIL ? { ...row, cost: 100 } : row)) };
  assert.ok(problemsOf(priced).some((p) => p.includes(`sigils.${VIGIL}.cost`)));
  // A non-legendary with no cost is still refused.
  const free = { ...contentBundle, sigils: shippedSigils.map((row) => (row.id === COMMON ? { ...row, cost: undefined } : row)) };
  assert.ok(problemsOf(free).some((p) => p.includes(`sigils.${COMMON}.cost`)));
});

// ---------------------------------------------------------------------------
// The numbers: noted Settings rows
// ---------------------------------------------------------------------------

test('the numbers: attuneMax and every drop chance are noted Settings rows; the chances run 0 to 100 and ship at 0', () => {
  const rows = new Map(advancedConfigRows(contentBundle).map((row) => [row.key, row]));
  const attune = rows.get(ATTUNE_KEY);
  assert.ok(attune, 'attuneMax has a generated row');
  assert.equal(attune.def, 1);
  assert.equal(attune.min, 0);
  assert.equal(attuneMaxOf(REG), 1);
  for (const pool of POOLS) {
    const row = rows.get(DROP_KEY(pool));
    assert.ok(row, `${pool} has a generated row`);
    assert.equal(row.def, 0, `${pool} ships off`);
    assert.equal(row.min, 0);
    assert.equal(row.max, 100);
    assert.ok(!/^Authored balance value/.test(row.note), `${pool}'s row carries its own [NOTE]`);
  }
  assert.ok(!/^Authored balance value/.test(attune.note));
  // validateContent refuses a value outside the floors by name.
  const bad = structuredClone(contentBundle.balance);
  bad.sigils.attuneMax = -1;
  bad.sigils.dropChancePct.boss = 101;
  const problems = problemsOf({ ...contentBundle, balance: bad });
  assert.ok(problems.some((p) => /balance\.sigils\.attuneMax/.test(p)), problems.join(' | '));
  assert.ok(problems.some((p) => /balance\.sigils\.dropChancePct\.boss/.test(p)));
});

// ---------------------------------------------------------------------------
// Attunement
// ---------------------------------------------------------------------------

test('FINISH: attuning past attuneMax is refused by name; every other refusal names its sigil and changes nothing', () => {
  const run = freshRun();
  const [a, b] = LEGENDARIES;
  run.sigils = [a, b, COMMON];
  assert.deepEqual(attuneSigil(REG, run, a), { ok: true, reason: '' });
  assert.deepEqual(run.attunedSigils, [a]);
  assert.deepEqual(run.sigils, [a, b, COMMON], 'an attuned sigil stays in run.sigils');
  const past = attuneSigil(REG, run, b);
  assert.equal(past.ok, false);
  assert.match(past.reason, new RegExp(REG.sigils.get(b).name));
  assert.match(past.reason, /1/);
  assert.deepEqual(run.attunedSigils, [a], 'the refusal changed nothing');
  for (const [id, pattern] of [[a, /already/i], [COMMON, /legendary/i], ['noSuchSigil', /noSuchSigil/]]) {
    const plan = attuneSigil(REG, run, id);
    assert.equal(plan.ok, false, id);
    assert.match(plan.reason, pattern);
  }
  const unowned = freshRun();
  assert.match(attuneSigil(REG, unowned, a).reason, new RegExp(`not.*${REG.sigils.get(a).name}|${REG.sigils.get(a).name}`));
  assert.equal(attuneSigil(REG, unowned, a).ok, false, 'an unowned legendary is refused');
  // Unattune.
  assert.equal(unattuneSigil(run, b).ok, false, 'not attuned');
  assert.deepEqual(unattuneSigil(run, a), { ok: true, reason: '' });
  assert.deepEqual(run.attunedSigils, []);
  // A raised attuneMax holds two.
  const two = registriesWith({ [ATTUNE_KEY]: 2 });
  const wide = freshRun(two);
  wide.sigils = [a, b];
  assert.equal(attuneSigil(two, wide, a).ok, true);
  assert.equal(attuneSigil(two, wide, b).ok, true);
  assert.deepEqual(wide.attunedSigils, [a, b]);
  // attuneMax 0: nothing can be attuned.
  const none = registriesWith({ [ATTUNE_KEY]: 0 });
  const shut = freshRun(none);
  shut.sigils = [a];
  assert.equal(attuneSigil(none, shut, a).ok, false);
});

test('FINISH: an attuned sigil\'s trigger fires in a fight, and an unattuned owned one does not', () => {
  const block = REG.balance.sigils.vigilSigil.block;
  const owned = lowHp(freshRun());
  owned.sigils = [VIGIL];
  const idle = fightFor(owned);
  assert.equal(idle.propertyMounts.player?.[`sigil:${VIGIL}`], undefined, 'an owned, unattuned legendary mounts nothing');
  assert.deepEqual(openingBlock(idle), [], 'and its rule does not fire');
  const attuned = lowHp(freshRun());
  attuned.sigils = [VIGIL];
  assert.equal(attuneSigil(REG, attuned, VIGIL).ok, true);
  const fight = fightFor(attuned);
  const mount = fight.propertyMounts.player[`sigil:${VIGIL}`];
  assert.ok(mount, 'mounted under sigil:<id>');
  assert.equal(mount.heldBy, undefined, 'held by the run, not by a piece');
  assert.deepEqual(openingBlock(fight), [block], 'the rule fired at combat start, at its balance number');
  assert.deepEqual(fight.attunedSigils, [VIGIL]);
  // No equipped armament is needed, and an equipment change never unmounts it.
  fight.loadout.sets.rightHand[0] = null;
  syncLoadoutProperties(fight);
  assert.ok(fight.propertyMounts.player[`sigil:${VIGIL}`], 'the loadout diff leaves an attuned sigil alone');
  // Its condition is its own: at full HP the attuned sigil's rule does not fire.
  const full = freshRun();
  full.sigils = [VIGIL];
  attuneSigil(REG, full, VIGIL);
  assert.deepEqual(openingBlock(fightFor(full)), []);
});

test('the snapshot carries attunedSigils: a restore mounts them, an older snapshot mounts none, a malformed or non-legendary list is refused by name', () => {
  const run = lowHp(freshRun());
  run.sigils = [VIGIL, COMMON];
  attuneSigil(REG, run, VIGIL);
  const fight = fightFor(run);
  const snap = serializeCombatSnapshot(fight);
  assert.deepEqual(snap.attunedSigils, [VIGIL]);
  assert.deepEqual(combatSnapshotProblems(snap), []);
  assert.deepEqual(combatSnapshotReferenceProblems(snap, REG), []);
  const restored = restoreCombatSnapshot({ registries: REG, rng: createRng(5), snapshot: snap });
  assert.ok(restored.propertyMounts.player[`sigil:${VIGIL}`]);
  const old = { ...snap };
  delete old.attunedSigils;
  const back = restoreCombatSnapshot({ registries: REG, rng: createRng(5), snapshot: old });
  assert.equal(back.propertyMounts.player?.[`sigil:${VIGIL}`], undefined, 'an older snapshot mounts none');
  assert.deepEqual(back.attunedSigils, []);
  assert.ok(combatSnapshotProblems({ ...snap, attunedSigils: 'x' }).some((p) => /attunedSigils/.test(p)));
  assert.ok(combatSnapshotProblems({ ...snap, attunedSigils: [VIGIL, VIGIL] }).some((p) => /attunedSigils/.test(p)));
  assert.ok(combatSnapshotReferenceProblems({ ...snap, attunedSigils: ['noSuchSigil'] }, REG).some((p) => /noSuchSigil/.test(p)));
  assert.ok(combatSnapshotReferenceProblems({ ...snap, attunedSigils: [COMMON] }, REG).some((p) => p.includes(COMMON) && /legendary/.test(p)));
});

test('co-op: each seat mounts its own attuned sigils under its own key', () => {
  const run = lowHp(freshRun());
  run.sigils = [VIGIL];
  attuneSigil(REG, run, VIGIL);
  const other = lowHp(freshRun(REG, 8));
  const seat = (r, id) => ({ ...r, id, classId: r.class, relicIds: r.relics, attunedSigils: r.attunedSigils });
  const enemyId = REG.enemies.all().find((def) => def.hp && def.hp[1] < 200).id;
  const C = createCoopCombat({ registries: REG, rng: createRng(9), enemyIds: [enemyId], players: [seat(run, 'p1'), seat(other, 'p2')] });
  const keys = Object.entries(C.propertyMounts || {}).filter(([, mounts]) => mounts[`sigil:${VIGIL}`]).map(([key]) => key);
  assert.equal(keys.length, 1, `exactly one seat holds the sigil (got ${keys.join(', ')})`);
  assert.deepEqual(C.players.get('p1').attunedSigils, [VIGIL]);
  assert.deepEqual(C.players.get('p2').attunedSigils, []);
});

// ---------------------------------------------------------------------------
// The Armoury's Sigils panel (DOM)
// ---------------------------------------------------------------------------

// The kit DOM fixture lacks four things the Armoury reads; each is supplied
// here, minimally, for this file only (as tests/market-additions-5b-review.test.mjs does).
function armouryDom(dom) {
  if (!dom.document.documentElement) dom.document.documentElement = dom.document.createElement('html');
  globalThis.NodeFilter = globalThis.NodeFilter || { SHOW_TEXT: 4 };
  dom.document.createTreeWalker = () => ({ nextNode: () => false, currentNode: null });
  const proto = Object.getPrototypeOf(dom.document.body);
  proto.replaceWith = proto.replaceWith || function replaceWith(node) {
    const parent = this.parentNode;
    if (!parent) return;
    const at = parent.children.indexOf(this);
    node.remove?.();
    node.parentNode = parent;
    parent.children.splice(at, 1, node);
    this.parentNode = null;
  };
  if (!Object.getOwnPropertyDescriptor(proto, 'parentElement')) {
    Object.defineProperty(proto, 'parentElement', { configurable: true, get() { return this.parentNode || null; } });
  }
}

test('FINISH (DOM): the Armoury Sigils panel attunes and unattunes through taps, shows a refusal in place, and draws no buttons in combat', () => {
  withKitDom((dom) => {
    armouryDom(dom);
    const [a, b] = LEGENDARIES;
    const run = freshRun();
    run.sigils = [a, b];
    const app = dom.document.createElement('main');
    dom.document.body.replaceChildren(app);
    let changed = 0;
    mountEquipment(app, { registries: REG, run, meta: { settings: { equipView: 'hybrid' } }, inCombat: false, onClose() {}, onChange() { changed += 1; } });
    const panel = () => dom.document.body.querySelectorAll('.armoury-sigils')[0];
    const rowFor = (id) => panel().querySelectorAll('[data-sigil]').find((node) => node.dataset.sigil === id);
    const buttonFor = (id) => rowFor(id).querySelectorAll('button')[0];
    assert.ok(panel(), 'the panel shows while the run owns a legendary');
    assert.ok(rowFor(a) && rowFor(b), 'one row per owned legendary');
    assert.match(buttonFor(a).textContent, /^Attune/);
    buttonFor(a).click();
    assert.deepEqual(run.attunedSigils, [a], 'the tap attuned it');
    assert.ok(changed >= 1, 'the change persisted');
    assert.equal(rowFor(a).dataset.attuned, 'true', 'listed as attuned');
    assert.match(buttonFor(a).textContent, /^Unattune/);
    // A second attune past attuneMax is refused in place, and nothing changes.
    buttonFor(b).click();
    assert.deepEqual(run.attunedSigils, [a]);
    const refusal = panel().querySelectorAll('.armoury-sigils-refusal')[0];
    assert.ok(refusal && refusal.textContent.includes(REG.sigils.get(b).name), 'the refusal sentence is shown as text');
    buttonFor(a).click();
    assert.deepEqual(run.attunedSigils, [], 'the tap unattuned it');
    assert.equal(rowFor(a).dataset.attuned, 'false');
    // In combat the rows show and no button is drawn.
    run.attunedSigils = [a];
    dom.document.body.replaceChildren(app);
    app.replaceChildren();
    mountEquipment(app, { registries: REG, run, meta: { settings: { equipView: 'hybrid' } }, inCombat: true, onClose() {}, onChange() {} });
    assert.ok(panel(), 'the panel shows in combat');
    assert.equal(panel().querySelectorAll('button').length, 0, 'with no buttons');
    // A run with no legendary shows no panel.
    const plain = freshRun();
    app.replaceChildren();
    mountEquipment(app, { registries: REG, run: plain, meta: { settings: { equipView: 'hybrid' } }, inCombat: false, onClose() {}, onChange() {} });
    assert.equal(panel(), undefined);
  });
});

test('the panel\'s buttons are at least 48 CSS px on a coarse pointer and 44 otherwise', () => {
  const css = readFileSync(new URL('../styles/ui.css', import.meta.url), 'utf8');
  assert.match(css, /\.armoury-sigils\s*\{[^}]*--armoury-sigils-target:\s*max\(var\(--tap-floor\),\s*calc\(44px/);
  assert.match(css, /@media \(pointer: coarse\)\s*\{\s*\.armoury-sigils\s*\{\s*--armoury-sigils-target:\s*max\(var\(--tap-floor\),\s*calc\(48px/);
  assert.match(css, /\.armoury-sigils button\s*\{[^}]*min-height:\s*var\(--armoury-sigils-target\)/);
  assert.match(css, /\.armoury-sigils button\s*\{[^}]*min-width:\s*var\(--armoury-sigils-target\)/);
});

// ---------------------------------------------------------------------------
// Never shop stock
// ---------------------------------------------------------------------------

test('FINISH: market and blacksmith stock over 200 seeds never offers a legendary sigil', () => {
  const out = registriesWith({
    'gameConfig.shops.market.sigils.chance': 100,
    ...Object.fromEntries(shippedShops.blacksmith.offerings.map((row) => [`gameConfig.shops.blacksmith.${row.id}.chance`, 100])),
  });
  let sigilShelves = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const run = freshRun(out, seed);
    const market = buildMarketStock(out, createRng(seed), run, { meta: {} });
    for (const offer of market.sigils || []) assert.ok(!LEGENDARIES.includes(offer.id), `seed ${seed}: market offered ${offer.id}`);
    if ((market.sigils || []).length) sigilShelves += 1;
    const smith = buildBlacksmithStock(out, createRng(seed), run);
    for (const value of Object.values(smith)) {
      if (Array.isArray(value)) for (const offer of value) assert.ok(!(offer && LEGENDARIES.includes(offer.id)), `seed ${seed}: blacksmith offered ${offer.id}`);
    }
  }
  assert.ok(sigilShelves > 0, 'the market laid out sigil shelves to check');
  // Even with every non-legendary owned, the shelf draws no legendary.
  const run = freshRun(out, 3);
  run.sigils = shippedSigils.filter((row) => row.rarity !== 'legendary').map((row) => row.id);
  const market = buildMarketStock(out, createRng(3), run, { meta: {} });
  assert.deepEqual((market.sigils || []).filter((offer) => LEGENDARIES.includes(offer.id)), []);
});

// ---------------------------------------------------------------------------
// The drop
// ---------------------------------------------------------------------------

test('the `sigils` stream is appended last, so no stream above it moves', () => {
  assert.equal(STREAM_NAMES.at(-1), 'sigils');
  assert.equal(STREAM_NAMES.indexOf('shopOffers'), STREAM_NAMES.length - 2);
});

test('FINISH: with defaults no sigil ever drops and no stream counter moves', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const rng = createRng(seed);
    const before = rng.getCounters();
    const run = freshRun(REG, seed);
    for (const pool of POOLS) assert.equal(rollSigilDrop(REG, rng, run, pool), null);
    assert.deepEqual(rng.getCounters(), before, `seed ${seed}: nothing drew`);
  }
});

test('FINISH: with dropChancePct.boss 100 a boss drops one unowned legendary and never a duplicate; an empty pool draws nothing', () => {
  const boss = registriesWith({ [DROP_KEY('boss')]: 100 });
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const run = freshRun(boss, seed);
    run.sigils = [LEGENDARIES[0], COMMON];
    run.attunedSigils = [LEGENDARIES[0]];
    run.sigilSlots = { 'armament/straightSword': [COMMON] };
    const rng = createRng(seed);
    const id = rollSigilDrop(boss, rng, run, 'boss');
    assert.ok(LEGENDARIES.includes(id), `seed ${seed}: a legendary dropped (${id})`);
    assert.notEqual(id, LEGENDARIES[0], 'never one the run owns');
    seen.add(id);
    const counters = rng.getCounters();
    assert.equal(counters.sigils, 1, 'chance 100 rolls no chance, one pick');
    for (const name of STREAM_NAMES.filter((n) => n !== 'sigils')) assert.equal(counters[name], 0, `${name} did not move`);
    assert.equal(rollSigilDrop(boss, createRng(seed), run, 'elite'), null, 'the elite chance is still 0');
  }
  assert.ok(seen.size >= 2, 'the pick varies across seeds');
  // Owning every legendary leaves nothing to drop, and nothing is drawn.
  const full = freshRun(boss);
  full.sigils = [...LEGENDARIES];
  assert.deepEqual(sigilDropPool(boss, full), []);
  const rng = createRng(4);
  assert.equal(rollSigilDrop(boss, rng, full, 'boss'), null);
  assert.equal(rng.getCounters().sigils, 0);
  // A chance between 0 and 100 makes one chance draw on `sigils`.
  const half = registriesWith({ [DROP_KEY('normal')]: 50 });
  let drops = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const r = createRng(seed);
    const id = rollSigilDrop(half, r, freshRun(half, seed), 'normal');
    if (id) drops += 1;
    assert.equal(r.getCounters().sigils, id ? 2 : 1);
  }
  assert.ok(drops > 20 && drops < 80, `about half drop (got ${drops})`);
});

test('the reward menu: a sigil row follows the relic row, and taking it adds the sigil unattuned', () => {
  assert.equal(REWARD_KIND_ORDER.at(-1), 'sigil');
  assert.equal(REWARD_KIND_ORDER.indexOf('relic'), REWARD_KIND_ORDER.length - 2);
  const plan = rewardPlan({ relicId: REG.relics.all()[0].id, sigilId: VIGIL }, { flaskSlotsFree: 1, armamentSlotsFree: 1 });
  assert.deepEqual(plan.rows.map((row) => row.kind), ['relic', 'sigil']);
  assert.equal(plan.rows[1].key, 'sigil');
  assert.equal(plan.rows[1].sigilId, VIGIL);
  assert.deepEqual(rewardPlan({}, {}).rows, []);
});

test('main.js rolls the drop at a won fight, a non-terminal boss and both treasure doors, and never before the last boss ends the run', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /function sigilOffer\(pool\) \{\s*const sigilId = rollSigilDrop\(registries, rng, run, pool\);\s*return sigilId \? \{ sigilId \} : \{\};/, 'an offer carries sigilId only when one dropped');
  assert.equal((main.match(/\.\.\.sigilOffer\('treasure'\)/g) || []).length, 2, 'both treasure doors roll');
  assert.match(main, /\.\.\.sigilOffer\(enc\.pool\)/);
  const finish = main.indexOf('const earned = finishRun(true);');
  const bossRoll = main.indexOf("...sigilOffer('boss')");
  assert.ok(finish > 0 && bossRoll > finish, 'the boss roll sits after the terminal victory returns');
  const reward = readFileSync(new URL('../src/ui/screens/reward.js', import.meta.url), 'utf8');
  assert.match(reward, /sigil\(row\)/, 'the reward screen collects a sigil row');
});

test('the map treasure checkpoints its offer, completing a journey point first: claimed straight through or after a reload, the point stays complete', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const door = main.slice(main.indexOf("case 'treasure': {"), main.indexOf("default:\n      throw new Error(`Unknown node kind"));
  assert.ok(door.includes('settleTreasureNode(run, completeJourneyNode);'), 'the map treasure settles its node');
  assert.ok(door.indexOf('settleTreasureNode') < door.indexOf('beginPendingReward('), 'before it checkpoints');
  assert.ok(!door.includes('mountRewards('), 'and never mounts an unsaved offer');
  const boss = registriesWith({ [DROP_KEY('treasure')]: 100 });
  for (const reloadFirst of [false, true]) {
    const run = freshRun(boss, 13);
    run.journey = generateJourney('VIGILTREASURE');
    run.mapGraph = journeyGraph(run.journey);
    const point = run.journey.currentNodeId;
    const rng = createRng(13);
    const sigilId = rollSigilDrop(boss, rng, run, 'treasure');
    assert.ok(LEGENDARIES.includes(sigilId));
    // The door: settle the node, then checkpoint (main.js case 'treasure').
    settleTreasureNode(run, completeJourneyNode);
    run.pendingReward = pendingRewardCheckpoint({ sigilId, title: 'TREASURE' }, { source: 'treasure', after: 'map' });
    let live = run;
    if (reloadFirst) {
      const back = reload(run, boss);
      assert.ok(back.run, back.status.reason);
      live = back.run;
      assert.equal(live.pendingReward.rewards.sigilId, sigilId, 'the unclaimed sigil row survives the reload');
    }
    // Take the sigil and Continue (mountPendingReward's onDone).
    live.sigils = [...live.sigils, live.pendingReward.rewards.sigilId];
    delete live.pendingReward;
    assert.ok(live.journey.completedNodeIds.includes(point), `${reloadFirst ? 'after a reload' : 'straight through'}: the atlas point is complete`);
    assert.ok(live.sigils.includes(sigilId));
    const after = reload(live, boss);
    assert.ok(after.run.journey.completedNodeIds.includes(point), 'and stays complete across another reload');
  }
});

// ---------------------------------------------------------------------------
// Save: schema 19
// ---------------------------------------------------------------------------

test('schema 19: the bump, the appended corpus entry, and a schema-18 save loads with attunedSigils [] and its sigils untouched', () => {
  // #1479 (the dealt-deck rule) bumped once more; this entry and its migration stay.
  assert.ok(RUN_SCHEMA_VERSION >= 19);
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/run-save-schema-versions.json', import.meta.url), 'utf8'));
  const v19 = JSON.parse(corpus.versions['19'].bytes);
  assert.equal(v19.schemaVersion, 19);
  assert.deepEqual(v19.attunedSigils, []);
  assert.deepEqual(validateRunShape(v19), []);
  const v18 = JSON.parse(corpus.versions['18'].bytes);
  assert.equal(v18.schemaVersion, 18, 'the schema-18 entry is untouched');
  assert.equal('attunedSigils' in v18, false);
  // §14's last schema, carrying a legendary it owns.
  v18.sigils = [LEGENDARIES[0], COMMON];
  const storage = createMemoryStorage();
  storage.setItem(RUN_KEY, JSON.stringify(v18));
  const run = createSaveManager(storage).loadRun(REG);
  assert.ok(run, 'the v18 save loads');
  assert.equal(run.schemaVersion, RUN_SCHEMA_VERSION);
  assert.deepEqual(run.attunedSigils, []);
  assert.deepEqual(run.sigils, [LEGENDARIES[0], COMMON], 'its sigils untouched');
  // A missing field at 19 is refused by name.
  const bare = structuredClone(v19);
  delete bare.attunedSigils;
  assert.ok(validateRunShape(bare).some((p) => /attunedSigils/.test(p)));
});

test('validateRunShape refuses a malformed attunedSigils by name; the save round-trips', () => {
  const run = freshRun();
  run.sigils = [LEGENDARIES[0]];
  attuneSigil(REG, run, LEGENDARIES[0]);
  assert.deepEqual(validateRunShape(run), []);
  const back = reload(run).run;
  assert.deepEqual(back.attunedSigils, [LEGENDARIES[0]]);
  for (const [value, pattern] of [['x', /attunedSigils must be a list/], [[''], /attunedSigils\[0\]/], [[LEGENDARIES[0], LEGENDARIES[0]], /twice/], [[LEGENDARIES[1]], /not in sigils/]]) {
    assert.ok(validateRunShape({ ...run, attunedSigils: value }).some((p) => pattern.test(p)), `${JSON.stringify(value)} → ${validateRunShape({ ...run, attunedSigils: value }).join(' | ')}`);
  }
});

test('the load door refuses a non-legendary attuned id and a list past the run\'s attuneMax, reading the run\'s own frozen row', () => {
  const run = freshRun();
  run.sigils = [COMMON, ...LEGENDARIES];
  run.attunedSigils = [COMMON];
  const common = reload(run);
  assert.equal(common.run, null);
  assert.match(common.status.reason, new RegExp(`${COMMON}.*legendary|legendary.*${COMMON}`));
  run.attunedSigils = [LEGENDARIES[0], LEGENDARIES[1]];
  const over = reload(run);
  assert.equal(over.run, null);
  assert.match(over.status.reason, /attuneMax/);
  // A run whose frozen row allows two loads, even on the authored registries.
  run.advancedConfigSnapshot = { ...(run.advancedConfigSnapshot || { schemaVersion: 1 }), overrides: { ...(run.advancedConfigSnapshot?.overrides || {}), [ATTUNE_KEY]: 2 } };
  const raised = reload(run);
  assert.ok(raised.run, raised.status.reason);
  assert.deepEqual(raised.run.attunedSigils, [LEGENDARIES[0], LEGENDARIES[1]]);
});

test('the load door refuses a fight whose attunedSigils differs from the run\'s, and an unknown sigil reward', () => {
  const run = freshRun();
  run.sigils = [VIGIL];
  attuneSigil(REG, run, VIGIL);
  const fight = fightFor(run);
  run.combatEntered = { nodeId: 'n1', encounterId: 'e1', snapshot: serializeCombatSnapshot(fight) };
  const ok = reload(run);
  assert.ok(ok.run, ok.status.reason);
  run.combatEntered.snapshot = { ...run.combatEntered.snapshot, attunedSigils: [] };
  const mismatch = reload(run);
  assert.equal(mismatch.run, null);
  assert.match(mismatch.status.reason, /attunedSigils/);
  run.combatEntered = null;
  run.pendingReward = { schemaVersion: 1, source: 'boss', after: 'map', rewards: { sigilId: 'noSuchSigil' }, states: {} };
  const strange = reload(run);
  assert.equal(strange.run, null);
  assert.match(strange.status.reason, /noSuchSigil/);
  run.pendingReward = { schemaVersion: 1, source: 'boss', after: 'map', rewards: { sigilId: LEGENDARIES[1] }, states: { sigil: 'taken' } };
  const taken = reload(run);
  assert.ok(taken.run, taken.status.reason);
});

test('rarity at every door: no never-legendary position may hold a legendary, at the load door', () => {
  const L = LEGENDARIES[0];
  const cases = [
    ['sigilSlots', (run) => { run.sigils = [L]; run.sigilSlots = { 'armament/straightSword': [L] }; }],
    ['shopStock.sigils', (run) => { run.shopStock = { ...buildMarketStock(REG, createRng(3), run, { meta: {} }), sigils: [{ id: L, cost: 10 }] }; }],
  ];
  for (const [path, edit] of cases) {
    const run = freshRun();
    edit(run);
    const back = reload(run);
    assert.equal(back.run, null, `${path}: refused`);
    assert.ok(back.status.reason.includes(path) && back.status.reason.includes(L), back.status.reason);
  }
  // A fight in progress's slots, and an atlas point's saved shelf.
  const run = freshRun();
  const fight = fightFor(run);
  const snapshot = serializeCombatSnapshot(fight);
  const withSlot = structuredClone(run);
  withSlot.combatEntered = { nodeId: run.mapNodeId || 'n0', snapshot: { ...snapshot, sigilSlots: { 'armament/straightSword': [L] } } };
  assert.ok(sigilRarityProblems(REG, withSlot).some((p) => p.includes('combatEntered.snapshot.sigilSlots') && p.includes(L)));
  const atlas = structuredClone(run);
  atlas.journey = { serviceStates: { p1: { stock: { kind: 'market', offerings: ['sigils'], sigils: [{ id: L, cost: 10 }] } } } };
  assert.ok(sigilRarityProblems(REG, atlas).some((p) => p.includes('journey.serviceStates.p1.stock.sigils') && p.includes(L)));
  // run.sigils, the inventory, holds either kind.
  const either = freshRun();
  either.sigils = [L, COMMON];
  assert.deepEqual(sigilRarityProblems(REG, either), []);
});

test('rarity at every door: the co-op member restore refuses a member that breaks it, by name, and keeps the record', async () => {
  const { createSession, restoreSession } = await import('../tools/session.mjs');
  const host = createSession({ registries: REG, seedString: 'VIGIL' });
  host.addMember({ id: 'p1', name: 'One', classId: 'reaver' });
  host.addMember({ id: 'p2', name: 'Two', classId: 'reaver' });
  host.start();
  const saved = host.serialize();
  const [one, two] = saved.members;
  one.run.sigils = [LEGENDARIES[0], COMMON];
  one.run.attunedSigils = [COMMON];
  two.run.sigils = [LEGENDARIES[0]];
  two.run.attunedSigils = [LEGENDARIES[0]];
  const back = restoreSession(REG, structuredClone(saved));
  const refused = back.refusedMembers();
  assert.equal(refused.length, 1);
  assert.equal(refused[0].id, one.id);
  assert.match(refused[0].reason, new RegExp(`${COMMON}.*legendary`));
  assert.equal(back.serialize().refusedMembers.length, 1, 'the record is kept');
});

test('defence in depth: sigilPurchasePlan refuses a legendary by name', () => {
  const run = freshRun();
  run.cinders = 9999;
  const offer = { id: LEGENDARIES[0], cost: 10 };
  run.shopStock = { ...buildMarketStock(REG, createRng(3), run, { meta: {} }), offerings: ['sigils'], sigils: [offer] };
  const plan = sigilPurchasePlan(REG, run, offer);
  assert.equal(plan.ok, false);
  assert.match(plan.reason, new RegExp(REG.sigils.get(LEGENDARIES[0]).name));
});
