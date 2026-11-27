// Owner ruling 2026-10-19 (Core): exact opening decks per character.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState, deserializeRun, serializeRun } from '../src/model/state.js';
import { gameProfileCatalog } from '../src/content/generated/gameProfiles.js';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';
import { gameProfileStarterDeck } from '../src/model/gameProfileRun.js';
import { basicCardKind } from '../src/model/basicCardRule.js';
import { legacyCoreRegistries } from './helpers/legacy-core-profile.mjs';
import { reconcileGrantedCards } from '../src/model/loadout.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { playingCardDefinition, playingCardModel } from '../src/model/playingCard.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const counts = (cards) => cards.reduce((m, c) => (m[c.cardId] = (m[c.cardId] || 0) + 1, m), {});
const start = (classId) => createRunState({ registries: reg, classId, seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });

// The pre-rest Core pins unlimited Basics/Cantrips; the shipped Core mints nothing (a card's copy limit is the copies owned).
const legacyReg = legacyCoreRegistries();
const startLegacy = (classId) => createRunState({ registries: legacyReg, classId, seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });

// Current recipes come from authored JSON, independently of the runtime projection.
const readJson = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const starterSource = readJson('games/ashenspire/packs/core/starterDeck.json');
const charactersSource = readJson('games/ashenspire/packs/core/characters.json');
const packagesSource = readJson('content/source/weaponCardPackages.json');
const recipeCounts = rows => rows.reduce((out, row) => (out[row.card] = (out[row.card] || 0) + row.copies, out), {});
const DECKS = Object.fromEntries(Object.entries(starterSource.classDecks).map(([classId, rows]) => {
  const expected = recipeCounts(rows);
  const gear = charactersSource.find(row => row.id === classId).defaultGear;
  const arts = new Set(gear.flatMap(item => packagesSource.find(row => row.weaponId === item.id)?.package.weaponArtDefaults || []));
  for (const id of arts) expected[id] = (expected[id] || 0) + 1;
  return [classId, expected];
}));

for (const [classId, expected] of Object.entries(DECKS)) {
  const total = Object.values(expected).reduce((sum, copies) => sum + copies, 0);
  test(`Core ${classId} starts with its exact ${total}-card deck`, () => {
    const run = start(classId);
    assert.equal(run.deck.length, total);
    assert.deepEqual(counts(run.deck), expected);
    assert.deepEqual(run.sideboard, []);
    // The ledger is seeded from the authored list; the weapon-granted art (Sundering Hew, Twin Fang, Blight Touch) are not in it.
    for (const id of gameProfileStarterDeck(run, classId)) assert.ok(run.collectedCardIds.includes(id), `${id} is in the collection ledger`);
  });

  test(`Core ${classId} preserves the authored starter weapon art rank through a save round trip`, async () => {
    const run = start(classId);
    const lent = run.deck.filter((card) => card.equipmentRole === 'weaponArt');
    assert.equal(lent.length, Object.values(DECKS[classId]).reduce((sum, n) => sum + n, 0) - Object.values(recipeCounts(starterSource.classDecks[classId])).reduce((sum, n) => sum + n, 0));
    for (const art of lent) {
      assert.equal(art.rank, starterSource.weaponArtRank);
      const before = playingCardDefinition(reg, art, { rules: run });
      const restored = deserializeRun(serializeRun(run, { inline: true }));
      reconcileGrantedCards(reg, restored);
      const copy = restored.deck.find(card => card.instanceId === art.instanceId);
      assert.equal(copy.rank, starterSource.weaponArtRank);
      assert.deepEqual(playingCardDefinition(reg, copy, { rules: restored }), before);
      const rendered = (await renderedBadges(reg, restored)).filter(({ row }) => row.cardId === art.cardId);
      assert.ok(rendered.length > 0);
      for (const badge of rendered) assert.equal(badge.rank, starterSource.weaponArtRank);
    }
  });

  test(`Core ${classId} starter definitions and copy counts match the authored recipe`, () => {
    const run = start(classId);
    const ordinary = run.deck.filter(card => !card.grantedBy && !card.equipmentRole);
    assert.deepEqual(counts(ordinary), recipeCounts(starterSource.classDecks[classId]));
    for (const card of run.deck) assert.ok(reg.cards.has(card.cardId), `${card.cardId} resolves`);
    const before = structuredClone(run.deck);
    reconcileGrantedCards(reg, run);
    assert.deepEqual(run.deck, before, 'reconciliation is idempotent');
  });

  test(`Core ${classId} starter display quotes equal engine payments when the play is funded`, () => {
    for (const cardId of Object.keys(expected)) {
      const attempt = withTarget => {
        const run = start(classId);
        const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
        Object.assign(combat.player, { energy: 1000000, stamina: 1000000, maxStamina: 1000000, mana: 1000000, maxMana: 1000000 });
        combat.piles.hand.push({ cardId, instanceId: 'probe', upgraded: false });
        const target = withTarget ? combat.enemies[0].id : undefined;
        const quote = previewCard(combat, 'probe', target);
        const display = playingCardModel(reg, { cardId, instanceId: 'probe' }, { preview: quote });
        assert.equal(display.costs.stamina, quote.staminaCost);
        assert.equal(display.costs.mana, quote.manaCost);
        dispatch(combat, { type: 'playCard', cardInstanceId: 'probe', ...(target ? { targetId: target } : {}) });
        const paid = combat.eventLog.find(event => event.type === 'cardPlayed' && event.cardInstanceId === 'probe');
        assert.ok(paid, `${cardId} was played`);
        assert.deepEqual([paid.energySpent, paid.staminaSpent, paid.manaSpent], [quote.cost, quote.staminaCost, quote.manaCost]);
      };
      try { attempt(true); } catch (error) {
        assert.match(error.message, /friendly target/, `${classId} ${cardId}: ${error.message}`);
        attempt(false);
      }
    }
  });

}

test('editing a recipe changes new runs without changing the source or an existing profile', () => {
  const catalog = structuredClone(gameProfileCatalog);
  const pack = Object.values(catalog.packs).find(row => row.manifest.id === 'ashen.core-content');
  const [first] = starterSource.classDecks.reaver;
  pack.content.starterDeck.classDecks.reaver = [{ card: first.card, copies: first.copies + 2 }];
  const edited = resolveGameAuthor({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} }, catalog);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, edited)), edited);
  const run = createRunState({ seed: 511, classId: 'reaver', registries });
  assert.deepEqual(counts(run.deck.filter(card => !card.grantedBy && !card.equipmentRole)), { [first.card]: first.copies + 2 });
  assert.deepEqual(profile.content.starterDeck.classDecks.reaver, starterSource.classDecks.reaver);
  assert.notEqual(edited.hash, profile.hash);
});

const archivedStarter = () => {
  const bytes = readFileSync(new URL('./fixtures/pre-registry-dev-7dff4b03-save.json.gz', import.meta.url));
  const run = deserializeRun(gunzipSync(bytes).toString('utf8'));
  const profile = resolveGameProfile(run.gameProfile);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  return { run, profile, registries };
};

test('the genuine pre-registry starter art keeps its original save rank through reconciliation', () => {
  const { run, profile, registries } = archivedStarter();
  const art = run.deck.find((card) => card.equipmentRole === 'weaponArt');
  assert.ok(art);
  assert.equal(art.rank, undefined);
  assert.equal(profile.content.starterDeck.weaponArtRank, undefined);
  reconcileGrantedCards(registries, run);
  assert.equal(run.deck.find((card) => card.instanceId === art.instanceId).rank, undefined);
  art.rank = 3;
  const rankedCopy = deserializeRun(serializeRun(run, { inline: true }));
  reconcileGrantedCards(registries, rankedCopy);
  assert.equal(rankedCopy.deck.find((card) => card.instanceId === art.instanceId).rank, 3);
});

test('legacy unlimited rules offer only collected definitions of the matching training kind', async () => {
  const { unlimitedCardIds } = await import('../src/model/deckRules.js');
  for (const classId of Object.keys(starterSource.classDecks)) {
    const run = startLegacy(classId);
    const character = legacyReg.gameProfile.content.characters.find(row => row.id === classId);
    const kind = character.tags.includes('training.basic') ? 'Basic' : character.tags.includes('training.graduate') ? 'Cantrip' : null;
    const expected = legacyReg.gameProfile.content.cards.filter(card => run.collectedCardIds.includes(card.id) && basicCardKind(run, card) === kind
      && (!card.class || card.class === 'colorless' || card.class === classId) && ['starter', 'common'].includes(card.rarity)).map(card => card.id);
    assert.deepEqual(unlimitedCardIds(run), expected);
  }
});

test('Shipped Core mints nothing: no class has an unlimited card id', async () => {
  const { unlimitedCardIds } = await import('../src/model/deckRules.js');
  for (const id of ['reaver', 'rogue', 'starseer', 'herald']) assert.deepEqual(unlimitedCardIds(start(id)), [], id);
});

// Codex P2 (PR #2199): owned-only Core must still classify owned basics as basics (legacy unlimited rules).
test('Legacy Core owned basics are sourced basic and the Basic filter is non-empty, with no unowned basics offered', async () => {
  const { deckEditorModel } = await import('../src/ui/models/DeckEditorModel.js');
  const { unlimitedCardIds, basicCardIds, isBasicCard } = await import('../src/model/deckRules.js');
  const run = startLegacy('reaver');
  run.collectedCardIds = ['core.strike', 'core.defend'];
  for (const cardId of run.collectedCardIds) if (!run.deck.some(card => card.cardId === cardId)) run.deck.push({ cardId, instanceId: `controlled:${cardId}` });
  assert.deepEqual(unlimitedCardIds(run), ['core.strike', 'core.defend'], 'policy: only collected trained basics can be minted');
  for (const id of ['core.strike', 'core.defend']) assert.ok(basicCardIds(run).includes(id), `${id} classified basic`);
  for (const c of run.deck.filter((x) => ['core.strike', 'core.defend'].includes(x.cardId))) assert.ok(isBasicCard(c, run), c.cardId);
  const model = deckEditorModel({ registries: legacyReg, run });
  const owned = (rows) => rows.filter((r) => ['core.strike', 'core.defend'].includes(r.card?.cardId ?? r.cardId));
  const basics = [...model.deck, ...model.collection].filter((r) => r.source === 'basic');
  assert.ok(basics.length > 0, 'Basic filter has rows');
  assert.ok(model.collection.filter(row => row.unlimited).every(row => run.collectedCardIds.includes(row.cardId)), 'no uncollected unlimited basic tile');
  assert.ok(owned(model.deck).every((r) => r.source === 'basic'), 'owned Strike/Defend/Counter in the deck are basic');
});

test('Shipped Core: owned Strike/Defend are ordinary owned tiles, none basic, no mint tile', async () => {
  const { deckEditorModel } = await import('../src/ui/models/DeckEditorModel.js');
  const { unlimitedCardIds, basicCardIds, isBasicCard } = await import('../src/model/deckRules.js');
  const run = start('reaver');
  assert.deepEqual(unlimitedCardIds(run), [], 'no unlimited ids');
  assert.deepEqual(basicCardIds(run), [], 'nothing classified basic');
  const ids = [...new Set(starterSource.classDecks.reaver.map(row => row.card))];
  const own = run.deck.filter((x) => ids.includes(x.cardId));
  assert.ok(own.length > 0);
  for (const c of own) assert.ok(!isBasicCard(c, run), c.cardId);
  const model = deckEditorModel({ registries: reg, run });
  const rows = [...model.deck, ...model.collection];
  assert.ok(!rows.some((r) => r.source === 'basic'), 'Basic filter has no rows');
  assert.ok(!rows.some((r) => r.unlimited), 'no mint tile');
  for (const id of ids) assert.ok(model.deck.some((r) => r.cardId === id), `${id} offered as an owned deck row`);
});

// Codex P2 (PR #2199): starterDeck.classDecks is validated at profile construction, not at class start.
test('classDecks validation fails at profile construction with a message naming the class and row', async () => {
  const { compileGameProfiles } = await import('../tools/game-config.mjs');
  const { resolveGameAuthor } = await import('../engine/kernel/gameConfig.js');
  const { catalog, authors } = compileGameProfiles();
  const pack = catalog.bundles[authors.core.core].manifest.packs.find(row => row.id === 'ashen.core-content');
  const build = (mutate) => { const copy = structuredClone(catalog); const starter = copy.packs[`${pack.id}@${pack.version}`].content.starterDeck; starter.classDecks = { reaver: [{ card: 'core.strike', copies: 2 }, { card: 'core.defend', copies: 1 }], rogue: [{ card: 'core.strike', copies: 1 }, { card: 'core.defend', copies: 1 }, { card: 'core.counter', copies: 1 }] }; mutate(starter); return () => resolveGameAuthor(authors.core, copy); };
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
const reaverBadges = async (registries, run) => {
  const { deckEditorModel, rankZeroLabelId } = await import('../src/ui/models/DeckEditorModel.js');
  const model = deckEditorModel({ registries, run });
  return { deckEditorModel, rankZeroLabelId, rows: [...model.deck, ...model.collection] };
};

test('Core Reaver: the class special is not badged Basic in the editor, and nothing is badged Basic on the shipped Core', async () => {
  const run = start('reaver');
  const { deckEditorModel, rankZeroLabelId, rows } = await reaverBadges(reg, run);
  for (const r of rows.filter((x) => x.cardId === 'core.reaverSpecial')) {
    assert.notEqual(r.source, 'basic', 'core.reaverSpecial row source');
    assert.notEqual(rankZeroLabelId(r.source, false), 'deckEditor.rank.basic', 'core.reaverSpecial badge');
    assert.equal(rankZeroLabelId(r.source, false), 'deckEditor.source.art');
  }
  for (const r of rows) assert.notEqual(rankZeroLabelId(r.source, false), 'deckEditor.rank.basic', `${r.cardId} badge`);
  const filtered = deckEditorModel({ registries: reg, run, view: { filters: { source: ['basic'] } } });
  assert.deepEqual([...filtered.deck, ...filtered.collection], [], 'the Basic filter shows nothing');
  assert.equal(rankZeroLabelId('basic', true), 'deckEditor.rank.cantrip');
});

test('Legacy Core Reaver: the class special is not badged Basic in the editor, the basics are', async () => {
  const run = startLegacy('reaver');
  run.collectedCardIds = [...new Set([...run.collectedCardIds, 'core.strike', 'core.defend'])];
  for (const cardId of ['core.strike', 'core.defend']) if (!run.deck.some(card => card.cardId === cardId)) run.deck.push({ cardId, instanceId: `controlled:${cardId}` });
  const { deckEditorModel, rankZeroLabelId, rows } = await reaverBadges(legacyReg, run);
  for (const r of rows.filter((x) => x.cardId === 'core.reaverSpecial')) {
    assert.notEqual(r.source, 'basic', 'core.reaverSpecial row source');
    assert.equal(rankZeroLabelId(r.source, false), 'deckEditor.source.art');
  }
  for (const id of ['core.strike', 'core.defend']) for (const r of rows.filter((x) => x.cardId === id)) {
    assert.equal(r.source, 'basic', `${id} row source`);
    assert.equal(rankZeroLabelId(r.source, false), 'deckEditor.rank.basic', `${id} badge`);
  }
  const filtered = deckEditorModel({ registries: legacyReg, run, view: { filters: { source: ['basic'] } } });
  const ids = [...filtered.deck, ...filtered.collection].map((r) => r.cardId);
  assert.ok(!ids.includes('core.reaverSpecial') && ids.includes('core.strike'), 'filter agrees with the badge');
});

// Owner rule (2026-10-19): the rank-0 badge agrees with the Basic filter. A card the Basic filter hides is never badged Basic.
test('Core Herald: its class spell (source reward) is hidden by the Basic filter and is not badged Basic', async () => {
  const { deckEditorModel, rankZeroLabelId } = await import('../src/ui/models/DeckEditorModel.js');
  const run = start('herald');
  if (!run.deck.some(card => card.cardId === 'core.heraldSpecial')) run.sideboard.push({ cardId: 'core.heraldSpecial', instanceId: 'controlled:herald-special' });
  const model = deckEditorModel({ registries: reg, run });
  const rows = [...model.deck, ...model.collection].filter((r) => r.cardId === 'core.heraldSpecial');
  assert.ok(rows.length > 0, 'core.heraldSpecial row found');
  for (const r of rows) {
    assert.notEqual(r.source, 'basic');
    assert.equal(rankZeroLabelId(r.source, false), `deckEditor.source.${r.source}`);
    assert.notEqual(rankZeroLabelId(r.source, false), 'deckEditor.rank.basic');
  }
  const filtered = deckEditorModel({ registries: reg, run, view: { filters: { source: ['basic'] } } });
  assert.ok(![...filtered.deck, ...filtered.collection].some((r) => r.cardId === 'core.heraldSpecial'), 'Basic filter hides the class spell');
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
  const { withModalDom } = await import('./helpers/dom.mjs');
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

test('DOM: a Herald under the archived profile still sees the original Cantrip badge on its unranked weapon art', async () => {
  const { registries } = archivedStarter();
  const run = createRunState({ registries, classId: 'herald', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const badges = await renderedBadges(registries, run);
  const art = badges.filter((b) => b.row.cardId === 'blightTouch');
  assert.ok(art.length > 0, 'a rendered weapon-art row with a rank badge');
  for (const b of art) { assert.equal(b.rank, 0); assert.equal(b.text, 'Cantrip'); assert.notEqual(b.text, 'Basic'); assert.equal(b.shown, false); }
});

test('sweep: every Core class deck row and a legacy deck badge Basic iff the Basic filter shows it', async () => {
  const { contentBundle: legacyBundle } = await import('../src/content/index.js');
  const bareReg = createRegistries(legacyBundle);
  const decks = ['reaver', 'rogue', 'starseer', 'herald'].map((id) => [`core ${id}`, reg, start(id)]);
  for (const id of ['reaver', 'rogue', 'starseer']) decks.push([`legacy-unlimited core ${id}`, legacyReg, startLegacy(id)]);
  decks.push(['legacy reaver', bareReg, createRunState({ seed: 0x5eed, classId: 'reaver', registries: bareReg, combatExpansionVersion: 1 })]);
  for (const [name, registries, run] of decks) {
    let badges; try { badges = await renderedBadges(registries, run); } catch (e) { e.message = `${name}: ${e.message}`; throw e; }
    assert.ok(badges.rows > 0, `${name}: rows rendered`);
    // A card the face prints no rank for (a Starseer spell) has no badge to disagree.
    if (badges.length === 0) continue;
    const zero = badges.filter((b) => b.rank === 0 && !b.magical);
    // A deck whose only rank-badged rows are magical weapon art (Blight Touch) has no Basic badge to disagree.
    assert.ok(zero.length > 0 || badges.every((b) => b.magical), `${name}: has rank-0 rows`);
    for (const b of zero) assert.equal(b.text === 'Basic', b.shown, `${name}: ${b.row.cardId} (${b.row.source}) badge "${b.text}" vs Basic filter ${b.shown}`);
  }
});

// Every currently authored starter must have a fresh finite generated scoring row.
import { cardCombatPower, itemCombatPower } from '../src/content/generated/combatPower.js';
// Owner ruling 2026-11-21: starting decks are Unranked basics plus at most one uncommon
// specialty and one rare weapon art at the authored rank, inside the authored budget;
// starting armour is Unranked. Every limit below is read from content/source/scoring.json.
const starterRules = readJson('content/source/scoring.json').starter;
for (const classId of Object.keys(DECKS)) {
  test(`Core ${classId} starter scoring covers the current recipe and grants`, () => {
    for (const id of Object.keys(DECKS[classId])) {
      assert.ok(cardCombatPower[id], `${id} has a combat power row`);
      assert.ok(Number.isFinite(cardCombatPower[id].raw) && Number.isFinite(cardCombatPower[id].cp), `${id} has finite scores`);
    }
  });

  test(`Core ${classId} starting deck passes the authored starter budget and rank recipe`, () => {
    const b = starterRules.budget;
    const cards = Object.entries(DECKS[classId]).flatMap(([id, n]) => Array(n).fill(id));
    assert.ok(cards.length >= b.cardsMin && cards.length <= b.cardsMax, `${cards.length} cards, budget ${b.cardsMin}-${b.cardsMax}`);
    const rows = cards.map(id => ({ id, ...cardCombatPower[id] }));
    for (const r of rows) assert.ok(r.raw !== undefined, `${r.id} has a combat power row`);
    const special = rows.filter(r => r.rarity !== 'common' || r.rank > 0);
    assert.ok(special.length <= b.maxSpecial, `${special.length} special cards (max ${b.maxSpecial}): ${special.map(r => r.id)}`);
    for (const r of rows) assert.ok(r.rank <= b.maxRankPerCard, `${r.id} rank ${r.rank} (max ${b.maxRankPerCard})`);
    const rawTotal = rows.reduce((sum, r) => sum + Math.max(r.raw, b.rawFloorPerCard), 0);
    assert.ok(rawTotal <= b.rawTotalMax, `raw total ${rawTotal} > ${b.rawTotalMax}`);
    const { weaponArt, specialty } = starterRules.deck;
    const art = rows.filter(r => r.rarity === weaponArt.rarity);
    assert.equal(art.length, weaponArt.count, `exactly ${weaponArt.count} ${weaponArt.rarity} weapon art`);
    for (const r of art) {
      assert.equal(r.rank, weaponArt.rank, `${r.id} is Rank ${weaponArt.rank} (cp ${r.cp})`);
      assert.equal(r.rank, starterSource.weaponArtRank, `${r.id} scores at the authored starter art rank`);
    }
    for (const r of rows.filter(x => !art.includes(x))) assert.ok(r.cp <= 0, `${r.id} cp ${r.cp} is Unranked`);
    // The specialty is the authored class special; a recipe may leave it out (Starseer authors ten common copies).
    const specials = rows.filter(r => r.rarity === specialty.rarity);
    assert.ok(specials.length <= specialty.count, `${specials.length} ${specialty.rarity} cards (max ${specialty.count})`);
    const authoredSpecialCopies = starterSource.classDecks[classId].filter(row => row.card === starterSource.classSpecials[classId]).reduce((sum, row) => sum + row.copies, 0);
    assert.deepEqual(specials.map(r => r.id), Array(authoredSpecialCopies).fill(starterSource.classSpecials[classId]), 'the only uncommon is the authored class special');
    for (const r of specials) assert.ok(r.rank <= specialty.maxRank, `${r.id} rank ${r.rank} (max ${specialty.maxRank})`);
  });

  test(`Core ${classId} starting armour is Unranked`, () => {
    const row = itemCombatPower[`armour:${classId}.default`];
    assert.ok(row, 'armour row');
    assert.ok(row.cp <= 0, `cp ${row.cp}`);
    assert.ok(row.rank <= starterRules.armourMaxRank, `rank ${row.rank} (max ${starterRules.armourMaxRank})`);
  });

  test(`Core ${classId} can play every starter card at combat start with its weapon and real SP and MP`, () => {
    const run = start(classId);
    const maxMana = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] }).player.maxMana;
    for (const card of run.deck) {
      const def = reg.cards.get(card.cardId);
      assert.ok((def.manaCost || 0) <= maxMana, `${def.id} costs ${def.manaCost} MP, class starts with ${maxMana}`);
    }
    for (const cardId of Object.keys(DECKS[classId])) {
      const attempt = withTarget => {
        const combat = createRunCombat({ registries: reg, run: start(classId), rng: createRng(511), enemyIds: ['wanderingSoldier'] });
        const p = combat.player;
        assert.equal(p.stamina, p.maxStamina); assert.equal(p.mana, p.maxMana);
        combat.piles.hand.push({ cardId, instanceId: 'probe', upgraded: false });
        dispatch(combat, { type: 'playCard', cardInstanceId: 'probe', ...(withTarget ? { targetId: combat.enemies[0].id } : {}) });
        return combat;
      };
      let combat;
      try { combat = attempt(true); } catch (error) {
        // Self-targeted cards refuse an enemy target; any other refusal fails here too.
        assert.match(error.message, /friendly target/, `${classId} ${cardId}: ${error.message}`);
        combat = attempt(false);
      }
      assert.ok(combat.eventLog.some(e => e.type === 'cardPlayed' && e.cardId === cardId) || !combat.piles.hand.some(c => c.instanceId === 'probe'), `${classId} ${cardId} left the hand`);
    }
  });
}
