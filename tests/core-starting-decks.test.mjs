// Owner ruling 2026-10-19 (Core): exact opening decks per character.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { gameProfileStarterDeck } from '../src/model/gameProfileRun.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { dispatch } from '../src/engine/combat.js';
import { legacyCoreRegistries } from './helpers/legacy-core-profile.mjs';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const counts = (cards) => cards.reduce((m, c) => (m[c.cardId] = (m[c.cardId] || 0) + 1, m), {});
const start = (classId) => createRunState({ registries: reg, classId, seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });

// The pre-rest Core pins unlimited Basics/Cantrips; the shipped Core mints nothing (a card's copy limit is the copies owned).
const legacyReg = legacyCoreRegistries();
const startLegacy = (classId) => createRunState({ registries: legacyReg, classId, seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });

// Owner ruling 2026-11-21: ten cards each. Martial: 4 Strike-type attacks, 4 Defends, a class specialty and the weapon art.
// Casters: 4 attack cantrips, 4 defensive cantrips, a class spell and the weapon art.
const DECKS = {
  reaver: { 'core.strike': 4, 'core.defend': 4, 'core.reaverSpecial': 1, greatswordSunderingHew: 1 },
  rogue: { 'core.strike': 4, 'core.defend': 4, 'core.rogueSpecial': 1, twinFang: 1 },
  starseer: { 'core.cantrip': 4, 'core.arcaneWard': 1, 'core.glimmerVeil': 1, 'core.stoneSigil': 1, 'core.ashenShell': 1, 'core.starseerSpecial': 1, blightTouch: 1 },
  herald: { 'core.cantrip': 4, 'core.arcaneWard': 1, 'core.glimmerVeil': 1, 'core.stoneSigil': 1, 'core.ashenShell': 1, 'core.heraldSpecial': 1, blightTouch: 1 },
};

for (const [classId, expected] of Object.entries(DECKS)) {
  test(`Core ${classId} starts with its exact 10-card deck (owner ruling 2026-11-21)`, () => {
    const run = start(classId);
    assert.equal(run.deck.length, 10);
    assert.deepEqual(counts(run.deck), expected);
    assert.deepEqual(run.sideboard, []);
    // The ledger is seeded from the authored list; the weapon-granted art (Sundering Hew, Twin Fang, Blight Touch) are not in it.
    for (const id of gameProfileStarterDeck(run, classId)) assert.ok(run.collectedCardIds.includes(id), `${id} is in the collection ledger`);
  });

  test(`Core ${classId} starter is exactly the recipe: 4 basic attacks, 4 defences, 1 own-class card, 1 weapon art, none costing more MP than it starts with (owner ruling 2026-11-21)`, () => {
    const run = start(classId);
    const defs = run.deck.map(c => reg.cards.get(c.cardId));
    const caster = classId === 'starseer' || classId === 'herald';
    const art = defs.filter(d => d.rarity === 'rare');
    assert.equal(art.length, 1, 'one rare weapon art');
    const own = defs.filter(d => d.class === classId && d.rarity !== 'rare');
    assert.equal(own.length, 1, 'one own-class card');
    assert.equal(own[0].rarity, 'uncommon', 'the class card is uncommon');
    const basics = defs.filter(d => d.rarity === 'common');
    assert.equal(basics.length, 8, 'eight common basics');
    const isDefence = d => (d.type === 'skill' && (d.effects || []).some(e => e.op === 'block'));
    assert.equal(basics.filter(isDefence).length, 4, 'four defences');
    assert.equal(basics.filter(d => d.type === 'attack').length, 4, 'four attacks');
    for (const d of basics) assert.equal(d.tags.includes('rank.cantrip') || d.tags.includes('maneuver:attack') || d.tags.includes('maneuver:defend'), true, `${d.id} is a basic or a cantrip`);
    if (caster) for (const d of basics) assert.ok(d.tags.includes('camp:spell'), `${d.id} is a cantrip`);
    else for (const d of basics) assert.ok(d.tags.includes('camp:physical'), `${d.id} is a Strike or Defend type`);
    const maxMana = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] }).player.maxMana;
    for (const d of defs) assert.ok((d.manaCost || 0) <= maxMana, `${d.id} costs ${d.manaCost} MP, class starts with ${maxMana}`);
  });

  test(`Core ${classId} can play every starter card at combat start with its weapon and full SP and MP`, () => {
    for (const cardId of Object.keys(expected)) {
      const attempt = withTarget => {
        const run = start(classId);
        const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
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

test('Core editor offers only collected definitions under the matching Adept (legacy unlimited rules, owner ruling 2026-10-23)', async () => {
  const { unlimitedCardIds } = await import('../src/model/deckRules.js');
  // Owner ruling 2026-11-21: Counter, Smash, Sweep and Evade left the starting decks, so only Strike and Defend are collected basics.
  const CASTER_BASICS = ['core.cantrip', 'core.arcaneWard', 'core.glimmerVeil', 'core.stoneSigil', 'core.ashenShell'];
  const expected = { reaver: ['core.strike', 'core.defend'],
    rogue: ['core.strike', 'core.defend'], starseer: CASTER_BASICS, herald: CASTER_BASICS };
  for (const id of Object.keys(expected)) assert.deepEqual(unlimitedCardIds(startLegacy(id)), expected[id]);
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
  const ids = ['core.strike', 'core.defend'];
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
  const rows = [...deckEditorModel({ registries: reg, run }).deck].filter((r) => r.cardId === 'core.heraldSpecial');
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

test('DOM: Core Herald weapon art renders its source label, not Basic (reverting the rankNode call site fails this)', async () => {
  const badges = await renderedBadges(reg, start('herald'));
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
    // The Starseer's and Herald's only rank-badged rows are now their magical weapon art (Blight Touch), which has no Basic badge to disagree.
    assert.ok(zero.length > 0 || badges.every((b) => b.magical), `${name}: has rank-0 rows`);
    for (const b of zero) assert.equal(b.text === 'Basic', b.shown, `${name}: ${b.row.cardId} (${b.row.source}) badge "${b.text}" vs Basic filter ${b.shown}`);
  }
});

// Owner ruling 2026-11-21: starting decks are Unranked basics plus one uncommon specialty and one rare Rank 1 weapon art,
// inside the budget in content/source/scoring.json (starter.budget); starting armour is Unranked.
import { scoring } from '../src/content/generated/scoring.js';
import { cardCombatPower, itemCombatPower } from '../src/content/generated/combatPower.js';

for (const classId of Object.keys(DECKS)) {
  test(`Core ${classId} starting deck passes the starter budget and the rank recipe`, () => {
    const b = scoring.starter.budget;
    const cards = Object.entries(DECKS[classId]).flatMap(([id, n]) => Array(n).fill(id));
    assert.ok(cards.length >= b.cardsMin && cards.length <= b.cardsMax, `${cards.length} cards`);
    const rows = cards.map(id => ({ id, ...cardCombatPower[id] }));
    for (const r of rows) assert.ok(r.raw !== undefined, `${r.id} has a combat power row`);
    const special = rows.filter(r => r.rarity !== 'common' || r.rank > 0);
    assert.ok(special.length <= b.maxSpecial, `${special.length} special cards: ${special.map(r => r.id)}`);
    for (const r of rows) assert.ok(r.rank <= b.maxRankPerCard, `${r.id} rank ${r.rank}`);
    const rawTotal = rows.reduce((sum, r) => sum + Math.max(r.raw, b.rawFloorPerCard), 0);
    assert.ok(rawTotal <= b.rawTotalMax, `raw total ${rawTotal} > ${b.rawTotalMax}`);
    // The recipe: every card but the weapon art is Unranked (cp <= 0); the art is rare at Rank 1.
    const art = rows.filter(r => r.rarity === 'rare');
    assert.equal(art.length, 1, 'exactly one rare weapon art');
    assert.equal(art[0].rank, 1, `${art[0].id} is Rank 1 (cp ${art[0].cp})`);
    for (const r of rows.filter(x => x !== art[0])) assert.ok(r.cp <= 0, `${r.id} cp ${r.cp} is Unranked`);
    assert.equal(rows.filter(r => r.rarity === 'uncommon').length, 1, 'one uncommon specialty');
  });

  test(`Core ${classId} starting armour is Unranked`, () => {
    const row = itemCombatPower[`armour:${classId}.default`];
    assert.ok(row, 'armour row');
    assert.ok(row.cp <= 0, `cp ${row.cp}`);
  });
}
