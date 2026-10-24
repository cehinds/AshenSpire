import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Perf (W4-C): a repeated tools pass with unchanged inputs writes nothing and
// reads the toolbar's own height once, not once per renderCombatTools.
const tools = readFileSync(new URL('../src/ui/components/combatTools.js', import.meta.url), 'utf8');
const begin = tools.indexOf('  let frame = 0, entryKey'), end = tools.indexOf('  const observer =', begin);

function fixture() {
  const stats = { rowReads: 0, writes: 0 };
  const track = target => new Proxy(target, { set(object, key, value) { if (object[key] !== value) stats.writes++; object[key] = value; return true; } });
  const root = { isConnected: true, dataset: track({}), style: track({ setProperty() { stats.writes++; } }), getBoundingClientRect: () => { stats.rowReads++; return { height: 40 }; } };
  const box = { left: 0, top: 0, bottom: 844, width: 390 };
  const combatEl = { clientWidth: 390, dataset: { desktopFooter: 'false' }, style: { setProperty() {} }, getBoundingClientRect: () => box,
    querySelector: selector => selector === '.combat-action-row' ? { getBoundingClientRect: () => ({ top: 820 }) } : null };
  const api = runInNewContext(`${tools.slice(begin, end)}\n({ flushGeometry })`, {
    combatToolsTokens: () => ({ span: 'field', dy: 0 }), CORNER_INSET: 16, toolsRowTop() { return 0; }, toolsObstacles: () => [],
    getComputedStyle: () => ({ getPropertyValue: () => '0' }), root, combatEl, logButton: { getBoundingClientRect: () => ({ width: 80 }) },
    state: { size: 'Small' }, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
  return { api, stats, box };
}

test('a repeated tools pass does no toolbar height read and no style write', () => {
  const { api, stats, box } = fixture();
  api.flushGeometry();
  assert.equal(stats.rowReads, 1);
  const writes = stats.writes;
  api.flushGeometry(); api.flushGeometry();
  assert.equal(stats.rowReads, 1, 'unchanged width/zoom/inset reuse the measured height');
  assert.equal(stats.writes, writes, 'unchanged values are not rewritten');
  box.width = 520;
  api.flushGeometry();
  assert.equal(stats.rowReads, 2, 'a new width measures the wrapped row again');
});
