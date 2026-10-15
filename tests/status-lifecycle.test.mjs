import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { applyStatus, decayAtTurnEnd, advanceStatusClock } from '../src/engine/statuses.js';
import { statusTooltipText, statusInstancePresentation } from '../src/ui/uiContent.js';
import { statusLifecycleText } from '../src/ui/statusLifecycle.js';

const registries = createRegistries(contentBundle);
const row = id => registries.statuses.get(id);
function harness(def, foundation = false) {
  const target = { id: 'test-owner', kind: 'enemy', alive: true, statuses: {} };
  const ctx = { foundation, registries: { statuses: { get: () => def } }, emit() {}, enqueue() {} };
  return { target, ctx, grant: value => applyStatus(ctx, target, def.id, value) };
}

test('buff inspection and combat tooltips share the registered stacking rule', () => {
  const def = row('strength'), h = harness(def);
  h.grant(2); h.grant(3);
  assert.equal(h.target.statuses.strength.stacks, 5);
  const full = statusTooltipText(def);
  assert.match(full, /Reapplying adds to the stack total/);
  assert.match(full, /No automatic turn-end decay/);
  assert.equal(statusInstancePresentation(def, h.target.statuses.strength).tooltip, full);
  const card = readFileSync(new URL('../src/ui/components/card.js', import.meta.url), 'utf8');
  assert.match(card, /tooltip: statusTooltipText\(display\)/);
});

test('no-decay does not promise that Evade lasts the whole fight', () => {
  const full = statusTooltipText(row('evade'));
  assert.match(full, /Lose 1 stack at the start of each round/);
  assert.match(full, /effects may still consume or remove it/);
  assert.doesNotMatch(full, /whole fight|entire combat|permanent/i);
});

test('owner-turn-end decay explains the same removal observed in the engine', () => {
  const def = row('weak'), h = harness(def);
  h.grant(2);
  decayAtTurnEnd(h.ctx, h.target);
  assert.equal(h.target.statuses.weak.stacks, 1);
  decayAtTurnEnd(h.ctx, h.target);
  assert.equal(h.target.statuses.weak, undefined);
  assert.match(statusTooltipText(def), /stack total decreases by 1 at the end of its owner's turn; removed at zero/);
});

test('timed percent payload keeps magnitude and reapplication timer separate', () => {
  const def = row('magicVulnerable'), h = harness(def);
  h.grant(25);
  decayAtTurnEnd(h.ctx, h.target);
  h.grant(10);
  const inst = h.target.statuses.magicVulnerable;
  assert.equal(inst.stacks, 25);
  assert.equal(inst.duration, def.decay.duration);
  const shown = statusInstancePresentation(def, inst);
  assert.equal(shown.valueText, '25%');
  assert.match(shown.tooltip, /keeps the higher effect value/);
  assert.match(shown.tooltip, new RegExp(`Turn timer: ${def.decay.duration} owner turn ends. Reapplying resets the timer`));
  assert.doesNotMatch(shown.tooltip, /higher stack|25 stacks/);
});

test('on-consume and unique statuses explain their rules without invented turns', () => {
  const full = statusTooltipText(row('chilled'));
  assert.match(full, /keeps the higher stack total/);
  assert.match(full, /consumed by its stated trigger/);
  assert.doesNotMatch(full, /Turn timer:/);
  const def = row('prone'), h = harness(def);
  h.grant(1); h.grant(5);
  assert.equal(h.target.statuses.prone.stacks, 1);
  assert.match(statusTooltipText(def), /Does not stack; reapplying keeps one active instance/);
});

test('meter points and tooltip tokens remain tied to registered definitions', () => {
  const def = row('bleed'), changed = { ...def, proc: { ...def.proc, threshold: 19 } };
  const full = statusTooltipText(changed);
  assert.match(full, /At 19,/);
  assert.match(full, /Reapplying adds to the build-up/);
  assert.doesNotMatch(full, /\{proc\./);
  assert.equal(statusTooltipText({ tooltip: 'Unknown {unbound}.' }), 'Unknown {unbound}.');
  assert.equal(statusTooltipText({ tooltip: 'A stance.', onEnter: [] }), 'A stance.');
});

test('foundation rules require context and use their own magnitude and expiry clock', () => {
  const def = { id: 'test', stackMode: 'add', decay: 'perTurnEnd', tooltip: '',
    stacking: { mode: 'refresh', cap: 9, duration: 2, clock: 'ownerTurnStart', refresh: false } };
  assert.match(statusTooltipText(def), /Reapplying adds to the stack total/);
  const h = harness(def, true);
  h.grant(3);
  advanceStatusClock(h.ctx, h.target, 'ownerTurnStart');
  h.grant(8);
  assert.equal(h.target.statuses.test.stacks, 3);
  assert.equal(h.target.statuses.test.applications[0].expires, 1);
  const full = statusInstancePresentation(def, h.target.statuses.test).tooltip;
  assert.match(full, /keeps the existing stack total up to 9/);
  assert.match(full, /2 ticks at the start of the owner's turn/);
  assert.match(full, /keeps the existing timer/);
  assert.doesNotMatch(full, /decreases by 1 at the end/);
  advanceStatusClock(h.ctx, h.target, 'ownerTurnStart');
  assert.equal(h.target.statuses.test, undefined);
});

test('foundation modes describe caps and source replacement without changing data', () => {
  for (const mode of ['add', 'refresh', 'replace', 'strongest', 'independent', 'unique']) {
    const def = Object.freeze({ id: 'test', stackMode: 'add', decay: 'none',
      stacking: Object.freeze({ mode, cap: 7, duration: 3 }) });
    const text = statusLifecycleText(def, { foundation: true });
    assert.ok(text.length > 0);
    assert.match(text, /Application timer: 3 ticks at the end of the owner's turn/);
    if (mode !== 'unique') assert.match(text, /up to 7/);
    if (['strongest', 'independent'].includes(mode)) assert.match(text, /source.*replaces its application/);
    if (['add', 'refresh'].includes(mode)) assert.match(text, /Reapplying resets the timer/);
  }
});

test('every registered status has resolvable lifecycle details without altering its definition', () => {
  for (const def of registries.statuses.all()) {
    const before = JSON.stringify(def);
    const detail = statusTooltipText(def);
    assert.ok(detail.startsWith(def.tooltip.split('{')[0]), def.id);
    assert.doesNotMatch(detail, /\{[^}]+\}/, def.id);
    assert.ok(detail.includes(statusLifecycleText(def)), def.id);
    assert.equal(JSON.stringify(def), before);
  }
});
