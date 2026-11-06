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
