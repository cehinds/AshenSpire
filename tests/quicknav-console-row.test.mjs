import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rewardDom } from './helpers/reward-dom.mjs';

// The quick menu carries a Console row in every context; its action is the session console viewer.
test('menuRows offers Console in the map, combat and overlay menus, in the comfort band before the armoury rows', async () => {
  const { menuRows } = await import('../src/ui/uiContent.js');
  for (const context of ['map', 'combat', 'overlay']) {
    const rows = menuRows(context, { hasSave: true });
    const at = rows.findIndex((r) => r.act === 'console');
    assert.ok(at >= 0, `${context} has a console row`);
    assert.equal(rows[at].label, 'Console');
    assert.ok(rows[at].tip.length > 0);
    assert.ok(at < rows.findIndex((r) => r.act === 'saveQuit'), 'Save and Quit stays below it');
    assert.equal(rows.at(-1).act, 'quit');
    // Still shown with no save slot (it is a read-only viewer).
    assert.ok(menuRows(context, { hasSave: false }).some((r) => r.act === 'console'));
  }
});

test('activating the Console row calls its action once and closes the menu', async () => {
  const dom = rewardDom();
  const before = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  for (const target of [globalThis.document, globalThis.window].filter(Boolean)) for (const name of ['addEventListener', 'removeEventListener']) target[name] ||= () => {};
  try {
    const { openQuickNav, quickNavIsOpen, closeQuickNav } = await import('../src/ui/components/quicknav.js');
    const anchor = document.createElement('button'); anchor.focus ||= () => {}; document.body.append(anchor);
    const calls = [];
    const panel = openQuickNav(anchor, 'map', { actions: { console: () => { calls.push('console'); } } });
    assert.ok(panel, 'the menu opened with only the console action');
    const row = panel.querySelector('.qn-row[data-act="console"]');
    assert.ok(row, 'the console row is drawn');
    assert.equal(row.querySelector(".qn-label")?.textContent || row.getAttribute("aria-label") || row.dataset?.label, "Console");
    row.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(calls, ['console']);
    assert.equal(quickNavIsOpen(), false);
    closeQuickNav();
  } finally {
    for (const [key, value] of Object.entries(before)) globalThis[key] = value;
  }
});

test('map, combat and overlay each wire the console action to openConsoleLog with their opener', () => {
  for (const [file, opener] of [['components/runHud.js', 'menuBtn'], ['screens/combat.js', 'menuBtn'], ['components/overlay.js', 'anchor']]) {
    const src = readFileSync(new URL(`../src/ui/${file}`, import.meta.url), 'utf8');
    assert.ok(src.includes(`console: () => { openConsoleLog({ opener: ${opener} }); }`), file);
  }
});
