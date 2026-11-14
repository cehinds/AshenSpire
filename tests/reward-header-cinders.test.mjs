// A won fight's cinders reach the header as the reward door opens (the header and the spoils strip agree).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withKitDom } from './helpers/dom.mjs';
import { cindersCounterHtml, SyncHudCinders } from '../src/ui/components/hudmeta.js';

test('SyncHudCinders rewrites the drawn counter value and its label', () => {
  withKitDom((dom) => {
    const host = dom.document.createElement('div');
    host.innerHTML = `<header class="shared-hud"><div data-ui-component="cinders-counter" aria-label="20 cinders"><span class="cv">20</span></div></header>`;
    SyncHudCinders(host, 78);
    const counter = host.querySelector('[data-ui-component="cinders-counter"]');
    assert.equal(counter.querySelector('.cv').textContent, '78');
    assert.equal(counter.getAttribute('aria-label'), '78 cinders');
    assert.doesNotThrow(() => SyncHudCinders(null, 1));
    assert.equal(typeof cindersCounterHtml, 'function');
  });
});

test('the reward door syncs the header purse before it opens, after the reward-screen import', () => {
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const open = src.indexOf('function showGameProfileReward()');
  const sync = src.indexOf('SyncHudCinders(app, run.cinders)', open);
  const mount = src.indexOf('mountGameProfileOfferDoor(pending', open);
  assert.ok(open > 0 && sync > open && sync < mount, 'the sync runs first in showGameProfileReward');
  assert.ok(src.indexOf("from './ui/components/hudmeta.js'") > src.indexOf("import { mountRewards } from './ui/screens/reward.js'"), 'imported after reward.js');
});
