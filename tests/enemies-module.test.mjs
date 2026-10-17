// Enemies module (docs/plans/enemy-decks.md, owner 2026-10-17): JSON-configured enemy decks,
// tier pools from attributes, tag-driven heal rules, and the build validator.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadGameProfileCatalog } from '../tools/game-config.mjs';
import { characterSettings, resolveGameAuthor, enemyPools, resolveEnemyAttributes, enemyAttributeOutcomes } from '../engine/kernel/gameConfig.js';

const author = JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url)));
const catalog = loadGameProfileCatalog();
const profile = resolveGameAuthor(author, catalog);
const settings = characterSettings(profile.modules);
const { enemyCards } = profile.content;
// Resolved view: attributes filled from priority (no variance), deck from defaultDeck.
const enemies = profile.content.enemies.map(e => ({ ...e, attributes: resolveEnemyAttributes(e, settings), deck: e.defaultDeck }));

// Resolve again with one pack-content edit applied to a cloned catalog.
function resolveWith(edit, authorEdit = a => a) {
  const copy = structuredClone(catalog);
  const pack = copy.packs['ashen.core-content@1.0.0'].content;
  // Enemy rows are characters tagged character.enemy; expose them as pack.enemies for edits.
  const view = { ...pack, enemies: pack.characters.filter(c => c.tags.includes('character.enemy')) };
  edit(view);
  for (const key of Object.keys(view)) if (key !== 'enemies') pack[key] = view[key];
  return () => resolveGameAuthor(authorEdit(structuredClone(author)), copy);
}

test('core profile enables the enemies module with its JSON defaults', () => {
  assert.ok(settings, 'enemies module resolved');
  assert.deepEqual(settings.include, ['minion', 'elite', 'boss']);
  assert.equal(settings.healRules.shapes.find(s => s.id === 'full').cost.sp, 3);
  assert.equal(settings.healRules.shapes.find(s => s.id === 'full').cost.mp, 2);
  assert.equal(settings.healRules.shapes.find(s => s.id === 'full').amount.percentMaxHp, 10);
  assert.equal(settings.healRules.shapes.find(s => s.id === 'cheap').exhaust, true);
});

test('attributes start at 0 and are assigned freely: minion 2, elite 4, boss 6 points', () => {
  const total = e => Object.values(e.attributes).reduce((a, b) => a + b, 0);
  for (const e of enemies) {
    const [lo, hi] = { minion: [2, 2], elite: [4, 4], boss: [6, 6] }[e.tier];
    assert.ok(total(e) >= lo && total(e) <= hi, `${e.id} (${e.tier}) assigns ${total(e)}`);
    assert.deepEqual(settings.tagRules['tier.' + e.tier].attributeBudget, [lo, hi]);
  }
  // Free assignment: stat shapes differ between enemies.
  assert.ok(new Set(enemies.map(e => JSON.stringify(e.attributes))).size >= 8, 'stat shapes vary');
});

test('CON stays small (at most 1) and every enemy can pay its dearest card', () => {
  for (const e of enemies) {
    const pools = enemyPools(e, settings);
    const needs = Math.max(...[...e.deck, ...(e.unlockCards || [])].map(id => enemyCards.find(c => c.id === id)?.staminaCost ?? 0));
    assert.ok(e.attributes.constitution <= 1, `${e.id} CON ${e.attributes.constitution}`);
    const needMp = Math.max(...[...e.deck, ...(e.unlockCards || [])].map(id => enemyCards.find(c => c.id === id)?.manaCost ?? 0));
    assert.ok(needMp <= pools.mp, `${e.id} can pay its dearest MP card`);
    assert.ok(needs <= pools.sp, `${e.id} can pay its dearest card`);
  }
});

test('HP is 10 + CON 10 / STR 5 / DEX 3 / WIS 2 / INT 1 per point + 5 per level, plus the level term; SP/MP/AR/DR/hand follow the existing stat rows', () => {
  assert.deepEqual(settings.statRules.hp, { strength: 5, dexterity: 3, constitution: 10, wisdom: 2, intelligence: 1, perLevel: 5 });
  for (const tier of ['minion', 'elite', 'boss']) assert.equal(settings.tagRules['tier.' + tier].pools.hp, 10);
  for (const e of enemies) {
    const level = Math.max(1, e.levelProfile?.min ?? 1);
    const p = enemyPools(e, settings);
    const a = e.attributes;
    assert.equal(p.hp, 10 + 10 * a.constitution + 5 * a.strength + 3 * a.dexterity + 2 * a.wisdom + 1 * a.intelligence + 5 * (level - 1), e.id);
    assert.equal(p.ar, e.attributes.strength, e.id);
    assert.equal(p.dr, e.attributes.dexterity, e.id);
  }
  // Level feeds in: the same character is stronger at a higher level.
  const wisp = enemies.find(e => e.id === 'graveWisp');
  assert.ok(enemyPools(wisp, settings, 10).hp > enemyPools(wisp, settings, 1).hp);
});

test('enemy decks vary in size within the configured bounds and resolve every reference', () => {
  const sizes = new Set(enemies.map(e => e.deck.length));
  assert.ok(sizes.size > 1, 'deck size varies by enemy');
  const cards = new Set(enemyCards.map(c => c.id));
  for (const e of enemies) for (const id of e.deck) assert.ok(cards.has(id), `${e.id} -> ${id}`);
});

test('heal cards take their cost from healRules; minion heals are the cheap exhaust shape', () => {
  const heals = enemyCards.filter(c => c.tags.includes('fx:heal'));
  assert.ok(heals.length > 0);
  for (const card of heals) {
    const owner = enemies.find(e => e.defaultDeck.includes(card.id) || (e.unlockCards || []).includes(card.id));
    if (owner.tier === 'minion') {
      assert.ok(card.tags.includes('lifecycle.exhaust') && card.keywords.includes('exhaust'), `${card.id} exhausts`);
      assert.deepEqual([card.staminaCost, card.manaCost], [1, 1]);
    } else {
      assert.deepEqual([card.staminaCost, card.manaCost], [3, 2]);
    }
    assert.ok(card.effects.some(e => e.op === 'heal' && e.amount >= 1));
  }
});

test('validator refuses an unknown card reference', () => {
  assert.throws(resolveWith(p => { p.enemies[0].defaultDeck[0] = 'nope.card'; }), /unresolved card reference 'nope\.card'/);
});

test('validator refuses a deck outside the size bounds', () => {
  assert.throws(resolveWith(p => { p.enemies[0].defaultDeck = p.enemies[0].defaultDeck.slice(0, 2); }), /deck size 2 outside/);
});

test('validator refuses attributes outside the tier budget', () => {
  assert.throws(resolveWith(p => { p.enemies[0].attributes = { ...(p.enemies[0].attributes || {}), strength: 20 }; }), /outside minion budget/);
});

test('validator refuses a card the enemy can never afford (minion full heal)', () => {
  assert.throws(resolveWith(p => {
    const wisp = p.enemies.find(e => e.id === 'graveWisp');
    const drain = p.enemyCards.find(c => c.id === 'graveWisp.drain');
    drain.tags = drain.tags.filter(t => t !== 'lifecycle.exhaust');
    drain.staminaCost = 3; drain.manaCost = 2;
    assert.ok(wisp.defaultDeck.includes(drain.id));
  }), /costs 3 SP\/2 MP; enemy has 2 SP/);
});

test('validator refuses a heal card whose cost disagrees with its heal shape', () => {
  assert.throws(resolveWith(p => { p.enemyCards.find(c => c.id === 'graveWisp.drain').staminaCost = 0; }), /cost must match heal shape 'cheap'/);
});

test('game.json can override module settings, and the validator follows the override', () => {
  const override = a => ({ ...a, modules: { ...a.modules, enemies: { healRules: { ...settings.healRules,
    shapes: settings.healRules.shapes.map(s => s.id === 'cheap' ? { ...s, cost: { sp: 2, mp: 0 } } : s) } } } });
  // Existing cheap heal cards (1 SP / 1 MP) no longer match the overridden shape.
  assert.throws(resolveWith(() => {}, override), /cost must match heal shape 'cheap'/);
});

test('enemy SP/MP and other internals stay hidden unless a revealing tag is held', async () => {
  const { enemyVisibleFields } = await import('../engine/kernel/gameConfig.js');
  const bare = enemyVisibleFields(settings, []);
  assert.deepEqual([...bare].sort(), ['defense', 'hp', 'intent', 'poise', 'statuses']);
  for (const hidden of ['sp', 'mp', 'cardCosts', 'deck', 'gear', 'relics']) assert.ok(!bare.has(hidden), hidden);
  const insight = enemyVisibleFields(settings, ['insight']);
  assert.ok(insight.has('sp') && insight.has('mp') && insight.has('cardCosts'));
  assert.ok(enemyVisibleFields(settings, ['bestiary']).has('gear'));
});

test('display values are letters, words or numbers, never glyphs', () => {
  const WORD = /^[A-Za-z0-9][A-Za-z0-9 _.-]*$/;
  for (const card of enemyCards) assert.match(card.icon, WORD, card.id);
  for (const e of enemies) for (const key of ['art', 'tint', 'size']) if (e[key] !== undefined) assert.match(String(e[key]), WORD, `${e.id}.${key}`);
  assert.throws(resolveWith(p => { p.enemyCards[0].icon = '\u2694'; }), /letters, words or numbers/);
});

test('names use _ for spaces and - for hyphens; displayName restores spaces', async () => {
  const { NAME_PATTERN, displayName } = await import('../engine/kernel/gameConfig.js');
  for (const row of [...enemies, ...enemyCards, ...profile.content.enemyRelics, ...profile.content.gear]) {
    assert.match(row.name, NAME_PATTERN, row.id);
    assert.ok(!row.name.includes(' '), row.id);
  }
  assert.equal(displayName('Ember-Starved_Pilgrim'), 'Ember-Starved Pilgrim');
  assert.ok(enemies.some(e => e.name === 'Ember-Starved_Pilgrim'));
  assert.throws(resolveWith(p => { p.enemies[0].name = 'Wandering Soldier'; }), /names use _ for spaces/);
});

test('attribute priority + rank weights fill unset points; variance moves only filled points', () => {
  for (const e of profile.content.enemies) {
    assert.ok(Array.isArray(e.attributePriority) && e.attributePriority.length === 5, e.id);
    const base = resolveEnemyAttributes(e, settings);
    for (const [id, n] of Object.entries(e.attributes || {})) assert.ok(base[id] >= n, `${e.id} keeps set ${id}`);
    assert.ok(base.constitution <= Math.max(settings.attributeFill.caps.constitution, e.attributes?.constitution || 0), `${e.id} CON cap`);
    for (const seed of [1, 2, 3, 99]) {
      const varied = resolveEnemyAttributes(e, settings, seed);
      assert.equal(Object.values(varied).reduce((a, b) => a + b, 0), Object.values(base).reduce((a, b) => a + b, 0), `${e.id} same total`);
      for (const [id, n] of Object.entries(e.attributes || {})) assert.ok(varied[id] >= n, `${e.id} variance keeps set ${id}`);
    }
  }
  const varies = profile.content.enemies.some(e => [1, 2, 3, 4, 5].some(seed => JSON.stringify(resolveEnemyAttributes(e, settings, seed)) !== JSON.stringify(resolveEnemyAttributes(e, settings))));
  assert.ok(varies, 'seeded variance changes some spreads');
});

test('defaultDeck and keyed defaultGear / defaultRelics lists', () => {
  for (const e of profile.content.enemies) {
    assert.ok(Array.isArray(e.defaultDeck) && e.defaultDeck.length > 0);
    for (const list of ['defaultGear', 'defaultRelics']) {
      assert.ok(e[list].every(x => typeof x.key === 'string' && typeof x.id === 'string'), `${e.id}.${list}`);
      assert.equal(new Set(e[list].map(x => x.key)).size, e[list].length, `${e.id}.${list} keys unique`);
    }
  }
  assert.throws(resolveWith(p => { const e = p.enemies.find(x => x.tags.includes('tier.boss')); e.defaultGear = [{ key: 'mainHand', id: 'dagger' }, { key: 'mainHand', id: 'katana' }]; }), /duplicate key/);
});

test('players and enemies share one character shape; tags pick the block; one HP algorithm', () => {
  const chars = profile.content.characters;
  const players = chars.filter(c => c.tags.includes('character.player')), foes = chars.filter(c => c.tags.includes('character.enemy'));
  assert.equal(players.length, 4); assert.equal(foes.length, 33);
  const shared = ['id', 'name', 'tags', 'attributePriority', 'defaultDeck', 'defaultGear', 'defaultRelics', 'presentation'];
  for (const c of chars) for (const key of shared) assert.ok(key in c, `${c.id}.${key}`);
  for (const p of players) assert.ok(p.player && !p.enemy, p.id);
  for (const f of foes) assert.ok(f.enemy && !f.player, f.id);
  // Legacy class HP is kept by the class tag base, computed with the same algorithm as enemies.
  assert.deepEqual(Object.fromEntries(profile.content.classes.map(c => [c.id, c.maxHp])), { reaver: 84, starseer: 72, rogue: 74, herald: 78 });
});

test('default decks are pool keys resolved by class and weapon type, from the shared card pool', () => {
  const reaver = profile.content.characters.find(c => c.id === 'reaver');
  assert.ok(reaver.defaultDeck.some(e => e.pool === 'strike'));
  const pool = new Set(profile.content.cards.map(c => c.id));
  for (const c of profile.content.classes) for (const id of c.defaultDeck) assert.ok(pool.has(id), `${c.id} -> ${id}`);
  for (const e of profile.content.enemies) for (const id of e.defaultDeck) assert.ok(pool.has(id), `${e.id} -> ${id}`);
  // A weapon-type override changes what the strike pool deals the Reaver (greatsword) but not the Rogue (dagger).
  const copy = structuredClone(catalog);
  copy.packs['ashen.core-content@1.0.0'].content.cardPools.strike.byTag.greatsword = 'core.smash';
  const changed = resolveGameAuthor(structuredClone(author), copy).content.classes;
  assert.equal(changed.find(c => c.id === 'reaver').defaultDeck.filter(id => id === 'core.smash').length, 4);
  assert.equal(changed.find(c => c.id === 'rogue').defaultDeck.filter(id => id === 'core.smash').length, 1);
});

test('unlimited copies are earned: training.basic for basic maneuvers, training.graduate for cantrips', async () => {
  const { deckCopyLimit, characterSettings: cs } = await import('../engine/kernel/gameConfig.js');
  const s = cs(profile.modules), base = profile.content.characters.find(c => c.id === 'reaver');
  const limit = (row, id, owned = {}) => deckCopyLimit(id, row, profile.content, s, profile.modules.gear, owned);
  assert.ok(base.tags.includes('training.basic'));
  for (const id of ['core.strike', 'core.defend', 'core.counter', 'core.smash', 'core.sweep', 'core.evade']) assert.equal(limit(base, id), Infinity, id);
  const untrained = { ...base, tags: base.tags.filter(t => t !== 'training.basic') };
  assert.equal(limit(untrained, 'core.strike', { 'core.strike': 3 }), 3, 'no tag: owned copies');
  assert.equal(limit(base, 'core.reaverSpecial', { 'core.reaverSpecial': 1 }), 1, 'class special stays owned');
  const cantrip = profile.content.cards.find(c => c.rarity === 'starter' && (c.tags || []).includes('camp:spell') && c.id !== 'core.starseerSpecial');
  if (cantrip) {
    assert.equal(limit(base, cantrip.id, { [cantrip.id]: 1 }), 1, 'cantrip owned without graduate');
    assert.equal(limit({ ...base, tags: [...base.tags, 'training.graduate'] }, cantrip.id), Infinity, 'graduate: unlimited cantrips');
  }
});

test('card rewards are mostly rank 1+: starter (rank 0) cards only through a small authored chance', () => {
  const rule = profile.content.rewards.eligibility.combatCards;
  assert.equal(rule.minRank, 1);
  assert.ok(rule.lowerRankChance > 0 && rule.lowerRankChance <= 0.25, 'most, not all');
  assert.equal(rule.rankOfRarity.starter, 0);
  const src = readFileSync(new URL('../src/model/gameProfileRewards.js', import.meta.url), 'utf8');
  assert.match(src, /lowerRankChance/);
});
