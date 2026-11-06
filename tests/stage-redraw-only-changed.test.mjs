// The combat stage redraws only what changed (owner report: "the player characters keep flickering, it
// should only redraw the component that changed"). Measured in Chromium, a resize refit rewrote 158 of 282
// combatant attributes with the value they already held; a render repeated them on the field. The helpers
// in src/ui/domWrite.js write only on a difference, and renderCombatantStage uses them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { setData, setAttr, setStyle, setVar } from '../src/ui/domWrite.js';
import { formationOccupancy } from '../src/model/formationOccupancy.js';

// A node that counts every write that reaches it.
function node() {
  const writes = [], attrs = new Map(), style = new Map();
  const dataset = new Proxy({}, { set(target, key, value) { writes.push(`data-${String(key)}`); target[key] = value; return true; } });
  const styleProxy = new Proxy({}, {
    get: (target, key) => key === 'getPropertyValue' ? name => style.get(name) ?? '' : key === 'setProperty' ? (name, v) => { writes.push(name); style.set(name, v); } : (target[key] ?? ''),
    set(target, key, value) { writes.push(`style.${String(key)}`); target[key] = value; return true; },
  });
  return { writes, dataset, style: styleProxy,
    getAttribute: name => attrs.get(name) ?? null, setAttribute(name, value) { writes.push(name); attrs.set(name, value); } };
}

test('the write helpers touch the node only when the value differs', () => {
  const el = node();
  assert.equal(setData(el, 'a', 1), true);
  assert.equal(setData(el, 'a', 1), false);
  assert.equal(setData(el, 'a', '1'), false);
  assert.equal(setData(el, 'a', 2), true);
  assert.equal(setAttr(el, 'aria-pressed', false), true);
  assert.equal(setAttr(el, 'aria-pressed', false), false);
  assert.equal(setStyle(el, 'left', '4px'), true);
  assert.equal(setStyle(el, 'left', '4px'), false);
  assert.equal(setVar(el, '--x', '1px'), true);
  assert.equal(setVar(el, '--x', '1px'), false);
  assert.deepEqual(el.writes, ['data-a', 'data-a', 'aria-pressed', 'style.left', '--x']);
});

test('renderCombatantStage with unchanged state writes nothing to the field and replaces no frame', () => {
  const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  const begin = source.indexOf('  function renderCombatantStage(');
  const end = source.indexOf('  function render()', begin);
  assert.ok(begin >= 0 && end > begin);
  const field = node();
  const frames = [];
  const context = {
    setData, formationOccupancy, combat: { player: { id: 'player', formationCell: 'A1' }, enemies: [], formationPolicy: null },
    selected: null, selfArm: false, selectedFlask: null, selectedCombatantId: null,
    $: () => field, hideTooltip() {},
    renderPlayer: () => frames.push('player'), renderEnemies: () => frames.push('enemies'),
    battlefieldStage: { refresh() {} }, formationMovement: { refresh() {} },
  };
  const { renderCombatantStage } = runInNewContext(source.slice(begin, end) + '\n({renderCombatantStage})', context);
  renderCombatantStage({ fit: false });
  const first = field.writes.length;
  assert.ok(first > 0, 'the first render publishes the field state');
  renderCombatantStage({ fit: false });
  renderCombatantStage({ fit: false });
  assert.equal(field.writes.length, first, 'an identical render adds no field writes');
});

test('the battlefield fit routes its per-combatant writes through the change-only helpers', () => {
  const source = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
  assert.match(source, /setStyle\(sprite, 'zoom'/);
  assert.doesNotMatch(source, /frame\.dataset\.(formationRow|baseSpriteScale|spriteRatio|groundY)\s*=/);
});

test('re-selecting the same combatant rewrites no aria-pressed or class on any frame', async () => {
  const { selectCombatantInfo } = await import('../src/ui/components/combatantOverhead.js');
  const writes = [];
  const frame = id => { const attrs = new Map([['aria-pressed', 'false']]), cls = new Set();
    return { dataset: { eid: id }, classList: { contains: c => cls.has(c), toggle(c, on) { if (on) cls.add(c); else cls.delete(c); } },
      getAttribute: n => attrs.get(n) ?? null, setAttribute(n, v) { writes.push(`${id}:${n}`); attrs.set(n, v); } }; };
  const frames = [frame('player'), frame('e1')];
  const root = { querySelectorAll: () => frames, matches: () => true, dispatchEvent() {} };
  globalThis.document ??= {}; 
  selectCombatantInfo(root, 'e1');
  const first = writes.length;
  selectCombatantInfo(root, 'e1');
  selectCombatantInfo(root, 'e1');
  assert.equal(writes.length, first, 'selecting the already selected combatant writes no attribute');
});
