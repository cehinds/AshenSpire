// node --test workbench/tests/assets-module.test.mjs — the Asset Gallery's pure model: kinds, rows, filters,
// sorts, facets, the deep link, the usage search's needles and matches, frame sets, the export, and the
// virtual grid's arithmetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KINDS, kindOfPath, formatOf, folderOf, nameOf, rowsOf, kindCounts, facetsOf, filterRows, sortRows, parseDeepLink, deepLinkOf,
  assetUrl, usageNeedles, lineUses, groupUsage, entityLinkOf, frameSetOf, exportOf, clampOpacity, clampZoom, sizeLabel, dimsLabel,
  missingPacks, gridMetrics, visibleItems,
} from '../modules/assets/model.mjs';

const files = [
  { path: 'assets-mobile/poses/idle_01.webp', bytes: 2048, from: 'tree', w: 640, h: 480 },
  { path: 'assets-mobile/poses/idle_00.webp', bytes: 1024, from: 'tree', w: 640, h: 480 },
  { path: 'assets-mobile/poses/idle_02.webp', bytes: 4096, from: 'tree', w: 640, h: 480 },
  { path: 'assets-mobile/poses/enemy/guard.webp', bytes: 512, from: 'tree', w: 64, h: 64 },
  { path: 'assets-mobile/equipment/icon_battleaxe.webp', bytes: 900, from: 'tree', w: 128, h: 128 },
  { path: 'assets-mobile/equipment/body_reaver_vigil.webp', bytes: 90000, from: 'tree' },
  { path: 'assets/sprites/hero.png', bytes: 300000, from: 'high', w: 1024, h: 1024 },
  { path: 'music/theme.ogg', bytes: 500000, from: 'common' },
  { path: 'assets-mobile/bg/hall.svg', bytes: 3000, from: 'tree', w: 200, h: 100 },
  { path: 'assets-display/classic/a.webp', bytes: 20, from: 'tree', w: 320, h: 200 },
  { path: '', bytes: 1 },
  null,
];

test('kindOfPath sorts every game path into one of the gallery kinds, tier root ignored', () => {
  const cases = {
    'assets/sprites/hero.png': 'sprites',
    'assets-mobile/enemies-unity/goblin.webp': 'sprites',
    'assets-mobile/painted-outfits/reaver-vigil/body.webp': 'painted-outfits',
    'assets-mobile/poses/idle_00.webp': 'poses',
    'assets-mobile/enemy-poses/x.webp': 'poses',
    'assets/readiness-poses/rogue/a.webp': 'poses',
    'assets-mobile/animations/bow/frame_00.webp': 'animations',
    'assets-mobile/equipment/icon_battleaxe.webp': 'equipment',
    'assets-mobile/environments/legacy/tile.webp': 'environments',
    'assets-mobile/map-detail/x.webp': 'environments',
    'assets-mobile/bg/hall.webp': 'backgrounds',
    'assets-mobile/cards/default-outline/a.webp': 'ui',
    'assets-mobile/player-polish/ui/button.png': 'ui',
    'assets-mobile/framework/frame.svg': 'ui',
    'music/theme.ogg': 'music',
    'assets/fonts/serif.woff2': 'other',
    'assets-display/classic/a.webp': 'other',
    'assets-mobile/portraits/herald.webp': 'sprites',
  };
  for (const [p, kind] of Object.entries(cases)) assert.equal(kindOfPath(p), kind, p);
  assert.equal(kindOfPath('assets-mobile/anything/track.mp3'), 'music', 'audio is music wherever it sits');
  assert.deepEqual(KINDS.map((k) => k.id), ['sprites', 'painted-outfits', 'poses', 'animations', 'equipment', 'environments', 'backgrounds', 'music', 'ui', 'other']);
});

test('path parts: format, folder and name', () => {
  assert.equal(formatOf('assets/x/Idle.WEBP'), 'webp');
  assert.equal(formatOf('assets/x/noext'), '');
  assert.equal(folderOf('assets-mobile/poses/enemy/guard.webp'), 'assets-mobile/poses/enemy');
  assert.equal(folderOf('root.png'), '');
  assert.equal(nameOf('assets-mobile/poses/idle_01.webp'), 'idle_01');
});

test('rowsOf keeps the listing rows that have a path, with null for an unknown size', () => {
  const rows = rowsOf(files);
  assert.equal(rows.length, 10, 'an empty path and a null entry are dropped');
  const vigil = rows.find((r) => r.name === 'body_reaver_vigil');
  assert.equal(vigil.w, null);
  assert.equal(vigil.h, null);
  assert.equal(vigil.kind, 'equipment');
  assert.equal(vigil.folder, 'assets-mobile/equipment');
  const music = rows.find((r) => r.path === 'music/theme.ogg');
  assert.equal(music.audio, true);
  assert.equal(rows.find((r) => r.path === 'assets/sprites/hero.png').from, 'high');
});

test('kind counts keep every kind, zero included, in chip order', () => {
  const counts = kindCounts(rowsOf(files));
  assert.deepEqual(counts.map((c) => c.id), KINDS.map((k) => k.id));
  assert.equal(counts.find((c) => c.id === 'poses').count, 4);
  assert.equal(counts.find((c) => c.id === 'painted-outfits').count, 0);
});

test('filters: words search the path, kind and format match exactly, a folder takes its subfolders', () => {
  const rows = rowsOf(files);
  assert.deepEqual(filterRows(rows, { q: 'POSES idle' }).map((r) => r.name), ['idle_01', 'idle_00', 'idle_02'], 'the input order is kept');
  assert.equal(filterRows(rows, { q: 'idle guard' }).length, 0, 'every word must match');
  assert.equal(filterRows(rows, { kind: 'poses' }).length, 4);
  assert.equal(filterRows(rows, { format: 'SVG' }).length, 1);
  assert.equal(filterRows(rows, { folder: 'assets-mobile/poses' }).length, 4, 'the subfolder enemy/ is inside poses');
  assert.equal(filterRows(rows, { folder: 'assets-mobile/poses/enem' }).length, 0, 'a folder is whole segments only');
  assert.equal(filterRows(rows, {}).length, rows.length);
});

test('sorts: path, name, largest file and largest image; unknown dimensions go last', () => {
  const rows = rowsOf(files);
  assert.equal(sortRows(rows, 'path')[0].path, 'assets-display/classic/a.webp');
  assert.equal(sortRows(rows, 'size')[0].path, 'music/theme.ogg');
  const pixels = sortRows(rows, 'pixels');
  assert.equal(pixels[0].path, 'assets/sprites/hero.png');
  assert.equal(pixels.at(-1).w, null, 'an image with no size sorts after those with one');
  assert.equal(sortRows(rows, 'name')[0].name, 'a');
  assert.equal(sortRows(rows, 'bogus')[0].path, 'assets-display/classic/a.webp', 'an unknown sort is path');
  assert.equal(rows[0].path, 'assets-mobile/poses/idle_01.webp', 'sorting copies: the input keeps its order');
});

test('facets list the formats and folders that occur, with counts', () => {
  const f = facetsOf(rowsOf(files));
  assert.ok(f.formats.some((x) => x.value === 'webp' && x.count === 7));
  assert.deepEqual(f.folders.find((x) => x.value === 'assets-mobile/poses'), { value: 'assets-mobile/poses', count: 3 });
});

test('the deep link reads and writes #mod=assets&kind=…&q=…&path=…, defaults left out', () => {
  const s = parseDeepLink(new URLSearchParams('mod=assets&kind=poses&q=idle&path=assets-mobile%2Fposes%2Fidle_00.webp&sort=size'));
  assert.deepEqual(s, { kind: 'poses', q: 'idle', path: 'assets-mobile/poses/idle_00.webp', folder: '', format: '', sort: 'size' });
  assert.equal(deepLinkOf(s), '#mod=assets&kind=poses&q=idle&path=assets-mobile%2Fposes%2Fidle_00.webp&sort=size');
  assert.equal(deepLinkOf({}), '#mod=assets');
  assert.deepEqual(parseDeepLink({ kind: 'nope', sort: 'nope', folder: '/assets/poses/', format: 'PNG' }), { kind: '', q: '', path: '', folder: 'assets/poses', format: 'png', sort: 'path' });
  const back = parseDeepLink(new URLSearchParams(deepLinkOf({ kind: 'music', folder: 'music', format: 'ogg' }).slice(1)));
  assert.deepEqual(back, { kind: 'music', q: '', path: '', folder: 'music', format: 'ogg', sort: 'path' });
});

test('assetUrl encodes each segment of the game path under /asset-file/', () => {
  assert.equal(assetUrl('assets-mobile/poses/idle 01.webp'), '/asset-file/assets-mobile/poses/idle%2001.webp');
});

test('usage needles: the full path, the path without its tier root, and the name as a whole word', () => {
  assert.deepEqual(usageNeedles('assets/poses/idle_00.webp'), { paths: ['assets/poses/idle_00.webp', 'poses/idle_00.webp'], keys: ['idle_00'] });
  assert.deepEqual(usageNeedles('assets/b.png'), { paths: ['assets/b.png'], keys: [] }, 'a bare path under six characters is not searched, nor a short name');
  assert.deepEqual(usageNeedles('assets-mobile/bg/hall.svg'), { paths: ['assets-mobile/bg/hall.svg', 'bg/hall.svg'], keys: [] }, 'hall is under five characters');
});

test('a line uses an asset when it names its path or its name as a whole word', () => {
  const n = usageNeedles('assets-mobile/equipment/icon_battleaxe.webp');
  assert.equal(lineUses("art: 'equipment/icon_battleaxe.webp'", n), true, 'the path without its tier root');
  assert.equal(lineUses('key = icon_battleaxe;', n), true, 'the name as a word');
  assert.equal(lineUses('icon_battleaxeX', n), false, 'a longer name is not a use');
  assert.equal(lineUses('xicon_battleaxe', n), false);
  assert.equal(lineUses('nothing here', n), false);
  assert.equal(lineUses('the idle pose', usageNeedles('assets/poses/idle_00.webp')), false);
  assert.equal(lineUses(undefined, n), false, 'a missing line is not a use');
});

test('groupUsage sorts files, orders and de-duplicates lines, and drops malformed rows', () => {
  const grouped = groupUsage([
    { file: 'src/b.js', line: 9, text: 'late' },
    { file: 'content/a.json', line: 3, text: 'x' },
    { file: 'content/a.json', line: 1, text: 'first' },
    { file: 'content/a.json', line: 3, text: 'dup' },
    { file: '', line: 1, text: 'no file' },
    { file: 'src/c.js', line: 'nope', text: 'bad line' },
    null,
  ]);
  assert.deepEqual(grouped.map((g) => g.file), ['content/a.json', 'src/b.js']);
  assert.deepEqual(grouped[0].hits.map((h) => h.line), [1, 3]);
  assert.equal(grouped[0].hits[1].text, 'x', 'the first hit for a line is kept');
  assert.deepEqual(groupUsage(null), []);
  assert.equal(groupUsage([{ file: 'a', line: 1, text: 'y'.repeat(999) }])[0].hits[0].text.length, 240, 'a long line is cut');
});

test('equipment art maps to its entity: icon_<armament> and body_<class>_<outfit>', () => {
  assert.deepEqual(entityLinkOf('assets-mobile/equipment/icon_battleaxe.webp'), { kind: 'armaments', id: 'battleaxe' });
  assert.deepEqual(entityLinkOf('assets/equipment/body_reaver_vigil.webp'), { kind: 'armor', id: 'reaver:vigil' });
  assert.equal(entityLinkOf('assets-mobile/equipment/other.webp'), null);
  assert.equal(entityLinkOf('assets-mobile/poses/icon_x.webp'), null);
});

test('a frame set is the run of files sharing a stem and a number in one folder, in number order', () => {
  const rows = rowsOf(files);
  const set = frameSetOf('assets-mobile/poses/idle_01.webp', rows);
  assert.deepEqual(set.map((r) => r.name), ['idle_00', 'idle_01', 'idle_02']);
  assert.deepEqual(frameSetOf('assets-mobile/bg/hall.svg', rows), [], 'no number, no frames');
  assert.deepEqual(frameSetOf('assets-mobile/equipment/icon_battleaxe.webp', rows), [], 'a single file is not a run');
  const lone = rowsOf([{ path: 'a/run_1.png' }, { path: 'a/run_2.png' }, { path: 'a/run_2.webp' }]);
  assert.equal(frameSetOf('a/run_1.png', lone).length, 2, 'the format must match too');
});

test('the export carries path, kind, format and size, and says how many', () => {
  const out = exportOf(rowsOf(files).slice(0, 2), { exported: '2026-10-11T00:00:00.000Z' });
  assert.equal(out.schema, 1);
  assert.equal(out.format, 'ashen-asset-selection');
  assert.equal(out.count, 2);
  assert.deepEqual(out.items[0], { path: 'assets-mobile/poses/idle_01.webp', kind: 'poses', format: 'webp', width: 640, height: 480, bytes: 2048 });
  assert.equal(exportOf(rowsOf([{ path: 'x/y.webp' }])).items[0].width, null, 'an unknown size exports as null');
  assert.equal(exportOf([]).count, 0);
});

test('opacity and zoom stay in range; a non-number takes the default', () => {
  assert.equal(clampOpacity(2), 1);
  assert.equal(clampOpacity(-1), 0);
  assert.equal(clampOpacity('0.25'), 0.25);
  assert.equal(clampOpacity('x'), 0.5);
  assert.equal(clampZoom(100), 8);
  assert.equal(clampZoom(0), 0.25);
  assert.equal(clampZoom(undefined), 1);
});

test('sizes and dimensions read as people write them', () => {
  assert.equal(sizeLabel(340), '340 B');
  assert.equal(sizeLabel(2048), '2.0 KB');
  assert.equal(sizeLabel(300 * 1024), '300 KB');
  assert.equal(sizeLabel(5 * 1024 * 1024), '5.0 MB');
  assert.equal(sizeLabel(null), '—');
  assert.equal(dimsLabel(640, 480), '640 × 480');
  assert.equal(dimsLabel(null, 480), '—');
});

test('missingPacks names the packs not fetched and the command that fetches them', () => {
  assert.equal(missingPacks([{ id: 'high', fetched: true }, { id: 'common', fetched: true }]), null);
  assert.deepEqual(missingPacks([{ id: 'high', fetched: false }, { id: 'light', fetched: true }, { id: 'common', fetched: false }]), {
    packs: ['high', 'common'], command: 'node tools/fetch-art.mjs --pack high,common',
  });
});

test('the grid fits its columns to the width and virtualises the rows on screen', () => {
  assert.deepEqual(gridMetrics({ count: 10, width: 500, tile: 128, gap: 8 }), { cols: 3, rows: 4, rowHeight: 136, height: 544, cell: 128, gap: 8 });
  assert.equal(gridMetrics({ count: 0, width: 0 }).rows, 0);
  assert.equal(gridMetrics({ count: 5, width: 10, tile: 128 }).cols, 1, 'at least one column');
  const m = gridMetrics({ count: 1000, width: 500, tile: 128, gap: 8 });
  assert.deepEqual(visibleItems({ count: 1000, metrics: m, scrollTop: 0, viewport: 300, overscan: 0 }), { from: 0, to: 9 });
  assert.deepEqual(visibleItems({ count: 1000, metrics: m, scrollTop: 1360, viewport: 300, overscan: 1 }), { from: 27, to: 42 });
  assert.deepEqual(visibleItems({ count: 5, metrics: gridMetrics({ count: 5, width: 500 }), scrollTop: 9999, viewport: 800 }), { from: 5, to: 5 }, 'past the end shows nothing');
  assert.deepEqual(visibleItems({ count: 0, metrics: gridMetrics({ count: 0, width: 500 }) }), { from: 0, to: 0 });
});

test('the Asset Gallery is a real module, not the placeholder, and its module loads with a mount()', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../modules/assets/index.mjs', import.meta.url), 'utf8');
  assert.ok(!/placeholder\.mjs/.test(src), 'the gallery does not import the placeholder');
  assert.match(src, /\/asset-file\//, 'images come from the Workbench art route');
  assert.match(src, /assets\/list/, 'the listing is the Workbench API');
  const { MODULES } = await import('../modules/index.mjs');
  const mod = await MODULES.find((m) => m.id === 'assets').load();
  assert.equal(typeof mod.default.mount, 'function');
});
