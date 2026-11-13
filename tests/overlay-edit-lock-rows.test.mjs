import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rewardDom } from './helpers/dom.mjs';

// D15: the Settings overlay's quick-nav (folded switcher / mirror) shares the combat edit lock with the footer.
async function rows(lock) {
  const dom = rewardDom();
  const before = Object.fromEntries(Object.keys(dom).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  for (const target of [globalThis.document, globalThis.window].filter(Boolean)) for (const name of ['addEventListener', 'removeEventListener']) target[name] ||= () => {};
  try {
    const { lockEquipmentRows } = await import('../src/ui/components/quicknav.js');
    const panel = document.createElement('div'); document.body.append(panel);
    const made = ['inventory', 'character', 'save'].map(act => {
      const row = document.createElement('button'); row.className = 'qn-row'; row.setAttribute('data-act', act); panel.append(row); return row;
    });
    if (lock) lockEquipmentRows(panel);
    const out = made.map(row => [row.disabled, row.getAttribute('aria-disabled'), row.title || '']);
    panel.remove();
    return out;
  } finally {
    for (const [key, value] of Object.entries(before)) globalThis[key] = value;
  }
}

test('locked: Inventory and Character rows are disabled with the lock title, others stay enabled', async () => {
  const [inventory, character, save] = await rows(true);
  for (const row of [inventory, character]) { assert.equal(row[0], true); assert.equal(row[1], 'true'); assert.ok(row[2].length > 0); }
  assert.equal(save[0], false);
});

test('unlocked: the equipment rows stay enabled', async () => {
  for (const row of await rows(false)) assert.equal(row[0], false);
});

test('the overlay and main.js route the combat edit lock into the overlay switcher', () => {
  assert.match(readFileSync(new URL('../src/ui/components/overlay.js', import.meta.url), 'utf8'), /editLocked\?\.\(\)\) lockEquipmentRows\(panel\)/);
  assert.match(readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), /editLocked: \(\) => editingLocked\(run, xpCombat\)/);
});

test('every place main.js swaps or drops the run also clears the live combat, so the lock cannot leak into the next run', () => {
  const lines = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').split('\n');
  const swaps = lines.map((line, at) => [line, at]).filter(([line]) => /^\s*run\s*=\s*[^=]/.test(line));
  assert.ok(swaps.length >= 5);
  assert.ok(swaps.some(([line]) => /run = prepared\.run;/.test(line)), 'prepared-run adoption is included in the lock guard');
  for (const [line, at] of swaps) {
    const before = lines.slice(0, at).map(line => line.replace(/;\s*\/\/.*$/, ';').trim())
      .filter(line => line && !line.startsWith('//'));
    if (/run\s*=\s*prepared\.run\s*;/.test(line)) {
      const start = before.findLastIndex(line => /^const\s+prepared\s*=\s*CreatePreparedRun\(\{\s*$/.test(line));
      assert.ok(start > 0, 'prepared adoption has an explicit construction');
      assert.match(before[start - 1], /^xpCombat\s*=\s*null\s*;$/, 'combat is cleared immediately before preparing the new run');
      assert.match(before.slice(start).join('\n'), /^const\s+prepared\s*=\s*CreatePreparedRun\(\{(?:(?!\n\s*\}\);)[\s\S])*\n\s*\}\);$/, 'the prepared run is adopted immediately after construction');
    } else {
      assert.match(before.at(-1), /^xpCombat\s*=\s*null\s*;$/, `line ${at + 1}: ${line.trim()} clears combat immediately before swapping or dropping the run`);
    }
  }
});
