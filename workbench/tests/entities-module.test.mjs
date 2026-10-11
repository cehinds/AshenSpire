// node --test workbench/tests/entities-module.test.mjs — the Entity Browser's pure
// helpers: the index rows, the filters, the five sorts, the facets, the chip
// counts, the kind to source-table map, the deep link and the URLs it builds.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KINDS, SORTS, SOURCE_TABLES, entryOf, filterEntries, sortEntries, facetsOf, chipCounts,
  parseDeepLink, deepLinkOf, renderUrl, tryFightUrl, gameBaseOf, sourceTableFor, kindOf,
} from '../modules/entities/model.mjs';

const ROWS = [
  { id: 'straightSword', name: 'Straight Sword', kind: 'armaments', tags: ['blade'], itemTypes: ['Weapon'], rarity: 'common', class: '' },
  { id: 'roundShield', name: 'Round Shield', kind: 'armaments', tags: ['guard'], itemTypes: ['Shield'], rarity: 'uncommon', class: '' },
  { id: 'greatsword', name: 'Greatsword', kind: 'armaments', tags: ['blade', 'heavy'], itemTypes: ['Weapon'], rarity: 'rare', class: 'reaver' },
  { id: 'starter-charm', name: 'Starter Charm', kind: 'armaments', tags: [], itemTypes: ['Weapon'], rarity: 'starter', class: 'herald' },
];

test('the ten kinds are in chip order with stable ids', () => {
  assert.deepEqual(KINDS.map((k) => k.id), ['armaments', 'armor', 'potions', 'relics', 'cards', 'statuses', 'stances', 'keywords', 'enemies', 'classes']);
  assert.equal(kindOf('relics').label, 'Relics');
  assert.equal(kindOf('nope'), null);
});

test('the five sort orders are named and unique', () => {
  assert.deepEqual(SORTS.map((s) => s.id), ['name', 'name-desc', 'id', 'rarity', 'class']);
});

test('entryOf reads a definition into an index row', () => {
  const row = entryOf('armor', { id: 'default', classId: 'reaver', name: 'Wayfarer Plate', tags: ['guard'], itemTypes: [{ tag: 'item:armor', label: 'Armor' }], rarity: '' });
  assert.deepEqual(row, { id: 'default', name: 'Wayfarer Plate', kind: 'armor', tags: ['guard'], itemTypes: ['Armor'], rarity: '', class: 'reaver' });
  assert.equal(entryOf('classes', { id: 'herald', name: 'Herald' }).class, 'herald', 'a class is its own class facet');
  assert.equal(entryOf('cards', { id: 'strike', class: 'colorless' }).name, 'strike', 'a missing name falls back to the id');
  assert.deepEqual(entryOf('potions', {}).tags, [], 'missing tags become an empty list');
});

test('search matches every word across name, id, tags and item types', () => {
  assert.deepEqual(filterEntries(ROWS, { q: 'SWORD' }).map((e) => e.id), ['straightSword', 'greatsword']);
  assert.deepEqual(filterEntries(ROWS, { q: 'blade heavy' }).map((e) => e.id), ['greatsword']);
  assert.deepEqual(filterEntries(ROWS, { q: 'shield' }).map((e) => e.id), ['roundShield'], 'item types are searched');
  assert.deepEqual(filterEntries(ROWS, { q: 'starter-charm' }).map((e) => e.id), ['starter-charm'], 'ids are searched');
  assert.equal(filterEntries(ROWS, { q: '   ' }).length, ROWS.length, 'a blank search keeps everything');
});

test('class, type, tag and rarity filters match exactly and combine', () => {
  assert.deepEqual(filterEntries(ROWS, { class: 'reaver' }).map((e) => e.id), ['greatsword']);
  assert.deepEqual(filterEntries(ROWS, { type: 'Weapon' }).map((e) => e.id), ['straightSword', 'greatsword', 'starter-charm']);
  assert.deepEqual(filterEntries(ROWS, { tag: 'blade' }).map((e) => e.id), ['straightSword', 'greatsword']);
  assert.deepEqual(filterEntries(ROWS, { tag: 'blad' }).map((e) => e.id), [], 'a tag is not a prefix');
  assert.deepEqual(filterEntries(ROWS, { rarity: 'rare', type: 'Weapon' }).map((e) => e.id), ['greatsword']);
  assert.deepEqual(filterEntries(ROWS, { rarity: 'rare', type: 'Shield' }).map((e) => e.id), []);
});

test('the five sorts order by name, reverse name, id, rarity and class', () => {
  const ids = (sort) => sortEntries(ROWS, sort).map((e) => e.id);
  assert.deepEqual(ids('name'), ['greatsword', 'roundShield', 'starter-charm', 'straightSword']);
  assert.deepEqual(ids('name-desc'), ['straightSword', 'starter-charm', 'roundShield', 'greatsword']);
  assert.deepEqual(ids('id'), ['greatsword', 'roundShield', 'starter-charm', 'straightSword']);
  assert.deepEqual(ids('rarity'), ['starter-charm', 'straightSword', 'roundShield', 'greatsword'], 'starter, common, uncommon, rare');
  assert.deepEqual(ids('class'), ['roundShield', 'straightSword', 'starter-charm', 'greatsword'], 'empty class sorts first, then herald, then reaver');
  assert.deepEqual(ids('nonsense'), ids('name'), 'an unknown sort falls back to name');
  assert.equal(ROWS[0].id, 'straightSword', 'sorting copies the list');
});

test('rarities not in the order sort after the known ones', () => {
  const rows = [{ id: 'a', name: 'A', rarity: 'mythic' }, { id: 'b', name: 'B', rarity: 'common' }];
  assert.deepEqual(sortEntries(rows, 'rarity').map((e) => e.id), ['b', 'a']);
});

test('facets count each value once per entry, sorted by value', () => {
  const f = facetsOf(ROWS);
  assert.deepEqual(f.types, [{ value: 'Shield', count: 1 }, { value: 'Weapon', count: 3 }]);
  assert.deepEqual(f.tags, [{ value: 'blade', count: 2 }, { value: 'guard', count: 1 }, { value: 'heavy', count: 1 }]);
  assert.deepEqual(f.classes, [{ value: 'herald', count: 1 }, { value: 'reaver', count: 1 }]);
  assert.deepEqual(f.rarities.map((r) => r.value), ['common', 'rare', 'starter', 'uncommon']);
});

test('chip counts list every kind, zero when the count is unknown', () => {
  const chips = chipCounts({ armaments: 28, relics: '73' });
  assert.equal(chips.length, 10);
  assert.deepEqual(chips.find((c) => c.id === 'armaments'), { id: 'armaments', label: 'Armaments', count: 28 });
  assert.equal(chips.find((c) => c.id === 'relics').count, 73);
  assert.equal(chips.find((c) => c.id === 'enemies').count, 0);
});

test('a kind maps to its Data Studio table only where content/source defines it', () => {
  assert.equal(sourceTableFor('armaments'), SOURCE_TABLES.armaments);
  assert.equal(sourceTableFor('armaments', null), 'content/source/weapons.csv');
  assert.equal(sourceTableFor('armaments', ['content/source/weapons.csv']), 'content/source/weapons.csv');
  assert.equal(sourceTableFor('armaments', ['content/source/other.csv']), null, 'a missing table disables the button');
  assert.equal(sourceTableFor('cards'), null, 'cards are authored in src/content, not a table');
});

test('the deep link parses to defaults and falls back on unknown values', () => {
  const s = parseDeepLink(new URLSearchParams('kind=relics&id=medallion&q=sword&sort=rarity&tab=data'));
  assert.equal(s.kind, 'relics');
  assert.equal(s.id, 'medallion');
  assert.equal(s.q, 'sword');
  assert.equal(s.sort, 'rarity');
  assert.equal(s.tab, 'data');
  const bad = parseDeepLink({ kind: 'dragons', sort: 'random', view: 'x', density: 'huge', layout: 'wall', tab: 'nope' });
  assert.equal(bad.kind, 'armaments');
  assert.equal(bad.sort, 'name');
  assert.equal(bad.view, 'grid');
  assert.equal(bad.density, 'comfortable');
  assert.equal(bad.layout, 'grid');
  assert.equal(bad.tab, 'card');
  assert.equal(bad.id, null);
});

test('the deep link writes only the non-default state, and round-trips', () => {
  assert.equal(deepLinkOf({}), '#mod=entities&kind=armaments');
  const hash = deepLinkOf({ kind: 'armor', id: 'reaver:default', q: 'plate & leather', sort: 'id', class: 'reaver', tab: 'worn' });
  assert.equal(hash, '#mod=entities&kind=armor&id=reaver%3Adefault&q=plate+%26+leather&sort=id&class=reaver&tab=worn');
  const back = parseDeepLink(new URLSearchParams(hash.slice(1)));
  assert.equal(back.q, 'plate & leather');
  assert.equal(back.id, 'reaver:default');
  assert.equal(back.tab, 'worn');
});

test('the render page URL carries the parent origin and only set parameters', () => {
  assert.equal(
    renderUrl('http://localhost:4320', { parentOrigin: 'http://127.0.0.1:4300', kind: 'cards', view: 'grid', q: '', id: null }),
    'http://localhost:4320/workbench/modules/entities/render.html?po=http%3A%2F%2F127.0.0.1%3A4300&kind=cards&view=grid',
  );
  assert.equal(renderUrl('http://localhost:4320/'), 'http://localhost:4320/workbench/modules/entities/render.html?');
});

test('the try-in-fight URL names the class and both hands, like armament-kits', () => {
  const url = tryFightUrl('http://localhost:4320/', { classId: 'reaver', mainHand: 'straightSword', offHand: '' });
  assert.equal(url, 'http://localhost:4320/index.html?shot=combat&shotKit=1&shotClass=reaver&shotMainHand=straightSword&shotOffHand=');
});

test('the game base comes from the running game tool only', () => {
  assert.equal(gameBaseOf([{ id: 'game', status: 'up', url: 'http://localhost:4320' }]), 'http://localhost:4320/');
  assert.equal(gameBaseOf([{ id: 'game', status: 'down', url: 'http://localhost:4320' }]), null);
  assert.equal(gameBaseOf([{ id: 'editor', status: 'up', url: 'http://localhost:4317' }]), null);
  assert.equal(gameBaseOf(null), null);
});
