// A status tray reconciled in place (domWrite.morph, owner 2026-11-06; the morph itself is proven in a real DOM by
// tests/combat-hud-static.browser.mjs, the fixture DOM here has no class attribute) must not fit from its old items: gaining or losing a
// status, then refitting at another width, shows exactly the current statuses, and an overflowed tray's "+N" follows them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/kit-dom.mjs';
import { iconTray, trayIcon, setIconTrayOverflow, fitIconTray, refreshIconTray } from '../src/ui/components/iconTray.js';
import { markBuilt } from '../src/ui/domWrite.js';

const ids = row => [...row.children].filter(node => node.dataset?.statusId).map(node => node.dataset.statusId);
const more = row => [...row.children].find(node => node.className?.includes('status-overflow'))?.textContent || null;

test('refreshIconTray refits a tray from its current icons', () => withKitDom(({ document }) => {
  globalThis.document = document;
  globalThis.getComputedStyle = () => ({ fontSize: '16px', zoom: '1', getPropertyValue: () => '' });
  document.documentElement ||= document.createElement('html');
  const build = list => {
    const row = iconTray({ attrs: { class: 'statuses' } });
    for (const id of list) { const icon = trayIcon({ glyph: id, label: id, attrs: { class: 'status-icon' } }); icon.dataset.statusId = id; row.appendChild(icon); }
    setIconTrayOverflow(row, () => {});
    return row;
  };
  const host = document.createElement('div');
  const live = markBuilt(build(['A', 'B', 'C']));
  host.appendChild(live);
  const wide = 600, narrow = 60;
  fitIconTray(live, wide);
  assert.deepEqual(ids(live), ['A', 'B', 'C']);
  // Overflowed: fitted narrow, only some show and a "+N" tile stands.
  fitIconTray(live, narrow);
  assert.ok(more(live), 'narrow: the +N tile shows');
  const change = next => { const fresh = build(next); 
    // What domWrite.morph does to a fitted tray: the overflow tile goes, the current icons stand in the row, hidden ones included.
    live.replaceChildren(...fresh.children); refreshIconTray(live, fresh); };
  // Lose C while overflowed, refit at another width: no resurrected C.
  change(['A', 'B']);
  fitIconTray(live, wide);
  assert.deepEqual(ids(live), ['A', 'B'], 'a lost status stays lost');
  assert.equal(more(live), null, 'and no phantom +N is left behind');
  // Gain D, refit narrow then wide: the new status shows when room allows.
  change(['A', 'B', 'D']);
  fitIconTray(live, wide);
  assert.deepEqual(ids(live), ['A', 'B', 'D'], 'a gained status shows');
  fitIconTray(live, narrow);
  assert.ok(more(live), 'narrow again: +N follows the current count');
  change(['A', 'B', 'D', 'E']);
  fitIconTray(live, narrow);
  const shown = ids(live).length;
  assert.equal(more(live), `+${4 - shown}`, 'the +N counts the current statuses, not the old ones');
}));
