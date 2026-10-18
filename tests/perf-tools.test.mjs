// tests/perf-tools.test.mjs — the pure parts of tools/measure.mjs and
// tools/size-budget.mjs: the budget comparison and the data-URI parser.
//
// No browser. The browser path (scenes, the three touch plays, the CDP
// counters) is covered by a manual run, `node tools/measure.mjs --serve`; its
// MEASURE lines are quoted in the pull request that added the tools.

import test from 'node:test';
import assert from 'node:assert/strict';
import { BUDGET, checkBudget, budgetFailed, budgetValues, parseArgs, sceneUrl, mean, httpProblem, readinessProblem, pageErrorProblem } from '../tools/measure.mjs';
import * as size from '../tools/size-budget.mjs';

const within = Object.fromEntries(Object.entries(BUDGET));

test('checkBudget: at budget and up to +25% pass, past +25% fails', () => {
  const rows = checkBudget({ ...within, 'combat.nodes': 1250, 'play.longTasks': 2.5 });
  assert.ok(!budgetFailed(rows));
  assert.equal(rows.find((r) => r.key === 'combat.nodes').status, 'ok');
  const over = checkBudget({ ...within, 'combat.nodes': 1251 });
  assert.equal(over.find((r) => r.key === 'combat.nodes').status, 'over');
  assert.ok(budgetFailed(over));
});

test('checkBudget: a value that was not measured fails', () => {
  const values = { ...within };
  delete values['play.layouts'];
  const row = checkBudget(values).find((r) => r.key === 'play.layouts');
  assert.equal(row.status, 'missing');
  assert.ok(budgetFailed(checkBudget(values)));
});

test('checkBudget: the table is the owner\'s, nothing else is gated', () => {
  assert.deepEqual(BUDGET, {
    'combat.nodes': 1000, 'combat.filters': 30, 'play.layouts': 30, 'play.forcedReads': 300,
    'play.recalcs': 100, 'play.mutations': 500, 'play.longTasks': 2,
  });
  assert.equal(checkBudget({}).length, 7);
});

test('budgetValues: flattens a result; no landed plays means no play values', () => {
  const v = budgetValues({ scenes: { combat: { nodes: 5, filters: 6 } }, play: { plays: 3, layouts: 1, recalcs: 2, forcedReads: 3, mutations: 4, longTasks: 0 } });
  assert.deepEqual(v, { 'combat.nodes': 5, 'combat.filters': 6, 'play.layouts': 1, 'play.recalcs': 2, 'play.forcedReads': 3, 'play.mutations': 4, 'play.longTasks': 0 });
  assert.equal(Object.keys(budgetValues({ scenes: { combat: { nodes: 5, filters: 6 } }, play: { plays: 0, layouts: 0 } })).filter((k) => k.startsWith('play.')).length, 0);
});

test('measure: arguments and scene URLs', () => {
  assert.deepEqual(parseArgs([]), { url: null, serve: true, json: null, budget: false, scenes: ['title', 'map', 'combat', 'rest', 'shop'] });
  assert.deepEqual(parseArgs(['--scenes', 'title,combat']).scenes, ['title', 'combat']);
  assert.throws(() => parseArgs(['--scenes', 'title,nope']));
  assert.deepEqual(parseArgs(['--url', 'http://localhost:1/x.html', '--budget', '--json', 'o.json']), { url: 'http://localhost:1/x.html', serve: false, json: 'o.json', budget: true, scenes: ['title', 'map', 'combat', 'rest', 'shop'] });
  assert.throws(() => parseArgs(['--url', 'http://localhost:1/', '--serve']));
  assert.throws(() => parseArgs(['--nope']));
  assert.throws(() => parseArgs(['--url']));
  assert.equal(sceneUrl('http://localhost:8080/', 'combat'), 'http://localhost:8080/?shot=combat');
  assert.equal(sceneUrl('http://localhost:8080/AshenSpire.html', 'map'), 'http://localhost:8080/AshenSpire.html?shot=map');
  assert.equal(mean([1, 2, 6]), 3);
  assert.equal(mean([]), 0);
});

test('httpProblem / readinessProblem: an error page or an empty shell is not a scene', () => {
  assert.equal(httpProblem(200), null);
  assert.equal(httpProblem(404), 'HTTP 404');
  assert.equal(httpProblem(500), 'HTTP 500');
  assert.equal(httpProblem(null), 'no HTTP response');
  assert.equal(httpProblem(null, 'file:'), null);
  assert.equal(readinessProblem({ appChildren: 3, banners: 0 }), null);
  assert.match(readinessProblem({ appChildren: 0, banners: 0 }), /#app/);
  assert.match(readinessProblem({ appChildren: 3, banners: 1 }), /banner/);
  assert.match(readinessProblem(null), /#app/);
});

test('pageErrorProblem: any uncaught page error voids the attempt and is named', () => {
  assert.equal(pageErrorProblem([]), null);
  assert.equal(pageErrorProblem(undefined), null);
  assert.equal(pageErrorProblem(['TypeError: x is undefined']), 'page error: TypeError: x is undefined');
  assert.equal(pageErrorProblem(['a', 'b']), 'page error (1 of 2): a');
});

// base64 of "AB" (QUI=), "A" (QQ==), "ABC" (QUJD), 6 bytes (QUJDREVG)
const SYNTH = [
  '<html><script>',
  'const PACK = {"ui/small.png":"data:image/png;base64,QQ==","art/big.webp": "data:image/webp;base64,QUJDREVGQUJDREVG",',
  '"codec":"data:audio/ogg;codecs=opus;base64,QUJD", "p":["data:image/png;base64,QUI="]};',
  '</script><div style="background:url(data:image/svg+xml;base64,QUJD)"></div>',
  '<p>prose naming data:image/png;base64, with no run after it</p>',
  '</html>',
].join('\n');

test('findDataUris: mime, decoded size, key, file order', () => {
  const uris = size.findDataUris(SYNTH);
  assert.deepEqual(uris.map((u) => [u.mime, u.bytes, u.key]), [
    ['image/png', 1, 'ui/small.png'],
    ['image/webp', 12, 'art/big.webp'],
    ['audio/ogg', 3, 'codec'],
    ['image/png', 2, 'p'],
    ['image/svg+xml', 3, null],
  ]);
  assert.ok(uris.every((u, i) => i === 0 || u.index > uris[i - 1].index));
  assert.equal(SYNTH.slice(uris[1].index, uris[1].index + 5), 'data:');
});

test('topDataUris: largest first, unkeyed ones named by position in the file', () => {
  const top = size.topDataUris(size.findDataUris(SYNTH), 3);
  assert.deepEqual(top.map((u) => [u.label, u.bytes]), [['art/big.webp', 12], ['codec', 3], ['idx4', 3]]);
  assert.equal(size.topDataUris([], 10).length, 0);
});

test('decodedSize: matches Buffer for every padding case', () => {
  for (const raw of ['', 'A', 'AB', 'ABC', 'ABCD', 'hello world']) {
    const b64 = Buffer.from(raw).toString('base64');
    assert.equal(size.decodedSize(b64.replace(/=+$/, '').length), Buffer.from(b64, 'base64').length, raw);
  }
});

test('evaluateRow / budgetFailed: only a gated row over +25% (or missing) fails', () => {
  const gated = { item: 'x', budget: 100, gate: true };
  assert.equal(size.evaluateRow({ ...gated, bytes: 125 }).status, 'ok');
  assert.equal(size.evaluateRow({ ...gated, bytes: 126 }).status, 'over');
  assert.equal(size.evaluateRow({ ...gated, bytes: null }).status, 'missing');
  assert.equal(size.evaluateRow({ item: 'y', budget: 100, gate: false, bytes: 1e9 }).status, 'over');
  assert.equal(size.evaluateRow({ item: 'z', budget: null, gate: false, bytes: 7 }).status, 'info');
  assert.ok(!size.budgetFailed([{ item: 'y', budget: 100, gate: false, bytes: 1e9 }]), 'an informational row never fails');
  assert.ok(size.budgetFailed([{ ...gated, bytes: 126 }]));
  assert.ok(size.budgetFailed([{ ...gated, bytes: null }]));
  assert.ok(!size.budgetFailed([{ ...gated, bytes: 125 }]));
});

test('size budget table: the owner\'s numbers and gates', () => {
  const by = Object.fromEntries(size.ROWS.map((r) => [r.item, r]));
  assert.deepEqual([by['build/AshenSpire.html'].budget, by['build/AshenSpire.html'].gate], [4_000_000, false]);
  assert.deepEqual([by['dist/download/AshenSpire.html'].budget, by['dist/download/AshenSpire.html'].gate], [60_000_000, true]);
  assert.deepEqual([by['dist/'].budget, by['dist/'].gate], [150_000_000, true]);
  assert.equal(size.LIGHT_PACK_BUDGET, 1_000_000);
  assert.equal(size.TOP_URIS, 10);
});

test('size-budget: formatRow prints the SIZE line shape', () => {
  assert.equal(size.formatRow({ item: 'dist/', bytes: 5, budget: 9, gate: true }), 'SIZE dist/ bytes=5 budget=9 gate=yes');
  assert.equal(size.formatRow({ item: 'datauri.1', bytes: 3, budget: null, gate: false, mime: 'image/png', key: 'k' }), 'SIZE datauri.1 bytes=3 budget=- gate=no mime=image/png key=k');
  assert.equal(size.formatRow({ item: 'a', bytes: null, budget: 1, gate: true }), 'SIZE a bytes=missing budget=1 gate=yes');
});
