// node --test workbench/tests/entities-module.test.mjs — the Entity Browser's pure
// helpers: the index rows, the filters, the five sorts, the facets, the chip
// counts, the kind to source-table map, the deep link and the URLs it builds.
import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { armamentIconAsset } from '../../src/model/equipmentArt.js';
import {
  KINDS, SORTS, SOURCE_TABLES, entryOf, filterEntries, sortEntries, facetsOf, chipCounts,
  parseDeepLink, deepLinkOf, renderUrl, tryFightUrl, gameBaseOf, sourceTableFor, kindOf,
  escHtml, handChoices, handsFor, RENDER_PROTOCOL, settleFilters, tableRowOf, connectPlan, drawerOpenFor, gameStartOf,
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

test('the render page sets the game root as its base, and loads its own files by absolute path', () => {
  const html = fs.readFileSync(new URL('../modules/entities/render.html', import.meta.url), 'utf8');
  assert.match(html, /<base href="\/">/, 'game asset paths resolve from the game root, not the module folder');
  assert.match(html, /<script type="module" src="\/workbench\/modules\/entities\/render\.mjs">/);
  assert.match(html, /<link rel="stylesheet" href="\/workbench\/modules\/entities\/render\.css">/);
});

test('the inventory icon uses the game art key, as the game does', () => {
  // The game's own rule (src/model/equipmentArt.js): inventoryArtKey first, then the id.
  assert.equal(armamentIconAsset({ id: 'straightSword', inventoryArtKey: 'straightSwordInventory2026' }), 'assets/equipment/icon_straightSwordInventory2026.webp');
  assert.equal(armamentIconAsset({ id: 'dagger', inventoryArtKey: '' }), 'assets/equipment/icon_dagger.webp');
  const render = fs.readFileSync(new URL('../modules/entities/render.mjs', import.meta.url), 'utf8');
  assert.match(render, /armamentIconAsset\(def\)/, 'the render page asks the game for the icon path');
  assert.doesNotMatch(render, /icon_\$\{def\.id\}/, 'and no longer builds it from the id alone');
});

test('the render page announces the protocol version the module checks', () => {
  assert.ok(Number.isInteger(RENDER_PROTOCOL) && RENDER_PROTOCOL >= 1);
  const render = fs.readFileSync(new URL('../modules/entities/render.mjs', import.meta.url), 'utf8');
  assert.match(render, /post\('ready', \{ protocol: RENDER_PROTOCOL \}\)/, 'ready carries the version');
  const index = fs.readFileSync(new URL('../modules/entities/index.mjs', import.meta.url), 'utf8');
  assert.match(index, /d\.protocol !== RENDER_PROTOCOL/, 'the module refuses a different version');
  assert.match(index, /"This project's checkout has no Entity Browser render page, or an older one\. Update that checkout to this branch\."/, 'the checkout message names the fix');
  assert.match(index, /clearTimeout\(readyTimer\)/, 'a page that never answers is reported after a wait');
});

test('a deep link filter stays pending until the kind index loads, then only a value the index has survives', () => {
  const link = { class: 'reaver', type: 'Armor', tag: 'guard', rarity: 'rare' };
  assert.deepEqual(settleFilters(link, null), link, 'before the index loads, nothing is dropped');
  const facets = facetsOf([{ id: 'a', class: 'reaver', itemTypes: ['Armor'], tags: ['guard'], rarity: 'rare' }]);
  assert.deepEqual(settleFilters(link, facets), link, 'values the index carries are kept');
  assert.deepEqual(settleFilters({ ...link, class: 'nobody' }, facets), { ...link, class: '' }, 'an unknown value is cleared once the index is in');
  assert.deepEqual(settleFilters({}, facets), { class: '', type: '', tag: '', rarity: '' }, 'no wanted value is an empty filter');
});

test('an entity maps to its Data Studio row and match: armour by the outfit id and its class, others as they are', () => {
  assert.deepEqual(tableRowOf('armor', 'reaver:default'), { row: 'default', match: 'classId:reaver' });
  assert.deepEqual(tableRowOf('armor', 'starseer:vigil'), { row: 'vigil', match: 'classId:starseer' });
  assert.deepEqual(tableRowOf('armaments', 'straightSword'), { row: 'straightSword', match: '' });
  assert.deepEqual(tableRowOf('relics', 'medallion'), { row: 'medallion', match: '' });
  assert.deepEqual(tableRowOf('armor', ''), { row: '', match: '' });
  const csv = fs.readFileSync(new URL('../../content/source/outfits.csv', import.meta.url), 'utf8').split('\n').filter((l) => l && !l.startsWith('#'));
  const header = csv[0].split(',');
  const rows = csv.slice(1).map((l) => Object.fromEntries(l.split(',').map((c, i) => [header[i], c])));
  assert.equal(header[0], 'id', 'the outfit table is keyed by its id column');
  assert.equal(header[1], 'classId', 'the outfit table names its class in classId, the match column');
  const link = tableRowOf('armor', 'reaver:default');
  assert.ok(rows.some((r) => r.id === link.row), 'the mapped row is a row of the table');
  assert.ok(rows.some((r) => r.id === link.row && `classId:${r.classId}` === link.match), 'row and match name the same row');
});

test('on show the module keeps a working game and reloads when the origin changed or nothing answered', () => {
  const up = 'http://localhost:4320/';
  assert.equal(connectPlan({ base: null, currentOrigin: 'http://localhost:4320', ready: true }), 'setup', 'a down server shows the setup message');
  assert.equal(connectPlan({ base: up, currentOrigin: 'http://localhost:4320', ready: true }), 'keep', 'the same origin, answering: nothing to do');
  assert.equal(connectPlan({ base: 'http://localhost:4400/', currentOrigin: 'http://localhost:4320', ready: true }), 'load', 'a moved port reloads the frames');
  assert.equal(connectPlan({ base: up, currentOrigin: null, ready: false }), 'load', 'the first connect loads');
  assert.equal(connectPlan({ base: up, currentOrigin: 'http://localhost:4320', ready: false }), 'load', 'frames that never answered are loaded again');
  assert.equal(connectPlan({ base: up, currentOrigin: 'http://localhost:4320', ready: true, force: true }), 'load', 'a forced reload loads anyway');
});

test('a deep link that selects an entity opens the detail drawer, and one without an id does not', () => {
  const linked = parseDeepLink(new URLSearchParams('kind=relics&id=medallion&tab=data'));
  assert.equal(drawerOpenFor(linked), true, 'an id in the link opens the drawer (an overlay below 1100px)');
  assert.equal(drawerOpenFor(parseDeepLink(new URLSearchParams('kind=relics'))), false, 'no id: no drawer');
  assert.equal(drawerOpenFor({ id: null }), false);
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

test('escHtml escapes markup and quotes, so an id cannot break out of an attribute', () => {
  assert.equal(escHtml(`"><img src=x onerror=1>&'`), '&quot;&gt;&lt;img src=x onerror=1&gt;&amp;&#39;');
  assert.equal(escHtml(null), '');
  assert.equal(escHtml(12), '12');
});

test('the Try in fight hands default to a sword and shield, and the off hand never copies the main hand by default', () => {
  const ids = ['straightSword', 'roundShield', 'dagger'];
  assert.deepEqual(handsFor({}, ids), { mainHand: 'straightSword', offHand: 'roundShield' });
  assert.deepEqual(handsFor({ mainHand: 'roundShield', offHand: null }, ids), { mainHand: 'roundShield', offHand: 'straightSword' }, 'the default off hand skips the main hand');
  assert.deepEqual(handsFor({ mainHand: 'dagger', offHand: null }, ids), { mainHand: 'dagger', offHand: 'roundShield' });
  assert.deepEqual(handsFor({ mainHand: 'dagger', offHand: 'dagger' }, ids), { mainHand: 'dagger', offHand: 'dagger' }, 'a choice the reader made is kept');
  assert.deepEqual(handsFor({ mainHand: '', offHand: '' }, ids), { mainHand: '', offHand: '' }, 'an empty hand is a choice');
  assert.deepEqual(handsFor({ mainHand: 'nope', offHand: 'gone' }, ids), { mainHand: 'straightSword', offHand: 'roundShield' }, 'unknown ids fall back');
  assert.deepEqual(handsFor({}, ['straightSword']), { mainHand: 'straightSword', offHand: '' }, 'a missing default is the empty hand');
  assert.deepEqual(handsFor({ mainHand: 'straightSword', offHand: null }, ['straightSword']), { mainHand: 'straightSword', offHand: '' });
});

test('the Try in fight hand choices start with the empty hand and keep ids as given', () => {
  assert.deepEqual(handChoices([{ id: 'straightSword', name: 'Straight Sword' }, { id: 'a"b', name: 'Odd' }]), [
    ['', 'Empty hand'], ['straightSword', 'Straight Sword'], ['a"b', 'Odd'],
  ]);
  assert.deepEqual(handChoices(), [['', 'Empty hand']]);
  const opts = handChoices([{ id: 'a"b', name: 'Odd' }]).map(([v, t]) => `<option value="${escHtml(v)}">${escHtml(t)}</option>`).join('');
  assert.equal(opts, '<option value="">Empty hand</option><option value="a&quot;b">Odd</option>');
});

test('the frames reload when the game server is a new start on the same origin', () => {
  const up = 'http://localhost:4320/', origin = 'http://localhost:4320';
  assert.equal(connectPlan({ base: up, currentOrigin: origin, ready: true, serverId: 2000, currentServerId: 1000 }), 'load', 'a restarted game on the same port has a new start time');
  assert.equal(connectPlan({ base: up, currentOrigin: origin, ready: true, serverId: 1000, currentServerId: 1000 }), 'keep', 'the same start: nothing to do');
  assert.equal(connectPlan({ base: up, currentOrigin: origin, ready: true, serverId: null, currentServerId: 1000 }), 'keep', 'an unknown start (a reused server) keeps the frames');
});

test('gameStartOf reads the game tool start time from the tools listing', () => {
  assert.equal(gameStartOf([{ id: 'game', status: 'up', url: 'http://localhost:4320/', startedAt: 1000 }]), 1000);
  assert.equal(gameStartOf([{ id: 'game', status: 'up', url: 'http://localhost:4320/', startedAt: null }]), null);
  assert.equal(gameStartOf([{ id: 'editor', status: 'up', startedAt: 5 }]), null);
  assert.equal(gameStartOf([]), null);
});
