// Owner ruling 2026-10-19 (Core): exact opening decks per character.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const counts = (cards) => cards.reduce((m, c) => (m[c.cardId] = (m[c.cardId] || 0) + 1, m), {});
const start = (classId) => createRunState({ registries: reg, classId, seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });

test('Core Reaver starts with exactly 4 Strike, 4 Defend, 1 Counter and its weapon art', () => {
  const run = start('reaver');
  assert.equal(run.deck.length, 10);
  assert.deepEqual(counts(run.deck), { 'core.strike': 4, 'core.defend': 4, 'core.counter': 1, 'core.reaverSpecial': 1 });
  assert.deepEqual(run.sideboard, []);
});

test('Core Rogue starts with exactly 2 Strike, 2 Defend, 2 Counter, 2 Evade, 1 Draw and its weapon art', () => {
  const run = start('rogue');
  assert.equal(run.deck.length, 10);
  assert.deepEqual(counts(run.deck), { 'core.strike': 2, 'core.defend': 2, 'core.counter': 2, 'core.evade': 2, 'base.draw': 1, 'core.rogueSpecial': 1 });
  assert.deepEqual(run.sideboard, []);
});

test('Core Starseer starts with 3 Arcane Spark, 2 Star Spark, 4 Ethereal and 1 Resource Gain', () => {
  const run = start('starseer');
  assert.equal(run.deck.length, 10);
  assert.deepEqual(counts(run.deck), { 'core.cantrip': 3, 'core.starseerSpecial': 2, 'base.ethereal': 4, 'base.gain-resource': 1 });
  assert.deepEqual(run.sideboard, []);
});

test('Core Herald starts with 4 Resource Echo, 4 Ethereal, 1 Smash and 1 Exhaust', () => {
  const run = start('herald');
  assert.equal(run.deck.length, 10);
  assert.deepEqual(counts(run.deck), { 'base.paid-resource-variant': 4, 'base.ethereal': 4, 'core.smash': 1, 'base.exhaust': 1 });
  assert.deepEqual(run.sideboard, []);
});

test('Core editor offers only owned cards (owner ruling 2026-10-19)', async () => {
  const { unlimitedCardIds } = await import('../src/model/deckRules.js');
  for (const id of ['reaver', 'rogue', 'starseer', 'herald']) assert.deepEqual(unlimitedCardIds(start(id)), []);
});

test('a non-Core profile with deck-training keeps its unlimited-copy collection entries', async () => {
  const { unlimitedCardIds } = await import('../src/model/deckRules.js');
  const run = start('reaver');
  assert.equal(run.gameProfile.modules['deck-training'].ownedOnlyCollection, true, 'only the Core bundle sets the flag');
  const other = { ...run, gameProfile: { ...run.gameProfile, modules: { ...run.gameProfile.modules, 'deck-training': { ...run.gameProfile.modules['deck-training'], ownedOnlyCollection: undefined } } } };
  assert.ok(unlimitedCardIds(other).length > 0, 'unlimited basics are offered when the flag is absent');
  assert.ok(unlimitedCardIds(other).includes('core.strike'));
});

// Codex P2 (PR #2199): owned-only Core must still classify owned basics as basics.
test('Core owned basics are sourced basic and the Basic filter is non-empty, with no unowned basics offered', async () => {
  const { deckEditorModel } = await import('../src/ui/models/DeckEditorModel.js');
  const { unlimitedCardIds, basicCardIds, isBasicCard } = await import('../src/model/deckRules.js');
  const run = start('reaver');
  assert.deepEqual(unlimitedCardIds(run), [], 'policy: nothing minted unowned');
  for (const id of ['core.strike', 'core.defend', 'core.counter']) assert.ok(basicCardIds(run).includes(id), `${id} classified basic`);
  for (const c of run.deck.filter((x) => ['core.strike', 'core.defend', 'core.counter'].includes(x.cardId))) assert.ok(isBasicCard(c, run), c.cardId);
  const model = deckEditorModel({ registries: reg, run });
  const owned = (rows) => rows.filter((r) => ['core.strike', 'core.defend', 'core.counter'].includes(r.card?.cardId ?? r.cardId));
  const basics = [...model.deck, ...model.collection].filter((r) => r.source === 'basic');
  assert.ok(basics.length > 0, 'Basic filter has rows');
  assert.ok(model.collection.every((r) => !r.unlimited), 'no unowned unlimited basic tile');
  assert.ok(owned(model.deck).every((r) => r.source === 'basic'), 'owned Strike/Defend/Counter in the deck are basic');
});

// Codex P2 (PR #2199): starterDeck.classDecks is validated at profile construction, not at class start.
test('classDecks validation fails at profile construction with a message naming the class and row', async () => {
  const { compileGameProfiles } = await import('../tools/game-config.mjs');
  const { resolveGameAuthor } = await import('../engine/kernel/gameConfig.js');
  const { catalog, authors } = compileGameProfiles();
  const pack = catalog.bundles[authors.core.core].manifest.packs.find(row => row.id === 'ashen.core-content');
  const build = (mutate) => { const copy = JSON.parse(JSON.stringify(catalog)); mutate(copy.packs[`${pack.id}@${pack.version}`].content.starterDeck); return () => resolveGameAuthor(authors.core, copy); };
  assert.doesNotThrow(build(() => {}), 'the shipped Core bundle validates');
  assert.throws(build(sd => { sd.classDecks.reaver[0].copies = '4'; }), /classDecks\/reaver\/0\/copies.*positive integer copies for class reaver row 0/);
  assert.throws(build(sd => { sd.classDecks.reaver[1].copies = -1; }), /classDecks\/reaver\/1\/copies.*positive integer copies for class reaver row 1/);
  assert.throws(build(sd => { sd.classDecks.reaver[0].copies = 1.5; }), /positive integer copies/);
  assert.throws(build(sd => { sd.classDecks.reaver[0].copies = 2 ** 60; }), /positive integer copies/);
  assert.throws(build(sd => { sd.classDecks.nobody = [{ card: 'core.strike', copies: 1 }]; }), /classDecks\/nobody.*unknown class/);
  assert.throws(build(sd => { sd.classDecks.rogue[2].card = 'core.missing'; }), /classDecks\/rogue\/2\/card.*unknown card reference "core.missing" for class rogue row 2/);
  assert.throws(build(sd => { sd.classDecks = []; }), /classDecks.*expected class-id map/);
  assert.throws(build(sd => { sd.classDecks.rogue = 'x'; }), /classDecks\/rogue.*expected an array/);
});

// Owner ruling 2026-10-19: Sundering Art (core.reaverSpecial) is a class special, not a Basic card. The rank-0 badge
// ("Basic") and the Basic source filter agree: only Strike/Defend/Counter read Basic.
test('Core Reaver: the class special is not badged Basic in the editor, the basics are', async () => {
  const { deckEditorModel, rankZeroLabelId } = await import('../src/ui/models/DeckEditorModel.js');
  const run = start('reaver');
  const model = deckEditorModel({ registries: reg, run });
  const rows = [...model.deck, ...model.collection];
  const badge = (r) => rankZeroLabelId(r.source, false) === 'deckEditor.rank.basic' ? 'basic' : r.source;
  for (const id of ['core.reaverSpecial']) for (const r of rows.filter((x) => x.cardId === id)) {
    assert.notEqual(r.source, 'basic', `${id} row source`);
    assert.notEqual(badge(r), 'basic', `${id} badge`);
    assert.equal(rankZeroLabelId(r.source, false), 'deckEditor.source.art');
  }
  for (const id of ['core.strike', 'core.defend', 'core.counter']) for (const r of rows.filter((x) => x.cardId === id)) {
    assert.equal(r.source, 'basic', `${id} row source`);
    assert.equal(rankZeroLabelId(r.source, false), 'deckEditor.rank.basic', `${id} badge`);
  }
  const filtered = deckEditorModel({ registries: reg, run, view: { filters: { source: ['basic'] } } });
  const ids = [...filtered.deck, ...filtered.collection].map((r) => r.cardId);
  assert.ok(!ids.includes('core.reaverSpecial') && ids.includes('core.strike'), 'filter agrees with the badge');
  assert.equal(rankZeroLabelId('basic', true), 'deckEditor.rank.cantrip');
});

// Owner rule (2026-10-19): the rank-0 badge agrees with the Basic filter. A card the Basic filter hides is never badged Basic.
test('Core Herald: Smash (source reward) is hidden by the Basic filter and is not badged Basic', async () => {
  const { deckEditorModel, rankZeroLabelId } = await import('../src/ui/models/DeckEditorModel.js');
  const run = start('herald');
  const rows = [...deckEditorModel({ registries: reg, run }).deck].filter((r) => r.cardId === 'core.smash');
  assert.ok(rows.length > 0, 'core.smash row found');
  for (const r of rows) {
    assert.notEqual(r.source, 'basic');
    assert.equal(rankZeroLabelId(r.source, false), `deckEditor.source.${r.source}`);
    assert.notEqual(rankZeroLabelId(r.source, false), 'deckEditor.rank.basic');
  }
  const filtered = deckEditorModel({ registries: reg, run, view: { filters: { source: ['basic'] } } });
  assert.ok(![...filtered.deck, ...filtered.collection].some((r) => r.cardId === 'core.smash'), 'Basic filter hides Smash');
});

test('the rank-0 badge label per source: basic reads Basic, every other source its own chip label', async () => {
  const { rankZeroLabelId, DECK_SOURCES } = await import('../src/ui/models/DeckEditorModel.js');
  const { has } = await import('../src/ui/strings.js');
  for (const source of DECK_SOURCES) {
    const id = rankZeroLabelId(source, false);
    assert.equal(id, source === 'basic' ? 'deckEditor.rank.basic' : `deckEditor.source.${source}`);
    assert.ok(has(id), `${id} has a ui string`);
  }
});

// Mount the production screen (the rankNode call site) and read the badges it renders.
async function renderedBadges(registries, run) {
  const { withModalDom } = await import('./helpers/modal-dom.mjs');
  const { mountDeckEditor } = await import('../src/ui/screens/deckEditor.js');
  const { deckEditorModel } = await import('../src/ui/models/DeckEditorModel.js');
  const { deckEditorCollectionRows } = await import('../src/ui/models/deckEditorCollectionRows.js');
  const build = (view) => { const m = deckEditorModel({ registries, run, view }); return { ...m, collection: deckEditorCollectionRows({ registries, run, collection: m.collection }) }; };
  const model = build();
  const idOf = (r) => r.instanceId ?? r.key;
  const filtered = build({ filters: { source: ['basic'] } });
  const basicIds = new Set([...filtered.deck, ...filtered.collection].map(idOf));
  const all = [...model.deck, ...model.collection];
  const out = [];
  out.rows = 0;
  withModalDom(() => {
    const nativeElement = globalThis.HTMLElement;
    globalThis.HTMLElement = document.body.constructor;
    try {
      const editor = mountDeckEditor(document.body, { registries, run, settings: {} });
      for (const main of editor.root.querySelectorAll('.deck-editor-main')) {
        const row = all.find((r) => idOf(r) === (main.dataset.instanceId ?? main.dataset.key));
        const rank = main.querySelector('.deck-editor-rank');
        if (row) out.rows += 1;
        if (row && rank) out.push({ row, rank: Number(rank.dataset.rank), text: rank.textContent, shown: basicIds.has(idOf(row)), magical: main.querySelector('.deck-editor-camp')?.dataset.camp === 'magical' });
      }
      editor.close();
    } finally { if (nativeElement === undefined) delete globalThis.HTMLElement; else globalThis.HTMLElement = nativeElement; }
  });
  return out;
}

test('DOM: Core Herald Smash renders its source label, not Basic (reverting the rankNode call site fails this)', async () => {
  const badges = await renderedBadges(reg, start('herald'));
  const smash = badges.filter((b) => b.row.cardId === 'core.smash');
  assert.ok(smash.length > 0, 'a rendered Smash row with a rank badge');
  for (const b of smash) { assert.equal(b.rank, 0); assert.equal(b.text, 'Reward'); assert.equal(b.shown, false); }
});

test('sweep: every Core class deck row and a legacy deck badge Basic iff the Basic filter shows it', async () => {
  const { contentBundle: legacyBundle } = await import('../src/content/index.js');
  const legacyReg = createRegistries(legacyBundle);
  const decks = ['reaver', 'rogue', 'starseer', 'herald'].map((id) => [`core ${id}`, reg, start(id)]);
  decks.push(['legacy reaver', legacyReg, createRunState({ seed: 0x5eed, classId: 'reaver', registries: legacyReg, combatExpansionVersion: 1 })]);
  for (const [name, registries, run] of decks) {
    const badges = await renderedBadges(registries, run);
    assert.ok(badges.rows > 0, `${name}: rows rendered`);
    // A card the face prints no rank for (a Starseer spell) has no badge to disagree.
    if (badges.length === 0) continue;
    const zero = badges.filter((b) => b.rank === 0 && !b.magical);
    assert.ok(zero.length > 0, `${name}: has rank-0 rows`);
    for (const b of zero) assert.equal(b.text === 'Basic', b.shown, `${name}: ${b.row.cardId} (${b.row.source}) badge "${b.text}" vs Basic filter ${b.shown}`);
  }
});
