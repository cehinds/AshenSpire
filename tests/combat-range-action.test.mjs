import test from 'node:test';
import assert from 'node:assert/strict';
import { combatRangeActionPlan, rangeHitLabel } from '../src/ui/models/CombatRangeActionModel.js';
const target = { targetId: 'e1', band: 1, currentInRange: false, currentHitChance: 0, inRange: true, hitChance: 73.25, precisionDelta: 0 };
const quote = () => ({ range: { enabled: true, selectedRoute: 'advance', targets: [target], routes: [
  { id: 'advance', available: true, affordable: false, advanceSp: 1, precisionDelta: 0, costs: { energy: 3, stamina: 3, mana: 0 }, targets: [target] },
  { id: 'throw', available: true, affordable: true, advanceSp: 0, precisionDelta: -1, costs: { energy: 2, stamina: 2, mana: 0 }, targets: [{ ...target, hitChance: 66.5, precisionDelta: -1 }] },
] } });
test('current unreachable chance stays zero, separate from quoted after-route odds', () => {
  const q = quote();
  assert.equal(rangeHitLabel(q), 'Out of range · 0%');
  assert.equal(rangeHitLabel(q, { current: false }), '73.25%');
  const plan = combatRangeActionPlan(q, { targetName: () => 'Soldier' });
  assert.equal(plan.routes[0].label, 'Advance · +1 SP');
  assert.equal(plan.routes[0].total, 'Total 3 SP');
  assert.match(plan.routes[0].odds[0].text, /Soldier · Reach · Out of range · 0% → After Advance 73.25%/);
  assert.equal(plan.routes[1].label, 'Throw · -1 Precision');
  assert.equal(plan.routes[1].total, 'Total 2 SP');
  assert.equal(plan.selectedRoute, 'advance', 'unaffordable Advance never silently selects Throw');
});
test('disabled mechanics have no attachment and a refused Throw is never repriced as Advance', () => {
  assert.equal(combatRangeActionPlan({}), null);
  const q = quote(); q.range.selectedRoute = 'throw'; q.range.routes[1].available = false; q.range.routes[1].reason = 'range';
  const plan = combatRangeActionPlan(q);
  assert.equal(plan.selectedRoute, 'throw'); assert.equal(plan.routes[1].available, false);
  assert.equal(plan.routes[1].reason, 'range'); assert.equal(plan.routes[1].total, 'Total 2 SP');
});
test('multi-target approach prints every engine-quoted target and chance', () => {
  const q = quote(); q.range.routes[0].targets.push({ ...target, targetId: 'e2', band: 2, hitChance: 41.1 });
  const plan = combatRangeActionPlan(q);
  assert.equal(plan.routes[0].odds.length, 2); assert.match(plan.routes[0].odds[1].text, /e2 · Ranged.*41.1%/);
});

test('route controls keep native keyboard ownership and send only the chosen id', async () => {
  const { combatRangeAction } = await import('../src/ui/components/combatRangeAction.js');
  const { withKitDom } = await import('./helpers/kit-dom.mjs');
  withKitDom(({ document, Event }) => {
    const chosen = [];
    const node = combatRangeAction(quote(), { onChoose: id => chosen.push(id) });
    document.body.append(node);
    assert.equal(node.dataset.uiComponent, 'combat-range-action');
    const buttons = node.querySelectorAll('button');
    assert.equal(buttons.length, 2);
    assert.equal(buttons[0].getAttribute('aria-pressed'), 'true');
    assert.equal(buttons[0].disabled, false, 'an unaffordable route remains readable/selectable');
    buttons[1].dispatchEvent(new Event('click', { bubbles: true }));
    assert.deepEqual(chosen, ['throw']);
    const tab = new Event('keydown', { key: 'Tab', bubbles: true });
    node.dispatchEvent(tab);
    assert.equal(tab.propagationStopped, true);
    assert.equal(tab.defaultPrevented, false, 'native Tab still moves focus within controls');
  });
});

test('unaffordable default remains selectable without changing its route or price', async () => {
  const { canChooseRangeRoute } = await import('../src/ui/models/CombatRangeActionModel.js');
  const q = quote();
  assert.equal(canChooseRangeRoute(q), true);
  assert.equal(q.range.selectedRoute, 'advance');
  assert.equal(q.range.routes[0].affordable, false);
  assert.equal(q.range.routes[0].costs.energy, 3);
  q.range.enabled = false;
  assert.equal(canChooseRangeRoute(q), false);
});

test('fully covered attacks keep the face clear while target odds retain Reach benefit', () => {
  const q = quote();
  q.range.targets = [{ ...target, band: 0, currentInRange: true, currentHitChance: 80, hitChance: 80, precisionDelta: 1 }];
  q.range.routes.forEach(route => { route.advanceSp = 0; route.targets = q.range.targets; });
  assert.equal(combatRangeActionPlan(q), null);
  assert.equal(rangeHitLabel(q), '80% · +1 Precision');
});
test('Throw beyond its extension is omitted unless explicitly selected, then stays refused', () => {
  const q = quote(); q.range.routes[1].available = false;
  q.range.routes[1].targets = [{ ...target, band: 2, inRange: false, hitChance: 0 }];
  assert.deepEqual(combatRangeActionPlan(q).routes.map(route => route.id), ['advance']);
  q.range.selectedRoute = 'throw';
  const refused = combatRangeActionPlan(q).routes.find(route => route.id === 'throw');
  assert.equal(refused.available, false); assert.equal(refused.selected, true);
});

test('paid Counter variants show their own canonical route total and return odds', async () => {
  const { summarizeCardOption } = await import('../src/ui/models/CardOptionSummaryModel.js');
  const q = quote();
  const option = { id: 'counter-throw', name: 'Counter', play: { cardInstanceId: 'c1', rangeRoute: 'throw' }, staminaCost: 99, range: q.range };
  const summary = summarizeCardOption({ enemies: new Map([['soldier', { name: 'Soldier' }]]) }, { enemies: [{ id: 'e1', enemyId: 'soldier' }] }, option);
  assert.ok(summary.costs.includes('Throw · -1 Precision'));
  assert.ok(summary.costs.includes('Total 2 SP'));
  assert.match(summary.costs.join(' '), /Soldier.*Throw 66.5%/);
  assert.doesNotMatch(summary.costs.join(' '), /99/);
  assert.equal(summary.id, 'counter-throw', 'the modal still returns the engine option identity');
});
