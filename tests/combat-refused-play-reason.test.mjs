import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// A tap that reaches playCard and goes no further must say why: one `ignored`
// line in the Command log, and for a refusal the player can act on, a tooltip
// on the card. Runs the shipped refusePlay + playCard sliced from combat.js.
const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const shipped = ['refusePlay', 'playCard'].map(name => {
  const start = source.indexOf(`  function ${name}(`), end = source.indexOf('\n  }', start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 4);
}).join('\n');

function harness({ energy = 5, stamina = 5, legalIds = ['e1'], cost = 0, staminaCost = 0 } = {}) {
  const logs = [], tips = [];
  const cardEl = { id: 'card-el' };
  const inst = { instanceId: 'c1' };
  const combat = { result: null, combatRounds: null, piles: { hand: [inst] },
    player: { energy, mana: 9, stamina } };
  const context = {
    combat, busy: false, upcastRanksByCard: new Map(), CSS: { escape: v => v },
    hasCardChoice: () => false, getEntity: () => ({ alive: true }),
    cardTargets: () => ({ legalIds }), unplayableReason: () => null,
    resolveCombatCard: () => ({}), readSettings: () => ({}), upcastOptions: () => [],
    cardChoicePlan: () => null, previewCard: () => ({ cost, manaCost: 0, staminaCost }),
    dlog: (...args) => logs.push(args), esc: v => String(v),
    showTooltipFor: (el, html) => tips.push({ el, html }),
    combatEl: { querySelector: () => cardEl },
    logIgnored() {}, lockReport: () => ({}), showPendingDiscard() {}, unqueueCard() {},
    expansionChoiceShell: null, hideTooltip() {}, selected: null,
    takeSnapshot: () => ({}), dispatch: () => { throw new Error('must not dispatch'); },
    lastTargetId: null, render() {}, console: { debug() {}, warn() {} },
  };
  runInNewContext(`${shipped}\nthis.playCard = playCard;`, context);
  return { context, logs, tips, cardEl };
}

test('not enough stamina: logs the numbers and shows a tooltip on the card', () => {
  const h = harness({ energy: 2, cost: 3 });
  h.context.playCard('c1', 'e1');
  const line = h.logs.find(l => l[0] === 'ignored');
  assert.ok(line, 'an ignored line was recorded');
  assert.equal(line[1], 'playCard c1');
  assert.match(line[2], /cost 3 > energy 2/);
  assert.equal(h.tips.length, 1);
  assert.equal(h.tips[0].el, h.cardEl);
  assert.match(h.tips[0].html, /Not enough stamina \(needs 3, have 2\)\./);
});

test('illegal target: logs target and legal ids and shows a tooltip', () => {
  const h = harness({ legalIds: ['e2'] });
  h.context.playCard('c1', 'e1');
  const line = h.logs.find(l => l[0] === 'ignored');
  assert.ok(line);
  assert.match(line[2], /illegal target e1, legal \[e2\]/);
  assert.equal(h.tips.length, 1);
  assert.match(h.tips[0].html, /can't be reached/);
});

test('a missing card element skips the tooltip but still logs', () => {
  const h = harness({ energy: 0, cost: 1 });
  h.context.combatEl.querySelector = () => null;
  h.context.playCard('c1', 'e1');
  assert.equal(h.logs.filter(l => l[0] === 'ignored').length, 1);
  assert.equal(h.tips.length, 0);
});
