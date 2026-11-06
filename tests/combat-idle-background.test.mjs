// A fight that is only being looked at runs no background work (perf pass, owner 2026-11-06).
// Each test pins one timer, observer or listener the combat screen used to keep alive while idle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');

test('auto combat arms its tick only while Auto is on, and every Auto change re-arms it', () => {
  const body = source.slice(source.indexOf('function scheduleAutoCombat'), source.indexOf('// ---------- rendering ----------'));
  assert.match(body, /if \(!policy\.enabled\) return;/, 'Auto off: no poll');
  assert.doesNotMatch(body, /\? 500 :/, 'the 500 ms idle poll is gone');
  const rearms = source.slice(source.indexOf('onAutoToggle:'), source.indexOf('onViewChange:'));
  assert.match(rearms, /scheduleAutoCombat\(\)/, 'the footer switch re-arms');
  const settled = source.slice(source.indexOf('const repaintAutoSwitch'), source.indexOf('window.addEventListener(OVERLAY_CLOSED_EVENT, repaintAutoSwitch)'));
  assert.match(settled, /scheduleAutoCombat\(\)/, 'Settings settling and the overlay closing re-arm');
});

test('combat.js starts no interval at all', () => {
  assert.doesNotMatch(source, /\bsetInterval\(/);
});

test('leaving the combat screen disarms End Turn, whose hold door listens on window', () => {
  const unmount = source.slice(source.indexOf('const pagerVeilObserver = new MutationObserver'), source.indexOf("combatEl.dataset.handPagerOwner = 'active'"));
  assert.match(unmount, /endTurnBeat\?\.\(\); endTurnBeat = null;/);
});

test('the reward Continue door is disarmed before a repaint re-arms it and when the screen is left', () => {
  const reward = readFileSync(new URL('../src/ui/screens/reward.js', import.meta.url), 'utf8');
  assert.match(reward, /disarmContinue\?\.\(\);\s*disarmContinue = beatArmer\(meta, registries\)\(cont, 'rewardContinue'/);
  assert.match(reward, /onDone\(chosenCardId\);\s*disarmContinue\?\.\(\); disarmContinue = null;/);
});

test('the hand pager re-syncs only when a veil is added or removed, not on every body mutation', () => {
  const observer = source.slice(source.indexOf('const isVeilNode'), source.indexOf("combatEl.dataset.handPagerOwner = 'active'"));
  assert.match(observer, /records\.some\(touchesVeil\)/);
  assert.match(observer, /classList\.contains\('modal-veil'\)/);
});

test('the focus-memory watcher arms no timer while nothing is remembered', () => {
  const input = readFileSync(new URL('../src/ui/input.js', import.meta.url), 'utf8');
  assert.match(input, /if \(scheduled \|\| !enabled \|\| !focusKey\) return;\s*scheduled = true;/);
});

test('the Potions list disarms its Use doors when it closes', () => {
  const row = readFileSync(new URL('../src/ui/components/combatActionRow.js', import.meta.url), 'utf8');
  assert.match(row, /onClose: \(\) => \{ while \(disarmers\.length\) disarmers\.pop\(\)\?\.\(\); \}/);
  assert.match(row, /disarmers\.push\(arm\(use, 'useFlask'/);
});
