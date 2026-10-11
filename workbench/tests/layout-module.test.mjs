// node --test workbench/tests/layout-module.test.mjs — Layout Studio's pure
// config model: regions match UI Studio's own model for a real wireframe and
// device, a canvas edit maps back to the expected config change, and nothing
// changes the bytes of a file that was not edited.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from '../modules/layout/config-model.mjs';
import * as M from '../../ui-studio/model.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG = join(ROOT, 'content/config');
const readRel = (rel) => readFileSync(join(CONFIG, rel), 'utf8');

function loadedFiles(rels) {
  const files = new Map();
  for (const rel of rels) files.set(rel, C.fileState(rel, readRel(rel), `hash-${rel}`));
  return files;
}

const W4A_FILES = ['ui/scenes/w4.json', 'ui/scenes/w4a-combat.json', 'ui/tokens.json', 'ui/components/card.json', 'ui/components/categoryNav.json'];
const settings = C.defaultSettings();
const wireframe = C.wireframeById(settings, 'w4a');
const device = settings.devices.find((d) => d.id === 'desk-1280');
const vp0 = () => C.viewportOf(device);

test('the vendored studio model is byte-identical to ui-studio/model.mjs', () => {
  const mine = readFileSync(join(ROOT, 'workbench/modules/layout/studio-model.mjs'), 'utf8');
  const theirs = readFileSync(join(ROOT, 'ui-studio/model.mjs'), 'utf8');
  assert.equal(mine, theirs, 'copy studio-model.mjs from ui-studio/model.mjs again');
});

test('regions for w4a at desk 1280 match UI Studio\'s regionsFor, field for field', () => {
  const files = loadedFiles(W4A_FILES);
  const vp = C.viewportOf(device);
  const got = C.regionsFor({ wireframe, files, viewport: vp, settings });
  // The same inputs UI Studio's regions() passes, with the same loaded configs.
  const configs = Object.fromEntries([...files].map(([rel, f]) => [rel, f.data]));
  const layout = M.gameLayoutFor(vp, settings.gameLayout);
  const want = M.regionsFor(wireframe, configs['ui/scenes/w4a-combat.json'], vp, {
    parent: configs['ui/scenes/w4.json'], tokens: configs['ui/tokens.json'].vars, layoutMode: layout.mode,
    screens: settings.screens, zoom: layout.zoom, rootFontPx: settings.gameLayout.rootFontPx, configs,
  });
  assert.deepEqual(got.regions, want);
  assert.equal(got.layout.mode, layout.mode);
  assert.equal(got.breakpoint.id, M.breakpointFor(settings.breakpoints, vp).id);
  assert.deepEqual(got.regions.map((r) => r.id), ['band.hud', 'band.scene', 'band.context', 'band.footer', 'floor', 'hand']);
});

test('the canvas document locks regions that have no config edit', () => {
  const files = loadedFiles(W4A_FILES);
  const vp = C.viewportOf(device);
  const { regions } = C.regionsFor({ wireframe, files, viewport: vp, settings });
  const doc = C.canvasDocFor(vp, regions);
  const locked = Object.fromEntries(doc.items.map((it) => [it.id, it.locked]));
  assert.equal(locked['band.footer'], true, 'the last band is the remainder, not editable');
  assert.equal(locked.hand, true);
  assert.equal(locked['band.scene'], false);
  assert.equal(doc.width, 1280);
  assert.equal(doc.height, 800);
});

test('dragging a band\'s bottom edge maps back to the band percents', () => {
  const files = loadedFiles(W4A_FILES);
  const f = files.get('ui/scenes/w4a-combat.json');
  const vp = C.viewportOf(device);
  const v = C.regionsFor({ wireframe, files, viewport: vp, settings });
  const doc = C.canvasDocFor(vp, v.regions);
  // Shrink the battlefield by 10 px from its bottom: the scene's bottom edge moves up.
  const items = doc.items.map((it) => (it.id === 'band.scene' ? { ...it, h: it.h - 10 } : it));
  const next = C.applyCanvasEdits({ data: f.data, regions: v.regions, items, viewport: vp, grid: settings.grid });
  // 10 px of 800 is 1.25%; the scene goes 55 → 54 on the 1% step, the context takes the rest.
  assert.equal(M.getPath(next, 'sizing.bands.scene'), 54);
  assert.equal(M.getPath(next, 'sizing.bands.context'), 31);
  assert.equal(M.getPath(next, 'sizing.bands.hud'), 10, 'other bands are unchanged');
  const sum = Object.values(M.getPath(next, 'sizing.bands')).reduce((a, b) => a + b, 0);
  assert.equal(sum, 100, 'the percents still sum to 100');
  assert.deepEqual(f.data, JSON.parse(f.original), 'the input file data is not mutated');
});

test('moving band.scene sideways and down maps to no config change, and says the layout places it', () => {
  const files = loadedFiles(W4A_FILES);
  const f = files.get('ui/scenes/w4a-combat.json');
  const vp = C.viewportOf(device);
  const v = C.regionsFor({ wireframe, files, viewport: vp, settings });
  const doc = C.canvasDocFor(vp, v.regions);
  const moved = doc.items.map((it) => (it.id === 'band.scene' ? { ...it, x: it.x + 30, y: it.y + 40 } : it));
  const report = C.canvasEditReport({ data: f.data, regions: v.regions, items: moved, viewport: vp, grid: settings.grid });
  assert.equal(report.data, f.data, 'a pure move leaves the data as it was: the same object comes back');
  assert.deepEqual(report.notes, [{ id: 'band.scene', label: v.regions.find((r) => r.id === 'band.scene').label, outcome: 'move' }]);
  assert.equal(M.getPath(report.data, 'sizing.bands.scene'), 55, 'the scene keeps its 55%');
  assert.equal(M.getPath(report.data, 'sizing.bands.context'), 30, 'the context keeps its 30%');
});

test('resizing band.scene\'s bottom edge maps to the bands change and no note', () => {
  const files = loadedFiles(W4A_FILES);
  const f = files.get('ui/scenes/w4a-combat.json');
  const vp = C.viewportOf(device);
  const v = C.regionsFor({ wireframe, files, viewport: vp, settings });
  const doc = C.canvasDocFor(vp, v.regions);
  const resized = doc.items.map((it) => (it.id === 'band.scene' ? { ...it, h: it.h + 40 } : it));
  const report = C.canvasEditReport({ data: f.data, regions: v.regions, items: resized, viewport: vp, grid: settings.grid });
  assert.notEqual(M.getPath(report.data, 'sizing.bands.scene'), 55, 'the bottom edge drives the scene percent');
  assert.deepEqual(report.notes, []);
});

test('a resize whose edge the config does not own maps to nothing, and is noted as zero', () => {
  // A right-anchored region: the left handle moves x and w, the right edge stays.
  const region = { id: 'rail', label: 'rail', x: 100, y: 0, w: 200, h: 300, line: false, edit: { kind: 'path', path: 'sizing.railFraction', unit: 'fractionOfWidth', axis: 'w' } };
  const data = { sizing: { railFraction: 0.2 } };
  const report = C.canvasEditReport({ data, regions: [region], items: [{ ...region, x: 80, w: 220 }], viewport: vp0(), grid: settings.grid });
  assert.equal(report.data, data);
  assert.deepEqual(report.notes, [{ id: 'rail', label: 'rail', outcome: 'zero' }]);
  // The bottom handle of a bottom-anchored region moves its height, not its top edge.
  const footer = { id: 'footer', label: 'footer', x: 0, y: 500, w: 300, h: 100, edit: { kind: 'path', path: 'sizing.footerMinVh', unit: 'vh', axis: 'h', anchor: 'bottom' } };
  const grown = C.canvasEditReport({ data, regions: [footer], items: [{ ...footer, h: 120 }], viewport: vp0(), grid: settings.grid });
  assert.equal(grown.data, data);
  assert.deepEqual(grown.notes, [{ id: 'footer', label: 'footer', outcome: 'zero' }]);
});

test('a move that changes no edge changes nothing, and so does a locked region', () => {
  const files = loadedFiles(W4A_FILES);
  const f = files.get('ui/scenes/w4a-combat.json');
  const vp = C.viewportOf(device);
  const v = C.regionsFor({ wireframe, files, viewport: vp, settings });
  const doc = C.canvasDocFor(vp, v.regions);
  const shifted = doc.items.map((it) => (it.id === 'hand' || it.id === 'band.footer' ? { ...it, y: it.y + 30 } : it));
  const next = C.applyCanvasEdits({ data: f.data, regions: v.regions, items: shifted, viewport: vp, grid: settings.grid });
  assert.equal(next, f.data, 'nothing moved: the same object comes back');
});

test('a centred region edits its width on both sides (half the edge each)', () => {
  const edit = { kind: 'path', path: 'sizing.frameWidthVw', unit: 'vw', axis: 'w', centered: true };
  const before = { x: 100, y: 0, w: 200, h: 100 };
  const after = { x: 90, y: 0, w: 220, h: 100 };
  assert.equal(C.movementFor(edit, before, after), 10, 'a 20 px wider frame moves each edge 10 px');
  assert.equal(C.movementFor({ kind: 'path', axis: 'h', anchor: 'bottom' }, { x: 0, y: 500, w: 1, h: 100 }, { x: 0, y: 480, w: 1, h: 120 }), -20, 'a bottom-anchored edit follows the top edge');
});

test('serialization is unchanged when nothing was edited, for every loaded UI file', () => {
  const uiRels = [];
  const walk = (dir, prefix) => {
    for (const e of readdirSync(join(CONFIG, dir), { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${dir}/${e.name}`, `${prefix}${e.name}/`);
      else if (e.name.endsWith('.json')) uiRels.push(`${prefix}${e.name}`);
    }
  };
  walk('ui', 'ui/');
  assert.ok(uiRels.length > 5, 'the UI tree is found');
  const files = loadedFiles(uiRels.map((r) => r));
  for (const f of files.values()) {
    assert.equal(C.isDirty(f), false, `${f.rel} is not dirty when unedited`);
    assert.equal(C.proposedText(f), f.original, `${f.rel} round-trips byte for byte`);
  }
  assert.deepEqual(C.changesFor(files), []);
});

test('an edited file is dirty and its save carries the base hash it was read with', () => {
  const files = loadedFiles(['ui/scenes/w4a-combat.json']);
  const f = files.get('ui/scenes/w4a-combat.json');
  files.set(f.rel, { ...f, data: C.setConfigValue(f.data, 'sizing.bands.hud', 11) });
  const [change] = C.changesFor(files);
  assert.equal(change.path, 'content/config/ui/scenes/w4a-combat.json');
  assert.equal(change.baseHash, 'hash-ui/scenes/w4a-combat.json');
  assert.notEqual(change.text, f.original);
  assert.equal(JSON.parse(change.text).sizing.bands.hud, 11);
});

test('Reload from disk of a file deleted on disk drops its draft and marks it missing', () => {
  const rel = 'ui/scenes/w4a-combat.json';
  const files = loadedFiles([rel]);
  const f = files.get(rel);
  files.set(rel, { ...f, data: C.setConfigValue(f.data, 'sizing.bands.hud', 11) });
  assert.equal(C.changesFor(files).length, 1, 'the draft is dirty before the reload');
  // The read found no file: the disk has none, so the draft and its state go and the file reads as missing.
  const gone = C.reloadFromDisk(files, rel, null);
  assert.equal(gone.missing, true);
  assert.equal(gone.files.has(rel), false);
  assert.deepEqual(C.changesFor(gone.files), [], 'a missing file saves nothing');
  assert.equal(files.has(rel), true, 'the map it was given is not changed');
  // A file still on disk takes the disk copy and its hash.
  const back = C.reloadFromDisk(files, rel, { text: readRel(rel), hash: 'disk-2' });
  assert.equal(back.missing, false);
  assert.equal(back.files.get(rel).hash, 'disk-2');
  assert.deepEqual(C.changesFor(back.files), []);
});

test('a $token reads as a chip with its resolved value, and an unknown name is flagged', () => {
  const tokens = { gap: 12 };
  const data = { vars: { local: 4 } };
  assert.deepEqual(C.refInfo('$gap', data, tokens), { ref: '$gap', value: 12, from: 'tokens' });
  assert.deepEqual(C.refInfo('$local', data, tokens), { ref: '$local', value: 4, from: 'file' });
  assert.equal(C.refInfo('$nope', data, tokens).from, 'missing');
  assert.equal(C.refInfo(42, data, tokens), null);
});

test('loadWorkspace reads every UI file through the injected api, and keeps invalid JSON as an error', async () => {
  const calls = [];
  const api = async (path) => {
    calls.push(path);
    if (path.startsWith('files/list')) return { files: ['content/config/ui/a.json', 'content/config/ui/b.json'], truncated: false };
    if (path.includes('a.json')) return { text: '{"x":1}\n', hash: 'ha' };
    return { text: '{nope', hash: 'hb' };
  };
  const { files } = await C.loadWorkspace(api);
  assert.deepEqual([...files.keys()], ['ui/a.json', 'ui/b.json']);
  assert.deepEqual(files.get('ui/a.json').data, { x: 1 });
  assert.match(files.get('ui/b.json').error, /Invalid JSON/);
  assert.equal(calls[0], 'files/list?dir=content%2Fconfig%2Fui&ext=json');
});

test('the viewport of a rotated device swaps its sides', () => {
  const phone = settings.devices.find((d) => d.id === 'iphone-14');
  assert.equal(C.viewportOf(phone, { orientation: 'portrait' }).width, 390);
  assert.equal(C.viewportOf(phone, { orientation: 'landscape' }).width, 844);
  const free = settings.devices.find((d) => d.resizable);
  assert.equal(C.viewportOf(free, { freeSize: { width: 500, height: 300 } }).width, 500);
});

test('a plain number typed into a $ref field is saved as a number; a $name or text stays text', () => {
  assert.equal(C.fieldValue('42', '$gap'), 42);
  assert.equal(C.fieldValue(' 3.5 ', '$gap'), 3.5);
  assert.equal(C.fieldValue('1e3', '$gap'), 1000);
  assert.equal(C.fieldValue('$gap2', '$gap'), '$gap2', 'a reference stays a reference');
  assert.equal(C.fieldValue('$', '$gap'), '$');
  assert.equal(C.fieldValue('abc', '$gap'), 'abc', 'text that is not a number stays text');
  assert.equal(C.fieldValue('Infinity', '$gap'), 'Infinity', 'only a finite number is a number');
  assert.equal(C.fieldValue('', '$gap'), '', 'an empty field is not zero');
  assert.equal(C.fieldValue('12', 'plain'), '12', 'a field that holds plain text stays text');
});

test('a conflict reload of a mode file deleted on disk closes the dialog with a toast, not a stuck draft', () => {
  const src = readFileSync(join(ROOT, 'workbench/modules/layout/index.mjs'), 'utf8');
  const start = src.indexOf('// The presets or a sketch');
  const branch = src.slice(start, src.indexOf('if (!f) return;', start));
  assert.match(branch, /const out = await owner\.reload\(btn\.dataset\.path\);/, 'the owner reports what the disk state is');
  assert.match(branch, /if \(out\?\.missing\)/, 'a missing file is not a failure');
  assert.match(branch, /dlg\.close\(\);/, 'the dialog closes');
  assert.match(branch, /was deleted on disk/, 'the deletion is toasted');
});

test('the sketch view\'s reload reads a 404 as the disk state: the sketch leaves the list and the canvas clears', () => {
  const src = readFileSync(join(ROOT, 'workbench/modules/layout/sketch-view.mjs'), 'utf8');
  const start = src.indexOf('async reload(path)');
  const body = src.slice(start, src.indexOf('hashOf(path)', start));
  assert.match(body, /err\.status !== 404/, 'only a 404 is the disk state');
  assert.match(body, /S\.deletedSketch\(st\.names, st\.name\)/, 'the sketch leaves the list and the draft goes');
  assert.match(body, /setDoc\(\{ width: 800, height: 600, items: \[\] \}\)/, 'the canvas clears');
  assert.match(body, /return \{ missing: true \};/, 'the dialog is told the file is missing');
});

test('the battlefield view\'s reload reads a 404 as the disk state: the draft goes and the view is read-only', () => {
  const src = readFileSync(join(ROOT, 'workbench/modules/layout/battlefield-view.mjs'), 'utf8');
  const start = src.indexOf('async reload(path)');
  const body = src.slice(start, src.indexOf('hashOf(path)', start));
  assert.match(body, /err\.status !== 404/, 'only a 404 is the disk state');
  assert.match(body, /st\.parts = null;/, 'the draft goes');
  assert.match(body, /host\.history\.clear\(\);/, 'its history goes');
  assert.match(body, /deleted on disk/, 'the view says the file was deleted');
  assert.match(body, /return \{ missing: true \};/, 'the dialog is told the file is missing');
});

test('a sketch pick that finishes after a newer pick or a new sketch installs nothing and shows no error', () => {
  const src = readFileSync(join(ROOT, 'workbench/modules/layout/sketch-view.mjs'), 'utf8');
  const pick = src.slice(src.indexOf('async function pick(name)'), src.indexOf('function create()'));
  assert.match(pick, /const generation = gate\.begin\(\);/, 'the pick takes a generation');
  assert.equal((pick.match(/if \(!gate\.current\(generation\)\) return;/g) || []).length, 2, 'the completion and its error both drop when stale');
  const create = src.slice(src.indexOf('function create()'), src.indexOf('async function listNames()'));
  assert.match(create, /gate\.begin\(\);/, 'a new sketch takes a generation too');
});
