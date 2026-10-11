// tests/no-page-reload.test.mjs — importing saves must not reload the page, and a
// map remount caused by a setting waits while a modal is open.
//
// Source-level pins: the import door hands main.js a refresh, the only
// location.reload( left under src/ui or src/main.js is the offline panel's default
// parameter, and remountMapIfShowing consults the modal registry.
//
//   node --test tests/no-page-reload.test.mjs
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => readFileSync(join(root, rel), 'utf8');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.js') || full.endsWith('.mjs')) out.push(full);
  }
  return out;
}

// The body of a top-level function: from its header to the closing brace at column 0.
function bodyOf(source, header) {
  const start = source.indexOf(header);
  assert.notEqual(start, -1, `${header} exists`);
  const end = source.indexOf('\n}\n', start);
  assert.notEqual(end, -1, `${header} closes`);
  return source.slice(start, end + 3);
}

test('showOfflinePlay passes onImported, so an import does not reload the page', () => {
  const main = read('src/main.js');
  const body = bodyOf(main, 'function showOfflinePlay() {');
  assert.match(body, /onImported:\s*refreshAfterImport/);
  const refresh = bodyOf(main, 'function refreshAfterImport() {');
  assert.match(refresh, /saves\.loadMeta\(\)/);
  assert.match(refresh, /applyRestoredSettings\(settings\)/);
  assert.match(refresh, /rebuildRegistries\(activeSettings\)/);
  assert.match(refresh, /showTitle\(\{ skipStartup: true \}\)/);
});

test('location.reload( under src/ui and src/main.js is only the offline panel default', () => {
  const files = [...walk(join(root, 'src/ui')), join(root, 'src/main.js')];
  const hits = [];
  for (const file of files) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (line.includes('location.reload(')) hits.push({ where: `${relative(root, file)}:${i + 1}`, line: line.trim() });
    });
  }
  assert.deepEqual(hits.map((hit) => hit.where.split(':')[0]), ['src/ui/components/offlinePlay.js']);
  assert.match(hits[0].line, /^export function openOfflinePlay\(\{ transfer, assertImportAllowed = \(\) => \{\}, onImported = \(\) => location\.reload\(\) \}\) \{$/);
});

test('remountMapIfShowing defers to the modal registry', () => {
  const main = read('src/main.js');
  const body = bodyOf(main, 'function remountMapIfShowing(changed) {');
  assert.match(body, /modalOpen\(\)/);
  assert.match(body, /onModalsClosed\(/);
  assert.match(main, /import \{ modalOpen, onModalsClosed \} from '\.\/ui\/modalState\.js';/);
});

test('an import refresh restores the profile the way the Profile door does', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const body = main.match(/function refreshAfterImport\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
  for (const step of ['bringStoredProfileForward(', 'seedPromotedDefaults(', 'applyRestoredSettings(', 'rebuildRegistries(', 'showTitle(']) {
    assert.ok(body.includes(step), `refreshAfterImport calls ${step}`);
  }
  assert.ok(body.indexOf('bringStoredProfileForward(') < body.indexOf('applyRestoredSettings('), 'migrate before applying');
  assert.ok(body.indexOf('needsSettingsChoice(') < body.indexOf('seedPromotedDefaults('), 'decide whether imported preferences need a choice before promoting defaults');
  assert.match(body, /if \(!settingsChoicePending\) seedPromotedDefaults\(activeMeta, settings\);/, 'promotion waits until no imported-settings choice is pending');
  assert.match(body, /settingsChoiceChecked = true;/, 'showTitle consumes the pending flag without recomputing after import');
  assert.ok(!/activeSettings\s*=/.test(body), 'activeSettings is filled in place, never replaced');
});

test('the import copy promises no reload the page no longer does', () => {
  const offline = read('src/ui/components/offlinePlay.js');
  assert.ok(!offline.includes('reloads after import'), 'the confirmation does not promise a reload');
  assert.ok(!offline.includes('Reload the game to use them'), 'the success status does not ask for a reload');
});

test('an import refresh closes the Settings door before the title redraws', () => {
  const main = read('src/main.js');
  const refresh = bodyOf(main, 'function refreshAfterImport() {');
  assert.match(main, /let settingsDoor = null;/);
  const close = refresh.indexOf('settingsDoor?.close?.()');
  assert.notEqual(close, -1, 'refreshAfterImport closes settingsDoor');
  assert.ok(close < refresh.indexOf('showTitle('), 'settingsDoor closes before showTitle');
  assert.match(bodyOf(main, 'function showSettings() {'), /settingsDoor = openSettings\(/);
});
